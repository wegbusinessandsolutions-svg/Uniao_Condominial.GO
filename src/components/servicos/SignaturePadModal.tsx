/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { X, PenTool } from "lucide-react";
import { ServiceSignature } from "../../types/serviceExecution";
import SignatureCanvasField from "./SignatureCanvasField";

interface SignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSignature: (signature: ServiceSignature) => Promise<void> | void;
  condominioNome?: string;
  servicoNome?: string;
  numeroOS?: string;
  initialNome?: string;
  initialDocumento?: string;
  initialTelefone?: string;
  initialEmail?: string;
  isSubmitting?: boolean;
}

export default function SignaturePadModal({
  isOpen,
  onClose,
  onConfirmSignature,
  condominioNome = "Condomínio",
  servicoNome = "Serviço Condominial",
  numeroOS = "OS-000",
  initialNome = "",
  initialDocumento = "",
  initialTelefone = "",
  initialEmail = "",
  isSubmitting = false,
}: SignaturePadModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 text-slate-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <PenTool size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Assinatura Digital do Responsável</h2>
              <p className="text-xs text-slate-500">
                {condominioNome} • {numeroOS}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <SignatureCanvasField
            initialNome={initialNome}
            initialDocumento={initialDocumento}
            initialTelefone={initialTelefone}
            initialEmail={initialEmail}
            condominioNome={condominioNome}
            servicoNome={servicoNome}
            numeroOS={numeroOS}
            isSubmitting={isSubmitting}
            onConfirmSignature={onConfirmSignature}
            onCancel={onClose}
            inline={false}
          />
        </div>
      </div>
    </div>
  );
}
