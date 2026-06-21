import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize Microsoft Clarity
(function(c: Window & { clarity?: Function }, l: Document, a: string, r: string, i: string) {
  c[a] = c[a] || function(...args: unknown[]) { (c[a].q = c[a].q || []).push(args); };
  const t = l.createElement(r) as HTMLScriptElement;
  t.async = true;
  t.src = "https://www.clarity.ms/tag/" + i;
  const y = l.getElementsByTagName(r)[0];
  y.parentNode?.insertBefore(t, y);
})(window, document, "clarity", "script", "uqltsn30r9");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
