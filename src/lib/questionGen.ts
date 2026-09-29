import type { Subject } from '@/data/combos';
import type { Question } from '@/data/questions';
import { fmtNum } from './format';

/**
 * "Задачи-клоны": each generator builds a fresh task from a template with new
 * numeric parameters, so answers cannot be memorised or copied.
 */

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickFrom = <T,>(arr: readonly T[]): T => arr[rand(0, arr.length - 1)]!;
let seq = 0;
const genId = (kind: string) => `gen-${kind}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** Four unique numeric options around the correct value, returned shuffled. */
function numericOptions(correct: number, step = 1, unit = ''): { options: string[]; answer: number } {
  const values = new Set<number>([correct]);
  let guard = 0;
  while (values.size < 4 && guard++ < 50) {
    const k = rand(-4, 4);
    if (k !== 0) values.add(correct + k * step);
  }
  const list = [...values].sort(() => Math.random() - 0.5);
  return {
    options: list.map((v) => `${fmtNum(v)}${unit}`),
    answer: list.indexOf(correct),
  };
}

const signed = (n: number) => (n >= 0 ? `+ ${n}` : `− ${Math.abs(n)}`);

interface Generator {
  subject: Subject;
  hard?: boolean;
  make: () => Question;
}

const squareExpr: Generator = {
  subject: 'math',
  make: () => {
    const p = rand(2, 6), q = rand(1, 4), a = rand(1, 4), b = rand(1, 4);
    const inner = p * a - q * b;
    const value = inner * inner;
    const { options, answer } = numericOptions(value, Math.max(2, Math.round(value / 6)));
    const steps = `${p}·${a} − ${q}·${b} = ${fmtNum(inner)};  (${fmtNum(inner)})² = ${value}`;
    return {
      id: genId('sq'), subject: 'math', answer,
      ru: { q: `Найдите значение выражения (${p}a − ${q}b)² при a = ${a}, b = ${b}.`, options, explain: steps },
      kk: { q: `a = ${a}, b = ${b} болғанда (${p}a − ${q}b)² өрнегінің мәнін табыңыз.`, options, explain: steps },
    };
  },
};

const linearEq: Generator = {
  subject: 'math',
  make: () => {
    const a = rand(2, 9), x = rand(-6, 12), b = rand(-20, 20);
    const c = a * x + b;
    const { options, answer } = numericOptions(x);
    const eq = `${a}x ${signed(b)} = ${fmtNum(c)}`;
    return {
      id: genId('lin'), subject: 'math', answer,
      ru: { q: `Решите уравнение: ${eq}`, options, explain: `${a}x = ${fmtNum(c)} ${signed(-b)} = ${fmtNum(c - b)};  x = ${fmtNum(c - b)} : ${a} = ${fmtNum(x)}` },
      kk: { q: `Теңдеуді шешіңіз: ${eq}`, options, explain: `${a}x = ${fmtNum(c)} ${signed(-b)} = ${fmtNum(c - b)};  x = ${fmtNum(c - b)} : ${a} = ${fmtNum(x)}` },
    };
  },
};

const percent: Generator = {
  subject: 'math',
  make: () => {
    const p = pickFrom([5, 10, 15, 20, 25, 30, 40, 60, 75]);
    const n = rand(2, 40) * 20;
    const value = (n * p) / 100;
    const { options, answer } = numericOptions(value, Math.max(1, Math.round(value / 5)));
    const steps = `${n} · ${p} / 100 = ${value}`;
    return {
      id: genId('pct'), subject: 'math', answer,
      ru: { q: `Грант покрывает ${p}% расходов. Сколько это от ${n} тыс. тенге (в тыс.)?`, options, explain: steps },
      kk: { q: `Грант шығынның ${p}%-ын өтейді. Бұл ${n} мың теңгенің қанша бөлігі (мың)?`, options, explain: steps },
    };
  },
};

const progression: Generator = {
  subject: 'math',
  make: () => {
    const a1 = rand(-5, 12), d = rand(2, 7), n = rand(6, 15);
    const an = a1 + (n - 1) * d;
    const { options, answer } = numericOptions(an, d);
    const steps = `aₙ = a₁ + (n − 1)d = ${fmtNum(a1)} + ${n - 1}·${d} = ${fmtNum(an)}`;
    return {
      id: genId('ap'), subject: 'math', answer,
      ru: { q: `Арифметическая прогрессия: a₁ = ${fmtNum(a1)}, d = ${d}. Найдите a${toSub(n)}.`, options, explain: steps },
      kk: { q: `Арифметикалық прогрессия: a₁ = ${fmtNum(a1)}, d = ${d}. a${toSub(n)} табыңыз.`, options, explain: steps },
    };
  },
};

const vieta: Generator = {
  subject: 'math',
  hard: true,
  make: () => {
    const r1 = rand(-6, 9), r2 = rand(-6, 9);
    const s = r1 + r2, pr = r1 * r2;
    const { options, answer } = numericOptions(pr, Math.max(2, Math.abs(Math.round(pr / 4)) || 2));
    const eq = `x² ${s >= 0 ? '−' : '+'} ${Math.abs(s)}x ${signed(pr)} = 0`;
    const steps = `x₁·x₂ = c/a = ${fmtNum(pr)}`;
    return {
      id: genId('vieta'), subject: 'math', hard: true, answer,
      ru: { q: `Найдите произведение корней уравнения ${eq}.`, options, explain: `По теореме Виета: ${steps}` },
      kk: { q: `${eq} теңдеуі түбірлерінің көбейтіндісін табыңыз.`, options, explain: `Виет теоремасы бойынша: ${steps}` },
    };
  },
};

const speed: Generator = {
  subject: 'physics',
  make: () => {
    const v = rand(2, 30), t = rand(2, 12);
    const s = v * t;
    const { options, answer } = numericOptions(v, 2, ' м/с');
    const steps = `v = s / t = ${s} / ${t} = ${v} м/с`;
    return {
      id: genId('v'), subject: 'physics', answer,
      ru: { q: `Тело прошло ${s} м за ${t} с. Найдите среднюю скорость.`, options, explain: steps },
      kk: { q: `Дене ${t} с ішінде ${s} м жол жүрді. Орташа жылдамдықты табыңыз.`, options, explain: steps },
    };
  },
};

const newton: Generator = {
  subject: 'physics',
  make: () => {
    const m = rand(2, 20), a = rand(1, 6);
    const f = m * a;
    const { options, answer } = numericOptions(f, Math.max(2, Math.round(f / 6)), ' Н');
    const steps = `F = m·a = ${m}·${a} = ${f} Н`;
    return {
      id: genId('f'), subject: 'physics', answer,
      ru: { q: `Тело массой ${m} кг движется с ускорением ${a} м/с². Найдите равнодействующую силу.`, options, explain: steps },
      kk: { q: `Массасы ${m} кг дене ${a} м/с² үдеумен қозғалады. Тең әсерлі күшті табыңыз.`, options, explain: steps },
    };
  },
};

const kinetic: Generator = {
  subject: 'physics',
  make: () => {
    const m = pickFrom([2, 4, 6, 8, 10]), v = rand(2, 10);
    const e = (m * v * v) / 2;
    const { options, answer } = numericOptions(e, Math.max(2, Math.round(e / 5)), ' Дж');
    const steps = `E = mv²/2 = ${m}·${v}²/2 = ${e} Дж`;
    return {
      id: genId('ek'), subject: 'physics', answer,
      ru: { q: `Найдите кинетическую энергию тела массой ${m} кг, движущегося со скоростью ${v} м/с.`, options, explain: steps },
      kk: { q: `Массасы ${m} кг, жылдамдығы ${v} м/с дененің кинетикалық энергиясын табыңыз.`, options, explain: steps },
    };
  },
};

const ohm: Generator = {
  subject: 'physics',
  make: () => {
    const r = rand(2, 20), i = rand(1, 6);
    const u = i * r;
    const { options, answer } = numericOptions(i, 1, ' А');
    const steps = `I = U / R = ${u} / ${r} = ${i} А`;
    return {
      id: genId('ohm'), subject: 'physics', answer,
      ru: { q: `Напряжение на резисторе ${u} В, сопротивление ${r} Ом. Найдите силу тока.`, options, explain: steps },
      kk: { q: `Резистордағы кернеу ${u} В, кедергісі ${r} Ом. Ток күшін табыңыз.`, options, explain: steps },
    };
  },
};

const density: Generator = {
  subject: 'physics',
  hard: true,
  make: () => {
    const rho = pickFrom([800, 1000, 2700, 7800]), v = rand(2, 9);
    const mass = rho * v;
    const { options, answer } = numericOptions(mass, rho / 2, ' кг');
    const steps = `m = ρ·V = ${rho}·${v} = ${mass} кг`;
    return {
      id: genId('rho'), subject: 'physics', hard: true, answer,
      ru: { q: `Плотность вещества ${rho} кг/м³, объём тела ${v} м³. Найдите массу.`, options, explain: steps },
      kk: { q: `Заттың тығыздығы ${rho} кг/м³, дене көлемі ${v} м³. Массасын табыңыз.`, options, explain: steps },
    };
  },
};

const binary: Generator = {
  subject: 'informatics',
  make: () => {
    const n = rand(5, 31);
    const bin = n.toString(2);
    const { options, answer } = numericOptions(n, 1);
    const steps = bin
      .split('')
      .map((bit, i) => `${bit}·2${toSup(bin.length - 1 - i)}`)
      .join(' + ') + ` = ${n}`;
    return {
      id: genId('bin'), subject: 'informatics', answer,
      ru: { q: `Переведите ${bin}₂ в десятичную систему.`, options, explain: steps },
      kk: { q: `${bin}₂ санын ондық жүйеге аударыңыз.`, options, explain: steps },
    };
  },
};

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
function toSub(n: number) {
  return String(n).split('').map((d) => SUB[Number(d)]).join('');
}
function toSup(n: number) {
  return String(n).split('').map((d) => SUP[Number(d)]).join('');
}

export const GENERATORS: Generator[] = [squareExpr, linearEq, percent, progression, vieta, speed, newton, kinetic, ohm, density, binary];
