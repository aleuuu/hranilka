import { useEffect, useState } from "react";
import { Ic, css } from "../ui";
import { checkWatch, get, go, loadQuick, saveSet, selectFolder, useApp } from "../store";
import { api } from "../lib/api";
import type { WatchFolder } from "../lib/types";
import { nf, plural } from "../lib/format";
import { Btn, Card, Note, Page, Row, Section, Seg, Spinner, Toggle } from "./kit";

const baseName = (p: string) => p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || p;
const same = (a: string, b: string) => a.replace(/[\\/]+$/, "").toLowerCase() === b.replace(/[\\/]+$/, "").toLowerCase();

export function Watch() {
  const s = useApp();
  const st = s.settings;
  const [auto, setAuto] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    api.autostart().then(setAuto).catch(() => setAuto(null));
    if (!s.quick.length) loadQuick();
    refresh();
  }, []);

  const refresh = async () => {
    setChecking(true);
    try { await checkWatch(); } finally { setChecking(false); }
  };
  const put = (list: WatchFolder[]) => saveSet({ watch: list });
  const add = (path: string, name?: string) => {
    if (st.watch.some((w) => same(w.path, path))) return;
    put([...get().settings.watch, { path, name: name || baseName(path), on: true, since: Date.now(), count: 0, examples: [], exists: true, notified: 0 }]);
  };
  const pick = async () => { const d = await api.pickFolder(); if (d) add(d); };
  const toggleAuto = async () => {
    try { setAuto(await api.autostart(!auto)); } catch { /* в браузере автозапуска нет */ }
  };
  const sortNow = (w: WatchFolder) => { go("start"); selectFolder(w.path, w.name); };
  const suggest = s.quick.filter((q) => !st.watch.some((w) => same(w.path, q.path))).slice(0, 3);
  const anyOn = st.watch.some((w) => w.on);

  return (
    <Page>
      <Note icon="visibility">
        Раз в 10 минут Хранилка заглядывает в эти папки и напишет, когда там накопятся новые файлы. Сама она ничего не переносит — разбор только по вашей команде.
      </Note>

      <Section title="Папки" right={<div style={css("display:flex;gap:6px")}>
        {st.watch.length > 0 && <Btn kind="ghost" icon={checking ? undefined : "refresh"} disabled={checking} onClick={refresh}>{checking ? <><Spinner size={12} />Проверяю</> : "Проверить сейчас"}</Btn>}
        <Btn icon="add" onClick={pick}>Добавить папку</Btn>
      </div>}>
        {st.watch.length === 0 ? (
          <div style={css("display:flex;flex-direction:column;align-items:center;gap:12px;padding:34px 20px;border-radius:14px;border:1px dashed #26262a;text-align:center")}>
            <Ic n="visibility" s="width:48px;height:48px;border-radius:13px;background:#141416;border:1px solid #222225;display:grid;place-items:center;font-size:24px;color:#6d6d73" />
            <span style={css("font:500 14px 'Onest';color:#d6d6d9")}>Пока ни за чем не следим</span>
            <span style={css("font:400 13px/1.5 'Onest';color:#8b8b90;max-width:380px")}>Обычно это «Загрузки» и «Рабочий стол» — туда всё падает само.</span>
            {suggest.length > 0 && (
              <div style={css("display:flex;gap:8px;flex-wrap:wrap;justify-content:center")}>
                {suggest.map((q) => <Btn key={q.path} icon={q.icon} onClick={() => add(q.path, q.name)}>{q.name}</Btn>)}
              </div>
            )}
          </div>
        ) : (
          <Card>
            {st.watch.map((w, i) => {
              const ready = w.on && w.count > 0;
              const desc = !w.exists ? "Папка не найдена — возможно, её переименовали или удалили"
                : !w.on ? "Слежение выключено"
                : w.count ? `${nf(w.count)} ${plural(w.count, ["новый файл", "новых файла", "новых файлов"])}${w.examples.length ? ": " + w.examples.join(", ") : ""}`
                : "Новых файлов нет";
              return (
                <Row key={w.path} icon={w.exists ? "folder" : "folder_off"} last={i === st.watch.length - 1}
                  label={<span title={w.path} style={css("display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{w.name} <span style={css("font:400 11px 'JetBrains Mono',monospace;color:#5d5d63")}>{w.path}</span></span>}
                  desc={<span style={css(`color:${ready && w.count >= st.watchThreshold ? "oklch(0.86 0.13 85)" : "#6d6d73"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block`)}>{desc}</span>}>
                  {ready && <Btn kind="primary" icon="auto_awesome" disabled={s.flow === "analysis"} title={s.flow === "analysis" ? "Сейчас идёт другой анализ" : undefined} onClick={() => sortNow(w)}>Разобрать</Btn>}
                  <Toggle on={w.on} title={w.on ? "Не следить" : "Следить"} onClick={() => put(get().settings.watch.map((x) => (x.path === w.path ? { ...x, on: !x.on, since: x.on ? x.since : Date.now(), notified: 0 } : x)))} />
                  <Btn kind="ghost" icon="close" title="Убрать из списка" onClick={() => put(get().settings.watch.filter((x) => x.path !== w.path))} />
                </Row>
              );
            })}
          </Card>
        )}
        {st.watch.length > 0 && suggest.length > 0 && (
          <div style={css("display:flex;align-items:center;gap:8px;flex-wrap:wrap;font:400 12px 'Onest';color:#6d6d73")}>
            Ещё можно следить за:
            {suggest.map((q) => <Btn key={q.path} kind="ghost" icon="add" onClick={() => add(q.path, q.name)}>{q.name}</Btn>)}
          </div>
        )}
      </Section>

      <Section title="Когда напоминать">
        <Card>
          <Row label="Новых файлов накопилось" desc="Считаются только личные файлы: фото, документы, видео и музыка">
            <Seg value={st.watchThreshold} options={[[10, "10"], [20, "20"], [50, "50"]]} onChange={(v) => saveSet({ watchThreshold: v })} />
          </Row>
          <Row label="Запускать вместе с Windows" desc={auto === null ? "Недоступно в этой сборке" : "Свёрнутой в трей — чтобы следить, даже если окно не открывали"} last={!anyOn}>
            <Toggle on={!!auto} onClick={toggleAuto} />
          </Row>
          {anyOn && <Row icon="info" label="Закрытие окна" desc="Пока включено слежение, крестик прячет Хранилку в трей. Выйти совсем — через значок в трее." last />}
        </Card>
      </Section>
    </Page>
  );
}
