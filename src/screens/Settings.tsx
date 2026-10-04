import { useEffect, useState } from "react";
import { B, Ic, css } from "../ui";
import { saveSet, set, useApp } from "../store";
import { api } from "../lib/api";
import { ACCENTS, BASES, resolve, themeVars } from "../theme";
import type { Accent, Base, ThemeCfg, ThemeMode } from "../theme";
import { Btn, Card, Page, Row, Section, Seg, Toggle } from "./kit";

const MODES: [ThemeMode, string][] = [["system", "Системная"], ["light", "Светлая"], ["dark", "Тёмная"], ["custom", "Своя"]];
const CAPS = "font:500 11px 'Onest';letter-spacing:.07em;color:#6d6d73;text-transform:uppercase";
const REPO = "https://github.com/aleuuu/hranilka";

/** Маленькое окно Хранилки в цветах темы: переменные темы вешаются на само превью. */
function Mini({ base, accent }: { base: Base; accent: Accent }) {
  const vars = themeVars({ base, accent }) as any;
  return (
    <div style={{ ...vars, ...css("position:absolute;inset:0;background:#0e0e0f;display:flex;flex-direction:column") }}>
      <div style={css("height:9px;background:#0b0b0c;border-bottom:1px solid #1c1c1f")} />
      <div style={css("flex:1;display:flex;min-height:0")}>
        <div style={css("width:26%;background:#0b0b0c;border-right:1px solid #1c1c1f;padding:6px 5px;display:flex;flex-direction:column;gap:4px")}>
          <span style={css("height:5px;border-radius:2px;background:#26262a")} />
          <span style={css("height:4px;width:70%;border-radius:2px;background:#1f1f22")} />
          <span style={css("height:4px;width:80%;border-radius:2px;background:#1f1f22")} />
          <span style={css("margin-top:auto;width:5px;height:5px;border-radius:3px;background:oklch(0.8 0.16 155)")} />
        </div>
        <div style={css("flex:1;padding:7px 8px;display:flex;flex-direction:column;gap:5px")}>
          <span style={css("height:5px;width:55%;border-radius:2px;background:#d6d6d9")} />
          <span style={css("height:4px;width:80%;border-radius:2px;background:#2a2a2e")} />
          <div style={css("display:flex;align-items:center;gap:5px;margin-top:auto")}>
            <span style={css("width:16px;height:9px;border-radius:5px;background:oklch(0.72 0.15 155);position:relative")}><span style={css("position:absolute;right:1px;top:1px;width:7px;height:7px;border-radius:4px;background:#fefefe")} /></span>
            <span style={css("height:9px;width:22px;border-radius:3px;background:#ededee;margin-left:auto")} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeCard({ mode, label, sel, onClick }: { mode: ThemeMode; label: string; sel: boolean; onClick: () => void }) {
  const r = resolve({ mode, base: "graphite", accent: "green" });
  return (
    <B as="button" onClick={onClick}
      s={`display:flex;flex-direction:column;gap:9px;padding:8px 8px 10px;border-radius:12px;border:1px solid ${sel ? "oklch(0.72 0.15 155)" : "#222225"};background:${sel ? "#18181b" : "#121214"};cursor:pointer;text-align:left;transition:border-color .2s,background .2s`}
      h={sel ? undefined : "border-color:#2e2e33;background:#151517"}>
      <div style={css("position:relative;height:62px;border-radius:8px;overflow:hidden;border:1px solid #1f1f22")}>
        {mode === "system" ? (
          <>
            <Mini base="graphite" accent="green" />
            <div style={css("position:absolute;inset:0;clip-path:polygon(62% 0,100% 0,100% 100%,38% 100%)")}><Mini base="light" accent="green" /></div>
          </>
        ) : mode === "custom" ? (
          <>
            <Mini base="midnight" accent="purple" />
            <div style={css("position:absolute;inset:0;clip-path:polygon(62% 0,100% 0,100% 100%,38% 100%)")}><Mini base="oled" accent="orange" /></div>
          </>
        ) : <Mini base={r.base} accent={r.accent} />}
      </div>
      <div style={css("display:flex;align-items:center;gap:7px;padding:0 2px")}>
        <span style={css(`width:14px;height:14px;border-radius:7px;border:1.5px solid ${sel ? "oklch(0.72 0.15 155)" : "#3a3a3f"};display:grid;place-items:center;flex:none`)}>
          {sel && <span style={css("width:6px;height:6px;border-radius:3px;background:oklch(0.72 0.15 155)")} />}
        </span>
        <span style={css(`font:500 13px 'Onest';color:${sel ? "#ededee" : "#c9c9cd"}`)}>{label}</span>
      </div>
    </B>
  );
}

function ThemeBlock() {
  const s = useApp();
  const t = s.settings.theme;
  const r = resolve(t);
  const put = (cfg: ThemeCfg) => saveSet({ theme: cfg });
  return (
    <Section title="Оформление">
      <div style={css("display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px")}>
        {MODES.map(([m, l]) => <ModeCard key={m} mode={m} label={l} sel={t.mode === m} onClick={() => put({ ...t, mode: m, ...(m === "custom" && t.mode !== "custom" ? { base: r.base, accent: r.accent } : null) })} />)}
      </div>
      <div style={css("display:flex;flex-direction:column;gap:10px;margin-top:6px")}>
        <span style={css(CAPS)}>Основа</span>
        <div style={css("display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px")}>
          {BASES.map(([b, l]) => {
            const sel = r.base === b;
            const v = themeVars({ base: b, accent: r.accent }) as any;
            return (
              <B as="button" key={b} onClick={() => put({ mode: "custom", base: b, accent: r.accent })}
                s={`height:44px;display:flex;align-items:center;gap:10px;padding:0 12px;border-radius:10px;border:1px solid ${sel ? "oklch(0.72 0.15 155)" : "#222225"};background:${sel ? "#18181b" : "#121214"};cursor:pointer;color:#ededee`}
                h={sel ? undefined : "border-color:#2e2e33;background:#151517"}>
                <span style={{ ...v, ...css("width:22px;height:22px;border-radius:7px;background:#0e0e0f;border:1px solid #3a3a3f;flex:none;position:relative;overflow:hidden") }}>
                  <span style={css("position:absolute;left:0;top:0;bottom:0;width:45%;background:#0b0b0c")} />
                  <span style={css("position:absolute;right:4px;top:5px;width:6px;height:2px;border-radius:1px;background:#d6d6d9")} />
                  <span style={css("position:absolute;right:4px;top:10px;width:8px;height:2px;border-radius:1px;background:#4a4a50")} />
                </span>
                <span style={css(`font:500 13px 'Onest';color:${sel ? "#ededee" : "#c9c9cd"}`)}>{l}</span>
              </B>
            );
          })}
        </div>
        <span style={css(CAPS + ";margin-top:6px")}>Акцент</span>
        <div style={css("display:flex;gap:12px;align-items:center")}>
          {ACCENTS.map(([a, h, l]) => {
            const sel = r.accent === a;
            return (
              <button key={a} onClick={() => put({ mode: "custom", base: r.base, accent: a })} title={l}
                style={css(`width:30px;height:30px;border-radius:15px;padding:0;border:2px solid ${sel ? "#ededee" : "transparent"};background:transparent;cursor:pointer;display:grid;place-items:center;transition:border-color .2s`)}>
                <span style={{ background: `oklch(0.72 0.15 ${h})`, ...css("width:22px;height:22px;border-radius:11px;display:grid;place-items:center") }}>
                  {sel && <span data-ms="" style={css("font-size:15px;color:#fefefe")}>check</span>}
                </span>
              </button>
            );
          })}
        </div>
        <span style={css("font:400 12.5px/1.45 'Onest';color:#6d6d73")}>Акцентом подсвечиваются переключатели, статус модели и отметки «готово».</span>
      </div>
    </Section>
  );
}

export function Settings() {
  const s = useApp();
  const st = s.settings;
  const [about, setAbout] = useState<{ version: string; data: string; log: string } | null>(null);
  useEffect(() => {
    Promise.all([api.appVersion().catch(() => "0.1.0"), api.appPaths().catch(() => ({ data: "", log: "" }))])
      .then(([version, p]) => setAbout({ version, ...p }));
  }, []);
  const addExclude = async () => {
    const d = await api.pickFolder();
    if (d && !st.excludes.some((x) => x.toLowerCase() === d.toLowerCase())) saveSet({ excludes: [...st.excludes, d] });
  };

  return (
    <Page>
      <ThemeBlock />

      <Section title="Сортировка по умолчанию" desc="С этими настройками открывается экран «Разобрать». Для одной сортировки их можно поменять там же.">
        <Card>
          <Row label="Переименовывать файлы" desc="Понятные имена по содержимому: «Оплата Термоленд — авг 2026»">
            <Toggle on={st.defRename} onClick={() => { saveSet({ defRename: !st.defRename }); set({ rename: !st.defRename }); }} />
          </Row>
          <Row label="Дата в начале имени для фото" desc="2026-07-19 Вечеринка у Ани 01.jpg">
            <Toggle on={st.defDatePrefix} onClick={() => { saveSet({ defDatePrefix: !st.defDatePrefix }); set({ datePrefix: !st.defDatePrefix }); }} />
          </Row>
          <Row label="Язык имён и папок" last>
            <Seg value={st.defLang} options={[["ru", "Русский"], ["en", "English"]]} onChange={(v) => { saveSet({ defLang: v }); set({ nameLang: v }); }} />
          </Row>
        </Card>
      </Section>

      <Section title="Анализ">
        <Card>
          <Row label="Пауза, когда запущена игра" desc="Если видеокарта занята, анализ встанет на паузу сам и продолжится, когда игра закроется">
            <Toggle on={st.autoPauseGames} onClick={() => saveSet({ autoPauseGames: !st.autoPauseGames })} />
          </Row>
          <Row label="Уведомления" desc="Когда план готов или модель скачана, а окно свёрнуто" last>
            <Toggle on={st.notifyDone} onClick={() => saveSet({ notifyDone: !st.notifyDone })} />
          </Row>
        </Card>
      </Section>

      <Section title="Не трогать никогда" desc="Эти папки Хранилка пропускает при любом разборе — даже если они лежат внутри выбранной папки."
        right={<Btn icon="add" onClick={addExclude}>Добавить папку</Btn>}>
        {st.excludes.length > 0 ? (
          <Card>
            {st.excludes.map((p, i) => (
              <Row key={p} icon="folder_off" label={p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || p} desc={<span style={css("font:400 11px 'JetBrains Mono',monospace")}>{p}</span>} last={i === st.excludes.length - 1}>
                <Btn kind="ghost" icon="close" title="Убрать из списка" onClick={() => saveSet({ excludes: st.excludes.filter((x) => x !== p) })} />
              </Row>
            ))}
          </Card>
        ) : (
          <div style={css("padding:14px;border-radius:12px;border:1px dashed #26262a;font:400 12.5px 'Onest';color:#6d6d73;text-align:center")}>Пока пусто. Папки с кодом и программами Хранилка и так не трогает.</div>
        )}
      </Section>

      <Section title="О приложении">
        <Card>
          <Row icon="inventory_2" label={<>Хранилка <span style={css("font:400 12px 'JetBrains Mono',monospace;color:#6d6d73")}>{about ? "v" + about.version : ""}</span></>} desc="Наводит порядок в фото и документах локальной моделью. Файлы не покидают компьютер.">
            <Btn kind="ghost" icon="open_in_new" onClick={() => api.openUrl(REPO)}>GitHub</Btn>
          </Row>
          <Row icon="folder_data" label="Папка данных" desc={<span style={css("font:400 11px 'JetBrains Mono',monospace;word-break:break-all")}>{about?.data || "…"}</span>}>
            <Btn kind="ghost" onClick={() => about?.data && api.openPath(about.data)}>Открыть</Btn>
          </Row>
          <Row icon="receipt_long" label="Журнал движка" desc="Пригодится, если что-то пошло не так" last>
            <Btn kind="ghost" onClick={() => about?.log && api.openPath(about.log)}>Открыть</Btn>
          </Row>
        </Card>
      </Section>
      <div style={css("display:flex;align-items:center;gap:8px;font:400 12px 'Onest';color:#5d5d63")}>
        <Ic n="shield" s="font-size:16px;color:oklch(0.85 0.14 155)" />Настройки хранятся только на этом компьютере.
      </div>
    </Page>
  );
}
