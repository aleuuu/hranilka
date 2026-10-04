/* Темы оформления.
   Цвета макета зашиты в стили; функция css() подменяет каждый серый из макета на переменную --g-xxxxxx,
   а зелёный акцент (оттенок 155) — на оттенок --acc-h. Здесь мы вычисляем значения этих переменных
   для выбранной основы и акцента, поэтому интерфейс перекрашивается целиком без правки экранов. */

export type ThemeMode = "system" | "light" | "dark" | "custom";
export type Base = "graphite" | "midnight" | "oled" | "light";
export type Accent = "green" | "blue" | "purple" | "orange" | "cyan" | "red";
export interface ThemeCfg { mode: ThemeMode; base: Base; accent: Accent }

export const DEFAULT_THEME: ThemeCfg = { mode: "dark", base: "midnight", accent: "purple" };

export const BASES: [Base, string][] = [["graphite", "Графит"], ["midnight", "Полночь"], ["oled", "OLED"], ["light", "Светлая"]];
export const ACCENTS: [Accent, number, string][] = [
  ["green", 155, "Зелёный"], ["blue", 255, "Синий"], ["purple", 305, "Фиолетовый"],
  ["orange", 55, "Оранжевый"], ["cyan", 215, "Голубой"], ["red", 20, "Красный"],
];

/** Все серые из макета. Их и подменяет css(). */
export const GRAYS = [
  "0b0b0c", "0c0c0d", "0e0e0f", "111113", "121214", "141416", "151517", "17171a", "18181b", "19191c", "1a1a1d", "1b1b1e",
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

function grayFor(base: Base, hex: string): string {
  const L = lightness(hex);
  switch (base) {
    case "graphite":
      return "#" + hex;
    case "midnight": {
      // холодный тёмно-синий: тёмные слои с заметным оттенком, текст почти нейтральный
      const l2 = L < 0.5 ? L * 0.96 + 0.026 : L;
      const c = L < 0.5 ? 0.034 * (1 - L) : 0.012;
      return `oklch(${f(l2)} ${c.toFixed(4)} 268)`;
    }
    case "oled": {
      // самые тёмные слои — в чистый чёрный, остальное плавно
      const l2 = L <= 0.14 ? 0 : L < 0.4 ? (L - 0.14) * 1.538 : L;
      return `oklch(${f(l2)} 0 0)`;
    }
    case "light": {
      // инверсия яркости: фоны светлеют, текст темнеет
      const l2 = L < 0.3 ? 0.985 - (L - 0.13) * 0.85 : 1.06 - L;
      return `oklch(${f(Math.min(0.985, Math.max(0.06, l2)))} 0.004 260)`;
    }
  }
}

export interface Resolved { base: Base; accent: Accent }

export function resolve(cfg: ThemeCfg): Resolved {
  const sysLight = typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: light)").matches;
  switch (cfg.mode) {
    case "system": return { base: sysLight ? "light" : "graphite", accent: "green" };
    case "light": return { base: "light", accent: "green" };
    case "dark": return { base: "graphite", accent: "green" };
    default: return { base: cfg.base, accent: cfg.accent };
  }
}

/** Значения переменных темы — их можно повесить и на маленькое превью. */
export function themeVars(r: Resolved): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const hex of GRAYS) vars[`--g-${hex}`] = grayFor(r.base, hex);
  vars["--acc-h"] = String(ACCENTS.find((a) => a[0] === r.accent)?.[1] ?? 155);
  vars["--dl"] = r.base === "light" ? "-0.3" : "0";
  return vars;
}

const KEY = "hranilka.theme";

export function applyTheme(cfg: ThemeCfg) {
  const r = resolve(cfg);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(themeVars(r))) root.style.setProperty(k, v);
  root.dataset.base = r.base;
  root.style.colorScheme = r.base === "light" ? "light" : "dark";
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* хранилище недоступно — не страшно */ }
}

export function savedTheme(): ThemeCfg | null {
  try { const v = localStorage.getItem(KEY); return v ? { ...DEFAULT_THEME, ...JSON.parse(v) } : null; } catch { return null; }
}

let mq: MediaQueryList | null = null;
/** Для «Системной» темы — перекрашиваемся вслед за Windows. */
export function watchSystem(get: () => ThemeCfg) {
  if (mq || typeof matchMedia === "undefined") return;
  mq = matchMedia("(prefers-color-scheme: light)");
  mq.addEventListener("change", () => { if (get().mode === "system") applyTheme(get()); });
}
