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
    iconColor: "text-blue-500",
    iconBg: "bg-blue-50",
  },
  {
    title: "Empregados",
    description: "Cadastro e dados dos colaboradores.",
    link: "/admin/empregados",
    icon: BadgeCheck,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-50",
  },
  {
    title: "Franqueadora (Matriz)",
    description: "Gestão central da Franqueadora e parâmetros da rede.",
    link: "/admin/franqueadora",
    icon: Building2,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-50",
  },
  {
    title: "Franqueada (Unidades)",
    description: "Cadastro e gestão das unidades franqueadas da rede.",
    link: "/admin/empresa",
    icon: Building2,
    iconColor: "text-slate-600",
    iconBg: "bg-slate-100",
  },
  {
    title: "Integração Pagamentos",
    description: "Mercado Pago: PIX, boleto e cartão.",
    link: "/admin/integracao-pagamentos",
    icon: CreditCard,
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-50",
  },
  {
    title: "Kits Essenciais",
    description: "Combos pré-montados de produtos.",
    link: "/admin/kits-essenciais",
    icon: Package,
    iconColor: "text-cyan-600",
    iconBg: "bg-cyan-50",
  },
  {
    title: "Marcas Parceiras",
    description: "Marcas com acordos e benefícios.",
    link: "/admin/marcas-parceiras",
    icon: Handshake,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
  },
  {
    title: "Clube de Benefícios",
    description: "Vantagens e descontos para clientes.",
    link: "/admin/clube-beneficios",
    icon: Gift,
    iconColor: "text-teal-600",
    iconBg: "bg-teal-50",
  },
  {
    title: "Relatórios",
    description: "Indicadores gerais do negócio.",
    link: "/admin/relatorios",
    icon: BarChart3,
    iconColor: "text-sky-600",
    iconBg: "bg-sky-50",
  },
  {
    title: "Acompanhamento de Venda",
    description: "Acompanhe o andamento dos pedidos no sistema.",
    link: "/admin/acompanhamento-venda",
    icon: ShieldCheck,
    iconColor: "text-indigo-700",
    iconBg: "bg-indigo-50",
  },
  {
    title: "Backups & Agendador",
    description: "Agendamento automático do Firestore e logs de conclusão.",
    link: "/admin/backup",
    icon: Database,
    iconColor: "text-blue-700",
    iconBg: "bg-blue-50",
  },
];

const PIE_COLORS = ["#0071e3", "#0d9488", "#0284c7", "#4f46e5", "#0891b2", "#64748b"];

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
    <div className="w-full max-w-full pb-10">
      <Suspense fallback={null}>
        {isBackupModalOpen && (
          <BackupCsvModal 
            isOpen={isBackupModalOpen} 
            onClose={() => setIsBackupModalOpen(false)} 
          />
        )}
      </Suspense>

      <div className="bg-[#f8f9fc] rounded-t-2xl p-6 sm:p-8 pb-10 mt-6 relative border border-slate-200/80">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Administração</h1>
        <p className="text-slate-500 text-sm">
          Configurações gerais, usuários, integrações e relatórios.
        </p>

        {/* Bloco de Acesso Rápido */}
        <div className="mt-6 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0071e3] flex items-center justify-center shrink-0 border border-blue-100">
                <Zap size={20} className="fill-[#0071e3] text-[#0071e3]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">Acesso Rápido</h2>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-teal-100 text-teal-800 rounded-full">
                    Atalhos
                  </span>
                </div>
                <p className="text-slate-500 text-xs mt-0.5">
                  Agilize as rotinas diárias do estoque, relatórios e segurança
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                title="Exportar cópia de segurança dos dados em formato CSV"
              >
                <Database size={16} className="text-blue-600 shrink-0" />
                <span>Exportar Backup (CSV)</span>
              </button>
              <Link
                to="/admin/expedicao/estoque?novo=true"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow active:scale-[0.99] border border-teal-700 cursor-pointer"
                title="Criar nova entrada ou saída no estoque de produtos"
              >
                <PlusCircle size={16} />
                <span>Nova Movimentação</span>
              </Link>
              <Link
                to="/admin/expedicao/estoque"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
              >
                <Boxes size={16} className="text-slate-500" />
                <span>Ver Estoque</span>
              </Link>
            </div>
          </div>
        </div>

        {/* SEÇÃO DE GRÁFICOS LAZY-LOADED COM RECHARTS */}
        <Suspense fallback={<SkeletonCharts className="mt-8" />}>
          <AdminDashboardCharts pedidos={pedidos} />
        </Suspense>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {adminModules.map((module) => {
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

        {/* TABELA DE HISTÓRICO DE ATIVIDADES E AUDITORIA INTERNA (LAZY LOADED) */}
        <Suspense fallback={<div className="mt-8"><SkeletonTable rows={5} cols={5} /></div>}>
          <ActivityAuditTable />
        </Suspense>
      </div>
      <div className="px-8 mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Servidor</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Google Cloud Run</p>
              <p className="text-xs text-slate-500">Container Serverless</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Banco de Dados</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Firebase Firestore</p>
              <p className="text-xs text-slate-500">NoSQL Cloud Database</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Tecnologia</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">React & TypeScript</p>
              <p className="text-xs text-slate-500">Node.js (Express & Vite)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
