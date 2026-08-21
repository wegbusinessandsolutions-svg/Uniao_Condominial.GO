import React, { useState, useEffect } from "react";
import { SkeletonForm } from "../../components/ui/Skeleton";
import { motion, AnimatePresence } from "motion/react";
import {
  Mail,
  Server,
  Key,
  CheckCircle,
  AlertCircle,
  Send,
  Eye,
  EyeOff,
  Package,
  Layers,
  Sparkles,
  Save,
  RefreshCw,
  Info,
  ShieldCheck,
  Check,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Zap,
  Gauge,
  Terminal,
  HelpCircle
} from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { sendEmailWithLog, verifySmtpConfig, SmtpVerificationResult } from "../../lib/emailService";
import { initFirebase } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import EmailLogsTab from "../../components/admin/EmailLogsTab";
import WhatsAppTemplatesTab from "../../components/admin/WhatsAppTemplatesTab";

// Definitions of configuration shape
interface EmailTemplate {
  ativo: boolean;
  assunto: string;
  conteudo: string;
}

interface NotificationTemplates {
  mudancaStatus?: { ativo: boolean; assunto: string; conteudo: string };
  confirmacaoPedido: EmailTemplate;
  estoqueBaixo: EmailTemplate & { limiar: number; destinatarios: string };
  notificacaoCashback: EmailTemplate;
  novosBeneficios: EmailTemplate;
}

interface EmailConfig {
  metodo: "smtp" | "api";
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: "ssl" | "tls" | "none";
  apiProvider: "sendgrid" | "mailgun" | "ses" | "custom";
  apiKey: string;
  apiDomain: string;
  apiEndpoint: string;
  fromEmail: string;
  fromName: string;
  templates: NotificationTemplates;
}

const defaultEmailConfig: EmailConfig = {
  metodo: "smtp",
  smtpHost: "mail.uniaocondominial.com.br",
  smtpPort: 465,
  smtpUser: "notificacoes@uniaocondominial.com.br",
  smtpPass: "",
  smtpSecure: "ssl",
  apiProvider: "sendgrid",
  apiKey: "",
  apiDomain: "",
  apiEndpoint: "https://api.sendgrid.com/v3/mail/send",
  fromEmail: "notificacoes@uniaocondominial.com.br",
  fromName: "União Condominial - Central",
  templates: {
    confirmacaoPedido: {
      ativo: true,
      assunto: "Confirmação do Pedido #{{numero_pedido}} - União Condominial",
      conteudo: `Olá, <strong>{{nome_cliente}}</strong>!<br/><br/>Seu pedido <strong>#{{numero_pedido}}</strong> foi recebido com sucesso e já está sendo processado por nossa equipe comercial.<br/><br/><strong>Resumo Financeiro:</strong><br/>- Valor total dos produtos: R$ {{valor_total}}<br/>- Cashback acumulado nesta compra: <strong>R$ {{cashback_ganho}}</strong><br/><br/>Para acompanhar o status da sua entrega, acesse o painel administrativo do cliente na aba 'Meus Pedidos'.<br/><br/>Atenciosamente,<br/><strong>Equipe União Condominial</strong>`,
    },
    mudancaStatus: {
      ativo: true,
      assunto: "Atualização de Status do Pedido #{{numero_pedido}}",
      conteudo: `Olá, <strong>{{nome_cliente}}</strong>!<br/><br/>O status do seu pedido <strong>#{{numero_pedido}}</strong> foi atualizado para: <strong>{{novo_status}}</strong>.<br/><br/>Acompanhe as atualizações pelo seu painel.<br/><br/>Atenciosamente,<br/>Equipe`,
    },
    estoqueBaixo: {
      ativo: true,
      limiar: 5,
      destinatarios: "comercial@uniaocondominial.com.br, estoque@uniaocondominial.com.br",
      assunto: "[ALERTA DE ESTOQUE] Produto {{nome_produto}} atingiu nível crítico",
      conteudo: `<strong>Alerta Automático de Estoque Mínimo</strong><br/><br/>O seguinte produto atingiu ou está abaixo do limite mínimo de segurança cadastrado:<br/><br/>- <strong>Produto:</strong> {{nome_produto}}<br/>- <strong>SKU/Código:</strong> {{sku_produto}}<br/>- <strong>Quantidade Atual em Estoque:</strong> <span style="color: #dc2626; font-weight: bold;">{{quantidade_estoque}} unidades</span><br/>- <strong>Limiar Configurado:</strong> {{limiar_configurado}} unidades<br/><br/>Sugerimos contatar o fornecedor cadastrado para solicitar a reposição o quanto antes.<br/><br/>Sistema União Condominial`,
    },
    notificacaoCashback: {
      ativo: true,
      assunto: "Seu saldo de Cashback foi atualizado! R$ {{valor_cashback}} disponível",
      conteudo: `Olá, <strong>{{nome_cliente}}</strong>!<br/><br/>Temos ótimas notícias! O seu saldo de cashback na plataforma <strong>União Condominial</strong> foi atualizado.<br/><br/>- <strong>Transação:</strong> {{descricao_transacao}}<br/>- <strong>Valor da movimentação:</strong> <span style="color: #10b981; font-weight: bold;">R$ {{valor_movimentado}}</span><br/>- <strong>Saldo total disponível:</strong> <strong>R$ {{saldo_total}}</strong><br/><br/><strong>Opções de Resgate no seu Painel:</strong><br/>1. Gerar um <strong>cupom de desconto</strong> de valor integral ou parcial para abater no checkout do site.<br/>2. Solicitar transferência direta via <strong>chave Pix</strong> (lembrando que resgatar por Pix acarreta em uma taxa administrativa, recebendo 75% do valor total apresentado no painel).<br/><br/>Aproveite seus benefícios!<br/>Atenciosamente,<br/><strong>União Condominial</strong>`,
    },
    novosBeneficios: {
      ativo: true,
      assunto: "🎁 3 Novos Benefícios Exclusivos Adicionados no Clube União Condominial!",
      conteudo: `Olá, <strong>{{nome_cliente}}</strong>!<br/><br/>Temos ótimas notícias! Foram adicionados <strong>3 novos benefícios e descontos exclusivos</strong> para os moradores e condôminos no nosso <strong>Clube de Benefícios</strong>:<br/><br/>{{lista_novos_beneficios}}<br/><br/>Acesse agora seu painel de morador e confira os cupons e QR Codes para resgatar os descontos com as empresas parceiras!<br/><br/>Atenciosamente,<br/><strong>Equipe União Condominial</strong>`,
    },
  },
};

