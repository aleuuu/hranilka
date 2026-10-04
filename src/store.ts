import { useSyncExternalStore } from "react";
import { api } from "./lib/api";
import type {
  ApplyOp, ApplyResult, BootState, CurrentFile, FeedItem, FileItem, GpuState, LockedUnit, ModelKey, Naming,
  PlanData, PullProgress, QuickFolder, ScanSummary, Screen, SysInfo, Theme, TuneMsg, UndoResult,
} from "./lib/types";
import { MODELS } from "./lib/types";
import { localIso, plural } from "./lib/format";

export const LOCKED_DIR = "Программы и проекты";

export interface AnState {
  stage: number;          // 0 сканирование, 1 понимание, 2 группировка, 3 план
  done: number;
  total: number;
  errors: number;
  secPerFile: number;
  paused: boolean;
  feed: FeedItem[];
  recent: CurrentFile[];  // готовые описания — показываются в «Сейчас смотрю»
  recentSeq: number;
  looking: { old: string; thumb: string | null; kind: string } | null;
  themes: Theme[];
  error: string | null;
  baseline: number | null; // с/файл при свободной видеокарте
}

export interface AppState {
  screen: Screen;
  boot: BootState | null;
  model: ModelKey | null;
  sys: SysInfo | null;
  sysErr: string | null;
  installed: string[];
  // загрузка модели
  pull: PullProgress | null;
  pullPaused: boolean;
  pullStarted: boolean;
  vpnHelp: boolean;
  // готово
  sample: { dataUrl: string; b64?: string; path?: string; name: string; own: boolean } | null;
  ready: { desc: string; name: string; seconds: number } | null;
  readyBusy: boolean;
  readyErr: string | null;
  secPerFile: number | null;
  // старт
  quick: QuickFolder[];
  folder: string | null;
  folderName: string | null;
  scan: ScanSummary | null;
  scanning: boolean;
  scanDoneAt: number;
  scanErr: string | null;
  unskip: Record<string, boolean>;
  skippedOpen: boolean;
  wishes: string;
  rename: boolean;
  datePrefix: boolean;
  nameLang: "ru" | "en";
  dest: "same" | "other";
  destPath: string | null;
  // анализ
  an: AnState;
  gpu: GpuState | null;
  gpuChoice: null | "wait" | "slow";
  // план
  plan: PlanData | null;
  files: FileItem[];
  hist: FileItem[][];
  versions: { files: FileItem[]; mapping: Record<string, string>; naming: Naming }[];
  verSel: number;
  sel: string | null;
  filter: string;
  view: "tree" | "grid";
  projBanner: boolean;
  privShown: Record<number, boolean>;
  toast: { text: string; at: number } | null;
  dragOver: string | null;
  tuneOpen: boolean;
  msgs: TuneMsg[];
  tuneInput: string;
  tuneBusy: boolean;
  // применение
  modal: null | "confirm" | "applying" | "undoing" | "stop" | "undo";
  prog: { n: number; total: number; lines: string[] };
  sessions: string[];
  applyRes: ApplyResult | null;
  stopN: number;
  undoRes: UndoResult | null;
  undone: boolean;
  lockedDone: Record<string, string>;
}

const emptyAn = (): AnState => ({
  stage: 0, done: 0, total: 0, errors: 0, secPerFile: 0, paused: false, feed: [], recent: [], recentSeq: 0,
  looking: null, themes: [], error: null, baseline: null,
});

let state: AppState = {
  screen: "boot", boot: null, model: null, sys: null, sysErr: null, installed: [],
  pull: null, pullPaused: false, pullStarted: false, vpnHelp: false,
  sample: null, ready: null, readyBusy: false, readyErr: null, secPerFile: null,
  quick: [], folder: null, folderName: null, scan: null, scanning: false, scanDoneAt: 0, scanErr: null, unskip: {}, skippedOpen: false,
  wishes: "", rename: true, datePrefix: true, nameLang: "ru", dest: "same", destPath: null,
  an: emptyAn(), gpu: null, gpuChoice: null,
  plan: null, files: [], hist: [], versions: [], verSel: 1, sel: null, filter: "all", view: "tree", projBanner: true,
  privShown: {}, toast: null, dragOver: null, tuneOpen: false,
  msgs: [{ ai: true, text: "Напишите, что поправить. Пересчитаю только план — это секунды, а не час." }],
  tuneInput: "", tuneBusy: false,
  modal: null, prog: { n: 0, total: 0, lines: [] }, sessions: [], applyRes: null, stopN: 0, undoRes: null, undone: false,
  lockedDone: {},
};

