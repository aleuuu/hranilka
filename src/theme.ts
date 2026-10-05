/* Темы оформления: тёмная (как в макете) и светлая.
   Цвета макета зашиты в стили; функция css() подменяет каждый серый из макета на переменную --g-xxxxxx,
   а зелёный акцент (оттенок 155) — на оттенок --acc-h. Для светлой темы здесь вычисляются значения этих переменных,
   поэтому интерфейс перекрашивается целиком без правки экранов. */

export type ThemeMode = "light" | "dark";
export interface ThemeCfg { mode: ThemeMode }

export const DEFAULT_THEME: ThemeCfg = { mode: "dark" };

/** Все серые из макета. Их и подменяет css(). */
export const GRAYS = [
  "0b0b0c", "0c0c0d", "0e0e0f", "111113", "121214", "141416", "151517", "17171a", "18181b", "19191c", "1a1a1c", "1a1a1d", "1b1b1e",
  "1c1c1f", "1e1e21", "1f1f22", "1f1f23", "222225", "26262a", "26262b", "2a2a2e", "2e2e32", "2e2e33", "3a3a3f", "4a4a50",
  "4d4d53", "55555b", "5d5d63", "6d6d73", "7a7a80", "8b8b90", "9a9aa0", "b9b9be", "c9c9cd", "cfcfd3", "d6d6d9", "ededee",
  "f4f4f5", "ffffff",
];
export const GRAY_SET = new Set(GRAYS);

const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };

/** Яркость OKLab (0..1) для цвета #rrggbb. */
function lightness(hex: string): number {
  const r = lin(parseInt(hex.slice(0, 2), 16)), g = lin(parseInt(hex.slice(2, 4), 16)), b = lin(parseInt(hex.slice(4, 6), 16));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

const f = (x: number) => Math.max(0, Math.min(1, x)).toFixed(4);

/** Серый макета в светлой теме: фоны светлеют, текст темнеет. */
function lightGray(hex: string): string {
  const L = lightness(hex);
  const l2 = L < 0.3 ? 0.985 - (L - 0.13) * 0.85 : 1.06 - L;
  return `oklch(${f(Math.min(0.985, Math.max(0.06, l2)))} 0.004 260)`;
}

/** Значения переменных темы. */
export function themeVars(mode: ThemeMode): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const hex of GRAYS) vars[`--g-${hex}`] = mode === "light" ? lightGray(hex) : "#" + hex;
  vars["--acc-h"] = "155";
  vars["--dl"] = mode === "light" ? "-0.3" : "0";
  return vars;
}

const KEY = "hranilka.theme";

/** Старые сохранённые темы (системная, своя основа и акцент) сводим к тёмной или светлой. */
export function normalizeTheme(raw: unknown): ThemeCfg {
  const t = (raw || {}) as { mode?: string; base?: string };
  return { mode: t.mode === "light" || (t.mode === "custom" && t.base === "light") ? "light" : "dark" };
}

export function applyTheme(cfg: ThemeCfg) {
  const mode = normalizeTheme(cfg).mode;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(themeVars(mode))) root.style.setProperty(k, v);
  root.dataset.base = mode;
  root.style.colorScheme = mode;
  try { localStorage.setItem(KEY, JSON.stringify({ mode })); } catch { /* хранилище недоступно — не страшно */ }
}

export function savedTheme(): ThemeCfg | null {
  try { const v = localStorage.getItem(KEY); return v ? normalizeTheme(JSON.parse(v)) : null; } catch { return null; }
}
