import { useEffect } from "react";
import type { ReactElement } from "react";
import { B, C, css, useRerenderUntil } from "../ui";
import {
  applyPaste, applyScan, clearFolder, estimateSec, loadQuick, rescan, selectFolder, set, setMode, startAnalysis, stAddExamples, stAddSub,
  stAddTop, stDelete, stEdit, stRemoveExample, useApp, withUndo,
} from "../store";
import type { AppState } from "../store";
import type { SNode } from "../lib/types";
import { api } from "../lib/api";
import { fmtDur, fmtShort, nf, plural } from "../lib/format";
import { MANUAL, SAUTO, STYPES, autoNote, fileName, stColor, stGhost, stNameEx, stSum } from "../structure";

const TPL: [string, string][] = [
  ["По проектам", "скриншоты и макеты по проектам"], ["По годам", "фото по годам и событиям"], ["По типу файлов", "документы по типу"],
  ["Семейный архив", "семейные фото по годам и людям"], ["Учёба", "учебные материалы по предметам"], ["Для дизайнера", "референсы, макеты и экспорты отдельно"],
];

const SEG = "display:flex;padding:2px;border-radius:8px;background:#0b0b0c;border:1px solid #1f1f22";
const segBtn = (on: boolean, h = 28, f = "12.5px") => css(`height:${h}px;padding:0 ${h > 26 ? 11 : 10}px;border-radius:6px;border:none;background:${on ? "#26262a" : "transparent"};color:${on ? "#ededee" : "#8b8b90"};font:500 ${f} 'Onest';cursor:pointer;white-space:nowrap;transition:background .2s,color .2s`);
const MS = (n: string, s = "") => <span style={css("font-family:'Material Symbols Rounded';line-height:1;" + s)}>{n}</span>;

