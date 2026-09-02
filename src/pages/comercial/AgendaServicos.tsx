/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import {
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarCheck,
  Clock,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Building,
  User,
  Phone,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Play,
  Navigation,
  FileText,
  FileDown,
  Eye,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  SlidersHorizontal,
  Layers,
  Send,
  X,
  Plus,
  RefreshCw,
} from "lucide-react";
import { exportOrdemServicoPdf } from "../../lib/pdfExport";
import {
  RoutineServiceOrder,
  ServiceExecutionStep,
  computeOrderInternalMetrics,
} from "../../types/serviceExecution";
import { formatDateBR, formatDateTimeBR } from "../../lib/dateUtils";
import {
  StandardOSStatus,
  STANDARD_OS_STEPS,
  normalizeOSStatus,
  getEffectiveOSStatus,
  appendStatusHistory,
  getOSStatusVisualInfo,
  isOSPendingInitialConfirmation,
  sanitizeFirestorePayload,
} from "../../lib/serviceStatusWorkflow";
import ServiceTrackingTimeline from "../../components/servicos/ServiceTrackingTimeline";
import ServiceReportModal from "../../components/servicos/ServiceReportModal";
import { logAction } from "../../lib/audit";

// Turnos disponíveis para agendamento
const TURNOS_AGENDAMENTO = [
  { id: "Manhã (08:00 às 12:00)", label: "Manhã (08:00 às 12:00)", short: "Manhã" },
  { id: "Tarde (13:00 às 18:00)", label: "Tarde (13:00 às 18:00)", short: "Tarde" },
  { id: "Comercial (08:00 às 18:00)", label: "Comercial (08:00 às 18:00)", short: "Comercial" },
  { id: "Plantão / Noturno", label: "Plantão / Noturno", short: "Plantão" },
];

