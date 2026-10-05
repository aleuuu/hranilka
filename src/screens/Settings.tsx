import { useEffect, useState } from "react";
import { B, css } from "../ui";
import { saveSet, set, useApp, withUndo } from "../store";
import { api } from "../lib/api";

const REPO = "https://github.com/aleuuu/hranilka";
const MS = (n: string, s = "") => <span style={css("font-family:'Material Symbols Rounded';line-height:1;" + s)}>{n}</span>;
const HEAD = (title: string, sub?: string) => (
  <div style={css("display:flex;flex-direction:column;gap:4px")}>
    <span style={css("font:500 14px 'Onest';color:#d6d6d9")}>{title}</span>
    {sub && <span style={css("font:400 13px/1.45 'Onest';color:#7a7a80")}>{sub}</span>}
  </div>
);
const CARD = "border-radius:12px;border:1px solid #222225;background:#1c1c1f;display:flex;flex-direction:column;gap:1px;overflow:hidden";
const SEG = "display:flex;padding:2px;border-radius:8px;background:#0b0b0c;border:1px solid #1f1f22;flex:none";
const segBtn = (on: boolean) => css(`height:28px;padding:0 11px;border-radius:6px;border:none;background:${on ? "#26262a" : "transparent"};color:${on ? "#ededee" : "#8b8b90"};font:500 12.5px 'Onest';cursor:pointer`);

function ToggleRow({ label, sub, on, onClick }: { label: string; sub: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={css("display:flex;align-items:center;gap:16px;padding:12px 16px;border:none;background:#111113;color:#ededee;cursor:pointer;text-align:left")}>
      <div style={css("flex:1;display:flex;flex-direction:column;gap:3px")}><span style={css("font:500 14px 'Onest'")}>{label}</span><span style={css("font:400 12px 'Onest';color:#7a7a80")}>{sub}</span></div>
      <span style={css(`width:34px;height:20px;flex:none;border-radius:10px;background:${on ? "oklch(0.72 0.15 155)" : "#2a2a2e"};position:relative;transition:background .2s`)}>
        <span style={css(`position:absolute;top:2px;left:${on ? 16 : 2}px;width:16px;height:16px;border-radius:8px;background:#fefefe;transition:left .2s cubic-bezier(.2,.8,.2,1)`)} />
      </span>
    </button>
  );
}

function InfoRow({ icon, title, sub, mono, action, onAction }: { icon: string; title: React.ReactNode; sub: string; mono?: boolean; action: React.ReactNode; onAction: () => void }) {
  return (
    <div style={css("display:flex;align-items:center;gap:12px;padding:12px 16px;background:#111113")}>
      {MS(icon, "font-size:19px;color:#8b8b90")}
      <div style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:2px")}>
        <span style={css("font:500 14px 'Onest'")}>{title}</span>
        <span style={css(`font:400 12px ${mono ? "'JetBrains Mono',monospace" : "'Onest'"};color:#7a7a80;word-break:break-all`)}>{sub}</span>
      </div>
      <B as="button" onClick={onAction} s="height:30px;padding:0 10px;border-radius:7px;border:none;background:transparent;color:#c9c9cd;font:500 13px 'Onest';cursor:pointer;display:flex;align-items:center;gap:6px;flex:none" h="background:#18181b">{action}</B>
    </div>
  );
}

