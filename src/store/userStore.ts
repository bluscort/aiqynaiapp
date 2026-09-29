import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ComboId, Subject } from '@/data/combos';
import type { Lang } from '@/i18n/types';
import { daysBetween, todayKey } from '@/lib/date';
import { GHOST_MISSED_DAYS, type Mood } from '@/lib/mascot';

export type DuelOutcome = 'win' | 'lose' | 'draw';

export interface DailyAnswer {
  subject: Subject;
  correct: boolean;
}

export interface DailyResult {
  correct: number;
  total: number;
  xp: number;
  coins: number;
  fed: boolean;
  revived: boolean;
  reviveFailed: boolean;
  streak: number;
}

export interface MatcherInput {
  score: number;
  combo: ComboId;
  rural: boolean;
  social: boolean;
}

export interface Reminders {
  enabled: boolean;
  hour: number;
  minute: number;
}

const XP_PER_CORRECT = 10;
const COINS_PER_CORRECT = 2;
const SATIETY_PER_CORRECT = 20;
const PERFECT_BONUS_XP = 20;
export const REVIVE_MIN_CORRECT = 4;
const DUEL_SUBJECT_XP = 5;

export const DUEL_REWARDS: Record<DuelOutcome, { xp: number; coins: number }> = {
  win: { xp: 50, coins: 15 },
  draw: { xp: 20, coins: 0 },
  lose: { xp: 10, coins: 0 },
};

interface PersistedState {
  language: Lang;
  name: string;
  grade: 10 | 11;
  targetUniId: string;
  combo: ComboId;
  xp: number;
  coins: number;
  streak: number;
  lastFedDate: string | null;
  satiety: number;
  satietyDate: string | null;
  subjectXp: Partial<Record<Subject, number>>;
  arena: { wins: number; losses: number; draws: number };
  reminders: Reminders;
  matcher: MatcherInput;
}

interface UserState extends PersistedState {
  /** Demo-only override of the orb mood (long-press the orb). Not persisted. */
  moodPreview: Mood | null;
  setLanguage: (language: Lang) => void;
  updateProfile: (patch: Partial<Pick<PersistedState, 'name' | 'grade' | 'targetUniId' | 'combo'>>) => void;
  setReminders: (patch: Partial<Reminders>) => void;
  setMatcher: (patch: Partial<MatcherInput>) => void;
  completeDailyQuiz: (answers: DailyAnswer[], hardcore: boolean) => DailyResult;
  recordDuel: (outcome: DuelOutcome, correctSubjects: Subject[]) => { xp: number; coins: number };
  setMoodPreview: (mood: Mood | null) => void;
}

const initialState: PersistedState = {
  language: 'ru',
  name: 'Абитуриент',
  grade: 11,
  targetUniId: 'satbayev',
  combo: 'math-phys',
  xp: 0,
  coins: 50,
  streak: 0,
  lastFedDate: null,
  satiety: 0,
  satietyDate: null,
  subjectXp: {},
  arena: { wins: 0, losses: 0, draws: 0 },
  reminders: { enabled: false, hour: 19, minute: 0 },
  matcher: { score: 95, combo: 'math-phys', rural: false, social: false },
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      ...initialState,
      moodPreview: null,

      setLanguage: (language) => set({ language }),

      updateProfile: (patch) =>
        set((s) => ({
          ...patch,
          // Changing profile subjects in the profile also updates the matcher input.
          matcher: patch.combo ? { ...s.matcher, combo: patch.combo } : s.matcher,
        })),

      setReminders: (patch) => set((s) => ({ reminders: { ...s.reminders, ...patch } })),

      setMatcher: (patch) => set((s) => ({ matcher: { ...s.matcher, ...patch } })),

      completeDailyQuiz: (answers, hardcore) => {
        const s = get();
        const today = todayKey();
        const correct = answers.filter((a) => a.correct).length;
        const xp = correct * XP_PER_CORRECT + (correct > 0 && correct === answers.length ? PERFECT_BONUS_XP : 0);
        const coins = correct * COINS_PER_CORRECT;

        const subjectXp = { ...s.subjectXp };
        for (const a of answers) {
          if (a.correct) subjectXp[a.subject] = (subjectXp[a.subject] ?? 0) + XP_PER_CORRECT;
        }

        const since = s.lastFedDate ? daysBetween(s.lastFedDate, today) : null;
        let { streak, lastFedDate } = s;
        let fed = false;
        let revived = false;
        let reviveFailed = false;

        if (hardcore) {
          if (correct >= REVIVE_MIN_CORRECT) {
            fed = revived = true;
            streak = 1;
            lastFedDate = today;
          } else {
            reviveFailed = true;
          }
        } else if (correct > 0) {
          fed = true;
          if (since === 0) streak = Math.max(1, streak);
          else if (since !== null && since - 1 < GHOST_MISSED_DAYS) streak += 1;
          else streak = 1;
          lastFedDate = today;
        }

        const prevSatiety = s.satietyDate === today ? s.satiety : 0;
        const satiety = fed ? Math.min(100, prevSatiety + correct * SATIETY_PER_CORRECT) : prevSatiety;

        set({
          xp: s.xp + xp,
          coins: s.coins + coins,
          subjectXp,
          streak,
          lastFedDate,
          satiety,
          satietyDate: today,
          moodPreview: null,
        });

        return { correct, total: answers.length, xp, coins, fed, revived, reviveFailed, streak };
      },

      recordDuel: (outcome, correctSubjects) => {
        const reward = DUEL_REWARDS[outcome];
        set((s) => {
          const subjectXp = { ...s.subjectXp };
          for (const subj of correctSubjects) subjectXp[subj] = (subjectXp[subj] ?? 0) + DUEL_SUBJECT_XP;
          return {
            xp: s.xp + reward.xp,
            coins: s.coins + reward.coins,
            subjectXp,
            arena: {
              wins: s.arena.wins + (outcome === 'win' ? 1 : 0),
              losses: s.arena.losses + (outcome === 'lose' ? 1 : 0),
              draws: s.arena.draws + (outcome === 'draw' ? 1 : 0),
            },
          };
        });
        return reward;
      },

      setMoodPreview: (moodPreview) => set({ moodPreview }),
    }),
    {
      name: 'aiqyn-user',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ moodPreview, setLanguage, updateProfile, setReminders, setMatcher, completeDailyQuiz, recordDuel, setMoodPreview, ...persisted }) =>
        persisted,
    },
  ),
);

/** True once AsyncStorage has been read, so the first frame never flashes default values. */
export function useStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useUserStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useUserStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useUserStore.persist.hasHydrated());
    return unsub;
  }, []);
  return hydrated;
}
