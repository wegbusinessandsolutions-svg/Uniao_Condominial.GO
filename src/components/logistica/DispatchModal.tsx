import React, { useState } from "react";
import { X, Truck, User, Clock, AlertCircle, CheckCircle, Navigation, MapPin } from "lucide-react";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import { registrarMudancaStatusPedido } from "../../lib/orderLogger";

interface DispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  deliveryItem?: any;
  availableDrivers?: string[];
}

export default function DispatchModal({
  isOpen,
  onClose,
  onSuccess,
  deliveryItem,
  availableDrivers = ["Carlos Santos (Moto)", "Marcos Oliveira (Fiorino)", "Roberto Souza (Van)", "Lucas Silva (Carro Próprio)"],
}: DispatchModalProps) {
  const [entregador, setEntregador] = useState(deliveryItem?.entregador || availableDrivers[0] || "");
  const [veiculo, setVeiculo] = useState(deliveryItem?.veiculo || "Moto Honda CG 160 (Placa ABC-1234)");
  const [horaSaida, setHoraSaida] = useState(
    deliveryItem?.horaSaida || new Date().toISOString().split("T")[1].substring(0, 5)
  );
  const [previsaoChegada, setPrevisaoChegada] = useState(deliveryItem?.previsaoChegada || "");
  const [sequenciaParada, setSequenciaParada] = useState(deliveryItem?.sequencia || 1);
  const [observacaoRota, setObservacaoRota] = useState(deliveryItem?.observacoes || "");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !deliveryItem) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { db } = await initFirebase();

      const updatePayload: any = {
        status: "Em trânsito",
        entregador,
        veiculo,
        horaSaida,
        previsaoChegada,
        sequencia: Number(sequenciaParada),
        observacoes: observacaoRota,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, "entregas", deliveryItem.id), updatePayload);

      // Also update linked pedidos_venda if exists
      if (deliveryItem.pedidoId) {
        const pedidosSnap = await getDocs(
          query(collection(db, "pedidos_venda"), where("id_externo", "==", deliveryItem.pedidoId))
        );
        if (!pedidosSnap.empty) {
          const pedidoDoc = pedidosSnap.docs[0];
          await registrarMudancaStatusPedido(
            db,
            pedidoDoc.id,
            "Em trânsito",
            entregador,
            `Pedido despachado para entrega com ${entregador} (${veiculo}). Saída: ${horaSaida}.`
          );
        }
      }

      await logAction(
        `Despacho de entrega: Pedido #${deliveryItem.pedidoId || deliveryItem.id} com ${entregador}`,
        "Logística",
        {
          id: deliveryItem.id,
          pedidoId: deliveryItem.pedidoId,
          entregador,
          veiculo,
          status: "Em trânsito",
        }
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Erro ao despachar pedido:", err);
      alert("Erro ao despachar pedido: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Truck size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Despachar Pedido para Rota</h2>
              <p className="text-xs text-blue-100">Atribuir entregador e iniciar rastreamento</p>
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
          {/* Order Details Header */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                Pedido #{deliveryItem.pedidoId || "S/N"}
              </span>
              <h3 className="font-bold text-slate-900 text-sm mt-0.5">{deliveryItem.cliente}</h3>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <MapPin size={13} className="text-slate-400 shrink-0" />
                {deliveryItem.endereco || "Endereço cadastrado no pedido"}
                {deliveryItem.bairro ? `, ${deliveryItem.bairro}` : ""}
              </p>
            </div>
            {deliveryItem.valorTotal && (
              <span className="text-xs font-extrabold text-slate-800 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm shrink-0">
                R$ {Number(deliveryItem.valorTotal).toFixed(2)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Entregador Responsável *
              </label>
              <div className="relative">
                <select
                  value={entregador}
                  onChange={(e) => setEntregador(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {availableDrivers.map((driver, idx) => (
                    <option key={idx} value={driver}>
                      {driver}
                    </option>
                  ))}
                  <option value="Transportadora Terceirizada">Transportadora Terceirizada</option>
                  <option value="Retirada no Balcão">Retirada no Balcão</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Veículo / Placa
              </label>
              <input
                type="text"
                value={veiculo}
                onChange={(e) => setVeiculo(e.target.value)}
                placeholder="Ex: Fiorino (Placa ABC-1234)"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Hora de Saída
              </label>
              <input
                type="time"
                value={horaSaida}
                onChange={(e) => setHoraSaida(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Previsão Chegada
              </label>
              <input
                type="time"
                value={previsaoChegada}
                onChange={(e) => setPrevisaoChegada(e.target.value)}
                placeholder="00:00"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Ordem na Rota
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={sequenciaParada}
                onChange={(e) => setSequenciaParada(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Instruções / Observações de Rota
            </label>
            <textarea
              rows={2}
              value={observacaoRota}
              onChange={(e) => setObservacaoRota(e.target.value)}
              placeholder="Ex: Ligar 10 min antes, entregar na portaria 2 com o porteiro Silva..."
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

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
              className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Truck size={16} />
              {isSaving ? "Despachando..." : "Confirmar e Iniciar Rota"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
