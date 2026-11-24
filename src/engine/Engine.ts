import * as THREE from 'three';
import { HeliMesh } from '../aircraft/HeliMesh';
import { RotorDownwashFx } from '../aircraft/RotorFx';
import { AudioEngine } from '../audio/AudioEngine';
import { CameraRig } from '../camera/CameraRig';
import { InputManager } from '../input/InputManager';
import { MissionSystem } from '../missions/MissionSystem';
import type { MissionId, UserSettings } from '../persistence/SaveStore';
import { saveStore } from '../persistence/SaveStore';
import { FlightAssist } from '../physics/FlightAssist';
import type { ControlInputs } from '../physics/FlightModel';
import { stepFlightAerodynamics } from '../physics/FlightModel';
import { resolveGroundContact } from '../physics/GroundContact';
import { H125_SPEC } from '../physics/heliSpec';
import type { RigidBodyState } from '../physics/RigidBody';
import {
  cloneRigidBodyState,
  createRigidBodyState,
  getAttitudeAngles,
  integrateRigidBody,
} from '../physics/RigidBody';
import { ForestSystem } from '../world/Forest';
import { WorldLandmarks } from '../world/Landmarks';
import { SkySystem } from '../world/Sky';
import { TerrainSystem } from '../world/Terrain';
import { WaterSystem } from '../world/Water';
import { getQualityConfig } from './Quality';
import type { SimHudState } from './SimStore';
import { simStore } from './SimStore';

const FIXED_DT = 1 / 120;

