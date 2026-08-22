import React from "react";
import {
  Search,
  Filter,
  X,
  Calendar,
  RotateCcw,
  SlidersHorizontal,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export interface FilterState {
  search: string;
  searchField: string; // 'all' or specific column key
  status: string; // 'all' or specific status
  dateField: string; // 'createdAt', 'updatedAt', or custom date key
  startDate: string;
  endDate: string;
  datePreset: string; // 'all', 'today', '7days', '30days', 'month', 'custom'
  selectFilters: Record<string, string>; // dynamic key -> value
  numberFilters: Record<string, { min?: number | ""; max?: number | "" }>; // dynamic key -> { min, max }
  sortBy: string;
  sortOrder: "asc" | "desc" | "default";
}

export interface DynamicFilterOption {
  key: string;
  label: string;
  type: "select" | "date" | "number" | "text";
  options?: string[];
}

interface GenericTableFiltersProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  onResetFilters: () => void;
  availableColumns: { key: string; label: string }[];
  dynamicOptions: DynamicFilterOption[];
  statusOptions: string[];
  statusCounts: Record<string, number>;
  totalCount: number;
  filteredCount: number;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const initialFilterState: FilterState = {
  search: "",
  searchField: "all",
  status: "all",
  dateField: "createdAt",
  startDate: "",
  endDate: "",
  datePreset: "all",
  selectFilters: {},
  numberFilters: {},
  sortBy: "",
  sortOrder: "default",
};

export default function GenericTableFilters({
  filters,
  onFilterChange,
  onResetFilters,
  availableColumns,
  dynamicOptions,
  statusOptions,
  statusCounts,
  totalCount,
  filteredCount,
  isOpen,
  onToggleOpen,
}: GenericTableFiltersProps) {
  // Count how many non-default filters are active
  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (filters.search.trim()) count++;
    if (filters.searchField !== "all") count++;
    if (filters.status !== "all") count++;
    if (filters.startDate || filters.endDate) count++;
    if (filters.datePreset !== "all") count++;
    Object.values(filters.selectFilters).forEach((val) => {
      if (val && val !== "all") count++;
    });
    Object.values(filters.numberFilters).forEach((range) => {
      if (range.min !== "" && range.min !== undefined) count++;
      if (range.max !== "" && range.max !== undefined) count++;
    });
    return count;
  }, [filters]);

  const handleDatePreset = (preset: string) => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    let start = "";
    let end = formatDate(today);

    if (preset === "today") {
      start = formatDate(today);
    } else if (preset === "7days") {
      const past = new Date(today);
      past.setDate(past.getDate() - 7);
      start = formatDate(past);
    } else if (preset === "30days") {
      const past = new Date(today);
      past.setDate(past.getDate() - 30);
      start = formatDate(past);
    } else if (preset === "month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      start = formatDate(firstDay);
    } else if (preset === "all") {
      start = "";
      end = "";
    }

    onFilterChange({
      ...filters,
      datePreset: preset,
      startDate: start,
      endDate: end,
    });
  };

  const handleSelectFieldChange = (key: string, val: string) => {
    onFilterChange({
      ...filters,
      selectFilters: {
        ...filters.selectFilters,
        [key]: val,
      },
    });
  };

  const handleNumberFieldChange = (
    key: string,
    field: "min" | "max",
    val: string
  ) => {
    const current = filters.numberFilters[key] || { min: "", max: "" };
    const parsed = val === "" ? "" : Number(val);
    onFilterChange({
      ...filters,
      numberFilters: {
        ...filters.numberFilters,
        [key]: {
          ...current,
          [field]: parsed,
        },
      },
    });
  };

  const removeFilter = (type: string, key?: string) => {
    if (type === "search") {
      onFilterChange({ ...filters, search: "" });
    } else if (type === "status") {
      onFilterChange({ ...filters, status: "all" });
    } else if (type === "date") {
      onFilterChange({
        ...filters,
        startDate: "",
        endDate: "",
        datePreset: "all",
      });
    } else if (type === "select" && key) {
      const updated = { ...filters.selectFilters };
      delete updated[key];
      onFilterChange({ ...filters, selectFilters: updated });
    } else if (type === "number" && key) {
      const updated = { ...filters.numberFilters };
      delete updated[key];
      onFilterChange({ ...filters, numberFilters: updated });
    }
  };

  return (
    <div className="space-y-3 print:hidden">
      {/* Top Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Global Search Input with Field Selector */}
        <div className="flex-1 flex items-center bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500 transition-all">
          <div className="pl-3.5 pr-2 text-slate-400 flex items-center justify-center">
            <Search size={18} />
          </div>

          <input
            type="text"
            placeholder={
              filters.searchField === "all"
                ? "Buscar em todos os campos (nome, código, documento, texto)..."
                : `Buscar em "${availableColumns.find((c) => c.key === filters.searchField)?.label || filters.searchField}"...`
            }
            value={filters.search}
            onChange={(e) =>
              onFilterChange({ ...filters, search: e.target.value })
            }
            className="flex-1 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none bg-transparent"
          />

          {filters.search && (
            <button
              onClick={() => onFilterChange({ ...filters, search: "" })}
              className="p-1.5 mr-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              title="Limpar busca"
            >
              <X size={15} />
            </button>
          )}

          {availableColumns.length > 1 && (
            <div className="border-l border-slate-200 pl-2 pr-2 py-1.5 hidden md:flex items-center">
              <select
                value={filters.searchField}
                onChange={(e) =>
                  onFilterChange({ ...filters, searchField: e.target.value })
                }
                className="text-xs bg-slate-50 text-slate-600 font-medium py-1 px-2 rounded-lg border-0 outline-none cursor-pointer hover:bg-slate-100"
              >
                <option value="all">Todos os campos</option>
                {availableColumns.map((col) => (
                  <option key={col.key} value={col.key}>
                    Coluna: {col.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Filter Toggle Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleOpen}
            className={`px-4 py-2.5 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer select-none shadow-xs ${
              isOpen || activeFiltersCount > 0
                ? "bg-sky-50 border-sky-300 text-sky-700 shadow-sky-100/50"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <SlidersHorizontal size={16} className={activeFiltersCount > 0 ? "text-sky-600" : "text-slate-500"} />
            <span>Filtros Avançados</span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-600 text-white">
                {activeFiltersCount}
              </span>
            )}
            {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {activeFiltersCount > 0 && (
            <button
              onClick={onResetFilters}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Limpar todos os filtros"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Status Bar when status is available */}
      {statusOptions.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider mr-1 shrink-0">
            Status:
          </span>
          <button
            onClick={() => onFilterChange({ ...filters, status: "all" })}
            className={`px-3 py-1 rounded-lg font-semibold transition-all shrink-0 cursor-pointer ${
              filters.status === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Todos ({totalCount})
          </button>
          {statusOptions.map((st) => {
            const count = statusCounts[st] || 0;
            const isSelected = filters.status === st;
            const isPositive =
              st.toLowerCase().includes("ativo") ||
              st.toLowerCase().includes("concluid") ||
              st.toLowerCase().includes("pago") ||
              st.toLowerCase().includes("aprov");
            const isNegative =
              st.toLowerCase().includes("inativ") ||
              st.toLowerCase().includes("cancel") ||
              st.toLowerCase().includes("inadimp") ||
              st.toLowerCase().includes("bloq");

            return (
              <button
                key={st}
                onClick={() => onFilterChange({ ...filters, status: isSelected ? "all" : st })}
                className={`px-3 py-1 rounded-lg font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? isPositive
                      ? "bg-emerald-600 text-white shadow-xs"
                      : isNegative
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-sky-600 text-white shadow-xs"
                    : isPositive
                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
                    : isNegative
                    ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60"
                }`}
              >
                <span>{st}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-white/20" : "bg-black/5"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Expandable Advanced Filters Box */}
      {isOpen && (
        <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-5 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Filter size={17} className="text-sky-600" />
              <h4 className="text-sm font-bold text-slate-800">Painel de Filtros Avançados</h4>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Filtrando <strong>{filteredCount}</strong> de <strong>{totalCount}</strong> registros
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Date Range Preset & Inputs */}
            <div className="space-y-2 lg:col-span-2 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={14} className="text-sky-600" />
                  <span>Filtrar por Período</span>
                </label>
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleDatePreset("today")}
                    className={`px-2 py-0.5 rounded font-medium transition-colors ${
                      filters.datePreset === "today" ? "bg-sky-100 text-sky-800 font-bold" : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDatePreset("7days")}
                    className={`px-2 py-0.5 rounded font-medium transition-colors ${
                      filters.datePreset === "7days" ? "bg-sky-100 text-sky-800 font-bold" : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    7 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDatePreset("30days")}
                    className={`px-2 py-0.5 rounded font-medium transition-colors ${
                      filters.datePreset === "30days" ? "bg-sky-100 text-sky-800 font-bold" : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    30 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDatePreset("month")}
                    className={`px-2 py-0.5 rounded font-medium transition-colors ${
                      filters.datePreset === "month" ? "bg-sky-100 text-sky-800 font-bold" : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    Mês Atual
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block mb-1">De:</span>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) =>
                      onFilterChange({
                        ...filters,
                        startDate: e.target.value,
                        datePreset: "custom",
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium outline-none focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block mb-1">Até:</span>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) =>
                      onFilterChange({
                        ...filters,
                        endDate: e.target.value,
                        datePreset: "custom",
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium outline-none focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* 2. Dynamic Select & Category Filters */}
            {dynamicOptions
              .filter((opt) => opt.type === "select" && opt.key !== "status")
              .map((opt) => {
                const currentVal = filters.selectFilters[opt.key] || "all";
                return (
                  <div
                    key={opt.key}
                    className="space-y-1.5 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs"
                  >
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      {opt.label}
                    </label>
                    <select
                      value={currentVal}
                      onChange={(e) => handleSelectFieldChange(opt.key, e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-medium outline-none focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    >
                      <option value="all">Todos(as)</option>
                      {opt.options?.map((optionVal) => (
                        <option key={optionVal} value={optionVal}>
                          {optionVal}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}

            {/* 3. Numeric Range Filters (Min / Max) */}
            {dynamicOptions
              .filter((opt) => opt.type === "number")
              .map((opt) => {
                const range = filters.numberFilters[opt.key] || { min: "", max: "" };
                return (
                  <div
                    key={opt.key}
                    className="space-y-1.5 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs"
                  >
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      {opt.label} (Faixa)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="Mín"
                        value={range.min}
                        onChange={(e) =>
                          handleNumberFieldChange(opt.key, "min", e.target.value)
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium outline-none focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      />
                      <input
                        type="number"
                        placeholder="Máx"
                        value={range.max}
                        onChange={(e) =>
                          handleNumberFieldChange(opt.key, "max", e.target.value)
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium outline-none focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      />
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Bottom Actions inside Panel */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
            <button
              type="button"
              onClick={onResetFilters}
              className="text-slate-500 hover:text-red-600 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Redefinir Filtros</span>
            </button>

            <button
              type="button"
              onClick={onToggleOpen}
              className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
            >
              Fechar Painel
            </button>
          </div>
        </div>
      )}

      {/* Active Filter Chips / Badges Strip */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-slate-400 font-medium text-[11px]">Filtros ativos:</span>

          {filters.search.trim() && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200/80 font-medium">
              <span>
                Busca: <strong>"{filters.search}"</strong>
              </span>
              <button
                onClick={() => removeFilter("search")}
                className="hover:text-red-600 p-0.5 rounded-full hover:bg-sky-100"
              >
                <X size={13} />
              </button>
            </span>
          )}

          {filters.status !== "all" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-medium">
              <span>
                Status: <strong>{filters.status}</strong>
              </span>
              <button
                onClick={() => removeFilter("status")}
                className="hover:text-red-600 p-0.5 rounded-full hover:bg-emerald-100"
              >
                <X size={13} />
              </button>
            </span>
          )}

          {(filters.startDate || filters.endDate) && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200/80 font-medium">
              <span>
                Data: <strong>{filters.startDate || "..."} até {filters.endDate || "..."}</strong>
              </span>
              <button
                onClick={() => removeFilter("date")}
                className="hover:text-red-600 p-0.5 rounded-full hover:bg-purple-100"
              >
                <X size={13} />
              </button>
            </span>
          )}

          {Object.entries(filters.selectFilters).map(([key, val]) => {
            if (!val || val === "all") return null;
            const optLabel = dynamicOptions.find((o) => o.key === key)?.label || key;
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/80 font-medium"
              >
                <span>
                  {optLabel}: <strong>{val}</strong>
                </span>
                <button
                  onClick={() => removeFilter("select", key)}
                  className="hover:text-red-600 p-0.5 rounded-full hover:bg-amber-100"
                >
                  <X size={13} />
                </button>
              </span>
            );
          })}

          {Object.entries(filters.numberFilters).map(([key, range]) => {
            if (
              (range.min === "" || range.min === undefined) &&
              (range.max === "" || range.max === undefined)
            ) {
              return null;
            }
            const optLabel = dynamicOptions.find((o) => o.key === key)?.label || key;
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200/80 font-medium"
              >
                <span>
                  {optLabel}:{" "}
                  <strong>
                    {range.min !== "" ? `>= ${range.min}` : ""}{" "}
                    {range.max !== "" ? `<= ${range.max}` : ""}
                  </strong>
                </span>
                <button
                  onClick={() => removeFilter("number", key)}
                  className="hover:text-red-600 p-0.5 rounded-full hover:bg-indigo-100"
                >
                  <X size={13} />
                </button>
              </span>
            );
          })}

          <button
            onClick={onResetFilters}
            className="text-[11px] text-red-600 hover:underline font-semibold ml-1 cursor-pointer"
          >
            Limpar todos
          </button>
        </div>
      )}
    </div>
  );
}
