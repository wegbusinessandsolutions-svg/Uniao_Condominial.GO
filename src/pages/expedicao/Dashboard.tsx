import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Truck, 
  PackageSearch,
  Box,
  MapPin,
  Layers,
  ArrowUpRight,
  Sliders,
  Clock,
  CheckCircle2,
  AlertCircle,
  Route
} from "lucide-react";
import { initFirebase } from "../../lib/firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";

const allExpedicaoModules = [
  {
    key: "moduloLogisticaRoteirizacao",
    title: "Logística e Roteirização",
    description: "Mapa interativo, monitoramento de rotas e despacho de entregas.",
    link: "/admin/expedicao/logistica-roteirizacao",
    icon: Route,
    iconColor: "text-indigo-500",
    iconBg: "bg-indigo-50",
  },
  {
    key: "moduloEntregas",
    title: "Entregas",
    description: "Roteirização e acompanhamento de status logístico.",
    link: "/admin/expedicao/entregas",
    icon: Truck,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-50",
  },
  {
    key: "moduloEstoque",
    title: "Estoque – Compras",
    description: "Gestão de inventário, entradas e saídas de produtos.",
    link: "/admin/expedicao/estoque",
    icon: PackageSearch,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-50",
  },
  {
    key: "moduloSeparacao",
    title: "Separação de Pedidos (Packing)",
    description: "Conferência e preparação de embalagens para transporte.",
    link: "/admin/expedicao/entregas",
    icon: Box,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-50",
  },
  {
    key: "moduloRastreamento",
    title: "Rastreamento Logístico",
    description: "Acompanhamento em tempo real de motoristas e remessas.",
    link: "/admin/expedicao/entregas",
    icon: MapPin,
    iconColor: "text-purple-500",
    iconBg: "bg-purple-50",
  },
  {
    key: "moduloProdutosArmazem",
    title: "Produtos em Armazém",
    description: "Consulta de saldos de produtos e estoque físico.",
    link: "/admin/expedicao/estoque",
    icon: Layers,
    iconColor: "text-cyan-500",
    iconBg: "bg-cyan-50",
  },
];

export default function ExpedicaoDashboard() {
  const { profile } = useAuth();
  const isAdmin = ["Administrador", "admin", "Admin"].includes(profile?.role || "");

  const [config, setConfig] = useState<any>({
    moduloEntregas: true,
    moduloEstoque: true,
    moduloSeparacao: true,
    moduloRastreamento: true,
    moduloProdutosArmazem: true,
    cardEntregasPendentes: true,
    cardEntregasConcluidas: true,
    cardItensEstoqueBaixo: true,
    secaoFilaEntregas: true,
    secaoTextoApoio: true,
  });

  const [stats, setStats] = useState({
    pendentes: 0,
    concluidas: 0,
    estoqueCritico: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const { db } = await initFirebase();

        // 1. Fetch Config
        try {
          const cfgSnap = await getDoc(doc(db, "config", "expedicao_dashboard"));
          if (cfgSnap.exists()) {
            setConfig((prev: any) => ({ ...prev, ...cfgSnap.data() }));
          }
        } catch (e) {
          console.warn("Could not load expedicao config:", e);
        }

        // 2. Fetch Orders for Deliveries stats
        let pendentesCount = 0;
        let concluidasCount = 0;
        try {
          const oSnap = await getDocs(collection(db, "pedidos_venda"));
          oSnap.docs.forEach((doc) => {
            const data = doc.data();
            if (["Aprovado", "Em Rota", "Pendente", "Separado"].includes(data.status)) {
              pendentesCount++;
            } else if (data.status === "Entregue" || data.status === "Concluído") {
              concluidasCount++;
            }
          });
        } catch (e) {}

        // 3. Fetch Low stock (< 5 units)
        let lowStockCount = 0;
        try {
          const pSnap = await getDocs(collection(db, "produtos"));
          pSnap.docs.forEach((doc) => {
            const data = doc.data();
            const qtd = Number(data.qtdAtual ?? data.estoque ?? 0);
            if (qtd < 5) {
              lowStockCount++;
            }
          });
        } catch (e) {}

        setStats({
          pendentes: pendentesCount,
          concluidas: concluidasCount,
          estoqueCritico: lowStockCount,
        });
      } catch (err) {
        console.error("Erro ao carregar dados de expedição:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const visibleModules = allExpedicaoModules.filter((m) => config[m.key] !== false);
  const showTopCards =
    config.cardEntregasPendentes !== false ||
    config.cardEntregasConcluidas !== false ||
    config.cardItensEstoqueBaixo !== false;

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="bg-[#f8f9fc] rounded-t-2xl p-8 pb-10 mt-6 relative">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Expedição</h1>
            <p className="text-slate-500 text-sm">
              Visão geral de logística, separação, roteirização e armazém.
            </p>
          </div>

          {isAdmin && (
            <Link
              to="/admin/config-dashboard-expedicao"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-all active:scale-95 self-start md:self-auto"
              title="Ativar ou desativar opções deste dashboard"
            >
              <Sliders size={14} className="text-orange-600" />
              <span>Personalizar Opções</span>
            </Link>
          )}
        </div>

        {/* Top Cards */}
        {showTopCards && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {config.cardEntregasPendentes !== false && (
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Entregas Pendentes</p>
                  <p className="text-2xl font-black text-amber-600 mt-1">
                    {loading ? "..." : stats.pendentes}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock size={20} />
                </div>
              </div>
            )}
            {config.cardEntregasConcluidas !== false && (
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Entregas Concluídas (Mês)</p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">
                    {loading ? "..." : stats.concluidas}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 size={20} />
                </div>
              </div>
            )}
            {config.cardItensEstoqueBaixo !== false && (
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Itens em Alerta de Estoque</p>
                  <p className="text-2xl font-black text-red-600 mt-1">
                    {loading ? "..." : stats.estoqueCritico}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                  <AlertCircle size={20} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modules Grid */}
        {visibleModules.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleModules.map((module) => {
              const Icon = module.icon;
              return (
                <Link
                  key={module.title}
                  to={module.link}
                  className="group block bg-white rounded-2xl p-6 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md transition-shadow relative"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${module.iconBg} ${module.iconColor}`}
                    >
                      <Icon size={24} strokeWidth={1.5} />
                    </div>
                    <ArrowUpRight 
                      size={20} 
                      className="text-slate-400 group-hover:text-slate-700 transition-colors" 
                      strokeWidth={1.5} 
                    />
                  </div>
                  
                  <h3 className="text-[15px] font-bold text-slate-900 mb-1.5">
                    {module.title}
                  </h3>
                  <p className="text-slate-500 text-xs leading-relaxed mb-6">
                    {module.description}
                  </p>
                  
                  <div className="text-[13px] font-medium text-slate-400 group-hover:text-slate-600 transition-colors flex items-center">
                    Abrir módulo &rarr;
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-500 text-sm">
            Nenhum módulo de expedição está ativo no momento. Use as configurações para habilitar opções.
          </div>
        )}
      </div>

      {config.secaoTextoApoio !== false && (
        <div className="px-8 mt-6">
          <p className="text-slate-700 text-[15px]">
            Nesta área teremos acesso direto a roteirização, entregas e estoque.
          </p>
        </div>
      )}
    </div>
  );
}
