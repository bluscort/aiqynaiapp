import { daysBetween, todayKey } from './date';

export type Mood = 'happy' | 'hungry' | 'critical';

/** Full skipped days after which the orb enters the critical zone. */
export const CRITICAL_MISSED_DAYS = 2;
/** Full skipped days after which the streak burns and a hardcore revival test is required. */
export const GHOST_MISSED_DAYS = 5;
/** Satiety (%) from which the orb is considered full today. */
export const HAPPY_SATIETY = 60;

export interface MascotInput {
  lastFedDate: string | null;
  satiety: number;
  satietyDate: string | null;
  streak: number;
}

export interface MascotState {
  mood: Mood;
  /** 0–100, resets every day. */
  satiety: number;
  /** Fully skipped days since the last feeding (0 if fed today or yesterday). */
  missedDays: number;
  /** Streak burned — only a hardcore test brings the orb back. */
  ghost: boolean;
  /** Streak as shown in the HUD (0 once burned). */
  streak: number;
  fedToday: boolean;
}

export function getMascot(input: MascotInput, today: string = todayKey()): MascotState {
  const since = input.lastFedDate ? daysBetween(input.lastFedDate, today) : null;
  const satiety = input.satietyDate === today ? input.satiety : 0;
  const missedDays = since === null ? 0 : Math.max(0, since - 1);
  const ghost = since !== null && missedDays >= GHOST_MISSED_DAYS;

  let mood: Mood;
  if (since !== null && missedDays >= CRITICAL_MISSED_DAYS) mood = 'critical';
  else if (since === 0 && satiety >= HAPPY_SATIETY) mood = 'happy';
  else mood = 'hungry';

  return {
    mood,
    satiety,
    missedDays,
    ghost,
    streak: ghost ? 0 : input.streak,
    fedToday: since === 0,
  };
}
