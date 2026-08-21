import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { 
  Save, 
  Settings, 
  CheckCircle2, 
  AlertCircle,
  Home, 
  User, 
  ShoppingBag, 
  MapPin, 
  Book, 
  Package, 
  Tag, 
  Heart, 
  CreditCard, 
  Coins,
  MessageSquare,
  ExternalLink,
  Sliders
} from "lucide-react";
import DashboardConfigTabs from "../../components/admin/DashboardConfigTabs";

export default function DashboardClienteConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const [config, setConfig] = useState({
    menuInicial: true,
    menuMeusDados: true,
    menuMeusPedidos: true,
    menuLocalEntrega: true,
    
    menuCatalogoProdutos: true,
    menuKitsEssenciais: true,
    
    menuMarcasParceiras: true,
    menuClubeBeneficios: true,
    menuCartaoVirtual: true,
    menuMeuCashback: true,
    menuMural: true
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, "config", "client_dashboard");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig(prev => ({ ...prev, ...docSnap.data() }));
        }
      } catch (err) {
        console.error("Erro ao carregar configurações do dashboard do cliente:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchConfig();
  }, []);

  const handleToggle = (key: keyof typeof config) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      const docRef = doc(db, "config", "client_dashboard");
      await setDoc(docRef, config);
      setStatusMsg({ type: "success", text: "Configurações salvas com sucesso!" });
      setTimeout(() => setStatusMsg(null), 5000);
    } catch (err: any) {
      console.error("Erro ao salvar configurações:", err);
      setStatusMsg({ type: "error", text: "Erro ao salvar: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAll = (value: boolean) => {
    const updated = { ...config };
    (Object.keys(updated) as (keyof typeof config)[]).forEach((k) => {
      updated[k] = value;
    });
    setConfig(updated);
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Carregando configurações...</div>;
  }

  return (
    <div className="w-full max-w-full space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Navigation Tabs */}
      <DashboardConfigTabs />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm">
              <Sliders size={22} />
            </div>
            <span>Configurações: Dashboard - Cliente</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie quais menus e recursos ficarão visíveis para os clientes na área restrita.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link
            to="/cliente"
            target="_blank"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-semibold text-xs border border-slate-200"
          >
            <span>Ver Portal do Cliente</span>
            <ExternalLink size={14} />
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all shadow-sm font-semibold text-sm disabled:opacity-50 active:scale-95 cursor-pointer"
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
        <div className={`p-4 rounded-xl flex items-center gap-3 shadow-sm ${
          statusMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-red-50 text-red-800 border border-red-100"
        }`}>
          {statusMsg.type === "success" ? <CheckCircle2 className="text-emerald-500" size={20} /> : <AlertCircle className="text-red-500" size={20} />}
          <span className="text-sm font-medium">{statusMsg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Seção Principal */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Acesso e Conta</h3>
          </div>
          <div className="p-4 space-y-2">
            <ToggleOption 
              label="Inicial" 
              description="Dashboard e visão geral da conta." 
              icon={<Home size={18} />} 
              checked={config.menuInicial} 
              onChange={() => handleToggle("menuInicial")} 
            />
            <ToggleOption 
              label="Meus Dados" 
              description="Gerenciamento de perfil e senha." 
              icon={<User size={18} />} 
              checked={config.menuMeusDados} 
              onChange={() => handleToggle("menuMeusDados")} 
            />
            <ToggleOption 
              label="Meus Pedidos" 
              description="Histórico de compras e rastreio." 
              icon={<ShoppingBag size={18} />} 
              checked={config.menuMeusPedidos} 
              onChange={() => handleToggle("menuMeusPedidos")} 
            />
            <ToggleOption 
              label="Localização do Condomínio" 
              description="Gerenciamento de endereços." 
              icon={<MapPin size={18} />} 
              checked={config.menuLocalEntrega} 
              onChange={() => handleToggle("menuLocalEntrega")} 
            />
          </div>
        </div>

        {/* Seção Catálogo */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Catálogo</h3>
          </div>
          <div className="p-4 space-y-2">
            <ToggleOption 
              label="Catálogo de Produtos" 
              description="Acesso a todos os produtos disponíveis." 
              icon={<Book size={18} />} 
              checked={config.menuCatalogoProdutos} 
              onChange={() => handleToggle("menuCatalogoProdutos")} 
            />
            <ToggleOption 
              label="Kits Essenciais" 
              description="Kits e combos pré-montados." 
              icon={<Package size={18} />} 
              checked={config.menuKitsEssenciais} 
              onChange={() => handleToggle("menuKitsEssenciais")} 
            />
          </div>
        </div>

        {/* Seção Vantagens */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm md:col-span-2">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Vantagens</h3>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            <ToggleOption 
              label="Marcas Parceiras" 
              description="Lista de fornecedores e parceiros." 
              icon={<Tag size={18} />} 
              checked={config.menuMarcasParceiras} 
              onChange={() => handleToggle("menuMarcasParceiras")} 
            />
            <ToggleOption 
              label="Clube de Benefícios" 
              description="Níveis, pontuações e vantagens." 
              icon={<Heart size={18} />} 
              checked={config.menuClubeBeneficios} 
              onChange={() => handleToggle("menuClubeBeneficios")} 
            />
            <ToggleOption 
              label="Cartão Virtual" 
              description="Cartão de identificação do cliente." 
              icon={<CreditCard size={18} />} 
              checked={config.menuCartaoVirtual} 
              onChange={() => handleToggle("menuCartaoVirtual")} 
            />
            <ToggleOption 
              label="Meu Cashback" 
              description="Saldo, histórico e resgates." 
              icon={<Coins size={18} />} 
              checked={config.menuMeuCashback} 
              onChange={() => handleToggle("menuMeuCashback")} 
            />
            <ToggleOption 
              label="Informativo Condomínios - Goiânia" 
              description="Mural de comunicados, avisos, perguntas e respostas." 
              icon={<MessageSquare size={18} />} 
              checked={config.menuMural} 
              onChange={() => handleToggle("menuMural")} 
            />
          </div>
        </div>
        
      </div>
    </div>
  );
}

function ToggleOption({ label, description, icon, checked, onChange }: { label: string, description: string, icon: React.ReactNode, checked: boolean, onChange: () => void }) {
  return (
    <label className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
      checked ? "bg-brand-light/5 border-brand-light/30" : "bg-white border-slate-100 hover:border-slate-300"
    }`}>
      <div className="flex-1 flex items-start gap-3">
        <div className={`mt-0.5 p-2 rounded-lg ${checked ? 'bg-brand-light/10 text-brand-dark' : 'bg-slate-100 text-slate-500'}`}>
          {icon}
        </div>
        <div>
          <h4 className="font-bold text-slate-800 text-sm">{label}</h4>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      
      {/* Toggle switch */}
      <div className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-brand-primary' : 'bg-slate-200'}`}>
        <input 
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={onChange}
        />
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </div>
    </label>
  );
}
