import React, { useState } from "react";
import { X, CheckCircle2, MapPin, User, FileCheck, ShieldCheck } from "lucide-react";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import { registrarMudancaStatusPedido } from "../../lib/orderLogger";

interface DeliveryConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  deliveryItem?: any;
}

export default function DeliveryConfirmModal({
  isOpen,
  onClose,
  onSuccess,
  deliveryItem,
}: DeliveryConfirmModalProps) {
  const [recebedor, setRecebedor] = useState("");
  const [funcaoRecebedor, setFuncaoRecebedor] = useState("Portaria / Zeladoria");
  const [documentoRecebedor, setDocumentoRecebedor] = useState("");
  const [assinouCanhoto, setAssinouCanhoto] = useState(true);
  const [observacao, setObservacao] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !deliveryItem) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recebedor.trim()) {
      alert("Por favor, informe o nome de quem recebeu a mercadoria.");
      return;
    }

    setIsSaving(true);
    try {
      const { db } = await initFirebase();

      let locationInfo = "";
      try {
        if (navigator.geolocation) {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, enableHighAccuracy: true });
          });
          locationInfo = ` | Lat ${pos.coords.latitude.toFixed(6)}, Lng ${pos.coords.longitude.toFixed(6)}`;
        }
      } catch (err) {
        console.warn("Geolocalização não capturada:", err);
      }

      const updatePayload: any = {
        status: "Entregue",
        recebedor: recebedor.trim(),
        funcaoRecebedor,
        documentoRecebedor: documentoRecebedor.trim(),
        assinouCanhoto,
        horaEntrega: new Date().toISOString().split("T")[1].substring(0, 5),
        geolocalizacaoComprovante: locationInfo || "Local confirmado via sistema",
        observacaoConclusao: observacao.trim(),
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
            "Entregue",
            deliveryItem.entregador || "Entregador",
            `Mercadoria entregue com sucesso para ${recebedor.trim()} (${funcaoRecebedor}). Canhoto assinado: ${
              assinouCanhoto ? "Sim" : "Não"
            }${locationInfo}`
          );
        }
      }

      await logAction(
        `Entrega concluída: Pedido #${deliveryItem.pedidoId || deliveryItem.id} recebido por ${recebedor.trim()}`,
        "Logística",
        {
          id: deliveryItem.id,
          pedidoId: deliveryItem.pedidoId,
          recebedor: recebedor.trim(),
          funcao: funcaoRecebedor,
          status: "Entregue",
        }
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Erro ao confirmar entrega:", err);
      alert("Erro ao confirmar entrega: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <CheckCircle2 size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Comprovante de Entrega</h2>
              <p className="text-xs text-emerald-100">Registrar recebimento da mercadoria</p>
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
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
            <div className="flex justify-between items-center text-xs font-bold text-emerald-800">
              <span>Pedido #{deliveryItem.pedidoId || "S/N"}</span>
              <span>{deliveryItem.cliente}</span>
            </div>
            <p className="text-xs text-emerald-700/80 mt-1">
              📍 {deliveryItem.endereco || "Endereço cadastrado"}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nome de Quem Recebeu *
            </label>
            <input
              type="text"
              required
              value={recebedor}
              onChange={(e) => setRecebedor(e.target.value)}
              placeholder="Ex: Seu Antônio ou Síndica Maria"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Função / Cargo
              </label>
              <select
                value={funcaoRecebedor}
                onChange={(e) => setFuncaoRecebedor(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="Portaria / Zeladoria">Portaria / Zeladoria</option>
                <option value="Síndico(a) / Administração">Síndico(a) / Administração</option>
                <option value="Morador(a) / Cliente">Morador(a) / Cliente</option>
                <option value="Recepcionista / Atendente">Recepcionista / Atendente</option>
                <option value="Outro Responsável">Outro Responsável</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                RG / CPF / Documento (Opcional)
              </label>
              <input
                type="text"
                value={documentoRecebedor}
                onChange={(e) => setDocumentoRecebedor(e.target.value)}
                placeholder="Ex: RG 12.345.678"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
            <input
              type="checkbox"
              id="canhotoCheck"
              checked={assinouCanhoto}
              onChange={(e) => setAssinouCanhoto(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
            />
            <label htmlFor="canhotoCheck" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Canhoto da Nota Fiscal / Romaneio assinado fisicamente pelo recebedor
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Observações / Comentários
            </label>
            <textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Deixado na guarita da torre B com o porteiro..."
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
              className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              {isSaving ? "Finalizando..." : "Confirmar Entrega"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
