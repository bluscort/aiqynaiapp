import { useCallback } from 'react';
import { interpolate } from '@/lib/format';
import { useUserStore } from '@/store/userStore';
import { STRINGS, type StringKey } from './strings';
import type { L10n, Lang } from './types';

export type { L10n, Lang, StringKey };

export type TFunction = (key: StringKey, vars?: Record<string, string | number>) => string;

export function translate(lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  return interpolate(STRINGS[lang][key], vars);
}

export function useLang(): Lang {
  return useUserStore((s) => s.language);
}

export function useT(): TFunction {
  const lang = useLang();
  return useCallback((key, vars) => translate(lang, key, vars), [lang]);
}
