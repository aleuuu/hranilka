import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import * as store from "./store";
import "./styles.css";

// Доступ к состоянию для автотестов через DevTools (порт включается только переменной окружения WebView2)
(window as any).__h = store;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
