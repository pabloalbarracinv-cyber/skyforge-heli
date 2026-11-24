import * as THREE from 'three';

export class SkySystem {
  readonly sunLight: THREE.DirectionalLight;
  readonly hemiLight: THREE.HemisphereLight;
  readonly skyDome: THREE.Mesh;

  constructor(scene: THREE.Scene, shadowMapSize = 2048) {
    // Niebla atmosférica cálida dorada-azulada
    scene.fog = new THREE.FogExp2(0xcadbe8, 0.00042);
    scene.background = new THREE.Color(0x9ec5e6);

    this.hemiLight = new THREE.HemisphereLight(0xdff1ff, 0x5f6b54, 0.85);
    scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff4dc, 1.85);
    this.sunLight.position.set(280, 420, -240);
    this.sunLight.castShadow = shadowMapSize > 0;
    if (shadowMapSize > 0) {
      this.sunLight.shadow.mapSize.set(shadowMapSize, shadowMapSize);
      this.sunLight.shadow.camera.near = 50;
      this.sunLight.shadow.camera.far = 950;
      const d = 110;
      this.sunLight.shadow.camera.left = -d;
      this.sunLight.shadow.camera.right = d;
      this.sunLight.shadow.camera.top = d;
      this.sunLight.shadow.camera.bottom = -d;
      this.sunLight.shadow.bias = -0.0005;
    }
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    // Domo de cielo con gradiente por shader ligero
    const skyGeo = new THREE.SphereGeometry(2800, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x1f5b9c) },
        horizonColor: { value: new THREE.Color(0xdbe9f4) },
        sunDir: { value: new THREE.Vector3(280, 420, -240).normalize() },
      },
      vertexShader: `
        varying vec3 vWorldDirection;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldDirection = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 sunDir;
        varying vec3 vWorldDirection;
        void main() {
          float h = clamp(vWorldDirection.y * 1.2 + 0.08, 0.0, 1.0);
          vec3 col = mix(horizonColor, topColor, pow(h, 0.68));
          float sunDot = max(dot(normalize(vWorldDirection), sunDir), 0.0);
          col += vec3(1.0, 0.88, 0.65) * pow(sunDot, 48.0) * 0.55;
          col += vec3(1.0, 0.92, 0.78) * pow(sunDot, 8.0) * 0.12;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(this.skyDome);
  }

  // Mantiene la sombra centrada alrededor del helicóptero para máxima nitidez
  followTarget(targetPos: THREE.Vector3): void {
    this.skyDome.position.set(targetPos.x, 0, targetPos.z);
    this.sunLight.target.position.copy(targetPos);
    this.sunLight.position.set(targetPos.x + 220, targetPos.y + 320, targetPos.z - 190);
  }

  dispose(): void {
    this.skyDome.geometry.dispose();
    (this.skyDome.material as THREE.Material).dispose();
  }
}
