/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, doc, updateDoc, query, orderBy, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import {
  Activity,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Camera,
  PenTool,
  Search,
  Filter,
  Eye,
  FileText,
  UserCheck,
  ShieldCheck,
  Building,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  X,
  ExternalLink,
  ChevronDown,
  Navigation,
  Sparkles,
  Printer
} from "lucide-react";
import { RoutineServiceOrder } from "../../types/serviceExecution";
import {
  computeOrderInternalMetrics,
  formatDateTimeBR,
  formatMinutes,
  formatTimeHM,
  getExecutionStepInfo
} from "../../lib/serviceExecutionUtils";
import { Link } from "react-router-dom";

export default function MonitoriaServicos() {
  const { profile } = useAuth();

  const [ordens, setOrdens] = useState<RoutineServiceOrder[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterColaborador, setFilterColaborador] = useState<string>("todos");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterSla, setFilterSla] = useState<string>("todos");

  // Selected Order for Full Internal Audit Modal
  const [selectedAuditOrder, setSelectedAuditOrder] = useState<RoutineServiceOrder | null>(null);

  // Modal to Assign Collaborator to an OS
  const [orderToAssign, setOrderToAssign] = useState<RoutineServiceOrder | null>(null);
  const [assignColaboradorId, setAssignColaboradorId] = useState<string>("");
  const [assignPrioridade, setAssignPrioridade] = useState<"Normal" | "Urgente" | "Crítica">("Normal");
  const [assignTurno, setAssignTurno] = useState<string>("Manhã (08:00 às 12:00)");
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch colaboradores (empregados)
      const empSnap = await getDocs(collection(db, "empregados"));
      const empList: any[] = [];
      empSnap.docs.forEach((d) => {
        const data = d.data();
        empList.push({ id: d.id, ...data });
      });

      // Also get users with staff roles
      const usersSnap = await getDocs(collection(db, "users"));
      usersSnap.docs.forEach((d) => {
        const u = d.data();
        if (u.role && u.role !== "Cliente" && !empList.some((e) => e.email === u.email)) {
          empList.push({
            id: d.id,
            nome: u.displayName || u.nome || u.email,
            email: u.email,
            cargo: u.role,
            telefone: u.telefone || "",
          });
        }
      });
      setColaboradores(empList);

      // 2. Fetch service orders
      const q = query(collection(db, "ordens_servico"), orderBy("createdAt", "desc"));
      const osSnap = await getDocs(q);
      const osList: RoutineServiceOrder[] = osSnap.docs.map((d) => {
        const data = d.data();
        const fotosAntes = Array.isArray(data.fotosAntes) ? data.fotosAntes : [];
        const fotosDepois = Array.isArray(data.fotosDepois) ? data.fotosDepois : [];

        const orderObj: RoutineServiceOrder = {
          id: d.id,
          status: data.status || "Solicitado o Serviço",
          ...data,
          fotosAntes,
          fotosDepois,
          etapaExecucao: data.etapaExecucao || (data.status === "Serviço Concluído" ? "concluido" : "atribuido"),
        } as RoutineServiceOrder;

        // Recalculate or ensure metrics are fresh
        orderObj.metricasInternas = computeOrderInternalMetrics(orderObj);

        return orderObj;
      });

      setOrdens(osList);
    } catch (err) {
      console.error("Erro ao carregar monitoria interna:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return ordens.filter((o) => {
      // Search
      const searchMatch =
        !searchTerm ||
        (o.numeroOS && o.numeroOS.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.nomeCondominio && o.nomeCondominio.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.clienteNome && o.clienteNome.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.servicoNome && o.servicoNome.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.colaboradorNome && o.colaboradorNome.toLowerCase().includes(searchTerm.toLowerCase()));

      // Colaborador
      const colabMatch =
        filterColaborador === "todos" ||
        o.colaboradorId === filterColaborador ||
        o.colaboradorNome === filterColaborador;

      // Status
      const statusMatch =
        filterStatus === "todos" ||
        (filterStatus === "em_andamento" &&
          !["concluido", "cancelado"].includes(o.etapaExecucao) &&
          o.status !== "Serviço Concluído") ||
        (filterStatus === "concluido" &&
          (o.etapaExecucao === "concluido" || o.status === "Serviço Concluído")) ||
        (filterStatus === "sem_colaborador" && !o.colaboradorId);

      // SLA
      const slaMatch =
        filterSla === "todos" || o.metricasInternas?.slaStatus === filterSla;

      return searchMatch && colabMatch && statusMatch && slaMatch;
    });
  }, [ordens, searchTerm, filterColaborador, filterStatus, filterSla]);

  // Aggregate KPI metrics
  const kpis = useMemo(() => {
    const total = ordens.length;
    const emExecucao = ordens.filter(
      (o) =>
        !["concluido", "cancelado"].includes(o.etapaExecucao) &&
        o.status !== "Serviço Concluído" &&
        o.status !== "Cancelada pelo Cliente"
    );
    const concluidas = ordens.filter(
      (o) => o.etapaExecucao === "concluido" || o.status === "Serviço Concluído"
    );

    // Tempos médios
    let totalDeslocamentoMin = 0;
    let countDeslocamento = 0;
    let totalExecucaoMin = 0;
    let countExecucao = 0;
    let dentroSlaCount = 0;

    concluidas.forEach((o) => {
      if (o.metricasInternas?.tempoDeslocamentoMinutos) {
        totalDeslocamentoMin += o.metricasInternas.tempoDeslocamentoMinutos;
        countDeslocamento++;
      }
      if (o.metricasInternas?.tempoExecucaoMinutos) {
        totalExecucaoMin += o.metricasInternas.tempoExecucaoMinutos;
        countExecucao++;
      }
      if (o.metricasInternas?.slaStatus === "no_prazo") {
        dentroSlaCount++;
      }
    });

    const mediaDeslocamento = countDeslocamento > 0 ? Math.round(totalDeslocamentoMin / countDeslocamento) : 0;
    const mediaExecucao = countExecucao > 0 ? Math.round(totalExecucaoMin / countExecucao) : 0;
    const taxaSla = concluidas.length > 0 ? Math.round((dentroSlaCount / concluidas.length) * 100) : 100;

    return {
      total,
      emExecucaoCount: emExecucao.length,
      concluidasCount: concluidas.length,
      mediaDeslocamento,
      mediaExecucao,
      taxaSla,
    };
  }, [ordens]);

  // Assign Collaborator handler
  const handleConfirmAssign = async () => {
    if (!orderToAssign || !assignColaboradorId) return;
    setIsAssigning(true);

    try {
      const targetColab = colaboradores.find((c) => c.id === assignColaboradorId);
      const nowIso = new Date().toISOString();

      const updates: Partial<RoutineServiceOrder> = {
        colaboradorId: assignColaboradorId,
        colaboradorNome: targetColab?.nome || "Colaborador",
        colaboradorEmail: targetColab?.email || "",
        colaboradorTelefone: targetColab?.telefone || "",
        colaboradorCargo: targetColab?.cargo || "Técnico",
        prioridade: assignPrioridade,
        turnoAgendado: assignTurno,
        designadoEm: nowIso,
        designadoPor: profile?.email || profile?.displayName || "Gestor",
        etapaExecucao: "atribuido",
        status: "Atribuído ao Colaborador",
      };

      await updateDoc(doc(db, "ordens_servico", orderToAssign.id), updates);
      await fetchData();
      setOrderToAssign(null);
    } catch (err) {
      console.error("Erro ao designar colaborador:", err);
      alert("Erro ao designar colaborador.");
    } finally {
      setIsAssigning(false);
    }
  };

  const handlePrintAuditReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Internal Notice */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Activity size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">
                  Central de Monitoria Interna & Auditoria de SLA
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 text-[11px] font-bold">
                  Painel de Gestão
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                Acompanhamento em tempo real dos tempos de deslocamento, vistoria (3 fotos antes/depois), execução e assinaturas dos serviços condominiais.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/execucao-servicos"
            className="px-4 py-2.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors flex items-center gap-2"
          >
            <UserCheck size={16} /> Visão do Colaborador (Execução)
          </Link>
          <button
            type="button"
            onClick={handlePrintAuditReport}
            className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-2"
          >
            <Printer size={16} /> Imprimir Relatório
          </button>
        </div>
      </div>

      {/* KPI Cards Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Ativos em Campo */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Em Execução Agora</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Activity size={16} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{kpis.emExecucaoCount}</h3>
          <p className="text-[11px] text-blue-600 font-medium">Equipes em atendimento ativo</p>
        </div>

        {/* Média Deslocamento */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Tempo Médio Deslocamento</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Navigation size={16} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{formatMinutes(kpis.mediaDeslocamento)}</h3>
          <p className="text-[11px] text-slate-500">Trânsito até o condomínio</p>
        </div>

        {/* Média Execução Técnica */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Tempo Médio Execução</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{formatMinutes(kpis.mediaExecucao)}</h3>
          <p className="text-[11px] text-emerald-600 font-medium">Trabalho técnico no local</p>
        </div>

        {/* Taxa de SLA */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Conformidade SLA</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{kpis.taxaSla}%</h3>
          <p className="text-[11px] text-slate-500">Dentro do prazo previsto</p>
        </div>

        {/* Concluídos */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-2 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Concluídos</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{kpis.concluidasCount}</h3>
          <p className="text-[11px] text-teal-600 font-medium">Com 6 fotos & assinatura</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por Nº da O.S., Condomínio, Serviço ou Colaborador..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Colaborador Filter */}
          <select
            value={filterColaborador}
            onChange={(e) => setFilterColaborador(e.target.value)}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none"
          >
            <option value="todos">Todos os Colaboradores</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome || c.email}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none"
          >
            <option value="todos">Todos os Status</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="concluido">Concluídos</option>
            <option value="sem_colaborador">Sem Colaborador Designado</option>
          </select>

          {/* SLA Filter */}
          <select
            value={filterSla}
            onChange={(e) => setFilterSla(e.target.value)}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none"
          >
            <option value="todos">Todos os SLAs</option>
            <option value="no_prazo">No Prazo (Dentro da Meta)</option>
            <option value="atencao">Atenção (Próximo do Limite)</option>
            <option value="atrasado">Atrasado (Acima do Prazo)</option>
          </select>
        </div>
      </div>

      {/* Main Monitoring Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Layers size={18} className="text-purple-600" />
              Painel Detalhado de Ordens de Serviço & Auditoria de Tempos
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {filteredOrders.length} ordens de serviço rotineiras monitoradas.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center">
            <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mb-2" />
            Carregando monitoria de serviços...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <ShieldCheck size={36} className="text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-600 text-sm">Nenhuma ordem de serviço encontrada com estes filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">O.S. / Condomínio</th>
                  <th className="p-3.5">Colaborador</th>
                  <th className="p-3.5">Etapa / Status</th>
                  <th className="p-3.5 text-center">Deslocamento</th>
                  <th className="p-3.5 text-center">Fotos Antes</th>
                  <th className="p-3.5 text-center">Execução Real</th>
                  <th className="p-3.5 text-center">Fotos Depois</th>
                  <th className="p-3.5 text-center">Assinatura</th>
                  <th className="p-3.5 text-center">SLA</th>
                  <th className="p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredOrders.map((order) => {
                  const stepInfo = getExecutionStepInfo(order.etapaExecucao);
                  const metrics = order.metricasInternas;
                  const hasFotosAntes = (order.fotosAntes?.length || 0) >= 3;
                  const hasFotosDepois = (order.fotosDepois?.length || 0) >= 3;
                  const hasAssinatura = !!order.assinaturaResponsavel?.assinaturaBase64;

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* O.S. / Condomínio */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 text-xs">
                          {order.numeroOS || `OS #${order.id.slice(0, 8)}`}
                        </div>
                        <div className="text-slate-600 font-medium">
                          {order.nomeCondominio || order.clienteNome || "Condomínio"}
                        </div>
                        <div className="text-[10px] text-slate-400">{order.servicoNome || "Serviço"}</div>
                      </td>

                      {/* Colaborador */}
                      <td className="p-3.5">
                        {order.colaboradorNome ? (
                          <div>
                            <span className="font-bold text-slate-800">{order.colaboradorNome}</span>
                            <div className="text-[10px] text-slate-400">{order.colaboradorCargo || "Técnico"}</div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setOrderToAssign(order)}
                            className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-300 rounded-lg text-[10px] font-bold flex items-center gap-1"
                          >
                            <UserCheck size={12} /> Designar
                          </button>
                        )}
                      </td>

                      {/* Etapa */}
                      <td className="p-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${stepInfo.badgeColor}`}>
                          {stepInfo.title}
                        </span>
                      </td>

                      {/* Deslocamento */}
                      <td className="p-3.5 text-center">
                        <span className="font-semibold text-slate-700">
                          {formatMinutes(metrics?.tempoDeslocamentoMinutos)}
                        </span>
                        {order.deslocamentoInicioEm && (
                          <div className="text-[10px] text-slate-400">
                            Saída: {formatTimeHM(order.deslocamentoInicioEm)}
                          </div>
                        )}
                      </td>

                      {/* Fotos Antes */}
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            hasFotosAntes
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <Camera size={11} /> {order.fotosAntes?.length || 0}/3
                        </span>
                      </td>

                      {/* Execução Real */}
                      <td className="p-3.5 text-center">
                        <span className="font-bold text-slate-900">
                          {formatMinutes(metrics?.tempoExecucaoMinutos)}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          Previsto: {order.prazoPrevistoHoras ? `${order.prazoPrevistoHoras}h` : "2h"}
                        </div>
                      </td>

                      {/* Fotos Depois */}
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            hasFotosDepois
                              ? "bg-teal-50 text-teal-700 border border-teal-200"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <Camera size={11} /> {order.fotosDepois?.length || 0}/3
                        </span>
                      </td>

                      {/* Assinatura */}
                      <td className="p-3.5 text-center">
                        {hasAssinatura ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <PenTool size={11} /> {order.assinaturaResponsavel?.cargoOuFuncao || "Assinado"}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">Pendente</span>
                        )}
                      </td>

                      {/* SLA */}
                      <td className="p-3.5 text-center">
                        {metrics?.slaStatus === "no_prazo" ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-full">
                            No Prazo
                          </span>
                        ) : metrics?.slaStatus === "atencao" ? (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-full">
                            Atenção
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold rounded-full">
                            Atrasado
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedAuditOrder(order)}
                          className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-[11px] rounded-lg transition-colors inline-flex items-center gap-1 shadow-sm"
                        >
                          <Eye size={12} /> Raio-X & Auditoria
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL RAIO-X & AUDITORIA COMPLETA DA ORDEM DE SERVIÇO */}
      {selectedAuditOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-400">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold">
                    Relatório de Auditoria & Tempos - {selectedAuditOrder.numeroOS || selectedAuditOrder.id.slice(0, 8)}
                  </h2>
                  <p className="text-xs text-slate-300">
                    {selectedAuditOrder.nomeCondominio || selectedAuditOrder.clienteNome} • {selectedAuditOrder.servicoNome}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAuditOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
              {/* Resumo de SLAs e Métricas de Tempo Internas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tempo Deslocamento</span>
                  <p className="text-base font-bold text-slate-900 mt-0.5">
                    {formatMinutes(selectedAuditOrder.metricasInternas?.tempoDeslocamentoMinutos)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tempo Execução Real</span>
                  <p className="text-base font-bold text-slate-900 mt-0.5">
                    {formatMinutes(selectedAuditOrder.metricasInternas?.tempoExecucaoMinutos)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Ciclo Total Atendimento</span>
                  <p className="text-base font-bold text-slate-900 mt-0.5">
                    {formatMinutes(selectedAuditOrder.metricasInternas?.tempoTotalCicloMinutos)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Diagnóstico SLA</span>
                  <p className="text-base font-bold text-emerald-600 mt-0.5">
                    {selectedAuditOrder.metricasInternas?.slaStatus === "no_prazo" ? "✓ No Prazo" : "Atenção / Desvio"}
                  </p>
                </div>
              </div>

              {/* Linha do Tempo e Timestamps Exatos dos 5 Marcos de Monitoria */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={14} className="text-purple-600" /> Rastreamento dos 5 Marcos Operacionais
                  </h4>
                  <span className="text-[10px] bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full font-bold border border-purple-200">
                    Auditoria Automática Invisível ao Técnico
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                  {/* 1. Recebimento */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-slate-400" />
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">1. Recebimento</span>
                      <CheckCircle2 size={12} className="text-slate-400" />
                    </div>
                    <p className="font-bold text-slate-800 text-xs mt-0.5">
                      {formatDateTimeBR(selectedAuditOrder.recebidoEm || selectedAuditOrder.designadoEm)}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">Designado / Notificado</p>
                  </div>

                  {/* 2. Aceite */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-blue-600 uppercase">2. Aceite</span>
                      <CheckCircle2 size={12} className={selectedAuditOrder.aceitoEm ? "text-blue-500" : "text-slate-300"} />
                    </div>
                    <p className="font-bold text-slate-800 text-xs mt-0.5">
                      {formatDateTimeBR(selectedAuditOrder.aceitoEm || selectedAuditOrder.deslocamentoInicioEm)}
                    </p>
                    <p className="text-[10px] text-blue-600 mt-1">
                      {selectedAuditOrder.metricasInternas?.tempoRecebimentoParaAceiteMinutos !== undefined && selectedAuditOrder.metricasInternas.tempoRecebimentoParaAceiteMinutos > 0
                        ? `Reação: ${formatMinutes(selectedAuditOrder.metricasInternas.tempoRecebimentoParaAceiteMinutos)}`
                        : "Partida iniciada"}
                    </p>
                  </div>

                  {/* 3. Chegada */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-amber-600 uppercase">3. Chegada</span>
                      <CheckCircle2 size={12} className={selectedAuditOrder.chegadaEm ? "text-amber-500" : "text-slate-300"} />
                    </div>
                    <p className="font-bold text-slate-800 text-xs mt-0.5">
                      {formatDateTimeBR(selectedAuditOrder.chegadaEm)}
                    </p>
                    <p className="text-[10px] text-amber-600 mt-1">
                      {selectedAuditOrder.metricasInternas?.tempoDeslocamentoMinutos !== undefined && selectedAuditOrder.metricasInternas.tempoDeslocamentoMinutos > 0
                        ? `Trânsito: ${formatMinutes(selectedAuditOrder.metricasInternas.tempoDeslocamentoMinutos)}`
                        : selectedAuditOrder.chegadaLocalizacao ? "GPS Confirmado" : "No condomínio"}
                    </p>
                  </div>

                  {/* 4. Início */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500" />
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-indigo-600 uppercase">4. Início</span>
                      <CheckCircle2 size={12} className={selectedAuditOrder.inicioTrabalhoEm ? "text-indigo-500" : "text-slate-300"} />
                    </div>
                    <p className="font-bold text-slate-800 text-xs mt-0.5">
                      {formatDateTimeBR(selectedAuditOrder.inicioTrabalhoEm)}
                    </p>
                    <p className="text-[10px] text-indigo-600 mt-1 font-semibold">
                      {selectedAuditOrder.fotosAntes?.length || 0}/3 fotos preliminares
                    </p>
                  </div>

                  {/* 5. Conclusão */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">5. Conclusão</span>
                      <CheckCircle2 size={12} className={selectedAuditOrder.concluidoEm ? "text-emerald-500" : "text-slate-300"} />
                    </div>
                    <p className="font-bold text-slate-800 text-xs mt-0.5">
                      {formatDateTimeBR(selectedAuditOrder.concluidoEm || selectedAuditOrder.assinaturaEm)}
                    </p>
                    <p className="text-[10px] text-emerald-600 mt-1 font-semibold">
                      {selectedAuditOrder.fotosDepois?.length || 0}/3 fotos + Assinatura
                    </p>
                  </div>
                </div>
              </div>

              {/* Galeria de Fotos Antes vs Fotos Depois */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera size={14} className="text-blue-600" />
                  Evidências Fotográficas (3 Fotos Antes vs 3 Fotos Depois)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bloco Fotos Antes */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                      <Camera size={14} /> Fotos ANTES da Execução ({selectedAuditOrder.fotosAntes?.length || 0})
                    </span>

                    <div className="grid grid-cols-3 gap-2">
                      {selectedAuditOrder.fotosAntes?.map((photo, i) => (
                        <div key={i} className="aspect-square rounded-lg overflow-hidden border border-slate-200 bg-black">
                          <img
                            src={photo.url}
                            alt={photo.legenda || `Foto ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bloco Fotos Depois */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-teal-800 flex items-center gap-1.5">
                      <Camera size={14} /> Fotos APÓS a Conclusão ({selectedAuditOrder.fotosDepois?.length || 0})
                    </span>

                    <div className="grid grid-cols-3 gap-2">
                      {selectedAuditOrder.fotosDepois?.map((photo, i) => (
                        <div key={i} className="aspect-square rounded-lg overflow-hidden border border-slate-200 bg-black">
                          <img
                            src={photo.url}
                            alt={photo.legenda || `Foto ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Termo e Assinatura Digital do Responsável */}
              {selectedAuditOrder.assinaturaResponsavel && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <PenTool size={14} className="text-indigo-600" />
                    Termo de Ciência & Assinatura Digital do Responsável
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div className="text-xs space-y-1">
                      <p>
                        <strong>Nome do Responsável:</strong> {selectedAuditOrder.assinaturaResponsavel.nome}
                      </p>
                      <p>
                        <strong>Cargo / Função:</strong> {selectedAuditOrder.assinaturaResponsavel.cargoOuFuncao}
                      </p>
                      <p>
                        <strong>Documento (CPF/RG):</strong> {selectedAuditOrder.assinaturaResponsavel.documento}
                      </p>
                      {selectedAuditOrder.assinaturaResponsavel.telefone && (
                        <p>
                          <strong>Contato:</strong> {selectedAuditOrder.assinaturaResponsavel.telefone}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-500 pt-1">
                        Assinado digitalmente em {formatDateTimeBR(selectedAuditOrder.assinaturaResponsavel.assinadoEm)}
                      </p>
                    </div>

                    <div className="border border-slate-300 rounded-xl p-2 bg-white flex flex-col items-center">
                      <img
                        src={selectedAuditOrder.assinaturaResponsavel.assinaturaBase64}
                        alt="Assinatura Digital"
                        className="max-h-24 object-contain"
                      />
                      <span className="text-[10px] text-slate-400 mt-1 border-t border-slate-200 w-full text-center pt-1">
                        Carimbo de Autenticidade Digital
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAuditOrder(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition-all"
              >
                Fechar Raio-X
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DESIGNAÇÃO DE COLABORADOR */}
      {orderToAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Designar Colaborador</h3>
                <p className="text-xs text-slate-500">
                  {orderToAssign.numeroOS || `OS #${orderToAssign.id.slice(0, 8)}`} • {orderToAssign.nomeCondominio}
                </p>
              </div>
              <button onClick={() => setOrderToAssign(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Selecione o Colaborador / Técnico *
                </label>
                <select
                  value={assignColaboradorId}
                  onChange={(e) => setAssignColaboradorId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none bg-white font-medium"
                >
                  <option value="">Selecione...</option>
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome || c.email} ({c.cargo || "Técnico"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Turno Agendado</label>
                <select
                  value={assignTurno}
                  onChange={(e) => setAssignTurno(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none bg-white font-medium"
                >
                  <option value="Manhã (08:00 às 12:00)">Manhã (08:00 às 12:00)</option>
                  <option value="Tarde (13:00 às 17:00)">Tarde (13:00 às 17:00)</option>
                  <option value="Comercial (08:00 às 18:00)">Comercial (08:00 às 18:00)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Prioridade na Fila</label>
                <select
                  value={assignPrioridade}
                  onChange={(e) => setAssignPrioridade(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none bg-white font-medium"
                >
                  <option value="Normal">Normal</option>
                  <option value="Urgente">Urgente</option>
                  <option value="Crítica">Crítica</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOrderToAssign(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmAssign}
                disabled={!assignColaboradorId || isAssigning}
                className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl shadow-md"
              >
                {isAssigning ? "Designando..." : "Confirmar Designação"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
