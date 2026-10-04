import { useEffect, useMemo, useRef, useState } from "react";
import { C, Ic, css, topColor } from "../ui";
import {
  AppState, LOCKED_DIR, get, moveFile, planStats, renameFile, restoreName, set, toggleReject, undoEdit, useApp,
} from "../store";
import type { FileItem } from "../lib/types";
import { nf, plural, winJoin } from "../lib/format";
import { fileSrc } from "../lib/api";

const TOP_ORDER = ["Проекты", "Projects", "Фото", "Photos", "Скриншоты", "Screenshots", "Видео", "Videos", "Документы", "Documents", "Музыка", "Music"];
const LAST = ["Разобрать вручную", "Sort manually"];

function match(f: FileItem, flt: string) {
  if (flt === "all") return true;
  if (flt === "check") return !!f.check;
  if (flt === "renamed") return f.name !== f.old;
  if (flt === "rejected") return f.rejected;
  if (flt === "photo") return f.type === "фото";
  if (flt === "shot") return f.type === "скриншот";
  if (flt === "doc") return f.type === "документ" || f.type === "скан";
  return true;
}

function linked(s: AppState) {
  const ids = new Set<number>();
  const sel = s.sel || "";
  if (sel.startsWith("f:")) ids.add(+sel.slice(2));
  else if (sel.startsWith("o:")) { const k = sel.slice(2); s.files.forEach((f) => { if (!k || f.fromRel === k || f.fromRel.startsWith(k + "/")) ids.add(f.id); }); }
  else if (sel.startsWith("n:")) { const k = sel.slice(2); s.files.forEach((f) => { if (f.to === k || f.to.startsWith(k + "/")) ids.add(f.id); }); }
  const nfs = new Set<string>(), ofs = new Set<string>();
  s.files.forEach((f) => {
    if (!ids.has(f.id)) return;
    const parts = f.to.split("/");
    for (let i = 1; i <= parts.length; i++) nfs.add(parts.slice(0, i).join("/"));
    ofs.add(f.fromRel);
  });
  return { ids, nf: nfs, of: ofs };
}

type Row = {
  key: string; kind: "file" | "folder"; pad: number; icon: string; ic: string; fill: number; label: string; font: string; weight: number;
  c: string; bg: string; op: number; deco: string; tag?: string; tagC?: string; count?: number | null; outline: string;
  onClick: () => void; fileId?: number; drop?: string | null; drag?: boolean;
};

