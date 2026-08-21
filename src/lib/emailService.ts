import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { initFirebase } from "./firebase";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  metodo?: "smtp" | "api";
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: "ssl" | "tls" | "none";
  fromEmail?: string;
  fromName?: string;
  apiProvider?: string;
  apiKey?: string;
  apiDomain?: string;
  apiEndpoint?: string;
}

export interface SmtpDiagnosticCheck {
  step: string;
  title: string;
  status: "ok" | "warning" | "error";
  message: string;
  tip?: string;
}

export interface SmtpVerificationResult {
  success: boolean;
  score: number;
  host?: string;
  port?: number;
  resolvedIp?: string;
  user?: string;
  sender?: string;
  targetDomain?: string;
  spfFound?: boolean;
  spfRecord?: string;
  dmarcFound?: boolean;
  dmarcRecord?: string;
  checks: SmtpDiagnosticCheck[];
  summary?: string;
  error?: string;
}

export async function verifySmtpConfig(config: Partial<EmailPayload>): Promise<SmtpVerificationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch("/api/email/verify-smtp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      let errText = "";
      try {
        const errJson = await res.json();
        return errJson;
      } catch {
        errText = await res.text().catch(() => "");
      }
      return {
        success: false,
        score: 0,
        error: errText || `Servidor respondeu com código ${res.status}`,
        checks: [
          {
            step: "network",
            title: "Servidor de Aplicação",
            status: "error",
            message: `Servidor retornou status HTTP ${res.status}: ${errText || "Falha temporária"}`
          }
        ]
      };
    }

    const data = await res.json();
    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isAbort = err.name === "AbortError";
    const msg = isAbort 
      ? "Tempo limite de verificação excedido (9s)." 
      : (err.message || "Falha ao conectar com o serviço de diagnóstico");

    return {
      success: false,
      score: 0,
      error: msg,
      checks: [
        {
          step: "network",
          title: "Comunicação com o Servidor Local",
          status: "warning",
          message: `Diagnóstico em segundo plano: ${msg}`,
          tip: "As mensagens também podem ser enviadas diretamente pelo WhatsApp com links exclusivos."
        }
      ]
    };
  }
}

export async function sendEmailWithLog(
  payload: Partial<EmailPayload> & { to: string; subject: string; html: string },
  tipo: string,
  pedidoId?: string
) {
  try {
    const { db } = await initFirebase();

    // 1. Sempre carrega as configurações salvas no Firestore 'config/email'
    let savedConfig: any = {};
    try {
      const configSnap = await getDoc(doc(db, "config", "email"));
      if (configSnap.exists()) {
        savedConfig = configSnap.data();
      }
    } catch (loadErr) {
      console.warn("Não foi possível carregar config/email do Firestore:", loadErr);
    }

    // 2. Filtra campos vazios para evitar sobrescrever dados válidos do servidor
    const cleanedPayload: any = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== null && value !== "") {
        cleanedPayload[key] = value;
      }
    }

    // Se o payload não tem apiKey válida, descarta provedor de API vazio para usar SMTP
    if (!cleanedPayload.apiKey) {
      delete cleanedPayload.apiProvider;
      delete cleanedPayload.apiKey;
      delete cleanedPayload.apiDomain;
      delete cleanedPayload.apiEndpoint;
    }

    const fullPayload: any = {
      ...savedConfig,
      ...cleanedPayload,
      to: payload.to,
      subject: payload.subject,
      html: payload.html
    };

    // Priorizar SMTP se houver host configurado ou se metodo estiver vazio/api sem chave
    if (!fullPayload.metodo || (fullPayload.metodo === "api" && !fullPayload.apiKey)) {
      fullPayload.metodo = "smtp";
    }

    if (fullPayload.metodo === "smtp") {
      fullPayload.smtpHost = fullPayload.smtpHost || savedConfig.smtpHost;
      fullPayload.smtpPort = fullPayload.smtpPort || savedConfig.smtpPort || 465;
      fullPayload.smtpUser = fullPayload.smtpUser || savedConfig.smtpUser;
      fullPayload.smtpPass = fullPayload.smtpPass || savedConfig.smtpPass;
      fullPayload.smtpSecure = fullPayload.smtpSecure || savedConfig.smtpSecure || "ssl";
      fullPayload.fromEmail = fullPayload.fromEmail || savedConfig.fromEmail || fullPayload.smtpUser;
      fullPayload.fromName = fullPayload.fromName || savedConfig.fromName || "União Condominial";
    }

    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullPayload)
    });
    
    const resData = await res.json().catch(() => ({ error: "Resposta inesperada do servidor" }));
    const success = res.ok && resData.success;

    const providerLabel = fullPayload.metodo === "smtp" 
      ? `SMTP HostGator (${fullPayload.smtpHost || "servidor"})` 
      : `API (${fullPayload.apiProvider || "SendGrid"})`;

    try {
      await addDoc(collection(db, "email_logs"), {
        destinatario: fullPayload.to,
        assunto: fullPayload.subject,
        tipo: tipo,
        pedidoId: pedidoId || null,
        sucesso: success,
        mensagem: success ? (resData.message || "Email enviado com sucesso via SMTP HostGator") : (resData.error || "Erro ao disparar e-mail"),
        dataEnvio: new Date().toISOString(),
        provedor: providerLabel
      });
    } catch (logErr) {
      console.error("Erro ao gravar log de email:", logErr);
    }
    
    return { success, data: resData, error: success ? undefined : (resData.error || "Erro desconhecido no envio") };
  } catch (err: any) {
    console.error("Falha ao comunicar com o servidor de e-mail:", err);
    try {
      const { db } = await initFirebase();
      await addDoc(collection(db, "email_logs"), {
        destinatario: payload.to,
        assunto: payload.subject,
        tipo: tipo,
        pedidoId: pedidoId || null,
        sucesso: false,
        mensagem: err.message || "Erro de rede",
        dataEnvio: new Date().toISOString(),
        provedor: "SMTP HostGator"
      });
    } catch (logErr) {
      console.error("Erro ao gravar log de falha de email:", logErr);
    }
    return { success: false, error: err.message };
  }
}
