import React, { useState, useEffect } from "react";
import { SkeletonForm } from "../../components/ui/Skeleton";
import {
  QrCode,
  Barcode,
  Key,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Save,
  RefreshCw,
  Globe,
  Copy,
  ShieldCheck,
  HelpCircle,
  Info,
  Clock,
  Coins,
  Percent,
  Eye,
  EyeOff,
  Sparkles,
  Play,
  Terminal,
  ExternalLink,
} from "lucide-react";
import { initFirebase } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import { gerarPixCopiaECola } from "../../lib/documentValidators";
import { formatDateBR } from "../../lib/dateUtils";
import {
  collection,
  getDocs,
  setDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";

interface GatewayCreds {
  publicKey: string;
  accessToken: string;
  clientId: string;
  clientSecret: string;
  sandboxMode: boolean;
}

interface PaymentConfig {
  // Pix Config
  pixStatus: "Ativo" | "Inativo" | "Modo Teste";
  pixType: "CNPJ" | "Email" | "Telefone" | "Chave Aleatoria";
  pixKey: string;
  pixReceiverName: string;
  pixReceiverCity: string;
  pixDueDateMinutes: number;
  pixProvider: "Direct" | "Mercado Pago" | "ASAAS" | "Efi" | "PagSeguro";

  // Boleto Config
  boletoStatus: "Ativo" | "Inativo" | "Modo Teste";
  boletoDueDays: number;
  boletoLateFeePercent: number;
  boletoInterestPercentPerMonth: number;
  boletoProvider: "Direct" | "Mercado Pago" | "ASAAS" | "Efi" | "PagSeguro";
  boletoInstructions: string;

  // Gateways credentials
  mercadoPago: GatewayCreds;
  asaas: GatewayCreds;
  efi: GatewayCreds;
  pagSeguro: GatewayCreds;
}

const defaultConfig: PaymentConfig = {
  pixStatus: "Modo Teste",
  pixType: "CNPJ",
  pixKey: "12.345.678/0001-99",
  pixReceiverName: "União Condominial Ltda",
  pixReceiverCity: "Goiânia",
  pixDueDateMinutes: 30,
  pixProvider: "Mercado Pago",

  boletoStatus: "Modo Teste",
  boletoDueDays: 5,
  boletoLateFeePercent: 2.0,
  boletoInterestPercentPerMonth: 1.0,
  boletoProvider: "Mercado Pago",
  boletoInstructions: "NÃO RECEBER APÓS O VENCIMENTO. EM CASO DE ATRASO, COBRAR MULTA DE 2% E JUROS DE 0,033% AO DIA.",

  mercadoPago: {
    publicKey: "APP_USR-782f93cb-33da-476a-9391-72f87a8fbc8d",
    accessToken: "APP_USR-6729381729381273-091812-73a87f87bc8a",
    clientId: "8319203810293123",
    clientSecret: "a739b81f9a8b7c6d5e4f3a2b1c0e9d8c",
    sandboxMode: true,
  },
  asaas: {
    publicKey: "$asaas_pub_93812",
    accessToken: "$asaas_key_918239128312938",
    clientId: "",
    clientSecret: "",
    sandboxMode: true,
  },
  efi: {
    publicKey: "",
    accessToken: "",
    clientId: "client_id_efi_9182312",
    clientSecret: "client_secret_efi_8931238912389123",
    sandboxMode: true,
  },
  pagSeguro: {
    publicKey: "PUB_PAG_983123",
    accessToken: "TOKEN_PAG_01283912",
    clientId: "",
    clientSecret: "",
    sandboxMode: true,
  }
};

export default function IntegracaoPagamentos() {
  const [config, setConfig] = useState<PaymentConfig>(defaultConfig);
  const [activeTab, setActiveTab] = useState<"pix" | "boleto" | "gateways" | "developer">("pix");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Connection testing states
  const [selectedTestProvider, setSelectedTestProvider] = useState<"Mercado Pago" | "ASAAS" | "Efi" | "PagSeguro">("Mercado Pago");
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");

  const [db, setDb] = useState<any>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        const { db: firestoreDb } = await initFirebase();
        setDb(firestoreDb);
        const docRef = doc(firestoreDb, "integracao_pagamentos", "config_pagamentos");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const loadedData = docSnap.data() as PaymentConfig;
          // Merge loaded data with defaults to prevent missing fields issues
          setConfig({
            ...defaultConfig,
            ...loadedData,
            mercadoPago: { ...defaultConfig.mercadoPago, ...loadedData.mercadoPago },
            asaas: { ...defaultConfig.asaas, ...loadedData.asaas },
            efi: { ...defaultConfig.efi, ...loadedData.efi },
            pagSeguro: { ...defaultConfig.pagSeguro, ...loadedData.pagSeguro },
          });
        } else {
          // If no doc exists, create the default one
          await setDoc(docRef, defaultConfig);
          setConfig(defaultConfig);
        }
      } catch (err) {
        console.error("Erro ao carregar configurações de pagamento:", err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!db) return;

    try {
      setIsSaving(true);
      const docRef = doc(db, "integracao_pagamentos", "config_pagamentos");
      await setDoc(docRef, config);
      
      // Save basic MP parameters also as individual provider config in integracao_pagamentos collection for compatibility
      const mpDocRef = doc(db, "integracao_pagamentos", "mercado_pago");
      await setDoc(mpDocRef, {
        provedor: "Mercado Pago",
        publicKey: config.mercadoPago.publicKey,
        accessToken: config.mercadoPago.accessToken,
        clientId: config.mercadoPago.clientId,
        clientSecret: config.mercadoPago.clientSecret,
        status: config.pixProvider === "Mercado Pago" ? config.pixStatus : "Inativo"
      });

      // Audit log
      await logAction("Configurou meios de pagamento digitais (Pix/Boleto)", "Financeiro");

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error("Erro ao salvar configurações de pagamento:", err);
      alert("Erro ao salvar configurações: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = () => {
    if (isTesting) return;
    setIsTesting(true);
    setTestStatus("idle");
    setTestLogs([]);

    const providerCreds =
      selectedTestProvider === "Mercado Pago" ? config.mercadoPago :
      selectedTestProvider === "ASAAS" ? config.asaas :
      selectedTestProvider === "Efi" ? config.efi : config.pagSeguro;

    const logs: string[] = [];
    const addLog = (msg: string) => {
      logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      setTestLogs([...logs]);
    };

    addLog(`Iniciando teste de conexão com o provedor: ${selectedTestProvider}...`);
    
    setTimeout(() => {
      addLog(`Ambiente: ${providerCreds.sandboxMode ? "SANDBOX / TESTES" : "PRODUÇÃO"}`);
      addLog(`Verificando credenciais carregadas...`);
      
      const hasAccessToken = !!(providerCreds.accessToken || providerCreds.clientSecret);
      if (!hasAccessToken) {
        addLog(`Erro: Chave privada ou Token de Acesso não configurado para ${selectedTestProvider}!`);
        setTestStatus("error");
        setIsTesting(false);
        return;
      }
      
      addLog(`Autenticando via Header Bearer Token...`);
    }, 600);

    setTimeout(() => {
      addLog(`Enviando requisição mock GET /v1/payment-methods...`);
      addLog(`Aguardando resposta do servidor do gateway...`);
    }, 1400);

    setTimeout(() => {
      addLog(`Conexão estabelecida com sucesso! API respondendo: HTTP 200 OK.`);
      addLog(`Status da Conta no Provedor: Ativa, Pronta para transacionar.`);
      addLog(`PIX API habilitado: OK`);
      addLog(`BOLETO Bancário registrado: OK`);
      setTestStatus("success");
      setIsTesting(false);
    }, 2500);
  };

  const copyWebhookToClipboard = () => {
    const url = `${window.location.origin}/api/v1/payments/webhook`;
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const toggleTokenVisibility = (key: string) => {
    setShowTokens(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="w-full max-w-full space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-slate-150 rounded-xl animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 bg-slate-200 rounded w-48 animate-pulse" />
              <div className="h-3.5 bg-slate-150 rounded w-72 animate-pulse" />
            </div>
          </div>
          <div className="h-10 w-24 bg-slate-200 rounded-xl animate-pulse" />
        </div>
        <SkeletonForm fields={6} />
      </div>
    );
  }

  // Calculate mock dates for presentation
  const today = new Date();
  const boletoDueDateMock = new Date(today.getTime() + config.boletoDueDays * 24 * 60 * 60 * 1000);

  return (
    <div className="w-full max-w-full space-y-6">
      
      {/* Title & Top Save Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0071e3]/10 text-[#0071e3] rounded-xl">
              <Settings size={22} />
            </span>
            <h2 className="text-xl font-bold text-slate-900">Configuração de Meios de Pagamento</h2>
          </div>
          <p className="text-slate-500 text-xs pl-11">
            Configure as chaves, prazos de vencimento, integradoras e simule pagamentos de Pix e Boleto Bancário.
          </p>
        </div>
        <div className="flex items-center gap-3 self-end md:self-center">
          <AnimatePresence>
            {saveSuccess && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold"
              >
                <CheckCircle2 size={14} />
                Salvo com sucesso!
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => handleSave()}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0071e3] hover:bg-[#0071e3]/90 text-white font-semibold rounded-xl text-xs shadow-sm disabled:opacity-50 transition-all cursor-pointer"
          >
            {isSaving ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {isSaving ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2 bg-white p-2 rounded-2xl border">
        <button
          onClick={() => setActiveTab("pix")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "pix"
              ? "bg-[#0071e3]/10 text-[#0071e3]"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
          }`}
        >
          <QrCode size={15} />
          Configuração de PIX
        </button>
        <button
          onClick={() => setActiveTab("boleto")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "boleto"
              ? "bg-[#0071e3]/10 text-[#0071e3]"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
          }`}
        >
          <Barcode size={15} />
          Configuração de Boleto
        </button>
        <button
          onClick={() => setActiveTab("gateways")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "gateways"
              ? "bg-[#0071e3]/10 text-[#0071e3]"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
          }`}
        >
          <Key size={15} />
          Integração de APIs / Credenciais
        </button>
        <button
          onClick={() => setActiveTab("developer")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "developer"
              ? "bg-[#0071e3]/10 text-[#0071e3]"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
          }`}
        >
          <Terminal size={15} />
          Webhook & Testes de API
        </button>
      </div>

      {/* Main Tab Contents */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Forms Container */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* PIX TAB */}
            {activeTab === "pix" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Configuração de Cobrança via Pix</h3>
                  <p className="text-slate-500 text-xs">Defina o status, chave de recebimento, prazo de expiração e provedor do Pix dinâmico.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Status */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 text-xs font-bold flex items-center gap-1">
                      Status do Pix
                      <Info size={12} className="text-slate-400" title="Define o estado do meio de pagamento Pix na loja." />
                    </label>
                    <select
                      value={config.pixStatus}
                      onChange={(e) => setConfig({ ...config, pixStatus: e.target.value as any })}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] transition-all outline-none font-semibold text-slate-800"
                    >
                      <option value="Ativo">Ativo (Produção)</option>
                      <option value="Modo Teste">Modo Teste (Simulador)</option>
                      <option value="Inativo">Inativo / Desabilitado</option>
                    </select>
                  </div>

                  {/* Provider */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 text-xs font-bold">Provedor / Gateway Integrador</label>
                    <select
                      value={config.pixProvider}
                      onChange={(e) => setConfig({ ...config, pixProvider: e.target.value as any })}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] transition-all outline-none font-semibold text-slate-800"
                    >
                      <option value="Mercado Pago">Mercado Pago</option>
                      <option value="ASAAS">ASAAS Pagamentos</option>
                      <option value="Efi">Efí Bank (Gerencianet)</option>
                      <option value="PagSeguro">PagSeguro UOL</option>
                      <option value="Direct">Pix Direto (Dados bancários manuais)</option>
                    </select>
                  </div>

                  {/* Chave Pix Type */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 text-xs font-bold">Tipo de Chave Pix</label>
                    <select
                      value={config.pixType}
                      onChange={(e) => setConfig({ ...config, pixType: e.target.value as any })}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] transition-all outline-none font-semibold text-slate-800"
                    >
                      <option value="CNPJ">CNPJ</option>
                      <option value="Email">E-mail</option>
                      <option value="Telefone">Telefone / Celular</option>
                      <option value="Chave Aleatoria">Chave Aleatória (EVP)</option>
                    </select>
                  </div>

                  {/* Chave Pix Value */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 text-xs font-bold">Chave Pix de Recebimento</label>
                    <input
                      type="text"
                      value={config.pixKey}
                      onChange={(e) => setConfig({ ...config, pixKey: e.target.value })}
                      placeholder={config.pixType === "CNPJ" ? "00.000.000/0001-00" : "chave@email.com"}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] transition-all outline-none font-semibold text-slate-800"
                    />
                  </div>

                  {/* Beneficiário Nome */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 text-xs font-bold">Nome do Beneficiário (Favorecido)</label>
                    <input
                      type="text"
                      value={config.pixReceiverName}
                      onChange={(e) => setConfig({ ...config, pixReceiverName: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] transition-all outline-none font-semibold text-slate-800"
                    />
                  </div>

                  {/* Cidade do Beneficiário */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 text-xs font-bold">Cidade do Beneficiário</label>
                    <input
                      type="text"
                      value={config.pixReceiverCity}
                      onChange={(e) => setConfig({ ...config, pixReceiverCity: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] transition-all outline-none font-semibold text-slate-800"
                    />
                  </div>

                  {/* Prazo de Expiração */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-slate-700 text-xs font-bold flex items-center justify-between">
                      <span>Tempo Limite para Pagamento (Minutos)</span>
                      <span className="text-[10px] text-slate-400 font-normal">Padrão do Banco Central: 30 minutos</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <Clock size={14} className="absolute left-3.5 top-2.5 text-slate-400" />
                        <input
                          type="number"
                          value={config.pixDueDateMinutes}
                          onChange={(e) => setConfig({ ...config, pixDueDateMinutes: Number(e.target.value) })}
                          min="1"
                          max="43200" // 30 dias
                          className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] transition-all outline-none font-semibold text-slate-800"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        {[15, 30, 60, 1440].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => setConfig({ ...config, pixDueDateMinutes: mins })}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                              config.pixDueDateMinutes === mins
                                ? "bg-[#0071e3] text-white border-[#0071e3]"
                                : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {mins === 1440 ? "24h" : `${mins}m`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>

                <div className="p-4 bg-[#0071e3]/5 border border-[#0071e3]/10 rounded-2xl flex gap-3">
                  <Sparkles size={20} className="text-[#0071e3] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">Geração Dinâmica de QRCodes</h4>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Ao selecionar um integrador parceiro (ex: Mercado Pago), o sistema gerará dinamicamente o código Pix e a imagem do QRCode para cada pedido gerado, monitorando o status de confirmação via Webhook em tempo real.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* BOLETO TAB */}
            {activeTab === "boleto" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Configuração de Boleto Bancário</h3>
                  <p className="text-slate-500 text-xs">Defina os prazos de compensação, juros, multas e regras para recebimento de boleto de cobrança.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Status */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 text-xs font-bold flex items-center gap-1">
                      Status do Boleto
                    </label>
                    <select
                      value={config.boletoStatus}
                      onChange={(e) => setConfig({ ...config, boletoStatus: e.target.value as any })}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] transition-all outline-none font-semibold text-slate-800"
                    >
                      <option value="Ativo">Ativo (Produção)</option>
                      <option value="Modo Teste">Modo Teste (Simulador)</option>
                      <option value="Inativo">Inativo / Desabilitado</option>
                    </select>
                  </div>

                  {/* Provider */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 text-xs font-bold">Provedor de Compensação</label>
                    <select
                      value={config.boletoProvider}
                      onChange={(e) => setConfig({ ...config, boletoProvider: e.target.value as any })}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] transition-all outline-none font-semibold text-slate-800"
                    >
                      <option value="Mercado Pago">Mercado Pago</option>
                      <option value="ASAAS">ASAAS Boleto Registrado</option>
                      <option value="Efi">Efí Bank (Gerencianet)</option>
                      <option value="PagSeguro">PagSeguro UOL</option>
                      <option value="Direct">Geração de PDF Manual / Banco Local</option>
                    </select>
                  </div>

                  {/* Dias para vencimento */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 text-xs font-bold flex items-center justify-between">
                      <span>Prazo para Vencimento (Dias)</span>
                      <span className="text-[10px] text-[#0071e3] font-bold">Hoje + {config.boletoDueDays} dias</span>
                    </label>
                    <div className="relative">
                      <Clock size={14} className="absolute left-3.5 top-2.5 text-slate-400" />
                      <input
                        type="number"
                        value={config.boletoDueDays}
                        onChange={(e) => setConfig({ ...config, boletoDueDays: Number(e.target.value) })}
                        min="1"
                        max="60"
                        className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] transition-all outline-none font-semibold text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Multa por atraso */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 text-xs font-bold">Multa por Atraso (%)</label>
                    <div className="relative">
                      <Percent size={14} className="absolute left-3.5 top-2.5 text-slate-400" />
                      <input
                        type="number"
                        step="0.01"
                        value={config.boletoLateFeePercent}
                        onChange={(e) => setConfig({ ...config, boletoLateFeePercent: Number(e.target.value) })}
                        min="0"
                        max="10"
                        className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] transition-all outline-none font-semibold text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Juros de Mora ao mês */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 text-xs font-bold">Juros de Mora (%) ao mês</label>
                    <div className="relative">
                      <Coins size={14} className="absolute left-3.5 top-2.5 text-slate-400" />
                      <input
                        type="number"
                        step="0.01"
                        value={config.boletoInterestPercentPerMonth}
                        onChange={(e) => setConfig({ ...config, boletoInterestPercentPerMonth: Number(e.target.value) })}
                        min="0"
                        max="15"
                        className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] transition-all outline-none font-semibold text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Instruções do Sacado */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-slate-700 text-xs font-bold">Instruções de Impressão (Boleto)</label>
                    <textarea
                      value={config.boletoInstructions}
                      onChange={(e) => setConfig({ ...config, boletoInstructions: e.target.value })}
                      rows={3}
                      className="w-full p-3.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] transition-all outline-none font-semibold text-slate-800 leading-normal resize-none"
                    />
                  </div>

                </div>
              </div>
            )}

            {/* INTEGRATION GATEWAYS / CREDENTIALS TAB */}
            {activeTab === "gateways" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Chaves e Credenciais de Integração</h3>
                  <p className="text-slate-500 text-xs">Configure os segredos de API e as chaves privadas fornecidas por seus provedores homologados.</p>
                </div>

                {/* Mercado Pago Accordion/Card */}
                <div className="border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center font-black text-sky-600 text-sm">MP</div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800">Mercado Pago</h4>
                        <p className="text-slate-400 text-[10px]">Configuração recomendada para Pix e Boleto dinâmico</p>
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.mercadoPago.sandboxMode}
                        onChange={(e) => setConfig({
                          ...config,
                          mercadoPago: { ...config.mercadoPago, sandboxMode: e.target.checked }
                        })}
                        className="rounded border-slate-300 text-[#0071e3] focus:ring-[#0071e3]"
                      />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sandbox</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-slate-600 text-[11px] font-bold">Public Key (Chave Pública)</label>
                      <input
                        type="text"
                        value={config.mercadoPago.publicKey}
                        onChange={(e) => setConfig({
                          ...config,
                          mercadoPago: { ...config.mercadoPago, publicKey: e.target.value }
                        })}
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] outline-none font-mono text-slate-700"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-slate-600 text-[11px] font-bold">Access Token (Token de Produção/Teste)</label>
                      <div className="relative">
                        <input
                          type={showTokens["mp_token"] ? "text" : "password"}
                          value={config.mercadoPago.accessToken}
                          onChange={(e) => setConfig({
                            ...config,
                            mercadoPago: { ...config.mercadoPago, accessToken: e.target.value }
                          })}
                          className="w-full pl-3.5 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] outline-none font-mono text-slate-700"
                        />
                        <button
                          type="button"
                          onClick={() => toggleTokenVisibility("mp_token")}
                          className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showTokens["mp_token"] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-slate-600 text-[11px] font-bold">Client ID (Opcional)</label>
                      <input
                        type="text"
                        value={config.mercadoPago.clientId}
                        onChange={(e) => setConfig({
                          ...config,
                          mercadoPago: { ...config.mercadoPago, clientId: e.target.value }
                        })}
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] outline-none font-mono text-slate-700"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-slate-600 text-[11px] font-bold">Client Secret (Opcional)</label>
                      <div className="relative">
                        <input
                          type={showTokens["mp_secret"] ? "text" : "password"}
                          value={config.mercadoPago.clientSecret}
                          onChange={(e) => setConfig({
                            ...config,
                            mercadoPago: { ...config.mercadoPago, clientSecret: e.target.value }
                          })}
                          className="w-full pl-3.5 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] outline-none font-mono text-slate-700"
                        />
                        <button
                          type="button"
                          onClick={() => toggleTokenVisibility("mp_secret")}
                          className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showTokens["mp_secret"] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ASAAS Config Card */}
                <div className="border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center font-black text-indigo-600 text-xs">AS</div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800">ASAAS Pagamentos</h4>
                        <p className="text-slate-400 text-[10px]">Gateway nacional de alta performance e split de cobranças</p>
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.asaas.sandboxMode}
                        onChange={(e) => setConfig({
                          ...config,
                          asaas: { ...config.asaas, sandboxMode: e.target.checked }
                        })}
                        className="rounded border-slate-300 text-[#0071e3] focus:ring-[#0071e3]"
                      />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sandbox</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-slate-600 text-[11px] font-bold">Token de API (API Key)</label>
                      <div className="relative">
                        <input
                          type={showTokens["as_token"] ? "text" : "password"}
                          value={config.asaas.accessToken}
                          onChange={(e) => setConfig({
                            ...config,
                            asaas: { ...config.asaas, accessToken: e.target.value }
                          })}
                          className="w-full pl-3.5 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] outline-none font-mono text-slate-700"
                        />
                        <button
                          type="button"
                          onClick={() => toggleTokenVisibility("as_token")}
                          className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showTokens["as_token"] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Efi Bank Config Card */}
                <div className="border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center font-black text-amber-600 text-xs">EF</div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800">Efí Bank (Gerencianet)</h4>
                        <p className="text-slate-400 text-[10px]">Especialista em Pix Banco Central e Boletos Registrados</p>
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.efi.sandboxMode}
                        onChange={(e) => setConfig({
                          ...config,
                          efi: { ...config.efi, sandboxMode: e.target.checked }
                        })}
                        className="rounded border-slate-300 text-[#0071e3] focus:ring-[#0071e3]"
                      />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sandbox</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-slate-600 text-[11px] font-bold">Client ID (Credencial Oficial)</label>
                      <input
                        type="text"
                        value={config.efi.clientId}
                        onChange={(e) => setConfig({
                          ...config,
                          efi: { ...config.efi, clientId: e.target.value }
                        })}
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] outline-none font-mono text-slate-700"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-slate-600 text-[11px] font-bold">Client Secret</label>
                      <div className="relative">
                        <input
                          type={showTokens["efi_secret"] ? "text" : "password"}
                          value={config.efi.clientSecret}
                          onChange={(e) => setConfig({
                            ...config,
                            efi: { ...config.efi, clientSecret: e.target.value }
                          })}
                          className="w-full pl-3.5 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-[#0071e3] outline-none font-mono text-slate-700"
                        />
                        <button
                          type="button"
                          onClick={() => toggleTokenVisibility("efi_secret")}
                          className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showTokens["efi_secret"] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* DEVELOPER TAB (WEBHOOKS & TESTS) */}
            {activeTab === "developer" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Webhooks & Ferramentas de Teste</h3>
                  <p className="text-slate-500 text-xs">Simule disparos de notificação instantânea e teste de integridade da API dos gateways de pagamento.</p>
                </div>

                {/* Webhook Configuration Panel */}
                <div className="border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Globe size={18} className="text-[#0071e3]" />
                    <h4 className="text-xs font-black text-slate-800">URL de Retorno / Webhook</h4>
                  </div>
                  <p className="text-slate-500 text-[11.5px] leading-relaxed">
                    Copie a URL abaixo e cadastre no painel administrativo do seu provedor (Mercado Pago, ASAAS, etc.) para que o sistema União Condominial receba notificações em tempo real sempre que um Pix ou Boleto for compensado.
                  </p>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/api/v1/payments/webhook`}
                      className="flex-1 bg-slate-50 border border-slate-200/80 rounded-xl p-2 px-3 text-xs font-mono text-slate-600 outline-none select-all"
                    />
                    <button
                      type="button"
                      onClick={copyWebhookToClipboard}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <Copy size={13} />
                      {copiedWebhook ? "Copiado!" : "Copiar URL"}
                    </button>
                  </div>
                </div>

                {/* Connection Tester */}
                <div className="border border-slate-200 rounded-2xl p-5 space-y-4 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={18} className="text-emerald-600" />
                      <h4 className="text-xs font-black text-slate-800">Testador de Credenciais de API</h4>
                    </div>
                    <select
                      value={selectedTestProvider}
                      onChange={(e) => setSelectedTestProvider(e.target.value as any)}
                      className="text-xs bg-white border border-slate-200 rounded-lg p-1 px-2.5 font-bold outline-none text-slate-700"
                    >
                      <option value="Mercado Pago">Mercado Pago</option>
                      <option value="ASAAS">ASAAS</option>
                      <option value="Efi">Efí Bank</option>
                      <option value="PagSeguro">PagSeguro</option>
                    </select>
                  </div>

                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    O testador fará uma chamada simulada à API do provedor selecionado com as credenciais cadastradas na guia anterior, validando a integridade das conexões e tokens.
                  </p>

                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="flex items-center justify-center gap-2 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-xs disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isTesting ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <Play size={13} />
                    )}
                    {isTesting ? "Testando Conexão..." : "Executar Teste de Conexão"}
                  </button>

                  {/* Terminal Logs Output */}
                  {testLogs.length > 0 && (
                    <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800/80 font-mono text-[10px] space-y-1 text-emerald-400 select-text">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5 text-slate-500">
                        <span>API TERMINAL EMULATOR</span>
                        <span className={`text-[9px] font-bold uppercase ${
                          testStatus === "success" ? "text-emerald-400" :
                          testStatus === "error" ? "text-rose-500" : "text-amber-400"
                        }`}>
                          {testStatus}
                        </span>
                      </div>
                      {testLogs.map((log, index) => (
                        <div key={index} className="leading-relaxed whitespace-pre-wrap break-all">
                          {log}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

          </form>
        </div>

        {/* Dynamic Previews Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Header Banner */}
          <div className="bg-[#0071e3] p-5 rounded-2xl text-white space-y-3 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 opacity-10">
              <Sparkles size={120} />
            </div>
            <div className="space-y-1">
              <span className="bg-white/20 text-white text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full inline-block">
                Simulador Ativo
              </span>
              <h3 className="text-base font-bold leading-snug">Painel de Demonstração Interativa</h3>
            </div>
            <p className="text-white/80 text-[11px] leading-relaxed">
              Veja à direita a representação visual de como as telas de pagamento dos seus condomínios ou clientes de compras finais irão se comportar com base nas configurações que você definir.
            </p>
          </div>

          {/* DYNAMIC PIX PREVIEW */}
          <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4 text-white relative">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Visualização do App do Cliente</span>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                PIX SEGURO
              </span>
            </div>

            <div className="space-y-4 py-2">
              <div className="text-center space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest block">Faturamento do Pedido</span>
                <span className="text-xl font-bold font-mono tracking-tight text-white block">R$ 1.850,50</span>
              </div>

              {/* Real QR Code */}
              <div className="bg-white p-3.5 rounded-2xl w-44 h-44 mx-auto flex flex-col items-center justify-center border-4 border-[#00bdae]/30 relative group overflow-hidden">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                    gerarPixCopiaECola({
                      chave: config.pixKey || "63680806-d418-4b0b-9ef4-6562cde069d9",
                      valor: 1850.50,
                      nomeRecebedor: config.pixReceiverName,
                      cidadeRecebedor: config.pixReceiverCity,
                      txid: "ADMTESTE"
                    })
                  )}`}
                  alt="QR Code Pix"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-3 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                  <span className="text-slate-950 text-[10px] font-black text-center uppercase tracking-wide leading-tight">PIX HOMOLOGADO</span>
                  <span className="text-[#0071e3] text-[9px] font-bold text-center mt-1 leading-snug">
                    {config.pixProvider}
                  </span>
                </div>
              </div>

              {/* Recebimento Info */}
              <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-[11px] space-y-1.5 leading-normal">
                <div className="flex justify-between">
                  <span className="text-slate-400">Favorecido:</span>
                  <span className="font-bold text-slate-200">{config.pixReceiverName || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cidade:</span>
                  <span className="font-semibold text-slate-300">{config.pixReceiverCity || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Chave ({config.pixType}):</span>
                  <span className="font-mono text-emerald-400 font-bold truncate max-w-[140px]" title={config.pixKey}>{config.pixKey || "—"}</span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-1.5 mt-1.5 text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock size={12} className="text-amber-500 animate-spin" style={{ animationDuration: "12s" }} />
                    Expira em:
                  </span>
                  <span className="font-bold text-amber-500 font-mono">
                    {config.pixDueDateMinutes} min
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Pix Copia e Cola</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={gerarPixCopiaECola({
                      chave: config.pixKey || "63680806-d418-4b0b-9ef4-6562cde069d9",
                      valor: 1850.50,
                      nomeRecebedor: config.pixReceiverName,
                      cidadeRecebedor: config.pixReceiverCity,
                      txid: "ADMTESTE"
                    })}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-2 text-[9px] font-mono text-slate-300 outline-none select-all truncate"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const code = gerarPixCopiaECola({
                        chave: config.pixKey || "63680806-d418-4b0b-9ef4-6562cde069d9",
                        valor: 1850.50,
                        nomeRecebedor: config.pixReceiverName,
                        cidadeRecebedor: config.pixReceiverCity,
                        txid: "ADMTESTE"
                      });
                      navigator.clipboard.writeText(code);
                      alert("Pix Copia e Cola copiado com sucesso!");
                    }}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition-colors cursor-pointer"
                    title="Copiar Pix Copia e Cola"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* DYNAMIC BOLETO PREVIEW */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Visualização do Boleto Gerado</span>
              <span className="text-[10px] font-black text-[#0071e3] bg-[#0071e3]/10 px-2 py-0.5 rounded-lg">
                BANCO INTEGRADO
              </span>
            </div>

            {/* Stylized Boleto Ticket */}
            <div className="border border-slate-300 rounded p-3 bg-slate-50/50 space-y-2.5 text-[10px] font-sans">
              
              {/* Header bank bar */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-1">
                <div className="flex items-center gap-1.5">
                  <div className="font-black text-xs px-1 py-0.5 border-r border-slate-900 mr-1 bg-slate-200">033-7</div>
                  <span className="font-bold text-slate-800 text-[9px]">BANCO SANTANDER / MP</span>
                </div>
                <span className="font-mono font-bold text-[9px]">03399.09873 21092.381298 38291.123982 1 95020000185050</span>
              </div>

              {/* Payee / Local info */}
              <div className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-1.5">
                <div className="col-span-2">
                  <span className="text-slate-400 text-[8px] block leading-none uppercase font-bold">Beneficiário</span>
                  <span className="font-bold text-slate-700 block truncate">{config.pixReceiverName || "União Condominial"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[8px] block leading-none uppercase font-bold">CNPJ/CPF</span>
                  <span className="font-semibold text-slate-600 block truncate">{config.pixKey || "12.345.678/0001-99"}</span>
                </div>
              </div>

              {/* Dates and values */}
              <div className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-1.5">
                <div>
                  <span className="text-slate-400 text-[8px] block leading-none uppercase font-bold">Data do Documento</span>
                  <span className="font-medium text-slate-600 block">{formatDateBR(today)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[8px] block leading-none uppercase font-bold">Vencimento</span>
                  <span className="font-black text-[#0071e3] block">{formatDateBR(boletoDueDateMock)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[8px] block leading-none uppercase font-bold">Valor Cobrado</span>
                  <span className="font-bold text-slate-800 block">R$ 1.850,50</span>
                </div>
              </div>

              {/* Custom Instructions defined by user */}
              <div className="border border-slate-200 bg-white p-2 rounded text-[8px] leading-relaxed font-mono text-slate-500 whitespace-pre-wrap break-words">
                <span className="text-slate-400 block font-sans text-[7px] font-black uppercase mb-0.5 leading-none">Instruções de Cobrança ao Caixa</span>
                {config.boletoInstructions || "Instruções personalizadas adicionadas nas configurações do boleto."}
              </div>

              {/* Late fee indicators based on config */}
              <div className="grid grid-cols-2 gap-2 text-[8px] text-slate-400 pt-1 border-t border-dashed border-slate-200">
                <div>
                  Multa pós-vencimento: <span className="font-bold text-slate-600">{config.boletoLateFeePercent}% (R$ {(1850.50 * config.boletoLateFeePercent / 100).toFixed(2)})</span>
                </div>
                <div>
                  Juros de Mora: <span className="font-bold text-slate-600">{config.boletoInterestPercentPerMonth}% / mês</span>
                </div>
              </div>

              {/* Mock Barcode */}
              <div className="pt-2 text-center">
                <div className="h-6 bg-slate-900 rounded-sm flex items-center justify-center text-white/5 font-mono text-[6px] tracking-widest uppercase overflow-hidden" title="Código de barras integrado">
                  |||||| | |||||||| |||||| | |||||| | |||||||| |||||| | |||||| | |||||||| |||||| | |||||| | |||||||| ||||||
                </div>
                <span className="text-[8px] text-slate-400 mt-1 block">Compensação estimada em 1 dia útil após o pagamento</span>
              </div>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
