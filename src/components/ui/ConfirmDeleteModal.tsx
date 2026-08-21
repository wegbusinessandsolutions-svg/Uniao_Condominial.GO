import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
}

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmação de Exclusão',
  message = 'Tem certeza que deseja excluir este item?'
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-red-50/50">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={20} />
            <h2 className="text-lg font-bold">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <p className="text-slate-700 text-[15px]">{message}</p>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
          >
            Não
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-6 py-2 text-sm font-medium text-white bg-red-600 rounded-lg shadow-sm hover:bg-red-700 transition-colors"
          >
            Sim, tenho quero realmente excluir
          </button>
        </div>
      </div>
    </div>
  );
}
