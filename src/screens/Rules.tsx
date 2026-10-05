import { useEffect, useState } from "react";
import { B, C, Ic, css, topColor } from "../ui";
import { get, saveSet, uid, useApp } from "../store";
import { api } from "../lib/api";
import type { Project, Rule, RuleField, RuleRename } from "../lib/types";
import { nf, plural } from "../lib/format";
import { Btn, Card, Chip, Field, Note, Page, Section, Select } from "./kit";

const FIELDS: [RuleField, string][] = [["name", "Имя содержит"], ["text", "Текст содержит"], ["from", "Лежит в папке"], ["type", "Тип файла"]];
const TYPES: [string, string][] = [["photo", "Фото"], ["screenshot", "Скриншоты"], ["image", "Картинки"], ["doc", "Документы"], ["pdf", "PDF"], ["table", "Таблицы"], ["video", "Видео"], ["audio", "Аудио"]];
const RENAMES: [RuleRename, string][] = [["auto", "Имя — как предложит модель"], ["keep", "Не переименовывать"], ["date", "Дата в начале имени"]];
const PH: Record<RuleField, string> = { name: "чек, invoice", text: "договор аренды", from: "Telegram Desktop", type: "" };

const words = (s: string) => s.split(/[,;]+/).map((w) => w.trim()).filter(Boolean);
const showYear = (p: string) => p.replace(/\{\{?year\}?\}/g, "{год}");
const saveYear = (p: string) => p.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").replace(/\{год\}/gi, "{year}");

function ProjectRow({ p, last }: { p: Project; last: boolean }) {
  const [adding, setAdding] = useState(false);
  const [kw, setKw] = useState("");
  const update = (patch: Partial<Project>) => saveSet({ projects: get().settings.projects.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) });
  const addKw = () => {
    const add = words(kw).filter((w) => !p.keywords.some((k) => k.toLowerCase() === w.toLowerCase()));
    if (add.length) update({ keywords: [...p.keywords, ...add] });
    setKw(""); setAdding(false);
  };
  return (
    <div style={css(`display:flex;align-items:center;gap:12px;min-height:50px;padding:8px 10px 8px 14px;border-bottom:1px solid ${last ? "transparent" : "#1a1a1d"}`)}>
      <Ic n="folder" s={`font-size:19px;color:${C.v};font-variation-settings:'FILL' 1;flex:none`} />
      <span style={css("font:500 13.5px 'Onest';color:#ededee;flex:none;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")} title={"Проекты/" + p.name}>{p.name}</span>
      <div style={css("flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:5px;align-items:center")}>
        {p.keywords.map((k) => <Chip key={k} onRemove={() => update({ keywords: p.keywords.filter((x) => x !== k) })}>{k}</Chip>)}
        {adding ? (
          <Field value={kw} onChange={setKw} placeholder="слово, ещё слово" onEnter={addKw} s="height:26px;width:170px;font-size:12px" />
        ) : (
          <B as="button" onClick={() => setAdding(true)} title="Слова, по которым узнавать файлы проекта"
            s="height:24px;padding:0 9px;border-radius:12px;border:1px dashed #2e2e33;background:transparent;color:#8b8b90;font:400 12px 'Onest';cursor:pointer;display:inline-flex;align-items:center;gap:3px"
            h="border-color:#4a4a50;color:#ededee"><Ic n="add" s="font-size:14px" />{p.keywords.length ? "слово" : "ключевые слова"}</B>
        )}
        {adding && <Btn kind="ghost" s="height:26px" onClick={addKw}>Готово</Btn>}
      </div>
      <Btn kind="ghost" icon="close" title="Удалить проект" onClick={() => saveSet({ projects: get().settings.projects.filter((x) => x.id !== p.id) })} />
    </div>
  );
}

