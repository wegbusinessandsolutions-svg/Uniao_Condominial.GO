import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Printer, Filter, ChevronRight, FileText, Download, Database, HardDriveDownload } from "lucide-react";
import { REPORT_CATALOG, ReportDefinition } from "./reportCatalog";
import { useReportData } from "./useReportData";
import ReportHeader from "./ReportHeader";
import ReportFooter from "./ReportFooter";
import ReportFilters from "./ReportFilters";
import ReportTable from "./ReportTable";
import { useToast } from "../../../context/ToastContext";
import { BackupCsvModal } from "../../../components/admin/BackupCsvModal";

export default function Relatorios() {
  const { addToast } = useToast();
  const [activeModule, setActiveModule] = useState<string>("Administrativo");
  const [selectedReportId, setSelectedReportId] = useState<string>("admin_users");
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  
  const [filters, setFilters] = useState<Record<string, any>>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return {
      startDate: d.toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      status: "Todos",
      role: "Todos",
      department: "Todos",
      level: "Todos",
      statusEstoque: "Todos",
      formaPagamento: "Todos",
      modulo: "Todos"
    };
  });

  const { loading, data, error, fetchRows } = useReportData();
  const reportRef = useRef<HTMLDivElement>(null);

  const activeReport = REPORT_CATALOG.find(r => r.id === selectedReportId) as ReportDefinition;
  const modules = Array.from(new Set(REPORT_CATALOG.map(r => r.module)));
  const moduleReports = REPORT_CATALOG.filter(r => r.module === activeModule);

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleGenerate = async (showToast: boolean = true) => {
    if (activeReport) {
      const result = await fetchRows(activeReport, filters);
      if (result?.success) {
        if (showToast) addToast("Relatório gerado com sucesso!", "success");
      } else if (result?.error) {
        addToast(`Erro: ${result.error}`, "error");
      }
    }
  };

  useEffect(() => {
    // Quando mudar o relatorio, gerar automaticamente com os filtros padrao sem toast
    handleGenerate(false);
  }, [selectedReportId]);

  const handlePrint = () => {
    if (window.self !== window.top) {
      addToast("O bloqueio do navegador impede impressão aqui. Abra o app em uma NOVA GUIA (ícone no topo direito) para imprimir.", "warning");
      return;
    }
    window.print();
  };

  const hasDateFilter = activeReport?.filters.some(f => f.type === 'dateRange');
  const summaryCards = activeReport && data ? activeReport.buildSummaryCards(data) : [];

  return (
    <div className="w-full max-w-full min-h-screen">
      <BackupCsvModal 
        isOpen={isBackupModalOpen} 
        onClose={() => setIsBackupModalOpen(false)} 
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Central de Relatórios</h1>
          <p className="text-sm text-slate-500 mt-1">Gere, analise e imprima relatórios operacionais e gerenciais.</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/backup-exportacao"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer active:scale-[0.99] shrink-0"
            title="Central Completa de Backup e Exportação de Dados em JSON e CSV"
          >
            <Database size={16} />
            <span>Central de Backup JSON/CSV</span>
          </Link>
          <button
            type="button"
            onClick={() => setIsBackupModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer active:scale-[0.99] shrink-0 border border-slate-200"
            title="Exportação rápida de dados em formato CSV"
          >
            <Download size={16} />
            <span>Backup Rápido CSV</span>
          </button>
        </div>
      </div>

      <div className="flex gap-8 items-start relative">
        
        {/* SIDEBAR - MÓDULOS E RELATÓRIOS */}
        <div className="w-64 shrink-0 flex flex-col gap-6 sticky top-8 print:hidden">
          <div>
            <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-3 px-2">Módulos</h3>
            <div className="flex flex-col gap-1">
              {modules.map(mod => (
                <button
                  key={mod}
                  onClick={() => setActiveModule(mod)}
                  className={`text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeModule === mod ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {mod}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-3 px-2">Relatórios Disponíveis</h3>
            <div className="flex flex-col gap-1">
              {moduleReports.map(rep => (
                <button
                  key={rep.id}
                  onClick={() => setSelectedReportId(rep.id)}
                  className={`text-left px-4 py-3 rounded-lg text-xs flex items-center justify-between transition-colors ${selectedReportId === rep.id ? 'bg-[#0071e3]/10 text-[#0071e3] font-bold border border-[#0071e3]/20' : 'text-slate-600 hover:bg-slate-100 border border-transparent'}`}
                >
                  <span className="flex-1 pr-2 leading-tight">{rep.title}</span>
                  {selectedReportId === rep.id && <ChevronRight className="w-3 h-3 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ÁREA PRINCIPAL DO RELATÓRIO */}
        <div className="flex-1 min-w-0">
          
          {/* PAINEL DE FILTROS E AÇÕES */}
          <div className="mb-6 flex justify-between items-end bg-white p-4 rounded-xl shadow-sm border border-slate-200 print:hidden">
            <div className="flex-1">
               <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                 <Filter className="w-4 h-4 text-slate-400" /> Filtros do Relatório
               </h3>
               <ReportFilters 
                  filters={activeReport?.filters || []} 
                  values={filters} 
                  onChange={handleFilterChange} 
               />
            </div>
            <div className="flex gap-2 ml-4 mb-2 shrink-0">
              <button 
                onClick={() => handleGenerate(true)}
                disabled={loading}
                className="px-6 py-2 bg-slate-800 text-white font-medium text-sm rounded-lg hover:bg-slate-700 shadow-sm transition-all disabled:opacity-50"
              >
                {loading ? 'Gerando...' : 'Gerar Relatório'}
              </button>
              <button 
                onClick={handlePrint}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-50 shadow-sm transition-all flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
            </div>
          </div>

          {/* VISUALIZAÇÃO E IMPRESSÃO (A4 CONTAINER) */}
          <div className="bg-slate-200 p-8 rounded-xl shadow-inner overflow-auto print:bg-white print:p-0 print:m-0 print:shadow-none print:overflow-visible">
             <div 
                ref={reportRef}
                className="bg-white min-h-[297mm] max-w-[210mm] mx-auto p-[15mm] shadow-xl print:shadow-none print:p-0 print:m-0 print:w-full print:h-auto print:max-w-none text-slate-900"
             >
                <ReportHeader 
                  reportCode={activeReport?.code || ""}
                  reportTitle={activeReport?.title || ""}
                  filtersUsed={filters}
                  hasDateFilter={hasDateFilter}
                />

                {/* KPI Summary Cards */}
                {summaryCards.length > 0 && (
                  <div className="flex gap-4 mb-6 print:break-inside-avoid">
                    {summaryCards.map((card, idx) => {
                      let colorClass = "border-slate-200 bg-slate-50";
                      if (card.tone === "success") colorClass = "border-green-200 bg-green-50 text-green-900";
                      if (card.tone === "warning") colorClass = "border-amber-200 bg-amber-50 text-amber-900";
                      if (card.tone === "danger") colorClass = "border-red-200 bg-red-50 text-red-900";

                      return (
                        <div key={idx} className={`flex-1 p-3 rounded border ${colorClass}`}>
                          <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">{card.label}</p>
                          <p className="text-lg font-black tracking-tight">{card.value}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* DATA TABLE */}
                {error ? (
                  <div className="p-4 text-center text-red-600 bg-red-50 border border-red-200 rounded text-sm print:hidden">
                    {error}
                  </div>
                ) : loading ? (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-400 print:hidden">
                     <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-400 rounded-full animate-spin mb-4"></div>
                     <p className="text-sm">Processando dados...</p>
                  </div>
                ) : (
                  <ReportTable columns={activeReport?.columns || []} data={data} />
                )}

                <ReportFooter />
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
