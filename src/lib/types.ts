export type ModelKey = "fast" | "accurate";
export type Screen = "boot" | "welcome" | "why" | "check" | "download" | "ready" | "start" | "analysis" | "plan" | "result";

export const MODELS: Record<ModelKey, { name: string; acc: string; llm: string; embed: string; sizeGb: number; secPerFile: number }> = {
  fast: { name: "Быстрая", acc: "Быструю", llm: "gemma3:4b", embed: "bge-m3", sizeGb: 4.5, secPerFile: 8 },
  accurate: { name: "Точная", acc: "Точную", llm: "gemma3:12b", embed: "bge-m3", sizeGb: 9.5, secPerFile: 5 },
};

export interface SysInfo {
  gpuName: string;
  gpuVramGb: number | null;
  gpuKind: "dedicated" | "integrated" | "none";
  ramGb: number;
  diskLabel: string;
  diskFreeGb: number;
  modelsDir: string;
}

export interface OllamaStatus { installed: boolean; running: boolean; models: string[] }

export interface HistoryItem { id: string; name: string; root: string; dest: string; date: string; until: string; files: number; undone: boolean }

export interface BootState {
  onboarded: boolean;
  model: ModelKey | null;
  recentWishes: { text: string; date: string }[];
  history: HistoryItem[];
  secPerFile: number | null;
  modelsDir: string;
  ollama: OllamaStatus;
}

export interface QuickFolder { name: string; icon: string; path: string; count: number }

export interface SkipCat { key: string; icon: string; label: string; ex: string; count: number }

export interface ScanSummary {
  root: string;
  rootDisplay: string;
  total: number;
  images: number;
  docs: number;
  media: number;
  lockedCount: number;
  skippedFiles: number;
  skipped: SkipCat[];
}

export interface Naming { rename: boolean; datePrefix: boolean; lang: "ru" | "en"; maxWords: number }

export interface FileItem {
  id: number;
  abs: string;          // исходный путь
  cur: string;          // где файл лежит сейчас (после применения меняется)
  old: string;          // исходное имя
  fromRel: string;      // подпапка источника относительно корня ('' — сам корень)
  name: string;         // имя в плане (может быть изменено вручную)
  orig: string;         // имя, которое предложила модель
  to: string;           // папка назначения относительно корня назначения, через '/'
  engineTo: string;     // куда положила модель (до ручных правок)
  manualTo?: string;    // ручной перенос — переживает пересчёт плана
  manualName?: string;  // ручное имя — переживает пересчёт плана
  type: string;         // фото | скриншот | картинка | документ | скан | видео | аудио
  icon: string;
  reason: string;
  date: string;
  dsrc: string;
  conf: number;
  check: string | null;
  priv: boolean;
  thumb: string | null;
  kind: "image" | "doc" | "video" | "audio";
  cluster: string;
  size: number;
  rejected: boolean;
}

export interface LockedUnit { id: string; name: string; why: string; rel: string; abs: string; n: number; cur: string }

export interface PlanData {
  root: string;
  rootDisplay: string;
  dest: string;
  destDisplay: string;
  files: FileItem[];
  locked: LockedUnit[];
  skipped: number;
  projects: string[];
  rootFiles: number;
  rootKinds: string[];
  mapping: Record<string, string>;
  naming: Naming;
  partial: boolean;
}

export interface AnalyzeOptions {
  root: string;
  dest: string;
  unskip: string[];
  wishes: string;
  model: ModelKey;
  naming: Naming;
}

export interface FeedItem { id: number; icon: string; c: string; old: string; name: string }
export interface CurrentFile { id: number; old: string; thumb: string | null; thumbLabel: string; kind: string; desc: string; topic: string; name: string }
export interface Theme { label: string; n: number; c: string }

export interface PullProgress {
  phase: "engine" | "model";
  completed: number;
  total: number;
  speed: number;        // байт/с
  done: boolean;
  slow: boolean;
  error: null | { kind: "vpn" | "drop" | "other"; message: string };
}

export interface ApplyOp { kind: "file" | "dir"; id: string; src: string; dstDir: string; name: string }
export interface ApplySkip { id: string; name: string; reason: string }
export interface ApplyResult { sessionId: string; moved: number; total: number; skipped: ApplySkip[]; until: string; stopped: boolean; done: { id: string; dst: string }[] }
export interface UndoConflict { icon: string; name: string; why: string }
export interface UndoResult { restored: number; total: number; conflicts: UndoConflict[] }

export interface TuneMsg { ai?: boolean; user?: boolean; text: string; diff?: string; ver?: string; opts?: string[] }
export interface TuneReply { reply: string; question: string; options: string[]; files: FileItem[] | null; mapping: Record<string, string> | null; naming: Naming | null }

export interface GpuState { busy: boolean; app: string; pid: number }
