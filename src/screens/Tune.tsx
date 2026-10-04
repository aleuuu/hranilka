import { useEffect, useRef } from "react";
import { B, css } from "../ui";
import { selectVersion, sendTune, set, useApp } from "../store";

const CHIPS = ["Скриншоты по проектам положи в папки проектов", "Имена покороче", "Убери уровень с годами", "Фото без даты сложи в одну папку"];

export function TuneDrawer() {
  const s = useApp();
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [s.msgs.length, s.tuneBusy]);
  return (
    <div style={css("position:absolute;top:0;right:0;bottom:0;width:372px;background:#111113;border-left:1px solid #26262a;box-shadow:-30px 0 60px rgba(0,0,0,.45);display:flex;flex-direction:column;z-index:6;animation:fadein .3s cubic-bezier(.2,.8,.2,1) both")}>
      <div style={css("height:52px;flex:none;display:flex;align-items:center;gap:8px;padding:0 10px 0 16px;border-bottom:1px solid #1f1f22")}>
        <span style={css("font:500 14px 'Onest';flex:none")}>Дотюнить план</span>
        <div style={css("display:flex;gap:4px;margin-left:8px;overflow:auto")}>
          {s.versions.map((_, i) => {
            const n = i + 1, on = n === s.verSel;
            return <button key={n} onClick={() => selectVersion(n)} style={css(`height:24px;padding:0 8px;border-radius:6px;border:1px solid ${on ? "#3a3a3f" : "#222225"};background:${on ? "#26262a" : "transparent"};color:${on ? "#ededee" : "#6d6d73"};font:500 11px 'JetBrains Mono',monospace;cursor:pointer;flex:none`)}>v{n}</button>;
          })}
        </div>
        <button onClick={() => set({ tuneOpen: false })} style={css("margin-left:auto;width:32px;height:32px;border-radius:8px;border:none;background:transparent;color:#8b8b90;cursor:pointer;font-family:'Material Symbols Rounded';font-size:19px;flex:none")}><span data-ms="">close</span></button>
      </div>
      <div ref={list} style={css("flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px")}>
        {s.msgs.map((m, i) => m.ai ? (
          <div key={i} style={css("align-self:flex-start;max-width:90%;display:flex;flex-direction:column;gap:8px;animation:fadein .3s ease both")}>
            <div style={css("padding:10px 12px;border-radius:4px 12px 12px 12px;background:#18181b;border:1px solid #222225;font:400 13px/1.5 'Onest';color:#d6d6d9;user-select:text")}>{m.text}</div>
            {m.diff && (
              <div style={css("display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:9px;background:oklch(0.8 0.16 155 / 0.07);border:1px solid oklch(0.8 0.16 155 / 0.22);font:400 12px 'Onest';color:#c9c9cd")}><span style={css("font:500 11px 'JetBrains Mono',monospace;color:oklch(0.85 0.14 155)")}>{m.ver}</span>{m.diff}</div>
            )}
            {!!m.opts?.length && (
              <div style={css("display:flex;flex-wrap:wrap;gap:6px")}>
                {m.opts.map((o) => <B as="button" key={o} onClick={() => sendTune(o)} s="height:28px;padding:0 10px;border-radius:14px;border:1px solid #2e2e33;background:#141416;color:#ededee;font:500 12px 'Onest';cursor:pointer" h="background:#1f1f22">{o}</B>)}
              </div>
            )}
          </div>
        ) : (
          <div key={i} style={css("align-self:flex-end;max-width:85%;padding:9px 12px;border-radius:12px 4px 12px 12px;background:#ededee;color:#0e0e0f;font:400 13px/1.45 'Onest';animation:fadein .25s ease both;user-select:text")}>{m.text}</div>
        ))}
        {s.tuneBusy && (
          <div style={css("align-self:flex-start;display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:4px 12px 12px 12px;background:#18181b;border:1px solid #222225;font:400 13px 'Onest';color:#8b8b90")}>Пересчитываю план
            <span style={css("display:flex;gap:3px")}>
              <span style={css("width:4px;height:4px;border-radius:2px;background:#c9c9cd;animation:dots 1.2s infinite")} />
              <span style={css("width:4px;height:4px;border-radius:2px;background:#c9c9cd;animation:dots 1.2s .2s infinite")} />
              <span style={css("width:4px;height:4px;border-radius:2px;background:#c9c9cd;animation:dots 1.2s .4s infinite")} />
            </span>
          </div>
        )}
      </div>
      <div style={css("flex:none;padding:12px;border-top:1px solid #1f1f22;display:flex;flex-direction:column;gap:10px")}>
        <div style={css("display:flex;flex-wrap:wrap;gap:6px")}>
          {CHIPS.map((l) => <B as="button" key={l} onClick={() => sendTune(l)} s="height:26px;padding:0 9px;border-radius:13px;border:1px solid #26262a;background:transparent;color:#9a9aa0;font:400 11.5px 'Onest';cursor:pointer" h="color:#ededee;border-color:#3a3a3f">{l}</B>)}
        </div>
        <div style={css("display:flex;gap:8px;align-items:flex-end")}>
          <B as="textarea" value={s.tuneInput} onChange={(e: any) => set({ tuneInput: e.target.value })}
            onKeyDown={(e: any) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTune(s.tuneInput); } }}
            placeholder="Что поправить?" s="flex:1;height:60px;resize:none;border-radius:10px;border:1px solid #2a2a2e;background:#18181b;color:#ededee;font:400 13px/1.45 'Onest';padding:9px 11px;outline:none" f="border-color:#4a4a50" />
          <button onClick={() => sendTune(s.tuneInput)} style={css("width:38px;height:38px;border-radius:10px;border:none;background:#ededee;color:#0e0e0f;cursor:pointer;font-family:'Material Symbols Rounded';font-size:19px")}><span data-ms="">arrow_upward</span></button>
        </div>
        <span style={css("font:400 11px 'Onest';color:#5d5d63")}>Пересчитываем только план — файлы заново не анализируются</span>
      </div>
    </div>
  );
}