const subs = new Set<() => void>();
export const get = () => state;
export function set(patch: Partial<AppState> | ((s: AppState) => Partial<AppState> | null)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  if (!p) return;
  state = { ...state, ...p };
  subs.forEach((l) => l());
}
export function useApp(): AppState {
  return useSyncExternalStore((l) => { subs.add(l); return () => subs.delete(l); }, () => state);
}

export const go = (screen: Screen, extra?: Partial<AppState>) => set({ screen, modal: null, tuneOpen: false, ...(extra || {}) });

/* ───────────────────────── запуск ───────────────────────── */

export const currentModel = (s: AppState = state): ModelKey => s.model || recommendedModel(s.sys);

export function recommendedModel(sys: SysInfo | null): ModelKey {
  if (!sys) return "accurate";
  return sys.gpuKind === "dedicated" && (sys.gpuVramGb ?? 0) >= 10 ? "accurate" : "fast";
}

export function modelInstalled(key: ModelKey, installed: string[]) {
  const m = MODELS[key];
  const has = (name: string) => installed.some((x) => x === name || x === name + ":latest" || x.split(":")[0] === name && name.indexOf(":") < 0);
  return has(m.llm) && has(m.embed);
}

export async function bootApp() {
  let boot: BootState;
  try { boot = await api.boot(); }
  catch (e) { boot = { onboarded: false, model: null, recentWishes: [], history: [], secPerFile: null, modelsDir: "", ollama: { installed: false, running: false, models: [] } }; console.error(e); }
  const installed = boot.ollama.models || [];
  const model = boot.model;
  set({ boot, model, installed, secPerFile: boot.secPerFile });
  if (boot.onboarded && model && modelInstalled(model, installed)) {
    go("start");
    loadQuick();
  } else if (boot.onboarded) go("check");
  else go("welcome");
}

export async function runSystemCheck() {
  set({ sys: null, sysErr: null });
  try {
    const [sys, st] = await Promise.all([api.systemCheck(), api.ollamaStatus()]);
    set({ sys, installed: st.models || [] });
  } catch (e: any) {
    set({ sysErr: String(e?.message || e) });
  }
}

/* ───────────────────────── загрузка модели ───────────────────────── */

export async function startPull() {
  const model = currentModel();
  if (modelInstalled(model, state.installed)) {
    // Модель уже на компьютере — интернет не нужен, загрузка не требуется
    const total = MODELS[model].sizeGb * 1024 ** 3;
    set({ pullStarted: true, pullPaused: false, model });
    onPull({ phase: "model", completed: total, total, speed: 0, done: true, slow: false, error: null });
    return;
  }
  set({ pullStarted: true, pullPaused: false, model, pull: state.pull ? { ...state.pull, error: null, slow: false } : null });
  try { await api.pullStart(model); } catch (e: any) {
    set({ pull: { phase: "model", completed: state.pull?.completed || 0, total: state.pull?.total || 1, speed: 0, done: false, slow: false, error: { kind: "other", message: String(e?.message || e) } } });
  }
}

export async function togglePullPause() {
  if (state.pullPaused) { await startPull(); return; }
  set({ pullPaused: true });
  await api.pullPause();
}

export function onPull(p: PullProgress) {
  set({ pull: p });
  if (p.done) {
    api.ollamaStatus().then((st) => set({ installed: st.models || [] })).catch(() => {});
    api.saveSettings({ model: currentModel() });
    if (document.hidden) api.notify("Хранилка", "Модель скачана — можно наводить порядок");
  }
}

/* ───────────────────────── готово: проверка на картинке ───────────────────────── */

