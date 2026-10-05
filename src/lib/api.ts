import type {
  AnalyzeOptions, ApplyOp, ApplyResult, BootState, FileItem, HistoryEntry, ModelKey, ModelsInfo, Naming, OllamaStatus,
  Project, QuickFolder, Rule, ScanSummary, SysInfo, TuneMsg, TuneReply, UndoResult,
} from "./types";
import { mockApi } from "./mock";

export type Channel = "pull" | "engine" | "apply" | "gpu" | "drop";

export interface Api {
  boot(): Promise<BootState>;
  saveSettings(patch: Record<string, unknown>): Promise<void>;
  systemCheck(): Promise<SysInfo>;
  ollamaStatus(): Promise<OllamaStatus>;
  pullStart(model: ModelKey): Promise<void>;
  pullPause(): Promise<void>;
  describeImage(req: { b64?: string; path?: string; name: string; model: ModelKey }): Promise<{ desc: string; name: string; seconds: number }>;
  pickFolder(): Promise<string | null>;
  pickImage(): Promise<{ path: string; name: string; dataUrl: string } | null>;
  quickFolders(): Promise<QuickFolder[]>;
  scan(root: string, unskip: string[], exclude: string[]): Promise<ScanSummary>;
  analyze(opts: AnalyzeOptions): Promise<void>;
  analysisPause(on: boolean): Promise<void>;
  analysisStop(): Promise<void>;
  tune(req: { text: string; history: TuneMsg[]; mapping: Record<string, string>; naming: Naming; wishes: string; model: ModelKey; rules: Rule[]; projects: Project[] }): Promise<TuneReply>;
  learn(ids: number[], folder: string): Promise<{ count: number }>;
  similar(id: number): Promise<{ ids: number[] }>;
  pickFiles(defaultPath?: string): Promise<string[]>;
  replan(req: { rules: Rule[]; projects: Project[]; mapping: Record<string, string>; naming: Naming }): Promise<{ files: FileItem[]; projects: string[] }>;
  learnedInfo(): Promise<{ count: number; folders: { folder: string; n: number }[] }>;
  learnedReset(): Promise<{ count: number }>;
  historyAll(): Promise<HistoryEntry[]>;
  ollamaModels(): Promise<ModelsInfo>;
  ollamaDelete(name: string): Promise<void>;
  ollamaStart(): Promise<void>;
  countNewFiles(path: string, since: number): Promise<{ count: number; examples: string[]; exists: boolean }>;
  appPaths(): Promise<{ data: string; log: string }>;
  appVersion(): Promise<string>;
  autostart(on?: boolean): Promise<boolean>;
  setKeepTray(on: boolean): Promise<void>;
  openUrl(url: string): Promise<void>;
  apply(req: { name: string; root: string; dest: string; ops: ApplyOp[]; sessionId?: string }): Promise<ApplyResult>;
  applyStop(): Promise<void>;
  undo(sessionId: string): Promise<UndoResult>;
  openPath(path: string): Promise<void>;
  setBusy(busy: boolean): Promise<void>;
  hideToTray(): Promise<void>;
  gpuWatch(on: boolean): Promise<void>;
  gpuWaitExit(pid: number): Promise<void>;
  notify(title: string, body: string): Promise<void>;
  win(action: "minimize" | "maximize" | "close"): Promise<void>;
  on(ch: Channel, cb: (payload: any) => void): () => void;
}

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function tauriApi(): Api {
  const core = import("@tauri-apps/api/core");
  const ev = import("@tauri-apps/api/event");
  const call = async <T,>(cmd: string, args?: Record<string, unknown>) => (await core).invoke<T>(cmd, args);
  const engine = async <T,>(req: Record<string, unknown>) => call<T>("engine_call", { req });

  return {
    boot: () => call("boot_state"),
    saveSettings: (patch) => call("save_settings", { patch }),
    systemCheck: () => call("system_check"),
    ollamaStatus: () => call("ollama_status"),
    pullStart: (model) => call("pull_start", { model }),
    pullPause: () => call("pull_pause"),
    describeImage: (req) => engine({ cmd: "describe_image", ...req }),
    pickFolder: async () => {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const r = await open({ directory: true, multiple: false, title: "Какую папку разобрать" });
      return typeof r === "string" ? r : null;
    },
    pickImage: async () => {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const r = await open({ multiple: false, title: "Картинка для проверки", filters: [{ name: "Картинки", extensions: ["jpg", "jpeg", "png", "webp", "heic", "gif", "bmp"] }] });
      if (typeof r !== "string") return null;
      const { convertFileSrc } = await core;
      return { path: r, name: r.split(/[\\/]/).pop() || r, dataUrl: convertFileSrc(r) };
    },
    quickFolders: () => call("quick_folders"),
    scan: (root, unskip, exclude) => engine({ cmd: "scan", root, unskip, exclude }),
    analyze: (opts) => engine({ cmd: "analyze", ...opts }),
    analysisPause: (on) => engine({ cmd: "pause", on }),
    analysisStop: () => engine({ cmd: "stop_and_plan" }),
    tune: (req) => engine({ cmd: "tune", ...req }),
    learn: (ids, folder) => engine({ cmd: "learn", ids, folder }),
    similar: (id) => engine({ cmd: "similar", file: id }),
    pickFiles: async (defaultPath) => {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const r = await open({ multiple: true, directory: false, defaultPath, title: "Файлы-примеры для папки" });
      return Array.isArray(r) ? r : typeof r === "string" ? [r] : [];
    },
    replan: (req) => engine({ cmd: "replan", ...req }),
    learnedInfo: () => engine({ cmd: "learned_info" }),
    learnedReset: () => engine({ cmd: "learned_reset" }),
    historyAll: () => call("history_all"),
    ollamaModels: () => call("ollama_models"),
    ollamaDelete: (name) => call("ollama_delete", { name }),
    ollamaStart: () => call("ollama_start"),
    countNewFiles: (path, since) => call("count_new_files", { path, since: Math.max(0, Math.floor(since)) }),
    appPaths: () => call("app_paths"),
    appVersion: async () => { const { getVersion } = await import("@tauri-apps/api/app"); return getVersion(); },
    autostart: async (on) => {
      const a = await import("@tauri-apps/plugin-autostart");
      if (on === true) await a.enable();
      else if (on === false) await a.disable();
      return a.isEnabled();
    },
    setKeepTray: (on) => call("set_keep_tray", { on }),
    openUrl: async (url) => { const { openUrl } = await import("@tauri-apps/plugin-opener"); await openUrl(url); },
    apply: (req) => call("apply_start", { req }),
    applyStop: () => call("apply_stop"),
    undo: (sessionId) => call("undo_start", { sessionId }),
    openPath: (path) => call("open_path", { path: path.replace(/\//g, "\\") }),
    setBusy: (busy) => call("set_busy", { busy }),
    hideToTray: () => call("hide_to_tray"),
    gpuWatch: (on) => call("gpu_watch", { on }),
    gpuWaitExit: (pid) => call("gpu_wait_exit", { pid }),
    notify: async (title, body) => {
      try {
        const n = await import("@tauri-apps/plugin-notification");
        let ok = await n.isPermissionGranted();
        if (!ok) ok = (await n.requestPermission()) === "granted";
        if (ok) n.sendNotification({ title, body });
      } catch { /* уведомления необязательны */ }
    },
    win: async (action) => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const w = getCurrentWindow();
      if (action === "minimize") await w.minimize();
      else if (action === "maximize") await w.toggleMaximize();
      else await call("window_close");
    },
    on: (ch, cb) => {
      let un: (() => void) | null = null, dead = false;
      if (ch === "drop") {
        import("@tauri-apps/api/webview").then(({ getCurrentWebview }) =>
          getCurrentWebview().onDragDropEvent((e) => cb(e.payload)).then((u) => { if (dead) u(); else un = u; }));
      } else {
        ev.then(({ listen }) => listen(ch, (e) => cb(e.payload)).then((u) => { if (dead) u(); else un = u; }));
      }
      return () => { dead = true; un?.(); };
    },
  };
}

export const api: Api = isTauri ? tauriApi() : mockApi();

/** Превью из движка — путь к файлу в кэше приложения; показываем его через asset-протокол Tauri. */
export function fileSrc(p: string | null | undefined): string | undefined {
  if (!p) return undefined;
  if (p.startsWith("data:") || p.startsWith("http") || p.startsWith("blob:")) return p;
  const tauri = (window as any).__TAURI_INTERNALS__;
  return tauri?.convertFileSrc ? tauri.convertFileSrc(p, "asset") : undefined;
}

export type { FileItem };
