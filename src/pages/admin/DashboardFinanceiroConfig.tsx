import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  Save,
  Wallet,
  CheckCircle2,
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Landmark,
  PieChart,
  Truck,
  Users,
  FileText,
  ClipboardList,
  DollarSign,
  Coins,
  TrendingUp,
  ExternalLink,
  RotateCcw
} from "lucide-react";
import DashboardConfigTabs from "../../components/admin/DashboardConfigTabs";

export default function DashboardFinanceiroConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const defaultConfig = {
    // Cards de Indicadores do Topo
    cardVendas: true,
    cardCashback: true,
    cardContasPagarMes: true,
    cardSaldoGeral: true,

    // Módulos e Atalhos
    moduloContasPagar: true,
    moduloContasReceber: true,
    moduloSaldosBancarios: true,
    moduloCentrosCusto: true,
    moduloFornecedores: true,
    moduloClientes: true,
    moduloOrcamentos: true,
    moduloOrdensServico: true,

    // Seções Adicionais
    secaoAtalhosRapidos: true,
    secaoTextoApoio: true,
  };

  const [config, setConfig] = useState(defaultConfig);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, "config", "financeiro_dashboard");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig((prev) => ({ ...prev, ...docSnap.data() }));
        }
      } catch (err) {
        console.error("Erro ao carregar configurações do dashboard financeiro:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleToggle = (key: keyof typeof config) => {
    setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleAll = (value: boolean) => {
    const updated = { ...config };
    (Object.keys(updated) as (keyof typeof config)[]).forEach((k) => {
      updated[k] = value;
    });
    setConfig(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      const docRef = doc(db, "config", "financeiro_dashboard");
      await setDoc(docRef, config);
      setStatusMsg({ type: "success", text: "Configurações do Dashboard Financeiro salvas com sucesso!" });
      setTimeout(() => setStatusMsg(null), 5000);
    } catch (err: any) {
      console.error("Erro ao salvar configurações:", err);
      setStatusMsg({ type: "error", text: "Erro ao salvar: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Carregando configurações...</div>;
  }

  return (
    <div className="w-full max-w-full space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Navigation Tabs */}
      <DashboardConfigTabs />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Wallet size={22} />
            </div>
            <span>Configurações: Dashboard - Financeiro</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ative ou desative módulos, indicadores e recursos visíveis no painel financeiro.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/financeiro"
            target="_blank"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-semibold text-xs border border-slate-200"
          >
            <span>Ver Dashboard</span>
            <ExternalLink size={14} />
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-sm font-semibold text-sm disabled:opacity-50 active:scale-95 cursor-pointer"
          >
            <Save size={18} />
            {saving ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 px-4 py-3 rounded-xl text-xs">
        <span className="text-slate-600 font-medium">Ações rápidas de visibilidade:</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleToggleAll(true)}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 font-semibold transition-colors cursor-pointer"
          >
            Ativar Todos
          </button>
          <button
            type="button"
            onClick={() => handleToggleAll(false)}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 font-semibold transition-colors cursor-pointer"
          >
            Desativar Todos
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 shadow-sm ${
            statusMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle2 className="text-emerald-500" size={20} />
          ) : (
            <AlertCircle className="text-red-500" size={20} />
          )}
          <span className="text-sm font-medium">{statusMsg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Seção 1: Indicadores e Métricas */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-600" />
              <span>Indicadores & Cards de Topo</span>
            </h3>
          </div>
          <div className="p-4 space-y-2.5">
            <ToggleOption
              label="Total de Vendas / Faturamento"
              description="Exibe o faturamento consolidado acumulado."
              icon={<DollarSign size={18} />}
              checked={config.cardVendas}
              onChange={() => handleToggle("cardVendas")}
            />
            <ToggleOption
              label="Cashback Acumulado"
              description="Mostra o saldo geral de cashback gerado aos clientes."
              icon={<Coins size={18} />}
              checked={config.cardCashback}
              onChange={() => handleToggle("cardCashback")}
            />
            <ToggleOption
              label="Contas à Pagar do Mês"
              description="Total de despesas e obrigações a vencer no mês atual."
              icon={<ArrowDownCircle size={18} />}
              checked={config.cardContasPagarMes}
              onChange={() => handleToggle("cardContasPagarMes")}
            />
            <ToggleOption
              label="Saldo Financeiro Estimado"
              description="Posição líquida calculada no período."
              icon={<Wallet size={18} />}
              checked={config.cardSaldoGeral}
              onChange={() => handleToggle("cardSaldoGeral")}
            />
          </div>
        </div>

        {/* Seção 2: Estrutura e Textos */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <ClipboardList size={16} className="text-emerald-600" />
              <span>Painéis e Elementos Visuais</span>
            </h3>
          </div>
          <div className="p-4 space-y-2.5">
            <ToggleOption
              label="Barra de Atalhos Rápidos"
              description="Acesso rápido para novos lançamentos de pagar e receber."
              icon={<CheckCircle2 size={18} />}
              checked={config.secaoAtalhosRapidos}
              onChange={() => handleToggle("secaoAtalhosRapidos")}
            />
            <ToggleOption
              label="Texto Informativo de Rodapé"
              description="Orientação descritiva de rotinas no final da página."
              icon={<FileText size={18} />}
              checked={config.secaoTextoApoio}
              onChange={() => handleToggle("secaoTextoApoio")}
            />
          </div>
        </div>

        {/* Seção 3: Módulos Operacionais Financeiros */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm md:col-span-2">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <Wallet size={16} className="text-emerald-600" />
              <span>Módulos e Menus Financeiros</span>
            </h3>
            <span className="text-xs text-slate-500 font-medium">Controle de links de navegação</span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <ToggleOption
              label="Contas à Pagar"
              description="Gestão de obrigações, contas fixas e despesas."
              icon={<ArrowDownCircle size={18} />}
              checked={config.moduloContasPagar}
              onChange={() => handleToggle("moduloContasPagar")}
            />
            <ToggleOption
              label="Contas à Receber"
              description="Controle de recebimentos, cobranças e faturas."
              icon={<ArrowUpCircle size={18} />}
              checked={config.moduloContasReceber}
              onChange={() => handleToggle("moduloContasReceber")}
            />
            <ToggleOption
              label="Saldos Bancários"
              description="Visualização, conciliação e cadastro de contas bancárias."
              icon={<Landmark size={18} />}
              checked={config.moduloSaldosBancarios}
              onChange={() => handleToggle("moduloSaldosBancarios")}
            />
            <ToggleOption
              label="Centros de Custo"
              description="Classificação orçamentária de despesas e receitas."
              icon={<PieChart size={18} />}
              checked={config.moduloCentrosCusto}
              onChange={() => handleToggle("moduloCentrosCusto")}
            />
            <ToggleOption
              label="Fornecedores"
              description="Gestão e consulta da base de fornecedores cadastrados."
              icon={<Truck size={18} />}
              checked={config.moduloFornecedores}
              onChange={() => handleToggle("moduloFornecedores")}
            />
            <ToggleOption
              label="Clientes (Base Financeira)"
              description="Gestão de clientes com histórico de compras e financeiro."
              icon={<Users size={18} />}
              checked={config.moduloClientes}
              onChange={() => handleToggle("moduloClientes")}
            />
            <ToggleOption
              label="Orçamentos"
              description="Propostas comerciais e cotações orçamentárias."
              icon={<FileText size={18} />}
              checked={config.moduloOrcamentos}
              onChange={() => handleToggle("moduloOrcamentos")}
            />
            <ToggleOption
              label="Ordens de Serviço"
              description="Acompanhamento de OS e contratos em andamento."
              icon={<ClipboardList size={18} />}
              checked={config.moduloOrdensServico}
              onChange={() => handleToggle("moduloOrdensServico")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleOption({
  label,
  description,
  icon,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer select-none ${
        checked
          ? "bg-emerald-50/50 border-emerald-200/90 shadow-xs"
          : "bg-white border-slate-200/70 hover:border-slate-300 opacity-75"
      }`}
    >
      <div className="flex-1 flex items-start gap-3">
        <div
          className={`mt-0.5 p-2 rounded-lg shrink-0 ${
            checked ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
          }`}
        >
          {icon}
        </div>
        <div>
          <h4 className="font-bold text-slate-800 text-sm leading-snug">{label}</h4>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>

      {/* Toggle switch */}
      <div
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? "bg-emerald-600" : "bg-slate-300"
        }`}
      >
        <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </div>
    </label>
  );
}
