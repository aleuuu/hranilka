import { useEffect, useMemo, useState } from "react";
import { B, C, Ic, css, useTicker } from "../ui";
import {
  AppState, currentModel, describeSample, finishOnboarding, get, go, modelInstalled, recommendedModel, runSystemCheck,
  set, startPull, togglePullPause, useApp,
} from "../store";

let checking = false;
import { api } from "../lib/api";
import { MODELS, ModelKey, SysInfo } from "../lib/types";
import { fmtDur, fmtGb, fmtSpeed } from "../lib/format";
import { makeSampleImage } from "../lib/sample";

const ONB = ["welcome", "why", "check", "download", "ready"] as const;
const GREEN_TXT = "oklch(0.85 0.14 155)";

export function Onboarding() {
  const s = useApp();
  const oi = ONB.indexOf(s.screen as any);
  return (
    <div style={css("flex:1;display:flex;flex-direction:column;min-height:0;position:relative")}>
      <div style={css("height:56px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 28px")}>
        <div style={css("width:120px")}>
          {oi > 0 && (
            <B as="button" onClick={() => go(ONB[oi - 1])} s="display:flex;align-items:center;gap:6px;background:none;border:none;color:#8b8b90;font:400 13px 'Onest';cursor:pointer;padding:0" h="color:#ededee">
              <Ic n="arrow_back" s="font-size:18px" />Назад
            </B>
          )}
        </div>
        <div style={css("display:flex;gap:6px;align-items:center")}>
          {ONB.map((k, i) => (
            <span key={k} style={css(`height:6px;width:${i === oi ? 22 : 6}px;border-radius:3px;background:${i <= oi ? "#ededee" : "#2a2a2e"};transition:all .4s cubic-bezier(.2,.8,.2,1)`)} />
          ))}
        </div>
        <div style={css("width:120px;text-align:right;font:400 12px 'JetBrains Mono',monospace;color:#5d5d63")}>Шаг {oi + 1} из 5</div>
      </div>
      {s.screen === "welcome" && <Welcome />}
      {s.screen === "why" && <Why />}
      {s.screen === "check" && <Check />}
      {s.screen === "download" && <Download />}
      {s.screen === "ready" && <Ready />}
    </div>
  );
}

/* ───────────── 1.1 Приветствие ───────────── */

const WCH = [
  { o: "IMG_0838.PNG", n: "Klutz — оплата.png", icon: "screenshot_monitor", c: C.v, cx: 40, cy: 70, cr: -6, g: 2, i: 0 },
  { o: "DSC04412.JPG", n: "Вечеринка у Ани 01.jpg", icon: "photo_camera", c: C.p, cx: 250, cy: 92, cr: 5, g: 0, i: 0 },
  { o: "document(3).pdf", n: "Договор аренды.pdf", icon: "description", c: C.t, cx: 120, cy: 150, cr: 3, g: 1, i: 0 },
  { o: "photo_2026-07-19.jpg", n: "Вечеринка у Ани 02.jpg", icon: "photo_camera", c: C.p, cx: 230, cy: 210, cr: -4, g: 0, i: 1 },
  { o: "Screenshot_0812.png", n: "Klutz — каталог.png", icon: "screenshot_monitor", c: C.v, cx: 30, cy: 250, cr: 7, g: 2, i: 1 },
  { o: "Termoland_check.jpg", n: "Оплата Термоленд.jpg", icon: "receipt_long", c: C.t, cx: 200, cy: 300, cr: -8, g: 1, i: 1 },
  { o: "DSC04413.JPG", n: "Вечеринка у Ани 03.jpg", icon: "photo_camera", c: C.p, cx: 60, cy: 330, cr: -3, g: 0, i: 2 },
  { o: "IMG_0839.PNG", n: "Klutz — профиль.png", icon: "screenshot_monitor", c: C.v, cx: 290, cy: 160, cr: 9, g: 2, i: 2 },
];
const WHEADS = [{ label: "Фото / Вечеринка у Ани", c: C.p, n: "18", y: 62 }, { label: "Документы / Финансы", c: C.t, n: "24", y: 172 }, { label: "Проекты / Klutz", c: C.v, n: "34", y: 254 }];
const WY = [[90, 114, 138], [200, 224], [282, 306, 330]];

