import { B, C, Ic, css } from "../ui";
import { currentModel, go, useApp } from "../store";
import { MODELS } from "../lib/types";
import { fmtSec, fmtShort } from "../lib/format";
import { Start } from "./Start";
import { Analysis } from "./Analysis";
import { Plan } from "./Plan";
import { Result } from "./Result";
import { TuneDrawer } from "./Tune";

const SIDE: [string, string, string, boolean][] = [
  ["start", "folder_open", "Разобрать", false],
  ["history", "history", "История", true],
  ["models", "memory", "Модели", true],
  ["settings", "settings", "Настройки", true],
  ["watch", "visibility", "Следить за папкой", true],
];

const HEAD: Record<string, [string, string]> = {
  start: ["folder_open", "Новая сортировка"], analysis: ["auto_awesome", "Анализ"], plan: ["account_tree", "План"], result: ["task_alt", "Результат"],
};

export function Shell() {
  const s = useApp();
  const sc = s.screen;
  const wide = sc !== "plan";
  const model = currentModel(s);
  const spf = s.secPerFile && s.secPerFile > 0 ? s.secPerFile : MODELS[model].secPerFile;
  const H = HEAD[sc] || ["", ""];
  const si = ({ start: 0, analysis: 1, plan: 2, result: 3 } as Record<string, number>)[sc] ?? 0;
  const hasFolder = sc === "start" ? !!s.folder : true;
  const folderPath = sc === "start" ? s.folder || "" : s.plan?.root || s.folder || "";
  const history = s.boot?.history || [];

  return (
    <div style={css("flex:1;display:flex;min-height:0;position:relative")}>
      <div style={css(`width:${wide ? 212 : 58}px;flex:none;background:#0b0b0c;border-right:1px solid #1c1c1f;display:flex;flex-direction:column;padding:12px 10px;gap:4px;transition:width .3s cubic-bezier(.2,.8,.2,1);overflow:hidden`)}>
        {SIDE.map(([k, ic, label, later]) => {
          const a = k === "start";
          return (
            <B as="button" key={k} title={later ? label + " — появится позже" : label} disabled={later}
              onClick={a ? () => { if (sc !== "analysis") go("start"); } : undefined}
              s={`height:36px;display:flex;align-items:center;gap:10px;padding:0 9px;border-radius:8px;border:1px solid ${a ? "#26262a" : "transparent"};background:${a ? "#18181b" : "transparent"};color:${a ? "#ededee" : later ? "#5d5d63" : "#9a9aa0"};font:400 14px 'Onest';cursor:${later ? "default" : "pointer"};white-space:nowrap;text-align:left`}
              h={later ? undefined : "background:#18181b"}>
              <Ic n={ic} s="font-size:19px;flex:none" />
              {wide && <><span style={css("flex:1")}>{label}</span>{later && <span style={css("font:400 10px 'JetBrains Mono',monospace;color:#4d4d53")}>позже</span>}</>}
            </B>
          );
        })}
        {wide && history.length > 0 && (
          <>
            <div style={css("height:1px;background:#1c1c1f;margin:10px 4px")} />
            <span style={css("font:500 11px 'Onest';color:#5d5d63;padding:4px 10px")}>Разобранные папки</span>
            {history.slice(0, 4).map((h, i) => (
              <div key={h.id} title={h.root} style={css("height:34px;display:flex;align-items:center;gap:10px;padding:0 10px;font:400 13px 'Onest';color:#c9c9cd")}>
                <Ic n="folder" s={`font-size:18px;color:${i === 0 ? C.b : "#5d5d63"};font-variation-settings:'FILL' 1`} />
                <span style={css("white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{h.name}</span>
                <span style={css("margin-left:auto;font:400 11px 'JetBrains Mono',monospace;color:#5d5d63;flex:none")}>{fmtShort(h.date)}</span>
              </div>
            ))}
          </>
        )}
        <div style={css("margin-top:auto")}>
          {wide ? (
            <div style={css("padding:12px;border-radius:12px;background:#121214;border:1px solid #1f1f22;display:flex;flex-direction:column;gap:8px")}>
              <div style={css("display:flex;align-items:center;gap:8px")}>
                <span style={css("position:relative;width:8px;height:8px")}><span style={css("position:absolute;inset:0;border-radius:4px;background:oklch(0.8 0.16 155)")} /><span style={css("position:absolute;inset:0;border-radius:4px;background:oklch(0.8 0.16 155);animation:ring 2.2s ease-out infinite")} /></span>
                <span style={css("font:500 13px 'Onest'")}>Модель «{MODELS[model].name}»</span>
              </div>
              <span style={css("font:400 12px/1.4 'Onest';color:#8b8b90")}>Работает на этом компьютере. Интернет не нужен.</span>
              <span style={css("font:400 11px 'JetBrains Mono',monospace;color:#5d5d63")}>{MODELS[model].sizeGb} ГБ · ~{fmtSec(spf).replace(" с/файл", "")} с/файл</span>
            </div>
          ) : (
            <div title="Модель работает локально" style={css("height:36px;display:grid;place-items:center")}>
              <span style={css("position:relative;width:8px;height:8px")}><span style={css("position:absolute;inset:0;border-radius:4px;background:oklch(0.8 0.16 155)")} /><span style={css("position:absolute;inset:0;border-radius:4px;background:oklch(0.8 0.16 155);animation:ring 2.2s ease-out infinite")} /></span>
            </div>
          )}
        </div>
      </div>

      <div style={css("flex:1;min-width:0;display:flex;flex-direction:column;position:relative")}>
        <div style={css("height:52px;flex:none;display:flex;align-items:center;gap:14px;padding:0 22px;border-bottom:1px solid #1c1c1f")}>
          <Ic n={H[0]} s="font-size:19px;color:#8b8b90" />
          <span style={css("font:500 15px 'Onest';color:#d6d6d9;flex:none")}>{H[1]}</span>
          {hasFolder && <span title={folderPath} style={css("font:400 12px 'JetBrains Mono',monospace;color:#5d5d63;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0")}>{folderPath}</span>}
          <div style={css("margin-left:auto;display:flex;align-items:center;gap:4px;flex:none")}>
            {([["Папка", "folder"], ["Анализ", "auto_awesome"], ["План", "account_tree"], ["Готово", "task_alt"]] as const).map(([l, ic], i) => (
              <div key={l} style={css("display:flex;align-items:center;gap:4px")}>
                <span style={css(`height:26px;padding:0 10px;border-radius:13px;display:flex;align-items:center;gap:6px;font:500 12px 'Onest';background:${i === si ? "#1f1f22" : "transparent"};color:${i === si ? "#ededee" : i < si ? "#8b8b90" : "#4d4d53"}`)}>
                  <Ic n={i < si ? "check" : ic} s="font-size:14px" />{l}
                </span>
                {i < 3 && <span style={css("width:12px;height:1px;background:#2a2a2e")} />}
              </div>
            ))}
          </div>
        </div>
        {sc === "start" && <Start />}
        {sc === "analysis" && <Analysis />}
        {sc === "plan" && <Plan />}
        {sc === "result" && <Result />}
        {s.tuneOpen && (sc === "plan" || sc === "result") && <TuneDrawer />}
      </div>
    </div>
  );
}
