import { useEffect, useState } from "react";
import { C, Ic, css, topColor } from "../ui";
import { get, go, set, useApp } from "../store";
import { api } from "../lib/api";
import type { HistoryEntry, UndoResult } from "../lib/types";
import { fmtShort, nf, plural } from "../lib/format";
import { Btn, Page, Section, Spinner } from "./kit";

const STATUS: Record<HistoryEntry["status"], [string, string]> = {
  active: ["", "oklch(0.85 0.12 155)"],
  undone: ["Отменено — файлы вернулись на места", "#6d6d73"],
  expired: ["Срок отмены истёк — файлы остаются в новых папках", "#6d6d73"],
};

export function History() {
  const s = useApp();
  const [list, setList] = useState<HistoryEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ask, setAsk] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [res, setRes] = useState<Record<string, UndoResult>>({});

  const load = () => api.historyAll().then((l) => { setList(l); setErr(null); }).catch((e) => setErr(String(e?.message || e)));
  useEffect(() => { load(); }, []);

  const undo = async (h: HistoryEntry) => {
    setAsk(null);
    setBusy(h.id);
    set({ prog: { n: 0, total: 0, lines: [] } });
    api.setBusy(true);
    try {
      const r = await api.undo(h.id);
      setRes((m) => ({ ...m, [h.id]: r }));
      const boot = get().boot;
      if (boot) set({ boot: { ...boot, history: boot.history.filter((x) => x.id !== h.id) } });
      // если это была сессия из открытого результата — тот экран тоже должен знать, что всё вернули
      if (get().sessions.includes(h.id)) set({ sessions: get().sessions.filter((x) => x !== h.id), undone: true, undoRes: r });
    } catch (e: any) {
      setRes((m) => ({ ...m, [h.id]: { restored: 0, total: h.files, conflicts: [{ icon: "error", name: "Откат прерван", why: String(e?.message || e) }] } }));
    }
    api.setBusy(false);
    setBusy(null);
    load();
  };

  const active = (list || []).filter((h) => h.status === "active").length;

  return (
    <Page>
      <Section title="Разобранные папки"
        desc={list && list.length ? (active ? `Последние сортировки можно отменить в течение 30 дней — файлы вернутся туда, где лежали. Сейчас можно отменить: ${active}.` : "Последние сортировки. Отменить можно в течение 30 дней после разбора.") : undefined}>
        {!list && !err && <div style={css("display:flex;align-items:center;gap:10px;padding:18px;font:400 13px 'Onest';color:#8b8b90")}><Spinner />Читаю журнал…</div>}
        {err && <div style={css("padding:12px 14px;border-radius:10px;background:oklch(0.7 0.15 25 / 0.08);border:1px solid oklch(0.7 0.15 25 / 0.3);font:400 13px 'Onest';color:#d6d6d9")}>Не получилось прочитать историю: {err}</div>}
        {list && list.length === 0 && (
          <div style={css("display:flex;flex-direction:column;align-items:center;gap:12px;padding:46px 20px;border-radius:14px;border:1px dashed #26262a;text-align:center")}>
            <Ic n="history" s="width:48px;height:48px;border-radius:13px;background:#141416;border:1px solid #222225;display:grid;place-items:center;font-size:24px;color:#6d6d73" />
            <span style={css("font:500 14px 'Onest';color:#d6d6d9")}>Пока ничего не разбирали</span>
            <span style={css("font:400 13px/1.5 'Onest';color:#8b8b90;max-width:360px")}>Здесь появится каждая сортировка — с возможностью отменить её целиком в течение 30 дней.</span>
            <Btn kind="primary" icon="folder_open" onClick={() => go("start")}>Разобрать папку</Btn>
          </div>
        )}
        {list && list.length > 0 && (
          <div style={css("display:flex;flex-direction:column;gap:10px")}>
            {list.map((h) => {
              const r = res[h.id];
              const [stText, stC] = STATUS[h.status];
              const isBusy = busy === h.id;
              return (
                <div key={h.id} style={css(`border-radius:12px;border:1px solid #1f1f22;background:#111113;padding:14px;display:flex;flex-direction:column;gap:10px;opacity:${h.status === "active" || r ? 1 : 0.75}`)}>
                  <div style={css("display:flex;align-items:center;gap:12px")}>
                    <Ic n="folder" s={`width:38px;height:38px;border-radius:10px;background:#18181b;display:grid;place-items:center;font-size:21px;color:${h.status === "active" ? C.b : "#5d5d63"};font-variation-settings:'FILL' 1;flex:none`} />
                    <div style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:2px")}>
                      <span style={css("font:500 14px 'Onest';color:#ededee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")} title={h.root}>{h.name}</span>
                      <span style={css("font:400 12px 'Onest';color:#8b8b90")}>
                        {fmtShort(h.date)}{h.time ? ", " + h.time : ""} · {nf(h.files)} {plural(h.files, ["файл", "файла", "файлов"])}
                        {h.status === "active" && h.until && <span style={css("color:#6d6d73")}> · отменить можно до {fmtShort(h.until)}</span>}
                      </span>
                    </div>
                    <div style={css("display:flex;gap:6px;flex:none")}>
                      {h.dest && <Btn kind="ghost" icon="folder_open" onClick={() => api.openPath(h.dest)}>Открыть</Btn>}
                      {h.status === "active" && !r && ask !== h.id && <Btn icon="undo" disabled={!!busy || s.modal != null} onClick={() => setAsk(h.id)}>Отменить</Btn>}
                    </div>
                  </div>
                  {h.folders.length > 0 && (
                    <div style={css("display:flex;flex-wrap:wrap;gap:6px;padding-left:50px")}>
                      {h.folders.slice(0, 8).map((f) => (
                        <span key={f} style={css("display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:7px;background:#18181b;font:400 12px 'Onest';color:#c9c9cd")}>
                          <Ic n="folder" s={`font-size:14px;color:${topColor(f)};font-variation-settings:'FILL' 1`} />{f}
                        </span>
                      ))}
                      {h.folders.length > 8 && <span style={css("font:400 12px 'Onest';color:#6d6d73;align-self:center")}>и ещё {h.folders.length - 8}</span>}
                    </div>
                  )}
                  {stText && !r && <span style={css(`padding-left:50px;font:400 12px 'Onest';color:${stC}`)}>{stText}</span>}
                  {ask === h.id && (
                    <div style={css("margin-left:50px;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:#18181b;border:1px solid #26262a;animation:fadein .2s ease both")}>
                      <Ic n="undo" s="font-size:18px;color:#c9c9cd" />
                      <span style={css("flex:1;font:400 13px/1.4 'Onest';color:#d6d6d9")}>Вернуть {nf(h.files)} {plural(h.files, ["файл", "файла", "файлов"])} на прежние места? Пустые новые папки удалим.</span>
                      <Btn kind="primary" onClick={() => undo(h)}>Да, вернуть</Btn>
                      <Btn kind="ghost" onClick={() => setAsk(null)}>Нет</Btn>
                    </div>
                  )}
                  {isBusy && <div style={css("margin-left:50px;display:flex;align-items:center;gap:10px;font:400 13px 'Onest';color:#9a9aa0")}><Spinner />Возвращаю файлы{s.prog.total ? ` — ${s.prog.n} из ${s.prog.total}` : "…"}</div>}
                  {r && (
                    <div style={css("margin-left:50px;display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:10px;background:#141416;border:1px solid #1f1f22;animation:fadein .25s ease both")}>
                      <span style={css("display:flex;align-items:center;gap:8px;font:500 13px 'Onest';color:#ededee")}>
                        <Ic n={r.conflicts.length ? "info" : "check_circle"} s={`font-size:18px;color:${r.conflicts.length ? "oklch(0.86 0.13 85)" : "oklch(0.85 0.14 155)"}`} />
                        Вернули {nf(r.restored)} из {nf(r.total)} {plural(r.total, ["файла", "файлов", "файлов"])}
                      </span>
                      {r.conflicts.slice(0, 5).map((c, i) => (
                        <span key={i} style={css("display:flex;align-items:center;gap:8px;font:400 12px 'Onest';color:#9a9aa0;padding-left:26px")}>
                          <Ic n={c.icon} s="font-size:15px;color:#6d6d73" /><span style={css("color:#d6d6d9")}>{c.name}</span> — {c.why}
                        </span>
                      ))}
                      {r.conflicts.length > 5 && <span style={css("font:400 12px 'Onest';color:#6d6d73;padding-left:26px")}>и ещё {r.conflicts.length - 5}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </Page>
  );
}