export async function describeSample(sample: AppState["sample"]) {
  if (!sample) return;
  set({ sample, ready: null, readyBusy: true, readyErr: null });
  try {
    const r = await api.describeImage({ b64: sample.b64, path: sample.path, name: sample.name, model: currentModel() });
    set({ ready: r, readyBusy: false, secPerFile: r.seconds });
    api.saveSettings({ secPerFile: r.seconds });
  } catch (e: any) {
    set({ readyBusy: false, readyErr: String(e?.message || e) });
  }
}

export async function finishOnboarding() {
  await api.saveSettings({ onboarded: true, model: currentModel() });
  go("start");
  loadQuick();
}

/* ───────────────────────── старт ───────────────────────── */

export async function loadQuick() {
  try { set({ quick: await api.quickFolders() }); } catch { /* нет быстрых папок — не страшно */ }
}

const baseName = (p: string) => p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || p;

export async function selectFolder(path: string, name?: string) {
  set({ folder: path, folderName: name || baseName(path), scan: null, scanning: true, scanErr: null, skippedOpen: false, unskip: {} });
  await rescan();
}

export async function rescan() {
  const root = state.folder;
  if (!root) return;
  set({ scanning: true, scanErr: null });
  try {
    const unskip = Object.keys(state.unskip).filter((k) => state.unskip[k]);
    const scan = await api.scan(root, unskip);
    if (state.folder !== root) return;
    set({ scan, scanning: false, scanDoneAt: performance.now(), folderName: scan.rootDisplay || state.folderName });
  } catch (e: any) {
    set({ scanning: false, scanErr: String(e?.message || e) });
  }
}

export function clearFolder() { set({ folder: null, folderName: null, scan: null, skippedOpen: false, unskip: {} }); }

export function estimateSec(files: number): number {
  const m = currentModel();
  const spf = state.secPerFile && state.secPerFile > 0 ? Math.max(state.secPerFile, 1.5) : MODELS[m].secPerFile;
  return files * spf;
}

export async function startAnalysis() {
  const s = state;
  if (!s.folder || !s.scan) return;
  const naming: Naming = { rename: s.rename, datePrefix: s.datePrefix, lang: s.nameLang, maxWords: 0 };
  const dest = s.dest === "other" && s.destPath ? s.destPath : s.folder;
  const wish = s.wishes.trim();
  if (wish) {
    const today = localIso();
    const rw = [{ text: wish, date: today }, ...(s.boot?.recentWishes || []).filter((w) => w.text !== wish)].slice(0, 5);
    set({ boot: s.boot ? { ...s.boot, recentWishes: rw } : s.boot });
    api.saveSettings({ recentWishes: rw });
  }
  set({ an: { ...emptyAn(), stage: 1, total: s.scan.total }, gpu: null, gpuChoice: null, plan: null });
  go("analysis");
  api.setBusy(true);
  api.gpuWatch(true);
  try {
    await api.analyze({ root: s.folder, dest, unskip: Object.keys(s.unskip).filter((k) => s.unskip[k]), wishes: wish, model: currentModel(), naming });
  } catch (e: any) {
    set({ an: { ...state.an, error: String(e?.message || e) } });
  }
}

/* ───────────────────────── анализ ───────────────────────── */

export function onEngine(ev: any) {
  const an = state.an;
  switch (ev.event) {
    case "stage": set({ an: { ...an, stage: ev.stage } }); break;
    case "file_start": set({ an: { ...an, looking: { old: ev.old, thumb: ev.thumb, kind: ev.kind } } }); break;
    case "file_done": {
      const f = ev.file;
      const item: FeedItem = { id: f.id, icon: f.icon || "draft", c: f.c || "#8b8b90", old: f.old, name: f.name };
      set({ an: { ...an, recent: [...an.recent, f].slice(-12), recentSeq: an.recentSeq + 1, feed: f.feed === false ? an.feed : [item, ...an.feed].slice(0, 9) } });
      break;
    }
    case "feed": set({ an: { ...an, feed: [ev.item, ...an.feed].slice(0, 9) } }); break;
    case "progress": {
      const busy = !!state.gpu?.busy;
      const baseline = !busy && ev.secPerFile > 0 && ev.done > 6 ? (an.baseline ? Math.min(an.baseline, ev.secPerFile * 1.0) : ev.secPerFile) : an.baseline;
      set({ an: { ...an, done: ev.done, total: ev.total, errors: ev.errors, secPerFile: ev.secPerFile, baseline } });
      break;
    }
    case "themes": set({ an: { ...an, themes: ev.themes } }); break;
    case "error": set({ an: { ...an, error: ev.message } }); break;
    case "plan": onPlan(ev.plan); break;
  }
}

