import React from "react";
import { useAuth } from "../../../context/AuthContext";

export default function ReportFooter() {
  const { profile } = useAuth();
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="hidden print:block w-full mt-10 pt-4" style={{ pageBreakInside: 'avoid' }}>
      <div className="border border-slate-200 rounded p-3 mb-8 bg-slate-50">
        <p className="text-[9px] text-slate-500 text-justify uppercase tracking-wider leading-relaxed">
          <strong>AVISO DE CONFIDENCIALIDADE:</strong> as informações contidas neste relatório são estritamente confidenciais e de uso exclusivo da União Condominial.GO. A divulgação, reprodução ou distribuição não autorizada está sujeita às penalidades legais cabíveis.
        </p>
      </div>

      <div className="flex justify-around items-end mb-8 mt-12">
        <div className="text-center w-64">
          <div className="border-t border-slate-400 pt-1 mb-1"></div>
          <p className="text-[10px] font-bold text-slate-800">Responsável Administrativo</p>
          <p className="text-[9px] text-slate-500">União Condominial.GO Gestão</p>
        </div>
        <div className="text-center w-64">
          <div className="border-t border-slate-400 pt-1 mb-1"></div>
          <p className="text-[10px] font-bold text-slate-800">Operador Emissor</p>
          <p className="text-[9px] text-slate-500">{profile?.displayName || profile?.email || 'Operador Padrão'}</p>
        </div>
      </div>

      <div className="flex justify-between items-center text-[9px] text-slate-500 border-t border-slate-200 pt-2">
        <p>Emitido em: {dateStr} às {timeStr}</p>
        {/* CSS counters will handle page numbers during actual print if configured in css */}
        <p className="print-page-number"></p>
      </div>
    </div>
  );
}