export function Plan() {
  const s = useApp();
  const plan = s.plan!;
  const st = planStats(s);
  const L = useMemo(() => linked(s), [s.sel, s.files]);
  const fl = s.filter;
  const dragRef = useRef<{ id: number; x: number; y: number; on: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);

  // Клавиатура как в макете: Ctrl+Z — отменить правку, X/Ч/Delete — отклонить выбранный файл.
  useEffect(() => {
    const onK = (e: KeyboardEvent) => {
      const tg = (e.target as HTMLElement)?.tagName;
      if (tg === "INPUT" || tg === "TEXTAREA") return;
      if (get().screen !== "plan" || get().modal) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undoEdit(); }
      else if ((e.key === "x" || e.key === "X" || e.key === "ч" || e.key === "Ч" || e.key === "Delete") && (get().sel || "").startsWith("f:")) toggleReject(+get().sel!.slice(2));
    };
    window.addEventListener("keydown", onK);
    return () => window.removeEventListener("keydown", onK);
  }, []);

  // Тост гаснет через 4.5 с
  useEffect(() => {
    if (!s.toast) return;
    const at = s.toast.at;
    const tm = setTimeout(() => { if (get().toast?.at === at) set({ toast: null }); }, 4500);
    return () => clearTimeout(tm);
  }, [s.toast]);

  // Перетаскивание файлов между папками на событиях мыши
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.on && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.on = true;
      if (d.on) {
        const f = get().files.find((x) => x.id === d.id);
        setGhost({ x: e.clientX, y: e.clientY, label: f?.name || "" });
        const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest("[data-drop]") as HTMLElement | null;
        const target = el?.dataset.drop || null;
        if (get().dragOver !== target) set({ dragOver: target });
      }
    };
    const up = () => {
      const d = dragRef.current;
      dragRef.current = null;
      setGhost(null);
      if (d?.on) {
        const target = get().dragOver;
        if (target) moveFile(d.id, target); else set({ dragOver: null });
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  const fileRow = (f: FileItem, side: "o" | "n", pad: number): Row => {
    const key = "f:" + f.id, isSel = s.sel === key, isL = L.ids.has(f.id), ns = side === "n";
    return {
      key: side + key, kind: "file", pad, icon: f.icon, ic: f.rejected ? "#4d4d53" : topColor(f.to), fill: 0, label: ns ? f.name : f.old,
      font: ns ? "Onest" : "JetBrains Mono", weight: 400, c: f.rejected ? "#6d6d73" : isSel || isL ? "#f4f4f5" : "#b9b9be",
      bg: isSel ? "#26262b" : isL ? "oklch(0.8 0.16 155 / 0.09)" : "transparent", op: f.rejected ? 0.55 : 1, deco: f.rejected && ns ? "line-through" : "none",
      tag: f.rejected ? (ns ? "останется" : "на месте") : f.check ? "проверьте" : undefined, tagC: f.rejected ? "#6d6d73" : "oklch(0.86 0.13 85)",
      outline: "transparent", onClick: () => set({ sel: key }), fileId: f.id, drag: ns,
    };
  };
  const folderRow = (key: string, label: string, pad: number, color: string, count: number | null, o: { icon?: string; tag?: string; linked?: boolean; drop?: string | null }): Row => {
    const isSel = s.sel === key, over = !!o.drop && s.dragOver === o.drop;
    return {
      key, kind: "folder", pad, icon: o.icon || "folder", ic: color, fill: 1, label, font: "Onest", weight: 500,
      c: isSel || o.linked ? "#f4f4f5" : "#d6d6d9", bg: over ? "oklch(0.74 0.15 300 / 0.14)" : isSel ? "#26262b" : o.linked ? "oklch(0.8 0.16 155 / 0.06)" : "transparent",
      op: 1, deco: "none", tag: o.tag, tagC: "#6d6d73", count, outline: over ? "oklch(0.74 0.15 300 / 0.7)" : "transparent",
      onClick: () => set({ sel: key }), drop: o.drop,
    };
  };

  /* Было */
  const oldRows: Row[] = [];
  const selIsO = (s.sel || "").startsWith("o:");
  oldRows.push(folderRow("o:", plan.rootDisplay, 8, C.b, plan.rootFiles, { linked: false }));
  s.files.filter((f) => !f.fromRel).forEach((f) => oldRows.push(fileRow(f, "o", 26)));
  const subs = Array.from(new Set(s.files.map((f) => f.fromRel).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"));
  subs.forEach((rel) => {
    const inRel = s.files.filter((f) => f.fromRel === rel);
    oldRows.push(folderRow("o:" + rel, rel.replace(/\//g, " / "), 26, "#6d6d73", inRel.length, { linked: L.of.has(rel) && !selIsO }));
    inRel.forEach((f) => oldRows.push(fileRow(f, "o", 44)));
  });
  plan.locked.forEach((l) => oldRows.push(folderRow("lock:" + l.id, l.name, 26, "#5d5d63", null, { icon: "folder_special", tag: l.why })));

  /* Станет */
  const vis = s.files.filter((f) => match(f, fl));
  const tree = useMemo(() => {
    type Node = { path: string; name: string; kids: Map<string, Node>; files: FileItem[]; all: number };
    const root: Node = { path: "", name: "", kids: new Map(), files: [], all: 0 };
    for (const f of s.files) {
      const parts = f.to.split("/").filter(Boolean);
      let n = root;
      n.all++;
      parts.forEach((p, i) => {
        if (!n.kids.has(p)) n.kids.set(p, { path: parts.slice(0, i + 1).join("/"), name: p, kids: new Map(), files: [], all: 0 });
        n = n.kids.get(p)!;
        n.all++;
      });
      n.files.push(f);
    }
    return root;
  }, [s.files]);
  const visIds = new Set(vis.map((f) => f.id));
  const newRows: Row[] = [];
  const selIsN = (s.sel || "").startsWith("n:");
  const hasVis = (n: any): boolean => n.files.some((f: FileItem) => visIds.has(f.id)) || Array.from(n.kids.values()).some(hasVis);
  const walk = (n: any, depth: number) => {
    const kids = Array.from(n.kids.values()) as any[];
    kids.sort((a, b) => {
      if (depth === 0) {
        const ia = LAST.includes(a.name) ? 99 : TOP_ORDER.indexOf(a.name) < 0 ? 50 : TOP_ORDER.indexOf(a.name);
        const ib = LAST.includes(b.name) ? 99 : TOP_ORDER.indexOf(b.name) < 0 ? 50 : TOP_ORDER.indexOf(b.name);
        if (ia !== ib) return ia - ib;
      }
      return a.name.localeCompare(b.name, "ru", { numeric: true });
    });
    for (const k of kids) {
      if (fl !== "all" && !hasVis(k)) continue;
      const lk = depth === 0 ? L.nf.has(k.path) && !selIsN : L.nf.has(k.path) && s.sel !== "n:" + k.path;
      newRows.push(folderRow("n:" + k.path, k.name, 8 + depth * 18, topColor(k.path), k.all, { linked: lk, drop: k.path }));
      walk(k, depth + 1);
      k.files.filter((f: FileItem) => visIds.has(f.id)).forEach((f: FileItem) => newRows.push(fileRow(f, "n", 8 + (depth + 1) * 18)));
    }
  };
  walk(tree, 0);
  if (fl === "all" && plan.locked.length) {
    newRows.push(folderRow("lock:all", "Целиком, без изменений", 8, "#6d6d73", null, { icon: "lock", tag: `${plan.locked.length} ${plural(plan.locked.length, ["папка", "папки", "папок"])}` }));
    plan.locked.forEach((l) => newRows.push(folderRow("lock:" + l.id, l.name, 26, "#5d5d63", null, { icon: "folder_special", tag: l.why })));
  }

  /* Карточка */
  const sel = s.sel || "";
  const sf = sel.startsWith("f:") ? s.files.find((f) => f.id === +sel.slice(2)) : null;
  let fcard: { title: string; c: string; sub: string; locked: boolean; list: { label: string; n: string | number; c: string }[] } | null = null;
  if (!sf && sel) {
    const k2 = sel.split(":").slice(1).join(":");
    if (sel.startsWith("o:")) {
      const fs = s.files.filter((f) => !k2 || f.fromRel === k2 || f.fromRel.startsWith(k2 + "/"));
      const g: Record<string, number> = {};
      fs.forEach((f) => { const t = f.rejected ? "остаётся на месте" : f.to; g[t] = (g[t] || 0) + 1; });
      const n = Object.keys(g).length;
      fcard = { title: k2 ? k2 : plan.rootDisplay, c: k2 ? "#8b8b90" : C.b, sub: `Файлы разойдутся по ${n} ${plural(n, ["папке", "папкам", "папкам"])}`, locked: false, list: Object.entries(g).sort((a, b) => b[1] - a[1]).map(([p, n2]) => ({ label: p.replace(/\//g, " / "), n: n2, c: topColor(p) })) };
    } else if (sel.startsWith("n:")) {
      const fs = s.files.filter((f) => f.to === k2 || f.to.startsWith(k2 + "/"));
      const g: Record<string, number> = {};
      fs.forEach((f) => { const fr = f.fromRel || plan.rootDisplay; g[fr] = (g[fr] || 0) + 1; });
      fcard = { title: k2.split("/").pop()!, c: topColor(k2), sub: `Новая папка · ${fs.length} ${plural(fs.length, ["файл", "файла", "файлов"])}`, locked: false, list: Object.entries(g).map(([fr, n2]) => ({ label: "из «" + fr + "»", n: n2, c: fr === plan.rootDisplay ? C.b : "#6d6d73" })) };
    } else {
      const l = plan.locked.find((x) => x.id === k2);
      fcard = { title: l ? l.name : "Целиком, без изменений", c: "#8b8b90", sub: l ? "Причина: " + l.why : `Переедут в «${LOCKED_DIR}»`, locked: true, list: plan.locked.map((x) => ({ label: x.name, n: x.why, c: "#5d5d63" })) };
    }
  }
  const histC = s.hist.length ? "#c9c9cd" : "#4d4d53";

  const renderRow = (row: Row, side: "o" | "n") => (
    <div key={row.key} className="prow" data-drop={side === "n" && row.drop ? row.drop : undefined}
      onClick={row.onClick}
      onMouseDown={row.drag && row.fileId != null ? (e) => { if (e.button === 0) dragRef.current = { id: row.fileId!, x: e.clientX, y: e.clientY, on: false }; } : undefined}
      style={css(`display:flex;align-items:center;gap:7px;height:30px;padding:0 8px 0 ${row.pad}px;border-radius:7px;background:${row.bg};outline:1px dashed ${row.outline};outline-offset:-1px;opacity:${row.op};cursor:${row.drag ? "grab" : "pointer"};transition:background .15s`)}>
      <Ic n={row.icon} s={`font-size:16px;color:${row.ic};font-variation-settings:'FILL' ${row.fill};flex:none`} />
      <span style={css(`flex:1;min-width:0;font:${row.weight} ${side === "o" ? "12.5" : "13"}px '${row.font}',${side === "o" ? "monospace" : "sans-serif"};color:${row.c};text-decoration:${row.deco};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{row.label}</span>
      {row.tag && <span style={css(`display:inline-flex;align-items:center;gap:3px;font:400 ${side === "o" ? "10" : "10.5"}px 'Onest';color:${row.tagC};flex:none`)}>{row.tag}</span>}
      {row.count != null && <span style={css("min-width:22px;height:18px;padding:0 5px;border-radius:5px;background:#1c1c1f;font:400 10.5px/18px 'JetBrains Mono',monospace;color:#8b8b90;text-align:center;flex:none")}>{nf(row.count)}</span>}
    </div>
  );

  const filters: [string, string][] = [["all", "Все"], ["check", "Проверить"], ["renamed", "Переименованные"], ["rejected", "Отклонённые"], ["photo", "Фото"], ["shot", "Скриншоты"], ["doc", "Документы"]];
  const B5 = (n: number) => <b style={css("font:500 14px 'Onest';color:#ededee")}>{nf(n)}</b>;
  const dot = <span style={css("color:#3a3a3f")}>·</span>;

  return (
    <div style={css("flex:1;min-height:0;display:flex;flex-direction:column;animation:fadein .4s ease both")}>
      <div style={css("flex:none;display:flex;align-items:center;gap:14px;padding:12px 18px;border-bottom:1px solid #1c1c1f")}>
        <div style={css("display:flex;align-items:center;gap:6px;flex-wrap:wrap;font:400 13px 'Onest';color:#8b8b90")}>
          {B5(st.total)}{plural(st.total, ["файл", "файла", "файлов"])}<Ic n="arrow_forward" s="font-size:16px" />{B5(st.folders)}{plural(st.folders, ["папка", "папки", "папок"])}
          {dot}{B5(st.renamed)}переименуем
          {st.locked > 0 && <>{dot}{B5(st.locked)}{plural(st.locked, ["проект", "проекта", "проектов"])} целиком</>}
          {dot}{B5(st.skipped)}не трогаем
          {st.check > 0 && <>{dot}<button onClick={() => set({ filter: "check" })} style={css("display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 8px;border-radius:6px;border:none;background:oklch(0.84 0.13 85 / 0.1);color:oklch(0.88 0.12 85);font:500 13px 'Onest';cursor:pointer")}>{nf(st.check)} стоит проверить</button></>}
          {st.rejected > 0 && <>{dot}<span style={css("color:#ededee")}>{st.rejected} {plural(st.rejected, ["отклонён", "отклонено", "отклонено"])}</span></>}
          {plan.partial && <>{dot}<span style={css("color:#6d6d73")}>план по разобранной части</span></>}
        </div>
        <div style={css("margin-left:auto;display:flex;gap:8px;flex:none")}>
          <button onClick={() => set({ tuneOpen: true })} style={css("height:34px;padding:0 12px;border-radius:8px;border:1px solid #2a2a2e;background:#18181b;color:#ededee;font:500 13px 'Onest';cursor:pointer;display:flex;align-items:center;gap:6px")}><Ic n="tune" s="font-size:17px" />Дотюнить<span style={css("font:400 11px 'JetBrains Mono',monospace;color:#6d6d73")}>v{s.verSel}</span></button>
          <button onClick={() => set({ modal: "confirm" })} style={css("height:34px;padding:0 16px;border-radius:8px;border:none;background:#ededee;color:#0e0e0f;font:500 13px 'Onest';cursor:pointer")}>Применить</button>
        </div>
      </div>
      <div style={css("flex:none;display:flex;align-items:center;gap:6px;padding:8px 18px;border-bottom:1px solid #1c1c1f")}>
        {filters.map(([kk, l]) => (
          <button key={kk} onClick={() => set({ filter: kk })} style={css(`height:28px;padding:0 10px;border-radius:7px;border:1px solid ${fl === kk ? "#2e2e33" : "transparent"};background:${fl === kk ? "#1f1f22" : "transparent"};color:${fl === kk ? "#ededee" : "#8b8b90"};font:500 12px 'Onest';cursor:pointer;display:flex;align-items:center;gap:6px`)}>
            {l}<span style={css("font:400 11px 'JetBrains Mono',monospace;color:#6d6d73")}>{nf(s.files.filter((f) => match(f, kk)).length)}</span>
          </button>
        ))}
        <div style={css("margin-left:auto;display:flex;align-items:center;gap:10px")}>
          <button onClick={undoEdit} title="Ctrl+Z" style={css(`height:28px;padding:0 9px;border-radius:7px;border:none;background:transparent;color:${histC};font:500 12px 'Onest';cursor:pointer;display:flex;align-items:center;gap:5px`)}><Ic n="undo" s="font-size:16px" />Отменить правку</button>
          <div style={css("display:flex;padding:2px;border-radius:8px;background:#0b0b0c;border:1px solid #1f1f22")}>
            {([["tree", "account_tree", "Дерево"], ["grid", "grid_view", "Сетка"]] as const).map(([kk, ic, l]) => (
              <button key={kk} onClick={() => set({ view: kk })} title={l} style={css(`width:30px;height:24px;border-radius:6px;border:none;background:${s.view === kk ? "#26262a" : "transparent"};color:${s.view === kk ? "#ededee" : "#6d6d73"};cursor:pointer;display:grid;place-items:center;font-family:'Material Symbols Rounded';font-size:16px`)}><span data-ms="">{ic}</span></button>
            ))}
          </div>
        </div>
      </div>
      <div style={css("flex:1;min-height:0;display:grid;grid-template-columns:262px minmax(0,1fr) 284px")}>
        <div style={css("border-right:1px solid #1c1c1f;display:flex;flex-direction:column;min-height:0")}>
          <div style={css("height:36px;flex:none;display:flex;align-items:center;gap:8px;padding:0 14px;font:500 12px 'Onest';color:#8b8b90")}>Было<span style={css("font:400 11px 'JetBrains Mono',monospace;color:#5d5d63")}>{nf(plan.rootFiles)} вперемешку</span></div>
          <div style={css("flex:1;overflow:auto;padding:0 6px 12px")}>{oldRows.map((r) => renderRow(r, "o"))}</div>
        </div>
        <div style={css("border-right:1px solid #1c1c1f;display:flex;flex-direction:column;min-height:0;min-width:0")}>
          <div style={css("height:36px;flex:none;display:flex;align-items:center;gap:8px;padding:0 14px;font:500 12px 'Onest';color:#8b8b90")}>Станет<span style={css("font:400 11px 'JetBrains Mono',monospace;color:#5d5d63")}>перетаскивайте файлы между папками</span></div>
          {s.projBanner && plan.projects.length > 0 && (
            <div style={css("margin:0 10px 8px;display:flex;align-items:center;gap:10px;padding:9px 10px 9px 12px;border-radius:10px;background:oklch(0.74 0.15 300 / 0.08);border:1px solid oklch(0.74 0.15 300 / 0.25)")}>
              <Ic n="workspaces" s="font-size:18px;color:oklch(0.8 0.13 300)" />
              <span style={css("flex:1;font:400 12px/1.35 'Onest';color:#d6d6d9")}>Нашли ваши проекты: {plan.projects.join(", ")} — сделали для них отдельные папки</span>
              <button onClick={() => set({ projBanner: false })} style={css("height:26px;padding:0 9px;border-radius:6px;border:none;background:#1f1f23;color:#ededee;font:500 11px 'Onest';cursor:pointer")}>Хорошо</button>
            </div>
          )}
          {s.view === "tree" ? (
            <div style={css("flex:1;overflow:auto;padding:0 6px 12px")}>{newRows.map((r) => renderRow(r, "n"))}</div>
          ) : (
            <div style={css("flex:1;overflow:auto;padding:0 12px 12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px;align-content:start")}>
              {vis.map((f) => {
                const key = "f:" + f.id, isSel = s.sel === key;
                return (
                  <div key={f.id} onClick={() => set({ sel: key })} style={css(`display:flex;flex-direction:column;gap:6px;padding:6px;border-radius:10px;background:${isSel ? "#1f1f23" : "#141416"};outline:1px solid ${isSel ? "#55555b" : "#1f1f22"};opacity:${f.rejected ? 0.5 : 1};cursor:pointer;animation:pop .3s ease both`)}>
                    <div style={css("aspect-ratio:1;border-radius:7px;background:repeating-linear-gradient(135deg,#17171a 0 7px,#1c1c1f 7px 14px);display:flex;align-items:flex-end;padding:5px;position:relative;overflow:hidden")}>
                      {f.thumb && <img src={fileSrc(f.thumb)} alt="" loading="lazy" style={css(`position:absolute;inset:0;width:100%;height:100%;object-fit:cover;${f.priv && !s.privShown[f.id] ? "filter:blur(8px)" : ""}`)} />}
                      <span style={css("position:relative;font:400 9.5px 'JetBrains Mono',monospace;color:#6d6d73;background:#0e0e0fcc;padding:1px 4px;border-radius:3px")}>{f.type}</span>
                      {f.check && <span style={css("position:absolute;top:5px;right:5px;width:8px;height:8px;border-radius:4px;background:oklch(0.84 0.13 85)")} />}
                    </div>
                    <span style={css(`font:400 11.5px/1.3 'Onest';color:#d6d6d9;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-decoration:${f.rejected ? "line-through" : "none"};word-break:break-word`)}>{f.name}</span>
                    <span style={css(`font:400 10px 'Onest';color:${topColor(f.to)};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{f.to.split("/").pop()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div style={css("min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:14px")}>
          {!sel && (
            <div style={css("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px;padding:0 12px")}>
              <Ic n="ads_click" s="width:44px;height:44px;border-radius:12px;background:#141416;border:1px solid #222225;display:grid;place-items:center;font-size:22px;color:#6d6d73" />
              <span style={css("font:400 13px/1.5 'Onest';color:#8b8b90")}>Выберите файл или папку — покажу, откуда он пришёл и куда уйдёт</span>
              <div style={css("display:flex;flex-direction:column;gap:6px;font:400 12px 'Onest';color:#5d5d63;margin-top:6px")}>
                <span><b style={css("font:500 11px 'JetBrains Mono',monospace;color:#9a9aa0;padding:1px 5px;border:1px solid #2a2a2e;border-radius:4px")}>X</b> — отклонить</span>
                <span><b style={css("font:500 11px 'JetBrains Mono',monospace;color:#9a9aa0;padding:1px 5px;border:1px solid #2a2a2e;border-radius:4px")}>Ctrl Z</b> — отменить правку</span>
              </div>
            </div>
          )}
          {sf && <FileCard key={sf.id} f={sf} s={s} />}
          {fcard && (
            <div style={css("display:flex;flex-direction:column;gap:14px;animation:fadein .25s ease both")}>
              <div style={css("display:flex;align-items:center;gap:10px")}>
                <Ic n="folder" s={`width:40px;height:40px;border-radius:10px;background:#18181b;display:grid;place-items:center;font-size:22px;color:${fcard.c};font-variation-settings:'FILL' 1`} />
                <div style={css("display:flex;flex-direction:column;gap:2px;min-width:0")}><span style={css("font:500 14px 'Onest';word-break:break-word")}>{fcard.title}</span><span style={css("font:400 12px 'Onest';color:#8b8b90")}>{fcard.sub}</span></div>
              </div>
              <div style={css("display:flex;flex-direction:column;border-radius:10px;border:1px solid #1f1f22;overflow:hidden")}>
                {fcard.list.map((li, i) => (
                  <div key={li.label + i} style={css("display:flex;align-items:center;gap:8px;height:36px;padding:0 10px;border-bottom:1px solid #1a1a1d")}>
                    <Ic n="folder" s={`font-size:15px;color:${li.c};font-variation-settings:'FILL' 1`} />
                    <span style={css("flex:1;font:400 12.5px 'Onest';color:#d6d6d9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{li.label}</span>
                    <span style={css("font:400 11px 'JetBrains Mono',monospace;color:#8b8b90")}>{li.n}</span>
                  </div>
                ))}
              </div>
              {fcard.locked && <div style={css("display:flex;gap:8px;font:400 12px/1.45 'Onest';color:#9a9aa0")}><Ic n="lock" s="font-size:16px" />Перенесём целиком в «{LOCKED_DIR}», внутри ничего не тронем. Разобрать по файлам можно только явно.</div>}
            </div>
          )}
        </div>
      </div>
      {s.toast && (
        <div style={css("position:absolute;left:50%;bottom:20px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;height:42px;padding:0 6px 0 14px;border-radius:11px;background:#1f1f22;border:1px solid #2e2e33;box-shadow:0 12px 40px rgba(0,0,0,.5);animation:pop .3s cubic-bezier(.2,.8,.2,1) both;white-space:nowrap;z-index:5")}>
          <Ic n="check" s="font-size:17px;color:oklch(0.85 0.14 155)" />
          <span style={css("font:400 13px 'Onest';color:#ededee;max-width:520px;overflow:hidden;text-overflow:ellipsis")}>{s.toast.text}</span>
          <button onClick={undoEdit} style={css("height:30px;padding:0 10px;border-radius:7px;border:none;background:#2a2a2e;color:#ededee;font:500 12px 'Onest';cursor:pointer")}>Отменить</button>
        </div>
      )}
      {ghost && (
        <div style={css(`position:fixed;left:${ghost.x + 12}px;top:${ghost.y + 10}px;pointer-events:none;z-index:50;display:flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:8px;background:#1f1f22;border:1px solid #3a3a3f;box-shadow:0 10px 30px rgba(0,0,0,.5);font:400 12px 'Onest';color:#ededee;white-space:nowrap`)}>
          <Ic n="drag_indicator" s="font-size:15px;color:#8b8b90" />{ghost.label}
        </div>
      )}
    </div>
  );
}

function FileCard({ f, s }: { f: FileItem; s: AppState }) {
  const plan = s.plan!;
  const priv = f.priv && !s.privShown[f.id];
  const confC = f.conf >= 80 ? "oklch(0.8 0.16 155)" : f.conf >= 55 ? "oklch(0.84 0.13 85)" : "oklch(0.72 0.16 25)";
  const editRecorded = useRef(false);
  return (
    <>
      <div style={css("height:156px;flex:none;border-radius:12px;position:relative;overflow:hidden;background:repeating-linear-gradient(135deg,#17171a 0 9px,#1c1c1f 9px 18px);display:flex;align-items:flex-end;justify-content:space-between;padding:10px;animation:fadein .25s ease both")}>
        {f.thumb && <img src={fileSrc(f.thumb)} alt="" style={css("position:absolute;inset:0;width:100%;height:100%;object-fit:cover")} />}
        <span style={css("position:relative;font:400 10.5px 'JetBrains Mono',monospace;color:#6d6d73;background:#0e0e0f;padding:3px 6px;border-radius:4px")}>{f.type}</span>
        {priv && (
          <div style={css("position:absolute;inset:0;backdrop-filter:blur(10px);background:rgba(14,14,15,.4);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px")}>
            <Ic n="visibility_off" s="font-size:22px;color:#c9c9cd" />
            <span style={css("font:400 12px 'Onest';color:#c9c9cd")}>Личные данные скрыты</span>
            <button onClick={() => set({ privShown: { ...s.privShown, [f.id]: true } })} style={css("height:26px;padding:0 10px;border-radius:6px;border:1px solid #3a3a3f;background:transparent;color:#ededee;font:500 11px 'Onest';cursor:pointer")}>Показать</button>
          </div>
        )}
      </div>
      {f.check && (
        <div style={css("display:flex;gap:8px;padding:9px 10px;border-radius:9px;background:oklch(0.84 0.13 85 / 0.08);border:1px solid oklch(0.84 0.13 85 / 0.25);font:400 12px/1.4 'Onest';color:oklch(0.9 0.1 85)")}><Ic n="error" s="font-size:16px" />{f.check}</div>
      )}
      <div style={css("display:flex;flex-direction:column;gap:6px")}>
        <span style={css("font:400 11px 'Onest';color:#5d5d63")}>Имя</span>
        <span style={css("font:400 11.5px 'JetBrains Mono',monospace;color:#6d6d73;word-break:break-all")}>{f.old}</span>
        <input value={f.name}
          onFocus={() => { editRecorded.current = false; }}
          onChange={(e) => { renameFile(f.id, e.target.value, !editRecorded.current); editRecorded.current = true; }}
          style={css(`height:36px;border-radius:8px;border:1px solid #2a2a2e;background:#141416;color:#ededee;font:500 13px 'Onest';padding:0 10px;outline:none;text-decoration:${f.rejected ? "line-through" : "none"}`)} />
        {f.name !== f.orig && (
          <button onClick={() => restoreName(f.id)} style={css("align-self:flex-start;background:none;border:none;padding:0;color:#9a9aa0;font:400 12px 'Onest';cursor:pointer;display:flex;align-items:center;gap:4px")}><Ic n="restart_alt" s="font-size:14px" />Вернуть старое имя</button>
        )}
      </div>
      <div style={css("display:flex;flex-direction:column;gap:6px")}>
        <span style={css("font:400 11px 'Onest';color:#5d5d63")}>Путь</span>
        <span style={css("font:400 11.5px 'JetBrains Mono',monospace;color:#6d6d73;word-break:break-word")}>{winJoin(plan.rootDisplay, f.fromRel, f.old)}</span>
        <span style={css(`font:400 11.5px 'JetBrains Mono',monospace;color:${f.rejected ? "#6d6d73" : "oklch(0.85 0.12 155)"};word-break:break-word`)}>→ {f.rejected ? "останется на месте" : winJoin(plan.destDisplay, f.to) + "\\"}</span>
      </div>
      <div style={css("display:flex;flex-direction:column;gap:6px")}>
        <span style={css("font:400 11px 'Onest';color:#5d5d63")}>Почему</span>
        <span style={css("font:400 13px/1.45 'Onest';color:#d6d6d9")}>{f.reason}</span>
      </div>
      <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:10px")}>
        <div style={css("display:flex;flex-direction:column;gap:4px")}><span style={css("font:400 11px 'Onest';color:#5d5d63")}>Дата</span><span style={css("font:500 13px 'Onest'")}>{f.date}</span><span style={css("font:400 11px 'Onest';color:#6d6d73")}>из: {f.dsrc}</span></div>
        <div style={css("display:flex;flex-direction:column;gap:6px")}><span style={css("font:400 11px 'Onest';color:#5d5d63")}>Уверенность</span><span style={css(`font:500 13px 'JetBrains Mono',monospace;color:${confC}`)}>{f.conf}%</span><span style={css("height:4px;border-radius:2px;background:#1f1f22;overflow:hidden")}><span style={css(`display:block;height:100%;width:${f.conf}%;background:${confC};transition:width .4s`)} /></span></div>
      </div>
      <div style={css("display:flex;gap:8px;margin-top:auto")}>
        <button onClick={() => toggleReject(f.id)} style={css("flex:1;height:36px;border-radius:8px;border:1px solid #2a2a2e;background:#18181b;color:#ededee;font:500 13px 'Onest';cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px")}>
          <Ic n={f.rejected ? "undo" : "block"} s="font-size:16px" />{f.rejected ? "Вернуть в план" : "Отклонить — оставить на месте"}
        </button>
      </div>
    </>
  );
}
