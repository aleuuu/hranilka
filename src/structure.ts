/* Своя структура папок («По моей структуре»): дерево, разбор списка, подписи для редактора. */
import type { EngineNode, SAuto, SNode, SType } from "./lib/types";
import { plural } from "./lib/format";
import { C } from "./ui";

export const STYPES: [SType, string][] = [
  ["photo", "Фото с камеры"], ["shot", "Скриншоты"], ["img", "Картинки"], ["video", "Видео"], ["audio", "Музыка"],
  ["doc", "Документы"], ["html", "Html"], ["inst", "Установщики"], ["arch", "Архивы"],
];
const SLC: Record<SType, string> = {
  photo: "фото с камеры", shot: "скриншоты", img: "картинки", video: "видео", audio: "музыка", doc: "документы", html: "html", inst: "установщики", arch: "архивы",
};
export const SAUTO: [SAuto, string][] = [["none", "Нет"], ["years", "По годам"], ["months", "По годам и месяцам"], ["projects", "По проектам"]];
const SAUTOLC: Record<string, string> = { years: "по годам", months: "по годам и месяцам", projects: "по проектам" };
const KEEPT: SType[] = ["inst", "arch", "audio", "video"];
export const MANUAL = "Разобрать вручную";

let seq = 0;
const nid = () => "s" + Date.now().toString(36) + "-" + ++seq;

export function nd(name: string, o: Partial<SNode> = {}, kids: SNode[] = []): SNode {
  return { id: nid(), name, types: o.types || [], note: o.note || "", examples: o.examples || [], fromFolder: o.fromFolder || 0, names: o.names || "smart", auto: o.auto || "none", kids };
}

/** Структура, с которой начинается новая папка. */
export const defaultTree = (): SNode[] => [
  nd("Установщики", { types: ["inst"], names: "keep" }),
  nd("Архивы", { types: ["arch"], names: "keep" }),
  nd("Видео", { types: ["video"], names: "keep", auto: "months" }),
  nd("Проекты", { types: ["html"], auto: "projects" }),
  nd("Картинки", { types: ["img", "shot"] }, [nd("Мемы", { types: ["img"], note: "смешные картинки с подписями" }), nd("Разное", { types: ["img"] })]),
  nd("Музыка", { types: ["audio"], names: "keep" }),
  nd("Документы", { types: ["doc"] }),
];

export const DEFAULT_PASTE = "Установщики\nАрхивы\nВидео — по годам и месяцам\nПроекты — по проектам\nКартинки\n    Мемы: смешные картинки с подписями\n    Разное\nМузыка\nДокументы";

export function guessT(name: string): SType[] {
  const s = name.toLowerCase(), r: SType[] = [];
  if (/установ|инсталл|setup/.test(s)) r.push("inst");
  if (/архив/.test(s)) r.push("arch");
  if (/видео|ролик|запис/.test(s)) r.push("video");
  if (/музык|аудио|трек|песн/.test(s)) r.push("audio");
  if (/html|сайт|прототип|веб|проект/.test(s)) r.push("html");
  if (/скрин/.test(s)) r.push("shot");
  if (/картин|изображ|мем|арт|обои/.test(s)) r.push("img");
  if (/фото/.test(s)) r.push("photo");
  if (/документ|доки|pdf|учёб|учеб|договор|чек/.test(s)) r.push("doc");
  return r;
}

const autoFrom = (s: string): SAuto => (/месяц/i.test(s) ? "months" : /год/i.test(s) ? "years" : /проект/i.test(s) ? "projects" : "none");
const mergeAuto = (a: SAuto, b: SAuto): SAuto => (b === "none" ? a : (a === "years" && b === "months") || (a === "months" && b === "years") ? "months" : b);
const cleanName = (s: string) => s.replace(/[\\:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();

/** «Вставить списком»: папка на строку, вложенность — отступом или «/», после тире — «по годам…», после двоеточия — пояснение. */
export function parseList(text: string): SNode[] {
  const out: SNode[] = [];
  const stack: { indent: number; kids: SNode[]; node: SNode | null }[] = [{ indent: -1, kids: out, node: null }];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const indent = (raw.match(/^[ \t]*/) || [""])[0].replace(/\t/g, "    ").length;
    let line = raw.trim().replace(/^(\d+[.)]\s*|[-•*–—]\s+)/, "");
    let note = "", auto: SAuto = "none";
    const ci = line.indexOf(":");
    if (ci > 0) { note = line.slice(ci + 1).trim(); line = line.slice(0, ci).trim(); }
    const dm = line.match(/\s[—–-]\s*(по\s.*)$/i);
    if (dm && dm.index !== undefined) { auto = autoFrom(dm[1]); line = line.slice(0, dm.index).trim(); }
    const names: string[] = [];
    for (const part of line.split(/\s*\/\s*/).map((x) => x.trim()).filter(Boolean)) {
      if (/^по\s/i.test(part)) { auto = mergeAuto(auto, autoFrom(part)); continue; }
      if (/^\d{4}$/.test(part)) { auto = mergeAuto(auto, "years"); continue; }
      names.push(cleanName(part));
    }
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1];
    if (!names.filter(Boolean).length) { if (parent.node) parent.node.auto = mergeAuto(parent.node.auto, auto); continue; }
    let last: SNode | null = null;
    for (const nm of names.filter(Boolean)) {
      const kids: SNode[] = last ? last.kids : parent.kids;
      let hit = kids.find((k) => k.name.toLowerCase() === nm.toLowerCase());
      if (!hit) {
        const up: SNode | null = last || parent.node;
        const g = guessT(nm);
        const types = g.length ? g : up ? up.types.slice() : [];
        hit = nd(nm, { types, names: types.length && types.every((x) => KEEPT.includes(x)) ? "keep" : "smart" });
        kids.push(hit);
      }
      last = hit;
    }
    if (!last) continue;
    if (note) last.note = note;
    if (auto !== "none") last.auto = auto;
    stack.push({ indent, kids: last.kids, node: last });
  }
  return out;
}

