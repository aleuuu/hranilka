/* Общие элементы страниц «История», «Правила», «Модели», «Настройки», «Следить за папкой».
   Стили — те же, что на экранах из макета: карточки #121214, строки 44px, переключатели и сегменты как на старте. */
import React from "react";
import { B, Ic, css } from "../ui";

export function Page({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={css("flex:1;min-height:0;overflow:auto;animation:fadein .4s ease both")}>
      <div style={css(`max-width:${wide ? 860 : 760}px;margin:0 auto;padding:22px 22px 40px;display:flex;flex-direction:column;gap:26px`)}>{children}</div>
    </div>
  );
}

export function Section({ title, desc, right, children }: { title: string; desc?: React.ReactNode; right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section style={css("display:flex;flex-direction:column;gap:10px")}>
      <div style={css("display:flex;align-items:flex-end;gap:12px")}>
        <div style={css("flex:1;display:flex;flex-direction:column;gap:4px;min-width:0")}>
          <span style={css("font:500 13px 'Onest';color:#8b8b90")}>{title}</span>
          {desc && <span style={css("font:400 12.5px/1.45 'Onest';color:#6d6d73")}>{desc}</span>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, s = "" }: { children: React.ReactNode; s?: string }) {
  return <div style={css("border-radius:12px;border:1px solid #1f1f22;background:#111113;display:flex;flex-direction:column;overflow:hidden;" + s)}>{children}</div>;
}

export function Row({ label, desc, icon, children, last, onClick }: { label: React.ReactNode; desc?: React.ReactNode; icon?: string; children?: React.ReactNode; last?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={css(`min-height:46px;display:flex;align-items:center;gap:12px;padding:9px 14px;border-bottom:1px solid ${last ? "transparent" : "#1a1a1d"};cursor:${onClick ? "pointer" : "default"}`)}>
      {icon && <Ic n={icon} s="font-size:19px;color:#8b8b90;flex:none" />}
      <div style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:2px")}>
        <span style={css("font:400 13px 'Onest';color:#d6d6d9")}>{label}</span>
        {desc && <span style={css("font:400 12px/1.4 'Onest';color:#6d6d73")}>{desc}</span>}
      </div>
      {children}
    </div>
  );
}

export function Toggle({ on, onClick, title }: { on: boolean; onClick: () => void; title?: string }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} title={title} role="switch" aria-checked={on}
      style={css("width:34px;height:20px;flex:none;padding:0;border:none;background:none;cursor:pointer")}>
      <span style={css(`display:block;width:34px;height:20px;border-radius:10px;background:${on ? "oklch(0.72 0.15 155)" : "#2a2a2e"};position:relative;transition:background .2s`)}>
        <span style={css(`position:absolute;top:2px;left:${on ? 16 : 2}px;width:16px;height:16px;border-radius:8px;background:#fefefe;transition:left .2s cubic-bezier(.2,.8,.2,1)`)} />
      </span>
    </button>
  );
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div style={css("display:flex;padding:2px;border-radius:8px;background:#0b0b0c;border:1px solid #1f1f22;flex:none")}>
      {options.map(([k, l]) => (
        <button key={String(k)} onClick={() => onChange(k)} style={css(`height:26px;padding:0 10px;border-radius:6px;border:none;background:${value === k ? "#26262a" : "transparent"};color:${value === k ? "#ededee" : "#8b8b90"};font:500 12px 'Onest';cursor:pointer;white-space:nowrap`)}>{l}</button>
      ))}
    </div>
  );
}

type BtnKind = "primary" | "secondary" | "ghost" | "danger";
const BTN: Record<BtnKind, [string, string]> = {
  primary: ["border:none;background:#ededee;color:#0e0e0f", "background:#ffffff"],
  secondary: ["border:1px solid #2a2a2e;background:#18181b;color:#ededee", "background:#1f1f22;border-color:#3a3a3f"],
  ghost: ["border:none;background:transparent;color:#9a9aa0", "background:#18181b;color:#ededee"],
  danger: ["border:1px solid oklch(0.7 0.15 25 / 0.4);background:oklch(0.7 0.15 25 / 0.1);color:oklch(0.82 0.13 25)", "background:oklch(0.7 0.15 25 / 0.18)"],
};

