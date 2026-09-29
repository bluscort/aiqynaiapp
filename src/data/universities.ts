import type { L10n } from '@/i18n/types';
import type { ComboId } from './combos';

/**
 * Admission dataset used by Smart Matcher and the offline tutor.
 *
 * IMPORTANT: cutoff scores below are ORIENTATIVE values modelled on past-year grant
 * distributions. Before a production launch, replace them with the official
 * per-GOP / per-university data published by МНВО РК and НЦТ (testcenter.kz).
 */

export interface University {
  id: string;
  short: L10n;
  name: L10n;
  city: L10n;
  /** 1–5, used to order ambitious choices. */
  prestige: number;
}

export interface Program {
  id: string;
  uniId: string;
  gop: string;
  name: L10n;
  combos: ComboId[];
  /** Orientative general-competition cutoff (max 140). */
  cutoff: number;
  /** Orientative cutoff inside the rural quota pool. */
  ruralCutoff: number;
  /** Minimum UNT threshold for this kind of university / GOP. */
  minScore: number;
  grants: number;
  note?: L10n;
}

export const UNIVERSITIES: University[] = [
  { id: 'nu', short: { ru: 'NU', kk: 'NU' }, name: { ru: 'Назарбаев Университет', kk: 'Назарбаев Университеті' }, city: { ru: 'Астана', kk: 'Астана' }, prestige: 5 },
  { id: 'kbtu', short: { ru: 'KBTU', kk: 'KBTU' }, name: { ru: 'Казахстанско-Британский технический университет', kk: 'Қазақстан-Британ техникалық университеті' }, city: { ru: 'Алматы', kk: 'Алматы' }, prestige: 5 },
  { id: 'satbayev', short: { ru: 'Satbayev', kk: 'Satbayev' }, name: { ru: 'Satbayev University', kk: 'Satbayev University' }, city: { ru: 'Алматы', kk: 'Алматы' }, prestige: 4 },
  { id: 'kaznu', short: { ru: 'КазНУ', kk: 'ҚазҰУ' }, name: { ru: 'КазНУ им. аль-Фараби', kk: 'әл-Фараби атындағы ҚазҰУ' }, city: { ru: 'Алматы', kk: 'Алматы' }, prestige: 4 },
  { id: 'enu', short: { ru: 'ЕНУ', kk: 'ЕҰУ' }, name: { ru: 'ЕНУ им. Л. Н. Гумилёва', kk: 'Л. Н. Гумилев атындағы ЕҰУ' }, city: { ru: 'Астана', kk: 'Астана' }, prestige: 4 },
  { id: 'aitu', short: { ru: 'AITU', kk: 'AITU' }, name: { ru: 'Astana IT University', kk: 'Astana IT University' }, city: { ru: 'Астана', kk: 'Астана' }, prestige: 4 },
  { id: 'sdu', short: { ru: 'SDU', kk: 'SDU' }, name: { ru: 'SDU University', kk: 'SDU University' }, city: { ru: 'Каскелен', kk: 'Қаскелең' }, prestige: 3 },
  { id: 'kaznmu', short: { ru: 'КазНМУ', kk: 'ҚазҰМУ' }, name: { ru: 'КазНМУ им. С. Асфендиярова', kk: 'С. Асфендияров атындағы ҚазҰМУ' }, city: { ru: 'Алматы', kk: 'Алматы' }, prestige: 4 },
  { id: 'amu', short: { ru: 'МУА', kk: 'АМУ' }, name: { ru: 'Медицинский университет Астана', kk: 'Астана медицина университеті' }, city: { ru: 'Астана', kk: 'Астана' }, prestige: 3 },
  { id: 'smu', short: { ru: 'МУС', kk: 'СМУ' }, name: { ru: 'Медицинский университет Семей', kk: 'Семей медицина университеті' }, city: { ru: 'Семей', kk: 'Семей' }, prestige: 2 },
  { id: 'narxoz', short: { ru: 'Narxoz', kk: 'Narxoz' }, name: { ru: 'Университет Нархоз', kk: 'Нархоз университеті' }, city: { ru: 'Алматы', kk: 'Алматы' }, prestige: 3 },
  { id: 'karu', short: { ru: 'КарУ', kk: 'ҚарУ' }, name: { ru: 'КарУ им. Е. А. Букетова', kk: 'Е. А. Бөкетов атындағы ҚарУ' }, city: { ru: 'Караганда', kk: 'Қарағанды' }, prestige: 3 },
  { id: 'ktu', short: { ru: 'КарТУ', kk: 'ҚарТУ' }, name: { ru: 'КарТУ им. А. Сагинова', kk: 'Ә. Сағынов атындағы ҚарТУ' }, city: { ru: 'Караганда', kk: 'Қарағанды' }, prestige: 2 },
  { id: 'auezov', short: { ru: 'ЮКУ', kk: 'ОҚУ' }, name: { ru: 'ЮКУ им. М. Ауэзова', kk: 'М. Әуезов атындағы ОҚУ' }, city: { ru: 'Шымкент', kk: 'Шымкент' }, prestige: 2 },
];

/** Universities a student can pick as their dream target in the profile. */
export const TARGET_UNIVERSITY_IDS = ['nu', 'kbtu', 'satbayev', 'kaznu', 'enu', 'aitu', 'sdu', 'kaznmu', 'narxoz'];

