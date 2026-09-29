/** Formats a number for display in math answers: trims float noise and uses a real minus sign. */
export function fmtNum(n: number): string {
  const rounded = Number.isInteger(n) ? n : parseFloat(n.toFixed(4));
  return String(rounded).replace('-', '−');
}

export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(String(value));
  }
  return out;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export const levelFromXp = (xp: number) => Math.floor(xp / 400) + 1;