export function Settings() {
  const s = useApp();
  const st = s.settings;
  const [about, setAbout] = useState<{ version: string; data: string; log: string } | null>(null);
  useEffect(() => {
    Promise.all([api.appVersion().catch(() => "0.3.0"), api.appPaths().catch(() => ({ data: "", log: "" }))]).then(([version, p]) => setAbout({ version, ...p }));
  }, []);
  const addNever = async () => {
    const d = await api.pickFolder();
    if (d && !st.excludes.some((x) => x.toLowerCase() === d.toLowerCase())) saveSet({ excludes: [...st.excludes, d] });
  };
  const removeNever = (p: string) => {
    const prev = st.excludes;
    saveSet({ excludes: prev.filter((x) => x !== p) });
    withUndo("«" + (p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || p) + "» больше не в списке «Не трогать»", () => saveSet({ excludes: prev }));
  };

  return (
    <div style={css("flex:1;min-height:0;overflow:auto;animation:fadein .4s ease both")}>
      <div style={css("max-width:720px;margin:0 auto;padding:26px 24px 40px;display:flex;flex-direction:column;gap:28px")}>
        <div style={css("display:flex;flex-direction:column;gap:10px")}>
          {HEAD("Оформление")}
          <div style={css(CARD)}>
            <div style={css("display:flex;align-items:center;gap:16px;padding:10px 16px;background:#111113")}>
              <span style={css("flex:1;font:500 14px 'Onest'")}>Тема</span>
              <div style={css(SEG)}>
                {([["dark", "Тёмная"], ["light", "Светлая"]] as const).map(([k, l]) => <button key={k} onClick={() => saveSet({ theme: { mode: k } })} style={segBtn(st.theme.mode === k)}>{l}</button>)}
              </div>
            </div>
          </div>
        </div>

        <div style={css("display:flex;flex-direction:column;gap:10px")}>
          {HEAD("Сортировка по умолчанию", "С этими настройками открывается экран «Разобрать». Для одной сортировки их можно поменять там же.")}
          <div style={css(CARD)}>
            <ToggleRow label="Переименовывать файлы" sub="Понятные имена по содержимому: «Оплата спортзала — авг 2026»" on={st.defRename} onClick={() => { saveSet({ defRename: !st.defRename }); set({ rename: !st.defRename }); }} />
            <ToggleRow label="Дата в начале имени для фото" sub="2026-07-19 День рождения 01.jpg" on={st.defDatePrefix} onClick={() => { saveSet({ defDatePrefix: !st.defDatePrefix }); set({ datePrefix: !st.defDatePrefix }); }} />
            <div style={css("display:flex;align-items:center;gap:16px;padding:10px 16px;background:#111113")}>
              <span style={css("flex:1;font:500 14px 'Onest'")}>Язык имён и папок</span>
              <div style={css(SEG)}>
                {([["ru", "Русский"], ["en", "English"]] as const).map(([k, l]) => <button key={k} onClick={() => { saveSet({ defLang: k }); set({ nameLang: k }); }} style={segBtn(st.defLang === k)}>{l}</button>)}
              </div>
            </div>
          </div>
        </div>

        <div style={css("display:flex;flex-direction:column;gap:10px")}>
          {HEAD("Анализ")}
          <div style={css(CARD)}>
            <ToggleRow label="Пауза, когда запущена игра" sub="Если видеокарта занята, анализ встанет на паузу сам и продолжится, когда игра закроется" on={st.autoPauseGames} onClick={() => saveSet({ autoPauseGames: !st.autoPauseGames })} />
            <ToggleRow label="Уведомления" sub="Когда план готов или модель скачана, а окно свёрнуто" on={st.notifyDone} onClick={() => saveSet({ notifyDone: !st.notifyDone })} />
          </div>
        </div>

        <div style={css("display:flex;flex-direction:column;gap:10px")}>
          <div style={css("display:flex;align-items:flex-end;gap:16px")}>
            <div style={css("flex:1")}>{HEAD("Не трогать никогда", "Эти папки Хранилка пропускает при любом разборе — даже если они лежат внутри выбранной папки.")}</div>
            <B as="button" onClick={addNever} s="height:34px;padding:0 12px;border-radius:8px;border:1px solid #2a2a2e;background:#18181b;color:#ededee;font:500 13px 'Onest';cursor:pointer;display:flex;align-items:center;gap:6px;flex:none" h="border-color:#3a3a3f">{MS("add", "font-size:17px")}Добавить папку</B>
          </div>
          {st.excludes.length === 0 ? (
            <div style={css("min-height:56px;padding:10px;border-radius:12px;border:1px dashed #2a2a2e;display:grid;place-items:center;font:400 13px 'Onest';color:#6d6d73;text-align:center")}>Пока пусто. Папки с кодом и программами Хранилка и так не трогает.</div>
          ) : (
            <div style={css(CARD)}>
              {st.excludes.map((p) => (
                <div key={p} style={css("display:flex;align-items:center;gap:12px;padding:11px 12px 11px 16px;background:#111113;animation:fadein .3s ease both")}>
                  {MS("folder_off", "font-size:18px;color:#8b8b90")}
                  <span style={css("flex:1;min-width:0;font:400 13px 'JetBrains Mono',monospace;color:#d6d6d9;word-break:break-all")}>{p}</span>
                  <B as="button" onClick={() => removeNever(p)} title="Убрать из списка" s="width:28px;height:28px;border-radius:7px;border:none;background:transparent;color:#6d6d73;cursor:pointer;display:grid;place-items:center;flex:none" h="background:#1f1f22;color:#ededee">{MS("close", "font-size:17px")}</B>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={css("display:flex;flex-direction:column;gap:10px")}>
          {HEAD("О приложении")}
          <div style={css(CARD)}>
            <InfoRow icon="inventory_2" title={<>Хранилка <span style={css("font:400 12px 'JetBrains Mono',monospace;color:#6d6d73")}>{about ? "v" + about.version : ""}</span></>}
              sub="Наводит порядок в фото и документах локальной моделью. Файлы не покидают компьютер." action={<>{MS("open_in_new", "font-size:16px")}GitHub</>} onAction={() => api.openUrl(REPO)} />
            <InfoRow icon="folder_data" title="Папка данных" sub={about?.data || "…"} mono action="Открыть" onAction={() => about?.data && api.openPath(about.data)} />
            <InfoRow icon="receipt_long" title="Журнал движка" sub="Пригодится, если что-то пошло не так" action="Открыть" onAction={() => about?.log && api.openPath(about.log)} />
          </div>
          <span style={css("display:flex;align-items:center;gap:8px;font:400 12px 'Onest';color:#6d6d73;margin-top:6px")}>{MS("shield", "font-size:16px;color:oklch(0.85 0.14 155)")}Настройки хранятся только на этом компьютере.</span>
        </div>
      </div>
    </div>
  );
}
