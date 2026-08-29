import React, { useState } from "react";
import { X, AlertTriangle, RefreshCw, MessageSquare, PhoneCall, RotateCcw } from "lucide-react";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import { registrarMudancaStatusPedido } from "../../lib/orderLogger";

interface DeliveryOccurrenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  deliveryItem?: any;
}

export default function DeliveryOccurrenceModal({
  isOpen,
  onClose,
  onSuccess,
  deliveryItem,
}: DeliveryOccurrenceModalProps) {
  const [motivo, setMotivo] = useState("Cliente Ausente / Portaria Fechada");
  const [acaoRecomendada, setAcaoRecomendada] = useState("Reagendar para próxima rota");
  const [detalhes, setDetalhes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !deliveryItem) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { db } = await initFirebase();

      const updatePayload: any = {
        status: "Falha",
        situacao: `${motivo} - ${acaoRecomendada}`,
        motivoFalha: motivo,
        acaoRecomendada,
        detalhesFalha: detalhes.trim(),
        horaFalha: new Date().toISOString().split("T")[1].substring(0, 5),
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, "entregas", deliveryItem.id), updatePayload);

      // Update linked pedidos_venda if exists
      if (deliveryItem.pedidoId) {
        const pedidosSnap = await getDocs(
          query(collection(db, "pedidos_venda"), where("id_externo", "==", deliveryItem.pedidoId))
        );
        if (!pedidosSnap.empty) {
          const pedidoDoc = pedidosSnap.docs[0];
          await registrarMudancaStatusPedido(
            db,
            pedidoDoc.id,
            "Tentativa de Entrega Sem Sucesso",
            deliveryItem.entregador || "Entregador",
            `Insucesso na entrega: ${motivo}. Conduta: ${acaoRecomendada}. Obs: ${detalhes.trim()}`
          );
        }
      }

      await logAction(
        `Ocorrência de entrega: Pedido #${deliveryItem.pedidoId || deliveryItem.id} - ${motivo}`,
        "Logística",
        {
          id: deliveryItem.id,
          pedidoId: deliveryItem.pedidoId,
          motivo,
          acao: acaoRecomendada,
          status: "Falha",
        }
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Erro ao registrar ocorrência:", err);
      alert("Erro ao registrar ocorrência: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleWhatsAppContact = () => {
    const phone = deliveryItem.telefone || "";
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) {
      alert("Nenhum telefone cadastrado para este cliente.");
      return;
    }
    const message = encodeURIComponent(
      `Olá ${deliveryItem.cliente}, nosso entregador esteve no endereço para entrega do Pedido #${deliveryItem.pedidoId || ""}, porém não conseguiu concluir (${motivo}). Por favor, entre em contato para alinharmos o recebimento.`
    );
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, "_blank");
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
        <div className="bg-gradient-to-r from-rose-600 to-red-700 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <AlertTriangle size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Registrar Ocorrência na Entrega</h2>
              <p className="text-xs text-rose-100">Informar tentativa frustrada ou impedimento de rota</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/80">
            <div className="flex justify-between items-center text-xs font-bold text-rose-800">
              <span>Pedido #{deliveryItem.pedidoId || "S/N"}</span>
              <span>{deliveryItem.cliente}</span>
            </div>
            <p className="text-xs text-rose-700/80 mt-1">
              📍 {deliveryItem.endereco || "Endereço cadastrado"}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Motivo do Insucesso *
            </label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
            >
              <option value="Cliente Ausente / Portaria Fechada">Cliente Ausente / Portaria Fechada</option>
              <option value="Endereço não Localizado / Incompleto">Endereço não Localizado / Incompleto</option>
              <option value="Pedido Recusado pelo Cliente">Pedido Recusado pelo Cliente</option>
              <option value="Condomínio não Autorizou Entrada">Condomínio não Autorizou Entrada</option>
              <option value="Horário de Recebimento Expirado">Horário de Recebimento Expirado</option>
              <option value="Avaria / Problema no Transporte">Avaria / Problema no Transporte</option>
              <option value="Outro Motivo">Outro Motivo</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Conduta / Ação Imediata
            </label>
            <select
              value={acaoRecomendada}
              onChange={(e) => setAcaoRecomendada(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
            >
              <option value="Reagendar para próxima rota">Reagendar para próxima rota</option>
              <option value="Retornar mercadoria ao estoque/base">Retornar mercadoria ao estoque/base</option>
              <option value="Aguardando contato telefônico do cliente">Aguardando contato telefônico do cliente</option>
              <option value="Cancelamento da entrega">Cancelamento da entrega</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Detalhes Adicionais
            </label>
            <textarea
              rows={2}
              value={detalhes}
              onChange={(e) => setDetalhes(e.target.value)}
              placeholder="Ex: Porteiro informou que a administração só recebe até as 17h..."
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>

          {deliveryItem.telefone && (
            <button
              type="button"
              onClick={handleWhatsAppContact}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition-colors"
            >
              <MessageSquare size={16} className="text-emerald-600" />
              Notificar Cliente no WhatsApp sobre a Ocorrência
            </button>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <AlertTriangle size={16} />
              {isSaving ? "Gravando..." : "Salvar Ocorrência"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
