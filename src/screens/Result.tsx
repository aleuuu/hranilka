import { C, Ic, css, topColor } from "../ui";
import { LOCKED_DIR, newSort, set, startApply, useApp } from "../store";
import { api } from "../lib/api";
import { fmtDayMonth, nf, plural } from "../lib/format";

const KIND_C: Record<string, string> = { image: C.p, shot: C.v, doc: C.t, video: C.b, audio: C.b, manual: C.y };

export function Result() {
  const s = useApp();
  const plan = s.plan;
  const res = s.applyRes;
  const undone = s.undone;
  if (!plan) return null;

  const moved = res?.moved || 0;
  const skipped = res?.skipped || [];
  const live = s.files.filter((f) => !f.rejected);
  const tops = new Map<string, number>();
  live.forEach((f) => { const t = f.to.split("/")[0]; tops.set(t, (tops.get(t) || 0) + 1); });
  plan.locked.forEach((l) => tops.set(LOCKED_DIR, (tops.get(LOCKED_DIR) || 0) + l.n));
  const allFolders = new Set<string>();
  live.forEach((f) => { const p = f.to.split("/"); for (let i = 1; i <= p.length; i++) allFolders.add(p.slice(0, i).join("/")); });
  const nFolders = allFolders.size + (plan.locked.length ? 1 : 0);
  const resFolders = Array.from(tops.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const reasons = skipped.map((x) => x.reason);
  const topReason = reasons.sort((a, b) => reasons.filter((r) => r === b).length - reasons.filter((r) => r === a).length)[0];
  const ur = s.undoRes;

  const title = undone ? `Вернули ${nf(ur?.restored || 0)} из ${nf(ur?.total || 0)} ${plural(ur?.total || 0, ["файла", "файлов", "файлов"])}` : `Готово: ${nf(moved)} ${plural(moved, ["файл", "файла", "файлов"])} в ${nf(nFolders)} ${plural(nFolders, ["папке", "папках", "папках"])}`;
  const sub = undone
    ? ur && ur.conflicts.length ? `${ur.conflicts.length} ${plural(ur.conflicts.length, ["файл изменили", "файла изменили", "файлов изменили"])} после сортировки — их оставили как есть` : "Всё вернули на свои места"
    : skipped.length ? `${skipped.length} ${plural(skipped.length, ["пропущен", "пропущено", "пропущено"])} — ${topReason}` : "Ничего не пропущено";
  const dotsN = Math.min(84, Math.max(14, plan.rootFiles));

  return (
    <div style={css("flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:22px;padding:30px 40px;animation:fadein .4s ease both")}>
      <div style={css("display:flex;align-items:center;gap:18px")}>
        <div style={css("position:relative;width:56px;height:56px;flex:none")}>
          <span style={css(`position:absolute;inset:0;border-radius:28px;background:${undone ? "rgba(237,237,238,.35)" : "oklch(0.8 0.16 155 / 0.5)"};animation:ring 2.4s ease-out infinite`)} />
          <Ic n={undone ? "undo" : "check"} s={`position:absolute;inset:0;border-radius:28px;background:${undone ? "#ededee" : "oklch(0.8 0.16 155)"};display:grid;place-items:center;font-size:30px;color:#0e0e0f`} />
        </div>
        <div style={css("display:flex;flex-direction:column;gap:4px")}>
          <h2 style={css("margin:0;font:500 28px/1.15 'Onest';letter-spacing:-.015em")}>{title}</h2>
          <span style={css("font:400 14px 'Onest';color:#8b8b90")}>{sub}</span>
        </div>
        {!undone && skipped.length > 0 && (
          <button onClick={() => startApply(skipped.map((x) => x.id))} style={css("margin-left:auto;height:32px;padding:0 12px;border-radius:8px;border:1px solid #2a2a2e;background:#18181b;color:#ededee;font:500 12px 'Onest';cursor:pointer;display:flex;align-items:center;gap:6px;flex:none")}>
            <Ic n="refresh" s="font-size:16px" />Повторить {skipped.length} {plural(skipped.length, ["пропущенный", "пропущенных", "пропущенных"])}
          </button>
        )}
      </div>
      {!undone && (
        <div style={css("display:grid;grid-template-columns:minmax(0,0.8fr) 40px minmax(0,1.2fr);gap:12px;align-items:stretch")}>
          <div style={css("border-radius:14px;border:1px solid #222225;background:#121214;padding:16px;display:flex;flex-direction:column;gap:12px")}>
            <span style={css("font:500 12px 'Onest';color:#8b8b90")}>Было в корне «{plan.rootDisplay}»</span>
            <div style={css("display:grid;grid-template-columns:repeat(14,1fr);gap:3px")}>
              {Array.from({ length: dotsN }, (_, i) => <span key={i} style={css(`aspect-ratio:1;border-radius:2px;background:${KIND_C[plan.rootKinds[i % Math.max(1, plan.rootKinds.length)]] || C.p};opacity:.75`)} />)}
            </div>
            <span style={css("font:400 13px 'Onest';color:#d6d6d9;margin-top:auto")}>{nf(plan.rootFiles)} {plural(plan.rootFiles, ["файл", "файла", "файлов"])} вперемешку</span>
          </div>
          <div style={css("display:grid;place-items:center")}><Ic n="arrow_forward" s="font-size:22px;color:#5d5d63" /></div>
          <div style={css("border-radius:14px;border:1px solid #222225;background:#121214;padding:16px;display:flex;flex-direction:column;gap:12px")}>
            <span style={css("font:500 12px 'Onest';color:#8b8b90")}>Стало: {tops.size} {plural(tops.size, ["папка", "папки", "папок"])}</span>
            <div style={css("display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px 10px")}>
              {resFolders.map(([name, n], i) => {
                const col = name === LOCKED_DIR ? "#8b8b90" : topColor(name);
                const gray = col.startsWith("#");
                return (
                  <div key={name} style={css(`display:flex;flex-direction:column;align-items:center;gap:6px;animation:pop .45s cubic-bezier(.2,.8,.2,1) both;animation-delay:${200 + i * 70}ms`)}>
                    <div style={css("width:62px;height:46px;position:relative")}>
                      <span style={css(`position:absolute;left:0;top:0;width:26px;height:10px;border-radius:4px 4px 0 0;background:${gray ? "#55555b" : col.replace(")", " / 0.55)")}`)} />
                      <span style={css(`position:absolute;left:0;right:0;top:6px;bottom:0;border-radius:3px 7px 7px 7px;background:${gray ? "linear-gradient(#4a4a50,#3a3a3f)" : "linear-gradient(" + col.replace(")", " / 0.75)") + "," + col.replace(")", " / 0.45)") + ")"};box-shadow:inset 0 1px 0 rgba(255,255,255,.12)`)} />
                    </div>
                    <span style={css("font:500 11.5px 'Onest';color:#d6d6d9;text-align:center;line-height:1.25;word-break:break-word")}>{name}</span>
                    <span style={css("font:400 10.5px 'JetBrains Mono',monospace;color:#6d6d73")}>{nf(n)} {plural(n, ["файл", "файла", "файлов"])}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {undone && ur && ur.conflicts.length > 0 && (
        <div style={css("border-radius:14px;border:1px solid #222225;background:#121214;overflow:hidden;animation:fadein .3s ease both")}>
          <div style={css("padding:12px 16px;font:500 12px 'Onest';color:#8b8b90;border-bottom:1px solid #1c1c1f")}>Не вернули — эти файлы меняли после сортировки</div>
          {ur.conflicts.map((uc, i) => (
            <div key={i} style={css("display:flex;align-items:center;gap:10px;height:44px;padding:0 16px;border-bottom:1px solid #18181b")}>
              <Ic n={uc.icon} s="font-size:17px;color:#8b8b90" />
              <span style={css("flex:1;font:400 13px 'Onest';color:#d6d6d9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{uc.name}</span>
              <span style={css("font:400 12px 'Onest';color:#8b8b90")}>{uc.why}</span>
            </div>
          ))}
        </div>
      )}
      <div style={css("display:flex;gap:8px;flex-wrap:wrap")}>
        {!undone && (
          <>
            <button onClick={() => api.openPath(plan.dest)} style={css("height:40px;padding:0 16px;border-radius:9px;border:none;background:#ededee;color:#0e0e0f;font:500 13px 'Onest';cursor:pointer;display:flex;align-items:center;gap:7px")}><Ic n="folder_open" s="font-size:17px" />Открыть в проводнике</button>
            <button onClick={() => set({ tuneOpen: true })} style={css("height:40px;padding:0 16px;border-radius:9px;border:1px solid #2a2a2e;background:#18181b;color:#ededee;font:500 13px 'Onest';cursor:pointer;display:flex;align-items:center;gap:7px")}><Ic n="tune" s="font-size:17px" />Дотюнить</button>
            <button onClick={() => set({ modal: "undo" })} style={css("height:40px;padding:0 16px;border-radius:9px;border:1px solid #2a2a2e;background:#18181b;color:#ededee;font:500 13px 'Onest';cursor:pointer;display:flex;align-items:center;gap:7px")}><Ic n="undo" s="font-size:17px" />Отменить всё</button>
          </>
        )}
        <button onClick={newSort} style={css("height:40px;padding:0 16px;border-radius:9px;border:none;background:transparent;color:#9a9aa0;font:500 13px 'Onest';cursor:pointer")}>Разобрать другую папку</button>
      </div>
      {!undone && res?.until && (
        <span style={css("font:400 12px 'Onest';color:#5d5d63;display:flex;align-items:center;gap:6px")}><Ic n="shield" s="font-size:15px;color:oklch(0.85 0.14 155)" />Вернуть всё можно до {fmtDayMonth(res.until)} — из этого экрана или из «Истории»</span>
      )}
    </div>
  );
}