export function Btn({ kind = "secondary", icon, children, onClick, disabled, title, s = "" }: { kind?: BtnKind; icon?: string; children?: React.ReactNode; onClick?: () => void; disabled?: boolean; title?: string; s?: string }) {
  const [base, hover] = BTN[kind];
  return (
    <B as="button" onClick={disabled ? undefined : onClick} disabled={disabled} title={title}
      s={`height:32px;padding:0 ${children ? 12 : 8}px;border-radius:8px;${base};font:500 12.5px 'Onest';cursor:${disabled ? "default" : "pointer"};display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;flex:none;opacity:${disabled ? 0.4 : 1};transition:background .15s;${s}`}
      h={disabled ? undefined : hover}>
      {icon && <Ic n={icon} s="font-size:17px" />}{children}
    </B>
  );
}

export function Field({ value, onChange, placeholder, s = "", onEnter, mono }: { value: string; onChange: (v: string) => void; placeholder?: string; s?: string; onEnter?: () => void; mono?: boolean }) {
  return (
    <B as="input" value={value} placeholder={placeholder} spellCheck={false}
      onChange={(e: any) => onChange(e.target.value)} onKeyDown={(e: any) => { if (e.key === "Enter") onEnter?.(); }}
      s={`height:34px;min-width:0;border-radius:8px;border:1px solid #26262a;background:#141416;color:#ededee;font:400 13px ${mono ? "'JetBrains Mono',monospace" : "'Onest'"};padding:0 10px;outline:none;${s}`}
      f="border-color:#4a4a50" />
  );
}

export function Select<T extends string>({ value, options, onChange, s = "" }: { value: T; options: [T, string][]; onChange: (v: T) => void; s?: string }) {
  return (
    <div style={css(`position:relative;flex:none;${s}`)}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}
        style={css("appearance:none;height:34px;width:100%;border-radius:8px;border:1px solid #26262a;background:#141416;color:#ededee;font:400 13px 'Onest';padding:0 28px 0 10px;outline:none;cursor:pointer")}>
        {options.map(([k, l]) => <option key={k} value={k} style={css("background:#18181b;color:#ededee")}>{l}</option>)}
      </select>
      <Ic n="expand_more" s="position:absolute;right:8px;top:9px;font-size:17px;color:#8b8b90;pointer-events:none" />
    </div>
  );
}

export function Chip({ children, onRemove, c }: { children: React.ReactNode; onRemove?: () => void; c?: string }) {
  return (
    <span style={css(`display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 ${onRemove ? 4 : 9}px 0 9px;border-radius:12px;background:#1c1c1f;border:1px solid #26262a;font:400 12px 'Onest';color:${c || "#c9c9cd"};white-space:nowrap`)}>
      {children}
      {onRemove && (
        <B as="button" onClick={onRemove} title="Убрать" s="width:18px;height:18px;border-radius:9px;border:none;background:transparent;color:#6d6d73;cursor:pointer;display:grid;place-items:center;padding:0" h="background:#2a2a2e;color:#ededee">
          <span data-ms="" style={css("font-size:14px")}>close</span>
        </B>
      )}
    </span>
  );
}

export function Note({ icon = "info", children, c = "#8b8b90" }: { icon?: string; children: React.ReactNode; c?: string }) {
  return (
    <div style={css("display:flex;gap:9px;padding:10px 12px;border-radius:10px;background:#111113;border:1px solid #1f1f22;font:400 12.5px/1.45 'Onest';color:#9a9aa0")}>
      <Ic n={icon} s={`font-size:17px;color:${c};flex:none;margin-top:1px`} />
      <span>{children}</span>
    </div>
  );
}

export function Spinner({ size = 14 }: { size?: number }) {
  return <span style={css(`width:${size}px;height:${size}px;border-radius:50%;border:2px solid #2a2a2e;border-top-color:#ededee;animation:spin .8s linear infinite;flex:none;display:inline-block`)} />;
}
