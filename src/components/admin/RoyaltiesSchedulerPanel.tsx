import React, { useState, useEffect } from "react";
import {
  Calendar,
  Coins,
  TrendingUp,
  Layers,
  Clock,
  Play,
  Settings,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  FileText,
  DollarSign,
  Printer,
  ChevronRight,
  ShieldCheck,
  Building2,
  Sparkles,
  ArrowUpRight,
  Receipt,
  Eye,
  Check,
  X,
  Save,
  AlertTriangle,
} from "lucide-react";
import {
  RoyaltyScheduleConfig,
  FranqueadaMonthlySummary,
  RoyaltyBillingRecord,
  getRoyaltyScheduleConfig,
  saveRoyaltyScheduleConfig,
  apurarFaturamentoMensalFranqueadas,
  processarCobrancasMensaisRoyalties,
  executarVerificacaoAgendadorRoyalties,
  atualizarStatusCobrancaRoyalty,
  getPreviousMonthCompetencia,
  getCurrentMonthCompetencia,
} from "../../services/royaltiesSchedulerService";
import toast from "react-hot-toast";

interface RoyaltiesSchedulerPanelProps {
  onRefreshParent?: () => void;
}

export default function RoyaltiesSchedulerPanel({ onRefreshParent }: RoyaltiesSchedulerPanelProps) {
  // Estado da Competência Selecionada (ex: "2025-05")
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>(
    getPreviousMonthCompetencia()
  );

  const [config, setConfig] = useState<RoyaltyScheduleConfig | null>(null);
  const [summaries, setSummaries] = useState<FranqueadaMonthlySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Modais
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configForm, setConfigForm] = useState<RoyaltyScheduleConfig | null>(null);

  const [selectedSummaryForOrders, setSelectedSummaryForOrders] = useState<FranqueadaMonthlySummary | null>(null);
  const [selectedSummaryForPrint, setSelectedSummaryForPrint] = useState<FranqueadaMonthlySummary | null>(null);

  // Filtros da tabela
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");

  // Carrega configuração e apura dados do mês selecionado
  const loadData = async (comp: string = selectedCompetencia) => {
    setLoading(true);
    try {
      const [cfg, sum] = await Promise.all([
        getRoyaltyScheduleConfig(),
        apurarFaturamentoMensalFranqueadas(comp),
      ]);
      setConfig(cfg);
      setConfigForm(cfg);
      setSummaries(sum);
    } catch (error) {
      console.error("Erro ao carregar apuração de royalties:", error);
      toast.error("Erro ao carregar dados de faturamento e royalties.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedCompetencia);
  }, [selectedCompetencia]);

  // Executa o processamento em lote para todas as franqueadas no mês selecionado
  const handleProcessAll = async () => {
    setIsProcessing(true);
    try {
      const result = await processarCobrancasMensaisRoyalties(selectedCompetencia, {
        actorName: "Administrador Franqueador",
        tipoDisparo: "manual",
      });

      if (result.success) {
        toast.success(
          `Fechamento concluído! ${result.totalFranqueadasProcessadas} franqueadas apuradas. Total faturado: R$ ${result.totalFaturamentoApurado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Royalties: R$ ${result.totalGeralDevido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`
        );
        await loadData(selectedCompetencia);
        if (onRefreshParent) onRefreshParent();
      } else {
        toast.error(result.erro || "Falha ao processar royalties.");
      }
    } catch (error: any) {
      console.error("Erro ao processar royalties:", error);
      toast.error(error?.message || "Erro durante o fechamento mensal.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Executa a verificação do agendador automático
  const handleRunSchedulerCheck = async () => {
    setIsProcessing(true);
    try {
      const check = await executarVerificacaoAgendadorRoyalties("Administrador (Disparo Manual)");
      if (check.executou && check.resultado) {
        toast.success(
          `Agendador executou com sucesso para a competência ${check.resultado.competencia}! ${check.resultado.totalFranqueadasProcessadas} franqueadas faturadas.`
        );
        await loadData(selectedCompetencia);
        if (onRefreshParent) onRefreshParent();
      } else {
        toast(check.motivo || "Nenhuma rotina pendente para execução hoje.", {
          icon: "ℹ️",
        });
      }
    } catch (error) {
      console.error("Erro ao verificar agendador:", error);
      toast.error("Erro ao verificar agendamento.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Salva a configuração do agendamento
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configForm) return;

    setIsSavingConfig(true);
    try {
      await saveRoyaltyScheduleConfig(configForm, "Administrador");
      setConfig(configForm);
      setIsConfigModalOpen(false);
      toast.success("Regras de agendamento e corte de royalties salvas com sucesso!");
      await loadData(selectedCompetencia);
    } catch (error) {
      console.error("Erro ao salvar configuração de royalties:", error);
      toast.error("Erro ao salvar parâmetros de agendamento.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Atualiza status individual (ex: marcar como pago)
  const handleUpdateStatus = async (
    item: FranqueadaMonthlySummary,
    novoStatus: "Pendente" | "Faturado" | "Pago" | "Cancelado"
  ) => {
    if (!item.cobrancaExistenteId) {
      toast.error("Processe primeiro o faturamento desta unidade para gerar a cobrança.");
      return;
    }

    try {
      await atualizarStatusCobrancaRoyalty(item.cobrancaExistenteId, novoStatus, {
        actorName: "Administrador",
      });
      toast.success(`Cobrança de ${item.codigoUnidade} atualizada para ${novoStatus}!`);
      await loadData(selectedCompetencia);
      if (onRefreshParent) onRefreshParent();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status da cobrança.");
    }
  };

  // Métricas do Mês Selecionado
  const totalFaturamentoMes = summaries.reduce((acc, curr) => acc + curr.faturamentoBruto, 0);
  const totalRoyaltiesMes = summaries.reduce((acc, curr) => acc + curr.valorRoyalties, 0);
  const totalFundoPropMes = summaries.reduce((acc, curr) => acc + curr.valorFundoPropaganda, 0);
  const totalDevidoMes = summaries.reduce((acc, curr) => acc + curr.valorTotalDevido, 0);
  const totalPedidosMes = summaries.reduce((acc, curr) => acc + curr.totalPedidos, 0);

  const cobrancasPagas = summaries.filter((s) => s.statusCobranca === "Pago").length;
  const cobrancasFaturadas = summaries.filter((s) => s.statusCobranca === "Faturado" || s.statusCobranca === "Pendente").length;
  const cobrancasNaoGeradas = summaries.filter((s) => s.statusCobranca === "NaoGerada" || !s.statusCobranca).length;

  // Filtragem das Franqueadas
  const filteredSummaries = summaries.filter((item) => {
    const matchSearch =
      item.razaoSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.nomeFantasia.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.codigoUnidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.cnpj.includes(searchTerm);

    const matchStatus =
      statusFilter === "Todos" ||
      (statusFilter === "Pago" && item.statusCobranca === "Pago") ||
      (statusFilter === "Faturado" && (item.statusCobranca === "Faturado" || item.statusCobranca === "Pendente")) ||
      (statusFilter === "NaoGerada" && (item.statusCobranca === "NaoGerada" || !item.statusCobranca));

    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Banner de Controle e Status do Agendador */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-xl border border-slate-700/50 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
                  config?.ativo
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-slate-700 text-slate-300 border-slate-600"
                }`}
              >
                <Clock size={13} />
                {config?.ativo ? "Agendamento Automático Ativo" : "Agendamento Pausado"}
              </span>

              <span className="px-2.5 py-1 bg-slate-800 text-amber-300 border border-slate-700 rounded-full text-xs font-mono">
                Corte: Todo dia {config?.diaFechamento || 1} • Vencimento: Dia {config?.diaVencimento || 10}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Motor de Faturamento Mensal & Royalties
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Apura automaticamente as vendas de cada filial, calcula a incidência contratual de Royalties e Fundo de Propaganda, e gera o faturamento correspondente no Contas a Receber da Matriz.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsConfigModalOpen(true)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Settings size={15} className="text-amber-400" />
              Configurar Regras
            </button>

            <button
              type="button"
              disabled={isProcessing || loading}
              onClick={handleRunSchedulerCheck}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              title="Testa e roda a checagem automática conforme o dia de fechamento"
            >
              <RefreshCw size={15} className={isProcessing ? "animate-spin" : ""} />
              Checar Agendamento
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Seleção de Competência & Botão de Fechamento em Lote */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <Calendar size={16} className="text-slate-500" />
            <label className="text-xs font-bold text-slate-700">Mês de Competência:</label>
            <input
              type="month"
              value={selectedCompetencia}
              onChange={(e) => setSelectedCompetencia(e.target.value)}
              className="bg-white px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCompetencia(getPreviousMonthCompetencia())}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                selectedCompetencia === getPreviousMonthCompetencia()
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
              }`}
            >
              Mês Anterior (Fechado)
            </button>
            <button
              type="button"
              onClick={() => setSelectedCompetencia(getCurrentMonthCompetencia())}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                selectedCompetencia === getCurrentMonthCompetencia()
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
              }`}
            >
              Mês Atual (Em Andamento)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            disabled={isProcessing || loading}
            onClick={handleProcessAll}
            className="w-full md:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
          >
            <Play size={15} fill="currentColor" />
            {isProcessing ? "Processando e Faturando..." : `Processar Fechamento de Todas as Franqueadas (${selectedCompetencia})`}
          </button>
        </div>
      </div>

      {/* Cartões de Indicadores da Competência Selecionada */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Vendas Apuradas ({selectedCompetencia})
            </p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              R$ {totalFaturamentoMes.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {totalPedidosMes} pedidos faturados no mês
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl shrink-0">
            <Coins size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Royalties Devidos à Matriz
            </p>
            <p className="text-2xl font-black text-amber-600 mt-0.5">
              R$ {totalRoyaltiesMes.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Alíquota contratual apurada
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3.5 bg-purple-50 text-purple-600 rounded-2xl shrink-0">
            <Layers size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Fundo de Propaganda
            </p>
            <p className="text-2xl font-black text-purple-600 mt-0.5">
              R$ {totalFundoPropMes.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Marketing Institucional da Rede
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl shrink-0">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total a Cobrar da Rede
            </p>
            <p className="text-2xl font-black text-emerald-600 mt-0.5">
              R$ {totalDevidoMes.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-emerald-700 font-semibold mt-0.5">
              {cobrancasPagas} pagas • {cobrancasFaturadas} em aberto
            </p>
          </div>
        </div>
      </div>

      {/* Tabela Detalhada de Apuração Mensal por Franqueada */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 size={18} className="text-amber-600" />
              Demonstrativo de Faturamento e Cobrança por Franqueada ({selectedCompetencia})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Veja o faturamento de cada unidade no mês, os percentuais contratuais aplicados e o status da fatura gerada.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Buscar unidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 outline-none bg-white"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 outline-none"
            >
              <option value="Todos">Todos os Status</option>
              <option value="Pago">Pagas / Liquidadas</option>
              <option value="Faturado">Faturadas / Pendentes</option>
              <option value="NaoGerada">Ainda Não Faturadas</option>
            </select>

            <button
              type="button"
              onClick={() => loadData(selectedCompetencia)}
              className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
              title="Recarregar apuração"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Unidade / Código</th>
                <th className="px-5 py-3.5 font-semibold">Empresa / CNPJ</th>
                <th className="px-5 py-3.5 font-semibold text-center">Pedidos no Mês</th>
                <th className="px-5 py-3.5 font-semibold text-right">Faturamento Bruto</th>
                <th className="px-5 py-3.5 font-semibold text-right">Taxas (% Roy / Fnd)</th>
                <th className="px-5 py-3.5 font-semibold text-right">Royalties Devidos</th>
                <th className="px-5 py-3.5 font-semibold text-right">Total da Cobrança</th>
                <th className="px-5 py-3.5 font-semibold text-center">Status Fatura</th>
                <th className="px-5 py-3.5 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 3 }).map((_, rIdx) => (
                  <tr key={rIdx} className="animate-pulse">
                    <td colSpan={9} className="px-5 py-4">
                      <div className="h-4 bg-slate-100 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-500">
                    <div className="max-w-md mx-auto space-y-2">
                      <Receipt size={32} className="mx-auto text-slate-300" />
                      <p className="font-semibold text-slate-700">Nenhum faturamento registrado na competência.</p>
                      <p className="text-xs text-slate-400">
                        Não foram encontrados pedidos de venda atribuídos a filiais em {selectedCompetencia}.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSummaries.map((item) => {
                  const isPago = item.statusCobranca === "Pago";
                  const isFaturado = item.statusCobranca === "Faturado" || item.statusCobranca === "Pendente";

                  return (
                    <tr key={item.franqueadaId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-slate-800">
                        <span className="px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200 text-xs">
                          {item.codigoUnidade}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{item.nomeFantasia || item.razaoSocial}</div>
                        <div className="text-xs text-slate-500">{item.cnpj || "Sem CNPJ"}</div>
                      </td>

                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedSummaryForOrders(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                          title="Clique para ver extrato analítico dos pedidos"
                        >
                          <Eye size={13} />
                          {item.totalPedidos} pedido{item.totalPedidos !== 1 ? "s" : ""}
                        </button>
                      </td>

                      <td className="px-5 py-4 text-right font-bold text-slate-900">
                        R$ {item.faturamentoBruto.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="px-5 py-4 text-right text-xs font-medium">
                        <span className="text-amber-700 font-bold">{item.aliquotaRoyalty}%</span> Roy
                        <br />
                        <span className="text-purple-700 font-bold">{item.aliquotaFundoPropaganda}%</span> Fundo
                      </td>

                      <td className="px-5 py-4 text-right font-bold text-amber-600">
                        R$ {item.valorRoyalties.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <div className="text-[11px] text-purple-600 font-normal">
                          + R$ {item.valorFundoPropaganda.toFixed(2)} Fnd
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-black text-slate-900">
                          R$ {item.valorTotalDevido.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {item.dataVencimento && (
                          <div className="text-[10px] text-slate-400">
                            Venc: {new Date(item.dataVencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-center">
                        {isPago ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold">
                            <CheckCircle2 size={12} />
                            Pago / Quitado
                          </span>
                        ) : isFaturado ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[11px] font-bold">
                            <Clock size={12} />
                            Fatura Aberta
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-[11px] font-medium">
                            Não Faturado
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Extrato Analítico */}
                          <button
                            type="button"
                            onClick={() => setSelectedSummaryForOrders(item)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition-colors"
                            title="Ver Extrato de Pedidos que compõem o faturamento"
                          >
                            <FileText size={15} />
                          </button>

                          {/* Imprimir Ficha */}
                          <button
                            type="button"
                            onClick={() => setSelectedSummaryForPrint(item)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition-colors"
                            title="Imprimir Demonstrativo de Royalties"
                          >
                            <Printer size={15} />
                          </button>

                          {/* Ação Liquidar / Marcar como Pago */}
                          {isFaturado && !isPago && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(item, "Pago")}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1"
                              title="Confirmar recebimento / dar baixa no financeiro"
                            >
                              <Check size={13} />
                              Baixa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Configuração de Agendamento Automático */}
      {isConfigModalOpen && configForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Settings size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">
                    Regras de Agendamento & Royalties
                  </h3>
                  <p className="text-xs text-slate-300">
                    Defina datas de corte, vencimento e alíquotas automáticas.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-6 space-y-4 text-xs">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="font-bold text-slate-900 text-sm">Automação de Fechamento</p>
                  <p className="text-slate-500 text-xs">Executar apuração mensal automaticamente no dia do corte</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configForm.ativo}
                    onChange={(e) => setConfigForm((p) => p ? { ...p, ativo: e.target.checked } : null)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Dia do Fechamento / Corte:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={configForm.diaFechamento}
                    onChange={(e) =>
                      setConfigForm((p) => (p ? { ...p, diaFechamento: parseInt(e.target.value) || 1 } : null))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Ex: Todo dia 1º apura o mês anterior</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Dia de Vencimento da Fatura:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={configForm.diaVencimento}
                    onChange={(e) =>
                      setConfigForm((p) => (p ? { ...p, diaVencimento: parseInt(e.target.value) || 10 } : null))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Ex: Vencimento todo dia 10</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Alíquota Padrão Royalties (%):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={configForm.aliquotaPadraoRoyalty}
                    onChange={(e) =>
                      setConfigForm((p) => (p ? { ...p, aliquotaPadraoRoyalty: parseFloat(e.target.value) || 0 } : null))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-amber-700"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Fundo Propaganda Padrão (%):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={configForm.aliquotaPadraoFundoPropaganda}
                    onChange={(e) =>
                      setConfigForm((p) => (p ? { ...p, aliquotaPadraoFundoPropaganda: parseFloat(e.target.value) || 0 } : null))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-purple-700"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="font-bold text-slate-900 text-xs">Lançar no Contas a Receber da Matriz</p>
                  <p className="text-slate-500 text-[11px]">Gera a fatura financeira para controle de recebimento</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configForm.gerarContaReceberAutomaticamente}
                    onChange={(e) =>
                      setConfigForm((p) => (p ? { ...p, gerarContaReceberAutomaticamente: e.target.checked } : null))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2"
                >
                  <Save size={14} />
                  {isSavingConfig ? "Salvando..." : "Salvar Configuração"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Extrato Analítico dos Pedidos do Mês */}
      {selectedSummaryForOrders && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 text-blue-300 rounded-xl border border-blue-500/30">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    Extrato de Pedidos • {selectedSummaryForOrders.codigoUnidade} ({selectedCompetencia})
                  </h3>
                  <p className="text-xs text-slate-300">
                    {selectedSummaryForOrders.nomeFantasia || selectedSummaryForOrders.razaoSocial}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSummaryForOrders(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500">Faturamento Total do Mês:</span>
                <p className="font-black text-slate-900 text-sm">
                  R$ {selectedSummaryForOrders.faturamentoBruto.toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Royalties ({selectedSummaryForOrders.aliquotaRoyalty}%):</span>
                <p className="font-bold text-amber-600 text-sm">
                  R$ {selectedSummaryForOrders.valorRoyalties.toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Fundo Prop. ({selectedSummaryForOrders.aliquotaFundoPropaganda}%):</span>
                <p className="font-bold text-purple-600 text-sm">
                  R$ {selectedSummaryForOrders.valorFundoPropaganda.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {selectedSummaryForOrders.pedidosDetalhados.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Nenhum pedido faturado para esta unidade na competência {selectedCompetencia}.
                </div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="text-slate-500 uppercase bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Nº Pedido</th>
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2 text-center">Status</th>
                      <th className="px-3 py-2 text-right">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedSummaryForOrders.pedidosDetalhados.map((p, idx) => (
                      <tr key={p.id || idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono font-bold text-slate-800">{p.numeroPedido}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {p.data ? new Date(p.data).toLocaleDateString("pt-BR") : "—"}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800">{p.clienteNome}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold">
                            {p.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">
                          R$ {p.valor.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSummaryForOrders(null)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Fechar Extrato
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ficha de Impressão de Demonstrativo de Royalties */}
      {selectedSummaryForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 space-y-4">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Demonstrativo Mensal de Royalties</h3>
                <p className="text-xs text-slate-500">Competência: {selectedCompetencia}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSummaryForPrint(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="text-slate-500">Unidade Franqueada:</p>
                <p className="font-bold text-slate-900 text-sm">
                  {selectedSummaryForPrint.codigoUnidade} • {selectedSummaryForPrint.nomeFantasia || selectedSummaryForPrint.razaoSocial}
                </p>
                <p className="text-slate-500 text-[11px]">CNPJ: {selectedSummaryForPrint.cnpj}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border">
                  <span className="text-slate-500">Faturamento Bruto:</span>
                  <p className="font-bold text-slate-900 text-base">R$ {selectedSummaryForPrint.faturamentoBruto.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border">
                  <span className="text-slate-500">Total de Pedidos:</span>
                  <p className="font-bold text-slate-900 text-base">{selectedSummaryForPrint.totalPedidos}</p>
                </div>
              </div>

              <div className="border rounded-xl p-3 space-y-2 bg-amber-50/50 border-amber-200">
                <div className="flex justify-between">
                  <span>Royalties Contratuais ({selectedSummaryForPrint.aliquotaRoyalty}%):</span>
                  <span className="font-bold text-amber-800">R$ {selectedSummaryForPrint.valorRoyalties.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fundo de Propaganda ({selectedSummaryForPrint.aliquotaFundoPropaganda}%):</span>
                  <span className="font-bold text-purple-800">R$ {selectedSummaryForPrint.valorFundoPropaganda.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-amber-200 flex justify-between text-sm font-black text-slate-900">
                  <span>Total Devido à Matriz:</span>
                  <span className="text-emerald-700">R$ {selectedSummaryForPrint.valorTotalDevido.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setSelectedSummaryForPrint(null)}
                className="px-4 py-2 border rounded-xl text-xs font-medium"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Printer size={14} />
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