export function onGpu(g: GpuState) { set({ gpu: g }); }

export async function toggleAnalysisPause() {
  const on = !state.an.paused;
  set({ an: { ...state.an, paused: on } });
  await api.analysisPause(on);
}

export async function gpuWait() {
  const g = state.gpu;
  set({ gpuChoice: "wait", an: { ...state.an, paused: true } });
  await api.analysisPause(true);
  if (g?.pid) {
    try { await api.gpuWaitExit(g.pid); } catch { /* процесс уже завершился */ }
    if (state.gpuChoice === "wait") {
      set({ gpuChoice: null, gpu: { busy: false, app: "", pid: 0 }, an: { ...state.an, paused: false } });
      await api.analysisPause(false);
    }
  }
}

export async function showPlanNow() {
  set({ an: { ...state.an, stage: Math.max(state.an.stage, 2) } });
  await api.analysisStop();
}

/* ───────────────────────── план ───────────────────────── */

function onPlan(plan: PlanData) {
  const files = plan.files.map((f) => ({ ...f, cur: f.cur || f.abs, engineTo: f.to, orig: f.name, rejected: false }));
  set({
    plan, files, hist: [], versions: [{ files, mapping: plan.mapping, naming: plan.naming }], verSel: 1,
    sel: null, filter: "all", view: "tree", projBanner: plan.projects.length > 0, privShown: {}, toast: null,
    msgs: [{ ai: true, text: "Напишите, что поправить. Пересчитаю только план — это секунды, а не час." }],
    tuneOpen: false, tuneBusy: false, sessions: [], applyRes: null, undoRes: null, undone: false, lockedDone: {},
    an: { ...state.an, stage: 4 },
  });
  api.setBusy(false);
  api.gpuWatch(false);
  go("plan");
  if (document.hidden) api.notify("Хранилка", `План готов: ${plan.files.length} ${plural(plan.files.length, ["файл", "файла", "файлов"])}`);
}

function commit(files: FileItem[], extra?: Partial<AppState>) {
  const versions = state.versions.slice();
  const v = versions[state.verSel - 1];
  if (v) versions[state.verSel - 1] = { ...v, files };
  set({ files, versions, ...(extra || {}) });
}

const pushHist = () => [...state.hist, state.files].slice(-30);

export function undoEdit() {
  const h = state.hist;
  if (!h.length) return;
  commit(h[h.length - 1], { hist: h.slice(0, -1), toast: null });
}

export function toggleReject(id: number) {
  commit(state.files.map((f) => (f.id === id ? { ...f, rejected: !f.rejected } : f)), { hist: pushHist() });
}

export function moveFile(id: number, to: string) {
  const f = state.files.find((x) => x.id === id);
  if (!f || f.to === to) { set({ dragOver: null }); return; }
  commit(state.files.map((x) => (x.id === id ? { ...x, to, manualTo: to } : x)), {
    dragOver: null, hist: pushHist(), toast: { text: "«" + f.name + "» → " + to.split("/").pop(), at: performance.now() }, sel: "f:" + id,
  });
}

export function renameFile(id: number, name: string, record = false) {
  commit(state.files.map((f) => (f.id === id ? { ...f, name, manualName: name } : f)), record ? { hist: pushHist() } : undefined);
}

export function restoreName(id: number) {
  commit(state.files.map((f) => (f.id === id ? { ...f, name: f.old, manualName: f.old } : f)), { hist: pushHist() });
}

export function selectVersion(n: number) {
  const v = state.versions[n - 1];
  if (!v) return;
  set({ verSel: n, files: v.files, hist: [], sel: null });
}

/* ───────────────────────── дотюнить ───────────────────────── */

