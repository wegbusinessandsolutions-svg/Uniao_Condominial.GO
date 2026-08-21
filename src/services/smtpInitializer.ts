import { doc, getDoc } from "firebase/firestore";
import { initFirebase } from "../lib/firebase";
import { verifySmtpConfig, SmtpVerificationResult, SmtpDiagnosticCheck } from "../lib/emailService";
import { logAction } from "../lib/audit";

export interface SmtpRuntimeStatus {
  initialized: boolean;
  validating: boolean;
  ready: boolean;
  score: number;
  lastCheckedAt: string | null;
  config: {
    host?: string;
    port?: number;
    user?: string;
    secure?: string;
    fromEmail?: string;
    fromName?: string;
    metodo?: string;
  } | null;
  error: string | null;
  checks: SmtpDiagnosticCheck[];
  summary: string | null;
  handshakeDetails?: {
    host?: string;
    port?: number;
    user?: string;
    code?: string;
    command?: string;
    resolvedIp?: string;
  };
}

// Global runtime state (singleton)
let smtpState: SmtpRuntimeStatus = {
  initialized: false,
  validating: false,
  ready: false,
  score: 0,
  lastCheckedAt: null,
  config: null,
  error: null,
  checks: [],
  summary: null,
};

type SmtpStatusListener = (state: SmtpRuntimeStatus) => void;
const listeners = new Set<SmtpStatusListener>();

export function getSmtpStatus(): SmtpRuntimeStatus {
  return { ...smtpState };
}

export function subscribeSmtpStatus(listener: SmtpStatusListener): () => void {
  listeners.add(listener);
  listener(getSmtpStatus());
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  const current = getSmtpStatus();
  listeners.forEach((fn) => {
    try {
      fn(current);
    } catch (err) {
      console.error("[SMTP Initializer] Erro no listener de status:", err);
    }
  });
}

/**
 * Script de inicialização que valida as configurações SMTP armazenadas no Firebase ao iniciar o app.
 * Garante que o transporte de e-mail esteja pronto antes de qualquer envio de termo de afiliação,
 * gerando logs de depuração detalhados para falhas de handshake.
 */