export class SimEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;

  private sky: SkySystem;
  private terrain: TerrainSystem;
  private water: WaterSystem;
  private forest: ForestSystem;
  private landmarks: WorldLandmarks;
  private heliMesh: HeliMesh;
  private downwashFx: RotorDownwashFx;

  readonly cameraRig: CameraRig;
  readonly input = new InputManager();
  readonly audio = new AudioEngine();
  readonly missions: MissionSystem;

  private assist = new FlightAssist();
  private settings: UserSettings;

  private prevBody: RigidBodyState;
  private currBody: RigidBodyState;
  private rotorOmega = H125_SPEC.nominalOmega;
  private lastTorqueNm = 7000;
  private onGround = true;

  private activeControls: ControlInputs = {
    collective: 0.25,
    cyclicPitch: 0,
    cyclicRoll: 0,
    yawPedal: 0,
    engineOn: true,
  };

  private running = false;
  private paused = false;
  private rafId = 0;
  private lastFrameTimeMs = 0;
  private accumulator = 0;
  private elapsedWorldSec = 0;

  private fpsFrames = 0;
  private fpsAccumSec = 0;
  private measuredFps = 60;
  private resultSavedForRun = false;

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.cameraRig.resize(w, h);
  };

  private unlockAudioOnce = () => {
    this.audio.ensureStarted();
  };

  constructor(container: HTMLElement, initialSettings: UserSettings) {
    this.container = container;
    this.settings = initialSettings;
    const q = getQualityConfig(initialSettings.quality);

    this.renderer = new THREE.WebGLRenderer({
      antialias: q.antialias,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(q.pixelRatio);
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = q.shadowMapSize > 0;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.sky = new SkySystem(this.scene, q.shadowMapSize);
    this.terrain = new TerrainSystem(q.terrainSegments);
    this.scene.add(this.terrain.mesh);

    this.water = new WaterSystem();
    this.scene.add(this.water.mesh);

    this.forest = new ForestSystem(this.terrain, q.treeCount);
    this.forest.setShadowEnabled(q.shadowMapSize >= 2048);
    this.scene.add(this.forest.group);

    this.landmarks = new WorldLandmarks();
    this.scene.add(this.landmarks.group);

    this.heliMesh = new HeliMesh(H125_SPEC);
    this.scene.add(this.heliMesh.root);

    this.downwashFx = new RotorDownwashFx();
    this.scene.add(this.downwashFx.group);

    this.cameraRig = new CameraRig(
      (container.clientWidth || window.innerWidth) / Math.max(1, container.clientHeight || window.innerHeight)
    );
    this.cameraRig.attach(this.renderer.domElement);

    this.missions = new MissionSystem(
      (x, z) => this.terrain.getSurfaceHeight(x, z),
      (high) => this.audio.playPing(high)
    );
    this.scene.add(this.missions.group);

    this.input.setCalibration(initialSettings.joystickCalibration);
    this.input.attach();
    this.audio.setVolume(initialSettings.masterVolume);
    this.audio.setMuted(initialSettings.muted);

    this.currBody = createRigidBodyState(0, 20, 0);
    this.prevBody = cloneRigidBodyState(this.currBody);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('pointerdown', this.unlockAudioOnce, { passive: true });
    window.addEventListener('keydown', this.unlockAudioOnce, { passive: true });
  }

  startMission(missionId: MissionId): void {
    const def = this.missions.startMission(missionId);
    const padSurfaceY = this.terrain.getSurfaceHeight(def.spawn.x, def.spawn.z) + 0.6; // +0.6 altura losa helipuerto
    const headingRad = -(def.spawn.headingDeg * Math.PI) / 180;

    this.currBody = createRigidBodyState(
      def.spawn.x,
      padSurfaceY + H125_SPEC.skidHeight,
      def.spawn.z,
      headingRad
    );
    this.prevBody = cloneRigidBodyState(this.currBody);

    this.rotorOmega = H125_SPEC.nominalOmega;
    this.lastTorqueNm = 7000;
    this.onGround = true;
    this.resultSavedForRun = false;
    this.paused = false;

    this.assist.reset();
    this.input.resetForSpawn(this.settings.flightMode === 'assisted');

    this.heliMesh.root.position.copy(this.currBody.position);
    this.heliMesh.root.quaternion.copy(this.currBody.orientation);
    this.cameraRig.snapToHeli(this.currBody.position, this.currBody.orientation);

    if (!this.running) {
      this.running = true;
      this.lastFrameTimeMs = performance.now();
      this.rafId = requestAnimationFrame(this.loop);
    }
    this.emitHud(true);
  }

  restartCurrentMission(): void {
    const currentId = simStore.getSnapshot().mission.missionId;
    this.startMission(currentId);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.audio.update({
      rotorOmega: this.rotorOmega,
      nominalOmega: H125_SPEC.nominalOmega,
      blades: H125_SPEC.rotorBlades,
      collective: 0,
      airSpeedMs: 0,
      sinkRateWarning: false,
      paused: true,
    });
    this.emitHud(true);
  }

  togglePause(): void {
    this.setPaused(!this.paused);
  }

  applySettings(next: UserSettings): void {
    this.settings = next;
    this.input.setCalibration(next.joystickCalibration);
    this.audio.setVolume(next.masterVolume);
    this.audio.setMuted(next.muted);
    saveStore.saveSettings(next);
    this.emitHud(true);
  }

  toggleFlightMode(): void {
    const nextMode = this.settings.flightMode === 'assisted' ? 'realistic' : 'assisted';
    this.assist.reset();
    this.applySettings({ ...this.settings, flightMode: nextMode });
  }

  private sampleSurfaceWithPads = (x: number, z: number): number => {
    const base = this.terrain.getSurfaceHeight(x, z);
    // Los 4 helipuertos tienen una plataforma octogonal elevada 0.6 m sobre el terreno nivelado
    const pads = [
      { x: 0, z: 0, r: 12 },
      { x: 430, z: -480, r: 9 },
      { x: -520, z: -680, r: 9.5 },
      { x: -360, z: 540, r: 8.5 },
    ];
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (Math.hypot(x - p.x, z - p.z) <= p.r) {
        return base + 0.6;
      }
    }
    return base;
  };

  private loop = (nowMs: number) => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    const frameSec = Math.min(0.1, Math.max(0.001, (nowMs - this.lastFrameTimeMs) / 1000));
    this.lastFrameTimeMs = nowMs;

    // Medición FPS
    this.fpsFrames++;
    this.fpsAccumSec += frameSec;
    if (this.fpsAccumSec >= 0.5) {
      this.measuredFps = Math.round(this.fpsFrames / this.fpsAccumSec);
      this.fpsFrames = 0;
      this.fpsAccumSec = 0;
    }

    const inputSnap = this.input.update(frameSec, this.settings.flightMode === 'assisted', this.onGround);

    if (inputSnap.pauseRequested) {
      this.togglePause();
    }
    if (inputSnap.cameraCycleRequested) {
      this.cameraRig.cycleMode();
      this.emitHud(true);
    }
    if (inputSnap.resetRequested) {
      this.restartCurrentMission();
      return;
    }
    if (inputSnap.modeToggleRequested) {
      this.toggleFlightMode();
    }

    if (!this.paused) {
      this.elapsedWorldSec += frameSec;
      this.accumulator += frameSec;

      let lastTelemetry = stepFlightAerodynamics(
        this.currBody,
        this.activeControls,
        this.rotorOmega,
        this.sampleSurfaceWithPads(this.currBody.position.x, this.currBody.position.z),
        H125_SPEC,
        0
      ).telemetry;
      let landedCleanly = false;

      while (this.accumulator >= FIXED_DT) {
        this.prevBody = cloneRigidBodyState(this.currBody);

        const effectiveControls =
          this.settings.flightMode === 'assisted'
            ? this.assist.apply(
                inputSnap.controls,
                this.currBody,
                H125_SPEC,
                this.onGround,
                this.lastTorqueNm,
                this.rotorOmega,
                FIXED_DT
              )
            : inputSnap.controls;

        this.activeControls = effectiveControls;

        const surfY = this.sampleSurfaceWithPads(this.currBody.position.x, this.currBody.position.z);
        const aero = stepFlightAerodynamics(
          this.currBody,
          effectiveControls,
          this.rotorOmega,
          surfY,
          H125_SPEC,
          FIXED_DT
        );
        this.rotorOmega = aero.nextRotorOmega;
        this.lastTorqueNm = aero.telemetry.torqueNm;
        lastTelemetry = aero.telemetry;

        const ground = resolveGroundContact(
          this.currBody,
          H125_SPEC,
          this.sampleSurfaceWithPads,
          (x, z) => this.terrain.isWater(x, z)
        );
        this.onGround = ground.groundState.onGround;
        landedCleanly = ground.groundState.landedCleanly;

        if (ground.groundState.crashed) {
          this.missions.fail(ground.groundState.crashReason ?? 'Impacto fuerte contra el terreno');
        }

        const totalForce = aero.worldForce.add(ground.worldForce);
        const totalTorque = aero.bodyTorque.add(ground.bodyTorque);

        // Mantener dentro de los límites del mapa 4x4 km con retorno suave
        const bound = 1880;
        if (Math.abs(this.currBody.position.x) > bound) {
          totalForce.x -= (this.currBody.position.x - Math.sign(this.currBody.position.x) * bound) * 450;
        }
        if (Math.abs(this.currBody.position.z) > bound) {
          totalForce.z -= (this.currBody.position.z - Math.sign(this.currBody.position.z) * bound) * 450;
        }

        integrateRigidBody(
          this.currBody,
          totalForce,
          totalTorque,
          H125_SPEC.mass,
          H125_SPEC.inertia,
          FIXED_DT
        );

        this.accumulator -= FIXED_DT;
      }

      // Interpolación visual entre prevBody y currBody
      const alpha = this.accumulator / FIXED_DT;
      const renderPos = new THREE.Vector3().lerpVectors(this.prevBody.position, this.currBody.position, alpha);
      const renderQuat = new THREE.Quaternion().slerpQuaternions(
        this.prevBody.orientation,
        this.currBody.orientation,
        alpha
      );

      this.heliMesh.root.position.copy(renderPos);
      this.heliMesh.root.quaternion.copy(renderQuat);
      this.heliMesh.update(
        this.rotorOmega,
        H125_SPEC.nominalOmega,
        this.activeControls.cyclicPitch,
        this.activeControls.cyclicRoll,
        frameSec
      );

      // Ocultar cúpula exterior si estamos en cámara cabina no es necesario gracias a BackSide/transparencia,
      // pero actualizamos matriz mundo para obtener el ancla exacta de cabina
      this.heliMesh.root.updateMatrixWorld(true);
      const cockpitWorld = new THREE.Vector3();
      this.heliMesh.cockpitAnchor.getWorldPosition(cockpitWorld);

      this.cameraRig.update(renderPos, renderQuat, cockpitWorld, this.sampleSurfaceWithPads, frameSec);
      this.sky.followTarget(renderPos);
      this.water.update(this.elapsedWorldSec);
      this.landmarks.update(this.elapsedWorldSec);

      const surfAtHeli = this.sampleSurfaceWithPads(renderPos.x, renderPos.z);
      this.downwashFx.update(
        renderPos,
        surfAtHeli,
        lastTelemetry.aglMeters,
        this.terrain.isWater(renderPos.x, renderPos.z),
        lastTelemetry.thrustN,
        this.elapsedWorldSec
      );

      const missionStatus = this.missions.update(
        this.currBody.position,
        lastTelemetry.airSpeedMs,
        landedCleanly,
        frameSec
      );

      if (missionStatus.completed && !this.resultSavedForRun && missionStatus.missionId !== 'free_flight') {
        this.resultSavedForRun = true;
        saveStore.saveMissionResult({
          missionId: missionStatus.missionId,
          bestTimeSec: missionStatus.elapsedSec,
          bestScore: missionStatus.score,
          stars: missionStatus.stars,
          completedAtIso: new Date().toISOString(),
        });
        this.emitHud(true, lastTelemetry, inputSnap, missionStatus);
      } else if (missionStatus.failed && !this.resultSavedForRun) {
        this.resultSavedForRun = true;
        this.setPaused(true);
        this.emitHud(true, lastTelemetry, inputSnap, missionStatus);
      } else {
        this.emitHud(false, lastTelemetry, inputSnap, missionStatus);
      }

      const sinkWarning = lastTelemetry.aglMeters < 28 && lastTelemetry.verticalSpeedMs < -3.8;
      this.audio.update({
        rotorOmega: this.rotorOmega,
        nominalOmega: H125_SPEC.nominalOmega,
        blades: H125_SPEC.rotorBlades,
        collective: this.activeControls.collective,
        airSpeedMs: lastTelemetry.airSpeedMs,
        sinkRateWarning: sinkWarning,
        paused: false,
      });
    }

    this.renderer.render(this.scene, this.cameraRig.camera);
  };

  private emitHud(
    force = false,
    telemetry?: ReturnType<typeof stepFlightAerodynamics>['telemetry'],
    inputSnap?: ReturnType<InputManager['update']>,
    missionStatus?: ReturnType<MissionSystem['update']>
  ): void {
    const att = getAttitudeAngles(this.currBody.orientation);
    const surf = this.sampleSurfaceWithPads(this.currBody.position.x, this.currBody.position.z);
    const agl = telemetry?.aglMeters ?? Math.max(0, this.currBody.position.y - H125_SPEC.skidHeight - surf);
    const vsi = telemetry?.verticalSpeedMs ?? this.currBody.velocity.y;

    const nextState: SimHudState = {
      running: this.running,
      paused: this.paused,
      fps: this.measuredFps,
      altitudeMslMeters: this.currBody.position.y,
      aglMeters: agl,
      airSpeedMs: telemetry?.airSpeedMs ?? this.currBody.velocity.length(),
      forwardSpeedMs: telemetry?.forwardSpeedMs ?? 0,
      verticalSpeedMs: vsi,
      pitchDeg: (att.pitch * 180) / Math.PI,
      rollDeg: (att.roll * 180) / Math.PI,
      headingDeg: (att.heading * 180) / Math.PI,
      slipLateralMs: telemetry?.lateralSpeedMs ?? 0,
      rotorRpmPercent: (this.rotorOmega / H125_SPEC.nominalOmega) * 100,
      torquePercent: telemetry?.torquePercent ?? 20,
      igeActive: (telemetry?.igeFactor ?? 1) > 1.03,
      etlActive: (telemetry?.etlFactor ?? 1) > 1.02,
      collective: this.activeControls.collective,
      cyclicPitch: this.activeControls.cyclicPitch,
      cyclicRoll: this.activeControls.cyclicRoll,
      yawPedal: this.activeControls.yawPedal,
      engineOn: this.activeControls.engineOn,
      onGround: this.onGround,
      sinkRateWarning: agl < 28 && vsi < -3.8,
      flightMode: this.settings.flightMode,
      cameraMode: this.cameraRig.getMode(),
      activeDevice: inputSnap?.activeDevice ?? 'keyboard',
      gamepadName: inputSnap?.gamepadName ?? null,
      mouseFlightActive: inputSnap?.mouseFlightActive ?? this.input.mouse.isActive(),
      units: this.settings.units,
      mission:
        missionStatus ??
        this.missions.update(this.currBody.position, this.currBody.velocity.length(), false, 0),
    };

    simStore.publish(nextState, force);
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointerdown', this.unlockAudioOnce);
    window.removeEventListener('keydown', this.unlockAudioOnce);
    this.cameraRig.detach(this.renderer.domElement);
    this.input.detach();
    this.audio.dispose();
    this.terrain.dispose();
    this.water.dispose();
    this.forest.dispose();
    this.sky.dispose();
    this.downwashFx.dispose();
    this.renderer.dispose();
  }
}