/* ───────── карточка выбранной папки ───────── */
function FolderCard({ s }: { s: AppState }) {
  useRerenderUntil(s.scanDoneAt + 850);
  const k = s.scan ? Math.min(1, (performance.now() - s.scanDoneAt) / 800) : 0;
  const e = 1 - Math.pow(1 - k, 3);
  const sc = s.scan;
  const ready = !!sc && k >= 1 && !s.scanning;
  const mine = s.mode === "mine";
  const subdirs = sc?.subdirs || [];
  const tops = new Set(s.tree.map((n) => n.name.trim().toLowerCase()));
  const manualDirs = mine ? subdirs.filter((d) => !tops.has(d.name.toLowerCase())).length : subdirs.filter((d) => d.kind !== "target").length;
  const bd = sc?.breakdown;
  const cats: [string, number, string][] = bd ? ([
    ["html", bd.html, C.v], ["установщики и архивы", bd.instArch, "#8b8b90"], ["документы", bd.docs, C.t],
    ["видео и музыка", bd.media, C.b], ["картинки", bd.images, C.p], ["папки и прочее", bd.other + subdirs.filter((d) => d.kind !== "target").length, C.y],
  ] as [string, number, string][]).filter((c) => c[1] > 0) : [];
  const allN = cats.reduce((a, c) => a + c[1], 0);
  const big = mine ? (sc?.allFiles || 0) : (sc?.total || 0);
  const caption = s.scanning || !sc || k < 1 ? "сканирую…"
    : mine ? plural(big, ["файл", "файла", "файлов"]) + (manualDirs ? ` и ${manualDirs} ${plural(manualDirs, ["папка", "папки", "папок"])}` : "")
    : big ? plural(big, ["личный файл", "личных файла", "личных файлов"]) : "личных файлов не нашлось";
  const locked = sc?.lockedCount || 0, skippedFiles = sc?.skippedFiles || 0;
  const skipLine = locked || skippedFiles
    ? [locked ? `${locked} ${plural(locked, ["папку-проект", "папки-проекта", "папок-проектов"])} не тронем` : "", skippedFiles ? `${nf(skippedFiles)} ${plural(skippedFiles, ["программный файл", "программных файла", "программных файлов"])} пропустим` : ""].filter(Boolean).join(" · ")
    : "Пропускать нечего — все файлы личные";
  const partial = sc?.partial || 0;

  return (
    <div style={css("border-radius:14px;border:1px solid #222225;background:#121214;padding:16px;display:flex;flex-direction:column;gap:14px;animation:fadein .3s ease both")}>
      <div style={css("display:flex;align-items:center;gap:12px")}>
        <span style={css("width:40px;height:40px;border-radius:10px;background:#1b1b1e;display:grid;place-items:center;flex:none")}>{MS("folder", "font-size:22px;color:oklch(0.74 0.15 255);font-variation-settings:'FILL' 1")}</span>
        <div style={css("flex:1;display:flex;flex-direction:column;gap:2px;min-width:0")}>
          <span style={css("font:500 15px 'Onest'")}>{s.folderName}</span>
          <span style={css("font:400 11px 'JetBrains Mono',monospace;color:#6d6d73;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{s.folder}</span>
        </div>
        <button onClick={clearFolder} style={css("height:30px;padding:0 10px;border-radius:7px;border:1px solid #2a2a2e;background:transparent;color:#9a9aa0;font:500 12px 'Onest';cursor:pointer")}>Сменить</button>
      </div>
      {s.scanErr ? (
        <div style={css("display:flex;gap:8px;padding:10px 12px;border-radius:9px;background:oklch(0.7 0.15 25 / 0.08);border:1px solid oklch(0.7 0.15 25 / 0.3);font:400 13px 'Onest';color:#d6d6d9")}>{MS("error", "font-size:18px;color:oklch(0.78 0.15 25)")}{s.scanErr}</div>
      ) : (
        <>
          <div style={css("display:flex;align-items:baseline;gap:8px;flex-wrap:wrap")}>
            <span style={css("font:500 34px/1 'Onest';letter-spacing:-.02em")}>{nf(big * e)}</span>
            <span style={css("font:400 14px 'Onest';color:#8b8b90")}>{caption}</span>
          </div>
          <div style={css("display:flex;height:10px;gap:3px")}>
            {cats.length ? cats.map(([l, n, c]) => <span key={l} style={css(`width:${((n / allN) * 100 * e).toFixed(1)}%;min-width:4px;border-radius:3px;background:${c};transition:width .2s`)} />) : <span style={css("flex:1;border-radius:3px;background:#1e1e21")} />}
          </div>
          {cats.length > 0 && (
            <div style={css("display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px 14px")}>
              {cats.map(([l, n, c]) => (
                <div key={l} style={css("display:flex;align-items:center;gap:7px;min-width:0;font:400 12.5px 'Onest';color:#8b8b90")}>
                  <i style={css(`width:8px;height:8px;border-radius:2px;flex:none;background:${c}`)} />
                  <span style={css("line-height:1.3")}>{l}</span>
                  <b style={css("margin-left:auto;font:500 12.5px 'JetBrains Mono',monospace;color:#d6d6d9")}>{nf(n * e)}</b>
                </div>
              ))}
            </div>
          )}
          {ready && (
            <div style={css("display:flex;flex-direction:column;gap:10px;animation:fadein .3s ease both")}>
              {(sc?.total || 0) > 0 && (
                <div style={css("display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;background:#0e0e0f;font:400 13px 'Onest';color:#c9c9cd")}>
                  {MS("schedule", "font-size:18px;color:#8b8b90")}Анализ на этом компьютере займёт <b style={css("font-weight:500;color:#ededee")}>≈ {fmtDur(estimateSec(sc?.total || 0))}</b>
                </div>
              )}
              {mine ? (
                <>
                  {partial > 0 && <div style={css("display:flex;align-items:flex-start;gap:8px;font:400 13px/1.45 'Onest';color:#9a9aa0")}>{MS("block", "font-size:18px")}<span>{partial} {plural(partial, ["недокачанный файл", "недокачанных файла", "недокачанных файлов"])} не трогаем — иначе сломается загрузка в браузере</span></div>}
                  {manualDirs > 0 && <div style={css("display:flex;align-items:flex-start;gap:8px;font:400 13px/1.45 'Onest';color:#9a9aa0")}>{MS("folder_special", "font-size:18px")}<span>{manualDirs} {plural(manualDirs, ["вложенная папка уйдёт", "вложенные папки уйдут", "вложенных папок уйдут"])} в «{MANUAL}» целиком</span></div>}
                </>
              ) : (
                <>
                  <button onClick={() => sc && sc.skipped.length && set({ skippedOpen: !s.skippedOpen })} style={css(`display:flex;align-items:center;gap:8px;background:none;border:none;padding:0;color:#9a9aa0;font:400 13px 'Onest';cursor:${sc?.skipped.length ? "pointer" : "default"};text-align:left`)}>
                    {MS("lock", "font-size:18px")}{skipLine}
                    {!!sc?.skipped.length && MS("expand_more", `font-size:18px;margin-left:auto;transform:rotate(${s.skippedOpen ? 180 : 0}deg);transition:transform .2s`)}
                  </button>
                  {s.skippedOpen && sc && (
                    <div style={css("display:flex;flex-direction:column;border-radius:10px;border:1px solid #1f1f22;overflow:hidden;animation:fadein .25s ease both")}>
                      {sc.skipped.map((x) => {
                        const back = !!s.unskip[x.key];
                        return (
                          <div key={x.key} style={css(`display:flex;align-items:center;gap:10px;height:42px;padding:0 12px;border-bottom:1px solid #1a1a1d;opacity:${back ? 0.5 : 1}`)}>
                            {MS(x.icon, "font-size:17px;color:#6d6d73")}
                            <div style={css("flex:1;min-width:0;display:flex;flex-direction:column")}><span style={css("font:400 13px 'Onest';color:#d6d6d9")}>{x.label}</span><span style={css("font:400 11px 'JetBrains Mono',monospace;color:#5d5d63;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{x.ex}</span></div>
                            <button onClick={() => { set({ unskip: { ...s.unskip, [x.key]: !back } }); rescan(); }} style={css("height:26px;padding:0 9px;border-radius:6px;border:1px solid #2a2a2e;background:transparent;color:#9a9aa0;font:500 11px 'Onest';cursor:pointer;white-space:nowrap")}>{back ? "Не трогать" : "Вернуть в разбор"}</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ───────── «Предложи сам» ───────── */
function AutoMode({ s }: { s: AppState }) {
  const recent = (s.boot?.recentWishes || []).slice(0, 2);
  const pickDest = async () => { const dir = await api.pickFolder(); if (dir) set({ dest: "other", destPath: dir }); };
  const destName = s.destPath ? s.destPath.replace(/[\\/]+$/, "").split(/[\\/]/).pop() : null;
  return (
    <div style={css("display:flex;flex-direction:column;gap:12px;animation:fadein .3s ease both")}>
      <B as="textarea" value={s.wishes} onChange={(ev: any) => set({ wishes: ev.target.value })}
        placeholder="Например: фото по годам и событиям, документы по типу, скриншоты отдельно"
        s="height:104px;resize:none;border-radius:12px;border:1px solid #26262a;background:#121214;color:#ededee;font:400 14px/1.5 'Onest';padding:12px 14px;outline:none" f="border-color:#4a4a50" />
      {!s.wishes.trim() && <span style={css("font:400 12px 'Onest';color:#6d6d73;margin-top:-4px")}>Можно оставить пустым — тогда структуру предложит модель</span>}
      <div style={css("display:flex;flex-wrap:wrap;gap:6px")}>
        {TPL.map(([l, txt]) => (
          <B as="button" key={l} onClick={() => set({ wishes: s.wishes.trim() ? s.wishes.replace(/[,.\s]+$/, "") + ", " + txt : txt[0].toUpperCase() + txt.slice(1) })}
            s="height:30px;padding:0 11px;border-radius:15px;border:1px solid #26262a;background:#141416;color:#c9c9cd;font:400 12px 'Onest';cursor:pointer;display:flex;align-items:center;gap:5px" h="background:#1c1c1f;color:#fff">
            {MS("add", "font-size:14px;color:#6d6d73")}{l}
          </B>
        ))}
      </div>
      {recent.length > 0 && (
        <div style={css("display:flex;flex-direction:column;gap:2px")}>
          <span style={css("font:400 12px 'Onest';color:#5d5d63;margin-bottom:2px")}>Недавние</span>
          {recent.map((r) => (
            <B as="button" key={r.text} onClick={() => set({ wishes: r.text })}
              s="display:flex;align-items:center;gap:8px;height:30px;padding:0 6px;border:none;border-radius:6px;background:transparent;color:#9a9aa0;font:400 13px 'Onest';cursor:pointer;text-align:left" h="background:#141416;color:#ededee">
              {MS("history", "font-size:16px")}<span style={css("flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{r.text}</span><span style={css("font:400 11px 'JetBrains Mono',monospace;color:#5d5d63")}>{fmtShort(r.date)}</span>
            </B>
          ))}
        </div>
      )}
      <div style={css("border-radius:12px;border:1px solid #1f1f22;background:#111113;display:flex;flex-direction:column")}>
        {([["Переименовывать файлы", "rename"], ["Дата в начале имени для фото", "datePrefix"]] as const).map(([l, key]) => (
          <button key={key} onClick={() => set({ [key]: !s[key] } as any)} style={css("height:42px;display:flex;align-items:center;gap:10px;padding:0 14px;border:none;border-bottom:1px solid #1a1a1d;background:transparent;color:#d6d6d9;font:400 13px 'Onest';cursor:pointer;text-align:left")}>
            <span style={css("flex:1")}>{l}</span>
            <span style={css(`width:34px;height:20px;border-radius:10px;background:${s[key] ? "oklch(0.72 0.15 155)" : "#2a2a2e"};position:relative;transition:background .2s`)}><span style={css(`position:absolute;top:2px;left:${s[key] ? 16 : 2}px;width:16px;height:16px;border-radius:8px;background:#fefefe;transition:left .2s cubic-bezier(.2,.8,.2,1)`)} /></span>
          </button>
        ))}
        <div style={css("height:46px;display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid #1a1a1d")}>
          <span style={css("flex:1;font:400 13px 'Onest';color:#d6d6d9")}>Язык имён</span>
          <div style={css(SEG)}>{([["ru", "Русский"], ["en", "English"]] as const).map(([k, l]) => <button key={k} onClick={() => set({ nameLang: k })} style={segBtn(s.nameLang === k, 26, "12px")}>{l}</button>)}</div>
        </div>
        <div style={css("height:46px;display:flex;align-items:center;gap:10px;padding:0 14px")}>
          <span style={css("flex:1;font:400 13px 'Onest';color:#d6d6d9")}>Куда складывать</span>
          <div style={css(SEG)}>
            <button onClick={() => set({ dest: "same" })} style={segBtn(s.dest === "same", 26, "12px")}>В эту же папку</button>
            <button onClick={pickDest} title={s.destPath || undefined} style={{ ...segBtn(s.dest === "other", 26, "12px"), maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{s.dest === "other" && destName ? "В «" + destName + "»" : "В другую…"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── «По моей структуре» ───────── */
function NodePanel({ n, ml, s }: { n: SNode; ml: number; s: AppState }) {
  const note = autoNote(n, s.settings.projects.map((p) => p.name));
  return (
    <div style={css(`margin:2px 0 8px ${ml}px;border:1px solid #1f1f22;border-radius:10px;background:#141416;padding:14px;display:flex;flex-direction:column;gap:16px;animation:fadein .25s ease both`)}>
      <div style={css("display:flex;flex-direction:column;gap:7px")}>
        <span style={css("font:400 11.5px 'Onest';color:#5d5d63")}>Название папки</span>
        <B as="input" value={n.name} onChange={(e: any) => { const v = e.target.value; stEdit(n.id, (x) => { x.name = v; }); }}
          s="height:34px;border-radius:8px;border:1px solid #2a2a2e;background:#0e0e0f;color:#ededee;font:400 13px 'Onest';padding:0 10px;outline:none" f="border-color:#55555b" />
      </div>
      <div style={css("display:flex;flex-direction:column;gap:7px")}>
        <span style={css("font:400 11.5px 'Onest';color:#5d5d63")}>Что класть</span>
        <div style={css("display:flex;flex-wrap:wrap;gap:6px")}>
          {STYPES.map(([k, l]) => {
            const on = n.types.includes(k);
            return (
              <button key={k} onClick={() => stEdit(n.id, (x) => { const i = x.types.indexOf(k); if (i >= 0) x.types.splice(i, 1); else x.types.push(k); })}
                style={css(`height:28px;padding:0 10px;border-radius:14px;border:1px solid ${on ? "oklch(0.72 0.15 155)" : "#2a2a2e"};background:${on ? "oklch(0.72 0.15 155 / 0.14)" : "#121214"};color:${on ? "#ededee" : "#9a9aa0"};font:400 12.5px 'Onest';cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all .15s`)}>
                {on && MS("check", "font-size:15px")}{l}
              </button>
            );
          })}
        </div>
        <B as="input" value={n.note} onChange={(e: any) => { const v = e.target.value; stEdit(n.id, (x) => { x.note = v; }); }} placeholder="Пояснение для модели, например: смешные картинки с подписями"
          s="height:34px;border-radius:8px;border:1px solid #2a2a2e;background:#0e0e0f;color:#ededee;font:400 13px 'Onest';padding:0 10px;outline:none" f="border-color:#55555b" />
        <div style={css("display:flex;flex-wrap:wrap;gap:8px")}>
          {n.examples.map((ex, i) => (
            <div key={ex} title={ex} style={css("position:relative;width:76px;display:flex;flex-direction:column;gap:4px;animation:pop .25s ease both")}>
              <div style={css("width:76px;height:56px;border-radius:8px;background:repeating-linear-gradient(135deg,#17171a 0 7px,#1c1c1f 7px 14px);display:grid;place-items:center;font:500 11px 'JetBrains Mono',monospace;color:#6d6d73;border:1px solid #1f1f22")}>{(fileName(ex).split(".").pop() || "").toLowerCase()}</div>
              <span style={css("font:400 11px 'Onest';color:#8b8b90;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{fileName(ex)}</span>
              <B as="button" onClick={() => stRemoveExample(n.id, i)} title="Убрать пример" s="position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:10px;border:none;background:#0e0e0f;color:#8b8b90;display:grid;place-items:center;padding:0;cursor:pointer" h="color:#ededee">{MS("close", "font-size:14px")}</B>
            </div>
          ))}
          {n.fromFolder > 0 && (
            <div style={css("width:76px;display:flex;flex-direction:column;gap:4px")}>
              <div style={css("width:76px;height:56px;border-radius:8px;background:repeating-linear-gradient(135deg,#17171a 0 7px,#1c1c1f 7px 14px);display:grid;place-items:center;border:1px solid #1f1f22")}>{MS("folder", "font-size:18px;color:#6d6d73")}</div>
              <span style={css("font:400 11px 'Onest';color:#8b8b90")}>{n.fromFolder} {plural(n.fromFolder, ["файл", "файла", "файлов"])} из папки</span>
            </div>
          )}
          <B as="button" onClick={() => stAddExamples(n.id)} s="width:76px;display:flex;flex-direction:column;gap:4px;border:none;background:none;padding:0;text-align:left;cursor:pointer;color:#8b8b90" h="color:#ededee">
            <span style={css("width:76px;height:56px;border-radius:8px;border:1px dashed #2a2a2e;display:grid;place-items:center")}>{MS("add", "font-size:18px")}</span>
            <span style={css("font:400 11px 'Onest'")}>Пример</span>
          </B>
        </div>
        <span style={css("font:400 12px/1.45 'Onest';color:#6d6d73")}>Можно ничего не указывать — тогда модель поймёт по названию папки.</span>
      </div>
      <div style={css("display:flex;flex-direction:column;gap:7px")}>
        <span style={css("font:400 11.5px 'Onest';color:#5d5d63")}>Имена файлов</span>
        <div style={css("display:inline-flex;align-self:flex-start;" + SEG)}>
          {([["keep", "Как есть"], ["smart", "Понятные"]] as const).map(([k, l]) => <button key={k} onClick={() => stEdit(n.id, (x) => { x.names = k; })} style={segBtn(n.names === k)}>{l}</button>)}
        </div>
        <span style={css("font:400 11.5px 'JetBrains Mono',monospace;color:#6d6d73")}>{stNameEx(n)}</span>
      </div>
      <div style={css("display:flex;flex-direction:column;gap:7px")}>
        <span style={css("font:400 11.5px 'Onest';color:#5d5d63")}>Подпапки сами</span>
        <div style={css("display:inline-flex;align-self:flex-start;flex-wrap:wrap;" + SEG)}>
          {SAUTO.map(([k, l]) => <button key={k} onClick={() => stEdit(n.id, (x) => { x.auto = k; })} style={segBtn(n.auto === k)}>{l}</button>)}
        </div>
        {note && <span style={css("font:400 12px/1.45 'Onest';color:#6d6d73")}>{note}</span>}
      </div>
      <div style={css("display:flex;gap:6px;flex-wrap:wrap;align-items:center")}>
        <button onClick={() => stAddSub(n.id)} style={css("height:28px;padding:0 10px;border-radius:7px;border:1px solid #2a2a2e;background:#18181b;color:#ededee;font:500 12px 'Onest';cursor:pointer;display:inline-flex;align-items:center;gap:6px")}>{MS("create_new_folder", "font-size:16px")}Подпапка</button>
        <button onClick={() => stDelete(n.id)} style={css("height:28px;padding:0 10px;border-radius:7px;border:none;background:transparent;color:oklch(0.74 0.16 25);font:500 12px 'Onest';cursor:pointer;display:inline-flex;align-items:center;gap:6px")}>{MS("delete", "font-size:16px")}Удалить</button>
        <button onClick={() => set({ stSel: null })} style={css("margin-left:auto;height:28px;padding:0 10px;border-radius:7px;border:none;background:transparent;color:#c9c9cd;font:500 12px 'Onest';cursor:pointer")}>Готово</button>
      </div>
    </div>
  );
}

function MineMode({ s }: { s: AppState }) {
  const projects = s.settings.projects.map((p) => p.name);
  const rows: ReactElement[] = [];
  const walk = (list: SNode[], depth: number) => list.forEach((n) => {
    const sel = s.stSel === n.id;
    const pad = 8 + depth * 22;
    rows.push(
      <B key={n.id} onClick={() => set({ stSel: sel ? null : n.id })}
        s={`display:flex;align-items:center;gap:8px;min-height:38px;padding:4px 6px 4px ${pad}px;border-radius:8px;background:${sel ? "#26262b" : "transparent"};cursor:pointer;min-width:0;transition:background .15s`}
        h={sel ? undefined : "background:#18181b"}>
        {MS("folder", `font-size:18px;color:${stColor(n)};flex:none;font-variation-settings:'FILL' 1`)}
        <span style={css("font:500 13.5px 'Onest';color:#d6d6d9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;min-width:40px")}>{n.name || "Без названия"}</span>
        <span style={css("flex:1 1 0;min-width:0;text-align:right;font:400 12px 'Onest';color:#6d6d73;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{stSum(n)}</span>
        {sel && (
          <>
            <B as="button" onClick={(e: any) => { e.stopPropagation(); stAddSub(n.id); }} title="Подпапка" s="width:26px;height:26px;border-radius:6px;border:none;background:none;color:#8b8b90;display:grid;place-items:center;padding:0;cursor:pointer" h="background:#2a2a2e;color:#ededee">{MS("create_new_folder", "font-size:16px")}</B>
            <B as="button" onClick={(e: any) => { e.stopPropagation(); stDelete(n.id); }} title="Удалить" s="width:26px;height:26px;border-radius:6px;border:none;background:none;color:#8b8b90;display:grid;place-items:center;padding:0;cursor:pointer" h="background:#2a2a2e;color:#ededee">{MS("delete", "font-size:16px")}</B>
          </>
        )}
        {MS(sel ? "expand_less" : "expand_more", "font-size:18px;color:#5d5d63;flex:none")}
      </B>,
    );
    if (sel) rows.push(<NodePanel key={n.id + ":p"} n={n} ml={pad} s={s} />);
    walk(n.kids, depth + 1);
    if (n.auto !== "none") rows.push(
      <div key={n.id + ":g"} style={css(`display:flex;align-items:center;gap:7px;min-height:30px;padding:2px 8px 2px ${12 + (depth + 1) * 22}px;font:italic 400 12px 'Onest';color:#6d6d73`)}>
        {MS("auto_awesome", "font-size:15px;color:oklch(0.8 0.16 155);font-style:normal")}{stGhost(n, projects)} — появятся сами
      </div>,
    );
  });
  walk(s.tree, 0);
  const pasteOpen = s.stPanel === "paste", scanOpen = s.stPanel === "scan";
  const subs = s.scan?.subdirs || [];
  const btn = (on: boolean) => css(`height:30px;padding:0 10px;border-radius:8px;border:1px solid ${on ? "oklch(0.72 0.15 155)" : "#2a2a2e"};background:${on ? "oklch(0.72 0.15 155 / 0.14)" : "#18181b"};color:#ededee;font:500 12px 'Onest';cursor:pointer;display:inline-flex;align-items:center;gap:6px`);
  return (
    <div style={css("display:flex;flex-direction:column;gap:12px;animation:fadein .3s ease both")}>
      <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
        <div style={css("flex:1 1 180px;min-width:0;display:flex;flex-direction:column;gap:1px")}>
          <span style={css("font:500 13.5px 'Onest';color:#ededee")}>{s.folderName ? `Структура для «${s.folderName}»` : "Структура папок"}</span>
          <span style={css("font:400 12px 'Onest';color:#6d6d73")}>запомнится для этой папки</span>
        </div>
        <div style={css("display:flex;gap:6px;flex-wrap:wrap")}>
          <button onClick={() => set({ stPanel: scanOpen ? null : "scan" })} style={btn(scanOpen)}>{MS("folder_copy", "font-size:16px")}Взять из папки</button>
          <button onClick={() => set({ stPanel: pasteOpen ? null : "paste" })} style={btn(pasteOpen)}>{MS("format_list_bulleted", "font-size:16px")}Вставить списком</button>
        </div>
      </div>
      {pasteOpen && (
        <div style={css("border-radius:12px;border:1px solid #1f1f22;background:#111113;padding:14px;display:flex;flex-direction:column;gap:12px;animation:fadein .25s ease both")}>
          <span style={css("font:400 11.5px 'Onest';color:#5d5d63")}>Список папок</span>
          <B as="textarea" value={s.stPaste} onChange={(e: any) => set({ stPaste: e.target.value })} spellCheck={false}
            s="height:200px;resize:vertical;border-radius:8px;border:1px solid #2a2a2e;background:#141416;color:#ededee;font:400 12.5px/1.6 'JetBrains Mono',monospace;padding:10px 12px;outline:none" f="border-color:#55555b" />
          <span style={css("font:400 12px/1.45 'Onest';color:#6d6d73")}>Каждая папка — с новой строки. Вложенность — отступом или через «/». После тире — «по годам», «по годам и месяцам» или «по проектам». После двоеточия — пояснение для модели. Текущая структура заменится.</span>
          <div style={css("display:flex;gap:6px")}>
            <button onClick={() => applyPaste()} style={css(`height:28px;padding:0 10px;border-radius:7px;border:none;background:#ededee;color:#0e0e0f;font:500 12px 'Onest';cursor:pointer;opacity:${s.stPaste.trim() ? 1 : 0.4}`)}>Собрать структуру</button>
            <button onClick={() => set({ stPanel: null })} style={css("height:28px;padding:0 10px;border-radius:7px;border:none;background:transparent;color:#9a9aa0;font:500 12px 'Onest';cursor:pointer")}>Отмена</button>
          </div>
        </div>
      )}
      {scanOpen && (
        <div style={css("border-radius:12px;border:1px solid #1f1f22;background:#111113;padding:14px;display:flex;flex-direction:column;gap:10px;animation:fadein .25s ease both")}>
          <span style={css("font:400 11.5px 'Onest';color:#5d5d63")}>{subs.length ? `В «${s.folderName || "папке"}» уже есть папки` : `В «${s.folderName || "папке"}» нет вложенных папок`}</span>
          <div style={css("display:flex;flex-direction:column;gap:2px")}>
            {subs.map((x) => {
              const code = x.kind === "code" || x.kind === "programs";
              const on = s.stScan[x.name] ?? !code;
              const hint = code ? (x.kind === "code" ? "проект с кодом — лучше переносить целиком" : "программа — лучше переносить целиком") : `${nf(x.n)} ${plural(x.n, ["файл", "файла", "файлов"])}`;
              return (
                <B as="button" key={x.name} onClick={() => set({ stScan: { ...s.stScan, [x.name]: !on } })} s="display:flex;align-items:center;gap:9px;min-height:36px;padding:4px 8px;border-radius:8px;border:none;background:transparent;color:#ededee;cursor:pointer;text-align:left" h="background:#18181b">
                  <span style={css(`width:16px;height:16px;border-radius:4px;border:1.5px solid ${on ? "oklch(0.72 0.15 155)" : "#3a3a3f"};background:${on ? "oklch(0.72 0.15 155)" : "transparent"};display:grid;place-items:center;flex:none;transition:all .15s`)}>{on && MS("check", "font-size:13px;color:#0e0e0f")}</span>
                  {MS("folder", "font-size:17px;color:#8b8b90;font-variation-settings:'FILL' 1")}
                  <span style={css("font:500 13px 'Onest'")}>{x.name}</span>
                  <span style={css("font:400 12px 'Onest';color:#6d6d73")}>{hint}</span>
                </B>
              );
            })}
          </div>
          <span style={css("font:400 12px/1.45 'Onest';color:#6d6d73")}>Выбранные папки станут частью структуры, а файлы в них — примерами: по ним модель поймёт, что ещё туда класть.</span>
          <div style={css("display:flex;gap:6px")}>
            {subs.length > 0 && <button onClick={() => { const prev = s.tree; const n = applyScan(); if (n) withUndo(`В структуру добавлено ${n} ${plural(n, ["папка", "папки", "папок"])}`, () => set({ tree: prev })); }} style={css("height:28px;padding:0 10px;border-radius:7px;border:none;background:#ededee;color:#0e0e0f;font:500 12px 'Onest';cursor:pointer")}>Добавить в структуру</button>}
            <button onClick={() => set({ stPanel: null })} style={css("height:28px;padding:0 10px;border-radius:7px;border:none;background:transparent;color:#9a9aa0;font:500 12px 'Onest';cursor:pointer")}>{subs.length ? "Отмена" : "Закрыть"}</button>
          </div>
        </div>
      )}
      <div style={css("border-radius:12px;border:1px solid #1f1f22;background:#111113;padding:6px;display:flex;flex-direction:column;gap:1px")}>
        {rows}
        {!s.tree.length && <div style={css("padding:10px 12px;font:italic 400 12px 'Onest';color:#6d6d73")}>Пока нет ни одной папки</div>}
        <B as="button" onClick={stAddTop} s="display:flex;align-items:center;gap:6px;height:36px;padding:0 10px;margin-top:4px;border:1px dashed #2a2a2e;border-radius:8px;background:none;color:#8b8b90;font:400 13px 'Onest';cursor:pointer" h="color:#ededee;border-color:#4a4a50">{MS("add", "font-size:18px")}Папка</B>
      </div>
      <div style={css("display:flex;align-items:flex-start;gap:8px;font:400 12.5px/1.45 'Onest';color:#6d6d73")}>{MS("help", "font-size:16px;margin-top:1px")}Модель выбирает папку только из этого списка. Что не подойдёт — в «{MANUAL}». Нажмите на папку, чтобы настроить.</div>
    </div>
  );
}

export function Start() {
  const s = useApp();
  useEffect(() => { if (!s.quick.length) loadQuick(); }, []);
  const sc = s.scan;
  const ready = !!sc && !s.scanning && !s.scanErr;
  const mine = s.mode === "mine";
  const canAnalyze = !!s.folder && ready && (mine ? (sc?.allFiles || 0) > 0 && s.tree.some((n) => n.name.trim()) : (sc?.total || 0) > 0);

  return (
    <div style={css("flex:1;min-height:0;display:flex;flex-direction:column;animation:fadein .4s ease both")}>
      <div style={css("flex:1;min-height:0;overflow-y:auto;overflow-x:hidden")}>
        <div style={css("max-width:760px;margin:0 auto;padding:20px 22px 28px;display:flex;flex-direction:column;gap:26px")}>
          <div style={css("display:flex;flex-direction:column;gap:12px")}>
            <span style={css("font:500 13px 'Onest';color:#8b8b90")}>Какую папку разобрать</span>
            {!s.folder ? (
              <>
                <B as="button" onClick={async () => { const d = await api.pickFolder(); if (d) selectFolder(d); }}
                  s="height:190px;border-radius:14px;border:1.5px dashed #2e2e33;background:#111113;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;cursor:pointer;color:#ededee;transition:all .2s"
                  h="border-color:#4a4a50;background:#151517">
                  <span style={css("width:52px;height:52px;border-radius:14px;background:#1b1b1e;border:1px solid #2a2a2e;display:grid;place-items:center")}>{MS("drive_folder_upload", "font-size:26px;color:#c9c9cd")}</span>
                  <span style={css("font:500 15px 'Onest'")}>Перетащите папку сюда</span>
                  <span style={css("height:32px;padding:0 14px;border-radius:8px;background:#ededee;color:#0e0e0f;font:500 13px 'Onest';display:inline-flex;align-items:center")}>Выбрать папку</span>
                </B>
                {s.quick.length > 0 && (
                  <div style={css("display:flex;align-items:center;flex-wrap:wrap;gap:6px")}>
                    <span style={css("font:400 12px 'Onest';color:#6d6d73;margin-right:2px")}>Предложено:</span>
                    {s.quick.map((q) => (
                      <B as="button" key={q.path} onClick={() => selectFolder(q.path, q.name)} title={q.path}
                        s="height:28px;padding:0 9px;border-radius:7px;border:1px solid #26262a;background:#141416;color:#d6d6d9;font:400 12.5px 'Onest';cursor:pointer;display:inline-flex;align-items:center;gap:6px"
                        h="background:#1c1c1f;border-color:#3a3a3f;color:#ededee">
                        {MS(q.icon, "font-size:15px;color:#8b8b90")}{q.name}<span style={css("font:400 10.5px 'JetBrains Mono',monospace;color:#6d6d73")}>{nf(q.count)}</span>
                      </B>
                    ))}
                  </div>
                )}
              </>
            ) : <FolderCard s={s} />}
          </div>
          <div style={css("display:flex;flex-direction:column;gap:12px")}>
            <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap")}>
              <span style={css("font:500 13px 'Onest';color:#8b8b90")}>Как навести порядок</span>
              <div style={css(SEG)}>
                {([["auto", "Предложи сам"], ["mine", "По моей структуре"]] as const).map(([k, l]) => <button key={k} onClick={() => setMode(k)} style={segBtn(s.mode === k)}>{l}</button>)}
              </div>
            </div>
            {mine ? <MineMode s={s} /> : <AutoMode s={s} />}
          </div>
        </div>
      </div>
      <div style={css("height:66px;flex:none;border-top:1px solid #1c1c1f;display:flex;align-items:center;gap:12px;padding:0 22px")}>
        {MS("shield", "font-size:18px;color:oklch(0.85 0.14 155)")}
        <span style={css("font:400 13px 'Onest';color:#8b8b90")}>На этом шаге файлы только читаются. Перед любыми изменениями покажем план.</span>
        <button onClick={() => canAnalyze && startAnalysis()} style={css(`margin-left:auto;height:42px;padding:0 22px;border-radius:10px;border:none;background:#ededee;color:#0e0e0f;font:500 14px 'Onest';cursor:pointer;opacity:${canAnalyze ? 1 : 0.35};display:flex;align-items:center;gap:8px;transition:opacity .2s;flex:none`)}>
          {MS("auto_awesome", "font-size:18px")}Анализировать
        </button>
      </div>
    </div>
  );
}