function Projects() {
  const s = useApp();
  const list = s.settings.projects;
  const [name, setName] = useState("");
  const [kw, setKw] = useState("");
  const add = (n = name, k = kw) => {
    const nm = n.trim().replace(/[\\/:*?"<>|]+/g, " ").trim();
    if (!nm) return;
    if (get().settings.projects.some((p) => p.name.toLowerCase() === nm.toLowerCase())) { setName(""); setKw(""); return; }
    saveSet({ projects: [...get().settings.projects, { id: uid(), name: nm, keywords: words(k) }] });
    setName(""); setKw("");
  };
  const seen = new Set(list.map((p) => p.name.toLowerCase()));
  const suggest = (s.plan?.projects || []).filter((p) => !seen.has(p.toLowerCase()));

  return (
    <Section title="Мои проекты" desc={<>Если название проекта или ключевое слово есть в имени файла, на скриншоте или в описании — файл ляжет в «Проекты/<i>название</i>». Даже если модель решила иначе.</>}>
      <Card>
        {list.map((p) => <ProjectRow key={p.id} p={p} last={false} />)}
        <div style={css("display:flex;align-items:center;gap:8px;padding:10px")}>
          <Field value={name} onChange={setName} placeholder="Название, например Ремонт" onEnter={() => add()} s="width:220px" />
          <Field value={kw} onChange={setKw} placeholder="Ключевые слова через запятую: смета, плитка" onEnter={() => add()} s="flex:1" />
          <Btn kind={name.trim() ? "primary" : "secondary"} icon="add" disabled={!name.trim()} onClick={() => add()}>Добавить</Btn>
        </div>
      </Card>
      {suggest.length > 0 && (
        <div style={css("display:flex;align-items:center;gap:6px;flex-wrap:wrap;font:400 12px 'Onest';color:#6d6d73")}>
          Нашлись в последнем плане:
          {suggest.map((p) => <Btn key={p} kind="ghost" icon="add" onClick={() => add(p, "")}>{p}</Btn>)}
        </div>
      )}
    </Section>
  );
}

function RuleRow({ r, last }: { r: Rule; last: boolean }) {
  const field = FIELDS.find((f) => f[0] === r.field)?.[1] || "";
  const val = r.field === "type" ? TYPES.find((t) => t[0] === r.value)?.[1] || r.value : r.value;
  return (
    <div style={css(`display:flex;align-items:center;gap:10px;min-height:46px;padding:8px 10px 8px 14px;border-bottom:1px solid ${last ? "transparent" : "#1a1a1d"};font:400 13px 'Onest';color:#9a9aa0`)}>
      <span style={css("flex:none")}>Если</span>
      <span style={css("color:#d6d6d9;flex:none")}>{field.toLowerCase()}</span>
      <span style={css("height:24px;padding:0 8px;border-radius:6px;background:#1c1c1f;color:#ededee;font:500 12.5px/24px 'Onest';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px")}>{val}</span>
      <Ic n="arrow_forward" s="font-size:16px;color:#6d6d73;flex:none" />
      <span style={css("display:inline-flex;align-items:center;gap:5px;min-width:0;color:#ededee")}>
        <Ic n="folder" s={`font-size:16px;color:${topColor(r.folder)};font-variation-settings:'FILL' 1;flex:none`} />
        <span style={css("white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{showYear(r.folder).replace(/\//g, " / ")}</span>
      </span>
      {r.rename !== "auto" && <span style={css("font:400 12px 'Onest';color:#6d6d73;flex:none")}>· {r.rename === "keep" ? "имя как есть" : "дата в начале"}</span>}
      <Btn kind="ghost" icon="close" title="Удалить правило" s="margin-left:auto" onClick={() => saveSet({ rules: get().settings.rules.filter((x) => x.id !== r.id) })} />
    </div>
  );
}

function RuleList() {
  const s = useApp();
  const list = s.settings.rules;
  const [field, setField] = useState<RuleField>("name");
  const [value, setValue] = useState("");
  const [type, setType] = useState("screenshot");
  const [folder, setFolder] = useState("");
  const [rename, setRename] = useState<RuleRename>("auto");
  const v = field === "type" ? type : value.trim();
  const ok = !!v && !!saveYear(folder);
  const add = () => {
    if (!ok) return;
    saveSet({ rules: [...get().settings.rules, { id: uid(), field, value: v, folder: saveYear(folder), rename }] });
    setValue(""); setFolder(""); setRename("auto");
  };
  return (
    <Section title="Правила" desc="Если файл подходит под правило — кладём в нужную папку. Правила проверяются сверху вниз и сильнее проектов.">
      <Card>
        {list.map((r) => <RuleRow key={r.id} r={r} last={false} />)}
        <div style={css("display:flex;flex-direction:column;gap:8px;padding:10px")}>
          <div style={css("display:flex;align-items:center;gap:8px")}>
            <span style={css("font:400 13px 'Onest';color:#8b8b90;flex:none")}>Если</span>
            <Select value={field} options={FIELDS} onChange={setField} s="width:156px" />
            {field === "type"
              ? <Select value={type} options={TYPES} onChange={setType} s="flex:1" />
              : <Field value={value} onChange={setValue} placeholder={PH[field]} onEnter={add} s="flex:1" />}
            <Ic n="arrow_forward" s="font-size:17px;color:#6d6d73;flex:none" />
            <Field value={folder} onChange={setFolder} placeholder="Документы/Чеки/{год}" onEnter={add} s="flex:1" />
          </div>
          <div style={css("display:flex;align-items:center;gap:8px")}>
            <Select value={rename} options={RENAMES} onChange={setRename} s="width:236px" />
            <span style={css("flex:1;font:400 12px 'Onest';color:#5d5d63")}>Вложенные папки — через «/», {"{год}"} подставит год файла. Несколько слов — через запятую.</span>
            <Btn kind={ok ? "primary" : "secondary"} icon="add" disabled={!ok} onClick={add}>Добавить</Btn>
          </div>
        </div>
      </Card>
    </Section>
  );
}

function Learned() {
  const [info, setInfo] = useState<{ count: number; folders: { folder: string; n: number }[] } | null>(null);
  const [ask, setAsk] = useState(false);
  const [err, setErr] = useState(false);
  useEffect(() => { api.learnedInfo().then(setInfo).catch(() => setErr(true)); }, []);
  const reset = async () => { setAsk(false); try { setInfo(await api.learnedReset().then(() => ({ count: 0, folders: [] }))); } catch { setErr(true); } };
  return (
    <Section title="Выученные примеры" desc="Перетащили файл в плане в другую папку и нажали «Запомнить» — Хранилка запоминает пример, и похожие файлы потом сразу ложатся туда же.">
      <Card>
        <div style={css("display:flex;align-items:center;gap:12px;min-height:50px;padding:8px 10px 8px 14px")}>
          <Ic n="school" s="font-size:19px;color:#8b8b90;flex:none" />
          <div style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:5px")}>
            <span style={css("font:400 13px 'Onest';color:#d6d6d9")}>
              {err ? "Не получилось прочитать — движок ещё запускается" : !info ? "Считаю…" : info.count ? `${nf(info.count)} ${plural(info.count, ["пример", "примера", "примеров"])}` : "Пока ничего — запоминается из плана, кнопкой «Запомнить»"}
            </span>
            {info && info.folders.length > 0 && (
              <div style={css("display:flex;flex-wrap:wrap;gap:5px")}>
                {info.folders.map((f) => <Chip key={f.folder}><Ic n="folder" s={`font-size:13px;color:${topColor(f.folder)};font-variation-settings:'FILL' 1`} />{f.folder.replace(/\//g, " / ")} <span style={css("color:#6d6d73")}>{f.n}</span></Chip>)}
              </div>
            )}
          </div>
          {info && info.count > 0 && !ask && <Btn kind="ghost" icon="restart_alt" onClick={() => setAsk(true)}>Забыть всё</Btn>}
          {ask && <><span style={css("font:400 12.5px 'Onest';color:#d6d6d9")}>Забыть все примеры?</span><Btn kind="danger" onClick={reset}>Забыть</Btn><Btn kind="ghost" onClick={() => setAsk(false)}>Нет</Btn></>}
        </div>
      </Card>
    </Section>
  );
}

export function Rules() {
  const s = useApp();
  const n = s.settings.projects.length + s.settings.rules.length;
  return (
    <Page wide>
      <Note icon="lightbulb" c="oklch(0.86 0.13 85)">
        Подскажите, как вы раскладываете файлы, — это срабатывает раньше модели. Так файлы одного проекта не разъедутся по разным папкам.
        {s.plan && n > 0 && " Открытый план пересоберётся, когда вернётесь к нему."}
      </Note>
      <Projects />
      <RuleList />
      <Learned />
    </Page>
  );
}
