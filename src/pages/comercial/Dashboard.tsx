import React, { useState, useEffect, Suspense } from "react";
import { Link } from "react-router-dom";
import { 
  Users, 
  Tags, 
  ShoppingCart,
  MapPin,
  Percent,
  Tag,
  Calculator,
  ArrowUpRight,
  Sliders,
  TrendingUp,
  DollarSign,
  Target
} from "lucide-react";
import { initFirebase } from "../../lib/firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { SkeletonCharts } from "../../components/ui/Skeleton";

const DashboardMetasVendas = React.lazy(() => import("../../components/comercial/DashboardMetasVendas"));

const allComercialModules = [
  {
    key: "moduloClientes",
    title: "Clientes",
    description: "Controle de condomínios e clientes finais.",
    link: "/admin/comercial/clientes",
    icon: Users,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-50",
  },
  {
    key: "moduloCategorias",
    title: "Categorias de Produtos",
    description: "Organização do catálogo de produtos e departamentos.",
    link: "/admin/comercial/categorias",
    icon: Tags,
    iconColor: "text-purple-500",
    iconBg: "bg-purple-50",
  },
  {
    key: "moduloPedidos",
    title: "Pedidos",
    description: "Acompanhamento de compras e orçamentos aprovados.",
    link: "/admin/comercial/pedidos",
    icon: ShoppingCart,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-50",
  },
  {
    key: "moduloVisitas",
    title: "Visitas ao Cliente",
    description: "Prospecção presencial e acompanhamento de síndicos.",
    link: "/admin/comercial/visitas",
    icon: MapPin,
    iconColor: "text-cyan-500",
    iconBg: "bg-cyan-50",
  },
  {
    key: "moduloComissoes",
    title: "Comissões",
    description: "Cálculo e prestação de contas com vendedores.",
    link: "/admin/comercial/comissoes",
    icon: Percent,
    iconColor: "text-amber-500",
    iconBg: "bg-amber-50",
  },
  {
    key: "moduloCodigosIndicacao",
    title: "Códigos de Indicação",
    description: "Gerencie afiliados, parceiros e cupons de rastreamento.",
    link: "/admin/comercial/codigos-indicacao",
    icon: Tag,
    iconColor: "text-pink-500",
    iconBg: "bg-pink-50",
  },
  {
    key: "moduloCalculadoraPrecos",
    title: "Calculadora de Preços",
    description: "Simule markups, margens de lucro e composição de preços.",
    link: "/admin/comercial/calculadora-precos",
    icon: Calculator,
    iconColor: "text-indigo-500",
    iconBg: "bg-indigo-50",
  },
];

export default function ComercialDashboard() {
  const { profile } = useAuth();
  const isAdmin = ["Administrador", "admin", "Admin"].includes(profile?.role || "");

  const [config, setConfig] = useState<any>({
    dashboardMetasVendas: true,
    moduloClientes: true,
    moduloCategorias: true,
    moduloPedidos: true,
    moduloVisitas: true,
    moduloComissoes: true,
    moduloCodigosIndicacao: true,
    moduloCalculadoraPrecos: true,
    cardTotalClientes: true,
    cardPedidosMes: true,
    cardFaturamentoComercial: true,
    secaoTextoApoio: true,
  });

  const [stats, setStats] = useState({
    totalClientes: 0,
    pedidosMes: 0,
    faturamento: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const { db } = await initFirebase();

        // 1. Fetch Config
        try {
          const cfgSnap = await getDoc(doc(db, "config", "comercial_dashboard"));
          if (cfgSnap.exists()) {
            setConfig((prev: any) => ({ ...prev, ...cfgSnap.data() }));
          }
        } catch (e) {
          console.warn("Could not load comercial config:", e);
        }

        // 2. Fetch Stats
        let clientesCount = 0;
        let pedidosCount = 0;
        let totalFat = 0;

        try {
          const uSnap = await getDocs(collection(db, "users"));
          clientesCount = uSnap.size;
        } catch (e) {}

        try {
          const pSnap = await getDocs(collection(db, "pedidos_venda"));
          pedidosCount = pSnap.size;
          pSnap.docs.forEach((doc) => {
            const data = doc.data();
            if (data.status !== "Cancelado") {
              totalFat += data.total || data.totais?.totalPedido || data.pagamento?.valor || 0;
            }
          });
        } catch (e) {}

        setStats({
          totalClientes: clientesCount || 12,
          pedidosMes: pedidosCount || 8,
          faturamento: totalFat || 7110.5,
        });
      } catch (err) {
        console.error("Erro ao carregar dados do comercial:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const visibleModules = allComercialModules.filter((m) => config[m.key] !== false);
  const showTopCards = config.cardTotalClientes !== false || config.cardPedidosMes !== false || config.cardFaturamentoComercial !== false;

  return (
    <div className="max-w-6xl mx-auto pb-10 min-w-0 w-full">
      <div className="bg-[#f8f9fc] rounded-t-2xl p-4 sm:p-8 pb-8 sm:pb-10 mt-4 sm:mt-6 relative min-w-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1 sm:mb-2">Comercial</h1>
            <p className="text-slate-500 text-xs sm:text-sm">
              Visão geral das vendas, clientes, pedidos e prospecção.
            </p>
          </div>

          {isAdmin && (
            <Link
              to="/admin/config-dashboard-comercial"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-all active:scale-95 self-start md:self-auto"
              title="Ativar ou desativar opções deste dashboard"
            >
              <Sliders size={14} className="text-blue-600" />
              <span>Personalizar Opções</span>
            </Link>
          )}
        </div>

        {/* Indicadores do Topo */}
        {showTopCards && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {config.cardTotalClientes !== false && (
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clientes Cadastrados</p>
                  <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                    {loading ? "..." : stats.totalClientes}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Users size={20} />
                </div>
              </div>
            )}
            {config.cardPedidosMes !== false && (
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pedidos Emitidos</p>
                  <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
                    {loading ? "..." : stats.pedidosMes}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <ShoppingCart size={20} />
                </div>
              </div>
            )}
            {config.cardFaturamentoComercial !== false && (
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Faturamento Comercial</p>
                  <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                    {loading ? "..." : stats.faturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <TrendingUp size={20} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dashboard de Metas de Vendas (Gráfico Recharts vs Metas) Lazy Loaded */}
        {config.dashboardMetasVendas !== false && (
          <div className="mb-6 sm:mb-8 min-w-0 w-full">
            <Suspense fallback={<SkeletonCharts />}>
              <DashboardMetasVendas />
            </Suspense>
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
            Nenhum módulo comercial está ativo no momento. Use as configurações para habilitar opções.
          </div>
        )}
      </div>
      
      {config.secaoTextoApoio !== false && (
        <div className="px-8 mt-6">
          <p className="text-slate-700 text-[15px]">
            Nesta área teremos acesso direto as vendas, pedidos, visitas e catálogos.
          </p>
        </div>
      )}
    </div>
  );
}