export const getUniversity = (id: string): University =>
  UNIVERSITIES.find((u) => u.id === id) ?? UNIVERSITIES[0]!;

const GOP: Record<string, L10n> = {
  B044: { ru: 'Менеджмент и управление', kk: 'Менеджмент және басқару' },
  B046: { ru: 'Финансы, экономика, банковское и страховое дело', kk: 'Қаржы, экономика, банк және сақтандыру ісі' },
  B050: { ru: 'Биологические и смежные науки', kk: 'Биологиялық және сабақтас ғылымдар' },
  B053: { ru: 'Химия', kk: 'Химия' },
  B054: { ru: 'Физика', kk: 'Физика' },
  B057: { ru: 'Информационные технологии', kk: 'Ақпараттық технологиялар' },
  B058: { ru: 'Информационная безопасность', kk: 'Ақпараттық қауіпсіздік' },
  B062: { ru: 'Электротехника и энергетика', kk: 'Электр техникасы және энергетика' },
  B071: { ru: 'Горное дело и добыча полезных ископаемых', kk: 'Тау-кен ісі және пайдалы қазбаларды өндіру' },
  B086: { ru: 'Общая медицина', kk: 'Жалпы медицина' },
};

const NU_NOTE: L10n = {
  ru: 'NU проводит собственный отбор (NUET/IELTS) — вероятность по баллу ЕНТ условна.',
  kk: 'NU өз іріктеуін өткізеді (NUET/IELTS) — ҰБТ балы бойынша ықтималдық шартты.',
};

const MIN_GENERAL = 50;
const MIN_NATIONAL = 65;
const MIN_MEDICAL = 70;

type Row = [uniId: string, gop: string, combos: ComboId[], cutoff: number, rural: number, grants: number, min: number];

const ROWS: Row[] = [
  // Technical / IT
  ['nu', 'B057', ['math-phys', 'math-inf'], 130, 126, 60, MIN_NATIONAL],
  ['kbtu', 'B057', ['math-phys', 'math-inf'], 121, 116, 90, MIN_GENERAL],
  ['aitu', 'B057', ['math-phys', 'math-inf'], 113, 107, 250, MIN_GENERAL],
  ['aitu', 'B058', ['math-inf'], 110, 104, 120, MIN_GENERAL],
  ['satbayev', 'B057', ['math-phys', 'math-inf'], 109, 103, 200, MIN_NATIONAL],
  ['sdu', 'B057', ['math-inf'], 108, 102, 140, MIN_GENERAL],
  ['enu', 'B057', ['math-phys', 'math-inf'], 104, 97, 220, MIN_NATIONAL],
  ['satbayev', 'B062', ['math-phys'], 94, 88, 150, MIN_NATIONAL],
  ['kaznu', 'B054', ['math-phys'], 92, 85, 120, MIN_NATIONAL],
  ['karu', 'B057', ['math-phys', 'math-inf'], 88, 81, 160, MIN_GENERAL],
  ['satbayev', 'B071', ['math-phys'], 84, 77, 180, MIN_NATIONAL],
  ['auezov', 'B057', ['math-phys', 'math-inf'], 78, 71, 170, MIN_GENERAL],
  ['ktu', 'B062', ['math-phys'], 72, 66, 180, MIN_GENERAL],
  ['ktu', 'B071', ['math-phys'], 70, 64, 200, MIN_GENERAL],
  // Medicine / natural sciences
  ['kaznmu', 'B086', ['bio-chem'], 124, 118, 300, MIN_MEDICAL],
  ['amu', 'B086', ['bio-chem'], 117, 111, 280, MIN_MEDICAL],
  ['smu', 'B086', ['bio-chem'], 106, 100, 220, MIN_MEDICAL],
  ['kaznu', 'B050', ['bio-chem'], 93, 86, 120, MIN_NATIONAL],
  ['kaznu', 'B053', ['bio-chem'], 90, 83, 110, MIN_NATIONAL],
  ['enu', 'B050', ['bio-chem'], 86, 79, 100, MIN_NATIONAL],
  ['karu', 'B053', ['bio-chem'], 76, 70, 90, MIN_GENERAL],
  ['auezov', 'B050', ['bio-chem'], 72, 66, 100, MIN_GENERAL],
  // Economics / management
  ['kaznu', 'B046', ['math-geo'], 119, 113, 150, MIN_NATIONAL],
  ['kbtu', 'B046', ['math-geo'], 116, 110, 60, MIN_GENERAL],
  ['enu', 'B046', ['math-geo'], 111, 105, 140, MIN_NATIONAL],
  ['narxoz', 'B046', ['math-geo'], 99, 93, 120, MIN_GENERAL],
  ['narxoz', 'B044', ['math-geo'], 95, 89, 100, MIN_GENERAL],
  ['karu', 'B046', ['math-geo'], 84, 78, 110, MIN_GENERAL],
  ['auezov', 'B044', ['math-geo'], 72, 66, 120, MIN_GENERAL],
];

export const PROGRAMS: Program[] = ROWS.map(([uniId, gop, combos, cutoff, ruralCutoff, grants, minScore]) => ({
  id: `${uniId}-${gop}`,
  uniId,
  gop,
  name: GOP[gop]!,
  combos,
  cutoff,
  ruralCutoff,
  grants,
  minScore,
  note: uniId === 'nu' ? NU_NOTE : undefined,
}));