export async function validateSmtpOnStartup(force: boolean = false): Promise<SmtpRuntimeStatus> {
  // Evitar chamadas simultâneas duplicadas
  if (smtpState.validating) {
    return smtpState;
  }

  // Cache inteligente de 10 minutos se já estiver validado com sucesso e não for forçado
  if (
    !force &&
    smtpState.initialized &&
    smtpState.ready &&
    smtpState.lastCheckedAt &&
    Date.now() - new Date(smtpState.lastCheckedAt).getTime() < 10 * 60 * 1000
  ) {
    return smtpState;
  }

  smtpState.validating = true;
  smtpState.error = null;
  notifyListeners();

  console.groupCollapsed(
    "%c[SMTP Startup] 🚀 Validando Configurações SMTP do Firebase...",
    "color: #0284c7; font-weight: bold;"
  );
  console.log("[SMTP Startup] Consultando documento 'config/email' no Firestore...");

  try {
    const { db } = await initFirebase();
    const configSnap = await getDoc(doc(db, "config", "email"));

    if (!configSnap.exists()) {
      const msg = "Documento 'config/email' não cadastrado no Firestore.";
      console.warn(`[SMTP Startup] ⚠️ ${msg}`);
      smtpState = {
        initialized: true,
        validating: false,
        ready: false,
        score: 0,
        lastCheckedAt: new Date().toISOString(),
        config: null,
        error: msg,
        checks: [
          {
            step: "config",
            title: "Configuração do Firebase",
            status: "warning",
            message: msg,
            tip: "Acesse Administração > Notificações para configurar o servidor SMTP da HostGator / cPanel."
          }
        ],
        summary: "Servidor de e-mail não configurado no Firebase."
      };
      console.groupEnd();
      notifyListeners();
      return smtpState;
    }

    const emailConfig = configSnap.data();
    const metodo = emailConfig.metodo || "smtp";
    const host = (emailConfig.smtpHost || "").trim();
    const user = (emailConfig.smtpUser || "").trim();
    const pass = (emailConfig.smtpPass || "").trim();
    const port = Number(emailConfig.smtpPort) || (emailConfig.smtpSecure === "ssl" ? 465 : 587);
    const secure = emailConfig.smtpSecure || (port === 465 ? "ssl" : "tls");

    smtpState.config = {
      host,
      port,
      user,
      secure,
      fromEmail: emailConfig.fromEmail || user,
      fromName: emailConfig.fromName || "União Condominial",
      metodo
    };

    if (metodo === "smtp") {
      if (!host || !user || !pass) {
        const errorMsg = "Credenciais SMTP incompletas no Firebase (Host, Usuário ou Senha não preenchidos).";
        console.warn("[SMTP Startup] ⚠️ Dados do servidor incompletos:", { host, user, hasPass: !!pass });
        smtpState = {
          initialized: true,
          validating: false,
          ready: false,
          score: 0,
          lastCheckedAt: new Date().toISOString(),
          config: smtpState.config,
          error: errorMsg,
          checks: [
            {
              step: "config",
              title: "Credenciais Incompletas",
              status: "error",
              message: errorMsg,
              tip: "Preencha os campos obrigatórios na aba de Configurações de E-mail."
            }
          ],
          summary: "Configuração SMTP incompleta."
        };
        console.groupEnd();
        notifyListeners();
        return smtpState;
      }

      console.log(`[SMTP Startup] 📡 Iniciando Handshake SMTP com ${host}:${port} (${secure.toUpperCase()}) para o usuário ${user}...`);
      
      const verification: SmtpVerificationResult = await verifySmtpConfig({
        metodo: "smtp",
        smtpHost: host,
        smtpPort: port,
        smtpUser: user,
        smtpPass: pass,
        smtpSecure: secure,
        fromEmail: emailConfig.fromEmail || user,
        fromName: emailConfig.fromName || "União Condominial"
      });

      smtpState.initialized = true;
      smtpState.validating = false;
      smtpState.ready = !!verification.success;
      smtpState.score = verification.score || 0;
      smtpState.lastCheckedAt = new Date().toISOString();
      smtpState.checks = verification.checks || [];
      smtpState.summary = verification.summary || (verification.success ? "Servidor SMTP pronto e operacional." : "Falha na verificação.");
      smtpState.error = verification.success ? null : (verification.error || "Falha no handshake SMTP.");

      if (verification.success) {
        console.log(
          `%c[SMTP Startup] ✅ Handshake SMTP Concluído com Sucesso! Pontuação: ${verification.score}/100`,
          "color: #16a34a; font-weight: bold;",
          {
            host: verification.host,
            ip: verification.resolvedIp,
            port: verification.port,
            score: verification.score,
            spf: verification.spfFound,
            dmarc: verification.dmarcFound
          }
        );
      } else {
        console.info(
          `[SMTP Startup] ℹ️ Verificação SMTP em segundo plano: ${verification.error || "Pendente"}`,
          {
            host,
            port,
            user,
            checks: verification.checks
          }
        );
      }
    } else {
      // Provedor API
      const hasKey = !!emailConfig.apiKey;
      console.log(`[SMTP Startup] ℹ️ Modo API REST selecionado (${emailConfig.apiProvider || "SendGrid"}).`);
      smtpState = {
        initialized: true,
        validating: false,
        ready: hasKey,
        score: hasKey ? 90 : 10,
        lastCheckedAt: new Date().toISOString(),
        config: smtpState.config,
        error: hasKey ? null : "Chave de API não informada.",
        checks: [
          {
            step: "api_config",
            title: `Provedor API (${emailConfig.apiProvider || "SendGrid"})`,
            status: hasKey ? "ok" : "error",
            message: hasKey ? "Chave de API presente." : "Chave de API ausente."
          }
        ],
        summary: hasKey ? "Provedor API pronto." : "API sem chave configurada."
      };
    }
  } catch (err: any) {
    console.info("[SMTP Startup] ℹ️ Verificação inicial de e-mail concluída:", err?.message || err);
    smtpState = {
      initialized: true,
      validating: false,
      ready: false,
      score: 0,
      lastCheckedAt: new Date().toISOString(),
      config: null,
      error: err.message || "Erro desconhecido na validação inicial",
      checks: [
        {
          step: "exception",
          title: "Erro de Execução",
          status: "error",
          message: err.message || "Exceção ao validar SMTP."
        }
      ],
      summary: "Falha na inicialização do serviço de e-mail."
    };
  } finally {
    smtpState.validating = false;
    console.groupEnd();
    notifyListeners();
  }

  return smtpState;
}

/**
 * Garante que o transporte SMTP esteja pronto antes de disparar o Termo de Afiliação
 * ou qualquer notificação crítica.
 * Se o handshake falhar, devolve relatório com instruções de correção.
 */
export async function ensureSmtpReady(options?: {
  forceRevalidate?: boolean;
}): Promise<{
  ready: boolean;
  error?: string;
  handshakeError?: string;
  diagnostics?: SmtpDiagnosticCheck[];
  state: SmtpRuntimeStatus;
}> {
  let state = getSmtpStatus();

  // Se ainda não foi inicializado ou se forçada revalidação ou se estava com erro prévio
  if (!state.initialized || options?.forceRevalidate || (!state.ready && state.error)) {
    state = await validateSmtpOnStartup(true);
  }

  if (state.ready) {
    return {
      ready: true,
      state
    };
  }

  const failedCheck = state.checks.find(c => c.status === "error") || state.checks.find(c => c.status === "warning");
  const handshakeErrorMsg = failedCheck ? `${failedCheck.title}: ${failedCheck.message}` : (state.error || "Transporte SMTP não está pronto para envios.");

  console.warn(`[SMTP Pre-flight] ⚠️ Termo de afiliação retido. Transporte SMTP não está pronto:`, {
    error: handshakeErrorMsg,
    tip: failedCheck?.tip,
    state
  });

  return {
    ready: false,
    error: state.error || "Servidor SMTP não está pronto para envios.",
    handshakeError: handshakeErrorMsg,
    diagnostics: state.checks,
    state
  };
}