export default function AgendaServicos() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // State: Orders & Users
  const [ordens, setOrdens] = useState<RoutineServiceOrder[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  // Modals & Active selections
  const [selectedOrderForReport, setSelectedOrderForReport] = useState<RoutineServiceOrder | null>(null);
  const [selectedOrderForTimeline, setSelectedOrderForTimeline] = useState<RoutineServiceOrder | null>(null);
  const [orderToAdjustDate, setOrderToAdjustDate] = useState<RoutineServiceOrder | null>(null);

  // Date Adjustment Modal state
  const [modalSelectedDate, setModalSelectedDate] = useState<string>("");
  const [modalSelectedTurno, setModalSelectedTurno] = useState<string>("Manhã (08:00 às 12:00)");
  const [modalObservacoes, setModalObservacoes] = useState<string>("");
  const [modalCalendarDate, setModalCalendarDate] = useState<Date>(new Date());
  const [isSubmittingDate, setIsSubmittingDate] = useState<boolean>(false);
  const [modalFeedback, setModalFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Calendar State (Top View)
  const todayStr = useMemo(() => new Date().toISOString().substring(0, 10), []);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState<Date>(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(todayStr);
  const [dateFilterMode, setDateFilterMode] = useState<"selected_day" | "today_only" | "overdue_only" | "all">("selected_day");

  // Grid Filters
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedColaboradorFilter, setSelectedColaboradorFilter] = useState<string>("todos");
  const [selectedTurnoFilter, setSelectedTurnoFilter] = useState<string>("todos");

  // Load Realtime Service Orders
  useEffect(() => {
    let unsubscribe: () => void;

    try {
      const q = query(collection(db, "ordens_servico"), orderBy("createdAt", "desc"));
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: RoutineServiceOrder[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              ...data,
            } as RoutineServiceOrder);
          });
          setOrdens(list);
          setLoading(false);
        },
        async (error) => {
          console.warn("Snapshot ordens_servico indisponível, tentando fallback getDocs:", error);
          try {
            const snap = await getDocs(collection(db, "ordens_servico"));
            const list: RoutineServiceOrder[] = [];
            snap.forEach((d) => {
              list.push({ id: d.id, ...d.data() } as RoutineServiceOrder);
            });
            setOrdens(list);
          } catch (e) {
            console.error("Erro ao buscar ordens:", e);
          } finally {
            setLoading(false);
          }
        }
      );
    } catch (err) {
      console.error("Erro ao inicializar listener de ordens:", err);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Load Collaborators / Technicians
  useEffect(() => {
    const fetchColaboradores = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const list: any[] = [];
        snap.forEach((d) => {
          const u = d.data();
          const role = (u.role || "").toLowerCase();
          if (
            role.includes("prestador") ||
            role.includes("técnico") ||
            role.includes("tecnico") ||
            role.includes("comercial") ||
            role.includes("admin")
          ) {
            list.push({ id: d.id, ...u });
          }
        });
        setColaboradores(list);
      } catch (err) {
        console.warn("Erro ao carregar colaboradores:", err);
      }
    };
    fetchColaboradores();
  }, []);

  // Helper to extract effective target date of an order (YYYY-MM-DD)
  const getOrderTargetDateStr = useCallback((o: RoutineServiceOrder): string => {
    const raw = o.dataConfirmada || o.dataAgendada || o.dataPreferencial || (o.createdAt as string) || "";
    if (!raw) return "";
    if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return raw.substring(0, 10);
    }
    try {
      const parsed = new Date(raw);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().substring(0, 10);
      }
    } catch {
      // ignore
    }
    return "";
  }, []);

  // Check if an order is overdue / pending previous date (< Today & not completed)
  const isOrderOverdue = useCallback(
    (o: RoutineServiceOrder): boolean => {
      const eff = getEffectiveOSStatus(o);
      if (eff === "Serviço Concluído" || eff === "Cancelada pelo Cliente" || eff === "Cancelado") {
        return false;
      }
      const orderDate = getOrderTargetDateStr(o);
      if (!orderDate) return false;
      return orderDate < todayStr;
    },
    [getOrderTargetDateStr, todayStr]
  );

  // Check if an order is scheduled for today
  const isOrderToday = useCallback(
    (o: RoutineServiceOrder): boolean => {
      const orderDate = getOrderTargetDateStr(o);
      return orderDate === todayStr;
    },
    [getOrderTargetDateStr, todayStr]
  );

  // Map of orders by date for quick calendar badges
  const ordersByDateMap = useMemo(() => {
    const map = new Map<string, RoutineServiceOrder[]>();
    ordens.forEach((o) => {
      const d = getOrderTargetDateStr(o);
      if (d) {
        const existing = map.get(d) || [];
        existing.push(o);
        map.set(d, existing);
      }
    });
    return map;
  }, [ordens, getOrderTargetDateStr]);

  // Overall Operational KPIs
  const kpis = useMemo(() => {
    let todayTotal = 0;
    let todayDone = 0;
    let overdueBacklog = 0;
    let pendingConfirmation = 0;
    let inExecution = 0;
    let totalCompleted = 0;

    ordens.forEach((o) => {
      const eff = getEffectiveOSStatus(o);
      const isDone = eff === "Serviço Concluído" || o.etapaExecucao === "concluido";
      const isOverdue = isOrderOverdue(o);
      const isToday = isOrderToday(o);

      if (isToday) {
        todayTotal++;
        if (isDone) todayDone++;
      }
      if (isOverdue) {
        overdueBacklog++;
      }
      if (eff === "Confirmação de Data" || isOSPendingInitialConfirmation(o.status)) {
        pendingConfirmation++;
      }
      if (eff === "Técnico a caminho" || eff === "Em execução") {
        inExecution++;
      }
      if (isDone) {
        totalCompleted++;
      }
    });

    return {
      todayTotal,
      todayDone,
      overdueBacklog,
      pendingConfirmation,
      inExecution,
      totalCompleted,
      totalOrders: ordens.length,
    };
  }, [ordens, isOrderOverdue, isOrderToday]);

  // Filtered Orders for the Grid
  const filteredOrders = useMemo(() => {
    return ordens.filter((o) => {
      const eff = getEffectiveOSStatus(o);
      const orderDate = getOrderTargetDateStr(o);
      const isOverdue = isOrderOverdue(o);
      const isToday = isOrderToday(o);

      // 1. Date Filter Mode
      if (dateFilterMode === "today_only") {
        if (!isToday) return false;
      } else if (dateFilterMode === "overdue_only") {
        if (!isOverdue) return false;
      } else if (dateFilterMode === "selected_day") {
        if (selectedCalendarDate && orderDate !== selectedCalendarDate) {
          return false;
        }
      }

      // 2. Status Tab Filter
      if (selectedStatusTab !== "todos") {
        if (selectedStatusTab === "pendentes_confirmacao") {
          if (eff !== "Confirmação de Data" && !isOSPendingInitialConfirmation(o.status)) {
            return false;
          }
        } else if (selectedStatusTab === "confirmadas") {
          if (eff !== "Data confirmada" && eff !== "Dia de Execução Serviço") {
            return false;
          }
        } else if (selectedStatusTab === "em_andamento") {
          if (eff !== "Técnico a caminho" && eff !== "Em execução") {
            return false;
          }
        } else if (selectedStatusTab === "concluidas") {
          if (eff !== "Serviço Concluído" && o.etapaExecucao !== "concluido") {
            return false;
          }
        } else if (selectedStatusTab === "canceladas") {
          if (eff !== "Cancelada pelo Cliente" && eff !== "Cancelado") {
            return false;
          }
        } else if (eff !== selectedStatusTab) {
          return false;
        }
      }

      // 3. Collaborator Filter
      if (selectedColaboradorFilter !== "todos") {
        if (selectedColaboradorFilter === "nao_atribuido") {
          if (o.colaboradorId || o.colaboradorNome) return false;
        } else if (o.colaboradorId !== selectedColaboradorFilter && o.colaboradorNome !== selectedColaboradorFilter) {
          return false;
        }
      }

      // 4. Turno Filter
      if (selectedTurnoFilter !== "todos") {
        if (!o.turnoAgendado || !o.turnoAgendado.includes(selectedTurnoFilter)) {
          return false;
        }
      }

      // 5. Text Search Filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const numOS = (o.numeroOS || "").toLowerCase();
        const id = (o.id || "").toLowerCase();
        const cond = (o.nomeCondominio || o.clienteNome || "").toLowerCase();
        const serv = (o.servicoNome || "").toLowerCase();
        const end = (o.enderecoCondominio || "").toLowerCase();
        const colab = (o.colaboradorNome || "").toLowerCase();
        const statusStr = eff.toLowerCase();

        const matches =
          numOS.includes(term) ||
          id.includes(term) ||
          cond.includes(term) ||
          serv.includes(term) ||
          end.includes(term) ||
          colab.includes(term) ||
          statusStr.includes(term);

        if (!matches) return false;
      }

      return true;
    });
  }, [
    ordens,
    dateFilterMode,
    selectedCalendarDate,
    selectedStatusTab,
    selectedColaboradorFilter,
    selectedTurnoFilter,
    searchTerm,
    getOrderTargetDateStr,
    isOrderOverdue,
    isOrderToday,
  ]);

  // Calendar Day Generation for Current Month
  const calendarDays = useMemo(() => {
    const year = currentCalendarMonth.getFullYear();
    const month = currentCalendarMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: {
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      orders: RoutineServiceOrder[];
      hasOverdue: boolean;
      hasActive: boolean;
      hasPendingConfirm: boolean;
    }[] = [];

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, d);
      const dateStr = prevDate.toISOString().substring(0, 10);
      const orders = ordersByDateMap.get(dateStr) || [];
      const hasOverdue = orders.some((o) => isOrderOverdue(o));
      const hasActive = orders.some((o) => ["Técnico a caminho", "Em execução"].includes(getEffectiveOSStatus(o)));
      const hasPendingConfirm = orders.some((o) => isOSPendingInitialConfirmation(o.status));

      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedCalendarDate,
        orders,
        hasOverdue,
        hasActive,
        hasPendingConfirm,
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const curDate = new Date(year, month, d);
      // Format manual YYYY-MM-DD to avoid timezone shifts
      const mm = String(month + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      const dateStr = `${year}-${mm}-${dd}`;
      const orders = ordersByDateMap.get(dateStr) || [];
      const hasOverdue = orders.some((o) => isOrderOverdue(o));
      const hasActive = orders.some((o) => ["Técnico a caminho", "Em execução"].includes(getEffectiveOSStatus(o)));
      const hasPendingConfirm = orders.some((o) => isOSPendingInitialConfirmation(o.status));

      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedCalendarDate,
        orders,
        hasOverdue,
        hasActive,
        hasPendingConfirm,
      });
    }

    // Next month padding to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      const dateStr = nextDate.toISOString().substring(0, 10);
      const orders = ordersByDateMap.get(dateStr) || [];
      const hasOverdue = orders.some((o) => isOrderOverdue(o));
      const hasActive = orders.some((o) => ["Técnico a caminho", "Em execução"].includes(getEffectiveOSStatus(o)));
      const hasPendingConfirm = orders.some((o) => isOSPendingInitialConfirmation(o.status));

      days.push({
        dateStr,
        dayNum: i,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedCalendarDate,
        orders,
        hasOverdue,
        hasActive,
        hasPendingConfirm,
      });
    }

    return days;
  }, [currentCalendarMonth, ordersByDateMap, todayStr, selectedCalendarDate, isOrderOverdue]);

  // Handle Month Changes
  const handlePrevMonth = () => {
    setCurrentCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const handleJumpToToday = () => {
    const now = new Date();
    setCurrentCalendarMonth(now);
    setSelectedCalendarDate(todayStr);
    setDateFilterMode("selected_day");
  };

  // Open Date Confirmation / Adjustment Modal
  const handleOpenDateModal = (order: RoutineServiceOrder) => {
    setOrderToAdjustDate(order);
    setModalFeedback(null);

    const initialDate = getOrderTargetDateStr(order) || todayStr;
    setModalSelectedDate(initialDate);
    setModalSelectedTurno(order.turnoAgendado || "Manhã (08:00 às 12:00)");
    setModalObservacoes(order.observacoesAgendamento || "");

    const [y, m, d] = initialDate.split("-").map(Number);
    if (y && m) {
      setModalCalendarDate(new Date(y, m - 1, d || 1));
    } else {
      setModalCalendarDate(new Date());
    }
  };

  // Save Date Confirmation / Adjustment
  const handleSaveDateModal = async (acceptAndStartToday: boolean = false) => {
    if (!orderToAdjustDate) return;
    if (!modalSelectedDate) {
      setModalFeedback({ type: "error", text: "Por favor, selecione uma data válida no calendário." });
      return;
    }

    setIsSubmittingDate(true);
    setModalFeedback(null);

    try {
      const docRef = doc(db, "ordens_servico", orderToAdjustDate.id);
      const isAltered = modalSelectedDate !== getOrderTargetDateStr(orderToAdjustDate);
      const isTodayTarget = modalSelectedDate === todayStr;

      // Determine next status
      let nextStatus: StandardOSStatus = isTodayTarget ? "Dia de Execução Serviço" : "Data confirmada";
      if (acceptAndStartToday) {
        nextStatus = "Técnico a caminho";
      }

      const userName = profile?.displayName || profile?.email || "Colaborador Comercial";
      const nowIso = new Date().toISOString();

      const scheduleLogEntry = {
        dataDefinida: modalSelectedDate,
        turno: modalSelectedTurno,
        observacao: modalObservacoes.trim(),
        alterada: isAltered,
        confirmadoPor: userName,
        dataHora: nowIso,
      };

      const existingHistory = Array.isArray(orderToAdjustDate.historicoAgendamento)
        ? orderToAdjustDate.historicoAgendamento
        : [];

      const rawUpdates: Partial<RoutineServiceOrder> = {
        dataConfirmada: modalSelectedDate,
        dataAgendada: modalSelectedDate,
        turnoAgendado: modalSelectedTurno,
        observacoesAgendamento: modalObservacoes.trim(),
        dataAlteradaPorAdmin: isAltered,
        agendamentoAtualizadoEm: nowIso,
        agendamentoConfirmadoPor: userName,
        historicoAgendamento: [...existingHistory, scheduleLogEntry] as any,
      };

      if (acceptAndStartToday) {
        rawUpdates.colaboradorId = profile?.uid || orderToAdjustDate.colaboradorId;
        rawUpdates.colaboradorNome = userName;
        rawUpdates.colaboradorEmail = profile?.email || "";
        rawUpdates.aceitoEm = nowIso;
        rawUpdates.deslocamentoInicioEm = nowIso;
        rawUpdates.etapaExecucao = "deslocamento";
      }

      const updatePayload = appendStatusHistory(
        orderToAdjustDate,
        nextStatus,
        `Data de execução confirmada para ${formatDateBR(modalSelectedDate)} (${modalSelectedTurno}).${
          modalObservacoes ? ` Obs: ${modalObservacoes.trim()}` : ""
        }${acceptAndStartToday ? " — Ordem aceita e deslocamento iniciado." : ""}`,
        userName,
        rawUpdates
      );

      await updateDoc(docRef, updatePayload);

      await logAction(
        `Agenda OS #${(orderToAdjustDate.numeroOS || orderToAdjustDate.id).slice(0, 8)}: data confirmada para ${modalSelectedDate}`,
        "Comercial",
        { orderId: orderToAdjustDate.id, data: modalSelectedDate, turno: modalSelectedTurno }
      );

      setModalFeedback({
        type: "success",
        text: `Data de execução confirmada com sucesso para ${formatDateBR(modalSelectedDate)}!`,
      });

      setTimeout(() => {
        setOrderToAdjustDate(null);
        if (acceptAndStartToday) {
          navigate("/admin/prestador-servicos");
        }
      }, 1000);
    } catch (err: any) {
      console.error("Erro ao salvar data da ordem:", err);
      setModalFeedback({
        type: "error",
        text: "Erro ao salvar agendamento: " + (err.message || "Tente novamente."),
      });
    } finally {
      setIsSubmittingDate(false);
    }
  };

  // Direct Accept Order (Assign to Logged Collaborator)
  const handleAcceptOrder = async (order: RoutineServiceOrder) => {
    try {
      const docRef = doc(db, "ordens_servico", order.id);
      const userName = profile?.displayName || profile?.email || "Técnico";
      const nowIso = new Date().toISOString();
      const isTodayTarget = getOrderTargetDateStr(order) === todayStr;

      const nextStatus: StandardOSStatus = isTodayTarget ? "Dia de Execução Serviço" : "Data confirmada";

      const rawUpdates: Partial<RoutineServiceOrder> = {
        colaboradorId: profile?.uid || "",
        colaboradorNome: userName,
        colaboradorEmail: profile?.email || "",
        aceitoEm: nowIso,
      };

      const updatePayload = appendStatusHistory(
        order,
        nextStatus,
        `Ordem de serviço aceita pelo colaborador/técnico ${userName}.`,
        userName,
        rawUpdates
      );

      await updateDoc(docRef, updatePayload);
      await logAction(`OS #${order.id.slice(0, 6)} aceita por ${userName}`, "Comercial");
    } catch (err) {
      console.error("Erro ao aceitar ordem:", err);
      alert("Erro ao aceitar ordem de serviço.");
    }
  };

  // Direct Start Service (Ready to Execute Today or Past Uncompleted Service)
  const handleStartService = async (order: RoutineServiceOrder) => {
    try {
      const docRef = doc(db, "ordens_servico", order.id);
      const userName = profile?.displayName || profile?.email || "Técnico";
      const nowIso = new Date().toISOString();

      const rawUpdates: Partial<RoutineServiceOrder> = {
        colaboradorId: profile?.uid || order.colaboradorId || "",
        colaboradorNome: userName,
        colaboradorEmail: profile?.email || order.colaboradorEmail || "",
        aceitoEm: order.aceitoEm || nowIso,
        deslocamentoInicioEm: nowIso,
        etapaExecucao: "deslocamento",
        status: "Técnico a caminho",
      };

      const updatePayload = appendStatusHistory(
        order,
        "Técnico a caminho",
        `Técnico iniciou deslocamento para execução do serviço (${
          isOrderOverdue(order) ? "atendimento de pendência anterior" : "atendimento do dia"
        }).`,
        userName,
        rawUpdates
      );

      await updateDoc(docRef, updatePayload);
      navigate("/admin/prestador-servicos");
    } catch (err) {
      console.error("Erro ao iniciar serviço:", err);
      alert("Erro ao iniciar serviço.");
    }
  };

  // Direct Download PDF
  const handleDirectDownloadPdf = async (order: RoutineServiceOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDownloadingPdfId(order.id);
      await exportOrdemServicoPdf(order);
    } catch (err) {
      console.error("Erro ao gerar PDF da O.S.:", err);
      alert("Não foi possível gerar o PDF da Ordem de Serviço no momento.");
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      
      {/* Top Header Banner */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-xs sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold shadow-xs">
              <CalendarDays size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900">Agenda de Serviços</h1>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold uppercase border border-blue-200">
                  Comercial & Operação
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Calendário integrado de visitas, confirmação de datas e execução de serviços diários e pendências anteriores.
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleJumpToToday}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <CalendarCheck size={14} /> Ir para Hoje ({formatDateBR(todayStr)})
            </button>

            <Link
              to="/admin/prestador-servicos"
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Wrench size={14} /> Painel de Execução em Campo
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">

        {/* 1. TOP OPERATIONAL KPI CARDS */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Card 1: Serviços de Hoje */}
          <button
            type="button"
            onClick={() => {
              setDateFilterMode("today_only");
              setSelectedStatusTab("todos");
            }}
            className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
              dateFilterMode === "today_only"
                ? "bg-blue-600 border-blue-600 text-white ring-2 ring-blue-300 shadow-md"
                : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${dateFilterMode === "today_only" ? "text-blue-100" : "text-slate-500"}`}>
                Serviços de Hoje
              </span>
              <CalendarCheck size={16} className={dateFilterMode === "today_only" ? "text-white" : "text-blue-600"} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black">{kpis.todayTotal}</span>
              <span className={`text-xs ${dateFilterMode === "today_only" ? "text-blue-100" : "text-slate-400"}`}>
                ({kpis.todayDone} concluídos)
              </span>
            </div>
            <p className={`text-[10px] mt-1 ${dateFilterMode === "today_only" ? "text-blue-100" : "text-slate-400"}`}>
              {formatDateBR(todayStr)}
            </p>
          </button>

          {/* Card 2: Pendências Anteriores (< Hoje) */}
          <button
            type="button"
            onClick={() => {
              setDateFilterMode("overdue_only");
              setSelectedStatusTab("todos");
            }}
            className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
              dateFilterMode === "overdue_only"
                ? "bg-rose-600 border-rose-600 text-white ring-2 ring-rose-300 shadow-md"
                : kpis.overdueBacklog > 0
                ? "bg-rose-50/70 border-rose-200 hover:border-rose-400 text-slate-800"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${dateFilterMode === "overdue_only" ? "text-rose-100" : "text-rose-700"}`}>
                Pendências Anteriores
              </span>
              <ShieldAlert size={16} className={dateFilterMode === "overdue_only" ? "text-white" : "text-rose-600"} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-2xl font-black ${dateFilterMode === "overdue_only" ? "text-white" : "text-rose-700"}`}>
                {kpis.overdueBacklog}
              </span>
              <span className={`text-xs ${dateFilterMode === "overdue_only" ? "text-rose-100" : "text-rose-500"}`}>
                não concluídas
              </span>
            </div>
            <p className={`text-[10px] mt-1 ${dateFilterMode === "overdue_only" ? "text-rose-100" : "text-rose-500"}`}>
              Datas anteriores a hoje
            </p>
          </button>

          {/* Card 3: Aguardando Confirmação de Data */}
          <button
            type="button"
            onClick={() => {
              setDateFilterMode("all");
              setSelectedStatusTab("pendentes_confirmacao");
            }}
            className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
              selectedStatusTab === "pendentes_confirmacao"
                ? "bg-amber-500 border-amber-500 text-white ring-2 ring-amber-300 shadow-md"
                : "bg-white border-slate-200 hover:border-amber-300 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${selectedStatusTab === "pendentes_confirmacao" ? "text-amber-100" : "text-amber-700"}`}>
                Aguardando Data
              </span>
              <Clock size={16} className={selectedStatusTab === "pendentes_confirmacao" ? "text-white" : "text-amber-600"} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black">{kpis.pendingConfirmation}</span>
              <span className={`text-xs ${selectedStatusTab === "pendentes_confirmacao" ? "text-amber-100" : "text-slate-400"}`}>
                solicitações
              </span>
            </div>
            <p className={`text-[10px] mt-1 ${selectedStatusTab === "pendentes_confirmacao" ? "text-amber-100" : "text-slate-400"}`}>
              Requer ajuste / aceite
            </p>
          </button>

          {/* Card 4: Em Andamento / A Caminho */}
          <button
            type="button"
            onClick={() => {
              setDateFilterMode("all");
              setSelectedStatusTab("em_andamento");
            }}
            className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
              selectedStatusTab === "em_andamento"
                ? "bg-cyan-600 border-cyan-600 text-white ring-2 ring-cyan-300 shadow-md"
                : "bg-white border-slate-200 hover:border-cyan-300 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${selectedStatusTab === "em_andamento" ? "text-cyan-100" : "text-cyan-700"}`}>
                Em Execução
              </span>
              <Navigation size={16} className={selectedStatusTab === "em_andamento" ? "text-white" : "text-cyan-600"} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black">{kpis.inExecution}</span>
              <span className={`text-xs ${selectedStatusTab === "em_andamento" ? "text-cyan-100" : "text-slate-400"}`}>
                em campo
              </span>
            </div>
            <p className={`text-[10px] mt-1 ${selectedStatusTab === "em_andamento" ? "text-cyan-100" : "text-slate-400"}`}>
              Deslocamento e execução
            </p>
          </button>

          {/* Card 5: Concluídas */}
          <button
            type="button"
            onClick={() => {
              setDateFilterMode("all");
              setSelectedStatusTab("concluidas");
            }}
            className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group col-span-2 sm:col-span-1 ${
              selectedStatusTab === "concluidas"
                ? "bg-emerald-600 border-emerald-600 text-white ring-2 ring-emerald-300 shadow-md"
                : "bg-white border-slate-200 hover:border-emerald-300 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${selectedStatusTab === "concluidas" ? "text-emerald-100" : "text-emerald-700"}`}>
                Concluídos
              </span>
              <CheckCircle2 size={16} className={selectedStatusTab === "concluidas" ? "text-white" : "text-emerald-600"} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black">{kpis.totalCompleted}</span>
              <span className={`text-xs ${selectedStatusTab === "concluidas" ? "text-emerald-100" : "text-slate-400"}`}>
                de {kpis.totalOrders} O.S.
              </span>
            </div>
            <p className={`text-[10px] mt-1 ${selectedStatusTab === "concluidas" ? "text-emerald-100" : "text-slate-400"}`}>
              Finalizados com laudo
            </p>
          </button>
        </section>

        {/* 2. TOP SECTION: INTERACTIVE CALENDAR WITH CURRENT DATE HIGHLIGHT */}
        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
          
          {/* Calendar Header Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <CalendarIcon size={18} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <span>
                    {monthNames[currentCalendarMonth.getMonth()]} {currentCalendarMonth.getFullYear()}
                  </span>
                  <span className="text-xs font-normal text-slate-400">|</span>
                  <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                    Hoje: {formatDateBR(todayStr)}
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Selecione um dia para filtrar ordens de serviço agendadas ou verificar pendências.
                </p>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors"
                title="Mês Anterior"
              >
                <ChevronLeft size={16} />
              </button>
              
              <button
                type="button"
                onClick={handleJumpToToday}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs"
              >
                Hoje
              </button>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors"
                title="Próximo Mês"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Calendar Grid Container */}
          <div className="overflow-x-auto">
            <div className="min-w-[550px]">
              
              {/* Day of week headers */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2">
                <span className="text-rose-500">Dom</span>
                <span>Seg</span>
                <span>Ter</span>
                <span>Qua</span>
                <span>Qui</span>
                <span>Sex</span>
                <span className="text-blue-600">Sáb</span>
              </div>

              {/* Day cells grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {calendarDays.map((cell) => {
                  const hasOrders = cell.orders.length > 0;
                  const isSelected = cell.dateStr === selectedCalendarDate && dateFilterMode === "selected_day";

                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => {
                        setSelectedCalendarDate(cell.dateStr);
                        setDateFilterMode("selected_day");
                      }}
                      className={`min-h-[76px] sm:min-h-[88px] p-2 rounded-2xl border text-left flex flex-col justify-between transition-all relative ${
                        cell.isToday
                          ? "ring-2 ring-blue-500 bg-blue-50/50 border-blue-300"
                          : isSelected
                          ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-400"
                          : cell.isCurrentMonth
                          ? "bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/20"
                          : "bg-slate-50/60 border-slate-100 text-slate-300 hover:bg-slate-100/50"
                      }`}
                    >
                      {/* Top Day Number & Badges */}
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`text-xs sm:text-sm font-extrabold ${
                            cell.isToday && !isSelected
                              ? "w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-black"
                              : isSelected
                              ? "text-white"
                              : cell.isCurrentMonth
                              ? "text-slate-800"
                              : "text-slate-300"
                          }`}
                        >
                          {cell.dayNum}
                        </span>

                        {/* Today marker */}
                        {cell.isToday && (
                          <span
                            className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full border ${
                              isSelected
                                ? "bg-white text-slate-900 border-white"
                                : "bg-blue-100 text-blue-800 border-blue-200"
                            }`}
                          >
                            Hoje
                          </span>
                        )}
                      </div>

                      {/* Orders Indicators on Day */}
                      <div className="mt-1 space-y-1 w-full">
                        {hasOrders ? (
                          <div className="space-y-0.5">
                            <div
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg flex items-center justify-between ${
                                isSelected
                                  ? "bg-white/20 text-white"
                                  : cell.hasOverdue
                                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                                  : cell.hasActive
                                  ? "bg-cyan-100 text-cyan-800 border border-cyan-200"
                                  : cell.hasPendingConfirm
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              }`}
                            >
                              <span className="truncate">
                                {cell.orders.length} {cell.orders.length === 1 ? "O.S." : "O.S."}
                              </span>
                              <span className="flex gap-0.5">
                                {cell.hasOverdue && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />}
                                {cell.hasActive && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block" />}
                                {cell.hasPendingConfirm && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-transparent select-none">-</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Calendar Status Summary & Quick Active Filter Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-700">Filtro Ativo:</span>
              {dateFilterMode === "today_only" && (
                <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 font-bold border border-blue-200 flex items-center gap-1">
                  <CalendarCheck size={13} /> Apenas Serviços de Hoje ({formatDateBR(todayStr)})
                </span>
              )}
              {dateFilterMode === "overdue_only" && (
                <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-bold border border-rose-200 flex items-center gap-1">
                  <ShieldAlert size={13} /> Pendências Anteriores Não Concluídas (&lt; Hoje)
                </span>
              )}
              {dateFilterMode === "selected_day" && (
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-bold flex items-center gap-1">
                  <CalendarIcon size={13} /> Data Selecionada no Calendário: {formatDateBR(selectedCalendarDate)}
                </span>
              )}
              {dateFilterMode === "all" && (
                <span className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-800 font-bold flex items-center gap-1">
                  <Layers size={13} /> Exibindo Todas as Datas
                </span>
              )}

              <span className="text-slate-500">
                • {filteredOrders.length} {filteredOrders.length === 1 ? "ordem encontrada" : "ordens encontradas"}
              </span>
            </div>

            {/* Quick date switch buttons */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => setDateFilterMode("all")}
                className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors ${
                  dateFilterMode === "all"
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                Ver Todas as Datas
              </button>

              <button
                type="button"
                onClick={() => {
                  setDateFilterMode("selected_day");
                  setSelectedCalendarDate(todayStr);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors ${
                  dateFilterMode === "selected_day" && selectedCalendarDate === todayStr
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-blue-700 border-blue-200 hover:bg-blue-50"
                }`}
              >
                Filtrar Hoje
              </button>
            </div>
          </div>
        </section>

        {/* 3. BOTTOM SECTION: STATUS TABS, SEARCH AND SERVICE ORDERS GRID */}
        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-6 shadow-sm">
          
          {/* Header with Title and Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                Grid de Ordens de Serviço por Status & Operação
              </h3>
              <p className="text-xs text-slate-500">
                Selecione uma ordem de serviço para ajustar/confirmar data, aceitar atendimento ou iniciar a execução.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar O.S., condomínio, técnico..."
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 rounded-xl pl-10 pr-3 py-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Filter Controls Row: Status tabs & Selectors */}
          <div className="space-y-3">
            
            {/* Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {[
                { id: "todos", label: "Todas as O.S." },
                { id: "Confirmação de Data", label: "Confirmação de Data" },
                { id: "Data confirmada", label: "Data confirmada" },
                { id: "Dia de Execução Serviço", label: "Dia de Execução Serviço" },
                { id: "Técnico a caminho", label: "Técnico a caminho" },
                { id: "Em execução", label: "Em execução" },
                { id: "Serviço Concluído", label: "Serviço Concluído" },
                { id: "canceladas", label: "Canceladas" },
              ].map((tab) => {
                const isActive = selectedStatusTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedStatusTab(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Secondary Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              
              {/* Collaborator Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Técnico/Responsável:</span>
                <select
                  value={selectedColaboradorFilter}
                  onChange={(e) => setSelectedColaboradorFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-1.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                >
                  <option value="todos">Todos os colaboradores</option>
                  <option value="nao_atribuido">Não atribuído</option>
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome || c.displayName || c.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Turno Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Turno:</span>
                <select
                  value={selectedTurnoFilter}
                  onChange={(e) => setSelectedTurnoFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-1.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                >
                  <option value="todos">Todos os turnos</option>
                  <option value="Manhã">Manhã</option>
                  <option value="Tarde">Tarde</option>
                  <option value="Comercial">Comercial</option>
                  <option value="Plantão">Plantão</option>
                </select>
              </div>

              {/* Reset All Filters Button */}
              {(selectedStatusTab !== "todos" ||
                selectedColaboradorFilter !== "todos" ||
                selectedTurnoFilter !== "todos" ||
                dateFilterMode !== "selected_day" ||
                searchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatusTab("todos");
                    setSelectedColaboradorFilter("todos");
                    setSelectedTurnoFilter("todos");
                    setDateFilterMode("selected_day");
                    setSelectedCalendarDate(todayStr);
                    setSearchTerm("");
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold underline ml-auto"
                >
                  Limpar todos os filtros
                </button>
              )}
            </div>
          </div>

          {/* Service Orders Grid / List */}
          {loading ? (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-bold">Carregando ordens de serviço da agenda...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 space-y-3">
              <CalendarCheck size={40} className="text-slate-300 mx-auto" />
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="font-bold text-slate-700 text-sm">Nenhuma Ordem de Serviço encontrada</h4>
                <p className="text-xs text-slate-400">
                  Não existem ordens de serviço correspondentes aos filtros selecionados (
                  {dateFilterMode === "selected_day"
                    ? `Data: ${formatDateBR(selectedCalendarDate)}`
                    : dateFilterMode === "today_only"
                    ? "Serviços de Hoje"
                    : dateFilterMode === "overdue_only"
                    ? "Pendências Anteriores"
                    : "Todas as Datas"}
                  ).
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDateFilterMode("all");
                  setSelectedStatusTab("todos");
                  setSearchTerm("");
                }}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 rounded-xl shadow-xs transition-colors"
              >
                Ver Todas as O.S. Cadastradas
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOrders.map((order) => {
                const eff = getEffectiveOSStatus(order);
                const visual = getOSStatusVisualInfo(eff);
                const orderTargetDate = getOrderTargetDateStr(order);
                const isOverdue = isOrderOverdue(order);
                const isToday = isOrderToday(order);
                const isCompleted = eff === "Serviço Concluído" || order.etapaExecucao === "concluido";
                const isPendingDate = eff === "Confirmação de Data" || isOSPendingInitialConfirmation(order.status);
                const isInExecution = eff === "Técnico a caminho" || eff === "Em execução";

                return (
                  <div
                    key={order.id}
                    className={`bg-white border rounded-2xl p-5 flex flex-col justify-between transition-all hover:shadow-md relative overflow-hidden group ${
                      isOverdue
                        ? "border-rose-200 ring-1 ring-rose-300 bg-rose-50/10"
                        : isToday
                        ? "border-blue-200 ring-1 ring-blue-300 bg-blue-50/10"
                        : "border-slate-200"
                    }`}
                  >
                    {/* Top Status & Date Header */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                          {order.numeroOS || `OS #${order.id.slice(0, 8)}`}
                        </span>

                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${visual.badgeBg} ${visual.badgeText}`}>
                            {eff}
                          </span>
                        </div>
                      </div>

                      {/* Overdue / Today Notification Pill */}
                      {isOverdue && (
                        <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                          <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                          <span>Agendamento anterior não concluído (Pendente)</span>
                        </div>
                      )}

                      {isToday && !isCompleted && (
                        <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold flex items-center gap-1.5">
                          <CalendarCheck size={14} className="text-blue-600 shrink-0" />
                          <span>Programado para execução hoje</span>
                        </div>
                      )}

                      {/* Condomínio & Service Info */}
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-base leading-tight group-hover:text-blue-600 transition-colors">
                          {order.nomeCondominio || order.clienteNome || "Condomínio Residencial"}
                        </h4>
                        <p className="text-xs font-medium text-slate-600 flex items-center gap-1 mt-1">
                          <Wrench size={13} className="text-blue-500 shrink-0" />
                          <span className="truncate">{order.servicoNome || "Serviço Condominial"}</span>
                        </p>
                      </div>

                      {/* Address */}
                      <div className="text-xs text-slate-500 flex items-start gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <MapPin size={14} className="text-rose-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{order.enderecoCondominio || "Endereço cadastrado no sistema"}</span>
                      </div>

                      {/* Date & Shift Info Box */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Data de Execução</span>
                          <span className="font-extrabold text-slate-800">
                            {orderTargetDate ? formatDateBR(orderTargetDate) : "Aguardando definição"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Turno / Horário</span>
                          <span className="font-bold text-slate-700 truncate block">
                            {order.turnoAgendado || "Comercial"}
                          </span>
                        </div>
                      </div>

                      {/* Technician Assigned */}
                      <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
                        <span className="text-slate-400 font-medium">Técnico Responsável:</span>
                        <span className="font-bold text-slate-800">
                          {order.colaboradorNome || (
                            <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                              Não atribuído
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Actions Row */}
                    <div className="pt-4 border-t border-slate-100 space-y-2 mt-4">
                      
                      {/* Primary Execution / Date Adjustment Actions */}
                      <div className="flex items-center gap-2">
                        
                        {/* 1. Adjust / Confirm Date Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenDateModal(order)}
                          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                            isPendingDate
                              ? "bg-amber-500 hover:bg-amber-600 text-white animate-bounce ring-2 ring-amber-300"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                          }`}
                          title="Ajustar ou Confirmar Data de Execução no Calendário"
                        >
                          <CalendarIcon size={14} />
                          <span>{isPendingDate ? "Confirmar Data" : "Ajustar Data"}</span>
                        </button>

                        {/* 2. Start / Execute Action if Today or Past Uncompleted */}
                        {!isCompleted && (
                          <>
                            {isInExecution ? (
                              <Link
                                to="/admin/prestador-servicos"
                                className="flex-1 py-2 px-3 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
                              >
                                <Play size={14} /> Em Execução
                              </Link>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStartService(order)}
                                className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
                                title="Iniciar deslocamento e atendimento desta O.S."
                              >
                                <Play size={14} /> Iniciar Serviço
                              </button>
                            )}
                          </>
                        )}

                        {/* If Completed, Direct Report Button */}
                        {isCompleted && (
                          <button
                            type="button"
                            onClick={() => setSelectedOrderForReport(order)}
                            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
                          >
                            <FileText size={14} /> Laudo Técnico
                          </button>
                        )}
                      </div>

                      {/* Secondary Actions: Timeline & PDF */}
                      <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                        <button
                          type="button"
                          onClick={() => setSelectedOrderForTimeline(order)}
                          className="text-slate-600 hover:text-blue-600 font-bold flex items-center gap-1 transition-colors"
                        >
                          <Clock size={13} className="text-blue-500" />
                          <span>Linha do Tempo</span>
                        </button>

                        {isCompleted && (
                          <button
                            type="button"
                            onClick={(e) => handleDirectDownloadPdf(order, e)}
                            disabled={downloadingPdfId === order.id}
                            className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                          >
                            {downloadingPdfId === order.id ? (
                              <RefreshCw size={13} className="animate-spin" />
                            ) : (
                              <FileDown size={13} />
                            )}
                            <span>PDF</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* MODAL 1: AJUSTAR / CONFIRMAR DATA DE EXECUÇÃO NO CALENDÁRIO */}
      {orderToAdjustDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-slate-200 text-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <CalendarIcon size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Ajustar / Confirmar Data de Execução
                  </h3>
                  <p className="text-xs text-slate-500">
                    {orderToAdjustDate.numeroOS || `OS #${orderToAdjustDate.id.slice(0, 8)}`} • {orderToAdjustDate.nomeCondominio || orderToAdjustDate.clienteNome}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderToAdjustDate(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Service & Client Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5 text-xs text-slate-700">
              <p>
                <strong>Serviço:</strong> {orderToAdjustDate.servicoNome || "Serviço Rotineiro"}
              </p>
              <p>
                <strong>Endereço:</strong> {orderToAdjustDate.enderecoCondominio || "Cadastrado no sistema"}
              </p>
              {orderToAdjustDate.dataPreferencial && (
                <p className="text-blue-700">
                  <strong>Data solicitada pelo cliente:</strong> {formatDateBR(orderToAdjustDate.dataPreferencial)}
                </p>
              )}
            </div>

            {/* Interactive Embedded Mini Calendar for Date Picker */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Selecione a Data no Calendário:
              </label>

              <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/50 space-y-2">
                
                {/* Month navigation in modal */}
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 px-1">
                  <span>
                    {monthNames[modalCalendarDate.getMonth()]} {modalCalendarDate.getFullYear()}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setModalCalendarDate(
                          new Date(modalCalendarDate.getFullYear(), modalCalendarDate.getMonth() - 1, 1)
                        )
                      }
                      className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-600"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setModalCalendarDate(
                          new Date(modalCalendarDate.getFullYear(), modalCalendarDate.getMonth() + 1, 1)
                        )
                      }
                      className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-600"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400">
                  <span>D</span>
                  <span>S</span>
                  <span>T</span>
                  <span>Q</span>
                  <span>Q</span>
                  <span>S</span>
                  <span>S</span>
                </div>

                {/* Day picker buttons */}
                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const year = modalCalendarDate.getFullYear();
                    const month = modalCalendarDate.getMonth();
                    const firstDayIndex = new Date(year, month, 1).getDay();
                    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
                    const daysArr: React.ReactNode[] = [];

                    // Empty slots
                    for (let i = 0; i < firstDayIndex; i++) {
                      daysArr.push(<span key={`empty-${i}`} className="p-1.5" />);
                    }

                    // Month days
                    for (let d = 1; d <= totalDaysInMonth; d++) {
                      const mm = String(month + 1).padStart(2, "0");
                      const dd = String(d).padStart(2, "0");
                      const curDateStr = `${year}-${mm}-${dd}`;
                      const isSelected = modalSelectedDate === curDateStr;
                      const isToday = curDateStr === todayStr;

                      daysArr.push(
                        <button
                          key={curDateStr}
                          type="button"
                          onClick={() => setModalSelectedDate(curDateStr)}
                          className={`p-2 text-xs rounded-xl font-bold transition-all ${
                            isSelected
                              ? "bg-blue-600 text-white shadow-xs font-black"
                              : isToday
                              ? "bg-blue-100 text-blue-800 border border-blue-300"
                              : "bg-white hover:bg-slate-200 text-slate-700 border border-slate-100"
                          }`}
                        >
                          {d}
                        </button>
                      );
                    }

                    return daysArr;
                  })()}
                </div>
              </div>

              {/* Direct Date Input (Alternative / Precision) */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="date"
                  value={modalSelectedDate}
                  onChange={(e) => setModalSelectedDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-xs font-bold text-slate-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
                {modalSelectedDate && (
                  <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100 shrink-0">
                    {formatDateBR(modalSelectedDate)}
                  </span>
                )}
              </div>
            </div>

            {/* Turno Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Turno / Período:</label>
              <div className="grid grid-cols-2 gap-2">
                {TURNOS_AGENDAMENTO.map((turno) => (
                  <button
                    key={turno.id}
                    type="button"
                    onClick={() => setModalSelectedTurno(turno.id)}
                    className={`p-2.5 text-xs font-bold rounded-xl border text-left transition-all ${
                      modalSelectedTurno === turno.id
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    {turno.short}
                    <span className="text-[10px] block opacity-80 font-normal">{turno.label.split("(")[1]?.replace(")", "")}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Observações de Agendamento */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Observações do Agendamento (Opcional):
              </label>
              <textarea
                value={modalObservacoes}
                onChange={(e) => setModalObservacoes(e.target.value)}
                placeholder="Ex: Entrar em contato com o zelador com 30min de antecedência..."
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-xl p-3 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Modal Feedback Message */}
            {modalFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  modalFeedback.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {modalFeedback.type === "success" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                <span>{modalFeedback.text}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="button"
                onClick={() => setOrderToAdjustDate(null)}
                disabled={isSubmittingDate}
                className="w-full sm:w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all border border-slate-200"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => handleSaveDateModal(false)}
                disabled={isSubmittingDate || !modalSelectedDate}
                className="w-full sm:w-2/3 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
              >
                {isSubmittingDate ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                <span>Confirmar Data de Execução</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: LINHA DO TEMPO & HISTÓRICO COMPLETO */}
      {selectedOrderForTimeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-slate-200 text-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Clock size={18} className="text-blue-600" />
                  Histórico e Linha de Acompanhamento
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedOrderForTimeline.numeroOS || `OS #${selectedOrderForTimeline.id.slice(0, 8)}`} • {selectedOrderForTimeline.nomeCondominio || selectedOrderForTimeline.clienteNome}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForTimeline(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <ServiceTrackingTimeline order={selectedOrderForTimeline} defaultExpanded={true} />

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOrderForTimeline(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: LAUDO TÉCNICO & RELATÓRIO DO SERVIÇO */}
      {selectedOrderForReport && (
        <ServiceReportModal
          isOpen={!!selectedOrderForReport}
          onClose={() => setSelectedOrderForReport(null)}
          order={selectedOrderForReport}
        />
      )}
    </div>
  );
}
