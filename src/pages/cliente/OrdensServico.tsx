import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, orderBy, doc, updateDoc, getDoc, addDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { FileText, Clock, CheckCircle, Calendar, MessageSquare, Wrench, AlertCircle, XCircle, X, Trash2 } from "lucide-react";

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

  // Regra 2: Status 'Solicitado o Serviço' sem alteração de status por mais de 24 horas
  if (order.status === "Solicitado o Serviço" && diffHours >= 24) {
    const hoursElapsed = Math.floor(diffHours);
    return {
      canCancel: true,
      is24hRule: true,
      hoursElapsed,
      timeLeftFormatted: `+${hoursElapsed}h`,
      badgeText: `Sem alteração de status há +24h (${hoursElapsed}h)`
    };
  }

  if (order.status === "Solicitado o Serviço") {
    const hoursUntil24 = Math.ceil(24 - diffHours);
    return {
      canCancel: false,
      is24hRule: false,
      reason: `Prazo inicial de 4h expirado. Cancelamento/exclusão disponível em ${hoursUntil24}h se o status permanecer 'Solicitado o Serviço'.`
    };
  }

  return { canCancel: false, is24hRule: false, reason: "Prazo de 4 horas para cancelamento expirado" };
};

const getDeleteEligibility = (order: any) => {
  if (order.status !== "Solicitado o Serviço") {
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
  const { profile, refreshProfile } = useAuth();

  // Cancel Modal States
  const [selectedOrderToCancel, setSelectedOrderToCancel] = useState<any | null>(null);
  const [motivoJustificativa, setMotivoJustificativa] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  // Delete Modal States
  const [selectedOrderToDelete, setSelectedOrderToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    const fetchOrdens = async () => {
      if (!profile?.uid) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, "ordens_servico"),
          where("clienteId", "==", profile.uid),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        setOrdens(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Erro ao buscar ordens:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrdens();
  }, [profile?.uid]);

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

      // Validate 4h or 24h 'Solicitado o Serviço' rule for client
      if (!isAdmin) {
        const createdDate = getOrderDate(currentData.createdAt);
        if (createdDate) {
          const diffMs = Date.now() - createdDate.getTime();
          const diffMinutes = diffMs / (1000 * 60);
          const diffHours = diffMs / (1000 * 60 * 60);
          const isWithin4h = diffMinutes <= 240;
          const isAfter24hSolicitado = currentData.status === "Solicitado o Serviço" && diffHours >= 24;

          if (!isWithin4h && !isAfter24hSolicitado) {
            if (currentData.status !== "Solicitado o Serviço") {
              throw new Error(`A solicitação já avançou para o status '${currentData.status}' e não pode ser cancelada diretamente. Entre em contato com nosso atendimento.`);
            } else {
              throw new Error("O prazo inicial de 4 horas expirou. Ordens com status 'Solicitado o Serviço' podem ser canceladas após 24 horas sem atendimento.");
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

      setOrdens(prev =>
        prev.map(item =>
          item.id === selectedOrderToCancel.id
            ? {
                ...item,
                status: "Cancelada pelo Cliente",
                motivoCancelamento: motivoJustificativa.trim(),
                canceladoEm: new Date().toISOString()
              }
            : item
        )
      );

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

      // Check that status is still "Solicitado o Serviço"
      if (currentData.status !== "Solicitado o Serviço" && !isAdmin) {
        throw new Error(`A solicitação mudou para o status '${currentData.status}' e não pode mais ser excluída.`);
      }

      // Check 24 hours
      if (!isAdmin) {
        const createdDate = getOrderDate(currentData.createdAt);
        if (createdDate) {
          const diffHours = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);
          if (diffHours < 24) {
            throw new Error("A exclusão só é permitida após 24 horas da solicitação com o status 'Solicitado o Serviço'.");
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

  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Minhas Ordens de Serviço</h1>
        <p className="text-slate-500">
          Acompanhe o status das suas solicitações. Você pode cancelar um serviço em até 4 horas após a solicitação. Solicitações com status 'Solicitado o Serviço' sem alteração por mais de 24 horas podem ser excluídas do aplicativo.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-light"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {ordens.map(o => {
            const cancelInfo = getCancelEligibility(o);
            const deleteInfo = getDeleteEligibility(o);
            const isCancelled = o.status === "Cancelada pelo Cliente" || o.status === "Cancelado";
            const createdDate = getOrderDate(o.createdAt);

            return (
              <div
                key={o.id}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col space-y-4"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-400">OS Nº: {o.numeroOS || o.id?.slice(0, 8)}</span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500">
                        Solicitado em: {createdDate ? createdDate.toLocaleString("pt-BR") : ''}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-lg text-slate-900">{o.servicoNome}</h3>
                  </div>

                  <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 ${
                    o.status === 'Serviço Concluído' ? 'bg-emerald-100 text-emerald-800' : 
                    o.status === 'Confirmada a Visita' ? 'bg-sky-100 text-sky-800' :
                    isCancelled ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {o.status === 'Serviço Concluído' && <CheckCircle size={16} />}
                    {o.status === 'Confirmada a Visita' && <Clock size={16} />}
                    {o.status === 'Solicitado o Serviço' && <FileText size={16} />}
                    {isCancelled && <XCircle size={16} />}
                    {o.status}
                  </div>
                </div>

                {/* Items Breakdown if present */}
                {o.itens && Array.isArray(o.itens) && o.itens.length > 0 ? (
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Serviços Incluídos
                    </span>
                    <div className="divide-y divide-slate-200/60">
                      {o.itens.map((item: any, idx: number) => (
                        <div key={idx} className="py-1.5 flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-800">
                            {item.quantidade}x {item.nome}
                          </span>
                          <span className="font-bold text-slate-600">
                            R$ {formatCurrency(parsePrice(item.subtotal || parsePrice(item.valorUnitario) * item.quantidade))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Additional details */}
                <div className="flex flex-wrap gap-4 text-xs text-slate-600 pt-1">
                  {o.dataPreferencial && (
                    <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg font-medium">
                      <Calendar size={14} className="text-[#0071e3]" />
                      <span>Data Preferencial: {formatDateBR(o.dataPreferencial)}</span>
                    </div>
                  )}
                  {o.observacoes && (
                    <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg font-medium">
                      <MessageSquare size={14} className="text-[#0071e3]" />
                      <span>Obs: {o.observacoes}</span>
                    </div>
                  )}
                </div>

                {/* Cancellation justification box if cancelled */}
                {o.motivoCancelamento && (
                  <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl text-xs text-rose-900 flex items-start gap-2.5">
                    <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-rose-950">Motivo do Cancelamento:</span>
                      <p className="mt-0.5 text-rose-800 leading-relaxed">{o.motivoCancelamento}</p>
                    </div>
                  </div>
                )}

                {/* Footer with total price & cancel button */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t border-slate-100">
                  <div className="space-y-0.5">
                    {o.cashbackUsado && parsePrice(o.cashbackUsado) > 0 ? (
                      <>
                        <div className="text-[11px] text-slate-500 font-medium">
                          Valor do Serviço: R$ {formatCurrency(parsePrice(o.valorOriginal || (parsePrice(o.valor) + parsePrice(o.cashbackUsado))))}
                        </div>
                        <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                          Abatimento Cashback: - R$ {formatCurrency(parsePrice(o.cashbackUsado))}
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
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Valor Total</span>
                        <span className="text-xl font-black text-[#0071e3]">
                          R$ {formatCurrency(parsePrice(o.valor))}
                        </span>
                      </>
                    )}
                  </div>

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
            );
          })}

          {ordens.length === 0 && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
              <FileText size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">Você ainda não solicitou nenhum serviço.</p>
            </div>
          )}
        </div>
      )}

      {/* Cancellation Modal */}
      {selectedOrderToCancel && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
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
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
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
                  Esta solicitação permaneceu com o status <strong>'Solicitado o Serviço'</strong> por mais de 24 horas sem alteração de status. Ao confirmar, a ordem de serviço será permanentemente excluída do aplicativo.
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

