import React, { useState, useEffect } from "react";
import { collection, getDocs, getDoc, updateDoc, addDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { Wrench, CheckCircle, Clock, Calendar, MessageSquare, User, Mail, AlertCircle, XCircle, X } from "lucide-react";
import { parseServiceValue, formatCurrencyBR } from "../../lib/serviceUtils";

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

  return (
    <div className="w-full max-w-full space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ordens de Serviço (CRM Comercial)</h1>
          <p className="text-slate-500 text-sm">Gerencie o fluxo de atendimento, agendamento de visitas e conclusão de serviços.</p>
        </div>
        <button
          onClick={fetchOrdens}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
        >
          Atualizar Lista
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-light"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {ordens.map(o => (
            <div
              key={o.id}
              className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 dark:bg-slate-800 dark:border-slate-700 space-y-4"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-slate-700 pb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-slate-400">OS Nº: {o.numeroOS || o.id}</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      o.status === 'Serviço Concluído' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 
                      o.status === 'Confirmada a Visita' ? 'bg-sky-100 text-sky-800 border border-sky-200' : 
                      (o.status === 'Cancelada pelo Cliente' || o.status === 'Cancelado') ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-blue-50 text-blue-800 border border-blue-200'
                    }`}>
                      {o.status}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">{o.servicoNome}</h3>
                </div>

                {/* Status action buttons */}
                <div className="flex flex-wrap gap-2 shrink-0 items-center">
                  {o.status === 'Solicitado o Serviço' && (
                    <>
                      <button
                        onClick={() => handleStatusChange(o.id, 'Confirmada a Visita')}
                        className="bg-[#0071e3] text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-[#0071e3]/90 transition-all shadow-xs cursor-pointer"
                      >
                        <Clock size={15} /> Confirmar Visita
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

                  {o.status === 'Confirmada a Visita' && (
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

                  {o.status === 'Serviço Concluído' && (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                      <CheckCircle size={15} /> Concluído
                    </span>
                  )}

                  {(o.status === 'Cancelada pelo Cliente' || o.status === 'Cancelado') && (
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
                  {o.dataPreferencial && (
                    <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300 font-semibold">
                      <Calendar size={14} /> Data Pref.: {formatDateBR(o.dataPreferencial)}
                    </div>
                  )}
                  {o.observacoes && (
                    <div className="flex items-start gap-2 text-slate-500 italic">
                      <MessageSquare size={14} className="mt-0.5 shrink-0" /> Obs: {o.observacoes}
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
          ))}

          {ordens.length === 0 && (
            <p className="text-slate-500 text-center py-8">Nenhuma ordem de serviço registrada no sistema.</p>
          )}
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
