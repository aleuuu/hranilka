import React, { CSSProperties, useEffect, useRef, useState } from "react";
import { GRAY_SET } from "./theme";

/** Строку стилей из макета ("height:44px;padding:0 26px") превращает в объект React-стилей.
 *  Так разметку можно переносить из макета дословно, без ручной конвертации. */
const cache = new Map<string, CSSProperties>();
const camel = (p: string) => p.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** Цвета макета → переменные темы: серые → --g-xxxxxx, зелёный акцент (оттенок 155) → --acc-h,
 *  яркость цветных оттенков сдвигается на --dl (в светлой теме цвета темнеют, чтобы читаться на белом). */
export function themed(s: string): string {
  return s
    .replace(/#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?\b|#fff\b/g, (m, h: string | undefined, a: string | undefined) => {
      const hex = (h || "ffffff").toLowerCase();
      if (!GRAY_SET.has(hex)) return m;
      // #0e0e0fcc — серый с прозрачностью
      return a ? `color-mix(in srgb, var(--g-${hex}, #${hex}) ${Math.round(parseInt(a, 16) / 2.55)}%, transparent)` : `var(--g-${hex}, #${hex})`;
    })
    .replace(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)( \/ [\d.]+)?\)/g, (_m, l: string, c: string, h: string, a?: string) =>
      `oklch(calc(${l} + var(--dl, 0)) ${c} ${h === "155" ? "var(--acc-h, 155)" : h}${a || ""})`);
}

export function css(s: string): CSSProperties {
  const hit = cache.get(s);
  if (hit) return hit;
  const src = s;
  s = themed(s);
  const out: Record<string, string> = {};
  let depth = 0, quote: string | null = null, cur = "";
  const push = (decl: string) => {
    const i = decl.indexOf(":");
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    if (k) out[camel(k)] = decl.slice(i + 1).trim();
  };
  for (const ch of s) {
    if (quote) { if (ch === quote) quote = null; }
    else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === ";" && depth === 0) { push(cur); cur = ""; continue; }
    cur += ch;
  }
  push(cur);
  if (cache.size > 4000) cache.clear();
  cache.set(src, out as CSSProperties);
  return out as CSSProperties;
}

type BProps = {
  as?: keyof React.JSX.IntrinsicElements;
  s: string;           // базовый стиль
  h?: string;          // style-hover из макета
  f?: string;          // style-focus из макета
  [key: string]: any;
};

/** Элемент со стилем-строкой и hover/focus-состояниями, как атрибуты style-hover / style-focus в макете. */
export function B({ as = "div", s, h, f, style, onMouseEnter, onMouseLeave, onFocus, onBlur, ...rest }: BProps) {
  const [hov, setHov] = useState(false);
  const [foc, setFoc] = useState(false);
  const st: CSSProperties = { ...css(s), ...(hov && h ? css(h) : null), ...(foc && f ? css(f) : null), ...style };
  return React.createElement(as, {
    ...rest,
    style: st,
    onMouseEnter: (e: any) => { if (h) setHov(true); onMouseEnter?.(e); },
    onMouseLeave: (e: any) => { if (h) setHov(false); onMouseLeave?.(e); },
    onFocus: (e: any) => { if (f) setFoc(true); onFocus?.(e); },
    onBlur: (e: any) => { if (f) setFoc(false); onBlur?.(e); },
  });
}

/** Иконка Material Symbols Rounded: <Ic n="arrow_back" s="font-size:18px" /> */
export function Ic({ n, s = "", title }: { n: string; s?: string; title?: string }) {
  return <span data-ms="" title={title} style={css("font-family:'Material Symbols Rounded';line-height:1;" + s)}>{n}</span>;
}

/** Миллисекундный тикер для анимаций экрана — аналог state.t из макета, но локальный для экрана.
 *  Отсчёт идёт с момента, когда active стал true; смена resetKey начинает отсчёт заново. */
export function useTicker(active = true, step = 60, resetKey?: unknown): number {
  const [t, setT] = useState(0);
  const start = useRef(performance.now());
  useEffect(() => {
    if (!active) { setT(0); return; }
    start.current = performance.now();
    setT(0);
    const iv = setInterval(() => setT(performance.now() - start.current), step);
    return () => clearInterval(iv);
  }, [active, step, resetKey]);
  return t;
}

/** Перерисовывает компонент каждые step мс, пока performance.now() < until. */
export function useRerenderUntil(until: number, step = 30) {
  const [, force] = useState(0);
  useEffect(() => {
    if (performance.now() >= until) return;
    const iv = setInterval(() => {
      force((x) => x + 1);
      if (performance.now() >= until) clearInterval(iv);
    }, step);
    return () => clearInterval(iv);
  }, [until, step]);
}

/** Цвета из макета. */
export const C = {
  v: "oklch(0.74 0.15 300)", p: "oklch(0.74 0.15 350)", b: "oklch(0.74 0.15 255)",
  t: "oklch(0.78 0.12 185)", y: "oklch(0.84 0.13 85)", g: "oklch(0.8 0.16 155)",
};

const TOPC: Record<string, string> = {
  "Проекты": C.v, "Фото": C.p, "Видео": C.b, "Документы": C.t, "Разобрать вручную": C.y, "Целиком": "#8b8b90",
  "Скриншоты": C.v, "Музыка": C.b, "Аудио": C.b, "Программы и проекты": "#8b8b90", "Установщики": "#8b8b90",
  "Архивы": "#8b8b90", "Временные файлы": "#8b8b90", "Картинки": C.p, "Изображения": C.p, "Учёба": C.t,
  "Projects": C.v, "Photos": C.p, "Videos": C.b, "Documents": C.t, "Sort manually": C.y, "Screenshots": C.v, "Music": C.b,
};
const FALLBACK = [C.p, C.t, C.b, C.v];

/** Цвет папки по её верхнему разделу. */
export function topColor(path: string): string {
  const top = path.split("/")[0];
  if (TOPC[top]) return TOPC[top];
  let h = 0;
  for (const ch of top) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}
