import { getCombo, type ComboId, type Subject } from '@/data/combos';
import { STATIC_QUESTIONS, type Question } from '@/data/questions';
import { GENERATORS } from './questionGen';

function pickOne(subject: Subject, hard: boolean, used: Set<string>): Question {
  const matchHard = <T extends { hard?: boolean }>(x: T) => !hard || !!x.hard;

  let statics = STATIC_QUESTIONS.filter((q) => q.subject === subject && !used.has(q.id) && matchHard(q));
  let gens = GENERATORS.filter((g) => g.subject === subject && matchHard(g));
  if (hard && statics.length === 0 && gens.length === 0) {
    // No hard material for this subject yet — fall back to the regular pool.
    statics = STATIC_QUESTIONS.filter((q) => q.subject === subject && !used.has(q.id));
    gens = GENERATORS.filter((g) => g.subject === subject);
  }

  const useGenerator = gens.length > 0 && (statics.length === 0 || Math.random() < 0.55);
  const question = useGenerator
    ? gens[Math.floor(Math.random() * gens.length)]!.make()
    : statics[Math.floor(Math.random() * statics.length)] ??
      // Every subject has at least one static question; reuse one if all were used.
      STATIC_QUESTIONS.find((q) => q.subject === subject)!;
  used.add(question.id);
  return question;
}

/** 5 micro-tests: two from the main profile subject, one from the second, plus the mandatory UNT blocks. */
export function buildDailyQuiz(combo: ComboId, hard = false): Question[] {
  const [s1, s2] = getCombo(combo).subjects;
  const plan: Subject[] = [s1, s2, 'history', s1, 'reading'];
  const used = new Set<string>();
  return plan.map((s) => pickOne(s, hard, used));
}

export function buildBattleQuiz(combo: ComboId): Question[] {
  const [s1, s2] = getCombo(combo).subjects;
  const plan: Subject[] = [s1, 'history', s2, 'reading', s1];
  const used = new Set<string>();
  return plan.map((s) => pickOne(s, false, used));
}
