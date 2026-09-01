import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, getDoc, updateDoc, addDoc, doc, query, orderBy } from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { 
  Wrench, 
  CheckCircle, 
  Clock, 
  Calendar as CalendarIcon, 
  MessageSquare, 
  User, 
  Mail, 
  AlertCircle, 
  XCircle, 
  X,
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  Edit3,
  Check,
  AlertTriangle,
  Info,
  Building,
  Activity,
  UserCheck,
  Camera,
  PenTool
} from "lucide-react";
import { parseServiceValue, formatCurrencyBR } from "../../lib/serviceUtils";
import { sendEmailWithLog } from "../../lib/emailService";
import { DataTableToolbar } from "../../components/common/DataTableToolbar";
import { StatMetricCard } from "../../components/common/StatMetricCard";
import { EmptyState } from "../../components/common/EmptyState";
import { formatDateBR, formatDateTimeBR } from "../../lib/dateUtils";

export default function OrdensServicoAdmin() {
  const [ordens, setOrdens] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  // Admin cancellation state
  const [orderToCancel, setOrderToCancel] = useState<any | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [isProcessingCancel, setIsProcessingCancel] = useState(false);
  const [cancelError, setCancelError] = useState("");

  // Review Schedule / Agenda state
  const [orderToSchedule, setOrderToSchedule] = useState<any | null>(null);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<string>("");
  const [selectedTurno, setSelectedTurno] = useState<string>("Comercial (08:00 às 18:00)");
  const [observacaoAgendamento, setObservacaoAgendamento] = useState<string>("");
  const [isProcessingSchedule, setIsProcessingSchedule] = useState<boolean>(false);
  const [scheduleFeedback, setScheduleFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Search and Status Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [activeStatusFilter, setActiveStatusFilter] = useState("all");

  const fetchOrdens = async () => {
    setLoading(true);
    try {
      // Fetch users map for name resolution
      const usersSnap = await getDocs(collection(db, "users"));
      const map: Record<string, any> = {};
      usersSnap.docs.forEach(d => {
        const data = d.data();
        if (d.id) map[d.id] = data;
        if (data.email) map[data.email] = data;
      });
      setUsersMap(map);

      const q = query(collection(db, "ordens_servico"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      setOrdens(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Erro ao buscar ordens:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdens();
  }, []);

  const getClientName = (o: any) => {
    const user = (o.clienteId && usersMap[o.clienteId]) || (o.clienteEmail && usersMap[o.clienteEmail]);
    if (user) {
      const name = user.displayName || user.nome || user.razaoSocial || user.nomeCondominio || user.nomeResponsavel;
      if (name) return name;
    }
    if (o.clienteNome && !o.clienteNome.includes("@")) {
      return o.clienteNome;
    }
    if (o.nomeCliente && !o.nomeCliente.includes("@")) {
      return o.nomeCliente;
    }
    if (o.clienteEmail) {
      const prefix = o.clienteEmail.split("@")[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    return o.clienteNome || "Cliente";
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "ordens_servico", id), { status: newStatus });
      fetchOrdens();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Erro ao atualizar status.");
    }
  };

  // Open Schedule Review Modal
  const handleOpenScheduleModal = (order: any) => {
    setOrderToSchedule(order);
    setScheduleFeedback(null);
    const initialDate = order.dataAgendada || order.dataConfirmada || order.dataPreferencial || "";
    let validDateStr = "";
    if (initialDate && /^\d{4}-\d{2}-\d{2}/.test(initialDate)) {
      validDateStr = initialDate.substring(0, 10);
    } else {
      // Default to today or tomorrow
      validDateStr = new Date().toISOString().substring(0, 10);
    }

    setSelectedScheduleDate(validDateStr);
    setSelectedTurno(order.turnoAgendado || "Comercial (08:00 às 18:00)");
    setObservacaoAgendamento(order.observacoesAgendamento || "");

    // Set calendar month to the initial date
    if (validDateStr) {
      const [y, m, d] = validDateStr.split("-").map(Number);
      setCalendarDate(new Date(y, m - 1, d || 1));
    } else {
      setCalendarDate(new Date());
    }
  };

  // Confirm or change schedule date
  const handleSaveSchedule = async (isConfirmingClientSuggested = false) => {
    if (!orderToSchedule) return;

    let targetDate = selectedScheduleDate;
    if (isConfirmingClientSuggested && orderToSchedule.dataPreferencial) {
      if (/^\d{4}-\d{2}-\d{2}/.test(orderToSchedule.dataPreferencial)) {
        targetDate = orderToSchedule.dataPreferencial.substring(0, 10);
      }
    }

    if (!targetDate) {
      setScheduleFeedback({
        type: "error",
        message: "Por favor, selecione uma data válida para a visita técnica."
      });
      return;
    }

    setIsProcessingSchedule(true);
    setScheduleFeedback(null);

    try {
      const docRef = doc(db, "ordens_servico", orderToSchedule.id);
      const isAltered = targetDate !== (orderToSchedule.dataPreferencial || "").substring(0, 10);

      const updatePayload: any = {
        status: "Confirmada a Visita",
        dataConfirmada: targetDate,
        dataAgendada: targetDate,
        turnoAgendado: selectedTurno,
        observacoesAgendamento: observacaoAgendamento.trim(),
        dataAlteradaPorAdmin: isAltered,
        agendamentoAtualizadoEm: new Date().toISOString(),
        agendamentoConfirmadoPor: profile?.email || profile?.displayName || "Administrador",
      };

      // Add to audit trail
      const currentLogs = Array.isArray(orderToSchedule.historicoAgendamento) ? orderToSchedule.historicoAgendamento : [];
      updatePayload.historicoAgendamento = [
        ...currentLogs,
        {
          dataDefinida: targetDate,
          turno: selectedTurno,
          observacao: observacaoAgendamento.trim(),
          alteradaPorAdmin: isAltered,
          confirmadoPor: profile?.email || profile?.displayName || "Administrador",
          dataHora: new Date().toISOString()
        }
      ];

      await updateDoc(docRef, updatePayload);

      // Send email notification to client if email exists
      const clientEmail = orderToSchedule.clienteEmail || orderToSchedule.emailCliente;
      if (clientEmail && clientEmail.includes("@")) {
        const clientName = getClientName(orderToSchedule);
        const numeroOS = orderToSchedule.numeroOS || orderToSchedule.id?.slice(0, 8);
        const dateBR = formatDateBR(targetDate);
        const dateSugeridaBR = formatDateBR(orderToSchedule.dataPreferencial);

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
            <div style="background-color: #0071e3; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h2 style="color: #ffffff; margin: 0; font-size: 20px;">Confirmação de Agendamento da Visita Técnica</h2>
              <p style="color: #e2e8f0; margin: 5px 0 0 0; font-size: 14px;">Ordem de Serviço Nº ${numeroOS}</p>
            </div>
            
            <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background-color: #ffffff;">
              <p>Olá, <strong>${clientName}</strong>,</p>
              
              <p>Informamos que o agendamento da sua <strong>Ordem de Serviço Nº ${numeroOS}</strong> (${orderToSchedule.servicoNome || "Serviços Contratados"}) foi confirmado por nossa equipe técnica.</p>
              
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <h3 style="color: #166534; margin: 0 0 10px 0; font-size: 16px;">Detalhes do Agendamento Confirmado</h3>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Data da Visita Técnica:</strong> <span style="font-size: 16px; color: #15803d; font-weight: bold;">${dateBR}</span></p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Turno / Horário:</strong> ${selectedTurno}</p>
                ${dateSugeridaBR && isAltered ? `<p style="margin: 4px 0; font-size: 12px; color: #64748b;">(Data sugerida inicialmente: ${dateSugeridaBR})</p>` : ''}
                ${observacaoAgendamento ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #334155;"><strong>Observações da Equipe:</strong> ${observacaoAgendamento}</p>` : ''}
              </div>

              <p style="font-size: 13px; color: #64748b;">
                Nossa equipe técnica comparecerá na data e turno programados para realização dos serviços. Você pode acompanhar todas as etapas e o status em tempo real através do painel de <strong>Ordens de Serviço</strong> do aplicativo.
              </p>

              <br />
              <p style="font-size: 13px; color: #64748b; margin-top: 20px;">
                Atenciosamente,<br />
                <strong>Departamento de Operações & Atendimento</strong><br />
                União Condominial
              </p>
            </div>
          </div>
        `;

        try {
          await sendEmailWithLog({
            to: clientEmail,
            subject: `Visita Técnica Confirmada: ${dateBR} - OS Nº ${numeroOS}`,
            html: emailHtml
          }, "AGENDAMENTO_OS_CONFIRMADO");
        } catch (emailErr) {
          console.warn("Erro ao enviar e-mail de notificação de agendamento:", emailErr);
        }
      }

      setScheduleFeedback({
        type: "success",
        message: `Visita técnica confirmada com sucesso para ${formatDateBR(targetDate)} (${selectedTurno}). O cliente foi notificado.`
      });

      await fetchOrdens();
      setTimeout(() => {
        setOrderToSchedule(null);
        setScheduleFeedback(null);
      }, 1400);

    } catch (err: any) {
      console.error("Erro ao salvar agendamento:", err);
      setScheduleFeedback({
        type: "error",
        message: err?.message || "Erro ao salvar agendamento da ordem de serviço."
      });
    } finally {
      setIsProcessingSchedule(false);
    }
  };

  const handleConfirmAdminCancel = async () => {
    if (!orderToCancel) return;
    if (!motivoCancelamento.trim()) {
      setCancelError("Por favor informe o motivo do cancelamento.");
      return;
    }

    setIsProcessingCancel(true);
    setCancelError("");

    try {
      const docRef = doc(db, "ordens_servico", orderToCancel.id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error("Ordem de serviço não encontrada.");
      }

      const currentData = docSnap.data();

      // If cashback was used, refund it back
      const usedCashback = Number(currentData.cashbackUsado || 0);
      if (usedCashback > 0 && currentData.clienteId) {
        const userRef = doc(db, "users", currentData.clienteId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentBal = Number(userSnap.data()?.cashbackBalance || 0);
          await updateDoc(userRef, {
            cashbackBalance: currentBal + usedCashback
          });

          await addDoc(collection(db, "cashback_transactions"), {
            userId: currentData.clienteId,
            type: "estorno_cancelamento",
            amount: usedCashback,
            description: `Estorno de cashback por cancelamento administrativo da OS Nº ${orderToCancel.numeroOS || orderToCancel.id?.slice(0, 8)}`,
            date: new Date().toISOString(),
            createdAt: new Date(),
            status: "Aprovado"
          });
        }
      }

      await updateDoc(docRef, {
        status: "Cancelado",
        motivoCancelamento: motivoCancelamento.trim(),
        canceladoEm: new Date().toISOString(),
        canceladoPor: profile?.email || profile?.displayName || "Administrador"
      });

      setOrderToCancel(null);
      setMotivoCancelamento("");
      fetchOrdens();
    } catch (err: any) {
      console.error("Erro ao cancelar ordem:", err);
      setCancelError(err?.message || "Erro ao cancelar ordem de serviço.");
    } finally {
      setIsProcessingCancel(false);
    }
  };

  // Compute map of scheduled visits by date (YYYY-MM-DD)
  const scheduledOrdersByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    ordens.forEach(o => {
      if (o.status === "Cancelado" || o.status === "Cancelada pelo Cliente") return;
      const targetDate = o.dataAgendada || o.dataConfirmada || o.dataPreferencial;
      if (targetDate && /^\d{4}-\d{2}-\d{2}/.test(targetDate)) {
        const key = targetDate.substring(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(o);
      }
    });
    return map;
  }, [ordens]);

  // Calendar generation helpers
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSuggested: boolean;
      isSelected: boolean;
      ordersCount: number;
    }> = [];

    const todayStr = new Date().toISOString().substring(0, 10);
    const suggestedStr = orderToSchedule?.dataPreferencial ? orderToSchedule.dataPreferencial.substring(0, 10) : "";

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dNum);
      const dStr = prevDate.toISOString().substring(0, 10);
      days.push({
        dateStr: dStr,
        dayNumber: dNum,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSuggested: dStr === suggestedStr,
        isSelected: dStr === selectedScheduleDate,
        ordersCount: scheduledOrdersByDate[dStr]?.length || 0
      });
    }

    // Current month days
    for (let dNum = 1; dNum <= daysInMonth; dNum++) {
      const currDate = new Date(year, month, dNum);
      const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dNum).padStart(2, "0")}`;
      days.push({
        dateStr: dStr,
        dayNumber: dNum,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        isSuggested: dStr === suggestedStr,
        isSelected: dStr === selectedScheduleDate,
        ordersCount: scheduledOrdersByDate[dStr]?.length || 0
      });
    }

    // Next month filler days to complete grid (up to 35 or 42)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      const dStr = nextDate.toISOString().substring(0, 10);
      days.push({
        dateStr: dStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSuggested: dStr === suggestedStr,
        isSelected: dStr === selectedScheduleDate,
        ordersCount: scheduledOrdersByDate[dStr]?.length || 0
      });
    }

    return days;
  }, [calendarDate, selectedScheduleDate, scheduledOrdersByDate, orderToSchedule]);

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const handlePrevMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  // Orders on the currently selected schedule date in modal
  const ordersOnSelectedDate = useMemo(() => {
    if (!selectedScheduleDate) return [];
    return scheduledOrdersByDate[selectedScheduleDate] || [];
  }, [selectedScheduleDate, scheduledOrdersByDate]);

  // KPI calculations
  const kpis = useMemo(() => {
    const total = ordens.length;
    const aguardando = ordens.filter(
      (o) =>
        o.status === "Solicitado o Serviço" ||
        o.status === "Aguardando confirmação - Data" ||
        o.status === "aguardando confirmação - Equipe União Condominial" ||
        o.status === "Aguardando Confirmação - Equipe União Condominial" ||
        o.status === "Pendente" ||
        !o.status
    ).length;
    const confirmadas = ordens.filter(
      (o) =>
        o.status === "Confirmada a Visita" ||
        o.status === "Agendado" ||
        o.status === "Visita Agendada" ||
        o.status === "Em Execução" ||
        o.status === "Em Andamento"
    ).length;
    const concluidas = ordens.filter((o) => o.status === "Serviço Concluído").length;
    const canceladas = ordens.filter(
      (o) => o.status === "Cancelada pelo Cliente" || o.status === "Cancelado"
    ).length;

    return { total, aguardando, confirmadas, concluidas, canceladas };
  }, [ordens]);

  // Filtered orders list
  const filteredOrdens = useMemo(() => {
    return ordens.filter((o) => {
      // Status filter
      if (activeStatusFilter === "aguardando") {
        const isWaiting =
          o.status === "Solicitado o Serviço" ||
          o.status === "Aguardando confirmação - Data" ||
          o.status === "aguardando confirmação - Equipe União Condominial" ||
          o.status === "Aguardando Confirmação - Equipe União Condominial" ||
          o.status === "Pendente" ||
          !o.status;
        if (!isWaiting) return false;
      } else if (activeStatusFilter === "confirmadas") {
        const isConfirmed =
          o.status === "Confirmada a Visita" ||
          o.status === "Agendado" ||
          o.status === "Visita Agendada" ||
          o.status === "Em Execução" ||
          o.status === "Em Andamento";
        if (!isConfirmed) return false;
      } else if (activeStatusFilter === "concluidas") {
        if (o.status !== "Serviço Concluído") return false;
      } else if (activeStatusFilter === "canceladas") {
        if (o.status !== "Cancelada pelo Cliente" && o.status !== "Cancelado") return false;
      }

      // Search term filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const clientName = getClientName(o).toLowerCase();
        const servName = (o.servicoNome || "").toLowerCase();
        const numOS = (o.numeroOS || o.id || "").toLowerCase();
        const email = (o.clienteEmail || "").toLowerCase();
        const condo = (o.condominioNome || o.nomeCondominio || "").toLowerCase();

        return (
          clientName.includes(term) ||
          servName.includes(term) ||
          numOS.includes(term) ||
          email.includes(term) ||
          condo.includes(term)
        );
      }

      return true;
    });
  }, [ordens, activeStatusFilter, searchTerm, usersMap]);

  // Export Filtered Orders to CSV
  const handleExportCsv = () => {
    if (filteredOrdens.length === 0) {
      alert("Nenhum registro para exportar com os filtros atuais.");
      return;
    }

    const headers = [
      "Numero_OS",
      "Servico",
      "Cliente",
      "Email",
      "Status",
      "Data_Agendada",
      "Turno",
      "Valor_Total",
      "Cashback_Abatido",
      "Valor_Faturar",
      "Criado_Em"
    ];

    const rows = filteredOrdens.map((o) => {
      const clientName = getClientName(o);
      const dataAgenda = o.dataConfirmada || o.dataAgendada || o.dataPreferencial || "";
      const valTotal = parseServiceValue(o.valor).toFixed(2);
      const valCashback = parseServiceValue(o.cashbackUsado).toFixed(2);
      const valFaturar = (o.valorFaturar !== undefined ? parseServiceValue(o.valorFaturar) : parseServiceValue(o.valor)).toFixed(2);
      const criadoEm = o.createdAt ? new Date(o.createdAt.seconds * 1000).toISOString() : "";

      return [
        `"${o.numeroOS || o.id}"`,
        `"${(o.servicoNome || "").replace(/"/g, '""')}"`,
        `"${clientName.replace(/"/g, '""')}"`,
        `"${o.clienteEmail || ""}"`,
        `"${o.status || "Pendente"}"`,
        `"${dataAgenda}"`,
        `"${o.turnoAgendado || ""}"`,
        `"${valTotal}"`,
        `"${valCashback}"`,
        `"${valFaturar}"`,
        `"${criadoEm}"`
      ].join(";");
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ordens_servico_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-full space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ordens de Serviço (CRM Comercial)</h1>
          <p className="text-slate-500 text-sm">Gerencie o fluxo de atendimento, agendamento de visitas na agenda e conclusão de serviços.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/monitoria-servicos"
            className="bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold px-3.5 py-2 rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Activity size={14} /> Monitoria Interna & SLA
          </Link>
          <Link
            to="/admin/execucao-servicos"
            className="bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold px-3.5 py-2 rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <UserCheck size={14} /> Dashboard de Execução do Técnico
          </Link>
          <button
            onClick={fetchOrdens}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
          >
            Atualizar Lista
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatMetricCard
          title="Total de Ordens"
          value={kpis.total}
          icon={Wrench}
          iconBgColor="bg-blue-50 dark:bg-blue-950/60"
          iconColor="text-[#0071e3]"
          subtitle="Cadastradas no sistema"
          onClick={() => setActiveStatusFilter("all")}
        />
        <StatMetricCard
          title="Aguardando Confirmação"
          value={kpis.aguardando}
          icon={Clock}
          iconBgColor="bg-amber-50 dark:bg-amber-950/60"
          iconColor="text-amber-600"
          badge={kpis.aguardando > 0 ? "Ação Pendente" : undefined}
          subtitle="Demandam validação de data"
          onClick={() => setActiveStatusFilter("aguardando")}
        />
        <StatMetricCard
          title="Visitas Agendadas / Ativas"
          value={kpis.confirmadas}
          icon={CalendarCheck}
          iconBgColor="bg-sky-50 dark:bg-sky-950/60"
          iconColor="text-sky-600"
          subtitle="Em rota ou execução técnica"
          onClick={() => setActiveStatusFilter("confirmadas")}
        />
        <StatMetricCard
          title="Serviços Concluídos"
          value={kpis.concluidas}
          icon={CheckCircle}
          iconBgColor="bg-emerald-50 dark:bg-emerald-950/60"
          iconColor="text-emerald-600"
          subtitle="Com fotos e assinatura"
          onClick={() => setActiveStatusFilter("concluidas")}
        />
      </div>

      {/* Filter and Control Toolbar */}
      <DataTableToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por cliente, condomínio, serviço, e-mail ou Nº da OS..."
        filterOptions={[
          { label: "Todas", value: "all", count: kpis.total },
          { label: "Aguardando Confirmação", value: "aguardando", count: kpis.aguardando },
          { label: "Visitas Agendadas", value: "confirmadas", count: kpis.confirmadas },
          { label: "Concluídas", value: "concluidas", count: kpis.concluidas },
          { label: "Canceladas", value: "canceladas", count: kpis.canceladas },
        ]}
        activeFilter={activeStatusFilter}
        onFilterChange={setActiveStatusFilter}
        onExportCsv={handleExportCsv}
        totalRecords={ordens.length}
        filteredRecords={filteredOrdens.length}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-light"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrdens.map(o => {
            const isWaitingSchedule = 
              o.status === 'Solicitado o Serviço' || 
              o.status === 'Aguardando confirmação - Data' || 
              o.status === 'aguardando confirmação - Equipe União Condominial' || 
              o.status === 'Aguardando Confirmação - Equipe União Condominial' || 
              o.status === 'Pendente' || 
              !o.status;
            
            const isConfirmed = o.status === 'Confirmada a Visita' || o.status === 'Agendado' || o.status === 'Visita Agendada';
            const isDone = o.status === 'Serviço Concluído';
            const isCancelled = o.status === 'Cancelada pelo Cliente' || o.status === 'Cancelado';

            return (
              <div
                key={o.id}
                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 dark:bg-slate-800 dark:border-slate-700 space-y-4"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-slate-700 pb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-slate-400">OS Nº: {o.numeroOS || o.id}</span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        isDone ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 
                        isConfirmed ? 'bg-sky-100 text-sky-800 border border-sky-200' : 
                        isCancelled ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}>
                        {o.status || 'Aguardando confirmação - Data'}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">{o.servicoNome}</h3>
                  </div>

                  {/* Status & Schedule action buttons */}
                  <div className="flex flex-wrap gap-2 shrink-0 items-center">
                    {/* Botão Principal: Revisar data de agendamento na agenda */}
                    {isWaitingSchedule && (
                      <button
                        onClick={() => handleOpenScheduleModal(o)}
                        className="bg-[#0071e3] hover:bg-[#0071e3]/90 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        title="Abrir agenda para confirmar ou alterar data sugerida pelo cliente"
                      >
                        <CalendarCheck size={15} /> Revisar data de agendamento
                      </button>
                    )}

                    {/* Botão de Alterar Data a qualquer tempo (para OS já confirmada ou ativa) */}
                    {(isConfirmed || o.status === 'Em Execução' || o.status === 'Em Andamento') && (
                      <button
                        onClick={() => handleOpenScheduleModal(o)}
                        className="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Alterar ou remarcar a data do agendamento"
                      >
                        <CalendarIcon size={14} /> Alterar Data / Reagendar
                      </button>
                    )}

                    {isWaitingSchedule && (
                      <button
                        onClick={() => {
                          setOrderToCancel(o);
                          setMotivoCancelamento("");
                          setCancelError("");
                        }}
                        className="bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <XCircle size={15} /> Cancelar OS
                      </button>
                    )}

                    {isConfirmed && (
                      <>
                        <button
                          onClick={() => handleStatusChange(o.id, 'Serviço Concluído')}
                          className="bg-emerald-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition-all shadow-xs cursor-pointer"
                        >
                          <CheckCircle size={15} /> Sinalizar Serviço Concluído
                        </button>
                        <button
                          onClick={() => {
                            setOrderToCancel(o);
                            setMotivoCancelamento("");
                            setCancelError("");
                          }}
                          className="bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <XCircle size={15} /> Cancelar OS
                        </button>
                      </>
                    )}

                    {isDone && (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                        <CheckCircle size={15} /> Concluído
                      </span>
                    )}

                    {isCancelled && (
                      <span className="text-xs font-bold text-slate-600 flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                        <XCircle size={15} /> {o.status === 'Cancelada pelo Cliente' ? 'Cancelado pelo Cliente' : 'Cancelado (Admin)'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Client Info & Items */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                      <User size={14} className="text-[#0071e3]" /> Cliente: {getClientName(o)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-slate-400" /> {o.clienteEmail}
                    </div>

                    {/* Destaque de Datas da Agenda */}
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5 mt-2">
                      {o.dataConfirmada || o.dataAgendada ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold">
                            <CalendarCheck size={15} className="text-emerald-600" />
                            <span>Visita Confirmada: {formatDateBR(o.dataConfirmada || o.dataAgendada)}</span>
                            {o.turnoAgendado && (
                              <span className="text-[11px] font-normal text-slate-600 dark:text-slate-300">
                                ({o.turnoAgendado})
                              </span>
                            )}
                          </div>
                          {o.dataAlteradaPorAdmin && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">
                              Reagendado
                            </span>
                          )}
                        </div>
                      ) : null}

                      {o.dataPreferencial && (
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                          <CalendarIcon size={14} className="text-[#0071e3]" />
                          <span>Data Sugerida pelo Cliente: <strong>{formatDateBR(o.dataPreferencial)}</strong></span>
                        </div>
                      )}

                      {o.observacoesAgendamento && (
                        <div className="text-[11px] text-slate-500 italic pl-5">
                          Nota de agendamento: {o.observacoesAgendamento}
                        </div>
                      )}
                    </div>

                    {o.observacoes && (
                      <div className="flex items-start gap-2 text-slate-500 italic pt-1">
                        <MessageSquare size={14} className="mt-0.5 shrink-0" /> Obs do Cliente: {o.observacoes}
                      </div>
                    )}

                    {o.motivoCancelamento && (
                      <div className="bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-2.5 rounded-xl text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2 mt-2">
                        <AlertCircle size={15} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-bold">Motivo do Cancelamento:</strong>
                          <p className="mt-0.5 text-rose-800 dark:text-rose-300">{o.motivoCancelamento}</p>
                          {o.canceladoPor && (
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 block mt-1">
                              Cancelado por: {o.canceladoPor}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Bloco de Execução em Campo e Evidências */}
                    <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/40 p-2.5 rounded-xl text-xs space-y-1.5 mt-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-purple-900 dark:text-purple-300">
                          <UserCheck size={14} className="text-purple-600" />
                          <span>Técnico: {o.colaboradorNome || "Ainda não designado"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            Array.isArray(o.fotosAntes) && o.fotosAntes.length >= 3
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-600"
                          }`}>
                            <Camera size={11} /> Antes: {Array.isArray(o.fotosAntes) ? o.fotosAntes.length : 0}/3
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            Array.isArray(o.fotosDepois) && o.fotosDepois.length >= 3
                              ? "bg-teal-100 text-teal-800"
                              : "bg-slate-200 text-slate-600"
                          }`}>
                            <Camera size={11} /> Depois: {Array.isArray(o.fotosDepois) ? o.fotosDepois.length : 0}/3
                          </span>
                          {o.assinaturaResponsavel && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                              <PenTool size={11} /> Assinado
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-xs space-y-1.5">
                    <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">
                      Detalhamento dos Serviços
                    </span>
                    {o.itens && Array.isArray(o.itens) && o.itens.length > 0 ? (
                      o.itens.map((item: any, idx: number) => {
                        const qty = Number(item.quantidade) || 1;
                        const unitVal = parseServiceValue(item.valorUnitario ?? item.valor ?? item.preco);
                        const subtotal = item.subtotal ? parseServiceValue(item.subtotal) : (unitVal * qty);
                        return (
                          <div key={idx} className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                            <span>{qty}x {item.nome}</span>
                            <span className="font-bold">{formatCurrencyBR(subtotal)}</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex justify-between items-center">
                        <span>{o.servicoNome}</span>
                        <span className="font-bold">{formatCurrencyBR(o.valor)}</span>
                      </div>
                    )}

                    {o.cashbackUsado && parseServiceValue(o.cashbackUsado) > 0 ? (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                        <div className="flex justify-between text-slate-500 text-[11px]">
                          <span>Valor dos Serviços:</span>
                          <span>{formatCurrencyBR(o.valorOriginal ? o.valorOriginal : (parseServiceValue(o.valor) + parseServiceValue(o.cashbackUsado)))}</span>
                        </div>
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                          <span>Abatimento Cashback:</span>
                          <span>- {formatCurrencyBR(o.cashbackUsado)}</span>
                        </div>
                        <div className="flex justify-between font-black text-slate-900 dark:text-white text-sm pt-1 border-t border-slate-100 dark:border-slate-800">
                          <span>Valor A Faturar:</span>
                          <span className="text-[#0071e3]">{formatCurrencyBR(o.valorFaturar !== undefined && o.valorFaturar !== null ? o.valorFaturar : o.valor)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-black text-slate-900 dark:text-white text-sm">
                        <span>Valor Total OS:</span>
                        <span className="text-[#0071e3]">{formatCurrencyBR(o.valor)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-slate-400">
                  Solicitado em: {o.createdAt ? new Date(o.createdAt.seconds * 1000).toLocaleString() : ''}
                </div>
              </div>
            );
          })}

          {filteredOrdens.length === 0 && (
            <EmptyState
              title={searchTerm || activeStatusFilter !== "all" ? "Nenhuma ordem encontrada" : "Nenhuma ordem de serviço"}
              description={
                searchTerm || activeStatusFilter !== "all"
                  ? "Tente ajustar os termos de busca ou selecionar outro status no filtro acima."
                  : "Não existem ordens de serviço cadastradas ou registradas no sistema até o momento."
              }
              icon={Wrench}
              actionLabel={searchTerm || activeStatusFilter !== "all" ? "Limpar Filtros" : undefined}
              onAction={
                searchTerm || activeStatusFilter !== "all"
                  ? () => {
                      setSearchTerm("");
                      setActiveStatusFilter("all");
                    }
                  : undefined
              }
            />
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REVISAR DATA DE AGENDAMENTO / AGENDA INTERATIVA */}
      {/* ========================================================================= */}
      {orderToSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2 text-[#0071e3] font-bold text-base">
                <CalendarCheck size={20} />
                <span>Revisar Data de Agendamento (Agenda da Equipe)</span>
              </div>
              <button
                onClick={() => setOrderToSchedule(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Card Resumo da OS Selecionada */}
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs bg-[#0071e3] text-white px-2 py-0.5 rounded">
                      OS Nº {orderToSchedule.numeroOS || orderToSchedule.id?.slice(0, 8)}
                    </span>
                    <span className="font-bold text-sm text-slate-900">
                      {orderToSchedule.servicoNome}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-600 bg-white border border-blue-200 px-2.5 py-0.5 rounded-full">
                    Status: {orderToSchedule.status || 'Aguardando confirmação - Data'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Cliente / Condomínio:</span>
                    <strong className="text-slate-900">{getClientName(orderToSchedule)}</strong>
                    <span className="text-slate-500 block text-[11px]">{orderToSchedule.clienteEmail}</span>
                  </div>

                  <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-2.5">
                    <span className="text-amber-800 font-bold block text-[11px] uppercase tracking-wider">
                      Data Sugerida pelo Cliente:
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <CalendarIcon size={16} className="text-amber-700 shrink-0" />
                      <strong className="text-amber-950 text-sm">
                        {formatDateBR(orderToSchedule.dataPreferencial) || "Não especificada"}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Agenda Visual do Mês / Calendário */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <CalendarIcon size={14} className="text-[#0071e3]" />
                      Agenda da Equipe Técnica — Mês de {monthNames[calendarDate.getMonth()]} de {calendarDate.getFullYear()}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Clique em qualquer data para consultar os compromissos agendados e verificar a disponibilidade.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                      title="Mês Anterior"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold text-slate-700 px-2 min-w-28 text-center">
                      {monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                      title="Próximo Mês"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 text-center py-2">
                    <span>Dom</span>
                    <span>Seg</span>
                    <span>Ter</span>
                    <span>Qua</span>
                    <span>Qui</span>
                    <span>Sex</span>
                    <span>Sáb</span>
                  </div>

                  <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 text-xs">
                    {calendarDays.map((d, idx) => {
                      const isSelected = d.isSelected;
                      const isSuggested = d.isSuggested;
                      const hasOrders = d.ordersCount > 0;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedScheduleDate(d.dateStr)}
                          className={`min-h-[58px] p-1.5 flex flex-col justify-between items-center transition-all relative ${
                            !d.isCurrentMonth ? "bg-slate-50/60 text-slate-300" : "bg-white text-slate-700 hover:bg-blue-50/40"
                          } ${isSelected ? "ring-2 ring-[#0071e3] ring-inset bg-blue-50/70 font-bold" : ""} ${
                            isSuggested && !isSelected ? "bg-amber-50/60 border border-amber-300/80" : ""
                          }`}
                        >
                          <div className="w-full flex justify-between items-center">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                              d.isToday ? "bg-blue-600 text-white font-black" : ""
                            }`}>
                              {d.dayNumber}
                            </span>
                            {isSuggested && (
                              <span className="text-[9px] bg-amber-200 text-amber-900 font-extrabold px-1 rounded" title="Data Sugerida pelo Cliente">
                                Sugerida
                              </span>
                            )}
                          </div>

                          {hasOrders && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 mt-1">
                              {d.ordersCount} {d.ordersCount === 1 ? 'OS' : 'OSs'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Subtitle & Legend */}
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block"></span>
                    Data sugerida pelo cliente
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-blue-100 border border-[#0071e3] inline-block"></span>
                    Data selecionada
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-blue-600 inline-block"></span>
                    Hoje
                  </span>
                </div>
              </div>

              {/* Compromissos do Dia Selecionado */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <CalendarCheck size={14} className="text-[#0071e3]" />
                    Visitas Marcadas na Data: <strong>{formatDateBR(selectedScheduleDate)}</strong>
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {ordersOnSelectedDate.length} agendamento(s)
                  </span>
                </div>

                {ordersOnSelectedDate.length > 0 ? (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {ordersOnSelectedDate.map((oItem, oIdx) => (
                      <div key={oIdx} className="bg-white border border-slate-200 rounded-lg p-2 text-xs flex justify-between items-center">
                        <div>
                          <strong className="text-slate-900 block">OS Nº {oItem.numeroOS || oItem.id?.slice(0, 8)} - {oItem.servicoNome}</strong>
                          <span className="text-slate-500 text-[11px]">{getClientName(oItem)} {oItem.turnoAgendado ? `• ${oItem.turnoAgendado}` : ''}</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                          {oItem.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-lg font-medium">
                    Nenhum outro serviço agendado para este dia. Agenda livre para atendimento.
                  </p>
                )}
              </div>

              {/* Formulário de Confirmação ou Alteração de Data */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Edit3 size={14} className="text-[#0071e3]" />
                  Definição da Data e Turno da Visita Técnica
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Data da Visita Técnica <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={selectedScheduleDate}
                      onChange={(e) => setSelectedScheduleDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Turno / Horário
                    </label>
                    <select
                      value={selectedTurno}
                      onChange={(e) => setSelectedTurno(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] outline-hidden"
                    >
                      <option value="Comercial (08:00 às 18:00)">Comercial (08:00 às 18:00)</option>
                      <option value="Manhã (08:00 às 12:00)">Manhã (08:00 às 12:00)</option>
                      <option value="Tarde (13:00 às 17:00)">Tarde (13:00 às 17:00)</option>
                      <option value="Primeiro Horário (08:00)">Primeiro Horário (08:00)</option>
                      <option value="A combinar com o síndico">A combinar com o síndico</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Observações do Agendamento (Enviadas na confirmação ao cliente)
                  </label>
                  <input
                    type="text"
                    value={observacaoAgendamento}
                    onChange={(e) => setObservacaoAgendamento(e.target.value)}
                    placeholder="Ex: Equipe técnica de prontidão com os equipamentos necessários..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] outline-hidden"
                  />
                </div>

                {scheduleFeedback && (
                  <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    scheduleFeedback.type === "success" 
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}>
                    {scheduleFeedback.type === "success" ? <Check size={16} className="shrink-0 text-emerald-600" /> : <AlertCircle size={16} className="shrink-0 text-rose-600" />}
                    <span>{scheduleFeedback.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
              {/* Botão de Confirmação Direta da Data Sugerida pelo Cliente */}
              {orderToSchedule.dataPreferencial && (
                <button
                  type="button"
                  onClick={() => handleSaveSchedule(true)}
                  disabled={isProcessingSchedule}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  title="Confirmar atendimento exatamente na data sugerida pelo cliente"
                >
                  <Check size={16} />
                  <span>Confirmar na Data Sugerida ({formatDateBR(orderToSchedule.dataPreferencial)})</span>
                </button>
              )}

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setOrderToSchedule(null)}
                  disabled={isProcessingSchedule}
                  className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Fechar
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveSchedule(false)}
                  disabled={isProcessingSchedule || !selectedScheduleDate}
                  className="px-5 py-2.5 bg-[#0071e3] hover:bg-[#0071e3]/90 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <CalendarCheck size={16} />
                  <span>{isProcessingSchedule ? "Salvando..." : "Salvar Data Selecionada"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Cancel Modal */}
      {orderToCancel && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-base">
                <AlertCircle size={20} />
                <span>Cancelar Ordem de Serviço (Admin)</span>
              </div>
              <button
                onClick={() => setOrderToCancel(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-700 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">OS Nº {orderToCancel.numeroOS || orderToCancel.id?.slice(0, 8)}</span>
                  <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {orderToCancel.status}
                  </span>
                </div>
                <p className="font-semibold text-slate-800">{orderToCancel.servicoNome}</p>
                <p className="text-slate-500">Cliente: {getClientName(orderToCancel)}</p>
                {orderToCancel.cashbackUsado && parseServiceValue(orderToCancel.cashbackUsado) > 0 && (
                  <p className="text-emerald-700 font-bold">
                    Cashback a ser estornado ao cliente: {formatCurrencyBR(orderToCancel.cashbackUsado)}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Motivo / Justificativa do Cancelamento <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                  placeholder="Explique o motivo do cancelamento para registro no histórico..."
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-hidden transition-all text-slate-900"
                />
              </div>

              {cancelError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{cancelError}</span>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setOrderToCancel(null)}
                disabled={isProcessingCancel}
                className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmAdminCancel}
                disabled={isProcessingCancel || !motivoCancelamento.trim()}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isProcessingCancel ? "Processando..." : "Confirmar Cancelamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