export default function ConfiguracaoNotificacoes() {
  const { profile } = useAuth();
  const [config, setConfig] = useState<EmailConfig>(defaultEmailConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // View states
  const [activeTab, setActiveTab] = useState<"provedor" | "templates" | "whatsapp" | "testador" | "logs">("provedor");
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<keyof NotificationTemplates>("confirmacaoPedido");
  const [previewMode, setPreviewMode] = useState(false);

  // Tester state
  const [testRecipient, setTestRecipient] = useState("");
  const [testTemplateType, setTestTemplateType] = useState<"teste_simples" | "pedido" | "estoque" | "cashback">("teste_simples");
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [testProgress, setTestProgress] = useState(0);
  const [testState, setTestState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [isSendingTemplateTest, setIsSendingTemplateTest] = useState(false);
  const [isQuickTesting, setIsQuickTesting] = useState(false);

  // SMTP Verification & Anti-Spam Diagnostics state
  const [isVerifyingSmtp, setIsVerifyingSmtp] = useState(false);
  const [smtpVerificationResult, setSmtpVerificationResult] = useState<SmtpVerificationResult | null>(null);
  const [showDnsHelp, setShowDnsHelp] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Load configuration from Firestore
  useEffect(() => {
    async function loadConfig() {
      try {
        const { db } = await initFirebase();
        const docRef = doc(db, "config", "email");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<EmailConfig>;
          setConfig({
            ...defaultEmailConfig,
            ...data,
            // Ensure default method is SMTP if not explicitly set
            metodo: data.metodo || "smtp",
            templates: {
              confirmacaoPedido: {
                ...defaultEmailConfig.templates.confirmacaoPedido,
                ...(data.templates?.confirmacaoPedido || {}),
              },
              mudancaStatus: {
                ativo: true,
                assunto: "Atualização de Status do Pedido #{{numero_pedido}}",
                conteudo: `Olá, <strong>{{nome_cliente}}</strong>!<br/><br/>O status do seu pedido <strong>#{{numero_pedido}}</strong> foi atualizado para: <strong>{{novo_status}}</strong>.<br/><br/>Acompanhe as atualizações pelo seu painel.<br/><br/>Atenciosamente,<br/>Equipe`,
                ...(data.templates?.mudancaStatus || {}),
              },
              estoqueBaixo: {
                ...defaultEmailConfig.templates.estoqueBaixo,
                ...(data.templates?.estoqueBaixo || {}),
              },
              notificacaoCashback: {
                ...defaultEmailConfig.templates.notificacaoCashback,
                ...(data.templates?.notificacaoCashback || {}),
              },
              novosBeneficios: {
                ...defaultEmailConfig.templates.novosBeneficios,
                ...(data.templates?.novosBeneficios || {}),
              },
            },
          });
        } else {
          await setDoc(docRef, defaultEmailConfig);
          setConfig(defaultEmailConfig);
        }
      } catch (err) {
        console.error("Erro ao carregar configurações de e-mail:", err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();

    if (profile?.email) {
      setTestRecipient(profile.email);
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const { db } = await initFirebase();
      const docRef = doc(db, "config", "email");
      await setDoc(docRef, config);
      setStatusMessage({ type: "success", text: "Configurações de e-mail e notificações salvas com sucesso!" });
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      console.error("Erro ao salvar configurações de e-mail:", err);
      setStatusMessage({ type: "error", text: "Erro ao salvar configurações: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  const applyHostgatorPreset = (preset: "ssl465" | "tls587") => {
    if (preset === "ssl465") {
      setConfig((prev) => ({
        ...prev,
        metodo: "smtp",
        smtpPort: 465,
        smtpSecure: "ssl",
        smtpHost: prev.smtpHost && prev.smtpHost !== "smtp.sendgrid.net" ? prev.smtpHost : "mail.seudominio.com.br",
      }));
      setStatusMessage({ type: "success", text: "Preset HostGator SSL (Porta 465) aplicado! Preencha seu Host, Usuário e Senha." });
    } else {
      setConfig((prev) => ({
        ...prev,
        metodo: "smtp",
        smtpPort: 587,
        smtpSecure: "tls",
        smtpHost: prev.smtpHost && prev.smtpHost !== "smtp.sendgrid.net" ? prev.smtpHost : "mail.seudominio.com.br",
      }));
      setStatusMessage({ type: "success", text: "Preset HostGator TLS (Porta 587) aplicado! Preencha seu Host, Usuário e Senha." });
    }
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const runSmtpVerification = async () => {
    setIsVerifyingSmtp(true);
    setStatusMessage(null);
    try {
      const result = await verifySmtpConfig({
        metodo: config.metodo,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass,
        smtpSecure: config.smtpSecure,
        fromEmail: config.fromEmail,
        fromName: config.fromName,
      });

      setSmtpVerificationResult(result);

      if (result.success) {
        setStatusMessage({
          type: "success",
          text: `Diagnóstico Concluído! Servidor SMTP autenticado com pontuação de entregabilidade de ${result.score}/100.`
        });
      } else {
        setStatusMessage({
          type: "error",
          text: `Falha na verificação SMTP: ${result.error || "Verifique os dados de conexão do HostGator."}`
        });
      }
    } catch (err: any) {
      console.error("Erro na verificação SMTP:", err);
      setStatusMessage({ type: "error", text: "Erro ao executar verificação: " + err.message });
    } finally {
      setIsVerifyingSmtp(false);
    }
  };


  const sendTemplateTestEmail = async () => {
    const targetEmail = testRecipient.trim() || profile?.email || "";
    if (!targetEmail || !targetEmail.includes("@")) {
      alert("Por favor, informe um endereço de e-mail de destino válido para o teste.");
      return;
    }

    setIsSendingTemplateTest(true);
    setStatusMessage(null);

    try {
      const template = config.templates[selectedTemplateKey];
      let html = template.conteudo;
      let subject = template.assunto;

      const mockVars: Record<string, string> = {
        "{{nome_cliente}}": profile?.nome || "Administrador",
        "{{numero_pedido}}": "123456",
        "{{valor_total}}": "1.250,00",
        "{{cashback_ganho}}": "25,00",
        "{{nome_produto}}": "Produto de Teste",
        "{{sku_produto}}": "TESTE-123",
        "{{quantidade_estoque}}": "2",
        "{{limiar_configurado}}": "5",
        "{{descricao_transacao}}": "Compra via Teste",
        "{{valor_movimentado}}": "50,00",
        "{{saldo_total}}": "150,00",
        "{{novo_status}}": "Em Separação",
        "{{lista_novos_beneficios}}": "<ul><li>10% de Desconto na Lavanderia</li><li>Troca de Óleo Grátis</li></ul>"
      };

      Object.entries(mockVars).forEach(([key, value]) => {
        html = html.replace(new RegExp(key, 'g'), value);
        subject = subject.replace(new RegExp(key, 'g'), value);
      });

      const result = await sendEmailWithLog({
        metodo: config.metodo,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass,
        smtpSecure: config.smtpSecure,
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        apiProvider: config.apiProvider,
        apiKey: config.apiKey,
        apiDomain: config.apiDomain,
        apiEndpoint: config.apiEndpoint,
        to: targetEmail,
        subject: `[Teste] ${subject}`,
        html: html
      }, `Teste Layout (${selectedTemplateKey})`, "TESTE");

      if (result.success) {
        setStatusMessage({ type: "success", text: `E-mail de teste enviado com sucesso via ${config.metodo === 'smtp' ? 'SMTP HostGator' : 'API'} para ${targetEmail}` });
      } else {
        setStatusMessage({ type: "error", text: `Falha no envio: ${result.error || 'Verifique as credenciais de SMTP'}` });
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: "error", text: "Erro ao enviar e-mail: " + err.message });
    } finally {
      setIsSendingTemplateTest(false);
      setTimeout(() => setStatusMessage(null), 6000);
    }
  };

  const runEmailTest = async () => {
    if (!testRecipient.trim() || !testRecipient.includes("@")) {
      alert("Por favor, informe um endereço de e-mail de destino válido.");
      return;
    }

    setTestState("sending");
    setTestProgress(15);
    setTestLogs([`[${new Date().toLocaleTimeString("pt-BR")}] Iniciando teste de comunicação de e-mail...`]);

    const addLog = (msg: string, progress: number) => {
      setTestLogs((prev) => [...prev, `[${new Date().toLocaleTimeString("pt-BR")}] ${msg}`]);
      setTestProgress(progress);
    };

    if (config.metodo === "smtp") {
      addLog(`Conectando ao servidor SMTP HostGator: ${config.smtpHost}:${config.smtpPort} (Segurança: ${config.smtpSecure.toUpperCase()})...`, 35);
      addLog(`Autenticando usuário [${config.smtpUser}] no servidor de correio...`, 60);
    } else {
      addLog(`Conectando à API ${config.apiProvider.toUpperCase()}...`, 40);
    }

    try {
      const result = await sendEmailWithLog({
        metodo: config.metodo,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass,
        smtpSecure: config.smtpSecure,
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        apiProvider: config.apiProvider,
        apiKey: config.apiKey,
        apiDomain: config.apiDomain,
        apiEndpoint: config.apiEndpoint,
        to: testRecipient.trim(),
        subject: `Teste Diagnóstico - ${config.fromName}`,
        html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0284c7;">Teste de Disparo de E-mail</h2>
          <p>Servidor: <strong>${config.metodo === 'smtp' ? `HostGator SMTP (${config.smtpHost}:${config.smtpPort})` : config.apiProvider}</strong></p>
          <p>Remetente: <strong>${config.fromName} &lt;${config.fromEmail || config.smtpUser}&gt;</strong></p>
          <p>Status: <strong style="color: #16a34a;">Conexão e Autenticação OK!</strong></p>
          <p style="color: #64748b; font-size: 12px; margin-top: 15px;">Mensagem gerada pelo painel administrativo União Condominial em ${new Date().toLocaleString('pt-BR')}.</p>
        </div>`
      }, `Diagnostico (${testTemplateType})`, "TESTE");

      if (result.success) {
        addLog(`MIME message entregue com sucesso pelo servidor de e-mails.`, 85);
        addLog(`✅ Sucesso! E-mail recebido pelo servidor de destino. ${result.data?.message || ''}`, 100);
        setTestState("success");
      } else {
        addLog(`❌ Falha no envio: ${result.error || result.data?.error || 'Erro desconhecido'}`, 100);
        setTestState("error");
      }
    } catch (err: any) {
      addLog(`❌ Erro de conexão: ${err.message}`, 100);
      setTestState("error");
    }
  };

  const handleQuickTest = async () => {
    const testEmail = testRecipient.trim();
    if (!testEmail || !testEmail.includes("@")) {
      setStatusMessage({ type: "error", text: "Por favor, digite um e-mail válido no campo de destino." });
      return;
    }

    setIsQuickTesting(true);
    setStatusMessage({ type: "success", text: "Enviando e-mail de teste para " + testEmail + "..." });

    try {
      const result = await sendEmailWithLog({
        metodo: config.metodo,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass,
        smtpSecure: config.smtpSecure,
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        apiProvider: config.apiProvider,
        apiKey: config.apiKey,
        apiDomain: config.apiDomain,
        apiEndpoint: config.apiEndpoint,
        to: testEmail,
        subject: "Mensagem de Teste - HostGator SMTP Confirmado",
        html: `<div style='font-family: Arial, sans-serif; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px; margin: 0 auto; color: #1e293b;'>
          <h2 style='color: #0284c7; margin-bottom: 12px;'>🎉 Integração SMTP HostGator Confirmada!</h2>
          <p>As configurações de SMTP da sua conta de e-mail estão funcionando perfeitamente no sistema da <strong>União Condominial</strong>.</p>
          <div style='background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 12px; color: #475569; margin: 15px 0;'>
            <strong>Servidor SMTP:</strong> ${config.smtpHost || 'mail.dominio.com'}:${config.smtpPort}<br/>
            <strong>Usuário Remetente:</strong> ${config.fromEmail || config.smtpUser}<br/>
            <strong>Segurança:</strong> ${config.smtpSecure?.toUpperCase() || 'SSL'}
          </div>
          <p style='font-size: 12px; color: #64748b;'>Data e Hora do disparo: ${new Date().toLocaleString("pt-BR")}</p>
        </div>`
      }, "Teste Rápido", "TESTE");

      if (result.success) {
        setStatusMessage({ type: "success", text: `Mensagem de teste enviada com sucesso para ${testEmail}!` });
      } else {
        setStatusMessage({ type: "error", text: `Falha ao enviar e-mail: ${result.error || "Verifique o usuário, senha e porta do HostGator"}` });
      }
    } catch (e: any) {
      setStatusMessage({ type: "error", text: "Erro na comunicação: " + e.message });
    } finally {
      setIsQuickTesting(false);
      setTimeout(() => setStatusMessage(null), 8000);
    }
  };

  const updateTemplateField = (key: keyof NotificationTemplates, field: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      templates: {
        ...prev.templates,
        [key]: {
          ...prev.templates[key],
          [field]: value,
        },
      },
    }));
  };

  if (loading) {
    return (
      <div className="w-full max-w-full space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-slate-150 rounded-xl animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 bg-slate-200 rounded w-48 animate-pulse" />
              <div className="h-3.5 bg-slate-150 rounded w-72 animate-pulse" />
            </div>
          </div>
          <div className="h-10 w-24 bg-slate-200 rounded-xl animate-pulse" />
        </div>
        <SkeletonForm fields={6} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-6">
      {/* Upper Status / Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-sky-50 rounded-2xl text-sky-600">
            <Mail size={28} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Configuração de E-mails e Notificações</h2>
            <p className="text-xs text-slate-500 mt-1">
              Configure o servidor SMTP da <strong>HostGator / cPanel</strong> para disparo de e-mails transacionais (pedidos, cashback, alertas).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-bold rounded-2xl text-xs md:text-sm shadow-sm transition-all hover:shadow-md cursor-pointer shrink-0"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl flex items-start gap-3 text-xs font-semibold shadow-3xs ${
            statusMessage.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle size={18} className="text-green-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-4 shadow-3xs space-y-2 h-fit">
          <button
            onClick={() => setActiveTab("provedor")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
              activeTab === "provedor"
                ? "bg-slate-900 text-white shadow-3xs"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Server size={16} />
            <span>Servidor SMTP / HostGator</span>
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
              activeTab === "templates"
                ? "bg-slate-900 text-white shadow-3xs"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Mail size={16} />
            <span>Modelos de E-mail (Templates)</span>
          </button>
          <button
            onClick={() => setActiveTab("whatsapp")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
              activeTab === "whatsapp"
                ? "bg-slate-900 text-white shadow-3xs"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Sparkles size={16} />
            <span>Modelos WhatsApp</span>
          </button>
          <button
            onClick={() => setActiveTab("testador")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
              activeTab === "testador"
                ? "bg-slate-900 text-white shadow-3xs"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Send size={16} />
            <span>Testador & Diagnóstico</span>
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
              activeTab === "logs"
                ? "bg-slate-900 text-white shadow-3xs"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Layers size={16} />
            <span>Logs de Envio</span>
          </button>

          <div className="pt-4 border-t border-slate-100 mt-4 px-2">
            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Protocolo Ativo</h4>
            <div className="mt-2 flex items-center gap-2 bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold text-slate-600">
                {config.metodo === "smtp" ? `HostGator SMTP (${config.smtpHost || "mail..."})` : `API REST (${config.apiProvider})`}
              </span>
            </div>
          </div>
        </div>

        {/* Configuration Pane */}
        <div className="lg:col-span-3 space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === "provedor" && (
              <motion.div
                key="provedor"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 shadow-3xs space-y-6"
              >
                <div>
                  <h3 className="text-base font-bold text-slate-900">Configurações do Servidor de Envio (SMTP HostGator)</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    A HostGator autentica seus envios via protocolo SMTP direto com o usuário e a senha da sua conta de e-mail criada no cPanel.
                  </p>
                </div>

                {/* Info Card Explaining Hostgator / SMTP */}
                <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-4 flex items-start gap-3.5">
                  <ShieldCheck size={22} className="text-sky-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-sky-950">HostGator opera 100% via SMTP (Sem Chave de API)</h4>
                    <p className="text-[11px] text-sky-800 leading-relaxed">
                      Não é necessário gerar nenhuma chave de API. O envio conecta-se de forma direta e segura com o servidor de correio da HostGator usando seu <strong>Host (mail.seudominio.com.br)</strong>, <strong>seu e-mail completo</strong> e a <strong>sua senha do e-mail</strong>.
                    </p>
                  </div>
                </div>

                {/* Method Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setConfig((prev) => ({ ...prev, metodo: "smtp" }))}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                      config.metodo === "smtp"
                        ? "border-sky-500 bg-sky-50/50 text-sky-950"
                        : "border-slate-150 hover:border-slate-300 text-slate-600 bg-white"
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl ${config.metodo === "smtp" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                      <Server size={18} />
                    </div>
                    <div>
                      <span className="text-xs font-bold block">Servidor SMTP HostGator / cPanel</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Padrão da HostGator com login e senha</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setConfig((prev) => ({ ...prev, metodo: "api" }))}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                      config.metodo === "api"
                        ? "border-sky-500 bg-sky-50/50 text-sky-950"
                        : "border-slate-150 hover:border-slate-300 text-slate-600 bg-white"
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl ${config.metodo === "api" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                      <Key size={18} />
                    </div>
                    <div>
                      <span className="text-xs font-bold block">API REST Opcional (SendGrid/Mailgun)</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Apenas se utilizar provedores externos de API</span>
                    </div>
                  </button>
                </div>

                {/* Presets Bar for HostGator */}
                {config.metodo === "smtp" && (
                  <div className="bg-slate-50 border border-slate-200/70 p-4 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                        <Sparkles size={14} className="text-amber-500" /> Preenchimento Rápido de Configuração HostGator:
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => applyHostgatorPreset("ssl465")}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-all cursor-pointer"
                      >
                        ⚡ HostGator SSL Seguro (Porta 465 - Recomendada)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyHostgatorPreset("tls587")}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-all cursor-pointer"
                      >
                        ⚡ HostGator TLS / STARTTLS (Porta 587)
                      </button>
                    </div>
                  </div>
                )}

                {/* Common Sender Settings */}
                <div className="bg-slate-50/60 border border-slate-100 p-5 rounded-2xl space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-200/60 pb-2">
                    <Info size={14} className="text-slate-500" />
                    Identidade do Remetente (Como os Clientes Vão Enxergar)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase">E-mail de Envio (From Email)</label>
                      <input
                        type="email"
                        required
                        placeholder="contato@seudominio.com.br"
                        value={config.fromEmail}
                        onChange={(e) => setConfig((prev) => ({ ...prev, fromEmail: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-4 focus:ring-sky-100 focus:border-sky-500 outline-none transition-all text-slate-800 font-medium"
                      />
                      <p className="text-[10px] text-slate-400">Deve ser a mesma conta de e-mail criada no HostGator.</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase">Nome do Remetente (From Name)</label>
                      <input
                        type="text"
                        required
                        placeholder="União Condominial"
                        value={config.fromName}
                        onChange={(e) => setConfig((prev) => ({ ...prev, fromName: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-4 focus:ring-sky-100 focus:border-sky-500 outline-none transition-all text-slate-800 font-medium"
                      />
                      <p className="text-[10px] text-slate-400">Nome da empresa ou central exibido na caixa de entrada.</p>
                    </div>
                  </div>
                </div>

                {/* Conditional Fields based on SMTP or API */}
                {config.metodo === "smtp" ? (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Servidor SMTP (Host)</label>
                        <input
                          type="text"
                          placeholder="mail.seudominio.com.br (ou br123.hostgator.com.br)"
                          value={config.smtpHost}
                          onChange={(e) => setConfig((prev) => ({ ...prev, smtpHost: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-4 focus:ring-sky-100 focus:border-sky-500 outline-none transition-all font-mono text-slate-800"
                        />
                        <p className="text-[10px] text-slate-400">Ex: <code>mail.seusite.com.br</code> ou o endereço do servidor no cPanel</p>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Porta SMTP</label>
                        <input
                          type="number"
                          placeholder="465 ou 587"
                          value={config.smtpPort || ""}
                          onChange={(e) => setConfig((prev) => ({ ...prev, smtpPort: parseInt(e.target.value) || 0 }))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-4 focus:ring-sky-100 focus:border-sky-500 outline-none transition-all text-slate-800"
                        />
                        <p className="text-[10px] text-slate-400">Geralmente <strong>465</strong> (SSL) ou <strong>587</strong> (TLS)</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Usuário / Login (E-mail Completo)</label>
                        <input
                          type="text"
                          placeholder="contato@seudominio.com.br"
                          value={config.smtpUser}
                          onChange={(e) => setConfig((prev) => ({ ...prev, smtpUser: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-4 focus:ring-sky-100 focus:border-sky-500 outline-none transition-all text-slate-800"
                        />
                        <p className="text-[10px] text-slate-400">Digite seu e-mail completo cadastrado no HostGator</p>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Senha do E-mail</label>
                        <div className="relative rounded-xl">
                          <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Senha da sua conta de e-mail"
                            value={config.smtpPass}
                            onChange={(e) => setConfig((prev) => ({ ...prev, smtpPass: e.target.value }))}
                            className="w-full border border-slate-200 rounded-xl pl-3 pr-10 py-2 text-xs focus:ring-4 focus:ring-sky-100 focus:border-sky-500 outline-none transition-all text-slate-800 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400">Senha criada para este e-mail no cPanel</p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <label className="text-[11px] font-bold text-slate-500 uppercase">Segurança de Conexão</label>
                      <div className="flex gap-4">
                        {[
                          { id: "ssl", label: "SSL (Porta 465 - Recomendada)" },
                          { id: "tls", label: "TLS / STARTTLS (Porta 587)" },
                          { id: "none", label: "Nenhuma (Porta 25 / Descriptografada)" }
                        ].map((sec) => (
                          <label key={sec.id} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                            <input
                              type="radio"
                              name="smtpSecure"
                              value={sec.id}
                              checked={config.smtpSecure === sec.id}
                              onChange={(e) => setConfig((prev) => ({ ...prev, smtpSecure: e.target.value as any }))}
                              className="text-sky-600 focus:ring-sky-500 rounded-full"
                            />
                            <span>{sec.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Provedor de API</label>
                        <select
                          value={config.apiProvider}
                          onChange={(e) => setConfig((prev) => ({ ...prev, apiProvider: e.target.value as any }))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-4 focus:ring-sky-100 focus:border-sky-500 outline-none transition-all text-slate-700 font-semibold"
                        >
                          <option value="sendgrid">Twilio SendGrid (v3 Mail Send)</option>
                          <option value="mailgun">Mailgun API (REST)</option>
                          <option value="ses">Amazon Simple Email Service (SES)</option>
                          <option value="custom">Outro (Custom REST Endpoint)</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Domínio Ativo (Mailgun / SES)</label>
                        <input
                          type="text"
                          placeholder="mg.seudominio.com"
                          value={config.apiDomain}
                          onChange={(e) => setConfig((prev) => ({ ...prev, apiDomain: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-4 focus:ring-sky-100 focus:border-sky-500 outline-none transition-all font-mono text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Token / Chave API (API Key)</label>
                        <div className="relative rounded-xl">
                          <input
                            type={showApiKey ? "text" : "password"}
                            placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            value={config.apiKey}
                            onChange={(e) => setConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                            className="w-full border border-slate-200 rounded-xl pl-3 pr-10 py-2 text-xs focus:ring-4 focus:ring-sky-100 focus:border-sky-500 outline-none transition-all text-slate-800 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Endpoint / Base URL</label>
                        <input
                          type="text"
                          placeholder="https://api.sendgrid.com/v3/..."
                          value={config.apiEndpoint}
                          onChange={(e) => setConfig((prev) => ({ ...prev, apiEndpoint: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-4 focus:ring-sky-100 focus:border-sky-500 outline-none transition-all text-slate-800 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* SMTP & ANTI-SPAM DIAGNOSTICS SUITE */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 text-white rounded-3xl p-6 shadow-md border border-slate-800 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={22} className="text-sky-400" />
                        <h3 className="text-sm md:text-base font-bold text-white">
                          Verificação SMTP Robusta & Diagnóstico Anti-Spam (Gmail / Outlook)
                        </h3>
                      </div>
                      <p className="text-xs text-slate-300">
                        Audita conexão, autenticação, criptografia TLS e alinhamento de DNS (SPF e DMARC) para garantir que termos e avisos cheguem na Caixa de Entrada.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={runSmtpVerification}
                      disabled={isVerifyingSmtp}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-all hover:scale-[1.02] cursor-pointer shrink-0"
                    >
                      {isVerifyingSmtp ? (
                        <>
                          <RefreshCw size={15} className="animate-spin text-slate-950" />
                          <span>Auditando Servidor...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={15} className="text-slate-950" />
                          <span>Executar Diagnóstico SMTP</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Results Pane */}
                  {smtpVerificationResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 pt-2 border-t border-slate-800"
                    >
                      {/* Score Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-base ${
                              smtpVerificationResult.score >= 85
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                : smtpVerificationResult.score >= 60
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                                : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                            }`}
                          >
                            {smtpVerificationResult.score}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">Pontuação de Entregabilidade</span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                  smtpVerificationResult.score >= 85
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : smtpVerificationResult.score >= 60
                                    ? "bg-amber-500/20 text-amber-300"
                                    : "bg-rose-500/20 text-rose-300"
                                }`}
                              >
                                {smtpVerificationResult.score >= 85
                                  ? "Excelente (Pronto para Gmail)"
                                  : smtpVerificationResult.score >= 60
                                  ? "Bom (Ajustes Recomendados)"
                                  : "Atenção (Risco de Spam)"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 mt-0.5">
                              {smtpVerificationResult.summary || "Auditoria realizada com sucesso."}
                            </p>
                          </div>
                        </div>

                        {smtpVerificationResult.resolvedIp && (
                          <div className="text-right text-[11px] text-slate-400 font-mono hidden sm:block">
                            <span>IP Servidor: <strong>{smtpVerificationResult.resolvedIp}</strong></span>
                            <br />
                            <span>Porta: <strong>{smtpVerificationResult.port}</strong></span>
                          </div>
                        )}
                      </div>

                      {/* Diagnostic Steps Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {smtpVerificationResult.checks.map((chk, idx) => (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 transition-all ${
                              chk.status === "ok"
                                ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-100"
                                : chk.status === "warning"
                                ? "bg-amber-950/30 border-amber-800/40 text-amber-100"
                                : "bg-rose-950/30 border-rose-800/40 text-rose-100"
                            }`}
                          >
                            <div className="shrink-0 mt-0.5">
                              {chk.status === "ok" && <CheckCircle2 size={16} className="text-emerald-400" />}
                              {chk.status === "warning" && <AlertTriangle size={16} className="text-amber-400" />}
                              {chk.status === "error" && <XCircle size={16} className="text-rose-400" />}
                            </div>
                            <div className="space-y-1 w-full">
                              <span className="font-bold block text-white text-[11px]">{chk.title}</span>
                              <p className="text-[10px] text-slate-300 leading-relaxed">{chk.message}</p>
                              {chk.tip && (
                                <div className="mt-1.5 p-2 rounded-xl bg-slate-900/80 border border-slate-700/60 text-[10px] text-amber-200">
                                  <strong>💡 Dica:</strong> {chk.tip}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* DNS Assistant Toggle */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowDnsHelp(!showDnsHelp)}
                      className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <HelpCircle size={14} />
                      <span>{showDnsHelp ? "Ocultar Guia de DNS Anti-Spam (HostGator / cPanel)" : "Ver Guia de Configuração de DNS Anti-Spam (SPF / DMARC para cPanel)"}</span>
                    </button>

                    {showDnsHelp && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-3 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs"
                      >
                        <p className="text-slate-300 text-[11px]">
                          Para que o <strong>Gmail, Yahoo e Outlook</strong> aceitem 100% dos seus e-mails sem classificar como spam, adicione estes registros na Zona de DNS do seu cPanel na HostGator:
                        </p>

                        <div className="space-y-2">
                          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-bold text-sky-400 uppercase">1. Registro SPF (TXT na raiz @)</span>
                              <p className="text-slate-300 font-mono text-[11px] select-all mt-0.5">
                                v=spf1 +a +mx include:_spf.hostgator.com.br ~all
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard("v=spf1 +a +mx include:_spf.hostgator.com.br ~all", "spf")}
                              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              {copiedField === "spf" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              <span>{copiedField === "spf" ? "Copiado!" : "Copiar SPF"}</span>
                            </button>
                          </div>

                          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-bold text-sky-400 uppercase">2. Registro DMARC (TXT no nome _dmarc)</span>
                              <p className="text-slate-300 font-mono text-[11px] select-all mt-0.5">
                                v=DMARC1; p=none; sp=none;
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard("v=DMARC1; p=none; sp=none;", "dmarc")}
                              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              {copiedField === "dmarc" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              <span>{copiedField === "dmarc" ? "Copiado!" : "Copiar DMARC"}</span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* TESTE DE ENVIO SECTION (INFERIOR) */}
                <div className="mt-8 pt-6 border-t border-slate-200">
                  <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <Send size={18} className="text-emerald-500" />
                    Validar Servidor HostGator (Teste Rápido de Envio)
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Informe seu e-mail pessoal abaixo para receber uma mensagem de teste imediata validando a autenticação do seu servidor HostGator.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 w-full">
                       <Mail size={16} className="text-slate-400" />
                       <input 
                         type="email" 
                         placeholder="Digite o e-mail de destino..." 
                         value={testRecipient}
                         onChange={(e) => setTestRecipient(e.target.value)}
                         className="bg-transparent border-none outline-none text-sm w-full text-slate-800"
                       />
                     </div>
                     <button
                        onClick={handleQuickTest}
                        disabled={isQuickTesting}
                        className="flex shrink-0 items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold rounded-xl text-sm shadow-sm transition-all hover:shadow-md cursor-pointer w-full sm:w-auto"
                      >
                        {isQuickTesting ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                        {isQuickTesting ? "Enviando..." : "Testar Envio via HostGator"}
                      </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "templates" && (
              <motion.div
                key="templates"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 shadow-3xs space-y-6"
              >
                <div>
                  <h3 className="text-base font-bold text-slate-900">Modelos de E-mail (Gatilhos Automáticos)</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Personalize os e-mails enviados aos clientes e administradores com tags dinâmicas.
                  </p>
                </div>

                {/* Tabs to choose which template to edit */}
                <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3">
                  <button
                    onClick={() => setSelectedTemplateKey("confirmacaoPedido")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      selectedTemplateKey === "confirmacaoPedido"
                        ? "bg-slate-900 text-white shadow-3xs"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Package size={14} />
                    <span>Confirmação de Pedido</span>
                  </button>
                  <button
                    onClick={() => setSelectedTemplateKey("mudancaStatus")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      selectedTemplateKey === "mudancaStatus"
                        ? "bg-slate-900 text-white shadow-3xs"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <RefreshCw size={14} />
                    <span>Mudança de Status</span>
                  </button>
                  <button
                    onClick={() => setSelectedTemplateKey("estoqueBaixo")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      selectedTemplateKey === "estoqueBaixo"
                        ? "bg-slate-900 text-white shadow-3xs"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <AlertCircle size={14} />
                    <span>Estoque Baixo</span>
                  </button>
                  <button
                    onClick={() => setSelectedTemplateKey("notificacaoCashback")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      selectedTemplateKey === "notificacaoCashback"
                        ? "bg-slate-900 text-white shadow-3xs"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Sparkles size={14} />
                    <span>Atualização de Cashback</span>
                  </button>
                  <button
                    onClick={() => setSelectedTemplateKey("novosBeneficios")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      selectedTemplateKey === "novosBeneficios"
                        ? "bg-slate-900 text-white shadow-3xs"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Sparkles size={14} />
                    <span>Novos Benefícios Clube</span>
                  </button>
                </div>

                {/* Template Configuration Area */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Status do Disparo Automático</h4>
                      <p className="text-[10px] text-slate-400">Ativar ou desativar o envio deste tipo de e-mail</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.templates[selectedTemplateKey]?.ativo !== false}
                        onChange={(e) => updateTemplateField(selectedTemplateKey, "ativo", e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                    </label>
                  </div>

                  {/* Stock Threshold (only for estoqueBaixo) */}
                  {selectedTemplateKey === "estoqueBaixo" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-amber-900 uppercase">Limiar de Ativação (Unidades)</label>
                        <input
                          type="number"
                          value={config.templates.estoqueBaixo.limiar}
                          onChange={(e) => updateTemplateField("estoqueBaixo", "limiar", parseInt(e.target.value) || 0)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:ring-4 focus:ring-sky-100 focus:border-sky-500 outline-none text-slate-800 font-bold"
                        />
                        <p className="text-[9px] text-slate-400">Dispara alerta quando o estoque for menor ou igual a este valor</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-amber-900 uppercase">Destinatários Internos (Separados por vírgula)</label>
                        <input
                          type="text"
                          placeholder="estoque@dominio.com, gerencia@dominio.com"
                          value={config.templates.estoqueBaixo.destinatarios}
                          onChange={(e) => updateTemplateField("estoqueBaixo", "destinatarios", e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:ring-4 focus:ring-sky-100 focus:border-sky-500 outline-none font-mono text-slate-800"
                        />
                        <p className="text-[9px] text-slate-400">Contatos internos que receberão o aviso do sistema</p>
                      </div>
                    </div>
                  )}

                  {/* Subject Input */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Assunto do E-mail</label>
                    <input
                      type="text"
                      required
                      placeholder="Assunto da mensagem"
                      value={config.templates[selectedTemplateKey].assunto}
                      onChange={(e) => updateTemplateField(selectedTemplateKey, "assunto", e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-4 focus:ring-sky-100 focus:border-sky-500 outline-none font-semibold text-slate-800"
                    />
                  </div>

                  {/* Body Content Editor */}
                  <div className="space-y-1.5 border border-slate-200 rounded-xl overflow-hidden shadow-3xs">
                    <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPreviewMode(false)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${!previewMode ? "bg-white text-sky-700 shadow-sm border border-slate-200" : "text-slate-500 hover:bg-slate-200/50"}`}
                        >
                          Código Fonte HTML
                        </button>
                        <button
                          onClick={() => setPreviewMode(true)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${previewMode ? "bg-white text-sky-700 shadow-sm border border-slate-200" : "text-slate-500 hover:bg-slate-200/50"}`}
                        >
                          Visualização (Preview)
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs shadow-2xs">
                          <Mail size={13} className="text-slate-400 shrink-0" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase hidden sm:inline">Para:</span>
                          <input
                            type="email"
                            placeholder="e-mail de teste..."
                            value={testRecipient}
                            onChange={(e) => setTestRecipient(e.target.value)}
                            className="w-36 sm:w-48 text-xs border-none outline-none text-slate-800 font-medium placeholder:text-slate-400 bg-transparent"
                            title="Endereço de e-mail que receberá este teste de layout"
                          />
                        </div>
                        <button
                          onClick={sendTemplateTestEmail}
                          disabled={isSendingTemplateTest}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                          <Send size={14} />
                          {isSendingTemplateTest ? "Enviando..." : "Enviar Teste"}
                        </button>
                      </div>
                    </div>

                    {!previewMode ? (
                      <textarea
                        rows={12}
                        value={config.templates[selectedTemplateKey].conteudo}
                        onChange={(e) => updateTemplateField(selectedTemplateKey, "conteudo", e.target.value)}
                        className="w-full p-4 text-xs focus:ring-inset focus:ring-2 focus:ring-sky-500 outline-none font-mono text-slate-800 leading-relaxed bg-[#f8fafc] resize-y border-none"
                        spellCheck="false"
                      />
                    ) : (
                      <div className="p-4 bg-white min-h-[250px] overflow-auto text-sm text-slate-800">
                        <div 
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: config.templates[selectedTemplateKey].conteudo.replace(/{{[a-z_]+}}/g, '<span class="bg-yellow-100 text-yellow-800 px-1 rounded font-mono text-[10px]">$&</span>') }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Template tags hint drawer */}
                  <div className="bg-yellow-50/50 border border-yellow-200 text-yellow-950 p-4 rounded-2xl text-xs space-y-1.5 shadow-3xs">
                    <span className="font-bold text-yellow-900 flex items-center gap-1">
                      <Sparkles size={14} className="text-yellow-600" /> Tags Dinâmicas Disponíveis:
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <code className="bg-white border border-yellow-200 px-1.5 py-0.5 rounded text-[10px] font-bold">{"{{nome_cliente}}"}</code>
                      <code className="bg-white border border-yellow-200 px-1.5 py-0.5 rounded text-[10px] font-bold">{"{{numero_pedido}}"}</code>
                      <code className="bg-white border border-yellow-200 px-1.5 py-0.5 rounded text-[10px] font-bold">{"{{valor_total}}"}</code>
                      <code className="bg-white border border-yellow-200 px-1.5 py-0.5 rounded text-[10px] font-bold">{"{{cashback_ganho}}"}</code>
                      <code className="bg-white border border-yellow-200 px-1.5 py-0.5 rounded text-[10px] font-bold">{"{{novo_status}}"}</code>
                      <code className="bg-white border border-yellow-200 px-1.5 py-0.5 rounded text-[10px] font-bold">{"{{saldo_total}}"}</code>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "whatsapp" && (
              <motion.div
                key="whatsapp"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <WhatsAppTemplatesTab />
              </motion.div>
            )}

            {activeTab === "testador" && (
              <motion.div
                key="testador"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 shadow-3xs space-y-6"
              >
                <div>
                  <h3 className="text-base font-bold text-slate-900">Testador e Diagnóstico em Tempo Real</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Execute um teste completo de envio pelo servidor SMTP da HostGator e visualize os retornos do servidor.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end bg-slate-50/60 p-5 rounded-2xl border border-slate-100">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">E-mail de Destino do Teste</label>
                    <input
                      type="email"
                      placeholder="seu-email@gmail.com"
                      value={testRecipient}
                      onChange={(e) => setTestRecipient(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-4 focus:ring-sky-100 focus:border-sky-500 outline-none text-slate-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Tipo de Notificação para Simular</label>
                    <select
                      value={testTemplateType}
                      onChange={(e) => setTestTemplateType(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-4 focus:ring-sky-100 focus:border-sky-500 outline-none text-slate-700 font-semibold"
                    >
                      <option value="teste_simples">Disparo de Teste Geral (Ping)</option>
                      <option value="pedido">Gatilho de Confirmação de Pedido</option>
                      <option value="estoque">Gatilho de Estoque Baixo</option>
                      <option value="cashback">Gatilho de Cashback Recebido/Atualizado</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={runSmtpVerification}
                    disabled={isVerifyingSmtp}
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-sky-600 hover:bg-sky-700 text-white disabled:bg-sky-400 font-bold rounded-2xl text-xs md:text-sm shadow-xs transition-all cursor-pointer"
                  >
                    {isVerifyingSmtp ? <RefreshCw size={15} className="animate-spin" /> : <Zap size={15} />}
                    {isVerifyingSmtp ? "Auditando Servidor..." : "1. Diagnosticar SMTP & Anti-Spam (Checkup)"}
                  </button>

                  <button
                    onClick={runEmailTest}
                    disabled={testState === "sending"}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white disabled:bg-slate-400 font-bold rounded-2xl text-xs md:text-sm shadow-xs transition-all cursor-pointer"
                  >
                    {testState === "sending" ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                    {testState === "sending" ? "Disparando via HostGator..." : "2. Disparar E-mail de Teste"}
                  </button>
                </div>

                {/* Diagnostic results preview in test tab */}
                {smtpVerificationResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={18} className="text-sky-400" />
                        <span className="text-xs font-bold text-white">Resultado do Diagnóstico SMTP & Anti-Spam</span>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                        smtpVerificationResult.score >= 85
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : smtpVerificationResult.score >= 60
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      }`}>
                        Score: {smtpVerificationResult.score}/100
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      {smtpVerificationResult.checks.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                          {c.status === "ok" && <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />}
                          {c.status === "warning" && <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />}
                          {c.status === "error" && <XCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />}
                          <div>
                            <span className="font-bold text-[11px] text-slate-200 block">{c.title}</span>
                            <span className="text-[10px] text-slate-400">{c.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Progress bar and logs */}
                {testState !== "idle" && (
                  <div className="space-y-3.5 bg-slate-950 text-slate-200 p-5 rounded-2xl font-mono text-xs border border-slate-800 shadow-xl overflow-hidden relative">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                      <span className="text-slate-400 font-bold text-[10px] uppercase flex items-center gap-1.5">
                        <Server size={13} className="text-sky-400" /> LOGS DE DEPURAÇÃO HOSTGATOR SMTP
                      </span>
                      <span className="text-[10px] text-sky-400 font-bold bg-sky-950/80 px-2 py-0.5 rounded border border-sky-900">
                        {testProgress}%
                      </span>
                    </div>

                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${testState === "error" ? "bg-red-500" : "bg-sky-500"}`}
                        style={{ width: `${testProgress}%` }}
                      />
                    </div>

                    <div className="space-y-1.5 max-h-[180px] overflow-y-auto pt-1 leading-relaxed text-[11px]">
                      {testLogs.map((log, index) => (
                        <p
                          key={index}
                          className={
                            log.includes("sucesso") || log.includes("✅") || log.includes("OK")
                              ? "text-emerald-400 font-semibold"
                              : log.includes("❌") || log.includes("Falha") || log.includes("Erro")
                              ? "text-rose-400 font-bold"
                              : log.includes("Iniciando")
                              ? "text-sky-400 font-bold"
                              : "text-slate-300"
                          }
                        >
                          {log}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "logs" && (
              <motion.div
                key="logs"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <EmailLogsTab />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
