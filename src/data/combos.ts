import type { L10n } from '@/i18n/types';

export type Subject =
  | 'math'
  | 'physics'
  | 'informatics'
  | 'chemistry'
  | 'biology'
  | 'geography'
  | 'history'
  | 'reading';

export type ComboId = 'math-phys' | 'math-inf' | 'bio-chem' | 'math-geo';

export interface Combo {
  id: ComboId;
  short: L10n;
  subjects: [Subject, Subject];
}

export const COMBOS: Combo[] = [
  { id: 'math-phys', short: { ru: 'Физ-Мат', kk: 'Физ-Мат' }, subjects: ['math', 'physics'] },
  { id: 'math-inf', short: { ru: 'Мат-Инф', kk: 'Мат-Инф' }, subjects: ['math', 'informatics'] },
  { id: 'bio-chem', short: { ru: 'Био-Хим', kk: 'Био-Хим' }, subjects: ['biology', 'chemistry'] },
  { id: 'math-geo', short: { ru: 'Мат-Гео', kk: 'Мат-Гео' }, subjects: ['math', 'geography'] },
];

export const getCombo = (id: ComboId): Combo => COMBOS.find((c) => c.id === id) ?? COMBOS[0]!;

export const SUBJECTS: Subject[] = [
  'math',
  'physics',
  'informatics',
  'chemistry',
  'biology',
  'geography',
  'history',
  'reading',
];

export const SUBJECT_LABELS: Record<Subject, L10n> = {
  math: { ru: 'Математика', kk: 'Математика' },
  physics: { ru: 'Физика', kk: 'Физика' },
  informatics: { ru: 'Информатика', kk: 'Информатика' },
  chemistry: { ru: 'Химия', kk: 'Химия' },
  biology: { ru: 'Биология', kk: 'Биология' },
  geography: { ru: 'География', kk: 'География' },
  history: { ru: 'История КЗ', kk: 'Қазақстан тарихы' },
  reading: { ru: 'Грамотность', kk: 'Сауаттылық' },
};

export const SUBJECT_SHORT: Record<Subject, L10n> = {
  math: { ru: 'Мат', kk: 'Мат' },
  physics: { ru: 'Физ', kk: 'Физ' },
  informatics: { ru: 'Инф', kk: 'Инф' },
  chemistry: { ru: 'Хим', kk: 'Хим' },
  biology: { ru: 'Био', kk: 'Био' },
  geography: { ru: 'Гео', kk: 'Гео' },
  history: { ru: 'Ист', kk: 'Тар' },
  reading: { ru: 'Грам', kk: 'Сауат' },
};
