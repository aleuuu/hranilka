/* Демо-бэкенд для просмотра интерфейса в обычном браузере (без Tauri).
   Данные взяты из макета, чтобы экраны можно было сверять с оригиналом. */
import type { Api, Channel } from "./api";
import type { FileItem, PlanData, ScanSummary } from "./types";
import { C } from "../ui";

const listeners: Record<string, Set<(p: any) => void>> = {};
const emit = (ch: Channel, p: any) => listeners[ch]?.forEach((cb) => cb(p));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const RAW: any[] = [
  { id: 1, old: "IMG_0838.PNG", fromRel: "", name: "Klutz — экран оплаты.png", to: "Проекты/Klutz", type: "скриншот", icon: "screenshot_monitor", reason: "Скриншот приложения Klutz: в шапке логотип, на экране — оплата подписки.", date: "14 авг 2026", dsrc: "имя файла", conf: 96 },
  { id: 2, old: "Screenshot_20260812_2214.png", fromRel: "", name: "SimPie — онбординг, шаг 2.png", to: "Проекты/SimPie", type: "скриншот", icon: "screenshot_monitor", reason: "Макет приложения SimPie — узнаётся по названию в углу и фирменному цвету.", date: "12 авг 2026", dsrc: "имя файла", conf: 91 },
  { id: 3, old: "simpie-v6-preview (9).png", fromRel: "", name: "SimPie — превью v6.png", to: "Проекты/SimPie", type: "картинка", icon: "image", reason: "Последняя из 9 версий одного файла. Остальные 8 предлагаю убрать в «Старые версии».", date: "2 сен 2026", dsrc: "дата изменения", conf: 88, check: "9 версий одного файла — оставили последнюю сверху" },
  { id: 4, old: "DSC04412.JPG", fromRel: "", name: "2026-07-19 Вечеринка у Ани 01.jpg", to: "Фото/2026 — Вечеринка у Ани", type: "фото", icon: "photo_camera", reason: "Одна из 18 фото одного вечера: те же люди, место и время съёмки.", date: "19 июл 2026", dsrc: "EXIF", conf: 94 },
  { id: 5, old: "DSC04413.JPG", fromRel: "", name: "2026-07-19 Вечеринка у Ани 02.jpg", to: "Фото/2026 — Вечеринка у Ани", type: "фото", icon: "photo_camera", reason: "Снято через 40 секунд после предыдущего кадра, та же компания.", date: "19 июл 2026", dsrc: "EXIF", conf: 93 },
  { id: 6, old: "photo_2026-07-19_23-41.jpg", fromRel: "Telegram Desktop", name: "2026-07-19 Вечеринка у Ани 03.jpg", to: "Фото/2026 — Вечеринка у Ани", type: "фото", icon: "photo_camera", reason: "Прислали в Telegram той же ночью, на фото те же люди.", date: "19 июл 2026", dsrc: "имя файла", conf: 82 },
  { id: 7, old: "DSC00051.JPG", fromRel: "", name: "Озеро, закат.jpg", to: "Фото/Без даты", type: "фото", icon: "photo_camera", reason: "Пейзаж: озеро на закате. Год съёмки определить не удалось.", date: "01.01.2010?", dsrc: "EXIF, ненадёжно", conf: 58, check: "Дата ненадёжна: часы камеры были сброшены" },
  { id: 8, old: "VID_20250611_184502.mp4", fromRel: "", name: "2025-06-11 Сочи, набережная.mp4", to: "Видео/2025 — Сочи", type: "видео", icon: "movie", reason: "Видео 2.4 ГБ — разобрано по имени и дате, без анализа содержимого.", date: "11 июн 2025", dsrc: "имя файла", conf: 74 },
  { id: 9, old: "document(3).pdf", fromRel: "", name: "Договор аренды — сен 2026.pdf", to: "Документы/Финансы", type: "документ", icon: "description", reason: "Договор аренды квартиры, подписан 1 сентября.", date: "1 сен 2026", dsrc: "текст документа", conf: 97 },
  { id: 10, old: "Termoland_check.jpg", fromRel: "Telegram Desktop", name: "Оплата Термоленд — авг 2026.jpg", to: "Документы/Финансы", type: "скриншот", icon: "receipt_long", reason: "Скриншот оплаты в приложении банка, получатель — Термоленд.", date: "23 авг 2026", dsrc: "текст на картинке", conf: 92 },
  { id: 11, old: "lecture_notes_final_v2.docx", fromRel: "", name: "Матанализ — лекция 3.docx", to: "Документы/Учёба", type: "документ", icon: "description", reason: "Конспект лекции по матанализу, в тексте — «неделя 3».", date: "18 сен 2026", dsrc: "дата изменения", conf: 89 },
  { id: 12, old: "4_2_ÐÑÐ±Ð¾Ñ_ÑÐµÐ¼Ñ.pdf", fromRel: "Telegram Desktop", name: "Выбор темы курсовой.pdf", to: "Документы/Учёба", type: "документ", icon: "description", reason: "Испорченное имя из Telegram — восстановили по тексту документа.", date: "4 сен 2026", dsrc: "текст документа", conf: 86 },
  { id: 13, old: "scan0001.jpg", fromRel: "", name: "Паспорт — разворот.jpg", to: "Документы/Личные документы", type: "скан", icon: "badge", reason: "Скан паспорта. Личные данные — в отдельную папку, превью размыто.", date: "3 мар 2026", dsrc: "дата изменения", conf: 95, priv: true },
  { id: 14, old: "unnamed (4).png", fromRel: "Telegram Desktop", name: "unnamed (4).png", to: "Разобрать вручную", type: "картинка", icon: "image", reason: "Абстрактная картинка без текста — не нашёл, к чему её отнести.", date: "—", dsrc: "нет данных", conf: 31, check: "Модель не уверена, куда положить" },
];

