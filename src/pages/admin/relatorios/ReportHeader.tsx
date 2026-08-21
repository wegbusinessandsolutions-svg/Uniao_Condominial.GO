import React from "react";
import { CompanyLogo } from "../../../components/ui/CompanyLogo";

interface ReportHeaderProps {
  reportCode: string;
  reportTitle: string;
  filtersUsed: Record<string, any>;
  hasDateFilter?: boolean;
}

export default function ReportHeader({
  reportCode,
  reportTitle,
  filtersUsed,
  hasDateFilter,
}: ReportHeaderProps) {
  const formatFilters = () => {
    const keys = Object.keys(filtersUsed).filter(k => k !== 'startDate' && k !== 'endDate');
    if (keys.length === 0) return "Nenhum filtro adicional aplicado";
    
    return keys.map(k => {
      const val = filtersUsed[k];
      const valStr = typeof val === 'object' && val !== null ? (val.label || JSON.stringify(val)) : String(val || '');
      return `${k}: ${valStr}`;
    }).join(" | ");
  };

  return (
    <div className="hidden print:block w-full mb-8">
      {/* Top Banner */}
      <div className="flex justify-between items-center border-b-2 border-slate-800 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <CompanyLogo className="w-16 h-16 object-contain" />
          <div>
            <h1 className="text-[14px] font-bold text-slate-900 leading-tight">
              UNIÃO CONDOMINIAL — Gestão Condominial
            </h1>
            <p className="text-[10px] text-slate-600">
              CNPJ: 00.000.000/0000-00 | Goiânia - GO
            </p>
          </div>
        </div>
      </div>

      {/* Report Title & Metadata */}
      <div className="flex justify-between items-end border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[12px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {reportCode}
            </span>
            <h2 className="text-[16px] font-bold text-slate-900">{reportTitle}</h2>
          </div>
          <div className="text-[10px] text-slate-600 space-y-0.5 mt-2">
            {hasDateFilter && filtersUsed.startDate && filtersUsed.endDate && (
              <p>Período filtrado: {filtersUsed.startDate} a {filtersUsed.endDate}</p>
            )}
            <p>Filtros aplicados: {formatFilters()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
