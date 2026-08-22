import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  Save,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Users,
  Tags,
  MapPin,
  Percent,
  Tag,
  Calculator,
  TrendingUp,
  ExternalLink,
  DollarSign,
  FileText,
  Target
} from "lucide-react";
import DashboardConfigTabs from "../../components/admin/DashboardConfigTabs";

export default function DashboardComercialConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const defaultConfig = {
    // Módulos Principais
    dashboardMetasVendas: true,
    moduloClientes: true,
    moduloCategorias: true,
    moduloPedidos: true,
    moduloVisitas: true,
    moduloComissoes: true,
    moduloCodigosIndicacao: true,
    moduloCalculadoraPrecos: true,

    // Cards / Indicadores
    cardTotalClientes: true,
    cardPedidosMes: true,
    cardFaturamentoComercial: true,

    // Seções
    secaoTextoApoio: true,
  };

  const [config, setConfig] = useState(defaultConfig);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, "config", "comercial_dashboard");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig((prev) => ({ ...prev, ...docSnap.data() }));
        }
      } catch (err) {
        console.error("Erro ao carregar configurações do dashboard comercial:", err);
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
      const docRef = doc(db, "config", "comercial_dashboard");
      await setDoc(docRef, config);
      setStatusMsg({ type: "success", text: "Configurações do Dashboard Comercial salvas com sucesso!" });
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
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <ShoppingCart size={22} />
            </div>
            <span>Configurações: Dashboard - Comercial</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Controle os módulos, botões de atalho e cards visíveis no painel comercial.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/comercial"
            target="_blank"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-semibold text-xs border border-slate-200"
          >
            <span>Ver Dashboard</span>
            <ExternalLink size={14} />
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-sm font-semibold text-sm disabled:opacity-50 active:scale-95 cursor-pointer"
          >
            <Save size={18} />
            {saving ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      </div>

      {/* Quick Action Toggle */}
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
              <TrendingUp size={16} className="text-blue-600" />
              <span>Indicadores de Vendas</span>
            </h3>
          </div>
          <div className="p-4 space-y-2.5">
            <ToggleOption
              label="Dashboard de Metas de Vendas"
              description="Gráfico de barras Recharts comparando volume mensal com metas da coleção metas_vendas."
              icon={<Target size={18} />}
              checked={config.dashboardMetasVendas}
              onChange={() => handleToggle("dashboardMetasVendas")}
            />
            <ToggleOption
              label="Total de Clientes"
              description="Contador de condomínios e contas cadastradas."
              icon={<Users size={18} />}
              checked={config.cardTotalClientes}
              onChange={() => handleToggle("cardTotalClientes")}
            />
            <ToggleOption
              label="Pedidos no Mês"
              description="Contador de pedidos de venda emitidos."
              icon={<ShoppingCart size={18} />}
              checked={config.cardPedidosMes}
              onChange={() => handleToggle("cardPedidosMes")}
            />
            <ToggleOption
              label="Faturamento Comercial"
              description="Volume financeiro total aprovado em vendas."
              icon={<DollarSign size={18} />}
              checked={config.cardFaturamentoComercial}
              onChange={() => handleToggle("cardFaturamentoComercial")}
            />
          </div>
        </div>

        {/* Seção 2: Estrutura Visual */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <FileText size={16} className="text-blue-600" />
              <span>Painel e Textos</span>
            </h3>
          </div>
          <div className="p-4 space-y-2.5">
            <ToggleOption
              label="Texto Informativo de Apoio"
              description="Mensagem descritiva de rotinas na parte inferior do painel."
              icon={<FileText size={18} />}
              checked={config.secaoTextoApoio}
              onChange={() => handleToggle("secaoTextoApoio")}
            />
          </div>
        </div>

        {/* Seção 3: Módulos de Gestão Comercial */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm md:col-span-2">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <ShoppingCart size={16} className="text-blue-600" />
              <span>Módulos de Vendas & CRM</span>
            </h3>
            <span className="text-xs text-slate-500 font-medium">Controle de links e cartões de acesso</span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <ToggleOption
              label="Clientes"
              description="Controle de condomínios e clientes finais."
              icon={<Users size={18} />}
              checked={config.moduloClientes}
              onChange={() => handleToggle("moduloClientes")}
            />
            <ToggleOption
              label="Categorias de Produtos"
              description="Organização do catálogo de produtos e departamentos."
              icon={<Tags size={18} />}
              checked={config.moduloCategorias}
              onChange={() => handleToggle("moduloCategorias")}
            />
            <ToggleOption
              label="Pedidos de Venda"
              description="Acompanhamento de compras e orçamentos aprovados."
              icon={<ShoppingCart size={18} />}
              checked={config.moduloPedidos}
              onChange={() => handleToggle("moduloPedidos")}
            />
            <ToggleOption
              label="Visitas ao Cliente (CRM)"
              description="Registro presencial de visitas e prospecção com GPS."
              icon={<MapPin size={18} />}
              checked={config.moduloVisitas}
              onChange={() => handleToggle("moduloVisitas")}
            />
            <ToggleOption
              label="Comissões de Vendas"
              description="Relatório de apuração de comissões por vendedor."
              icon={<Percent size={18} />}
              checked={config.moduloComissoes}
              onChange={() => handleToggle("moduloComissoes")}
            />
            <ToggleOption
              label="Códigos de Indicação"
              description="Gestão de códigos de cupom e afiliados."
              icon={<Tag size={18} />}
              checked={config.moduloCodigosIndicacao}
              onChange={() => handleToggle("moduloCodigosIndicacao")}
            />
            <ToggleOption
              label="Calculadora de Preços"
              description="Simulação de markups, margens de lucro e preços finais."
              icon={<Calculator size={18} />}
              checked={config.moduloCalculadoraPrecos}
              onChange={() => handleToggle("moduloCalculadoraPrecos")}
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
          ? "bg-blue-50/50 border-blue-200/90 shadow-xs"
          : "bg-white border-slate-200/70 hover:border-slate-300 opacity-75"
      }`}
    >
      <div className="flex-1 flex items-start gap-3">
        <div
          className={`mt-0.5 p-2 rounded-lg shrink-0 ${
            checked ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-500"
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
          checked ? "bg-blue-600" : "bg-slate-300"
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
