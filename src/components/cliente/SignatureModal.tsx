import React, { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { X, Check } from "lucide-react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

interface SignatureModalProps {
  order: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function SignatureModal({ order, onClose, onSuccess }: SignatureModalProps) {
  const sigCanvas = useRef<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clear = () => {
    sigCanvas.current?.clear();
  };

  const handleSave = async () => {
    if (sigCanvas.current?.isEmpty()) {
      alert("Por favor, assine antes de salvar.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const signatureDataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL("image/png");
      
      const orderRef = doc(db, "ordens_servico", order.id);
      await updateDoc(orderRef, {
        assinaturaCliente: signatureDataUrl,
        assinaturaClienteData: serverTimestamp(),
      });
      
      onSuccess();
    } catch (err) {
      console.error("Erro ao salvar assinatura:", err);
      alert("Erro ao salvar assinatura.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="text-lg font-medium text-slate-900">Assinar Aceite</h2>
          <button onClick={onClose} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-600 shadow-sm transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto">
          <p className="text-sm text-slate-600 mb-4">
            Confirmo que o serviço <strong>{order.servicoNome || order.itens?.[0]?.nome}</strong> foi executado de forma satisfatória no condomínio.
          </p>
          
          <div className="border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden bg-slate-50 relative">
            <SignatureCanvas
              ref={sigCanvas}
              canvasProps={{
                className: "w-full h-48 sm:h-64 cursor-crosshair touch-none"
              }}
              backgroundColor="rgba(248,250,252,1)"
            />
            <div className="absolute bottom-2 right-2 flex gap-2">
               <button 
                 onClick={clear}
                 className="text-[11px] font-medium text-slate-500 bg-white px-3 py-1 rounded-full shadow-sm hover:text-slate-700"
               >
                 Limpar
               </button>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Check size={16} />
            )}
            Confirmar Assinatura
          </button>
        </div>
      </div>
    </div>
  );
}
