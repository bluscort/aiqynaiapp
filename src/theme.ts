export const colors = {
  bg: '#07080C',
  surface: '#0F1218',
  surface2: '#161A22',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  text: '#F3F5F9',
  muted: '#8B93A5',
  faint: '#5A6275',
  lime: '#D4F53C',
  limeInk: '#12160A',
  cyan: '#22D3EE',
  violet: '#8B5CF6',
  amber: '#F59E0B',
  red: '#EF4444',
  green: '#22C55E',
};

export const tierColors = {
  reach: '#3B82F6',
  target: '#22C55E',
  safety: '#FACC15',
} as const;

// Kahoot-style answer tiles: colour + shape so they stay distinguishable without colour vision.
export const answerTiles = [
  { color: '#E21B3C', shape: '▲' },
  { color: '#1368CE', shape: '◆' },
  { color: '#D89E00', shape: '●' },
  { color: '#26890C', shape: '■' },
] as const;

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };
