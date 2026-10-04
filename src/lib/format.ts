/** Склонение: plural(5, ['файл', 'файла', 'файлов']) → 'файлов'. */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(Math.round(n)) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export const nf = (n: number) => Math.round(n).toLocaleString("ru-RU");

/** Длительность в духе макета: «≈ 40 мин», «1 час», «1.5 часа», «3 часа». */
export function fmtDur(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return "меньше минуты";
  const min = sec / 60;
  if (min < 1) return "меньше минуты";
  if (min < 55) return `${Math.max(1, Math.round(min))} мин`;
  const h = Math.round((sec / 3600) * 2) / 2;
  if (h === 1) return "1 час";
  const word = Number.isInteger(h) ? plural(h, ["час", "часа", "часов"]) : "часа";
  return `${String(h).replace(".", ".")} ${word}`;
}

/** Короткая длительность для «Осталось»: «≈ 34 мин», «≈ 1 ч 20 мин». */
export function fmtEta(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "—";
  const m = Math.max(1, Math.round(sec / 60));
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} ч ${r} мин` : `${h} ч`;
}

/** Сегодняшняя дата по местному времени в виде '2026-10-05' (toISOString дал бы дату по UTC). */
export function localIso(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const MON = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MON_FULL = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

/** '2026-09-12' → '12 сен' */
export function fmtShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(+d)) return "";
  return `${d.getDate()} ${MON[d.getMonth()]}`;
}

/** '2026-11-03' → '3 ноября' */
export function fmtDayMonth(iso: string): string {
  const d = new Date(iso);
  if (isNaN(+d)) return "";
  return `${d.getDate()} ${MON_FULL[d.getMonth()]}`;
}

export function fmtGb(bytes: number, digits = 1): string {
  return (bytes / 1024 ** 3).toFixed(digits);
}

export function fmtSpeed(bps: number): string {
  if (!bps) return "—";
  return `${(bps / 1024 ** 2).toFixed(1)} МБ/с`;
}

/** Секунды на файл: «5 с/файл», «2.1 с/файл». */
export function fmtSec(s: number): string {
  if (!isFinite(s) || s <= 0) return "—";
  return `${s < 10 ? s.toFixed(1).replace(/\.0$/, "") : Math.round(s)} с/файл`;
}

/** Путь в виде, как его показывает макет: «Загрузки\Telegram Desktop\file.png». */
export const winJoin = (...parts: string[]) => parts.filter(Boolean).join("\\").replace(/\//g, "\\");