const ROOT = "C:\\Users\\Митя\\Загрузки";
const files: FileItem[] = RAW.map((f) => {
  const abs = ROOT + "\\" + (f.fromRel ? f.fromRel + "\\" : "") + f.old;
  return {
    check: null, priv: false, thumb: null, kind: f.type === "видео" ? "video" : f.type === "документ" ? "doc" : "image",
    cluster: "c" + f.id, size: 1000, rejected: false, ...f, abs, cur: abs, orig: f.name, engineTo: f.to,
  } as FileItem;
});

const plan: PlanData = {
  root: ROOT, rootDisplay: "Загрузки", dest: ROOT, destDisplay: "Загрузки", files,
  locked: [
    { id: "L1", name: "exam_project", why: "код · PHP", rel: "exam_project", abs: ROOT + "\\exam_project", n: 29, cur: ROOT + "\\exam_project" },
    { id: "L2", name: "farmer quests", why: "программа", rel: "farmer quests", abs: ROOT + "\\farmer quests", n: 9, cur: ROOT + "\\farmer quests" },
    { id: "L3", name: "loyalty-screens", why: "ваша папка", rel: "loyalty-screens", abs: ROOT + "\\loyalty-screens", n: 16, cur: ROOT + "\\loyalty-screens" },
  ],
  skipped: 132, projects: ["SimPie", "Termoland", "Klutz"], rootFiles: 203,
  rootKinds: Array.from({ length: 84 }, (_, i) => ["image", "image", "doc", "shot", "image", "video", "doc", "image", "shot", "manual"][(i * 7 + i * i) % 10]),
  mapping: {}, naming: { rename: true, datePrefix: true, lang: "ru", maxWords: 0 }, partial: false,
};

