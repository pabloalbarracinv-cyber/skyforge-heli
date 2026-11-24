export type QualityPreset = 'high' | 'medium' | 'low';

export interface QualityConfig {
  preset: QualityPreset;
  pixelRatio: number;
  terrainSegments: number;
  treeCount: number;
  shadowMapSize: number; // 0 = sin sombras dinámicas
  antialias: boolean;
}

export function detectRecommendedQuality(): QualityPreset {
  if (typeof window === 'undefined') return 'high';
  const isMobileScreen = window.innerWidth < 860 || navigator.maxTouchPoints > 1;
  const cores = navigator.hardwareConcurrency ?? 4;

  if (isMobileScreen) {
    return cores >= 8 ? 'medium' : 'low';
  }
  return cores <= 4 ? 'medium' : 'high';
}

export function getQualityConfig(preset: QualityPreset): QualityConfig {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  switch (preset) {
    case 'low':
      return {
        preset: 'low',
        pixelRatio: Math.min(dpr, 1.25),
        terrainSegments: 128,
        treeCount: 450,
        shadowMapSize: 0,
        antialias: false,
      };
    case 'medium':
      return {
        preset: 'medium',
        pixelRatio: Math.min(dpr, 1.5),
        terrainSegments: 180,
        treeCount: 900,
        shadowMapSize: 1024,
        antialias: true,
      };
    case 'high':
    default:
      return {
        preset: 'high',
        pixelRatio: Math.min(dpr, 2.0),
        terrainSegments: 240,
        treeCount: 1500,
        shadowMapSize: 2048,
        antialias: true,
      };
  }
}
