import { getCombo } from '@/data/combos';
import { PROGRAMS, getUniversity, type Program, type University } from '@/data/universities';
import { translate, type Lang } from '@/i18n';
import type { MatcherInput } from '@/store/userStore';

export type Tier = 'reach' | 'target' | 'safety';

export interface ScoredProgram {
  program: Program;
  university: University;
  probability: number;
  tier: Tier;
  effectiveCutoff: number;
}

export interface MatchPlan {
  reach: ScoredProgram[];
  target: ScoredProgram[];
  safety: ScoredProgram[];
  /** Final application order: 1 reach, 2 target, 1 safety (most ambitious first). */
  choices: ScoredProgram[];
  minThreshold: number;
  belowThreshold: boolean;
  hasSafety: boolean;
}

/** Spread of past cutoffs around the mean, in UNT points. */
const SIGMA = 5;
/** Social quotas form a separate, less competitive pool — modelled as a cutoff discount. */
const SOCIAL_QUOTA_DISCOUNT = 4;

export function grantProbability(score: number, cutoff: number): number {
  const z = (score - cutoff) / SIGMA;
  const p = 1 / (1 + Math.exp(-1.6 * z));
  return Math.min(0.98, Math.max(0.02, p));
}

export function tierOf(p: number): Tier {
  if (p >= 0.85) return 'safety';
  if (p >= 0.4) return 'target';
  return 'reach';
}

const byPrestigeThenChance = (a: ScoredProgram, b: ScoredProgram) =>
  b.university.prestige - a.university.prestige || b.probability - a.probability;

export function buildPlan(input: MatcherInput, targetUniId: string): MatchPlan {
  const programs = PROGRAMS.filter((p) => p.combos.includes(input.combo));

  const eligible: ScoredProgram[] = programs
    .filter((p) => input.score >= p.minScore)
    .map((program) => {
      let cutoff = input.rural ? program.ruralCutoff : program.cutoff;
      if (input.social) cutoff -= SOCIAL_QUOTA_DISCOUNT;
      const probability = grantProbability(input.score, cutoff);
      return { program, university: getUniversity(program.uniId), probability, tier: tierOf(probability), effectiveCutoff: cutoff };
    });

  const reach = eligible.filter((s) => s.tier === 'reach' && s.probability >= 0.05).sort(byPrestigeThenChance);
  const target = eligible.filter((s) => s.tier === 'target').sort(byPrestigeThenChance);
  const safety = eligible.filter((s) => s.tier === 'safety').sort(byPrestigeThenChance);

  const choices: ScoredProgram[] = [];
  const add = (s: ScoredProgram | undefined) => {
    if (s && choices.length < 4 && !choices.includes(s)) choices.push(s);
  };
  add(reach.find((s) => s.university.id === targetUniId) ?? reach[0]);
  target.slice(0, 2).forEach(add);
  add(safety[0]);
  // Not enough programs in some tier: fill up with the next best chances.
  [...eligible].sort((a, b) => b.probability - a.probability).forEach(add);
  choices.sort((a, b) => a.probability - b.probability);

  const minThreshold = programs.length ? Math.min(...programs.map((p) => p.minScore)) : 50;

  return {
    reach: reach.slice(0, 3),
    target: target.slice(0, 3),
    safety: safety.slice(0, 3),
    choices,
    minThreshold,
    belowThreshold: input.score < minThreshold,
    hasSafety: choices.some((c) => c.tier === 'safety'),
  };
}

export const pct = (p: number) => `${Math.round(p * 100)}%`;

export function formatPlan(plan: MatchPlan, input: MatcherInput, lang: Lang): string {
  const header = translate(lang, 'exportHeader', { score: input.score, combo: getCombo(input.combo).short[lang] });
  const lines = plan.choices.map(
    (c, i) =>
      `${i + 1}. [${c.tier.toUpperCase()} ${pct(c.probability)}] ${c.university.short[lang]} — ${c.program.gop} ${c.program.name[lang]}`,
  );
  return [header, ...lines].join('\n');
}
