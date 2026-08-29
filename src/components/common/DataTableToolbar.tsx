import React from "react";
import { Search, X, Filter, Download, Printer, Plus, RefreshCw } from "lucide-react";

export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

interface DataTableToolbarProps {
  searchValue: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;

  // Filter Pills/Tabs
  filterOptions?: FilterOption[];
  activeFilter?: string;
  onFilterChange?: (filterValue: string) => void;

  // Secondary Dropdown or Period Filter
  periodOptions?: { label: string; value: string }[];
  activePeriod?: string;
  onPeriodChange?: (val: string) => void;

  // Actions
  onExportCsv?: () => void;
  onPrint?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;

  // Primary Action Button (e.g. + Novo Registro)
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  primaryActionIcon?: React.ElementType;

  // Total counter
  totalRecords?: number;
  filteredRecords?: number;
  customActions?: React.ReactNode;
}

export function DataTableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar registros...",
  filterOptions,
  activeFilter,
  onFilterChange,
  periodOptions,
  activePeriod,
  onPeriodChange,
  onExportCsv,
  onPrint,
  onRefresh,
  isRefreshing,
  primaryActionLabel,
  onPrimaryAction,
  primaryActionIcon: PrimaryIcon = Plus,
  totalRecords,
  filteredRecords,
  customActions,
}: DataTableToolbarProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 shadow-2xs space-y-3">
      {/* Top row: Search, Period Filter, and Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[240px]">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
              title="Limpar busca"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          {periodOptions && periodOptions.length > 0 && onPeriodChange && (
            <select
              value={activePeriod}
              onChange={(e) => onPeriodChange(e.target.value)}
              aria-label="Filtrar por período"
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              {periodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {/* Refresh button */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-all cursor-pointer disabled:opacity-50"
              title="Recarregar dados"
            >
              <RefreshCw size={15} className={isRefreshing ? "animate-spin text-blue-600" : ""} />
            </button>
          )}

          {/* Export CSV button */}
          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Exportar dados filtrados em CSV"
            >
              <Download size={14} className="text-slate-500" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
          )}

          {/* Print button */}
          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="p-2 sm:px-3 sm:py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Imprimir relatório"
            >
              <Printer size={14} className="text-slate-500" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          )}

          {customActions}

          {/* Primary Action Button */}
          {primaryActionLabel && onPrimaryAction && (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <PrimaryIcon size={15} />
              <span>{primaryActionLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom row: Filter Chips & Counters */}
      {(filterOptions && filterOptions.length > 0) || totalRecords !== undefined ? (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          {/* Filter Pills */}
          {filterOptions && filterOptions.length > 0 && onFilterChange && (
            <div className="flex flex-wrap items-center gap-1.5">
              {filterOptions.map((opt) => {
                const isActive = activeFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onFilterChange(opt.value)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {opt.count !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {opt.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Record Counter */}
          {totalRecords !== undefined && (
            <div className="text-[11px] font-medium text-slate-400 ml-auto">
              {filteredRecords !== undefined && filteredRecords !== totalRecords ? (
                <span>
                  Exibindo <strong className="text-slate-700 dark:text-slate-200 font-bold">{filteredRecords}</strong> de {totalRecords} registros
                </span>
              ) : (
                <span>
                  Total: <strong className="text-slate-700 dark:text-slate-200 font-bold">{totalRecords}</strong> registros
                </span>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
export default DataTableToolbar;
