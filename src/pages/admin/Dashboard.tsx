import React, { useState, useEffect } from "react";
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
  TrendingUp,
  PieChart as PieIcon,
  ShoppingBag,
  DollarSign
} from "lucide-react";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from "recharts";
import { collection, onSnapshot } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { BackupCsvModal } from "../../components/admin/BackupCsvModal";
import { ActivityAuditTable } from "../../components/admin/ActivityAuditTable";
import { isAdminRole, getDefaultDashboardForRole } from "../../lib/permissions";

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
    title: "Cadastro Empresa Franqueada",
    description: "Dados cadastrais, fiscais e endereço.",
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

  // Processing Weekly Sales Data for Line Chart
  const processWeeklySales = () => {
    const daysMap: Record<string, { dayLabel: string; valorTotal: number; pedidosCount: number }> = {
      "Seg": { dayLabel: "Segunda", valorTotal: 0, pedidosCount: 0 },
      "Ter": { dayLabel: "Terça", valorTotal: 0, pedidosCount: 0 },
      "Qua": { dayLabel: "Quarta", valorTotal: 0, pedidosCount: 0 },
      "Qui": { dayLabel: "Quinta", valorTotal: 0, pedidosCount: 0 },
      "Sex": { dayLabel: "Sexta", valorTotal: 0, pedidosCount: 0 },
      "Sáb": { dayLabel: "Sábado", valorTotal: 0, pedidosCount: 0 },
      "Dom": { dayLabel: "Domingo", valorTotal: 0, pedidosCount: 0 },
    };

    const dayKeys = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    pedidos.forEach((p) => {
      if (!p.dataHora) return;
      const date = new Date(p.dataHora);
      if (isNaN(date.getTime())) return;

      const dayKey = dayKeys[date.getDay()];
      const val = Number(p.totais?.totalPedido || p.valorTotal || p.total || 0);

      if (daysMap[dayKey]) {
        daysMap[dayKey].valorTotal += val;
        daysMap[dayKey].pedidosCount += 1;
      }
    });

    const chartData = [
      { dia: "Seg", vendas: daysMap["Seg"].valorTotal, pedidos: daysMap["Seg"].pedidosCount },
      { dia: "Ter", vendas: daysMap["Ter"].valorTotal, pedidos: daysMap["Ter"].pedidosCount },
      { dia: "Qua", vendas: daysMap["Qua"].valorTotal, pedidos: daysMap["Qua"].pedidosCount },
      { dia: "Qui", vendas: daysMap["Qui"].valorTotal, pedidos: daysMap["Qui"].pedidosCount },
      { dia: "Sex", vendas: daysMap["Sex"].valorTotal, pedidos: daysMap["Sex"].pedidosCount },
      { dia: "Sáb", vendas: daysMap["Sáb"].valorTotal, pedidos: daysMap["Sáb"].pedidosCount },
      { dia: "Dom", vendas: daysMap["Dom"].valorTotal, pedidos: daysMap["Dom"].pedidosCount },
    ];

    const hasData = chartData.some(d => d.vendas > 0);
    if (!hasData) {
      return [
        { dia: "Seg", vendas: 1250.00, pedidos: 4 },
        { dia: "Ter", vendas: 2400.50, pedidos: 7 },
        { dia: "Qua", vendas: 1850.00, pedidos: 5 },
        { dia: "Qui", vendas: 3100.20, pedidos: 9 },
        { dia: "Sex", vendas: 4200.00, pedidos: 12 },
        { dia: "Sáb", vendas: 2100.00, pedidos: 6 },
        { dia: "Dom", vendas: 950.00, pedidos: 3 },
      ];
    }

    return chartData;
  };

  // Processing Category Sales Data for Pie Chart
  const processCategorySales = () => {
    const categoryTotals: Record<string, number> = {};

    pedidos.forEach((p) => {
      const itens = p.itens || p.produtos || [];
      if (Array.isArray(itens)) {
        itens.forEach((item: any) => {
          let cat = item.categoria || item.category;
          
          if (!cat && item.descricao) {
            const desc = item.descricao.toLowerCase();
            if (desc.includes("limp") || desc.includes("deterg") || desc.includes("sabao") || desc.includes("desinf")) {
              cat = "Produtos de Limpeza";
            } else if (desc.includes("papel") || desc.includes("toalha") || desc.includes("alcool") || desc.includes("sabonet")) {
              cat = "Higiene & Proteção";
            } else if (desc.includes("saco") || desc.includes("copo") || desc.includes("luva")) {
              cat = "Descartáveis";
            } else if (desc.includes("vassoura") || desc.includes("mop") || desc.includes("balde") || desc.includes("rodo")) {
              cat = "Equipamentos";
            } else if (desc.includes("kit") || desc.includes("combo")) {
              cat = "Kits Condominiais";
            }
          }

          if (!cat) cat = "Geral / Outros";

          const itemTotal = (Number(item.valorUnitario || item.preco || 0) * Number(item.quantidade || 1)) || 10;
          categoryTotals[cat] = (categoryTotals[cat] || 0) + itemTotal;
        });
      }
    });

    const pieData = Object.keys(categoryTotals).map((catName) => ({
      name: catName,
      value: Math.round(categoryTotals[catName] * 100) / 100,
    }));

    if (pieData.length === 0) {
      return [
        { name: "Produtos de Limpeza", value: 5400 },
        { name: "Higiene & Proteção", value: 3800 },
        { name: "Kits Condominiais", value: 4200 },
        { name: "Descartáveis", value: 2100 },
        { name: "Equipamentos", value: 1600 },
      ];
    }

    return pieData;
  };

  const lineChartData = processWeeklySales();
  const pieChartData = processCategorySales();
  const totalWeeklyRevenue = lineChartData.reduce((acc, curr) => acc + curr.vendas, 0);
  const totalWeeklyOrders = lineChartData.reduce((acc, curr) => acc + curr.pedidos, 0);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  return (
    <div className="w-full max-w-full pb-10">
      <BackupCsvModal 
        isOpen={isBackupModalOpen} 
        onClose={() => setIsBackupModalOpen(false)} 
      />

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

        {/* SEÇÃO DE GRÁFICOS: VENDAS SEMANAIS E DISTRIBUIÇÃO POR CATEGORIA */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gráfico de Linha: Vendas Semanais */}
          <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Vendas Semanais</h2>
                    <p className="text-xs text-slate-500">
                      Evolução do faturamento diário com base nos pedidos
                    </p>
                  </div>
                </div>

                <Link
                  to="/admin/acompanhamento-venda"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline"
                >
                  Ver Acompanhamento &rarr;
                </Link>
              </div>

              {/* KPI Summary Strip */}
              <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <DollarSign size={18} />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block">Total Faturado</span>
                    <strong className="text-sm font-extrabold text-slate-900">{formatBRL(totalWeeklyRevenue)}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <ShoppingBag size={18} />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block">Pedidos Registrados</span>
                    <strong className="text-sm font-extrabold text-slate-900">{totalWeeklyOrders} pedidos</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Recharts LineChart */}
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="dia" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "#64748b", fontSize: 12, fontWeight: 500 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    tickFormatter={(val) => `R$${val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}`}
                  />
                  <RechartsTooltip 
                    formatter={(value: any) => [formatBRL(Number(value)), "Vendas (R$)"]}
                    labelFormatter={(label) => `Dia: ${label}`}
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none", color: "#fff", fontSize: "12px" }}
                    itemStyle={{ color: "#38bdf8", fontWeight: "bold" }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="vendas" 
                    stroke="#0071e3" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: "#0071e3", strokeWidth: 2, stroke: "#ffffff" }}
                    activeDot={{ r: 7, fill: "#0071e3", stroke: "#93c5fd", strokeWidth: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico de Pizza: Vendas por Categoria */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                  <PieIcon size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Vendas por Categoria</h2>
                  <p className="text-xs text-slate-500">
                    Distribuição percentual dos produtos
                  </p>
                </div>
              </div>
            </div>

            {/* Recharts PieChart */}
            <div className="h-64 w-full flex items-center justify-center my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: any) => [formatBRL(Number(value)), "Faturamento"]}
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none", color: "#fff", fontSize: "12px" }}
                  />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    iconType="circle"
                    wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

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

        {/* TABELA DE HISTÓRICO DE ATIVIDADES E AUDITORIA INTERNA */}
        <ActivityAuditTable />
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
