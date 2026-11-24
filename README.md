# SkyForge Heli — Simulador de Vuelo de Helicóptero

Simulador web **arcade-realista** construido con **Three.js imperativo + React 19 + TypeScript + Web Audio API**.

## Características
- **Física de rotor propia a 120 Hz:** Empuje por coeficiente de paso colectivo, velocidad inducida (teoría de cantidad de movimiento), Efecto Suelo (Cheeseman-Bennett), Sustentación Traslacional Efectiva (ETL), par reactivo del rotor principal y antipar de cola.
- **Modo Dual:** *Asistido* (estabilización PID de velocidad vertical, actitud y antipar) y *Realista* (control directo sin compensación automática).
- **Entradas Multi-Dispositivo con Autodetección:** Teclado, Gamepad (Xbox/PlayStation), Joystick/HOTAS calibrable, Controles Táctiles duales y Ratón.
- **Mundo Procedural 4×4 km:** Valle alpino, lago, bosque instanciado (`InstancedMesh`), Helipuerto Base, Península del Faro, Mirador Norte y Refugio Alpino Sur.
- **Doble Instrumentación:** HUD de cristal en cámaras exteriores y tablero analógico aeronáutico SVG en cámara de cabina.
- **Audio Procedural:** Síntesis en vivo con Web Audio API (paso de pala *whop-whop*, turbina, viento y alertas).

## Comandos
```bash
npm install
npm run test
npm run lint
npm run build
npm run dev
```
