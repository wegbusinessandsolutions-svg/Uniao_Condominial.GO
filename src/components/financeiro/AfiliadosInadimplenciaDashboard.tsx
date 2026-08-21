import React, { useMemo, useState } from "react";
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from "recharts";
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Layers, 
  DollarSign, 
  Users, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  PieChart as PieIcon,
  BarChart3,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Calendar,
  X
} from "lucide-react";
import { formatCurrency, parseValor } from "../../lib/utils";

export const CENTRO_CUSTO_AFILIACAO = "Rec. Afiliação Mensal";

interface AfiliadosInadimplenciaDashboardProps {
  contasReceber: any[];
  afiliados?: any[];
  dataInicio?: string;
  dataFim?: string;
  tipoDataFiltro?: string;
  onApplyFilter?: (centroCusto: string, status?: string) => void;
  onClearDateFilter?: () => void;
  currentCentroCustoFilter?: string;
  currentStatusFilter?: string;
}

export default function AfiliadosInadimplenciaDashboard({
  contasReceber,
  afiliados = [],
  dataInicio = "",
  dataFim = "",
  tipoDataFiltro = "vencimento",
  onApplyFilter,
  onClearDateFilter,
  currentCentroCustoFilter,
  currentStatusFilter,
}: AfiliadosInadimplenciaDashboardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [viewMode, setViewMode] = useState<"pie" | "bar">("pie");

  const formatDisplayDate = (d?: string) => {
    if (!d) return "";
    try {
      const [y, m, day] = d.split("-");
      return `${day}/${m}/${y}`;
    } catch {
      return d;
    }
  };

  // Processamento detalhado dos dados filtrados pelo Centro de Custo 'Rec. Afiliação Mensal' e Período de Datas
  const metrics = useMemo(() => {
    const now = new Date();

    // 1. Filtra as contas vinculadas ao Centro de Custo "Rec. Afiliação Mensal" e dentro do período selecionado
    const contasAfiliacao = contasReceber.filter((item) => {
      const cc = (item.centroCusto || "").trim();
      const cat = (item.categoria || "").trim();
      const orig = (item.origem || "").trim();
      const desc = (item.descricao || "").toLowerCase();

      const isAfiliacao = (
        cc === CENTRO_CUSTO_AFILIACAO ||
        cat === "Afiliação" ||
        orig === "afiliacao_uc" ||
        item.afiliacaoId ||
        desc.includes("afiliação") ||
        desc.includes("mensalidade u.c") ||
        desc.includes("mensalidade uc")
      );

      if (!isAfiliacao) return false;

      // Filtro de Data (Início / Fim)
      if (dataInicio || dataFim) {
        const itemDate = tipoDataFiltro === "recebimento" 
          ? (item.recebidoEm || item.dataRecebimento || item.vencimento || "") 
          : tipoDataFiltro === "criacao" 
          ? (item.createdAt ? item.createdAt.slice(0, 10) : "") 
          : (item.vencimento || "");

        if (dataInicio && itemDate && itemDate < dataInicio) return false;
        if (dataFim && itemDate && itemDate > dataFim) return false;
        if (!itemDate && (dataInicio || dataFim)) return false;
      }

      return true;
    });

    // 2. Mapeia as parcelas por afiliado / condomínio
    const afiliadoMap = new Map<string, {
      id: string;
      nome: string;
      totalParcelas: number;
      pagasCount: number;
      abertasCount: number;
      atrasadasCount: number;
      canceladasCount: number;
      valorAtrasado: number;
      valorTotal: number;
      valorMensalidade: number;
    }>();

    // Primeiro inicializa com a lista de afiliados cadastrados (se fornecida)
    afiliados.forEach((af) => {
      const key = (af.id || af.userId || af.nomeCondominio || "").trim().toLowerCase();
      if (!key) return;
      
      const nome = af.nomeCondominio || af.razaoSocial || af.nomeSindico || "Afiliado";
      const valorMensalidade = parseValor(af.valorMensalidade);

      afiliadoMap.set(key, {
        id: af.id || key,
        nome,
        totalParcelas: 0,
        pagasCount: 0,
        abertasCount: 0,
        atrasadasCount: 0,
        canceladasCount: 0,
        valorAtrasado: 0,
        valorTotal: 0,
        valorMensalidade,
      });
    });

    // 3. Itera sobre todas as contas do centro de custo para diagnosticar cada afiliado
    let totalValorRecebido = 0;
    let totalValorAberto = 0;
    let totalValorAtrasado = 0;
    let totalValorCancelado = 0;

    let qtdParcelasRecebidas = 0;
    let qtdParcelasAbertas = 0;
    let qtdParcelasAtrasadas = 0;
    let qtdParcelasCanceladas = 0;

    contasAfiliacao.forEach((conta) => {
      const valor = parseValor(conta.valor);
      const status = (conta.status || "Aberto").trim();
      const vencimento = conta.vencimento;

      let isAtrasada = false;
      if (status === "Recebido" || status === "Pago") {
        totalValorRecebido += (parseValor(conta.valorRecebido) || valor);
        qtdParcelasRecebidas++;
      } else if (status === "Cancelado") {
        totalValorCancelado += valor;
        qtdParcelasCanceladas++;
      } else {
        // Status Aberto, Atrasado, Auditar Web, etc.
        if (vencimento) {
          const dataVenc = new Date(vencimento + "T23:59:59");
          if (dataVenc < now || status === "Atrasado" || status === "Vencido") {
            isAtrasada = true;
            totalValorAtrasado += valor;
            qtdParcelasAtrasadas++;
          } else {
            totalValorAberto += valor;
            qtdParcelasAbertas++;
          }
        } else if (status === "Atrasado" || status === "Vencido") {
          isAtrasada = true;
          totalValorAtrasado += valor;
          qtdParcelasAtrasadas++;
        } else {
          totalValorAberto += valor;
          qtdParcelasAbertas++;
        }
      }

      // Vínculo com o afiliado
      const key = (
        conta.afiliacaoId || 
        conta.clienteId || 
        conta.titular || 
        conta.clienteNome || 
        conta.cliente || 
        ""
      ).trim().toLowerCase();

      if (key) {
        let entry = afiliadoMap.get(key);
        if (!entry) {
          // Busca parcial se não encontrar exato
          for (const [k, v] of afiliadoMap.entries()) {
            if (k.includes(key) || key.includes(k) || (v.nome && v.nome.toLowerCase() === key)) {
              entry = v;
              break;
            }
          }
        }

        if (!entry) {
          entry = {
            id: conta.clienteId || conta.afiliacaoId || key,
            nome: conta.titular || conta.clienteNome || conta.cliente || "Condomínio Afiliado",
            totalParcelas: 0,
            pagasCount: 0,
            abertasCount: 0,
            atrasadasCount: 0,
            canceladasCount: 0,
            valorAtrasado: 0,
            valorTotal: 0,
            valorMensalidade: valor,
          };
          afiliadoMap.set(key, entry);
        }

        entry.totalParcelas++;
        entry.valorTotal += valor;
        if (status === "Recebido" || status === "Pago") {
          entry.pagasCount++;
        } else if (status === "Cancelado") {
          entry.canceladasCount++;
        } else if (isAtrasada) {
          entry.atrasadasCount++;
          entry.valorAtrasado += valor;
        } else {
          entry.abertasCount++;
        }
      }
    });

    // 4. Classificação dos Afiliados em Em Dia vs Inadimplentes
    let afiliadosEmDiaCount = 0;
    let afiliadosInadimplentesCount = 0;
    let valorMensalidadeEmDia = 0;
    let valorMensalidadeInadimplentes = 0;

    afiliadoMap.forEach((af) => {
      // Se não tem nenhuma parcela no período ou se tem apenas parcelas canceladas e nenhuma em aberto
      if (af.totalParcelas === 0 && af.canceladasCount === 0) {
        // Se há filtro de período ativo e o condomínio não tem parcela no período, não contabiliza como ativo no período
        if (dataInicio || dataFim) return;

        afiliadosEmDiaCount++;
        valorMensalidadeEmDia += af.valorMensalidade;
        return;
      }

      if (af.totalParcelas === 0 && (dataInicio || dataFim)) {
        return;
      }

      if (af.atrasadasCount > 0) {
        afiliadosInadimplentesCount++;
        valorMensalidadeInadimplentes += (af.valorMensalidade || af.valorAtrasado);
      } else {
        afiliadosEmDiaCount++;
        valorMensalidadeEmDia += af.valorMensalidade;
      }
    });

    const totalAfiliados = afiliadosEmDiaCount + afiliadosInadimplentesCount;
    const percEmDia = totalAfiliados > 0 ? (afiliadosEmDiaCount / totalAfiliados) * 100 : 100;
    const percInadimplente = totalAfiliados > 0 ? (afiliadosInadimplentesCount / totalAfiliados) * 100 : 0;

    // Dados para o Gráfico de Rosca (Adimplência de Afiliados)
    const pieDataAfiliados = [
      {
        name: "Em Dia (Adimplentes)",
        value: afiliadosEmDiaCount,
        percent: percEmDia,
        color: "#10b981", // Emerald 500
        valorMensal: valorMensalidadeEmDia,
        icon: CheckCircle2,
      },
      {
        name: "Inadimplentes (Atrasados)",
        value: afiliadosInadimplentesCount,
        percent: percInadimplente,
        color: "#f43f5e", // Rose 500
        valorMensal: valorMensalidadeInadimplentes,
        valorAtrasado: totalValorAtrasado,
        icon: AlertTriangle,
      },
    ].filter(item => item.value > 0 || totalAfiliados === 0);

    // Se não houver dados no período, exibe 100% Em Dia como base
    if (pieDataAfiliados.length === 0) {
      pieDataAfiliados.push({
        name: "Sem lançamentos no período",
        value: 1,
        percent: 100,
        color: "#94a3b8",
        valorMensal: 0,
        icon: CheckCircle2,
      });
    }

    // Dados para Gráfico de Barras Financeiro do Centro de Custo
    const barDataFinanceiro = [
      {
        categoria: "Recebido",
        valor: totalValorRecebido,
        quantidade: qtdParcelasRecebidas,
        fill: "#10b981",
      },
      {
        categoria: "A Vencer",
        valor: totalValorAberto,
        quantidade: qtdParcelasAbertas,
        fill: "#3b82f6",
      },
      {
        categoria: "Atrasado",
        valor: totalValorAtrasado,
        quantidade: qtdParcelasAtrasadas,
        fill: "#f43f5e",
      },
    ];

    return {
      totalAfiliados,
      afiliadosEmDiaCount,
      afiliadosInadimplentesCount,
      percEmDia,
      percInadimplente,
      totalValorRecebido,
      totalValorAberto,
      totalValorAtrasado,
      totalValorCancelado,
      qtdParcelasRecebidas,
      qtdParcelasAbertas,
      qtdParcelasAtrasadas,
      pieDataAfiliados,
      barDataFinanceiro,
      totalLancamentosAfiliacao: contasAfiliacao.length,
    };
  }, [contasReceber, afiliados, dataInicio, dataFim, tipoDataFiltro]);

  // Tooltip customizado para o gráfico de rosca
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1 z-50">
          <div className="font-bold text-sm flex items-center gap-1.5" style={{ color: data.color }}>
            <span>●</span> {data.name}
          </div>
          <div className="flex justify-between gap-4 text-slate-300">
            <span>Quantidade:</span>
            <span className="font-semibold text-white">{data.value} afiliado(s)</span>
          </div>
          <div className="flex justify-between gap-4 text-slate-300">
            <span>Percentual:</span>
            <span className="font-semibold text-white">{data.percent.toFixed(1)}%</span>
          </div>
          {data.valorAtrasado > 0 && (
            <div className="flex justify-between gap-4 text-rose-300 pt-1 border-t border-slate-800">
              <span>Débito Total:</span>
              <span className="font-bold text-rose-400">{formatCurrency(data.valorAtrasado)}</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Tooltip customizado para o gráfico de barras
  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1 z-50">
          <div className="font-bold text-sm" style={{ color: data.fill }}>
            Status: {data.categoria}
          </div>
          <div className="flex justify-between gap-4 text-slate-300">
            <span>Valor Total:</span>
            <span className="font-semibold text-white">{formatCurrency(data.valor)}</span>
          </div>
          <div className="flex justify-between gap-4 text-slate-300">
            <span>Quantidade:</span>
            <span className="font-semibold text-white">{data.quantidade} parcela(s)</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const isFilteredByAfiliacao = currentCentroCustoFilter === CENTRO_CUSTO_AFILIACAO;

  return (
    <div className="bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/20 rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300">
      {/* Header do Dashboard */}
      <div className="px-5 py-4 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
            <PieIcon size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900">
                Dashboard de Adimplência — Afiliados
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Layers size={11} />
                {CENTRO_CUSTO_AFILIACAO}
              </span>

              {(dataInicio || dataFim) && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  <Calendar size={11} className="text-amber-600" />
                  <span>
                    {dataInicio && dataFim
                      ? `${formatDisplayDate(dataInicio)} até ${formatDisplayDate(dataFim)}`
                      : dataInicio
                      ? `A partir de ${formatDisplayDate(dataInicio)}`
                      : `Até ${formatDisplayDate(dataFim)}`}
                  </span>
                  {onClearDateFilter && (
                    <button
                      type="button"
                      onClick={onClearDateFilter}
                      className="hover:text-rose-600 transition-colors cursor-pointer ml-0.5"
                      title="Limpar filtro de período"
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Proporção de afiliados em dia versus inadimplentes e volume de faturamento recorrente
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          {/* Alternar Gráfico */}
          <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("pie")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "pie"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Visualização em Rosca (Percentual de Afiliados)"
            >
              <PieIcon size={13} />
              Percentual
            </button>
            <button
              type="button"
              onClick={() => setViewMode("bar")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "bar"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Visualização em Barras (Valores Financeiros)"
            >
              <BarChart3 size={13} />
              Valores (R$)
            </button>
          </div>

          {/* Botão de Recolher/Expandir */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200"
            title={isExpanded ? "Recolher dashboard" : "Expandir dashboard"}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Conteúdo Principal do Dashboard */}
      {isExpanded && (
        <div className="p-5 space-y-5">
          {/* Grid Superior: Gráfico + Cartões de Indicadores */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            
            {/* Coluna do Gráfico Recharts (5 colunas) */}
            <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center relative min-h-[260px]">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {viewMode === "pie" ? "Percentual de Adimplência" : "Volume Financeiro por Status"}
                </span>
                <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  Centro: {CENTRO_CUSTO_AFILIACAO}
                </span>
              </div>

              {viewMode === "pie" ? (
                <div className="relative w-full h-52 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.pieDataAfiliados}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={78}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {metrics.pieDataAfiliados.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Informação central na Rosca */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-800 tracking-tight">
                      {metrics.percEmDia.toFixed(0)}%
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                      Em Dia
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.barDataFinanceiro} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="categoria" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis 
                        tick={{ fontSize: 10, fill: '#64748b' }} 
                        axisLine={false} 
                        tickLine={false}
                        tickFormatter={(val) => `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                      />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                        {metrics.barDataFinanceiro.map((entry, index) => (
                          <Cell key={`bar-cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Legenda Customizada do Gráfico */}
              <div className="flex flex-wrap items-center justify-center gap-4 mt-2 pt-2 border-t border-slate-100 w-full text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="text-slate-600 font-medium">
                    Em Dia: <strong className="text-emerald-700">{metrics.afiliadosEmDiaCount}</strong> ({metrics.percEmDia.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0"></span>
                  <span className="text-slate-600 font-medium">
                    Inadimplentes: <strong className="text-rose-700">{metrics.afiliadosInadimplentesCount}</strong> ({metrics.percInadimplente.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Coluna dos Cards de KPIs e Estatísticas (7 colunas) */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              
              {/* Card 1: Em Dia (Adimplência) */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4 flex flex-col justify-between hover:shadow-sm transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Afiliados Em Dia
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 size={18} />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-emerald-900">{metrics.afiliadosEmDiaCount}</span>
                    <span className="text-xs font-bold text-emerald-700">
                      ({metrics.percEmDia.toFixed(1)}% do total)
                    </span>
                  </div>
                  <div className="text-xs text-emerald-700 mt-1 font-medium flex items-center gap-1">
                    <ShieldCheck size={13} />
                    <span>{metrics.qtdParcelasRecebidas} parcelas já liquidadas</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Inadimplentes (Atrasados) */}
              <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-4 flex flex-col justify-between hover:shadow-sm transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                    Afiliados Inadimplentes
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                    <AlertTriangle size={18} />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-rose-900">{metrics.afiliadosInadimplentesCount}</span>
                    <span className="text-xs font-bold text-rose-700">
                      ({metrics.percInadimplente.toFixed(1)}% do total)
                    </span>
                  </div>
                  <div className="text-xs text-rose-700 mt-1 font-bold flex items-center gap-1">
                    <span>Montante em atraso: {formatCurrency(metrics.totalValorAtrasado)}</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Total Recebido na Afiliação */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-slate-300 transition-all shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Recebido (Liquidado)
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <DollarSign size={18} />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xl font-bold text-emerald-600">
                    {formatCurrency(metrics.totalValorRecebido)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Receita consolidada de mensalidades
                  </div>
                </div>
              </div>

              {/* Card 4: A Receber no Prazo */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-slate-300 transition-all shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    A Vencer no Prazo
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Clock size={18} />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xl font-bold text-blue-600">
                    {formatCurrency(metrics.totalValorAberto)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {metrics.qtdParcelasAbertas} parcela(s) futuras a receber
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Barra Inferior de Ações e Filtros Rápidos */}
          {onApplyFilter && (
            <div className="pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 bg-white/70 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Filter size={14} className="text-indigo-600" />
                <span className="font-semibold">Filtros Rápidos para a Tabela:</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onApplyFilter(CENTRO_CUSTO_AFILIACAO, "Todos status")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    isFilteredByAfiliacao && currentStatusFilter === "Todos status"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                  }`}
                >
                  Filtrar Todas de Afiliação
                </button>

                <button
                  type="button"
                  onClick={() => onApplyFilter(CENTRO_CUSTO_AFILIACAO, "Atrasado")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    isFilteredByAfiliacao && currentStatusFilter === "Atrasado"
                      ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                      : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                  }`}
                >
                  Ver Apenas Atrasadas ({metrics.qtdParcelasAtrasadas})
                </button>

                <button
                  type="button"
                  onClick={() => onApplyFilter(CENTRO_CUSTO_AFILIACAO, "Recebido")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    isFilteredByAfiliacao && currentStatusFilter === "Recebido"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  Ver Apenas Recebidas ({metrics.qtdParcelasRecebidas})
                </button>

                <button
                  type="button"
                  onClick={() => onApplyFilter(CENTRO_CUSTO_AFILIACAO, "Aberto (A Receber)")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    isFilteredByAfiliacao && currentStatusFilter === "Aberto (A Receber)"
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                  }`}
                >
                  Ver Apenas Abertas ({metrics.qtdParcelasAbertas})
                </button>

                {(currentCentroCustoFilter !== "Todos centros de custo" || currentStatusFilter !== "Todos status") && (
                  <button
                    type="button"
                    onClick={() => onApplyFilter("Todos centros de custo", "Todos status")}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
                    title="Limpar filtros"
                  >
                    Restaurar Filtros
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
