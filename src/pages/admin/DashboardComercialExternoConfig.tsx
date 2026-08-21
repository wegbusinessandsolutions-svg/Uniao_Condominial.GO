import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  Save,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Users,
  Clock,
  ExternalLink,
  MessageSquare,
  Compass,
  Building2,
  TrendingUp,
  FileText
} from "lucide-react";
import DashboardConfigTabs from "../../components/admin/DashboardConfigTabs";

export default function DashboardComercialExternoConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const defaultConfig = {
    // Módulo Principal
    moduloVisitas: true,
    cardDestaqueVisitas: true,

    // KPIs de Topo
    kpiTotalVisitas: true,
    kpiVisitasMes: true,
    kpiSindicosContatados: true,
    kpiRetornosAgendados: true,

    // Recursos Destacados
    recursoGeolocalizacao: true,
    recursoModelosWhatsApp: true,
    recursoGestaoStatus: true,

    // Seções
    secaoUltimasVisitas: true,
    secaoBannerTopo: true,
  };

  const [config, setConfig] = useState(defaultConfig);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, "config", "comercial_externo_dashboard");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig((prev) => ({ ...prev, ...docSnap.data() }));
        }
      } catch (err) {
        console.error("Erro ao carregar configurações do comercial externo:", err);
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
      const docRef = doc(db, "config", "comercial_externo_dashboard");
      await setDoc(docRef, config);
      setStatusMsg({
        type: "success",
        text: "Configurações do Dashboard Comercial Externo salvas com sucesso!",
      });
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
            <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-sm">
              <MapPin size={22} />
            </div>
            <span>Configurações: Dashboard - Comercial Externo</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure quais métricas, recursos e seções de Visitas ao Cliente serão exibidos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/comercial-externo"
            target="_blank"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-semibold text-xs border border-slate-200"
          >
            <span>Ver Dashboard</span>
            <ExternalLink size={14} />
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl transition-all shadow-sm font-semibold text-sm disabled:opacity-50 active:scale-95 cursor-pointer"
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
        {/* Seção 1: Indicadores e Métricas de Campo */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={16} className="text-cyan-600" />
              <span>Indicadores de Campo (KPIs)</span>
            </h3>
          </div>
          <div className="p-4 space-y-2.5">
            <ToggleOption
              label="Total Geral de Visitas"
              description="Contador consolidado de atendimentos e visitas presenciais."
              icon={<MapPin size={18} />}
              checked={config.kpiTotalVisitas}
              onChange={() => handleToggle("kpiTotalVisitas")}
            />
            <ToggleOption
              label="Visitas Registradas no Mês"
              description="Contador de prospecções realizadas no mês vigente."
              icon={<Calendar size={18} />}
              checked={config.kpiVisitasMes}
              onChange={() => handleToggle("kpiVisitasMes")}
            />
            <ToggleOption
              label="Síndicos e Contatos Encontrados"
              description="Visitas em que o responsável ou síndico foi contatado."
              icon={<Users size={18} />}
              checked={config.kpiSindicosContatados}
              onChange={() => handleToggle("kpiSindicosContatados")}
            />
            <ToggleOption
              label="Retornos Agendados"
              description="Visitas com data de retorno ou follow-up pendente."
              icon={<Clock size={18} />}
              checked={config.kpiRetornosAgendados}
              onChange={() => handleToggle("kpiRetornosAgendados")}
            />
          </div>
        </div>

        {/* Seção 2: Recursos de Campo */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <Compass size={16} className="text-cyan-600" />
              <span>Recursos & Painéis de Campo</span>
            </h3>
          </div>
          <div className="p-4 space-y-2.5">
            <ToggleOption
              label="Geolocalização GPS Automática"
              description="Destaque para o recurso de captura automática de GPS."
              icon={<MapPin size={18} />}
              checked={config.recursoGeolocalizacao}
              onChange={() => handleToggle("recursoGeolocalizacao")}
            />
            <ToggleOption
              label="Modelos de Mensagens WhatsApp"
              description="Indicação do disparo rápido de mensagens pelo WhatsApp."
              icon={<MessageSquare size={18} />}
              checked={config.recursoModelosWhatsApp}
              onChange={() => handleToggle("recursoModelosWhatsApp")}
            />
            <ToggleOption
              label="Gestão de Status e Retornos"
              description="Controle do pipeline e classificação das visitas."
              icon={<CheckCircle2 size={18} />}
              checked={config.recursoGestaoStatus}
              onChange={() => handleToggle("recursoGestaoStatus")}
            />
            <ToggleOption
              label="Banner Superior Informativo"
              description="Cabeçalho azul gradiente com resumo de campo e atalhos."
              icon={<FileText size={18} />}
              checked={config.secaoBannerTopo}
              onChange={() => handleToggle("secaoBannerTopo")}
            />
          </div>
        </div>

        {/* Seção 3: Card Principal e Tabela */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm md:col-span-2">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <Building2 size={16} className="text-cyan-600" />
              <span>Módulo Principal & Tabela de Visitas</span>
            </h3>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <ToggleOption
              label="Módulo: Visitas ao Cliente"
              description="Card de destaque e acesso direto ao fluxo de visitas ao cliente."
              icon={<MapPin size={18} />}
              checked={config.moduloVisitas}
              onChange={() => handleToggle("moduloVisitas")}
            />
            <ToggleOption
              label="Tabela de Últimas Visitas Registradas"
              description="Lista rápida dos últimos condomínios visitados com links diretos."
              icon={<Building2 size={18} />}
              checked={config.secaoUltimasVisitas}
              onChange={() => handleToggle("secaoUltimasVisitas")}
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
          ? "bg-cyan-50/50 border-cyan-200/90 shadow-xs"
          : "bg-white border-slate-200/70 hover:border-slate-300 opacity-75"
      }`}
    >
      <div className="flex-1 flex items-start gap-3">
        <div
          className={`mt-0.5 p-2 rounded-lg shrink-0 ${
            checked ? "bg-cyan-100 text-cyan-800" : "bg-slate-100 text-slate-500"
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
          checked ? "bg-cyan-600" : "bg-slate-300"
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
