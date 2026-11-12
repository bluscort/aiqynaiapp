export const colors = {
  bg: '#05070B',
  surface: '#0D111A',
  surface2: '#151B28',
  border: 'rgba(255,255,255,0.09)',
  borderStrong: 'rgba(255,255,255,0.18)',
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

export const gradients = {
  primary: ['#E2FF54', '#B8E619'],
  card: ['rgba(25,32,48,0.75)', 'rgba(13,17,26,0.9)'],
  // Opaque variant for surfaces that must hide what is behind them (speech bubble, modals).
  cardSolid: ['#182031', '#0D111A'],
  cyanGlow: ['rgba(34,211,238,0.18)', 'rgba(139,92,246,0.05)'],
  ring: ['#22D3EE', '#8B5CF6'],
  backdrop: ['#0B1120', '#05070B'],
  // Top-edge highlight of glass surfaces, left to right.
  edge: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.2)', 'rgba(255,255,255,0)'],
} as const;

/** Accent tints: translucent fill + border for a given accent colour. */
export const tints = {
  lime: { bg: 'rgba(212,245,60,0.12)', border: 'rgba(212,245,60,0.5)' },
  amber: { bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.45)' },
  green: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.6)' },
  red: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.6)' },
} as const;

/** Per-mood accent: ambient glow behind the orb, status dot, satiety bar. */
export const moodAccents = {
  happy: { color: '#22D3EE', glow: ['#22D3EE', '#8B5CF6'], glowOpacity: 0.2, bar: ['#22D3EE', '#8B5CF6'] },
  hungry: { color: '#F59E0B', glow: ['#F59E0B', '#B45309'], glowOpacity: 0.12, bar: ['#FBBF24', '#F59E0B'] },
  critical: { color: '#EF4444', glow: ['#EF4444', '#3F3F46'], glowOpacity: 0.1, bar: ['#F87171', '#EF4444'] },
} as const;

export const tierColors = {
  reach: '#3B82F6',
  target: '#22C55E',
  safety: '#FACC15',
} as const;

/** Leaderboard podium accents for ranks 1–3. */
export const medalColors = ['#FACC15', '#CBD5E1', '#D97706'] as const;

// Answer options: lettered badges, so they stay distinguishable without colour vision.
export const answerTiles = [
  { color: '#6366F1', bg: 'rgba(99,102,241,0.16)', border: 'rgba(99,102,241,0.45)', shape: 'A' },
  { color: '#06B6D4', bg: 'rgba(6,182,212,0.16)', border: 'rgba(6,182,212,0.45)', shape: 'B' },
  { color: '#F59E0B', bg: 'rgba(245,158,11,0.16)', border: 'rgba(245,158,11,0.45)', shape: 'C' },
  { color: '#EC4899', bg: 'rgba(236,72,153,0.16)', border: 'rgba(236,72,153,0.45)', shape: 'D' },
] as const;

export const radius = { sm: 10, md: 16, lg: 22, xl: 24, pill: 999 };