const CUR = [
  { thumbLabel: "скриншот приложения", old: "IMG_0841.PNG", kind: "Скриншот", desc: "Экран корзины в приложении Klutz, тёмная тема, три товара.", topic: "Проект Klutz", name: "Klutz — корзина.png" },
  { thumbLabel: "фото, вечер", old: "DSC04431.JPG", kind: "Фото", desc: "Пять человек за столом, гирлянды, вечер. Похоже на ту же вечеринку.", topic: "Вечеринка у Ани", name: "2026-07-19 Вечеринка у Ани 14.jpg" },
  { thumbLabel: "pdf, 3 стр.", old: "document(7).pdf", kind: "Документ", desc: "Счёт за интернет на сентябрь, провайдер «Ростелеком».", topic: "Финансы", name: "Счёт за интернет — сен 2026.pdf" },
  { thumbLabel: "скриншот макета", old: "Screenshot_20260901_1130.png", kind: "Скриншот", desc: "Макет экрана тарифов SimPie, eSIM для поездок.", topic: "Проект SimPie", name: "SimPie — тарифы eSIM.png" },
  { thumbLabel: "фото документа", old: "IMG_20260215_0912.jpg", kind: "Скан", desc: "Фото студенческого билета. Есть личные данные.", topic: "Личные документы", name: "Студенческий билет.jpg" },
];
const POOL = [
  { icon: "screenshot_monitor", c: C.v, old: "IMG_0839.PNG", name: "Klutz — профиль.png" },
  { icon: "photo_camera", c: C.p, old: "DSC04428.JPG", name: "2026-07-19 Вечеринка у Ани 11.jpg" },
  { icon: "description", c: C.t, old: "document(5).pdf", name: "Акт сверки — авг 2026.pdf" },
  { icon: "screenshot_monitor", c: C.v, old: "Screenshot_20260830_1802.png", name: "SimPie — настройки.png" },
  { icon: "movie", c: C.b, old: "VID_20250612_101233.mp4", name: "2025-06-12 Сочи, пляж.mp4" },
  { icon: "receipt_long", c: C.t, old: "photo_2026-08-24_12-11.jpg", name: "Оплата Термоленд — чек 2.jpg" },
  { icon: "description", c: C.t, old: "Новый документ (2).docx", name: "Курсовая — план.docx" },
  { icon: "photo_camera", c: C.p, old: "DSC04429.JPG", name: "2026-07-19 Вечеринка у Ани 12.jpg" },
  { icon: "badge", c: C.t, old: "scan0004.jpg", name: "СНИЛС.jpg" },
  { icon: "screenshot_monitor", c: C.v, old: "IMG_0840.PNG", name: "Klutz — каталог.png" },
];
const THEMES = [{ l: "Klutz", at: 0, max: 34, c: C.v, u: "" }, { l: "SimPie", at: 0, max: 51, c: C.v, u: "" }, { l: "Вечеринка у Ани", at: 0, max: 18, c: C.p, u: " фото" }, { l: "Термоленд", at: 318, max: 12, c: C.t, u: "" }, { l: "Учёба", at: 330, max: 27, c: C.t, u: "" }, { l: "Сочи 2025", at: 345, max: 40, c: C.b, u: "" }, { l: "Личные документы", at: 360, max: 6, c: C.t, u: "" }];

let pullTimer: any = null, pulled = 0.38;
let anTimer: any = null, done = 312, paused = false, feedI = 0;
let applyStop = false;

