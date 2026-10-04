import { useEffect } from "react";
import { B, Ic, css, useRerenderUntil } from "../ui";
import { clearFolder, estimateSec, loadQuick, rescan, selectFolder, set, startAnalysis, useApp } from "../store";
import { api } from "../lib/api";
import { fmtDur, fmtShort, nf, plural } from "../lib/format";

const TPL: [string, string][] = [
  ["По проектам", "скриншоты и макеты по проектам"], ["По годам", "фото по годам и событиям"], ["По типу файлов", "документы по типу"],
  ["Семейный архив", "семейные фото по годам и людям"], ["Учёба", "учебные материалы по предметам"], ["Для дизайнера", "референсы, макеты и экспорты отдельно"],
];

const P = "oklch(0.74 0.15 350)", T = "oklch(0.78 0.12 185)", BL = "oklch(0.74 0.15 255)";

export function Start() {
  const s = useApp();
  useEffect(() => { if (!s.quick.length) loadQuick(); }, []);
  useRerenderUntil(s.scanDoneAt + 850);
  const k = s.scan ? Math.min(1, (performance.now() - s.scanDoneAt) / 800) : 0;
  const e = 1 - Math.pow(1 - k, 3);
  const sc = s.scan;
  const tot = sc?.total || 0;
  const ready = !!sc && k >= 1 && !s.scanning;
  const w = (n: number) => (tot ? ((n / tot) * 100 * e).toFixed(1) : "0");
  const caption = s.scanning || !sc ? "сканирую…" : k < 1 ? "сканирую…" : tot ? plural(tot, ["личный файл", "личных файла", "личных файлов"]) : "личных файлов не нашлось";
  const canAnalyze = !!s.folder && ready && tot > 0;
  const locked = sc?.lockedCount || 0, skippedFiles = sc?.skippedFiles || 0;
  const skipLine = locked || skippedFiles
    ? [locked ? `${locked} ${plural(locked, ["папку-проект", "папки-проекта", "папок-проектов"])} не тронем` : "", skippedFiles ? `${nf(skippedFiles)} ${plural(skippedFiles, ["программный файл", "программных файла", "программных файлов"])} пропустим` : ""].filter(Boolean).join(" · ")
    : "Пропускать нечего — все файлы личные";
  const recent = (s.boot?.recentWishes || []).slice(0, 2);
  const pickDest = async () => {
    const dir = await api.pickFolder();
    if (dir) set({ dest: "other", destPath: dir });
  };
  const destName = s.destPath ? s.destPath.replace(/[\\/]+$/, "").split(/[\\/]/).pop() : null;

  return (
    <div style={css("flex:1;min-height:0;display:flex;flex-direction:column;animation:fadein .4s ease both")}>
      <div style={css("flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;padding:20px 22px")}>
        <div style={css("display:flex;flex-direction:column;gap:12px")}>
          <span style={css("font:500 13px 'Onest';color:#8b8b90")}>Какую папку разобрать</span>
          {!s.folder && (
            <>
              <B as="button" onClick={async () => { const d = await api.pickFolder(); if (d) selectFolder(d); }}
                s="height:190px;border-radius:14px;border:1.5px dashed #2e2e33;background:#111113;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;cursor:pointer;color:#ededee;transition:all .2s"
                h="border-color:#4a4a50;background:#151517">
                <Ic n="drive_folder_upload" s="width:52px;height:52px;border-radius:14px;background:#1b1b1e;border:1px solid #2a2a2e;display:grid;place-items:center;font-size:26px;color:#c9c9cd" />
                <span style={css("font:500 15px 'Onest'")}>Перетащите папку сюда</span>
                <span style={css("height:32px;padding:0 14px;border-radius:8px;background:#ededee;color:#0e0e0f;font:500 13px 'Onest';display:inline-flex;align-items:center")}>Выбрать папку</span>
              </B>
              <div style={css("display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px")}>
                {s.quick.map((q) => (
                  <B as="button" key={q.path} onClick={() => selectFolder(q.path, q.name)} title={q.path}
                    s="display:flex;align-items:center;gap:10px;height:52px;padding:0 12px;border-radius:10px;border:1px solid #222225;background:#121214;color:#ededee;cursor:pointer;text-align:left"
                    h="background:#18181b;border-color:#2e2e33">
                    <Ic n={q.icon} s="font-size:20px;color:#8b8b90" />
                    <span style={css("flex:1;font:500 13px 'Onest'")}>{q.name}</span>
                    <span style={css("font:400 11px 'JetBrains Mono',monospace;color:#6d6d73")}>{nf(q.count)}</span>
                  </B>
                ))}
              </div>
            </>
          )}
          {s.folder && (
            <div style={css("border-radius:14px;border:1px solid #222225;background:#121214;padding:16px;display:flex;flex-direction:column;gap:14px;animation:fadein .3s ease both")}>
              <div style={css("display:flex;align-items:center;gap:12px")}>
                <Ic n="folder" s="width:40px;height:40px;border-radius:10px;background:#1b1b1e;display:grid;place-items:center;font-size:22px;color:oklch(0.74 0.15 255);font-variation-settings:'FILL' 1" />
                <div style={css("flex:1;display:flex;flex-direction:column;gap:2px;min-width:0")}>
                  <span style={css("font:500 15px 'Onest'")}>{s.folderName}</span>
                  <span style={css("font:400 11px 'JetBrains Mono',monospace;color:#6d6d73;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{s.folder}</span>
                </div>
                <button onClick={clearFolder} style={css("height:30px;padding:0 10px;border-radius:7px;border:1px solid #2a2a2e;background:transparent;color:#9a9aa0;font:500 12px 'Onest';cursor:pointer")}>Сменить</button>
              </div>
              {s.scanErr ? (
                <div style={css("display:flex;gap:8px;padding:10px 12px;border-radius:9px;background:oklch(0.7 0.15 25 / 0.08);border:1px solid oklch(0.7 0.15 25 / 0.3);font:400 13px 'Onest';color:#d6d6d9")}>
                  <Ic n="error" s="font-size:18px;color:oklch(0.78 0.15 25)" />{s.scanErr}
                </div>
              ) : (
                <>
                  <div style={css("display:flex;align-items:baseline;gap:8px")}>
                    <span style={css("font:500 34px/1 'Onest';letter-spacing:-.02em")}>{nf(tot * e)}</span>
                    <span style={css("font:400 14px 'Onest';color:#8b8b90")}>{caption}</span>
                  </div>
                  <div style={css("display:flex;height:10px;gap:3px")}>
                    <span style={css(`width:${w(sc?.images || 0)}%;border-radius:3px;background:${P};transition:width .2s`)} />
                    <span style={css(`width:${w(sc?.docs || 0)}%;border-radius:3px;background:${T};transition:width .2s`)} />
                    <span style={css(`width:${w(sc?.media || 0)}%;border-radius:3px;background:${BL};transition:width .2s`)} />
                    <span style={css("flex:1;border-radius:3px;background:#1e1e21")} />
                  </div>
                  <div style={css("display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px")}>
                    {([["картинки", sc?.images || 0, P], ["документы", sc?.docs || 0, T], ["видео и аудио", sc?.media || 0, BL]] as const).map(([l, n, c]) => (
                      <div key={l} style={css("display:flex;gap:8px")}><span style={css(`width:3px;border-radius:2px;background:${c}`)} /><div style={css("display:flex;flex-direction:column")}><span style={css("font:400 12px 'Onest';color:#8b8b90")}>{l}</span><span style={css("font:500 14px 'JetBrains Mono',monospace")}>{nf(n * e)}</span></div></div>
                    ))}
                  </div>
                  {ready && (
                    <div style={css("display:flex;flex-direction:column;gap:10px;animation:fadein .3s ease both")}>
                      {tot > 0 && (
                        <div style={css("display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;background:#0e0e0f;font:400 13px 'Onest';color:#c9c9cd")}>
                          <Ic n="schedule" s="font-size:18px;color:#8b8b90" />Анализ на этом компьютере займёт <b style={css("font-weight:500;color:#ededee")}>≈ {fmtDur(estimateSec(tot))}</b>
                        </div>
                      )}
                      <button onClick={() => sc && sc.skipped.length && set({ skippedOpen: !s.skippedOpen })} style={css(`display:flex;align-items:center;gap:8px;background:none;border:none;padding:0;color:#9a9aa0;font:400 13px 'Onest';cursor:${sc?.skipped.length ? "pointer" : "default"};text-align:left`)}>
                        <Ic n="lock" s="font-size:18px" />{skipLine}
                        {!!sc?.skipped.length && <Ic n="expand_more" s={`font-size:18px;margin-left:auto;transform:rotate(${s.skippedOpen ? 180 : 0}deg);transition:transform .2s`} />}
                      </button>
                      {s.skippedOpen && sc && (
                        <div style={css("display:flex;flex-direction:column;border-radius:10px;border:1px solid #1f1f22;overflow:hidden;animation:fadein .25s ease both")}>
                          {sc.skipped.map((x) => {
                            const back = !!s.unskip[x.key];
                            return (
                              <div key={x.key} style={css(`display:flex;align-items:center;gap:10px;height:42px;padding:0 12px;border-bottom:1px solid #1a1a1d;opacity:${back ? 0.5 : 1}`)}>
                                <Ic n={x.icon} s="font-size:17px;color:#6d6d73" />
                                <div style={css("flex:1;min-width:0;display:flex;flex-direction:column")}><span style={css("font:400 13px 'Onest';color:#d6d6d9")}>{x.label}</span><span style={css("font:400 11px 'JetBrains Mono',monospace;color:#5d5d63;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{x.ex}</span></div>
                                <button onClick={() => { set({ unskip: { ...s.unskip, [x.key]: !back } }); rescan(); }} style={css("height:26px;padding:0 9px;border-radius:6px;border:1px solid #2a2a2e;background:transparent;color:#9a9aa0;font:500 11px 'Onest';cursor:pointer;white-space:nowrap")}>{back ? "Не трогать" : "Вернуть в разбор"}</button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div style={css("display:flex;flex-direction:column;gap:12px")}>
          <span style={css("font:500 13px 'Onest';color:#8b8b90")}>Как навести порядок</span>
          <B as="textarea" value={s.wishes} onChange={(ev: any) => set({ wishes: ev.target.value })}
            placeholder="Например: фото по годам и событиям, документы по типу, скриншоты отдельно"
            s="height:104px;resize:none;border-radius:12px;border:1px solid #26262a;background:#121214;color:#ededee;font:400 14px/1.5 'Onest';padding:12px 14px;outline:none" f="border-color:#4a4a50" />
          {!s.wishes.trim() && <span style={css("font:400 12px 'Onest';color:#6d6d73;margin-top:-4px")}>Можно оставить пустым — тогда структуру предложит модель</span>}
          <div style={css("display:flex;flex-wrap:wrap;gap:6px")}>
            {TPL.map(([l, txt]) => (
              <B as="button" key={l} onClick={() => set({ wishes: s.wishes.trim() ? s.wishes.replace(/[,.\s]+$/, "") + ", " + txt : txt[0].toUpperCase() + txt.slice(1) })}
                s="height:30px;padding:0 11px;border-radius:15px;border:1px solid #26262a;background:#141416;color:#c9c9cd;font:400 12px 'Onest';cursor:pointer;display:flex;align-items:center;gap:5px" h="background:#1c1c1f;color:#fff">
                <Ic n="add" s="font-size:14px;color:#6d6d73" />{l}
              </B>
            ))}
          </div>
          {recent.length > 0 && (
            <div style={css("display:flex;flex-direction:column;gap:2px")}>
              <span style={css("font:400 12px 'Onest';color:#5d5d63;margin-bottom:2px")}>Недавние</span>
              {recent.map((r) => (
                <B as="button" key={r.text} onClick={() => set({ wishes: r.text })}
                  s="display:flex;align-items:center;gap:8px;height:30px;padding:0 6px;border:none;border-radius:6px;background:transparent;color:#9a9aa0;font:400 13px 'Onest';cursor:pointer;text-align:left" h="background:#141416;color:#ededee">
                  <Ic n="history" s="font-size:16px" /><span style={css("flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{r.text}</span><span style={css("font:400 11px 'JetBrains Mono',monospace;color:#5d5d63")}>{fmtShort(r.date)}</span>
                </B>
              ))}
            </div>
          )}
          <div style={css("border-radius:12px;border:1px solid #1f1f22;background:#111113;display:flex;flex-direction:column")}>
            {([["Переименовывать файлы", "rename"], ["Дата в начале имени для фото", "datePrefix"]] as const).map(([l, key]) => (
              <button key={key} onClick={() => set({ [key]: !s[key] } as any)} style={css("height:42px;display:flex;align-items:center;gap:10px;padding:0 14px;border:none;border-bottom:1px solid #1a1a1d;background:transparent;color:#d6d6d9;font:400 13px 'Onest';cursor:pointer;text-align:left")}>
                <span style={css("flex:1")}>{l}</span>
                <span style={css(`width:34px;height:20px;border-radius:10px;background:${s[key] ? "oklch(0.72 0.15 155)" : "#2a2a2e"};position:relative;transition:background .2s`)}><span style={css(`position:absolute;top:2px;left:${s[key] ? 16 : 2}px;width:16px;height:16px;border-radius:8px;background:#fff;transition:left .2s cubic-bezier(.2,.8,.2,1)`)} /></span>
              </button>
            ))}
            <div style={css("height:46px;display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid #1a1a1d")}>
              <span style={css("flex:1;font:400 13px 'Onest';color:#d6d6d9")}>Язык имён</span>
              <div style={css("display:flex;padding:2px;border-radius:8px;background:#0b0b0c;border:1px solid #1f1f22")}>
                {([["ru", "Русский"], ["en", "English"]] as const).map(([kk, l]) => (
                  <button key={kk} onClick={() => set({ nameLang: kk })} style={css(`height:26px;padding:0 10px;border-radius:6px;border:none;background:${s.nameLang === kk ? "#26262a" : "transparent"};color:${s.nameLang === kk ? "#ededee" : "#8b8b90"};font:500 12px 'Onest';cursor:pointer`)}>{l}</button>
                ))}
              </div>
            </div>
            <div style={css("height:46px;display:flex;align-items:center;gap:10px;padding:0 14px")}>
              <span style={css("flex:1;font:400 13px 'Onest';color:#d6d6d9")}>Куда складывать</span>
              <div style={css("display:flex;padding:2px;border-radius:8px;background:#0b0b0c;border:1px solid #1f1f22")}>
                <button onClick={() => set({ dest: "same" })} style={css(`height:26px;padding:0 10px;border-radius:6px;border:none;background:${s.dest === "same" ? "#26262a" : "transparent"};color:${s.dest === "same" ? "#ededee" : "#8b8b90"};font:500 12px 'Onest';cursor:pointer`)}>В эту же папку</button>
                <button onClick={pickDest} title={s.destPath || undefined} style={css(`height:26px;padding:0 10px;border-radius:6px;border:none;background:${s.dest === "other" ? "#26262a" : "transparent"};color:${s.dest === "other" ? "#ededee" : "#8b8b90"};font:500 12px 'Onest';cursor:pointer;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{s.dest === "other" && destName ? "В «" + destName + "»" : "В другую…"}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={css("height:66px;flex:none;border-top:1px solid #1c1c1f;display:flex;align-items:center;gap:12px;padding:0 22px")}>
        <Ic n="shield" s="font-size:18px;color:oklch(0.85 0.14 155)" />
        <span style={css("font:400 13px 'Onest';color:#8b8b90")}>На этом шаге файлы только читаются. Перед любыми изменениями покажем план.</span>
        <button onClick={() => canAnalyze && startAnalysis()} style={css(`margin-left:auto;height:42px;padding:0 22px;border-radius:10px;border:none;background:#ededee;color:#0e0e0f;font:500 14px 'Onest';cursor:pointer;opacity:${canAnalyze ? 1 : 0.35};display:flex;align-items:center;gap:8px;transition:opacity .2s;flex:none`)}>
          <Ic n="auto_awesome" s="font-size:18px" />Анализировать
        </button>
      </div>
    </div>
  );
}