function Welcome() {
  const t = useTicker();
  const ord = Math.floor(t / 3800) % 2 === 1;
  const feature = "display:flex;align-items:center;gap:12px;font:400 14px 'Onest';color:#d6d6d9";
  const featIcon = `width:32px;height:32px;border-radius:9px;background:#18181b;border:1px solid #26262a;display:grid;place-items:center;font-size:18px;color:${GREEN_TXT}`;
  return (
    <div style={css("flex:1;display:grid;grid-template-columns:1fr 480px;gap:40px;padding:10px 56px 48px;align-items:center;animation:fadein .5s ease both")}>
      <div style={css("display:flex;flex-direction:column;gap:22px")}>
        <div style={css("display:inline-flex;align-self:flex-start;align-items:center;gap:8px;height:28px;padding:0 12px;border-radius:14px;background:oklch(0.8 0.16 155 / 0.1);color:oklch(0.85 0.14 155);font:500 12px 'Onest'")}>
          <span style={css("width:6px;height:6px;border-radius:3px;background:oklch(0.8 0.16 155);animation:pulse 2s ease-in-out infinite")} />Работает на вашем компьютере
        </div>
        <h1 style={css("margin:0;font:500 40px/1.12 'Onest';letter-spacing:-.02em;text-wrap:balance")}>Наведёт порядок в фото и документах по вашим словам</h1>
        <p style={css("margin:0;font:400 16px/1.5 'Onest';color:#9a9aa0;max-width:440px;text-wrap:pretty")}>Напишите, как хотите разложить файлы, — приложение предложит папки и понятные имена, а вы решите, применять ли.</p>
        <div style={css("display:flex;flex-direction:column;gap:12px;margin-top:4px")}>
          <div style={css(feature)}><Ic n="wifi_off" s={featIcon} />Работает без интернета</div>
          <div style={css(feature)}><Ic n="shield" s={featIcon} />Ничего не удаляет — только переносит и переименовывает</div>
          <div style={css(feature)}><Ic n="visibility" s={featIcon} />Сначала показывает план</div>
        </div>
        <div style={css("display:flex;gap:10px;margin-top:8px")}>
          <B as="button" onClick={() => go("why")} s="height:44px;padding:0 26px;border-radius:10px;border:none;background:#ededee;color:#0e0e0f;font:500 15px 'Onest';cursor:pointer" h="background:#fff">Начать</B>
        </div>
      </div>
      <div style={css("height:400px;border-radius:18px;border:1px solid #222225;background:#121214;position:relative;overflow:hidden")}>
        <div style={css("position:absolute;left:18px;top:16px;right:18px;display:flex;justify-content:space-between;align-items:center;z-index:2")}>
          <div style={css("display:flex;gap:4px;padding:3px;border-radius:9px;background:#0b0b0c;border:1px solid #1f1f22")}>
            <span style={css(`padding:5px 12px;border-radius:6px;font:500 12px 'Onest';background:${ord ? "transparent" : "#1f1f22"};color:${ord ? "#6d6d73" : "#ededee"};transition:all .4s`)}>Было</span>
            <span style={css(`padding:5px 12px;border-radius:6px;font:500 12px 'Onest';background:${ord ? "#1f1f22" : "transparent"};color:${ord ? "#ededee" : "#6d6d73"};transition:all .4s`)}>Станет</span>
          </div>
          <span style={css("font:400 11px 'JetBrains Mono',monospace;color:#5d5d63")}>Загрузки</span>
        </div>
        {WHEADS.map((h, i) => (
          <div key={h.label} style={css(`position:absolute;left:22px;top:${h.y}px;display:flex;align-items:center;gap:8px;opacity:${ord ? 1 : 0};transform:translateX(${ord ? 0 : -10}px);transition:all .6s cubic-bezier(.2,.8,.2,1) ${ord ? 200 + i * 120 : 0}ms`)}>
            <Ic n="folder" s={`font-size:18px;color:${h.c};font-variation-settings:'FILL' 1`} />
            <span style={css("font:500 13px 'Onest';color:#ededee")}>{h.label}</span>
            <span style={css("font:400 11px 'JetBrains Mono',monospace;color:#5d5d63")}>{h.n}</span>
          </div>
        ))}
        {WCH.map((c, i) => {
          const x = ord ? 44 : c.cx, y = ord ? WY[c.g][c.i] : c.cy, r = ord ? 0 : c.cr, d = ord ? i * 60 : (7 - i) * 40;
          return (
            <div key={c.o} style={css(`position:absolute;left:${x}px;top:${y}px;transform:rotate(${r}deg);transition:left .9s cubic-bezier(.2,.8,.2,1) ${d}ms,top .9s cubic-bezier(.2,.8,.2,1) ${d}ms,transform .9s cubic-bezier(.2,.8,.2,1) ${d}ms;display:flex;align-items:center;gap:7px;height:26px;padding:0 10px;border-radius:7px;background:#1b1b1e;border:1px solid #2a2a2e;white-space:nowrap`)}>
              <Ic n={c.icon} s={`font-size:14px;color:${c.c}`} />
              <span style={css(`font:400 12px '${ord ? "Onest" : "JetBrains Mono"}',monospace;color:#d6d6d9`)}>{ord ? c.n : c.o}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────── 1.2 Зачем модель ───────────── */

function Why() {
  const s = useApp();
  const [more, setMore] = useState(false);
  const row = "display:flex;gap:10px;font:400 14px/1.4 'Onest';color:#d6d6d9";
  const ic = `font-size:18px;color:${GREEN_TXT}`;
  const req = "display:flex;justify-content:space-between;font:400 14px 'Onest';color:#d6d6d9";
  const reqV = "font-family:'JetBrains Mono',monospace;color:#8b8b90";
  return (
    <div style={css("flex:1;overflow:auto;padding:4px 0 40px;animation:fadein .5s ease both")}>
      <div style={css("max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:22px;padding:0 24px")}>
        <div style={css("height:150px;border-radius:18px;border:1px solid #222225;background:#0c0c0d;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center")}>
          <div style={css("position:absolute;width:520px;height:220px;border-radius:50%;background:radial-gradient(closest-side,oklch(0.8 0.16 155 / 0.22),transparent);top:40px;animation:glow 4s ease-in-out infinite")} />
          <div style={css("position:absolute;left:50%;top:0;width:1px;height:58px;background:linear-gradient(transparent,oklch(0.8 0.16 155 / 0.8))")} />
          <div style={css("position:relative;display:flex;align-items:center;gap:14px;padding:14px 20px;border-radius:14px;background:#141416;border:1px solid oklch(0.8 0.16 155 / 0.35);margin-top:30px")}>
            <Ic n="computer" s={`font-size:26px;color:${GREEN_TXT}`} />
            <div style={css("display:flex;flex-direction:column;gap:2px")}>
              <span style={css("font:500 14px 'Onest'")}>Всё происходит здесь</span>
              <span style={css("font:400 12px 'JetBrains Mono',monospace;color:#8b8b90")}>0 байт отправлено в интернет</span>
            </div>
          </div>
        </div>
        <div>
          <h2 style={css("margin:0 0 8px;font:500 30px/1.15 'Onest';letter-spacing:-.015em")}>Зачем скачивать модель</h2>
          <p style={css("margin:0;font:400 15px/1.5 'Onest';color:#9a9aa0;max-width:600px")}>Модель — это «мозг» приложения: она смотрит на фото и читает документы, чтобы понять, что в них.</p>
        </div>
        <div style={css("display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px")}>
          <div style={css("padding:18px;border-radius:14px;background:#141416;border:1px solid #222225;display:flex;flex-direction:column;gap:12px")}>
            <span style={css("font:500 13px 'Onest';color:#8b8b90")}>Почему на компьютере, а не в облаке</span>
            <div style={css(row)}><Ic n="lock" s={ic} />Личные фото и документы не покидают компьютер</div>
            <div style={css(row)}><Ic n="wifi_off" s={ic} />После установки интернет не нужен</div>
            <div style={css(row)}><Ic n="all_inclusive" s={ic} />Без подписки и лимитов</div>
          </div>
          <div style={css("padding:18px;border-radius:14px;background:#141416;border:1px solid #222225;display:flex;flex-direction:column;gap:12px")}>
            <span style={css("font:500 13px 'Onest';color:#8b8b90")}>Что потребуется</span>
            <div style={css(req)}><span>Место на диске</span><span style={css(reqV)}>4.5–9.5 ГБ</span></div>
            <div style={css(req)}><span>Загрузка</span><span style={css(reqV)}>5–15 мин</span></div>
            <div style={css(req)}><span>Видеокарта</span><span style={css(reqV)}>желательно</span></div>
            <span style={css("font:400 12px 'Onest';color:#5d5d63")}>Точные цифры покажем после проверки компьютера</span>
          </div>
        </div>
        <div style={css("border-radius:12px;border:1px solid #222225;overflow:hidden")}>
          <button onClick={() => setMore(!more)} style={css("width:100%;height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:#111113;border:none;color:#c9c9cd;font:500 13px 'Onest';cursor:pointer")}>
            Подробнее для дотошных<Ic n="expand_more" s={`font-size:20px;transform:rotate(${more ? 180 : 0}deg);transition:transform .25s`} />
          </button>
          {more && (
            <div style={css("padding:6px 16px 16px;display:grid;grid-template-columns:140px 1fr;gap:10px 16px;font:400 13px/1.45 'Onest';background:#111113;animation:fadein .3s ease both")}>
              <span style={css("color:#6d6d73")}>Модель</span><span style={css("color:#d6d6d9")}>Gemma 3 (12B или 4B) — понимает картинки и текст · BGE-M3 — группирует похожее</span>
              <span style={css("color:#6d6d73")}>Откуда</span><span style={css("color:#d6d6d9;font-family:'JetBrains Mono',monospace;font-size:12px")}>ollama.com/library</span>
              <span style={css("color:#6d6d73")}>Где будет лежать</span><span style={css("color:#d6d6d9;font-family:'JetBrains Mono',monospace;font-size:12px")}>{s.boot?.modelsDir || "%USERPROFILE%\\.ollama\\models"}</span>
              <span style={css("color:#6d6d73")}>Как удалить</span><span style={css("color:#d6d6d9")}>В разделе «Модели» одной кнопкой — место освободится сразу</span>
            </div>
          )}
        </div>
        <div style={css("display:flex;justify-content:flex-end")}>
          <B as="button" onClick={() => go("check")} s="height:44px;padding:0 24px;border-radius:10px;border:none;background:#ededee;color:#0e0e0f;font:500 15px 'Onest';cursor:pointer;display:flex;align-items:center;gap:8px" h="background:#fff">
            Проверить компьютер<Ic n="arrow_forward" s="font-size:18px" />
          </B>
        </div>
      </div>
    </div>
  );
}

/* ───────────── 1.3 Проверка компьютера ───────────── */

type Verdict = { key: "отлично" | "медленнее" | "нет места"; ok: number[]; icon: string; title: string; text: string; c: string; bg: string; bd: string; spf: number };

export function verdictOf(sys: SysInfo, model: ModelKey, installed: string[]): Verdict {
  const rec = recommendedModel(sys);
  const gpuOk = sys.gpuKind === "dedicated" && (sys.gpuVramGb ?? 0) >= 10 ? 1 : 0;
  const ramOk = sys.ramGb >= 12 ? 1 : 0;
  const need = modelInstalled(model, installed) ? 0 : MODELS[model].sizeGb + 2;
  if (need > 0 && sys.diskFreeGb < need) {
    return { key: "нет места", ok: [gpuOk, ramOk, -1], icon: "hard_drive", title: "Не хватает места", spf: MODELS[model].secPerFile,
      text: `Нужно освободить ещё ${(need - sys.diskFreeGb).toFixed(1)} ГБ (модель ${MODELS[model].sizeGb} ГБ + 2 ГБ запаса) или выбрать другой диск.`,
      c: "oklch(0.78 0.15 25)", bg: "oklch(0.7 0.15 25 / 0.07)", bd: "oklch(0.7 0.15 25 / 0.3)" };
  }
  if (rec === "accurate") {
    return { key: "отлично", ok: [1, ramOk, 1], icon: "verified", title: "Отлично подходит", spf: 5,
      text: `Рекомендуем «Точную». 1000 файлов ≈ ${fmtDur(1000 * 5)}.`,
      c: "oklch(0.86 0.14 155)", bg: "oklch(0.8 0.16 155 / 0.07)", bd: "oklch(0.8 0.16 155 / 0.28)" };
  }
  const spf = sys.gpuKind === "dedicated" ? 8 : 12;
  return { key: "медленнее", ok: [gpuOk, ramOk, 1], icon: "speed", title: "Подойдёт, но медленнее", spf,
    text: `Рекомендуем «Быструю». 1000 файлов ≈ ${fmtDur(1000 * spf)} — удобно оставить на ночь.`,
    c: "oklch(0.88 0.12 85)", bg: "oklch(0.84 0.13 85 / 0.07)", bd: "oklch(0.84 0.13 85 / 0.28)" };
}

function gpuLabel(sys: SysInfo) {
  if (sys.gpuKind === "none") return "Не найдена";
  const name = sys.gpuName.replace(/\bGeForce\s+/i, "").replace(/\(R\)|\(TM\)/g, "").replace(/\s+/g, " ").trim();
  if (sys.gpuKind === "integrated") return `${name} · встроенная`;
  return sys.gpuVramGb ? `${name} · ${Math.round(sys.gpuVramGb)} ГБ` : name;
}

function Check() {
  const s = useApp();
  useEffect(() => { if (!get().sys && !checking) { checking = true; runSystemCheck().finally(() => { checking = false; }); } }, []);
  const t = useTicker(!!s.sys, 60, s.sys);
  const sys = s.sys;
  const model = currentModel(s);
  const V = sys ? verdictOf(sys, model, s.installed) : null;
  const rec = recommendedModel(sys);
  const verdictShown = !!V && t > 2400;
  const rows = sys && V ? [
    { icon: "memory", label: "Видеокарта", value: gpuLabel(sys) },
    { icon: "memory_alt", label: "Оперативная память", value: `${Math.round(sys.ramGb)} ГБ` },
    { icon: "hard_drive", label: "Место на диске", value: `Диск ${sys.diskLabel} · свободно ${Math.round(sys.diskFreeGb)} ГБ` },
  ] : [
    { icon: "memory", label: "Видеокарта", value: "…" }, { icon: "memory_alt", label: "Оперативная память", value: "…" }, { icon: "hard_drive", label: "Место на диске", value: "…" },
  ];
  const noSpace = V?.key === "нет места" && verdictShown;
  const installedSel = modelInstalled(model, s.installed);
  const dlLabel = installedSel ? `Дальше — «${MODELS[model].name}» уже скачана` : `Скачать «${MODELS[model].acc}» · ${MODELS[model].sizeGb} ГБ`;
  const canGo = !!V && V.key !== "нет места";
  const pickDisk = async () => {
    const dir = await api.pickFolder();
    if (dir) { await api.saveSettings({ modelsDir: dir }); runSystemCheck(); }
  };
  return (
    <div style={css("flex:1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;padding:4px 56px 40px;animation:fadein .5s ease both")}>
      <div style={css("display:flex;flex-direction:column;gap:18px")}>
        <div>
          <h2 style={css("margin:0 0 8px;font:500 30px/1.15 'Onest';letter-spacing:-.015em")}>Проверяем компьютер</h2>
          <p style={css("margin:0;font:400 15px/1.5 'Onest';color:#9a9aa0")}>Посмотрим на видеокарту, память и место, чтобы подобрать модель.</p>
        </div>
        <div style={css("border-radius:14px;border:1px solid #222225;background:#121214;overflow:hidden")}>
          {rows.map((c, i) => {
            const done = !!V && t > 700 * (i + 1);
            const ok = V ? V.ok[i] : 1;
            const spin = !done && (!V || t > 700 * i - 100);
            return (
              <div key={c.label} style={css("display:flex;align-items:center;gap:14px;height:58px;padding:0 16px;border-bottom:1px solid #1c1c1f")}>
                <Ic n={c.icon} s="font-size:20px;color:#8b8b90" />
                <div style={css("flex:1;display:flex;flex-direction:column;gap:2px")}>
                  <span style={css("font:400 12px 'Onest';color:#6d6d73")}>{c.label}</span>
                  <span style={css(`font:500 14px 'Onest';color:${done && ok === -1 ? "oklch(0.78 0.15 25)" : "#ededee"};opacity:${done ? 1 : 0.25};transition:opacity .3s`)}>{c.value}</span>
                </div>
                {spin && <span style={css("width:16px;height:16px;border-radius:50%;border:2px solid #2a2a2e;border-top-color:#ededee;animation:spin .8s linear infinite")} />}
                {done && <Ic n={ok === 1 ? "check_circle" : ok === 0 ? "error" : "cancel"} s={`font-size:20px;color:${ok === 1 ? "oklch(0.85 0.14 155)" : ok === 0 ? "oklch(0.86 0.13 85)" : "oklch(0.75 0.15 25)"};animation:pop .3s ease both`} />}
              </div>
            );
          })}
        </div>
        {s.sysErr && <span style={css("font:400 13px 'Onest';color:oklch(0.78 0.15 25)")}>Не удалось проверить компьютер: {s.sysErr}</span>}
        {verdictShown && V && (
          <div style={css(`padding:18px;border-radius:14px;background:${V.bg};border:1px solid ${V.bd};display:flex;gap:14px;animation:fadein .4s ease both`)}>
            <Ic n={V.icon} s={`font-size:24px;color:${V.c};font-variation-settings:'FILL' 1`} />
            <div style={css("display:flex;flex-direction:column;gap:4px")}>
              <span style={css(`font:500 16px 'Onest';color:${V.c}`)}>{V.title}</span>
              <span style={css("font:400 14px/1.45 'Onest';color:#c9c9cd")}>{V.text}</span>
            </div>
          </div>
        )}
      </div>
      <div style={css("display:flex;flex-direction:column;gap:12px;padding-top:84px")}>
        <span style={css("font:500 13px 'Onest';color:#8b8b90")}>Модель</span>
        {(["fast", "accurate"] as ModelKey[]).map((k) => {
          const on = k === model;
          const desc = k === "fast" ? "Для ноутбуков и слабых видеокарт. Чаще ошибается в названиях." : "Для игровых ПК. Лучше понимает фото и русский текст.";
          return (
            <button key={k} onClick={() => set({ model: k })} style={css(`text-align:left;padding:16px 18px;border-radius:14px;background:${on ? "#18181b" : "#111113"};border:1px solid ${on ? "#4a4a50" : "#222225"};color:#ededee;cursor:pointer;display:flex;flex-direction:column;gap:8px;transition:all .2s;font-family:'Onest'`)}>
              <div style={css("display:flex;align-items:center;gap:10px;width:100%")}>
                <span style={css(`width:18px;height:18px;border-radius:9px;border:1.5px solid ${on ? "#ededee" : "#3a3a3f"};display:grid;place-items:center`)}><span style={css(`width:8px;height:8px;border-radius:4px;background:${on ? "#ededee" : "transparent"}`)} /></span>
                <span style={css("font:500 16px 'Onest'")}>{MODELS[k].name}</span>
                {k === rec && verdictShown && <span style={css("height:22px;padding:0 8px;border-radius:6px;background:oklch(0.8 0.16 155 / 0.12);color:oklch(0.85 0.14 155);font:500 11px 'Onest';display:inline-flex;align-items:center")}>Рекомендуем</span>}
                {modelInstalled(k, s.installed) && <span style={css("height:22px;padding:0 8px;border-radius:6px;background:#1f1f22;color:#9a9aa0;font:500 11px 'Onest';display:inline-flex;align-items:center")}>Скачана</span>}
                <span style={css("margin-left:auto;font:500 14px 'JetBrains Mono',monospace;color:#c9c9cd")}>≈ {MODELS[k].sizeGb} ГБ</span>
              </div>
              <span style={css("font:400 13px/1.45 'Onest';color:#8b8b90;padding-left:28px")}>{desc}</span>
            </button>
          );
        })}
        <span style={css("font:400 12px 'Onest';color:#5d5d63")}>Размер с учётом модели для группировки (1.2 ГБ), приблизительно</span>
        <div style={css("margin-top:auto;display:flex;justify-content:flex-end;gap:10px")}>
          {noSpace && <button onClick={pickDisk} style={css("height:44px;padding:0 18px;border-radius:10px;border:1px solid #2a2a2e;background:#18181b;color:#ededee;font:500 14px 'Onest';cursor:pointer")}>Выбрать другой диск</button>}
          <button onClick={() => { if (canGo && verdictShown) { set({ model, pullStarted: false, pull: null }); go("download"); } }}
            style={css(`height:44px;padding:0 22px;border-radius:10px;border:none;background:#ededee;color:#0e0e0f;font:500 15px 'Onest';cursor:pointer;opacity:${canGo && verdictShown ? 1 : 0.35};display:flex;align-items:center;gap:8px`)}>
            <Ic n={installedSel ? "arrow_forward" : "download"} s="font-size:18px" />{dlLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────── 1.5 Загрузка ───────────── */

function Download() {
  const s = useApp();
  useEffect(() => { if (!get().pullStarted) startPull(); }, []);
  const model = currentModel(s);
  const p = s.pull;
  const total = p?.total || MODELS[model].sizeGb * 1024 ** 3;
  const got = p?.completed || 0;
  const frac = p?.done ? 1 : Math.min(1, total ? got / total : 0);
  const err = p?.error?.kind || (p?.slow ? "vpn" : null);
  const moving = !!p && !s.pullPaused && !p.error && !p.done;
  const done = !!p?.done;
  const eta = done ? "готово" : p && p.speed > 0 ? `${Math.max(1, Math.round((total - got) / p.speed / 60))} мин` : "—";
  const title = done ? "Модель скачана" : p?.phase === "engine" ? "Скачиваем движок Ollama" : `Скачиваем модель «${MODELS[model].name}»`;
  const bar = err ? "oklch(0.84 0.13 85)" : done ? "oklch(0.8 0.16 155)" : "#ededee";
  const banner = err === "drop" ? { icon: "cloud_off", title: "Загрузка оборвалась", text: `Уже скачано ${fmtGb(got)} ГБ — продолжим с того же места.`, actions: [["Продолжить", startPull]] }
    : err === "vpn" ? { icon: "vpn_lock", title: "Похоже, загрузку тормозит VPN или прокси", text: "Отключите VPN на время загрузки или добавьте приложение в исключения.", actions: [["Инструкция", () => set({ vpnHelp: !s.vpnHelp })], ["Повторить", startPull]] }
    : err === "other" ? { icon: "error", title: "Не получилось скачать модель", text: p?.error?.message || "", actions: [["Повторить", startPull]] } : null;
  const card = "padding:16px;border-radius:14px;background:#121214;border:1px solid #222225;display:flex;flex-direction:column;gap:10px";
  return (
    <div style={css("flex:1;display:flex;flex-direction:column;gap:22px;padding:4px 56px 36px;animation:fadein .5s ease both")}>
      <div style={css("display:flex;align-items:flex-end;justify-content:space-between;gap:24px")}>
        <div>
          <span style={css("font:400 13px 'Onest';color:#8b8b90")}>{title}</span>
          <div style={css("font:400 72px/1 'Onest';letter-spacing:-.03em;margin-top:8px")}>{Math.floor(frac * 100)}<span style={css("font-size:32px;color:#6d6d73")}>%</span></div>
        </div>
        <div style={css("display:flex;gap:28px;padding-bottom:8px")}>
          <div style={css("display:flex;flex-direction:column;gap:4px")}><span style={css("font:400 12px 'Onest';color:#6d6d73")}>Скачано</span><span style={css("font:500 15px 'JetBrains Mono',monospace")}>{fmtGb(done ? total : got)} из {fmtGb(total)} ГБ</span></div>
          <div style={css("display:flex;flex-direction:column;gap:4px")}><span style={css("font:400 12px 'Onest';color:#6d6d73")}>Скорость</span><span style={css("font:500 15px 'JetBrains Mono',monospace")}>{moving || err === "vpn" ? fmtSpeed(p?.speed || 0) : "—"}</span></div>
          <div style={css("display:flex;flex-direction:column;gap:4px")}><span style={css("font:400 12px 'Onest';color:#6d6d73")}>Осталось</span><span style={css("font:500 15px 'JetBrains Mono',monospace")}>{eta}</span></div>
        </div>
      </div>
      <div style={css("height:10px;border-radius:5px;background:#18181b;overflow:hidden;position:relative")}>
        <div style={css(`height:100%;width:${(frac * 100).toFixed(1)}%;border-radius:5px;background:${bar};transition:width .2s linear;position:relative;overflow:hidden`)}>
          <div style={css(`position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);background-size:200px 100%;background-repeat:no-repeat;animation:shimmer 1.6s linear infinite;opacity:${moving ? 1 : 0}`)} />
        </div>
      </div>
      {banner && (
        <div style={css("display:flex;flex-direction:column;gap:10px;animation:fadein .3s ease both")}>
          <div style={css("display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:12px;background:oklch(0.84 0.13 85 / 0.08);border:1px solid oklch(0.84 0.13 85 / 0.3)")}>
            <Ic n={banner.icon} s="font-size:22px;color:oklch(0.86 0.13 85)" />
            <div style={css("flex:1;display:flex;flex-direction:column;gap:2px")}><span style={css("font:500 14px 'Onest';color:oklch(0.88 0.12 85)")}>{banner.title}</span><span style={css("font:400 13px 'Onest';color:#c9c9cd")}>{banner.text}</span></div>
            {banner.actions.map(([label, fn]) => (
              <button key={label as string} onClick={fn as () => void} style={css("height:34px;padding:0 14px;border-radius:8px;border:1px solid #2e2e32;background:#1c1c1f;color:#ededee;font:500 13px 'Onest';cursor:pointer")}>{label as string}</button>
            ))}
          </div>
          {err === "vpn" && s.vpnHelp && (
            <div style={css("padding:12px 16px;border-radius:12px;background:#121214;border:1px solid #222225;font:400 13px/1.55 'Onest';color:#c9c9cd;animation:fadein .25s ease both")}>
              Модель скачивается с <span style={css("font-family:'JetBrains Mono',monospace;font-size:12px")}>registry.ollama.ai</span> и <span style={css("font-family:'JetBrains Mono',monospace;font-size:12px")}>*.r2.cloudflarestorage.com</span>. Добавьте эти адреса или программу <span style={css("font-family:'JetBrains Mono',monospace;font-size:12px")}>ollama.exe</span> в исключения VPN — или выключите VPN до конца загрузки. После установки интернет не нужен, VPN можно включить обратно.
            </div>
          )}
        </div>
      )}
      <div style={css("display:flex;align-items:center;gap:10px")}>
        {!done && (
          <button onClick={togglePullPause} style={css("height:38px;padding:0 16px;border-radius:9px;border:1px solid #2a2a2e;background:#18181b;color:#ededee;font:500 13px 'Onest';cursor:pointer;display:flex;align-items:center;gap:8px")}>
            <Ic n={s.pullPaused ? "play_arrow" : "pause"} s="font-size:18px" />{s.pullPaused ? "Продолжить" : "Пауза"}
          </button>
        )}
        <span style={css("font:400 13px 'Onest';color:#6d6d73")}>Окно можно закрыть — загрузка продолжится в фоне, по окончании придёт уведомление</span>
        <div style={css("margin-left:auto")}>
          {done && <button onClick={() => go("ready")} style={css("height:44px;padding:0 22px;border-radius:10px;border:none;background:#ededee;color:#0e0e0f;font:500 15px 'Onest';cursor:pointer;animation:pop .3s ease both")}>Дальше</button>}
        </div>
      </div>
      <div style={css("margin-top:auto;display:flex;flex-direction:column;gap:12px")}>
        <span style={css("font:500 13px 'Onest';color:#8b8b90")}>Пока ждём</span>
        <div style={css("display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px")}>
          <div style={css(card)}>
            <Ic n="photo_library" s="font-size:22px;color:oklch(0.74 0.15 350)" />
            <span style={css("font:500 14px 'Onest'")}>Узнаёт события на фото</span>
            <span style={css("font:400 13px/1.45 'Onest';color:#8b8b90")}>18 снимков с одного вечера окажутся в одной папке «Вечеринка у Ани»</span>
          </div>
          <div style={css(card)}>
            <Ic n="description" s="font-size:22px;color:oklch(0.78 0.12 185)" />
            <span style={css("font:500 14px 'Onest'")}>Читает документы</span>
            <span style={css("font:400 13px/1.45 'Onest';color:#8b8b90")}>document(3).pdf станет «Договор аренды — сен 2026.pdf»</span>
          </div>
          <div style={css(card)}>
            <Ic n="lock" s="font-size:22px;color:oklch(0.74 0.15 300)" />
            <span style={css("font:500 14px 'Onest'")}>Не трогает проекты</span>
            <span style={css("font:400 13px/1.45 'Onest';color:#8b8b90")}>Папки с кодом и программы переносятся целиком — внутри ничего не меняется</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────── 1.6 Готово ───────────── */

const SAMPLE_NAME = "IMG_20260823_1412.jpg";

function Ready() {
  const s = useApp();
  useEffect(() => {
    const now = get();
    if (now.sample || now.readyBusy) return;
    set({ readyBusy: true }); // защита от повторного запуска эффекта
    makeSampleImage().then(({ dataUrl, b64 }) => describeSample({ dataUrl, b64, name: SAMPLE_NAME, own: false }));
  }, []);
  const t = useTicker(!!s.ready, 60, s.ready);
  const text = s.ready?.desc || "";
  const rc = s.ready ? Math.max(0, Math.floor((t - 600) / 28)) : 0;
  const typed = text.slice(0, rc);
  const typing = !s.ready || rc < text.length;
  const nameShown = !!s.ready && rc >= text.length + 12;
  const sec = s.ready?.seconds || 0;
  const ext = useMemo(() => (s.sample?.name.match(/\.[^.]+$/)?.[0] || ".jpg").toLowerCase(), [s.sample]);
  const newName = s.ready ? (s.ready.name.toLowerCase().endsWith(ext) ? s.ready.name : s.ready.name + ext) : "";
  const own = async () => {
    const img = await api.pickImage();
    if (img) describeSample({ dataUrl: img.dataUrl, path: img.path, name: img.name, own: true });
  };
  return (
    <div style={css("flex:1;display:grid;grid-template-columns:420px minmax(0,1fr);gap:40px;padding:4px 56px 44px;align-items:center;animation:fadein .5s ease both")}>
      <div style={css("height:440px;border-radius:18px;border:1px solid #222225;position:relative;overflow:hidden;background:repeating-linear-gradient(135deg,#151517 0 10px,#19191c 10px 20px);display:flex;align-items:flex-end;padding:16px")}>
        {s.sample && (
          <img src={s.sample.dataUrl} alt="" style={css("position:absolute;left:50%;top:22px;bottom:56px;transform:translateX(-50%);max-width:calc(100% - 44px);height:calc(100% - 78px);object-fit:contain;border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.45)")} />
        )}
        <span style={css("position:relative;font:400 11px 'JetBrains Mono',monospace;color:#6d6d73;background:#0e0e0f;padding:4px 8px;border-radius:5px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
          {s.sample?.own ? s.sample.name : "пример: скриншот оплаты в банке"}
        </span>
        <div style={css(`position:absolute;left:0;right:0;height:2px;background:oklch(0.8 0.16 155);box-shadow:0 0 18px 4px oklch(0.8 0.16 155 / 0.5);animation:scan 2.4s cubic-bezier(.45,0,.55,1) infinite alternate;opacity:${nameShown ? 0 : 1};transition:opacity .4s`)} />
      </div>
      <div style={css("display:flex;flex-direction:column;gap:20px")}>
        {s.ready ? (
          <div style={css("display:inline-flex;align-self:flex-start;align-items:center;gap:8px;font:500 12px 'Onest';color:oklch(0.85 0.14 155)")}><Ic n="check_circle" s="font-size:18px;font-variation-settings:'FILL' 1" />Модель установлена и работает</div>
        ) : (
          <div style={css("display:inline-flex;align-self:flex-start;align-items:center;gap:8px;font:500 12px 'Onest';color:#9a9aa0")}>
            <span style={css("width:14px;height:14px;border-radius:50%;border:2px solid #2a2a2e;border-top-color:#ededee;animation:spin .8s linear infinite")} />
            {s.readyErr ? "Модель не ответила" : "Модель запускается — первый раз это занимает до минуты"}
          </div>
        )}
        <h2 style={css("margin:0;font:500 30px/1.15 'Onest';letter-spacing:-.015em")}>Вот что я вижу</h2>
        {s.readyErr ? (
          <div style={css("display:flex;flex-direction:column;gap:10px")}>
            <p style={css("margin:0;font:400 15px/1.55 'Onest';color:oklch(0.78 0.15 25)")}>{s.readyErr}</p>
            <button onClick={() => describeSample(s.sample)} style={css("align-self:flex-start;height:36px;padding:0 14px;border-radius:9px;border:1px solid #2a2a2e;background:#18181b;color:#ededee;font:500 13px 'Onest';cursor:pointer")}>Повторить</button>
          </div>
        ) : (
          <p style={css("margin:0;font:400 18px/1.55 'Onest';color:#d6d6d9;min-height:84px")}>
            {typed}
            {typing && <span style={css("display:inline-block;width:2px;height:20px;background:#ededee;vertical-align:-3px;margin-left:2px;animation:blink 1s step-end infinite")} />}
          </p>
        )}
        {nameShown && (
          <div style={css("display:flex;flex-direction:column;gap:8px;animation:fadein .4s ease both")}>
            <span style={css("font:400 13px 'Onest';color:#6d6d73")}>Назову его</span>
            <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
              <span style={css("font:400 13px 'JetBrains Mono',monospace;color:#6d6d73;text-decoration:line-through")}>{s.sample?.name}</span>
              <Ic n="arrow_forward" s="font-size:18px;color:#6d6d73" />
              <span style={css("height:32px;padding:0 12px;border-radius:8px;background:oklch(0.8 0.16 155 / 0.1);border:1px solid oklch(0.8 0.16 155 / 0.3);color:oklch(0.88 0.12 155);font:500 14px 'Onest';display:inline-flex;align-items:center")}>{newName}</span>
            </div>
            <span style={css("font:400 13px 'JetBrains Mono',monospace;color:#8b8b90;margin-top:6px")}>{sec.toFixed(1)} с на файл · 1000 файлов ≈ {fmtDur(1000 * Math.max(sec, 1.5))}</span>
          </div>
        )}
        <div style={css("display:flex;gap:10px;margin-top:10px")}>
          <B as="button" onClick={finishOnboarding} s="height:44px;padding:0 22px;border-radius:10px;border:none;background:#ededee;color:#0e0e0f;font:500 15px 'Onest';cursor:pointer;display:flex;align-items:center;gap:8px" h="background:#fff">
            <Ic n="folder_open" s="font-size:18px" />Выбрать папку
          </B>
          <button onClick={own} disabled={s.readyBusy} style={css(`height:44px;padding:0 18px;border-radius:10px;border:1px solid #2a2a2e;background:#18181b;color:#c9c9cd;font:500 14px 'Onest';cursor:pointer;opacity:${s.readyBusy ? 0.5 : 1}`)}>Проверить на своей картинке</button>
        </div>
      </div>
    </div>
  );
}

export type { AppState };