function diffText(a: FileItem[], b: FileItem[]): string {
  const byId = new Map(a.map((f) => [f.id, f]));
  let moved = 0, renamed = 0;
  for (const f of b) {
    const o = byId.get(f.id);
    if (!o) continue;
    if (o.to !== f.to) moved++;
    if (o.name !== f.name) renamed++;
  }
  const mv = `${moved === 1 ? "Переместится" : "Переместятся"} ${moved} ${plural(moved, ["файл", "файла", "файлов"])}`;
  const rn = `${renamed === 1 ? "изменится" : "изменятся"} ${renamed} ${plural(renamed, ["имя", "имени", "имён"])}`;
  if (moved && renamed) return `${mv} · ${rn}`;
  if (moved) return `${mv}, остальное без изменений`;
  if (renamed) return `${rn[0].toUpperCase() + rn.slice(1)}, папки без изменений`;
  return "Без изменений";
}

export async function sendTune(text: string) {
  text = (text || "").trim();
  const s = state;
  if (!text || s.tuneBusy || !s.plan) return;
  const msgs = [...s.msgs, { user: true, text }];
  set({ msgs, tuneInput: "", tuneBusy: true });
  const v = s.versions[s.verSel - 1];
  try {
    const r = await api.tune({ text, history: msgs, mapping: v.mapping, naming: v.naming, wishes: s.wishes, model: currentModel() });
    if (r.question) {
      set({ tuneBusy: false, msgs: [...state.msgs, { ai: true, text: r.question, opts: r.options }] });
      return;
    }
    if (r.files) {
      const cur = new Map(state.files.map((f) => [f.id, f]));
      const files = r.files.map((nf) => {
        const o = cur.get(nf.id);
        const base = { ...nf, cur: o?.cur || nf.abs, engineTo: nf.to, orig: nf.name, rejected: o?.rejected || false } as FileItem;
        if (o?.manualTo) { base.to = o.manualTo; base.manualTo = o.manualTo; }
        if (o?.manualName) { base.name = o.manualName; base.manualName = o.manualName; }
        return base;
      });
      const diff = diffText(state.files, files);
      if (diff === "Без изменений") {
        // ничего не поменялось — не плодим пустую версию и честно говорим об этом
        set({ tuneBusy: false, msgs: [...state.msgs, { ai: true, text: "По этой просьбе в плане ничего не меняется. Уточните, что именно поправить — например, какие папки или имена." }] });
        return;
      }
      const versions = [...state.versions, { files, mapping: r.mapping || v.mapping, naming: r.naming || v.naming }];
      const ver = versions.length;
      set({ versions, verSel: ver, files, hist: [], tuneBusy: false, msgs: [...state.msgs, { ai: true, text: r.reply || "Понял, поправил план.", diff, ver: "v" + ver }] });
      if (state.screen === "result") set({ screen: "plan", tuneOpen: true, undone: false });
    } else {
      set({ tuneBusy: false, msgs: [...state.msgs, { ai: true, text: r.reply || "Не понял, что поправить. Попробуйте сформулировать иначе." }] });
    }
  } catch (e: any) {
    set({ tuneBusy: false, msgs: [...state.msgs, { ai: true, text: "Не получилось пересчитать план: " + String(e?.message || e) }] });
  }
}

/* ───────────────────────── применение ───────────────────────── */

