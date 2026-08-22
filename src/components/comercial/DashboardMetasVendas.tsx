import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  TrendingUp,
  Target,
  Calendar,
  Edit3,
  CheckCircle2,
  Percent,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Save,
} from "lucide-react";
import { doc, getDoc, setDoc, onSnapshot, collection } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";

const MONTH_NAMES = [
  { num: 1, key: "01", short: "Jan", full: "Janeiro" },
  { num: 2, key: "02", short: "Fev", full: "Fevereiro" },
  { num: 3, key: "03", short: "Mar", full: "Março" },
  { num: 4, key: "04", short: "Abr", full: "Abril" },
  { num: 5, key: "05", short: "Mai", full: "Maio" },
  { num: 6, key: "06", short: "Jun", full: "Junho" },
  { num: 7, key: "07", short: "Jul", full: "Julho" },
  { num: 8, key: "08", short: "Ago", full: "Agosto" },
  { num: 9, key: "09", short: "Set", full: "Setembro" },
  { num: 10, key: "10", short: "Out", full: "Outubro" },
  { num: 11, key: "11", short: "Nov", full: "Novembro" },
  { num: 12, key: "12", short: "Dez", full: "Dezembro" },
];

const DEFAULT_MONTHLY_GOALS: Record<string, number> = {
  "01": 25000,
  "02": 28000,
  "03": 32000,
  "04": 30000,
  "05": 35000,
  "06": 38000,
  "07": 36000,
  "08": 40000,
  "09": 42000,
  "10": 45000,
  "11": 50000,
  "12": 60000,
};

interface MonthlyData {
  mesKey: string;
  mesShort: string;
  mesFull: string;
  mesNum: number;
  meta: number;
  vendas: number;
  pedidosCount: number;
  ticketMedio: number;
  percentual: number;
  diferenca: number;
  status: "atingida" | "em_andamento" | "abaixo";
}

interface MetasDoc {
  ano: number;
  metaAnual?: number;
  meses: Record<string, number>;
  updatedAt?: string;
  updatedBy?: string;
  observacoes?: string;
}

interface DashboardMetasVendasProps {
  className?: string;
}

