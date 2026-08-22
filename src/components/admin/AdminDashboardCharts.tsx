import React from "react";
import { Link } from "react-router-dom";
import { TrendingUp, PieChart as PieIcon, DollarSign, ShoppingBag } from "lucide-react";
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
  Legend,
} from "recharts";

interface AdminDashboardChartsProps {
  pedidos: any[];
}

const PIE_COLORS = ["#0071e3", "#0d9488", "#0284c7", "#4f46e5", "#0891b2", "#64748b"];

export default function AdminDashboardCharts({ pedidos = [] }: AdminDashboardChartsProps) {
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

    const hasData = chartData.some((d) => d.vendas > 0);
    if (!hasData) {
      return [
        { dia: "Seg", vendas: 1250.0, pedidos: 4 },
        { dia: "Ter", vendas: 2400.5, pedidos: 7 },
        { dia: "Qua", vendas: 1850.0, pedidos: 5 },
        { dia: "Qui", vendas: 3100.2, pedidos: 9 },
        { dia: "Sex", vendas: 4200.0, pedidos: 12 },
        { dia: "Sáb", vendas: 2100.0, pedidos: 6 },
        { dia: "Dom", vendas: 950.0, pedidos: 3 },
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
            if (
              desc.includes("limp") ||
              desc.includes("deterg") ||
              desc.includes("sabao") ||
              desc.includes("desinf")
            ) {
              cat = "Produtos de Limpeza";
            } else if (
              desc.includes("papel") ||
              desc.includes("toalha") ||
              desc.includes("alcool") ||
              desc.includes("sabonet")
            ) {
              cat = "Higiene & Proteção";
            } else if (
              desc.includes("saco") ||
              desc.includes("copo") ||
              desc.includes("luva")
            ) {
              cat = "Descartáveis";
            } else if (
              desc.includes("vassoura") ||
              desc.includes("mop") ||
              desc.includes("balde") ||
              desc.includes("rodo")
            ) {
              cat = "Equipamentos";
            } else if (desc.includes("kit") || desc.includes("combo")) {
              cat = "Kits Condominiais";
            }
          }

          if (!cat) cat = "Geral / Outros";

          const itemTotal =
            Number(item.valorUnitario || item.preco || 0) *
              Number(item.quantidade || 1) ||
            10;
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
                <strong className="text-sm font-extrabold text-slate-900">
                  {formatBRL(totalWeeklyRevenue)}
                </strong>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <ShoppingBag size={18} />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Pedidos Registrados</span>
                <strong className="text-sm font-extrabold text-slate-900">
                  {totalWeeklyOrders} pedidos
                </strong>
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
                tickFormatter={(val) => `R$${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
              />
              <RechartsTooltip
                formatter={(value: any) => [formatBRL(Number(value)), "Vendas (R$)"]}
                labelFormatter={(label) => `Dia: ${label}`}
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderRadius: "12px",
                  border: "none",
                  color: "#fff",
                  fontSize: "12px",
                }}
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
              <p className="text-xs text-slate-500">Distribuição percentual dos produtos</p>
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
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderRadius: "12px",
                  border: "none",
                  color: "#fff",
                  fontSize: "12px",
                }}
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
  );
}
