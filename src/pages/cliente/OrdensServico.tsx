import React, { useState, useEffect } from "react";
import { collection, query, where, doc, updateDoc, getDoc, addDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { 
  FileText, Clock, CheckCircle, Calendar, MessageSquare, Wrench, 
  AlertCircle, XCircle, X, Trash2, CheckCircle2, ChevronRight,
  Filter, Check, Sparkles, AlertTriangle
} from "lucide-react";

const parsePrice = (val: any): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    let cleaned = val.replace(/R\$\s?/gi, "").trim();
    if (cleaned.includes(",") && cleaned.includes(".")) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (cleaned.includes(",")) {
      cleaned = cleaned.replace(",", ".");
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

const formatCurrency = (val: number): string => {
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDateBR = (dateStr?: string) => {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const ymd = dateStr.substring(0, 10);
    const [year, month, day] = ymd.split("-");
    return `${day}/${month}/${year}`;
  }
  return dateStr;
};

const getOrderDate = (createdAt: any): Date | null => {
  if (!createdAt) return null;
  if (typeof createdAt === "object" && typeof createdAt.seconds === "number") {
    return new Date(createdAt.seconds * 1000);
  }
  if (createdAt instanceof Date) return createdAt;
  if (typeof createdAt === "number") return new Date(createdAt);
  if (typeof createdAt === "string") {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

const isInitialPendingStatus = (status?: string) => {
  if (!status) return true;
  const s = status.toLowerCase();
  return s.includes("aguardando") || s.includes("solicitado") || s.includes("pendente") || s.includes("novo");
};

export const getOSStatusDetails = (rawStatus?: string) => {
  const s = (rawStatus || "aguardando confirmação - Equipe União Condominial").trim();

  // Normalize check
  const sLower = s.toLowerCase();

  if (sLower.includes("aguardando") || sLower.includes("solicitado") || sLower.includes("pendente") || sLower === "novo") {
    return {
      label: "aguardando confirmação - Equipe União Condominial",
      step: 1,
      badgeClass: "bg-amber-50 text-amber-900 border-amber-300",
      badgeDot: "bg-amber-500",
      icon: <Clock size={15} className="text-amber-600 animate-pulse shrink-0" />,
      boxBg: "bg-amber-50/70 border-amber-200/90 text-amber-950",
      desc: "Sua solicitação de serviço foi registrada com a data de preferência escolhida. A Equipe União Condominial está avaliando o agendamento e confirmará a visita técnica.",
      highlightText: "Aguardando confirmação da equipe"
    };
  }

  switch (s) {
    case "Confirmada a Visita":
    case "Agendado":
    case "Visita Agendada":
    case "Em Análise":
      return {
        label: "Confirmada a Visita",
        step: 2,
        badgeClass: "bg-sky-50 text-sky-800 border-sky-200",
        badgeDot: "bg-sky-500",
        icon: <Calendar size={15} className="text-sky-600 shrink-0" />,
        boxBg: "bg-sky-50/60 border-sky-200/80 text-sky-900",
        desc: "A visita técnica foi confirmada. O prestador ou técnico credenciado comparecerá na data e turno acordados para a vistoria ou execução dos serviços.",
        highlightText: "Visita técnica programada"
      };

    case "Em Execução":
    case "Em Andamento":
    case "Executando":
      return {
        label: "Em Execução",
        step: 3,
        badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
        badgeDot: "bg-blue-500",
        icon: <Wrench size={15} className="text-blue-600 shrink-0" />,
        boxBg: "bg-blue-50/60 border-blue-200/80 text-blue-900",
        desc: "Os serviços contratados estão sendo executados nas dependências do condomínio conforme o cronograma e escopo técnico aprovado.",
        highlightText: "Serviço em andamento"
      };

    case "Serviço Concluído":
    case "Concluído":
    case "Finalizado":
    case "Entregue":
      return {
        label: "Serviço Concluído",
        step: 4,
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        badgeDot: "bg-emerald-500",
        icon: <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />,
        boxBg: "bg-emerald-50/60 border-emerald-200/80 text-emerald-900",
        desc: "Ordem de serviço finalizada com sucesso. A execução foi concluída e o termo de encerramento e garantia foram emitidos.",
        highlightText: "Serviço finalizado com garantia"
      };

    case "Cancelada pelo Cliente":
    case "Cancelado":
    case "Cancelada":
      return {
        label: "Cancelada pelo Cliente",
        step: 0,
        badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
        badgeDot: "bg-rose-500",
        icon: <XCircle size={15} className="text-rose-600 shrink-0" />,
        boxBg: "bg-rose-50/60 border-rose-200/80 text-rose-900",
        desc: "Esta ordem de serviço foi cancelada e não haverá cobrança ou agendamento para este pedido.",
        highlightText: "Solicitação cancelada"
      };

    default:
      return {
        label: s,
        step: 1,
        badgeClass: "bg-slate-100 text-slate-800 border-slate-200",
        badgeDot: "bg-slate-500",
        icon: <FileText size={15} className="text-slate-600 shrink-0" />,
        boxBg: "bg-slate-50 border-slate-200 text-slate-800",
        desc: `Status atual: ${s}. Em processamento pelo departamento de atendimento.`,
        highlightText: "Em atendimento"
      };
  }
};

const getCancelEligibility = (order: any) => {
  const isAlreadyCancelled = order.status === "Cancelada pelo Cliente" || order.status === "Cancelado";
  const isConcluded = order.status === "Serviço Concluído";

  if (isAlreadyCancelled || isConcluded) {
    return { canCancel: false, is24hRule: false, reason: "Status final ou já cancelado" };
  }

  const createdDate = getOrderDate(order.createdAt);
  if (!createdDate) {
    return { canCancel: false, is24hRule: false, reason: "Data da solicitação indisponível" };
  }

  const now = new Date();
  const diffMs = now.getTime() - createdDate.getTime();
  const diffMinutes = diffMs / (1000 * 60);
  const diffHours = diffMs / (1000 * 60 * 60);
  const maxMinutes = 4 * 60; // 4h = 240min

  // Regra 1: Até 4 horas após a solicitação (qualquer ordem não concluída/cancelada)
  if (diffMinutes >= 0 && diffMinutes <= maxMinutes) {
    const minutesLeft = Math.floor(maxMinutes - diffMinutes);
    const hoursLeft = Math.floor(minutesLeft / 60);
    const minsLeft = minutesLeft % 60;
    const timeLeftFormatted = hoursLeft > 0 ? `${hoursLeft}h ${minsLeft}min` : `${minsLeft}min`;
    return {
      canCancel: true,
      is24hRule: false,
      minutesLeft,
      timeLeftFormatted,
      badgeText: `Restam ${timeLeftFormatted} para cancelar`
    };
  }

  // Regra 2: Status inicial sem alteração de status por mais de 24 horas
  if (isInitialPendingStatus(order.status) && diffHours >= 24) {
    const hoursElapsed = Math.floor(diffHours);
    return {
      canCancel: true,
      is24hRule: true,
      hoursElapsed,
      timeLeftFormatted: `+${hoursElapsed}h`,
      badgeText: `Sem alteração de status há +24h (${hoursElapsed}h)`
    };
  }

  if (isInitialPendingStatus(order.status)) {
    const hoursUntil24 = Math.ceil(24 - diffHours);
    return {
      canCancel: false,
      is24hRule: false,
      reason: `Prazo inicial de 4h expirado. Cancelamento/exclusão disponível em ${hoursUntil24}h se o status permanecer pendente de confirmação.`
    };
  }

  return { canCancel: false, is24hRule: false, reason: "Prazo de 4 horas para cancelamento expirado" };
};

const getDeleteEligibility = (order: any) => {
  if (!isInitialPendingStatus(order.status)) {
    return { canDelete: false, reason: "Disponível apenas para solicitações sem alteração de status" };
  }

  const createdDate = getOrderDate(order.createdAt);
  if (!createdDate) {
    return { canDelete: false, reason: "Data da solicitação indisponível" };
  }

  const now = new Date();
  const diffMs = now.getTime() - createdDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours >= 24) {
    const hoursElapsed = Math.floor(diffHours);
    return { canDelete: true, hoursElapsed };
  }

  return { canDelete: false, reason: "Aguardando prazo de 24 horas sem alteração de status" };
};

export default function MinhasOrdensServico() {
  const [ordens, setOrdens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"todos" | "solicitado" | "visita" | "concluido" | "cancelado">("todos");
  const { profile, user, refreshProfile } = useAuth();

  // Cancel Modal States
  const [selectedOrderToCancel, setSelectedOrderToCancel] = useState<any | null>(null);
  const [motivoJustificativa, setMotivoJustificativa] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  // Delete Modal States
  const [selectedOrderToDelete, setSelectedOrderToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Real-time synchronization
  useEffect(() => {
    const customerUid = profile?.uid || user?.uid;
    const customerEmail = profile?.email || user?.email;

    if (!customerUid && !customerEmail) {
      setLoading(false);
      return;
    }

    setLoading(true);

    let qOS;
    if (customerUid) {
      qOS = query(
        collection(db, "ordens_servico"),
        where("clienteId", "==", customerUid)
      );
    } else {
      qOS = query(
        collection(db, "ordens_servico"),
        where("clienteEmail", "==", customerEmail)
      );
    }

    const unsubscribe = onSnapshot(
      qOS,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        list.sort((a: any, b: any) => {
          const dateA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
          const dateB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });

        setOrdens(list);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao escutar ordens de serviço:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile?.uid, user?.uid, profile?.email, user?.email]);

  const handleOpenCancelModal = (order: any) => {
    setSelectedOrderToCancel(order);
    setMotivoJustificativa("");
    setCancelError("");
  };

  const handleConfirmCancel = async () => {
    if (!selectedOrderToCancel) return;
    if (!motivoJustificativa.trim()) {
      setCancelError("É obrigatório informar o motivo do cancelamento.");
      return;
    }

    setIsCancelling(true);
    setCancelError("");

    try {
      // 0. Permission & Server-side status validation
      const docRef = doc(db, "ordens_servico", selectedOrderToCancel.id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("Ordem de serviço não encontrada no sistema.");
      }

      const currentData = docSnap.data();

      // Check ownership or admin permission
      const isOwner = currentData.clienteId === profile?.uid || currentData.clienteEmail === profile?.email;
      const isAdmin = profile?.role === "Administrador" || profile?.role === "admin" || profile?.role === "Admin" || profile?.role === "master";

      if (!isOwner && !isAdmin) {
        throw new Error("Permissão negada: você não é o proprietário desta ordem de serviço.");
      }

      // Check final/already cancelled statuses
      if (currentData.status === "Cancelada pelo Cliente" || currentData.status === "Cancelado") {
        throw new Error("Esta ordem de serviço já se encontra cancelada.");
      }
      if (currentData.status === "Serviço Concluído") {
        throw new Error("Não é possível cancelar uma ordem de serviço que já foi concluída.");
      }

      // Validate 4h or 24h initial status rule for client
      if (!isAdmin) {
        const createdDate = getOrderDate(currentData.createdAt);
        if (createdDate) {
          const diffMs = Date.now() - createdDate.getTime();
          const diffMinutes = diffMs / (1000 * 60);
          const diffHours = diffMs / (1000 * 60 * 60);
          const isWithin4h = diffMinutes <= 240;
          const isAfter24hPending = isInitialPendingStatus(currentData.status) && diffHours >= 24;

          if (!isWithin4h && !isAfter24hPending) {
            if (!isInitialPendingStatus(currentData.status)) {
              throw new Error(`A solicitação já avançou para o status '${currentData.status}' e não pode ser cancelada diretamente. Entre em contato com nosso atendimento.`);
            } else {
              throw new Error("O prazo inicial de 4 horas expirou. Ordens aguardando confirmação podem ser canceladas após 24 horas sem atendimento.");
            }
          }
        }
      }

      // 1. If order used cashback, refund it back to user balance
      const usedCashback = Number(currentData.cashbackUsado || 0);
      const targetUserId = currentData.clienteId || profile?.uid;
      if (usedCashback > 0 && targetUserId) {
        const userRef = doc(db, "users", targetUserId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentBal = Number(userSnap.data()?.cashbackBalance || 0);
          await updateDoc(userRef, {
            cashbackBalance: currentBal + usedCashback
          });

          await addDoc(collection(db, "cashback_transactions"), {
            userId: targetUserId,
            userEmail: profile?.email || currentData.clienteEmail || "",
            type: "estorno_cancelamento",
            amount: usedCashback,
            description: `Estorno de cashback por cancelamento da OS Nº ${selectedOrderToCancel.numeroOS || selectedOrderToCancel.id?.slice(0, 8)}`,
            date: new Date().toISOString(),
            createdAt: new Date(),
            status: "Aprovado"
          });

          if (refreshProfile) {
            await refreshProfile();
          }
        }
      }

      // 2. Update service order status
      await updateDoc(docRef, {
        status: "Cancelada pelo Cliente",
        motivoCancelamento: motivoJustificativa.trim(),
        canceladoEm: new Date().toISOString(),
        canceladoPor: profile?.email || profile?.uid || "Cliente"
      });

      setSelectedOrderToCancel(null);
      setMotivoJustificativa("");
    } catch (err: any) {
      console.error("Erro ao cancelar ordem de serviço:", err);
      setCancelError(err?.message || "Erro ao processar o cancelamento. Tente novamente.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedOrderToDelete) return;
    setIsDeleting(true);
    setDeleteError("");

    try {
      // 0. Permission & Server-side status validation
      const docRef = doc(db, "ordens_servico", selectedOrderToDelete.id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("Ordem de serviço não encontrada ou já excluída.");
      }

      const currentData = docSnap.data();

      // Check ownership or admin permission
      const isOwner = currentData.clienteId === profile?.uid || currentData.clienteEmail === profile?.email;
      const isAdmin = profile?.role === "Administrador" || profile?.role === "admin" || profile?.role === "Admin" || profile?.role === "master";

      if (!isOwner && !isAdmin) {
        throw new Error("Permissão negada: você não pode excluir esta ordem de serviço.");
      }

      // Check that status is still pending initial confirmation
      if (!isInitialPendingStatus(currentData.status) && !isAdmin) {
        throw new Error(`A solicitação mudou para o status '${currentData.status}' e não pode mais ser excluída.`);
      }

      // Check 24 hours
      if (!isAdmin) {
        const createdDate = getOrderDate(currentData.createdAt);
        if (createdDate) {
          const diffHours = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);
          if (diffHours < 24) {
            throw new Error("A exclusão só é permitida após 24 horas da solicitação sem alteração de status.");
          }
        }
      }

      // 1. If order used cashback, refund it back to user balance
      const usedCashback = Number(currentData.cashbackUsado || 0);
      const targetUserId = currentData.clienteId || profile?.uid;
      if (usedCashback > 0 && targetUserId) {
        const userRef = doc(db, "users", targetUserId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentBal = Number(userSnap.data()?.cashbackBalance || 0);
          await updateDoc(userRef, {
            cashbackBalance: currentBal + usedCashback
          });

          await addDoc(collection(db, "cashback_transactions"), {
            userId: targetUserId,
            userEmail: profile?.email || currentData.clienteEmail || "",
            type: "estorno_exclusao",
            amount: usedCashback,
            description: `Estorno de cashback por exclusão da OS Nº ${selectedOrderToDelete.numeroOS || selectedOrderToDelete.id?.slice(0, 8)}`,
            date: new Date().toISOString(),
            createdAt: new Date(),
            status: "Aprovado"
          });

          if (refreshProfile) {
            await refreshProfile();
          }
        }
      }

      // 2. Delete document permanently from Firestore
      await deleteDoc(docRef);

      // 3. Update local state
      setOrdens(prev => prev.filter(item => item.id !== selectedOrderToDelete.id));
      setSelectedOrderToDelete(null);
    } catch (err: any) {
      console.error("Erro ao excluir ordem de serviço:", err);
      setDeleteError(err?.message || "Erro ao excluir a ordem de serviço. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered orders
  const filteredOrdens = ordens.filter(o => {
    const s = (o.status || "").toLowerCase();
    if (statusFilter === "solicitado") {
      return s.includes("solicitado") || s.includes("pendente") || s.includes("novo");
    }
    if (statusFilter === "visita") {
      return s.includes("visita") || s.includes("agendado") || s.includes("análise");
    }
    if (statusFilter === "concluido") {
      return s.includes("concluído") || s.includes("concluido") || s.includes("finalizado");
    }
    if (statusFilter === "cancelado") {
      return s.includes("cancelad");
    }
    return true;
  });

  const countSolicitados = ordens.filter(o => {
    const s = (o.status || "").toLowerCase();
    return s.includes("solicitado") || s.includes("pendente") || s.includes("novo");
  }).length;

  const countVisita = ordens.filter(o => {
    const s = (o.status || "").toLowerCase();
    return s.includes("visita") || s.includes("agendado") || s.includes("análise");
  }).length;

  const countConcluidos = ordens.filter(o => {
    const s = (o.status || "").toLowerCase();
    return s.includes("concluído") || s.includes("concluido") || s.includes("finalizado");
  }).length;

  const countCancelados = ordens.filter(o => {
    const s = (o.status || "").toLowerCase();
    return s.includes("cancelad");
  }).length;

  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold text-sm border border-sky-100">
                <Wrench size={18} />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">Minhas Ordens de Serviço</h1>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed max-w-2xl">
              Acompanhe o status e a evolução em tempo real de todas as ordens de serviço solicitadas pelo seu condomínio.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200/70 text-xs text-slate-600 font-semibold self-stretch sm:self-auto justify-between sm:justify-start">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Sincronização em tempo real
            </span>
            <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
              {ordens.length} O.S.
            </span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-5 mt-4 border-t border-slate-100 no-scrollbar">
          <button
            onClick={() => setStatusFilter("todos")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              statusFilter === "todos"
                ? "bg-[#0071e3] text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            Todas ({ordens.length})
          </button>

          <button
            onClick={() => setStatusFilter("solicitado")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "solicitado"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
            }`}
          >
            <Clock size={13} />
            <span>Aguardando Confirmação ({countSolicitados})</span>
          </button>

          <button
            onClick={() => setStatusFilter("visita")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "visita"
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200"
            }`}
          >
            <Calendar size={13} />
            <span>Visita Confirmada ({countVisita})</span>
          </button>

          <button
            onClick={() => setStatusFilter("concluido")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "concluido"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
            }`}
          >
            <CheckCircle2 size={13} />
            <span>Concluídos ({countConcluidos})</span>
          </button>

          {countCancelados > 0 && (
            <button
              onClick={() => setStatusFilter("cancelado")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "cancelado"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200"
              }`}
            >
              <XCircle size={13} />
              <span>Cancelados ({countCancelados})</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-slate-200">
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-[#0071e3] mb-3"></div>
          <p className="text-xs font-bold text-slate-500">Carregando ordens de serviço...</p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredOrdens.map((o) => {
            const cancelInfo = getCancelEligibility(o);
            const deleteInfo = getDeleteEligibility(o);
            const isCancelled = o.status === "Cancelada pelo Cliente" || o.status === "Cancelado";
            const createdDate = getOrderDate(o.createdAt);
            const statusDetails = getOSStatusDetails(o.status);
            const osNumber = o.numeroOS || (o.id ? `OS-${o.id.slice(-6).toUpperCase()}` : "OS-PENDENTE");

            return (
              <div
                key={o.id}
                className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col space-y-4 relative overflow-hidden"
              >
                {/* Top Bar: OS Number, Date and Status Badge */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs sm:text-sm font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80">
                        {osNumber}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500 font-medium">
                        Solicitado em: {createdDate ? createdDate.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : '—'}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-base sm:text-lg text-slate-900 pt-0.5">
                      {o.servicoNome || o.itens?.[0]?.nome || "Serviço Condominial"}
                    </h3>
                  </div>

                  {/* Prominent Status Badge */}
                  <div className="flex flex-col sm:items-end gap-1 shrink-0 w-full sm:w-auto">
                    <div
                      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black border self-start sm:self-auto shadow-3xs ${statusDetails.badgeClass}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${statusDetails.badgeDot}`}></span>
                      {statusDetails.icon}
                      <span className="uppercase tracking-wide">{statusDetails.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold hidden sm:block">
                      Status da Ordem de Serviço
                    </span>
                  </div>
                </div>

                {/* Visual Status Progression Tracker */}
                {!isCancelled ? (
                  <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Sparkles size={14} className="text-[#0071e3]" />
                        Progresso do Atendimento:
                      </span>
                      <span className="text-xs font-extrabold text-[#0071e3]">
                        {statusDetails.step === 4 ? "Finalizado e Concluído" : `Etapa ${statusDetails.step} de 3`}
                      </span>
                    </div>

                    {/* Step indicators */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { stepNum: 1, title: "1. Solicitação", desc: "Registrado" },
                        { stepNum: 2, title: "2. Agendamento", desc: "Visita Confirmada" },
                        { stepNum: 3, title: "3. Execução / Conclusão", desc: "Serviço Concluído" },
                      ].map((st) => {
                        const isDone = statusDetails.step > st.stepNum || statusDetails.step === 4;
                        const isCurrent = statusDetails.step === st.stepNum && statusDetails.step < 4;

                        return (
                          <div key={st.stepNum} className="space-y-1.5">
                            <div className="relative">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  isDone || isCurrent
                                    ? "bg-[#0071e3]"
                                    : "bg-slate-200"
                                } ${isCurrent ? "animate-pulse" : ""}`}
                              />
                            </div>
                            <div className="text-center sm:text-left">
                              <span
                                className={`text-[10px] sm:text-xs font-bold block leading-tight ${
                                  isDone || isCurrent ? "text-slate-900" : "text-slate-400"
                                }`}
                              >
                                {st.title}
                              </span>
                              <span
                                className={`text-[9px] sm:text-[10px] hidden sm:block truncate ${
                                  isDone ? "text-emerald-700 font-semibold" : isCurrent ? "text-[#0071e3] font-bold" : "text-slate-400"
                                }`}
                              >
                                {isDone ? "✓ Concluído" : isCurrent ? "● Em andamento" : "Aguardando"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Status Explanation Callout */}
                    <div className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${statusDetails.boxBg}`}>
                      {statusDetails.icon}
                      <div>
                        <span className="font-bold block">Status Atual: {statusDetails.label}</span>
                        <p className="mt-0.5 opacity-90">{statusDetails.desc}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl text-xs text-rose-900 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-rose-950">
                      <XCircle size={16} className="text-rose-600" />
                      <span>Ordem de Serviço Cancelada</span>
                    </div>
                    <p className="text-rose-800 leading-relaxed">
                      Esta solicitação foi cancelada. Caso precise novamente do serviço, você pode realizar uma nova solicitação no catálogo de Serviços Essenciais.
                    </p>
                    {o.motivoCancelamento && (
                      <div className="mt-2 pt-2 border-t border-rose-200/80">
                        <span className="font-bold text-rose-950 block">Justificativa do Cancelamento:</span>
                        <p className="italic text-rose-800 mt-0.5">{o.motivoCancelamento}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Items Breakdown if present */}
                {o.itens && Array.isArray(o.itens) && o.itens.length > 0 && (
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Serviços Inclusos na O.S.
                    </span>
                    <div className="divide-y divide-slate-200/60">
                      {o.itens.map((item: any, idx: number) => (
                        <div key={idx} className="py-2 flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3]"></span>
                            {item.quantidade}x {item.nome}
                          </span>
                          <span className="font-bold text-slate-700">
                            R$ {formatCurrency(parsePrice(item.subtotal || parsePrice(item.valorUnitario) * item.quantidade))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional details */}
                <div className="flex flex-wrap gap-3 text-xs text-slate-600 pt-1">
                  {o.dataPreferencial && (
                    <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl font-medium">
                      <Calendar size={14} className="text-[#0071e3]" />
                      <span>Data de Preferência: <strong>{formatDateBR(o.dataPreferencial)}</strong></span>
                    </div>
                  )}
                  {o.observacoes && (
                    <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl font-medium">
                      <MessageSquare size={14} className="text-[#0071e3]" />
                      <span>Observações: {o.observacoes}</span>
                    </div>
                  )}
                </div>

                {/* Footer with total price & cancel/delete buttons */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t border-slate-100">
                  <div className="space-y-0.5">
                    {o.cashbackUsado && parsePrice(o.cashbackUsado) > 0 ? (
                      <>
                        <div className="text-[11px] text-slate-500 font-medium">
                          Valor Original: R$ {formatCurrency(parsePrice(o.valorOriginal || (parsePrice(o.valor) + parsePrice(o.cashbackUsado))))}
                        </div>
                        <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                          Abatimento de Cashback: - R$ {formatCurrency(parsePrice(o.cashbackUsado))}
                        </div>
                        <div className="pt-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Valor a Faturar</span>
                          <span className="text-xl font-black text-[#0071e3]">
                            R$ {formatCurrency(parsePrice(o.valorFaturar ?? o.valor))}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Valor Total do Serviço</span>
                        <span className="text-xl font-black text-[#0071e3]">
                          R$ {formatCurrency(parsePrice(o.valor))}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Actions (Cancel / Delete if eligible) */}
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                    {cancelInfo.canCancel && (
                      <div className="flex flex-col items-end gap-1 w-full sm:w-auto">
                        <button
                          onClick={() => handleOpenCancelModal(o)}
                          className="w-full sm:w-auto px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <XCircle size={15} /> Cancelar Ordem de Serviço
                        </button>
                        <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                          <Clock size={11} className={cancelInfo.is24hRule ? "text-red-500" : "text-amber-600"} /> 
                          {cancelInfo.badgeText || (cancelInfo.is24hRule ? "Sem alteração há +24h" : `Restam ${cancelInfo.timeLeftFormatted} para cancelar`)}
                        </span>
                      </div>
                    )}

                    {deleteInfo.canDelete && (
                      <div className="flex flex-col items-end gap-1 w-full sm:w-auto">
                        <button
                          onClick={() => {
                            setSelectedOrderToDelete(o);
                            setDeleteError("");
                          }}
                          className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        >
                          <Trash2 size={15} /> Excluir Ordem de Serviço
                        </button>
                        <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                          <Clock size={11} className="text-slate-400" /> Sem alteração de status há +24h
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredOrdens.length === 0 && (
            <div className="bg-white p-10 rounded-3xl border border-slate-200 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <FileText size={28} />
              </div>
              <h3 className="font-bold text-slate-800 text-base">Nenhuma ordem de serviço encontrada</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {statusFilter !== "todos" 
                  ? "Não foram encontradas ordens de serviço com o filtro selecionado." 
                  : "Você ainda não possui solicitações de ordens de serviço registradas."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Cancellation Modal */}
      {selectedOrderToCancel && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-base">
                <AlertCircle size={20} />
                <span>Cancelar Ordem de Serviço</span>
              </div>
              <button
                onClick={() => setSelectedOrderToCancel(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-700 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">OS Nº {selectedOrderToCancel.numeroOS || selectedOrderToCancel.id?.slice(0, 8)}</span>
                  <span className={`font-bold flex items-center gap-1 px-2 py-0.5 rounded border ${
                    getCancelEligibility(selectedOrderToCancel).is24hRule 
                      ? "text-red-700 bg-red-50 border-red-200" 
                      : "text-amber-700 bg-amber-50 border-amber-200"
                  }`}>
                    <Clock size={12} />
                    {getCancelEligibility(selectedOrderToCancel).is24hRule 
                      ? `Sem alteração de status há +24h (${getCancelEligibility(selectedOrderToCancel).hoursElapsed}h)` 
                      : `${getCancelEligibility(selectedOrderToCancel).timeLeftFormatted} restantes`}
                  </span>
                </div>
                <p className="font-semibold text-slate-800">{selectedOrderToCancel.servicoNome}</p>
                <p className="text-slate-500">
                  Valor: R$ {formatCurrency(parsePrice(selectedOrderToCancel.valor))}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Motivo / Justificativa do Cancelamento <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={motivoJustificativa}
                  onChange={(e) => setMotivoJustificativa(e.target.value)}
                  placeholder="Por favor, explique o motivo do cancelamento da ordem de serviço..."
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-hidden transition-all text-slate-900"
                />
                <p className="text-[11px] text-slate-400 italic">
                  Esta ordem de serviço continuará visível no seu histórico marcada como cancelada.
                </p>
              </div>

              {cancelError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{cancelError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedOrderToCancel(null)}
                disabled={isCancelling}
                className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Manter Ordem de Serviço
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling || !motivoJustificativa.trim()}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isCancelling ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                    <span>Cancelando...</span>
                  </>
                ) : (
                  <>
                    <XCircle size={15} />
                    <span>Confirmar Cancelamento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deletion Modal */}
      {selectedOrderToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-2 text-red-700 font-bold text-base">
                <Trash2 size={20} />
                <span>Excluir Ordem de Serviço</span>
              </div>
              <button
                onClick={() => setSelectedOrderToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-700 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">OS Nº {selectedOrderToDelete.numeroOS || selectedOrderToDelete.id?.slice(0, 8)}</span>
                  <span className="text-red-700 font-bold flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    <Clock size={12} />
                    Sem alteração há +24h
                  </span>
                </div>
                <p className="font-semibold text-slate-800">{selectedOrderToDelete.servicoNome}</p>
                <p className="text-slate-500">
                  Valor: R$ {formatCurrency(parsePrice(selectedOrderToDelete.valor))}
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-1">
                <p className="font-bold">Atenção:</p>
                <p>
                  Esta solicitação permaneceu com o status <strong>'aguardando confirmação - Equipe União Condominial'</strong> por mais de 24 horas sem alteração de status. Ao confirmar, a ordem de serviço será permanentemente excluída do aplicativo.
                </p>
              </div>

              {deleteError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedOrderToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