export default function DashboardMetasVendas({ className = "" }: DashboardMetasVendasProps) {
  const { profile } = useAuth();
  const isAdmin = ["Administrador", "admin", "Admin", "Comercial"].includes(profile?.role || "");

  const currentYear = new Date().getFullYear();
  const currentMonthNum = new Date().getMonth() + 1; // 1-12

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState<"todos" | "q1" | "q2" | "q3" | "q4">("todos");
  const [viewMode, setViewMode] = useState<"chart" | "table" | "both">("both");
  
  const [metasMeses, setMetasMeses] = useState<Record<string, number>>(DEFAULT_MONTHLY_GOALS);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingMetas, setSavingMetas] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // Form state for Modal Editor
  const [tempMetas, setTempMetas] = useState<Record<string, number>>(DEFAULT_MONTHLY_GOALS);
  const [bulkValue, setBulkValue] = useState<string>("");
  const [annualBulkValue, setAnnualBulkValue] = useState<string>("");
  const [observacoesMeta, setObservacoesMeta] = useState<string>("");

  // Load metas_vendas and pedidos_venda
  useEffect(() => {
    let unsubMetas: (() => void) | undefined;
    let unsubPedidos: (() => void) | undefined;

    async function initData() {
      setLoading(true);
      try {
        const { db } = await initFirebase();

        // 1. Listen to metas_vendas doc for the selected year
        const metaDocRef = doc(db, "metas_vendas", `meta_${selectedYear}`);
        unsubMetas = onSnapshot(metaDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data() as MetasDoc;
            if (data.meses) {
              setMetasMeses({ ...DEFAULT_MONTHLY_GOALS, ...data.meses });
              setObservacoesMeta(data.observacoes || "");
            }
          } else {
            getDoc(doc(db, "metas_vendas", String(selectedYear))).then((altSnap) => {
              if (altSnap.exists()) {
                const altData = altSnap.data() as MetasDoc;
                if (altData.meses) {
                  setMetasMeses({ ...DEFAULT_MONTHLY_GOALS, ...altData.meses });
                  setObservacoesMeta(altData.observacoes || "");
                  return;
                }
              }
              setMetasMeses(DEFAULT_MONTHLY_GOALS);
              setObservacoesMeta("");
            }).catch(() => {
              setMetasMeses(DEFAULT_MONTHLY_GOALS);
            });
          }
        });

        // 2. Listen to pedidos_venda
        const pedidosCol = collection(db, "pedidos_venda");
        unsubPedidos = onSnapshot(
          pedidosCol,
          (snap) => {
            const items = snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));
            setPedidos(items);
            setLoading(false);
          },
          (err) => {
            console.warn("Erro ao ler pedidos_venda:", err);
            setLoading(false);
          }
        );
      } catch (err) {
        console.error("Erro na inicialização de Metas de Vendas:", err);
        setLoading(false);
      }
    }

    initData();

    return () => {
      if (unsubMetas) unsubMetas();
      if (unsubPedidos) unsubPedidos();
    };
  }, [selectedYear]);

  // Aggregate monthly sales for the selected year
  const monthlyData: MonthlyData[] = useMemo(() => {
    const salesPerMonth: Record<string, { total: number; count: number }> = {};
    MONTH_NAMES.forEach((m) => {
      salesPerMonth[m.key] = { total: 0, count: 0 };
    });

    pedidos.forEach((p) => {
      if (p.status === "Cancelado" || p.status === "Cancelada") return;

      const dateStr = p.dataHora || p.createdAt || p.data || p.dataEmissao;
      if (!dateStr) return;

      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;

      if (d.getFullYear() === selectedYear) {
        const monthNum = d.getMonth() + 1;
        const key = monthNum < 10 ? `0${monthNum}` : `${monthNum}`;
        const val = Number(p.totais?.totalPedido || p.valorTotal || p.total || p.pagamento?.valor || 0);

        if (salesPerMonth[key]) {
          salesPerMonth[key].total += val;
          salesPerMonth[key].count += 1;
        }
      }
    });

    return MONTH_NAMES.map((m) => {
      const meta = Number(metasMeses[m.key]) || DEFAULT_MONTHLY_GOALS[m.key] || 30000;
      const vendas = salesPerMonth[m.key]?.total || 0;
      const pedidosCount = salesPerMonth[m.key]?.count || 0;
      const ticketMedio = pedidosCount > 0 ? vendas / pedidosCount : 0;
      const percentual = meta > 0 ? (vendas / meta) * 100 : 0;
      const diferenca = vendas - meta;

      let status: "atingida" | "em_andamento" | "abaixo" = "abaixo";
      if (percentual >= 100) {
        status = "atingida";
      } else if (m.num === currentMonthNum && selectedYear === currentYear) {
        status = percentual >= 70 ? "em_andamento" : "abaixo";
      } else if (percentual >= 80) {
        status = "em_andamento";
      }

      return {
        mesKey: m.key,
        mesShort: m.short,
        mesFull: m.full,
        mesNum: m.num,
        meta,
        vendas,
        pedidosCount,
        ticketMedio,
        percentual,
        diferenca,
        status,
      };
    });
  }, [pedidos, metasMeses, selectedYear, currentYear, currentMonthNum]);

  // Filter by Quarter if selected
  const filteredData = useMemo(() => {
    if (selectedQuarter === "q1") return monthlyData.slice(0, 3);
    if (selectedQuarter === "q2") return monthlyData.slice(3, 6);
    if (selectedQuarter === "q3") return monthlyData.slice(6, 9);
    if (selectedQuarter === "q4") return monthlyData.slice(9, 12);
    return monthlyData;
  }, [monthlyData, selectedQuarter]);

  // KPI Calculations
  const totalMetaAno = useMemo(() => {
    return monthlyData.reduce((acc, m) => acc + m.meta, 0);
  }, [monthlyData]);

  const totalVendasAno = useMemo(() => {
    return monthlyData.reduce((acc, m) => acc + m.vendas, 0);
  }, [monthlyData]);

  const totalPedidosAno = useMemo(() => {
    return monthlyData.reduce((acc, m) => acc + m.pedidosCount, 0);
  }, [monthlyData]);

  const percentualAnoGeral = useMemo(() => {
    return totalMetaAno > 0 ? (totalVendasAno / totalMetaAno) * 100 : 0;
  }, [totalVendasAno, totalMetaAno]);

  // Current Month Data
  const currentMonthData = useMemo(() => {
    const found = monthlyData.find((m) => m.mesNum === currentMonthNum);
    return found || monthlyData[0];
  }, [monthlyData, currentMonthNum]);

  // Best Month
  const bestMonth = useMemo(() => {
    const withSales = [...monthlyData].sort((a, b) => b.vendas - a.vendas);
    return withSales[0] || monthlyData[0];
  }, [monthlyData]);

  // YTD calculation
  const ytdMetrics = useMemo(() => {
    const passedMonths = selectedYear === currentYear
      ? monthlyData.filter((m) => m.mesNum <= currentMonthNum)
      : monthlyData;
    
    const metaYtd = passedMonths.reduce((acc, m) => acc + m.meta, 0);
    const vendasYtd = passedMonths.reduce((acc, m) => acc + m.vendas, 0);
    const pctYtd = metaYtd > 0 ? (vendasYtd / metaYtd) * 100 : 0;

    return { metaYtd, vendasYtd, pctYtd };
  }, [monthlyData, selectedYear, currentYear, currentMonthNum]);

  // Currency Formatters
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const formatShortBRL = (val: number) => {
    if (val >= 1000000) {
      return `R$ ${(val / 1000000).toFixed(1)}M`;
    }
    if (val >= 1000) {
      return `R$ ${(val / 1000).toFixed(0)}k`;
    }
    return `R$ ${val.toFixed(0)}`;
  };

  // Helper for sum of record
  const getSumOfMetas = (metas: Record<string, number>): number => {
    let sum = 0;
    for (const key of Object.keys(metas)) {
      sum += Number(metas[key]) || 0;
    }
    return sum;
  };

  // Open Modal
  const handleOpenModal = () => {
    setTempMetas({ ...metasMeses });
    setBulkValue("");
    setAnnualBulkValue("");
    setIsModalOpen(true);
  };

  // Apply single value to all months
  const handleApplyBulk = () => {
    const parsed = parseFloat(bulkValue.replace(/\./g, "").replace(",", "."));
    if (isNaN(parsed) || parsed < 0) return;

    const updated: Record<string, number> = {};
    MONTH_NAMES.forEach((m) => {
      updated[m.key] = parsed;
    });
    setTempMetas(updated);
    setBulkValue("");
  };

  // Apply annual target distributed across 12 months
  const handleApplyAnnualBulk = () => {
    const parsed = parseFloat(annualBulkValue.replace(/\./g, "").replace(",", "."));
    if (isNaN(parsed) || parsed <= 0) return;

    const perMonth = Math.round((parsed / 12) * 100) / 100;
    const updated: Record<string, number> = {};
    MONTH_NAMES.forEach((m) => {
      updated[m.key] = perMonth;
    });
    setTempMetas(updated);
    setAnnualBulkValue("");
  };

  // Save metas to Firestore
  const handleSaveMetas = async () => {
    setSavingMetas(true);
    try {
      const { db } = await initFirebase();
      const metaDocRef = doc(db, "metas_vendas", `meta_${selectedYear}`);
      const totalCalculated = getSumOfMetas(tempMetas);

      await setDoc(
        metaDocRef,
        {
          ano: selectedYear,
          metaAnual: totalCalculated,
          meses: tempMetas,
          observacoes: observacoesMeta,
          updatedAt: new Date().toISOString(),
          updatedBy: profile?.nome || profile?.email || "Administrador",
        },
        { merge: true }
      );

      setMetasMeses(tempMetas);
      setSavingMetas(false);
      setIsModalOpen(false);
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 4000);
    } catch (err: any) {
      console.error("Erro ao salvar metas_vendas:", err);
      alert("Erro ao salvar metas: " + (err?.message || "Tente novamente."));
      setSavingMetas(false);
    }
  };

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as MonthlyData;
      const atingimento = data.percentual;
      const isSuperada = atingimento >= 100;

      return (
        <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200 text-xs min-w-[240px] animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2.5">
            <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-600" />
              {data.mesFull} de {selectedYear}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isSuperada
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : atingimento >= 80
                  ? "bg-blue-100 text-blue-800 border border-blue-200"
                  : "bg-amber-100 text-amber-800 border border-amber-200"
              }`}
            >
              {atingimento.toFixed(1)}% da Meta
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                Vendas Realizadas:
              </span>
              <span className="font-bold text-slate-900">{formatBRL(data.vendas)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
                Meta Estabelecida:
              </span>
              <span className="font-semibold text-slate-700">{formatBRL(data.meta)}</span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <span className="text-slate-500">Diferença (Gap):</span>
              <span
                className={`font-bold ${
                  data.diferenca >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {data.diferenca >= 0 ? "+" : ""}
                {formatBRL(data.diferenca)}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Volume de Pedidos:</span>
              <span className="font-medium text-slate-600">{data.pedidosCount} pedidos</span>
            </div>
            {data.pedidosCount > 0 && (
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Ticket Médio:</span>
                <span className="font-medium text-slate-600">{formatBRL(data.ticketMedio)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden ${className}`}
    >
      {/* Top Banner & Header */}
      <div className="p-6 pb-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-[#004b9e] to-blue-700 text-white relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-blue-100 mb-2 border border-white/15">
              <Target size={13} className="text-amber-400" />
              <span>Painel Comercial & Metas de Vendas</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Acompanhamento de Metas de Vendas</span>
            </h2>
            <p className="text-blue-100/90 text-xs sm:text-sm mt-1 max-w-2xl">
              Comparativo em tempo real do faturamento mensal versus as metas estabelecidas na coleção <code className="text-amber-300 font-mono">metas_vendas</code>.
            </p>
          </div>

          {/* Actions & Filters */}
          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            {/* Year Selector */}
            <div className="flex items-center bg-black/25 backdrop-blur-md rounded-xl p-1 border border-white/15">
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedYear === y
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>

            {/* Manage Goals Button */}
            {isAdmin && (
              <button
                onClick={handleOpenModal}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                title="Definir ou ajustar metas de vendas mensais"
              >
                <Edit3 size={14} className="text-slate-900" />
                <span>Definir Metas ({selectedYear})</span>
              </button>
            )}
          </div>
        </div>

        {/* Success toast indicator */}
        {saveSuccessMsg && (
          <div className="absolute top-3 right-3 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 size={14} />
            <span>Metas salvas no Firestore com sucesso!</span>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="p-6 bg-[#f8f9fc] border-b border-slate-200/80">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Meta do Mês Atual */}
          <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-2xs hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Meta do Mês ({currentMonthData.mesShort}/{selectedYear})
              </span>
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  currentMonthData.percentual >= 100
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-blue-50 text-blue-600"
                }`}
              >
                <Target size={16} />
              </div>
            </div>

            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-slate-900">
                {formatBRL(currentMonthData.vendas)}
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  currentMonthData.percentual >= 100
                    ? "bg-emerald-100 text-emerald-800"
                    : currentMonthData.percentual >= 80
                    ? "bg-blue-100 text-blue-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {currentMonthData.percentual.toFixed(1)}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mt-3">
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    currentMonthData.percentual >= 100
                      ? "bg-emerald-500"
                      : currentMonthData.percentual >= 80
                      ? "bg-blue-600"
                      : "bg-amber-500"
                  }`}
                  style={{ width: `${Math.min(currentMonthData.percentual, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>Alvo: {formatBRL(currentMonthData.meta)}</span>
                <span className="font-semibold text-slate-600">
                  {currentMonthData.diferenca >= 0
                    ? `+${formatBRL(currentMonthData.diferenca)}`
                    : formatBRL(currentMonthData.diferenca)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Vendas Acumuladas no Ano */}
          <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-2xs hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Acumulado Ano ({selectedYear})
              </span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <TrendingUp size={16} />
              </div>
            </div>

            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-slate-900">
                {formatBRL(totalVendasAno)}
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  percentualAnoGeral >= 100
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-indigo-100 text-indigo-800"
                }`}
              >
                {percentualAnoGeral.toFixed(1)}%
              </span>
            </div>

            <div className="mt-3">
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(percentualAnoGeral, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>Meta Anual: {formatBRL(totalMetaAno)}</span>
                <span className="font-semibold text-slate-600">{totalPedidosAno} pedidos</span>
              </div>
            </div>
          </div>

          {/* Card 3: YTD vs Meta Período */}
          <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-2xs hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Atingimento YTD (Até {MONTH_NAMES[currentMonthNum - 1]?.short})
              </span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Percent size={16} />
              </div>
            </div>

            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-purple-700">
                {ytdMetrics.pctYtd.toFixed(1)}%
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {formatShortBRL(ytdMetrics.vendasYtd)} / {formatShortBRL(ytdMetrics.metaYtd)}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2 text-[11px]">
              <span
                className={`inline-flex items-center gap-1 font-bold ${
                  ytdMetrics.vendasYtd >= ytdMetrics.metaYtd
                    ? "text-emerald-600"
                    : "text-amber-600"
                }`}
              >
                {ytdMetrics.vendasYtd >= ytdMetrics.metaYtd ? (
                  <ArrowUpRight size={13} />
                ) : (
                  <ArrowDownRight size={13} />
                )}
                {ytdMetrics.vendasYtd >= ytdMetrics.metaYtd
                  ? "Dentro do ritmo previsto"
                  : "Abaixo da meta programada"}
              </span>
            </div>
          </div>

          {/* Card 4: Melhor Mês */}
          <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-2xs hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Mês Destaque ({selectedYear})
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Award size={16} />
              </div>
            </div>

            <div className="flex items-baseline justify-between mt-1">
              <div>
                <span className="text-xl font-black text-slate-900">
                  {bestMonth ? bestMonth.mesFull : "—"}
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {bestMonth ? formatBRL(bestMonth.vendas) : "R$ 0,00"}
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                {bestMonth?.percentual?.toFixed(0) || 0}% meta
              </span>
            </div>

            <div className="mt-3 text-[11px] text-slate-400 flex justify-between">
              <span>{bestMonth?.pedidosCount || 0} pedidos faturados</span>
              <span className="font-semibold text-slate-600">
                TM: {formatBRL(bestMonth?.ticketMedio || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area: Filter toolbar + Chart + Table */}
      <div className="p-6">
        {/* Controls Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          {/* Quarter Filters */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSelectedQuarter("todos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedQuarter === "todos"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Ano Todo (12M)
            </button>
            <button
              onClick={() => setSelectedQuarter("q1")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedQuarter === "q1"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              1º Tri (Jan-Mar)
            </button>
            <button
              onClick={() => setSelectedQuarter("q2")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedQuarter === "q2"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              2º Tri (Abr-Jun)
            </button>
            <button
              onClick={() => setSelectedQuarter("q3")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedQuarter === "q3"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              3º Tri (Jul-Set)
            </button>
            <button
              onClick={() => setSelectedQuarter("q4")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedQuarter === "q4"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              4º Tri (Out-Dez)
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium hidden md:inline">Visualização:</span>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setViewMode("chart")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  viewMode === "chart"
                    ? "bg-white text-blue-600 font-bold shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Gráfico
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white text-blue-600 font-bold shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Tabela
              </button>
              <button
                onClick={() => setViewMode("both")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  viewMode === "both"
                    ? "bg-white text-blue-600 font-bold shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Ambos
              </button>
            </div>
          </div>
        </div>

        {/* Gráfico Recharts de Barras */}
        {(viewMode === "chart" || viewMode === "both") && (
          <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200/80 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <TrendingUp size={16} className="text-blue-600" />
                  <span>Comparativo Mensal: Vendas Realizadas vs. Meta Estabelecida</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Valores expressos em Reais (R$). Passe o cursor sobre as barras para ver detalhes completos.
                </p>
              </div>

              {/* Legend Badges */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-md bg-[#0071e3]" />
                  <span className="font-semibold text-slate-700">Vendas (R$)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-md bg-slate-300 border border-slate-400" />
                  <span className="font-semibold text-slate-700">Meta (R$)</span>
                </div>
              </div>
            </div>

            <div className="w-full h-[320px] sm:h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredData}
                  margin={{ top: 20, right: 15, left: 0, bottom: 5 }}
                  barGap={6}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="mesShort"
                    tickLine={false}
                    axisLine={{ stroke: "#cbd5e1" }}
                    tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => formatShortBRL(val)}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    width={65}
                  />
                  <Tooltip content={<CustomTooltip />} />

                  {/* Barra da Meta Estabelecida */}
                  <Bar
                    dataKey="meta"
                    name="Meta Estabelecida"
                    fill="#cbd5e1"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={38}
                  />

                  {/* Barra de Vendas Realizadas */}
                  <Bar
                    dataKey="vendas"
                    name="Vendas Realizadas"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={38}
                  >
                    {filteredData.map((entry, index) => {
                      const reached = entry.percentual >= 100;
                      const inProgress = entry.percentual >= 80;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={reached ? "#10b981" : inProgress ? "#0071e3" : "#3b82f6"}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Tabela de Acompanhamento Mensal */}
        {(viewMode === "table" || viewMode === "both") && (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="px-4 py-3.5">Mês</th>
                  <th className="px-4 py-3.5 text-right">Meta (R$)</th>
                  <th className="px-4 py-3.5 text-right">Realizado (R$)</th>
                  <th className="px-4 py-3.5 text-center">Pedidos</th>
                  <th className="px-4 py-3.5 text-right">Ticket Médio</th>
                  <th className="px-4 py-3.5 w-44">Atingimento (%)</th>
                  <th className="px-4 py-3.5 text-right">Diferença (Gap)</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((m) => {
                  const isCurrent = m.mesNum === currentMonthNum && selectedYear === currentYear;
                  return (
                    <tr
                      key={m.mesKey}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isCurrent ? "bg-blue-50/40 font-medium" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{m.mesFull}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-600 text-white uppercase tracking-wider">
                              Atual
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-600">
                        {formatBRL(m.meta)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {formatBRL(m.vendas)}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 font-medium">
                        {m.pedidosCount}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {m.pedidosCount > 0 ? formatBRL(m.ticketMedio) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-bold text-slate-700">
                              {m.percentual.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                m.percentual >= 100
                                  ? "bg-emerald-500"
                                  : m.percentual >= 80
                                  ? "bg-blue-600"
                                  : "bg-amber-500"
                              }`}
                              style={{ width: `${Math.min(m.percentual, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          m.diferenca >= 0 ? "text-emerald-600" : "text-red-500"
                        }`}
                      >
                        {m.diferenca >= 0 ? `+${formatBRL(m.diferenca)}` : formatBRL(m.diferenca)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.percentual >= 100
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : m.percentual >= 80
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {m.percentual >= 100
                            ? "🎯 Meta Superada"
                            : m.percentual >= 80
                            ? "⚡ Em Progresso"
                            : "⚠️ Abaixo"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
                <tr>
                  <td className="px-4 py-3">Totais Consolidados</td>
                  <td className="px-4 py-3 text-right">
                    {formatBRL(
                      filteredData.reduce((acc, m) => acc + m.meta, 0)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-blue-700">
                    {formatBRL(
                      filteredData.reduce((acc, m) => acc + m.vendas, 0)
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {filteredData.reduce((acc, m) => acc + m.pedidosCount, 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {(() => {
                      const totPed = filteredData.reduce((acc, m) => acc + m.pedidosCount, 0);
                      const totVal = filteredData.reduce((acc, m) => acc + m.vendas, 0);
                      return totPed > 0 ? formatBRL(totVal / totPed) : "—";
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const totMeta = filteredData.reduce((acc, m) => acc + m.meta, 0);
                      const totVal = filteredData.reduce((acc, m) => acc + m.vendas, 0);
                      const pct = totMeta > 0 ? (totVal / totMeta) * 100 : 0;
                      return (
                        <span className="text-xs font-bold text-slate-900">
                          {pct.toFixed(1)}%
                        </span>
                      );
                    })()}
                  </td>
                  <td
                    className={`px-4 py-3 text-right ${
                      filteredData.reduce((acc, m) => acc + m.diferenca, 0) >= 0
                        ? "text-emerald-600"
                        : "text-red-500"
                    }`}
                  >
                    {(() => {
                      const diff = filteredData.reduce((acc, m) => acc + m.diferenca, 0);
                      return diff >= 0 ? `+${formatBRL(diff)}` : formatBRL(diff);
                    })()}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-400">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Editor de Metas de Vendas (Coleção 'metas_vendas') */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                  <Target size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    Definir Metas de Vendas ({selectedYear})
                  </h3>
                  <p className="text-slate-400 text-xs">
                    Coleção Firestore: <code className="text-amber-300">metas_vendas/meta_{selectedYear}</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Quick Fill Helpers */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                <span className="text-xs font-bold text-slate-700 block mb-2">
                  ⚡ Preenchimento Rápido / Distribuição Automática:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Bulk monthly value */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">
                      Meta Fixa p/ Todos os Meses (R$)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Ex: 40000"
                        value={bulkValue}
                        onChange={(e) => setBulkValue(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleApplyBulk}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>

                  {/* Bulk annual target */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">
                      Meta Anual Total (Dividir em 12x)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Ex: 500000"
                        value={annualBulkValue}
                        onChange={(e) => setAnnualBulkValue(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleApplyAnnualBulk}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                      >
                        Distribuir
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Month by month inputs */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                  Metas Mês a Mês (R$)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {MONTH_NAMES.map((m) => (
                    <div key={m.key} className="bg-white p-3 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-800">{m.full}</span>
                        <span className="text-[10px] text-slate-400 font-mono">Mês {m.key}</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">
                          R$
                        </span>
                        <input
                          type="number"
                          step="100"
                          value={tempMetas[m.key] !== undefined ? tempMetas[m.key] : ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setTempMetas((prev) => ({ ...prev, [m.key]: val }));
                          }}
                          className="w-full pl-8 pr-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Observações ou Premissas Comerciais (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={observacoesMeta}
                  onChange={(e) => setObservacoesMeta(e.target.value)}
                  placeholder="Ex: Metas alinhadas com o plano de expansão de novas franquias e convenções sindicais..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Total preview */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-blue-700 font-medium">Meta Anual Consolidada:</span>
                  <p className="text-xl font-black text-blue-950">
                    {formatBRL(getSumOfMetas(tempMetas))}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-blue-700 font-medium">Média por Mês:</span>
                  <p className="text-sm font-bold text-blue-900">
                    {formatBRL(getSumOfMetas(tempMetas) / 12)}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveMetas}
                disabled={savingMetas}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Save size={15} />
                <span>{savingMetas ? "Salvando Metas..." : "Salvar Metas no Firestore"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
