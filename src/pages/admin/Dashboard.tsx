import React, { useState, useEffect, Suspense } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { 
  UserCog, 
  BadgeCheck, 
  Building2, 
  CreditCard, 
  Package, 
  Handshake, 
  Gift, 
  BarChart3, 
  ShieldCheck,
  ArrowUpRight,
  Boxes,
  PlusCircle,
  Zap,
  Database,
  Server,
  Code2,
} from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { SkeletonCharts, SkeletonTable } from "../../components/ui/Skeleton";
import { isAdminRole, getDefaultDashboardForRole } from "../../lib/permissions";

// Lazy-loaded heavy components (Recharts, Table audit, Backup modal)
const AdminDashboardCharts = React.lazy(() => import("../../components/admin/AdminDashboardCharts"));
const ActivityAuditTable = React.lazy(() =>
  import("../../components/admin/ActivityAuditTable").then((m) => ({ default: m.ActivityAuditTable }))
);
const BackupCsvModal = React.lazy(() =>
  import("../../components/admin/BackupCsvModal").then((m) => ({ default: m.BackupCsvModal }))
);

const adminModules = [
  {
    title: "Usuários",
    description: "Papéis e permissões dos acessos do sistema.",
    link: "/admin/usuarios",
    icon: UserCog,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50 dark:bg-blue-950/40",
  },
  {
    title: "Empregados",
    description: "Cadastro e dados dos colaboradores.",
    link: "/admin/empregados",
    icon: BadgeCheck,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  {
    title: "Franqueadora (Matriz)",
    description: "Gestão central da Franqueadora e parâmetros da rede.",
    link: "/admin/franqueadora",
    icon: Building2,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-50 dark:bg-amber-950/40",
  },
  {
    title: "Franqueada (Unidades)",
    description: "Cadastro e gestão das unidades franqueadas da rede.",
    link: "/admin/empresa",
    icon: Building2,
    iconColor: "text-slate-600",
    iconBg: "bg-slate-100 dark:bg-slate-800",
  },
  {
    title: "Integração Pagamentos",
    description: "Mercado Pago: PIX, boleto e cartão.",
    link: "/admin/integracao-pagamentos",
    icon: CreditCard,
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-50 dark:bg-indigo-950/40",
  },
  {
    title: "Kits Essenciais",
    description: "Combos pré-montados de produtos.",
    link: "/admin/kits-essenciais",
    icon: Package,
    iconColor: "text-cyan-600",
    iconBg: "bg-cyan-50 dark:bg-cyan-950/40",
  },
  {
    title: "Marcas Parceiras",
    description: "Marcas com acordos e benefícios.",
    link: "/admin/marcas-parceiras",
    icon: Handshake,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50 dark:bg-blue-950/40",
  },
  {
    title: "Clube de Benefícios",
    description: "Vantagens e descontos para clientes.",
    link: "/admin/clube-beneficios",
    icon: Gift,
    iconColor: "text-teal-600",
    iconBg: "bg-teal-50 dark:bg-teal-950/40",
  },
  {
    title: "Relatórios",
    description: "Indicadores gerais do negócio.",
    link: "/admin/relatorios",
    icon: BarChart3,
    iconColor: "text-sky-600",
    iconBg: "bg-sky-50 dark:bg-sky-950/40",
  },
  {
    title: "Acompanhamento de Venda",
    description: "Acompanhe o andamento dos pedidos no sistema.",
    link: "/admin/acompanhamento-venda",
    icon: ShieldCheck,
    iconColor: "text-indigo-700",
    iconBg: "bg-indigo-50 dark:bg-indigo-950/40",
  },
  {
    title: "Backups & Agendador",
    description: "Agendamento automático do Firestore e logs de conclusão.",
    link: "/admin/backup",
    icon: Database,
    iconColor: "text-blue-700",
    iconBg: "bg-blue-50 dark:bg-blue-950/40",
  },
];

export default function Dashboard() {
  const { profile } = useAuth();
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [pedidos, setPedidos] = useState<any[]>([]);

  useEffect(() => {
    let unsubscribe: () => void;

    const fetchSalesData = async () => {
      try {
        const isStaff = profile && ['Administrador', 'admin', 'Admin', 'Comercial', 'Comercial Externo', 'Vendedor Externo', 'Financeiro', 'Estoquista', 'Entregador', 'Expedição'].includes(profile.role || '');
        if (!isStaff) return;

        const { db } = await initFirebase();
        const q = collection(db, "pedidos_venda");
        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const docs = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            setPedidos(docs);
          },
          (error) => {
            console.warn("Dashboard snapshot error em pedidos_venda:", error);
          }
        );
      } catch (err) {
        console.error("Erro ao carregar dados de vendas para os gráficos:", err);
      }
    };

    fetchSalesData();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [profile]);
  
  // Se não for admin, redirecionar para o dashboard específico do perfil
  const isAdmin = isAdminRole(profile?.role);
  if (!isAdmin) {
    const targetDashboard = getDefaultDashboardForRole(profile?.role);
    return <Navigate to={targetDashboard} replace />;
  }

  return (
    <div className="w-full max-w-full space-y-8 pb-10">
      <Suspense fallback={null}>
        {isBackupModalOpen && (
          <BackupCsvModal 
            isOpen={isBackupModalOpen} 
            onClose={() => setIsBackupModalOpen(false)} 
          />
        )}
      </Suspense>

      <div className="bg-slate-50/70 dark:bg-slate-900/60 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Painel Administrativo</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-normal mt-1 leading-relaxed">
            Visão unificada das operações, relatórios consolidados, permissões e acessos da rede.
          </p>
        </div>

        {/* Bloco de Acesso Rápido */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-[#0071e3] flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900">
                <Zap size={20} className="fill-[#0071e3] text-[#0071e3]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Acesso Rápido</h2>
                  <span className="px-2.5 py-0.5 text-[10px] font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800 rounded-full">
                    Atalhos Operacionais
                  </span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-normal">
                  Agilize as rotinas diárias de estoque, relatórios e segurança
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/60 text-xs font-bold rounded-xl border border-blue-200 dark:border-blue-800 transition-all cursor-pointer shadow-2xs active:scale-[0.99]"
                title="Exportar cópia de segurança dos dados em formato CSV"
              >
                <Database size={15} className="text-blue-600 shrink-0" />
                <span>Exportar Backup (CSV)</span>
              </button>
              <Link
                to="/admin/expedicao/estoque?novo=true"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0071e3] hover:bg-[#0071e3]/90 text-white text-xs font-bold rounded-xl transition-all shadow-xs hover:shadow active:scale-[0.99] border border-[#0071e3]"
                title="Criar nova entrada ou saída no estoque de produtos"
              >
                <PlusCircle size={15} />
                <span>Nova Movimentação</span>
              </Link>
              <Link
                to="/admin/expedicao/estoque"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all shadow-2xs"
              >
                <Boxes size={15} className="text-slate-500" />
                <span>Ver Estoque</span>
              </Link>
            </div>
          </div>
        </div>

        {/* SEÇÃO DE GRÁFICOS LAZY-LOADED COM RECHARTS */}
        <Suspense fallback={<SkeletonCharts className="mt-8" />}>
          <AdminDashboardCharts pedidos={pedidos} />
        </Suspense>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Módulos Administrativos
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              {adminModules.length} módulos disponíveis
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {adminModules.map((module) => {
              const Icon = module.icon;
              return (
                <Link
                  key={module.title}
                  to={module.link}
                  className="group block bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all relative space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center ${module.iconBg} ${module.iconColor} border border-slate-100 dark:border-slate-800 shadow-2xs`}
                    >
                      <Icon size={22} strokeWidth={1.75} />
                    </div>
                    <ArrowUpRight 
                      size={18} 
                      className="text-slate-300 group-hover:text-slate-700 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" 
                      strokeWidth={1.75} 
                    />
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#0071e3] transition-colors">
                      {module.title}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed font-normal mt-1 line-clamp-2">
                      {module.description}
                    </p>
                  </div>
                  
                  <div className="text-xs font-semibold text-slate-400 group-hover:text-[#0071e3] transition-colors flex items-center gap-1 pt-1">
                    <span>Acessar</span>
                    <span>&rarr;</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* TABELA DE HISTÓRICO DE ATIVIDADES E AUDITORIA INTERNA (LAZY LOADED) */}
        <Suspense fallback={<div className="mt-8"><SkeletonTable rows={5} cols={5} /></div>}>
          <ActivityAuditTable />
        </Suspense>
      </div>

      {/* Badges de infraestrutura e governança */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Servidor de Produção</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/60">
              <Server size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Google Cloud Run</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Container Serverless 24/7</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Banco de Dados em Nuvem</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/60">
              <Database size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Firebase Firestore</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">NoSQL Real-time Cloud DB</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Arquitetura Frontend</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-50 dark:bg-cyan-950/50 flex items-center justify-center text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-900/60">
              <Code2 size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">React & TypeScript</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Vite & Tailwind CSS</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