export function nodeFromName(name: string, fromFolder: number): SNode {
  const g = guessT(name);
  return nd(name, { types: g, fromFolder, names: g.length && g.every((q) => KEEPT.includes(q)) ? "keep" : "smart" });
}

export function walkTree(list: SNode[], fn: (n: SNode, depth: number, parents: SNode[]) => void, depth = 0, parents: SNode[] = []) {
  for (const n of list) { fn(n, depth, parents); walkTree(n.kids, fn, depth + 1, [...parents, n]); }
}
export function findIn(list: SNode[], id: string): { n: SNode; list: SNode[]; i: number } | null {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return { n: list[i], list, i };
    const r = findIn(list[i].kids, id);
    if (r) return r;
  }
  return null;
}
export const cloneTree = (t: SNode[]): SNode[] => JSON.parse(JSON.stringify(t));

export function stColor(n: SNode): string {
  const t = n.types;
  if (t.includes("html")) return C.v;
  if (t.some((x) => x === "video" || x === "audio")) return C.b;
  if (t.some((x) => x === "img" || x === "shot" || x === "photo")) return C.p;
  if (t.includes("doc")) return C.t;
  if (t.some((x) => x === "inst" || x === "arch")) return "#8b8b90";
  return "#6d6d73";
}

export function stSum(n: SNode): string {
  const p: string[] = [];
  if (n.types.length) p.push(n.types.map((x) => SLC[x]).join(", "));
  if (n.note) p.push("«" + n.note + "»");
  const ex = n.examples.length + n.fromFolder;
  if (ex) p.push(ex + " " + plural(ex, ["пример", "примера", "примеров"]));
  if (n.names === "keep") p.push("имена как есть");
  if (n.auto !== "none") p.push(SAUTOLC[n.auto]);
  return p.join(" · ");
}

export function stGhost(n: SNode, projects: string[]): string {
  const y = new Date().getFullYear();
  const mon = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"][new Date().getMonth()];
  if (n.auto === "years") return `${y - 1}, ${y}`;
  if (n.auto === "months") return `${y} / ${mon}, ${y - 1} / Декабрь`;
  if (n.auto === "projects") return projects.length ? projects.slice(0, 3).join(", ") : "по названиям проектов в файлах";
  return "";
}

export function stNameEx(n: SNode): string {
  const m: Record<string, [string, string]> = {
    inst: ["SteamSetup.exe", "Установщик Steam.exe"], arch: ["archive_2026.zip", "archive 2026.zip"], video: ["VID_20260412_181003.mp4", "Видео 12.04.2026.mp4"],
    audio: ["track_01.mp3", "Исполнитель — Песня.mp3"], doc: ["document(3).pdf", "Договор аренды — сен 2026.pdf"], html: ["index (2).html", "Ремонт — смета.html"],
    img: ["image (7).png", "Мем про дедлайн.png"], shot: ["Screenshot_0812.png", "Оплата спортзала — авг 2026.png"], photo: ["DSC04412.JPG", "2026-07-19 День рождения 01.jpg"],
  };
  const e = m[n.types[0]] || ["IMG_0838.PNG", "Скриншот оплаты — авг 2026.png"];
  return e[0] + " → " + (n.names === "keep" ? e[0] : e[1]);
}

export function autoNote(n: SNode, projects: string[]): string {
  if (n.auto === "projects") return projects.length
    ? `Названия — из «Правил»: ${projects.slice(0, 4).join(", ")}. Новый проект модель предложит сама.`
    : "Названия возьмём из имён и содержимого файлов. Свои проекты можно задать в «Правилах».";
  if (n.auto === "months") return "Папки месяцев потом можно переименовать в события прямо в плане.";
  if (n.auto === "years") return "Год — по дате съёмки или создания файла.";
  return "";
}

/** В движок — без служебных полей редактора. */
export function toEngine(tree: SNode[]): EngineNode[] {
  return tree.filter((n) => n.name.trim()).map((n) => ({ name: n.name.trim(), types: n.types, note: n.note.trim(), examples: n.examples, names: n.names, auto: n.auto, kids: toEngine(n.kids) }));
}

export const folderKey = (p: string) => p.replace(/[\\/]+$/, "").toLowerCase();
export const fileName = (p: string) => p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || p;