export function mockApi(): Api {
  return {
    boot: async () => ({
      onboarded: new URLSearchParams(location.search).has("app"), model: "accurate", secPerFile: null, modelsDir: "C:\\Users\\Митя\\.ollama\\models",
      recentWishes: [{ text: "Фото по годам и событиям, документы по типу", date: "2026-09-12" }, { text: "Скриншоты по проектам, остальное по типу", date: "2026-08-03" }],
      history: [
        { id: "h1", name: "Рабочий стол", root: "", dest: "", date: "2026-09-12", until: "2026-10-12", files: 214, undone: false },
        { id: "h2", name: "Telegram Desktop", root: "", dest: "", date: "2026-08-03", until: "2026-09-02", files: 388, undone: false },
      ],
      ollama: { installed: true, running: true, models: new URLSearchParams(location.search).has("app") ? ["gemma3:12b", "bge-m3:latest"] : [] },
    }),
    saveSettings: async () => {},
    systemCheck: async () => { await sleep(300); return { gpuName: "NVIDIA RTX 4070", gpuVramGb: 12, gpuKind: "dedicated", ramGb: 32, diskLabel: "C:", diskFreeGb: 214, modelsDir: "C:\\Users\\Митя\\.ollama\\models" }; },
    ollamaStatus: async () => ({ installed: true, running: true, models: [] }),
    pullStart: async () => {
      clearInterval(pullTimer);
      pullTimer = setInterval(() => {
        pulled = Math.min(1, pulled + 0.004);
        const total = 9.5 * 1024 ** 3;
        emit("pull", { phase: "model", completed: pulled * total, total, speed: 18.4 * 1024 ** 2, done: pulled >= 1, slow: false, error: null });
        if (pulled >= 1) clearInterval(pullTimer);
      }, 150);
    },
    pullPause: async () => { clearInterval(pullTimer); },
    describeImage: async () => { await sleep(1800); return { desc: "Скриншот оплаты в приложении банка. Получатель — Термоленд, сумма 4 800 ₽, 23 августа 2026.", name: "Оплата Термоленд — авг 2026.jpg", seconds: 2.1 }; },
    pickFolder: async () => "C:\\Users\\Митя\\Загрузки",
    pickImage: async () => null,
    quickFolders: async () => [
      { name: "Загрузки", icon: "download", path: "C:\\Users\\Митя\\Загрузки", count: 863 },
      { name: "Рабочий стол", icon: "desktop_windows", path: "C:\\Users\\Митя\\Рабочий стол", count: 214 },
      { name: "Изображения", icon: "image", path: "C:\\Users\\Митя\\Изображения", count: 1942 },
      { name: "Telegram Desktop", icon: "send", path: "C:\\Users\\Митя\\Загрузки\\Telegram Desktop", count: 388 },
    ],
    scan: async (root) => {
      await sleep(250);
      const s: ScanSummary = {
        root, rootDisplay: root.split("\\").pop() || root, total: 728, images: 519, docs: 179, media: 30, lockedCount: 6, skippedFiles: 132,
        skipped: [
          { key: "code", icon: "code", label: "Проекты с кодом", ex: "exam_project, site-old, bot-tg, lab3", count: 4 },
          { key: "programs", icon: "apps", label: "Программы", ex: "farmer quests", count: 1 },
          { key: "installers", icon: "install_desktop", label: "Установщики", ex: "18 файлов: .exe, .msi", count: 18 },
          { key: "archives", icon: "folder_zip", label: "Архивы", ex: "9 файлов .zip, .rar", count: 9 },
          { key: "temp", icon: "hourglass_empty", label: "Временные файлы", ex: "105 файлов: .tmp, .crdownload", count: 105 },
        ],
      };
      return s;
    },
    analyze: async () => {
      done = 312; paused = false; feedI = 0;
      clearInterval(anTimer);
      emit("engine", { event: "stage", stage: 1 });
      emit("engine", { event: "progress", done, total: 728, errors: 3, secPerFile: 5 });
      let ci = 0;
      anTimer = setInterval(() => {
        if (paused) return;
        const c = CUR[ci++ % CUR.length];
        emit("engine", { event: "file_done", file: { id: 1000 + ci, thumb: null, ...c } });
        for (let k = 0; k < 3; k++) {
          const p = POOL[feedI++ % POOL.length];
          emit("engine", { event: "feed", item: { id: 5000 + feedI, ...p } });
        }
        done = Math.min(728, done + 3);
        emit("engine", { event: "progress", done, total: 728, errors: 3, secPerFile: 5 });
        emit("engine", { event: "themes", themes: THEMES.filter((x) => done >= x.at).map((x) => ({ label: x.l, c: x.c, n: Math.max(1, Math.min(x.max, Math.round(x.max * Math.min(1, ((done - x.at + 40) / (728 - x.at)) * 1.9)))) + x.u })) });
      }, 4600);
    },
    analysisPause: async (on) => { paused = on; },
    analysisStop: async () => {
      clearInterval(anTimer);
      emit("engine", { event: "stage", stage: 2 });
      await sleep(700);
      emit("engine", { event: "stage", stage: 3 });
      await sleep(700);
      emit("engine", { event: "plan", plan: JSON.parse(JSON.stringify(plan)) });
    },
    tune: async (req) => {
      await sleep(1700);
      const q = req.text.toLowerCase();
      if (q.includes("проект") && !req.history.some((m) => m.opts)) return { reply: "", question: "Какие папки считать проектами?", options: ["SimPie", "Termoland", "Klutz", "Все три"], files: null, mapping: null, naming: null };
      let text = "Понял, поправил план.";
      if (q.includes("корот")) text = "Сократил длинные имена. Например: «2026-07-19 Вечеринка у Ани 01» → «Вечеринка у Ани 01».";
      else if (q.includes("год")) text = "Убрал уровень с годами: фото лежат сразу по событиям.";
      else if (q.includes("дат")) text = "Фото без даты сложил в одну папку «Без даты».";
      else if (["simpie", "termoland", "klutz", "все три"].includes(q)) text = "Сложил скриншоты в папки проектов. Остальное не трогал.";
      const nf = files.map((f) => (q.includes("корот") ? { ...f, name: f.name.replace(/^\d{4}-\d{2}-\d{2} /, "") } : f.type === "скриншот" && f.to.startsWith("Документы") ? { ...f, to: "Проекты/Termoland" } : f));
      return { reply: text, question: "", options: [], files: nf, mapping: {}, naming: null };
    },
    apply: async (req) => {
      applyStop = false;
      const total = req.ops.length;
      let n = 0;
      for (const op of req.ops) {
        if (applyStop) break;
        await sleep(60);
        n++;
        emit("apply", { n, total, line: "→ " + op.dstDir.replace(ROOT + "\\", "").replace(/\\/g, "/") + "/" + op.name });
      }
      const until = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
      return { sessionId: "s1", moved: n, total, skipped: [], until, stopped: applyStop, done: req.ops.slice(0, n).map((o) => ({ id: o.id, dst: o.dstDir + "\\" + o.name })) };
    },
    applyStop: async () => { applyStop = true; },
    undo: async () => {
      for (let i = 0; i < 20; i++) { await sleep(50); emit("apply", { n: i + 1, total: 20, line: "← Загрузки\\IMG_0838.PNG" }); }
      return { restored: 11, total: 14, conflicts: [{ icon: "edit", name: "Klutz — экран оплаты.png", why: "переименован вручную" }, { icon: "drive_file_move", name: "Договор аренды — сен 2026.pdf", why: "перемещён в «Документы»" }, { icon: "delete", name: "Озеро, закат.jpg", why: "удалён" }] };
    },
    learn: async () => { await sleep(400); return { count: 1 }; },
    replan: async () => ({ files: JSON.parse(JSON.stringify(files)), projects: plan.projects }),
    learnedInfo: async () => ({ count: 3, folders: [{ folder: "Проекты/Klutz", n: 2 }, { folder: "Документы/Финансы", n: 1 }] }),
    learnedReset: async () => ({ count: 0 }),
    historyAll: async () => [
      { id: "s20260912-141201-001", name: "Рабочий стол", root: "C:\\Users\\Митя\\Рабочий стол", dest: "C:\\Users\\Митя\\Рабочий стол", date: "2026-09-12", time: "14:12", until: "2026-10-12", files: 214, undone: false, status: "active", folders: ["Проекты", "Фото", "Документы"] },
      { id: "s20260803-101500-002", name: "Telegram Desktop", root: "", dest: "", date: "2026-08-03", time: "10:15", until: "2026-09-02", files: 388, undone: false, status: "expired", folders: ["Фото", "Документы"] },
      { id: "s20260801-090000-003", name: "Загрузки", root: "", dest: "", date: "2026-08-01", time: "09:00", until: "2026-08-31", files: 52, undone: true, status: "undone", folders: ["Скриншоты"] },
    ],
    ollamaModels: async () => ({ installed: true, running: true, version: "0.35.1", models: [{ name: "gemma3:12b", size: 8.1e9, modified: "" }, { name: "bge-m3:latest", size: 1.2e9, modified: "" }], modelsDir: "C:\\Users\\Митя\\.ollama\\models", diskFreeGb: 214, diskLabel: "C:" }),
    ollamaDelete: async () => { await sleep(300); },
    ollamaStart: async () => {},
    countNewFiles: async () => ({ count: 12, examples: ["IMG_2201.PNG", "Договор.pdf", "photo_2026-10-04.jpg"], exists: true }),
    appPaths: async () => ({ data: "C:\\Users\\Митя\\AppData\\Roaming\\ru.hranilka.app", log: "C:\\Users\\Митя\\AppData\\Roaming\\ru.hranilka.app\\engine.log" }),
    appVersion: async () => "0.1.0",
    autostart: async (on) => !!on,
    setKeepTray: async () => {},
    openUrl: async (url) => { window.open(url, "_blank"); },
    openPath: async () => {},
    setBusy: async () => {},
    hideToTray: async () => {},
    gpuWatch: async () => {},
    gpuWaitExit: async () => {},
    notify: async () => {},
    win: async () => {},
    on: (ch, cb) => { (listeners[ch] ||= new Set()).add(cb); return () => listeners[ch].delete(cb); },
  };
}
