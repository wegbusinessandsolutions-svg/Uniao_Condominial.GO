import React from "react";
import { ReportFilterDef } from "./reportCatalog";

interface ReportFiltersProps {
  filters: ReportFilterDef[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
}

export default function ReportFilters({ filters, values, onChange }: ReportFiltersProps) {
  if (!filters || filters.length === 0) return null;

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap gap-4 items-end no-print">
      {filters.map((filter) => {
        if (filter.type === "dateRange") {
          return (
            <div key={filter.key} className="flex gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{filter.label} (De)</label>
                <input
                  type="date"
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white transition-colors"
                  value={values.startDate || ""}
                  onChange={(e) => onChange('startDate', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Até</label>
                <input
                  type="date"
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white transition-colors"
                  value={values.endDate || ""}
                  onChange={(e) => onChange('endDate', e.target.value)}
                />
              </div>
            </div>
          );
        }

        if (filter.type === "select") {
          return (
            <div key={filter.key} className="flex flex-col gap-1 min-w-[150px]">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{filter.label}</label>
              <select
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white transition-colors"
                value={values[filter.key] || ""}
                onChange={(e) => onChange(filter.key, e.target.value)}
              >
                {filter.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        
        if (filter.type === "text") {
          return (
            <div key={filter.key} className="flex flex-col gap-1 min-w-[150px]">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{filter.label}</label>
              <input
                type="text"
                placeholder={filter.label}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white transition-colors"
                value={values[filter.key] || ""}
                onChange={(e) => onChange(filter.key, e.target.value)}
              />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
