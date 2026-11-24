import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SimEngine } from './engine/Engine';
import { simStore } from './engine/SimStore';
import type { TouchSource } from './input/TouchSource';
import type { MissionId, UserSettings } from './persistence/SaveStore';
import { saveStore } from './persistence/SaveStore';
import { CockpitPanel } from './ui/cockpit/CockpitPanel';
import { ControlsAndSettingsModal } from './ui/ControlsAndSettingsModal';
import { GlassHud } from './ui/hud/GlassHud';
import { MainMenu } from './ui/MainMenu';
import { MissionOverlay } from './ui/MissionOverlay';
import { TouchControls } from './ui/TouchControls';

export function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SimEngine | null>(null);

  const hud = useSyncExternalStore(simStore.subscribe, simStore.getSnapshot);

  const [settings, setSettings] = useState<UserSettings>(() => saveStore.getSettings());
  const [touchSource, setTouchSource] = useState<TouchSource | null>(null);
  const [hasFlownOnce, setHasFlownOnce] = useState(false);
  const [manualMenuOpen, setManualMenuOpen] = useState(true);
  const [modalState, setModalState] = useState<{ open: boolean; tab: 'controls' | 'settings' }>({
    open: false,
    tab: 'controls',
  });
  const [qualityEpoch, setQualityEpoch] = useState(0);

  // Inicializar motor Three.js de fondo (con vista viva del helipuerto incluso en el menú)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const currentSettings = saveStore.getSettings();
    const engine = new SimEngine(container, currentSettings);
    engineRef.current = engine;
    setTouchSource(engine.input.touch);

    engine.startMission('free_flight');
    engine.setPaused(true);

    return () => {
      engine.dispose();
      engineRef.current = null;
      setTouchSource(null);
    };
  }, [qualityEpoch]);

  // Estado derivado limpio (sin setState cascada en efectos)
  const pausedByEsc =
    hasFlownOnce && hud.paused && !hud.mission.completed && !hud.mission.failed;
  const showMenu = manualMenuOpen || pausedByEsc;
  const records = saveStore.getRecords();

  const handleUpdateSettings = (next: UserSettings) => {
    const qualityChanged = next.quality !== settings.quality;
    setSettings(next);
    saveStore.saveSettings(next);
    if (qualityChanged) {
      setQualityEpoch((e) => e + 1);
      setManualMenuOpen(true);
      setHasFlownOnce(false);
    } else {
      engineRef.current?.applySettings(next);
    }
  };

  const handleStartMission = (id: MissionId) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.audio.ensureStarted();
    eng.startMission(id);
    setHasFlownOnce(true);
    setManualMenuOpen(false);
  };

  const handleResume = () => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.audio.ensureStarted();
    eng.setPaused(false);
    setManualMenuOpen(false);
  };

  const isTouchVisible =
    !showMenu &&
    (hud.activeDevice === 'touch' ||
      (typeof window !== 'undefined' &&
        (window.innerWidth < 900 || navigator.maxTouchPoints > 1)));

  return (
    <div className="relative h-screen w-screen overflow-hidden select-none">
      {/* Lienzo 3D Three.js a pantalla completa */}
      <div ref={mountRef} className="fixed inset-0 z-0" />

      {/* HUD + Cabina + Misiones cuando estamos volando */}
      {!showMenu && (
        <>
          <GlassHud
            hud={hud}
            muted={settings.muted}
            onCycleCamera={() => engineRef.current?.cameraRig.cycleMode()}
            onToggleMode={() => {
              const nextMode = settings.flightMode === 'assisted' ? 'realistic' : 'assisted';
              handleUpdateSettings({ ...settings, flightMode: nextMode });
            }}
            onToggleMouse={() => {
              engineRef.current?.input.mouse.toggle();
            }}
            onRestart={() => engineRef.current?.restartCurrentMission()}
            onPause={() => {
              engineRef.current?.setPaused(true);
              setManualMenuOpen(true);
            }}
            onToggleMute={() =>
              handleUpdateSettings({ ...settings, muted: !settings.muted })
            }
            onOpenHelp={() => setModalState({ open: true, tab: 'controls' })}
          />

          <CockpitPanel hud={hud} />

          <MissionOverlay
            mission={hud.mission}
            onRestart={() => engineRef.current?.restartCurrentMission()}
            onReturnMenu={() => {
              engineRef.current?.setPaused(true);
              setManualMenuOpen(true);
            }}
          />

          {touchSource && (
            <TouchControls
              touchSource={touchSource}
              visible={isTouchVisible}
              assistedMode={settings.flightMode === 'assisted'}
              onGround={hud.onGround}
            />
          )}
        </>
      )}

      {/* Menú Principal Picasso Tech */}
      {showMenu && (
        <MainMenu
          settings={settings}
          records={records}
          hasActiveSession={hasFlownOnce && !hud.mission.completed && !hud.mission.failed}
          onSelectMission={handleStartMission}
          onResumeSession={handleResume}
          onToggleFlightMode={() => {
            const nextMode = settings.flightMode === 'assisted' ? 'realistic' : 'assisted';
            handleUpdateSettings({ ...settings, flightMode: nextMode });
          }}
          onOpenControls={() => setModalState({ open: true, tab: 'controls' })}
          onOpenSettings={() => setModalState({ open: true, tab: 'settings' })}
        />
      )}

      <ControlsAndSettingsModal
        open={modalState.open}
        tab={modalState.tab}
        settings={settings}
        onChangeTab={(tab) => setModalState({ open: true, tab })}
        onUpdateSettings={handleUpdateSettings}
        onClose={() => setModalState((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}

export default App;
