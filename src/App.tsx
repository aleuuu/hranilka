import { useEffect } from "react";
import { B, Ic, css } from "./ui";
import { bootApp, get, onEngine, onGpu, onPull, selectFolder, set, useApp } from "./store";
import { api } from "./lib/api";
import { Onboarding } from "./screens/Onboarding";
import { Shell } from "./screens/Shell";
import { Modals } from "./screens/Modals";

const ONB = ["welcome", "why", "check", "download", "ready"];

function TitleBar() {
  const btn = "width:44px;height:34px;display:grid;place-items:center;font-family:'Material Symbols Rounded';color:#7a7a80;background:transparent;border:none;cursor:default;padding:0";
  return (
    <div data-tauri-drag-region style={css("height:34px;flex:none;display:flex;align-items:center;justify-content:space-between;padding-left:14px;border-bottom:1px solid #1c1c1f;background:#0b0b0c")}>
      <div data-tauri-drag-region style={css("display:flex;align-items:center;gap:8px;flex:1;height:100%")}>
        <Ic n="inventory_2" s="font-size:16px;color:#ededee;font-variation-settings:'FILL' 1;pointer-events:none" />
        <span data-tauri-drag-region style={css("font:500 12px 'Onest';color:#9a9aa0")}>Хранилка</span>
      </div>
      <div style={css("display:flex")}>
        <B as="button" onClick={() => api.win("minimize")} s={btn + ";font-size:16px"} h="background:#18181b;color:#ededee"><span data-ms="">remove</span></B>
        <B as="button" onClick={() => api.win("maximize")} s={btn + ";font-size:14px"} h="background:#18181b;color:#ededee"><span data-ms="">crop_square</span></B>
        <B as="button" onClick={() => api.win("close")} s={btn + ";font-size:16px"} h="background:#c42b1c;color:#fefefe"><span data-ms="">close</span></B>
      </div>
    </div>
  );
}

export default function App() {
  const s = useApp();
  useEffect(() => {
    bootApp();
    const offs = [
      api.on("pull", onPull),
      api.on("engine", onEngine),
      api.on("gpu", onGpu),
      api.on("apply", (p: { n: number; total: number; line: string }) => {
        const prog = get().prog;
        set({ prog: { n: p.n, total: p.total, lines: [p.line, ...prog.lines].slice(0, 3) } });
      }),
      api.on("drop", (p: any) => {
        if (p?.type === "drop" && p.paths?.length && get().screen === "start" && !get().scanning) selectFolder(p.paths[0]);
      }),
    ];
    return () => offs.forEach((f) => f());
  }, []);

  const isOnb = ONB.includes(s.screen);
  return (
    <div style={css("height:100vh;display:flex;flex-direction:column;background:#0e0e0f;overflow:hidden;position:relative")}>
      <TitleBar />
      {s.screen === "boot" && (
        <div style={css("flex:1;display:grid;place-items:center")}>
          <span style={css("width:18px;height:18px;border-radius:50%;border:2px solid #2a2a2e;border-top-color:#ededee;animation:spin .8s linear infinite")} />
        </div>
      )}
      {isOnb && <Onboarding />}
      {!isOnb && s.screen !== "boot" && <Shell />}
      <Modals />
    </div>
  );
}
