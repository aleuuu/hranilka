import { useEffect, useRef, useState } from "react";
import { Ic, css, useTicker } from "../ui";
import { gpuResume, gpuWait, set, showPlanNow, startAnalysis, toggleAnalysisPause, useApp } from "../store";
import { api, fileSrc } from "../lib/api";
import type { CurrentFile } from "../lib/types";
import { fmtEta, fmtSec, nf, plural } from "../lib/format";

const CH = 20; // мс на символ «мыслей» — как в макете

const partsOf = (c: CurrentFile): [string, string, number][] => [
  ["Тип", c.kind, 500], ["Что на нём", c.desc, 400], ["Тема", c.topic, 400], ["Назову", c.name, 500],
];
const lenOf = (c: CurrentFile) => partsOf(c).reduce((a, [, v]) => a + v.length, 0);

export function Analysis() {
  const s = useApp();
  const an = s.an;
  const t = useTicker(true, 60);

  // Очередь показа: готовые описания печатаются по одному; если модель обгоняет — пропускаем к свежим.
  const [shown, setShown] = useState<CurrentFile | null>(null);
  const shownAt = useRef(0);
  useEffect(() => {
    const rec = an.recent;
    if (!rec.length) return;
    const now = performance.now();
    if (!shown) { setShown(rec[rec.length - 1]); shownAt.current = now; return; }
    const idx = rec.findIndex((x) => x.id === shown.id);
    const newer = idx < 0 ? rec.length : rec.length - 1 - idx;
    if (!newer) return;
    const typed = (now - shownAt.current) / CH >= lenOf(shown) + 45;
    if (typed || an.paused) {
      const next = newer > 2 ? rec[rec.length - 1] : rec[idx < 0 ? rec.length - 1 : idx + 1];
      setShown(next);
      shownAt.current = now;
    }
  }, [t, an.recentSeq]);

  const busy = !!s.gpu?.busy;
  const gpuApp = (s.gpu?.app || "").replace(/\s*\([^)]*\)\s*$/, "").trim() || s.gpu?.app;
  const paused = an.paused || (busy && s.gpuChoice === "wait");
  const factor = an.baseline && an.secPerFile ? an.secPerFile / an.baseline : null;
  const slowText = factor && factor >= 1.4 ? `анализ замедлился в ${Math.round(factor)} ${plural(Math.round(factor), ["раз", "раза", "раз"])}` : "анализ может идти медленнее";
  const left = paused ? 9999 : Math.floor((performance.now() - shownAt.current) / CH);
  let rest = left, active = -1;
  const thought = shown ? partsOf(shown).map(([label, val, weight], i) => {
    const vis = val.slice(0, Math.max(0, rest));
    if (rest > 0 && rest < val.length && active < 0) active = i;
    rest -= val.length;
    return { label, val: vis, weight, op: vis ? 1 : 0.3, c: i === 3 ? "oklch(0.88 0.12 155)" : "#ededee", caret: false };
  }) : partsOf({ id: 0, old: "", thumb: null, thumbLabel: "", kind: "", desc: "", topic: "", name: "" }).map(([label, , weight]) => ({ label, val: "", weight, op: 0.3, c: "#ededee", caret: false }));
  if (shown) { if (active >= 0) thought[active].caret = true; else if (!paused) thought[3].caret = true; }

  const total = an.total || 0;
  const remain = Math.max(0, total - an.done) * (an.secPerFile || 0);
  const eta = paused ? "на паузе" : an.secPerFile ? "≈ " + fmtEta(remain) : "—";
  const planning = an.stage >= 2;
  const stages = [["Сканирование"], ["Понимание файлов"], ["Группировка"], ["План структуры"]].map(([l], i) => {
    const st = i < an.stage ? 2 : i === an.stage ? 1 : 0;
    return { l, st, sep: i < 3 };
  });
  const cur = shown;
  const looking = !cur && an.looking;

  return (
    <div style={css("flex:1;min-height:0;display:flex;flex-direction:column;animation:fadein .4s ease both")}>
      <div style={css("flex:1;min-height:0;display:flex;flex-direction:column;gap:14px;padding:16px 22px;overflow:hidden")}>
        {an.error && (
          <div style={css("display:flex;align-items:center;gap:12px;padding:10px 12px 10px 14px;border-radius:11px;background:oklch(0.7 0.15 25 / 0.08);border:1px solid oklch(0.7 0.15 25 / 0.3);animation:fadein .3s ease both")}>
            <Ic n="error" s="font-size:20px;color:oklch(0.78 0.15 25)" />
            <span style={css("flex:1;font:400 13px 'Onest';color:#d6d6d9")}><b style={css("font-weight:500;color:oklch(0.82 0.13 25)")}>Анализ остановился</b> — {an.error}</span>
            <button onClick={() => { set({ an: { ...an, error: null } }); startAnalysis(); }} style={css("height:30px;padding:0 11px;border-radius:7px;border:1px solid #2e2e32;background:#1c1c1f;color:#ededee;font:500 12px 'Onest';cursor:pointer")}>Повторить</button>
          </div>
        )}
        {busy && !s.gpuChoice && (
          <div style={css("display:flex;align-items:center;gap:12px;padding:10px 12px 10px 14px;border-radius:11px;background:oklch(0.84 0.13 85 / 0.08);border:1px solid oklch(0.84 0.13 85 / 0.28);animation:fadein .3s ease both")}>
            <Ic n="sports_esports" s="font-size:20px;color:oklch(0.86 0.13 85)" />
            <span style={css("flex:1;font:400 13px 'Onest';color:#d6d6d9")}><b style={css("font-weight:500;color:oklch(0.88 0.12 85)")}>Видеокарта занята ({gpuApp})</b> — {slowText}</span>
            <button onClick={gpuWait} style={css("height:30px;padding:0 11px;border-radius:7px;border:1px solid #2e2e32;background:#1c1c1f;color:#ededee;font:500 12px 'Onest';cursor:pointer")}>Пауза до выхода из игры</button>
            <button onClick={() => set({ gpuChoice: "slow" })} style={css("height:30px;padding:0 11px;border-radius:7px;border:none;background:transparent;color:#9a9aa0;font:500 12px 'Onest';cursor:pointer")}>Продолжить медленно</button>
          </div>
        )}
        {busy && s.gpuChoice === "wait" && (
          <div style={css("display:flex;align-items:center;gap:12px;padding:10px 12px 10px 14px;border-radius:11px;background:#141416;border:1px solid #26262a;animation:fadein .3s ease both")}>
            <Ic n="pause_circle" s="font-size:20px;color:#c9c9cd" />
            <span style={css("flex:1;font:400 13px 'Onest';color:#d6d6d9")}><b style={css("font-weight:500;color:#ededee")}>Пауза: видеокарта занята ({gpuApp})</b> — продолжу сам, когда игра закроется</span>
            <button onClick={gpuResume} style={css("height:30px;padding:0 11px;border-radius:7px;border:1px solid #2e2e32;background:#1c1c1f;color:#ededee;font:500 12px 'Onest';cursor:pointer")}>Продолжить сейчас</button>
          </div>
        )}
        <div style={css("display:flex;align-items:center;gap:8px")}>
          {stages.map((sg) => (
            <div key={sg.l} style={css(`display:flex;align-items:center;gap:8px;flex:${sg.sep ? "1" : "0 0 auto"}`)}>
              <div style={css("display:flex;align-items:center;gap:8px;white-space:nowrap")}>
                <span style={css(`width:20px;height:20px;border-radius:10px;display:grid;place-items:center;background:${sg.st === 2 ? "#ededee" : "transparent"};border:1px solid ${sg.st === 2 ? "#ededee" : sg.st === 1 ? "oklch(0.8 0.16 155)" : "#2e2e33"};position:relative`)}>
                  {sg.st === 2 && <Ic n="check" s="font-size:14px;color:#0e0e0f" />}
                  {sg.st === 1 && <span style={css("width:6px;height:6px;border-radius:3px;background:oklch(0.8 0.16 155);animation:pulse 1.4s ease-in-out infinite")} />}
                </span>
                <span style={css(`font:500 13px 'Onest';color:${sg.st === 0 ? "#5d5d63" : "#ededee"}`)}>{sg.l}</span>
              </div>
              {sg.sep && <span style={css(`flex:1;height:1px;background:${sg.st === 2 ? "#4a4a50" : "#222225"};min-width:16px`)} />}
            </div>
          ))}
        </div>
        <div style={css("display:flex;align-items:flex-end;gap:16px")}>
          <div style={css("display:flex;align-items:baseline;gap:10px")}>
            <span style={css("font:400 50px/1 'Onest';letter-spacing:-.03em")}>{nf(an.done)}</span>
            <span style={css("font:400 16px 'Onest';color:#6d6d73")}>из {nf(total)} {plural(total, ["файла", "файлов", "файлов"])}</span>
          </div>
          <div style={css("margin-left:auto;display:flex;gap:22px;padding-bottom:4px")}>
            <div style={css("display:flex;flex-direction:column;gap:3px;align-items:flex-end")}><span style={css("font:400 11px 'Onest';color:#6d6d73")}>Осталось</span><span style={css("font:500 14px 'JetBrains Mono',monospace")}>{planning ? "строю план" : eta}</span></div>
            <div style={css("display:flex;flex-direction:column;gap:3px;align-items:flex-end")}><span style={css("font:400 11px 'Onest';color:#6d6d73")}>Скорость</span><span style={css(`font:500 14px 'JetBrains Mono',monospace;color:${busy ? "oklch(0.88 0.12 85)" : "#ededee"}`)}>{fmtSec(an.secPerFile)}</span></div>
            <div style={css("display:flex;flex-direction:column;gap:3px;align-items:flex-end")}><span style={css("font:400 11px 'Onest';color:#6d6d73")}>Не прочитать</span><span style={css("font:500 14px 'JetBrains Mono',monospace")}>{an.errors}</span></div>
          </div>
        </div>
        <div style={css("height:6px;border-radius:3px;background:#18181b;overflow:hidden")}><div style={css(`height:100%;width:${total ? ((an.done / total) * 100).toFixed(1) : 0}%;background:linear-gradient(90deg,oklch(0.8 0.16 155 / 0.55),oklch(0.8 0.16 155));border-radius:3px;transition:width .6s cubic-bezier(.2,.8,.2,1)`)} /></div>
        <div style={css("flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:14px")}>
          <div style={css("border-radius:14px;border:1px solid #222225;background:#121214;padding:14px;display:flex;gap:14px;min-height:0")}>
            <div style={css("width:180px;flex:none;border-radius:10px;position:relative;overflow:hidden;background:repeating-linear-gradient(135deg,#17171a 0 8px,#1b1b1e 8px 16px);display:flex;align-items:flex-end;padding:8px")}>
              {fileSrc(cur?.thumb || (looking ? looking.thumb : null)) && <img src={fileSrc(cur?.thumb || (looking ? looking.thumb : null))} alt="" style={css("position:absolute;inset:0;width:100%;height:100%;object-fit:cover")} />}
              <span style={css("position:relative;font:400 10px 'JetBrains Mono',monospace;color:#6d6d73;background:#0e0e0f;padding:3px 6px;border-radius:4px")}>{cur?.thumbLabel || (looking ? looking.kind : "жду первый файл")}</span>
              <div style={css(`position:absolute;left:0;right:0;height:2px;background:oklch(0.8 0.16 155);box-shadow:0 0 14px 3px oklch(0.8 0.16 155 / 0.45);animation:scan 1.8s cubic-bezier(.45,0,.55,1) infinite alternate;opacity:${paused || planning ? 0 : 1}`)} />
            </div>
            <div style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:10px")}>
              <div style={css("display:flex;align-items:center;gap:8px")}><span style={css("font:500 12px 'Onest';color:#6d6d73;flex:none")}>Сейчас смотрю</span><span style={css("font:400 12px 'JetBrains Mono',monospace;color:#9a9aa0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{cur?.old || (looking ? looking.old : "")}</span></div>
              {thought.map((th) => (
                <div key={th.label} style={css(`display:flex;flex-direction:column;gap:2px;opacity:${th.op};transition:opacity .2s`)}>
                  <span style={css("font:400 11px 'Onest';color:#5d5d63")}>{th.label}</span>
                  <span style={css(`font:${th.weight} 14px/1.4 'Onest';color:${th.c}`)}>{th.val}{th.caret && <span style={css("display:inline-block;width:2px;height:15px;background:oklch(0.8 0.16 155);vertical-align:-2px;margin-left:1px;animation:blink .9s step-end infinite")} />}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={css("border-radius:14px;border:1px solid #222225;background:#121214;display:flex;flex-direction:column;min-height:0;overflow:hidden")}>
            <div style={css("height:38px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid #1c1c1f")}><span style={css("font:500 12px 'Onest';color:#8b8b90")}>Уже разобрано</span><span style={css("font:400 11px 'Onest';color:#5d5d63")}>было → станет</span></div>
            <div style={css("flex:1;overflow:hidden;display:flex;flex-direction:column")}>
              {an.feed.map((fd, i) => (
                <div key={fd.id + ":" + i} style={css(`display:flex;align-items:center;gap:10px;min-height:42px;padding:6px 14px;border-bottom:1px solid #18181b;background:${i === 0 ? "oklch(0.8 0.16 155 / 0.06)" : "transparent"};opacity:${Math.max(0.35, 1 - i * 0.08)}`)}>
                  <Ic n={fd.icon} s={`font-size:17px;color:${fd.c}`} />
                  <div style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:1px")}>
                    <span style={css("font:400 11px 'JetBrains Mono',monospace;color:#5d5d63;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{fd.old}</span>
                    <span style={css("font:400 13px 'Onest';color:#d6d6d9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{fd.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={css("display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-height:30px")}>
          <span style={css("font:500 12px 'Onest';color:#6d6d73;margin-right:2px")}>Нашлись темы</span>
          {an.themes.map((tm) => (
            <span key={tm.label} style={css("height:28px;padding:0 10px;border-radius:14px;background:#141416;border:1px solid #26262a;display:inline-flex;align-items:center;gap:7px;font:400 12px 'Onest';color:#d6d6d9;animation:pop .4s cubic-bezier(.2,.8,.2,1) both")}>
              <span style={css(`width:6px;height:6px;border-radius:3px;background:${tm.c}`)} />{tm.label}<span style={css("font-family:'JetBrains Mono',monospace;color:#8b8b90")}>{tm.n}</span>
            </span>
          ))}
        </div>
      </div>
      <div style={css("height:62px;flex:none;border-top:1px solid #1c1c1f;display:flex;align-items:center;gap:10px;padding:0 22px")}>
        <Ic n="shield" s="font-size:18px;color:oklch(0.85 0.14 155)" />
        <span style={css("font:400 13px 'Onest';color:#8b8b90;flex:1")}>Файлы пока только читаются, ничего не перемещается</span>
        <button onClick={() => api.hideToTray()} style={css("height:36px;padding:0 12px;border-radius:9px;border:none;background:transparent;color:#9a9aa0;font:500 13px 'Onest';cursor:pointer;display:flex;align-items:center;gap:6px")}><Ic n="south_east" s="font-size:17px" />Свернуть в трей</button>
        <button onClick={toggleAnalysisPause} disabled={planning} style={css(`height:36px;padding:0 14px;border-radius:9px;border:1px solid #2a2a2e;background:#18181b;color:#ededee;font:500 13px 'Onest';cursor:pointer;display:flex;align-items:center;gap:6px;opacity:${planning ? 0.4 : 1}`)}><Ic n={an.paused ? "play_arrow" : "pause"} s="font-size:17px" />{an.paused ? "Продолжить" : "Пауза"}</button>
        <button onClick={showPlanNow} disabled={planning || an.done === 0} style={css(`height:36px;padding:0 16px;border-radius:9px;border:none;background:#ededee;color:#0e0e0f;font:500 13px 'Onest';cursor:pointer;opacity:${planning || an.done === 0 ? 0.45 : 1};display:flex;align-items:center;gap:8px`)}>
          {planning && <span style={css("width:13px;height:13px;border-radius:50%;border:2px solid #b9b9be;border-top-color:#0e0e0f;animation:spin .8s linear infinite")} />}
          {planning ? "Строю план…" : "Показать план по разобранному"}
        </button>
      </div>
    </div>
  );
}
