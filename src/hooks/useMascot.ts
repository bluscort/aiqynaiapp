import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { getMascot, type MascotState } from '@/lib/mascot';
import { useUserStore } from '@/store/userStore';

/** Live orb state. Re-evaluated when the app returns to the foreground so a new day is picked up. */
export function useMascot(): MascotState {
  const lastFedDate = useUserStore((s) => s.lastFedDate);
  const satiety = useUserStore((s) => s.satiety);
  const satietyDate = useUserStore((s) => s.satietyDate);
  const streak = useUserStore((s) => s.streak);
  const preview = useUserStore((s) => s.moodPreview);
  const [foregroundTick, setForegroundTick] = useState(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForegroundTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  return useMemo(() => {
    const state = getMascot({ lastFedDate, satiety, satietyDate, streak });
    return preview ? { ...state, mood: preview } : state;
    // foregroundTick forces a recompute against the current date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastFedDate, satiety, satietyDate, streak, preview, foregroundTick]);
}
