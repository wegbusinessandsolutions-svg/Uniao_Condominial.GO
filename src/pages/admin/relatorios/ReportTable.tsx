import React from "react";
import { ReportColumnDef } from "./reportCatalog";

interface ReportTableProps {
  columns: ReportColumnDef[];
  data: any[];
}

export default function ReportTable({ columns, data }: ReportTableProps) {
  
  const formatCell = (value: any, format?: string) => {
    if (value === null || value === undefined) return "-";
    
    switch (format) {
      case "currency":
        return typeof value === 'number' 
          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
          : value;
      case "date":
        try {
          if (!value) return "-";
          const date = new Date(value);
          return date.toLocaleDateString('pt-BR');
        } catch {
          return value;
        }
      case "percent":
        return typeof value === 'number' ? `${value.toFixed(2)}%` : value;
      case "badge":
        let colorClass = "bg-slate-100 text-slate-600";
        const valStr = String(value).toLowerCase();
        
        if (["pago", "aprovado", "concluído", "ativo", "regular", "autorizada"].includes(valStr)) {
          colorClass = "bg-green-100 text-green-700";
        } else if (["pendente", "processando", "baixo", "atenção"].includes(valStr)) {
          colorClass = "bg-amber-100 text-amber-700";
        } else if (["cancelado", "falha", "vencido", "crítico", "rejeitado"].includes(valStr)) {
          colorClass = "bg-red-100 text-red-700";
        }

        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
            {value}
          </span>
        );
      default:
        return String(value);
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="py-8 text-center text-slate-500 bg-slate-50 border border-slate-200 rounded-lg">
        Nenhum registro encontrado para os filtros selecionados.
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-slate-300">
            {columns.map((col, idx) => (
              <th 
                key={col.key || idx} 
                className={`py-3 px-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr key={row.id || rowIdx} className="border-b border-slate-200 hover:bg-slate-50 print:break-inside-avoid">
              {columns.map((col, colIdx) => (
                <td 
                  key={`${rowIdx}-${col.key || colIdx}`} 
                  className={`py-2 px-2 text-[11px] text-slate-800 ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {formatCell(row[col.key], col.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
