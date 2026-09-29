/**
 * Seed data for the "Алтын Лига" leaderboard. The MVP has no backend yet, so the
 * current user is ranked against this fixed demo season.
 */

export interface LeagueStudent {
  name: string;
  school: string;
  xp: number;
}

export interface LeagueSchool {
  name: string;
  city: string;
  xp: number;
  students: number;
}

export const LEAGUE_STUDENTS: LeagueStudent[] = [
  { name: 'Айгерим С.', school: 'НИШ ФМН, Алматы', xp: 4820 },
  { name: 'Нурсултан Б.', school: 'БИЛ, Шымкент', xp: 4510 },
  { name: 'Дана К.', school: 'НИШ ФМН, Астана', xp: 4175 },
  { name: 'Арман Т.', school: 'РФМШ, Алматы', xp: 3960 },
  { name: 'Жансая М.', school: 'СОШ №25, Караганда', xp: 3420 },
  { name: 'Ерасыл Д.', school: 'БИЛ, Актобе', xp: 3105 },
  { name: 'Мадина А.', school: 'НИШ ХБН, Усть-Каменогорск', xp: 2890 },
  { name: 'Темирлан Ж.', school: 'Гимназия №1, Тараз', xp: 2500 },
  { name: 'Аружан Н.', school: 'СОШ №12, Кызылорда', xp: 2350 },
  { name: 'Бекзат О.', school: 'Лицей №165, Алматы', xp: 2200 },
  { name: 'Алихан Р.', school: 'СОШ им. Абая, Семей', xp: 1740 },
  { name: 'Томирис Е.', school: 'Аульная СОШ, Туркестанская обл.', xp: 1310 },
  { name: 'Санжар У.', school: 'СОШ №3, Атырау', xp: 860 },
  { name: 'Камила Ш.', school: 'Гимназия №8, Павлодар', xp: 420 },
];

export const LEAGUE_SCHOOLS: LeagueSchool[] = [
  { name: 'НИШ ФМН', city: 'Астана', xp: 182_400, students: 64 },
  { name: 'РФМШ', city: 'Алматы', xp: 171_950, students: 58 },
  { name: 'БИЛ', city: 'Шымкент', xp: 150_300, students: 71 },
  { name: 'НИШ ФМН', city: 'Алматы', xp: 138_800, students: 49 },
  { name: 'Лицей №165', city: 'Алматы', xp: 97_200, students: 40 },
  { name: 'Гимназия №1', city: 'Тараз', xp: 81_650, students: 37 },
  { name: 'СОШ №25', city: 'Караганда', xp: 64_900, students: 33 },
  { name: 'Аульная СОШ', city: 'Туркестанская обл.', xp: 41_300, students: 22 },
];
