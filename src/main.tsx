import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import * as store from "./store";
import { DEFAULT_THEME, applyTheme, savedTheme } from "./theme";
import "./styles.css";

// Тема из прошлого запуска — сразу, до загрузки настроек, чтобы окно не мигало чужими цветами
applyTheme(savedTheme() || DEFAULT_THEME);

// Доступ к состоянию для автотестов через DevTools (порт включается только переменной окружения WebView2)
(window as any).__h = store;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
