import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./registerServiceWorker";
import { validateSmtpOnStartup } from "./services/smtpInitializer";

// Registra Service Worker para cache persistente de imagens
registerServiceWorker();

// Valida as configurações SMTP armazenadas no Firebase na inicialização do app
validateSmtpOnStartup().catch((err) => {
  console.warn("[Main] Aviso ao validar transporte SMTP na inicialização:", err);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
