import { useEffect, useState } from "react";
import { Ic, css } from "../ui";
import { chooseModel, currentModel, go, pullModel, recommendedModel, set, useApp } from "../store";
import { api } from "../lib/api";
import { MODELS } from "../lib/types";
import type { ModelKey, ModelsInfo } from "../lib/types";
import { fmtGb, fmtSpeed } from "../lib/format";
import { Btn, Card, Note, Page, Row, Section, Spinner } from "./kit";

const ABOUT: Record<ModelKey, [string, string]> = {
  fast: ["bolt", "Для ноутбуков и видеокарт с памятью меньше 10 ГБ. Быстрее, но чаще путается в проектах."],
  accurate: ["neurology", "Для видеокарт от 10 ГБ. Лучше понимает скриншоты, сканы и документы."],
};

const sizeOf = (info: ModelsInfo | null, name: string) =>
  info?.models.find((m) => m.name === name || m.name === name + ":latest")?.size || 0;

export function Models() {
  const s = useApp();
  const [info, setInfo] = useState<ModelsInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [ask, setAsk] = useState<ModelKey | null>(null);
  const [deleting, setDeleting] = useState<ModelKey | null>(null);

  const load = () => api.ollamaModels().then((i) => { setInfo(i); setErr(null); set({ installed: i.models.map((m) => m.name) }); }).catch((e) => setErr(String(e?.message || e)));
  useEffect(() => {
    load();
    if (!s.sys) api.systemCheck().then((sys) => set({ sys })).catch(() => {});
  }, []);
  useEffect(() => { if (s.pull?.done) load(); }, [s.pull?.done]);

  const names = info?.models.map((m) => m.name) || [];
  const has = (name: string) => names.some((x) => x === name || x === name + ":latest");
  const cur = currentModel(s);
  const rec = s.sys ? recommendedModel(s.sys) : null;
  const embedOk = has("bge-m3");

  const start = async () => {
    setStarting(true);
    try { await api.ollamaStart(); } catch (e: any) { setErr(String(e?.message || e)); }
    setStarting(false);
    load();
  };
  const remove = async (k: ModelKey) => {
    setAsk(null);
    setDeleting(k);
    try { await api.ollamaDelete(MODELS[k].llm); } catch (e: any) { setErr(String(e?.message || e)); }
    setDeleting(null);
    load();
  };

  return (
    <Page>
      <Section title="Движок" desc="Модели работают через Ollama — бесплатный движок, который запускает нейросети прямо на компьютере. Интернет нужен только для скачивания.">
        <Card>
          <Row icon="memory" label={<>Ollama {info?.version && <span style={css("font:400 12px 'JetBrains Mono',monospace;color:#6d6d73")}>v{info.version}</span>}</>}
            desc={!info ? "Проверяю…" : info.running ? "Работает" : info.installed ? "Установлен, но не запущен" : "Не установлен"} last>
            {!info && <Spinner />}
            {info?.running && <span style={css("display:flex;align-items:center;gap:7px;font:500 12px 'Onest';color:oklch(0.85 0.12 155)")}><span style={css("width:8px;height:8px;border-radius:4px;background:oklch(0.8 0.16 155)")} />на связи</span>}
            {info && !info.running && info.installed && <Btn kind="primary" icon={starting ? undefined : "play_arrow"} disabled={starting} onClick={start}>{starting ? "Запускаю…" : "Запустить"}</Btn>}
            {info && !info.installed && <Btn kind="primary" icon="download" onClick={() => go("check")}>Установить</Btn>}
          </Row>
        </Card>
        {err && <Note icon="error" c="oklch(0.78 0.15 25)">{err}</Note>}
      </Section>

      <Section title="Модели" desc="Можно держать обе и переключаться: выбранная модель используется для следующих сортировок.">
        <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:10px")}>
          {(["fast", "accurate"] as ModelKey[]).map((k) => {
            const m = MODELS[k];
            const inst = has(m.llm);
            const used = cur === k && inst;
            const size = sizeOf(info, m.llm);
            const pulling = s.pullKey === k && s.pull && !s.pull.done;
            const p = s.pullKey === k ? s.pull : null;
            const pct = p && p.total ? Math.min(100, (p.completed / p.total) * 100) : 0;
            return (
              <div key={k} style={css(`border-radius:14px;border:1px solid ${used ? "oklch(0.72 0.15 155 / 0.55)" : "#1f1f22"};background:${used ? "#141416" : "#111113"};padding:14px;display:flex;flex-direction:column;gap:12px`)}>
                <div style={css("display:flex;align-items:center;gap:10px")}>
                  <Ic n={ABOUT[k][0]} s="width:38px;height:38px;border-radius:10px;background:#1b1b1e;display:grid;place-items:center;font-size:20px;color:#c9c9cd;flex:none" />
                  <div style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:2px")}>
                    <span style={css("font:500 16px 'Onest';color:#ededee")}>{m.name}</span>
                    <div style={css("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
                      <span style={css("font:400 12px 'JetBrains Mono',monospace;color:#6d6d73")}>{m.llm}</span>
                      {rec === k && <span style={css("height:18px;padding:0 6px;border-radius:5px;background:#1f1f22;font:400 11px 'Onest';color:#9a9aa0;display:inline-flex;align-items:center;white-space:nowrap;flex:none")}>для этого ПК</span>}
                    </div>
                  </div>
                  {used ? (
                    <span style={css("display:flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:12px;background:oklch(0.72 0.15 155 / 0.12);font:500 12px 'Onest';color:oklch(0.85 0.12 155)")}><Ic n="check" s="font-size:15px" />Используется</span>
                  ) : inst ? (
                    <span style={css("height:24px;padding:0 9px;border-radius:12px;background:#1c1c1f;font:500 12px/24px 'Onest';color:#9a9aa0")}>Скачана</span>
                  ) : (
                    <span style={css("height:24px;padding:0 9px;border-radius:12px;border:1px dashed #2e2e33;font:500 12px/22px 'Onest';color:#6d6d73")}>Не скачана</span>
                  )}
                </div>
                <span style={css("font:400 12.5px/1.45 'Onest';color:#9a9aa0;min-height:36px")}>{ABOUT[k][1]}</span>
                <div style={css("display:flex;gap:16px;font:400 12px 'Onest';color:#6d6d73")}>
                  <span><b style={css("font:500 13px 'JetBrains Mono',monospace;color:#d6d6d9")}>{inst && size ? fmtGb(size) : "≈" + m.sizeGb}</b> ГБ {inst ? "на диске" : "скачать"}</span>
                  {used && s.secPerFile && s.secPerFile > 0 && <span><b style={css("font:500 13px 'JetBrains Mono',monospace;color:#d6d6d9")}>~{Math.round(s.secPerFile)}</b> с на файл на этом ПК</span>}
                </div>
                {p && (pulling || p.error) && (
                  <div style={css("display:flex;flex-direction:column;gap:6px")}>
                    <div style={css("height:6px;border-radius:3px;background:#1c1c1f;overflow:hidden")}><div style={css(`height:100%;width:${pct.toFixed(1)}%;background:oklch(0.8 0.16 155);border-radius:3px;transition:width .4s`)} /></div>
                    <span style={css("font:400 11.5px 'JetBrains Mono',monospace;color:#8b8b90")}>
                      {p.error ? <span style={css("font:400 12px 'Onest';color:oklch(0.82 0.13 25)")}>{p.error.kind === "vpn" ? "Похоже, мешает VPN — выключите его и повторите" : p.error.message}</span>
                        : s.pullPaused ? `на паузе · ${fmtGb(p.completed)} из ${fmtGb(p.total)} ГБ` : `${fmtGb(p.completed)} из ${fmtGb(p.total)} ГБ · ${fmtSpeed(p.speed)}`}
                    </span>
                  </div>
                )}
                {ask === k ? (
                  <div style={css("display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:10px;background:#18181b;border:1px solid #26262a;animation:fadein .2s ease both")}>
                    <span style={css("flex:1;font:400 12.5px/1.4 'Onest';color:#d6d6d9")}>Удалить «{m.name}»{size ? ` (${fmtGb(size)} ГБ)` : ""}? Скачать заново можно в любой момент.</span>
                    <Btn kind="danger" onClick={() => remove(k)}>Удалить</Btn>
                    <Btn kind="ghost" onClick={() => setAsk(null)}>Нет</Btn>
                  </div>
                ) : (
                  <div style={css("display:flex;gap:8px;margin-top:auto")}>
                    {inst && !used && <Btn kind="primary" icon="check" onClick={() => chooseModel(k)}>Использовать</Btn>}
                    {!inst && !pulling && <Btn kind="primary" icon="download" disabled={!!s.pullKey && s.pullKey !== k && !!s.pull && !s.pull.done || !info?.running} onClick={() => pullModel(k)}>{p?.error ? "Повторить" : "Скачать"}</Btn>}
                    {pulling && <Btn icon="pause" onClick={() => { api.pullPause(); set({ pullKey: null, pullPaused: false, pull: null }); }}>Остановить</Btn>}
                    {inst && !used && <Btn kind="ghost" icon={deleting === k ? undefined : "delete"} disabled={deleting === k} onClick={() => setAsk(k)}>{deleting === k ? "Удаляю…" : "Удалить"}</Btn>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <Card>
          <Row icon="join_inner" label={<>Поиск похожих <span style={css("font:400 11.5px 'JetBrains Mono',monospace;color:#6d6d73")}>bge-m3</span></>}
            desc="Маленькая модель, которая находит похожие файлы и учится на ваших правках. Нужна обеим." last>
            {embedOk ? <span style={css("font:400 12px 'Onest';color:#8b8b90")}>{fmtGb(sizeOf(info, "bge-m3"))} ГБ · скачана</span>
              : <span style={css("font:400 12px 'Onest';color:oklch(0.86 0.13 85)")}>скачается вместе с моделью</span>}
          </Row>
        </Card>
      </Section>

      {info && (
        <Section title="Где лежат модели">
          <Card>
            <Row icon="folder" label={<span style={css("font:400 12px 'JetBrains Mono',monospace;word-break:break-all")}>{info.modelsDir}</span>}
              desc={info.diskFreeGb != null ? `Свободно ${Math.round(info.diskFreeGb)} ГБ на диске ${info.diskLabel || ""}` : undefined} last>
              <Btn kind="ghost" onClick={() => api.openPath(info.modelsDir)}>Открыть</Btn>
            </Row>
          </Card>
        </Section>
      )}
    </Page>
  );
}