const norm = (p: string) => p.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
export const destDir = (plan: PlanData, to: string) => plan.dest.replace(/[\\/]+$/, "") + (to ? "\\" + to.replace(/\//g, "\\") : "");

export function buildOps(s: AppState = state): ApplyOp[] {
  const plan = s.plan;
  if (!plan) return [];
  const ops: ApplyOp[] = [];
  for (const f of s.files) {
    if (f.rejected) continue;
    const dir = destDir(plan, f.to);
    if (norm(f.cur) === norm(dir + "\\" + f.name)) continue;
    ops.push({ kind: "file", id: "f" + f.id, src: f.cur, dstDir: dir, name: f.name });
  }
  for (const l of plan.locked) {
    const dir = destDir(plan, LOCKED_DIR);
    const cur = s.lockedDone[l.id] || l.cur;
    if (norm(cur) === norm(dir + "\\" + l.name)) continue;
    ops.push({ kind: "dir", id: l.id, src: cur, dstDir: dir, name: l.name });
  }
  return ops;
}

export function planStats(s: AppState = state) {
  const files = s.files;
  const live = files.filter((f) => !f.rejected);
  const folders = new Set<string>();
  live.forEach((f) => { const parts = f.to.split("/"); for (let i = 1; i <= parts.length; i++) folders.add(parts.slice(0, i).join("/")); });
  if (s.plan?.locked.length) folders.add(LOCKED_DIR);
  return {
    total: files.length,
    folders: folders.size,
    renamed: live.filter((f) => f.name !== f.old).length,
    locked: s.plan?.locked.length || 0,
    skipped: s.plan?.skipped || 0,
    check: files.filter((f) => !!f.check).length,
    rejected: files.filter((f) => f.rejected).length,
  };
}

export async function startApply(onlyIds?: string[]) {
  const s = state;
  if (!s.plan) return;
  let ops = buildOps(s);
  if (onlyIds) ops = ops.filter((o) => onlyIds.includes(o.id));
  if (!ops.length) { go("result", { undone: false }); return; }
  set({ modal: "applying", prog: { n: 0, total: ops.length, lines: [] } });
  api.setBusy(true);
  try {
    const res = await api.apply({ name: s.plan.rootDisplay, root: s.plan.root, dest: s.plan.dest, ops });
    api.setBusy(false);
    const doneMap = new Map(res.done.map((d) => [d.id, d.dst]));
    const files = state.files.map((f) => (doneMap.has("f" + f.id) ? { ...f, cur: doneMap.get("f" + f.id)! } : f));
    const lockedDone = { ...state.lockedDone };
    state.plan!.locked.forEach((l) => { if (doneMap.has(l.id)) lockedDone[l.id] = doneMap.get(l.id)!; });
    const prev = onlyIds && state.applyRes ? state.applyRes : null;
    const merged: ApplyResult = prev
      ? { ...res, moved: prev.moved + res.moved, total: prev.total, skipped: res.skipped, done: [...prev.done, ...res.done] }
      : res;
    commit(files, { sessions: [...state.sessions, res.sessionId], applyRes: merged, lockedDone, stopN: res.moved });
    const boot = state.boot;
    if (boot) {
      const h = { id: res.sessionId, name: s.plan.rootDisplay, root: s.plan.root, dest: s.plan.dest, date: localIso(), until: res.until, files: merged.moved, undone: false };
      set({ boot: { ...boot, history: [h, ...boot.history.filter((x) => x.id !== h.id)].slice(0, 8) } });
    }
    if (state.modal === "stop" || res.stopped) { set({ modal: "stop" }); return; }
    go("result", { undone: false, undoRes: null });
  } catch (e: any) {
    api.setBusy(false);
    set({ modal: null, toast: { text: "Не получилось применить: " + String(e?.message || e), at: performance.now() } });
  }
}

export async function askStop() {
  if (state.modal !== "applying") return;
  set({ modal: "stop", stopN: state.prog.n });
  await api.applyStop();
}

export async function startUndo(toScreen: Screen = "result") {
  const ids = state.sessions.slice().reverse();
  set({ modal: "undoing", prog: { n: 0, total: state.applyRes?.moved || 0, lines: [] } });
  api.setBusy(true);
  let restored = 0, total = 0;
  const conflicts: UndoResult["conflicts"] = [];
  try {
    for (const id of ids) {
      const r = await api.undo(id);
      restored += r.restored; total += r.total; conflicts.push(...r.conflicts);
    }
  } catch (e: any) {
    conflicts.push({ icon: "error", name: "Откат прерван", why: String(e?.message || e) });
  }
  api.setBusy(false);
  const files = state.files.map((f) => ({ ...f, cur: f.abs }));
  const boot = state.boot;
  const history = boot ? boot.history.filter((h) => !ids.includes(h.id)) : [];
  commit(files, { sessions: [], lockedDone: {}, undoRes: { restored, total, conflicts }, undone: true, modal: null, boot: boot ? { ...boot, history } : boot });
  if (toScreen !== "result") go(toScreen);
  else set({ screen: "result" });
}

export function newSort() {
  set({ plan: null, files: [], versions: [], hist: [], sessions: [], applyRes: null, undoRes: null, undone: false, sel: null, lockedDone: {} });
  go("start", { folder: null, folderName: null, scan: null });
}

export type { LockedUnit, QuickFolder };
