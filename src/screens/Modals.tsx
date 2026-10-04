import { css } from "../ui";
import { askStop, buildOps, go, set, startApply, startUndo, useApp } from "../store";
import { nf } from "../lib/format";

export function Modals() {
  const s = useApp();
  if (!s.modal) return null;
  const ops = s.modal === "confirm" ? buildOps(s) : [];
  const cMove = ops.length;
  const cRename = ops.filter((o) => o.kind === "file" && (() => { const f = s.files.find((x) => "f" + x.id === o.id); return f && f.name !== f.old; })()).length;
  const newDirs = new Set<string>();
  if (s.modal === "confirm") ops.forEach((o) => newDirs.add(o.dstDir.toLowerCase()));
  const undoing = s.modal === "undoing";
  const p = s.prog;
  const btn2 = "height:38px;padding:0 14px;border-radius:9px;border:1px solid #2a2a2e;background:transparent;color:#ededee;font:500 13px 'Onest';cursor:pointer";
  const btn1 = "height:38px;padding:0 18px;border-radius:9px;border:none;background:#ededee;color:#0e0e0f;font:500 13px 'Onest';cursor:pointer";
  return (
    <div style={css("position:absolute;inset:0;background:rgba(5,5,6,.6);backdrop-filter:blur(6px);display:grid;place-items:center;z-index:20;animation:fadein .2s ease both")}>
      <div style={css("width:460px;border-radius:16px;background:#141416;border:1px solid #2a2a2e;box-shadow:0 30px 80px rgba(0,0,0,.6);padding:22px;display:flex;flex-direction:column;gap:16px;animation:pop .3s cubic-bezier(.2,.8,.2,1) both")}>
        {s.modal === "confirm" && (
          <>
            <h3 style={css("margin:0;font:500 20px 'Onest'")}>Применить план?</h3>
            <div style={css("display:grid;grid-template-columns:repeat(3,1fr);gap:8px")}>
              <div style={css("padding:12px;border-radius:10px;background:#0e0e0f;display:flex;flex-direction:column;gap:4px")}><span style={css("font:500 20px 'Onest'")}>{nf(cMove)}</span><span style={css("font:400 12px 'Onest';color:#8b8b90")}>перенесём</span></div>
              <div style={css("padding:12px;border-radius:10px;background:#0e0e0f;display:flex;flex-direction:column;gap:4px")}><span style={css("font:500 20px 'Onest'")}>{nf(cRename)}</span><span style={css("font:400 12px 'Onest';color:#8b8b90")}>переименуем</span></div>
              <div style={css("padding:12px;border-radius:10px;background:#0e0e0f;display:flex;flex-direction:column;gap:4px")}><span style={css("font:500 20px 'Onest'")}>{nf(newDirs.size)}</span><span style={css("font:400 12px 'Onest';color:#8b8b90")}>новых папок</span></div>
            </div>
            <div style={css("display:flex;gap:10px;padding:12px;border-radius:10px;background:oklch(0.8 0.16 155 / 0.08);border:1px solid oklch(0.8 0.16 155 / 0.25)")}>
              <span data-ms="" style={css("font-family:'Material Symbols Rounded';font-size:20px;color:oklch(0.85 0.14 155)")}>shield</span>
              <span style={css("font:400 13px/1.45 'Onest';color:#d6d6d9")}><b style={css("font-weight:500;color:oklch(0.9 0.1 155)")}>Ничего не удаляется.</b> Всё можно вернуть одной кнопкой в течение 30 дней.</span>
            </div>
            <div style={css("display:flex;justify-content:flex-end;gap:8px")}>
              <button onClick={() => set({ modal: null })} style={css(btn2)}>Вернуться к плану</button>
              <button onClick={() => startApply()} style={css(btn1)}>Применить</button>
            </div>
          </>
        )}
        {(s.modal === "applying" || undoing) && (
          <>
            <div style={css("display:flex;align-items:center;justify-content:space-between")}><h3 style={css("margin:0;font:500 20px 'Onest'")}>{undoing ? "Возвращаем файлы" : "Применяем план"}</h3><span style={css("font:500 13px 'JetBrains Mono',monospace;color:#8b8b90")}>{nf(p.n)} / {nf(p.total)}</span></div>
            <div style={css("height:6px;border-radius:3px;background:#1f1f22;overflow:hidden")}><div style={css(`height:100%;width:${p.total ? ((p.n / p.total) * 100).toFixed(1) : 0}%;background:oklch(0.8 0.16 155);transition:width .1s linear`)} /></div>
            <div style={css("height:66px;border-radius:9px;background:#0e0e0f;padding:10px 12px;display:flex;flex-direction:column;gap:4px;overflow:hidden")}>
              {p.lines.slice(0, 3).map((t, i) => <span key={i} style={css(`font:400 11px 'JetBrains Mono',monospace;color:${i === 0 ? "#ededee" : "#5d5d63"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{t}</span>)}
            </div>
            {!undoing && <div style={css("display:flex;justify-content:flex-end")}><button onClick={askStop} style={css("height:34px;padding:0 14px;border-radius:8px;border:1px solid #2a2a2e;background:transparent;color:#c9c9cd;font:500 13px 'Onest';cursor:pointer")}>Остановить</button></div>}
          </>
        )}
        {s.modal === "stop" && (
          <>
            <h3 style={css("margin:0;font:500 20px 'Onest'")}>Остановили на {nf(s.stopN)} из {nf(p.total)}</h3>
            <span style={css("font:400 14px/1.5 'Onest';color:#9a9aa0")}>Что сделать с уже перенесёнными файлами?</span>
            <div style={css("display:flex;justify-content:flex-end;gap:8px")}>
              <button onClick={() => startUndo("plan")} style={css(btn2)}>Вернуть на места</button>
              <button onClick={() => go("result", { undone: false })} style={css(btn1)}>Оставить как есть</button>
            </div>
          </>
        )}
        {s.modal === "undo" && (
          <>
            <h3 style={css("margin:0;font:500 20px 'Onest'")}>Вернуть всё как было?</h3>
            <span style={css("font:400 14px/1.5 'Onest';color:#9a9aa0")}>{nf(s.applyRes?.moved || 0)} файлов вернутся в исходные папки со старыми именами. Новые папки удалим, только если они пустые.</span>
            <div style={css("display:flex;justify-content:flex-end;gap:8px")}>
              <button onClick={() => set({ modal: null })} style={css(btn2)}>Оставить</button>
              <button onClick={() => startUndo("result")} style={css(btn1)}>Вернуть всё</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
