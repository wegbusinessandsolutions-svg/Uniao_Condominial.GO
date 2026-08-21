import React, { useState } from "react";
import { 
  Download, 
  Database, 
  CheckCircle2, 
  FileSpreadsheet, 
  X, 
  RefreshCw, 
  ShieldCheck, 
  Clock, 
  HardDriveDownload,
  AlertCircle,
  Building2,
  Users,
  Boxes,
  DollarSign,
  ShoppingCart,
  Truck,
  Layers,
  History,
  FileCheck2,
  FileDown
} from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import toast from "react-hot-toast";

export interface CollectionExportOption {
  id: string;
  name: string;
  collectionName: string;
  description: string;
  category: "Cadastral" | "Financeiro" | "Comercial" | "Estoque" | "Auditoria";
  icon: any;
  isCadastral?: boolean;
}

export const EXPORT_COLLECTIONS: CollectionExportOption[] = [
  { 
    id: "users", 
    name: "Usuários e Contas", 
    collectionName: "users", 
    description: "Perfis, e-mails, níveis de acesso, telefones e permissões", 
    category: "Cadastral",
    icon: Users,
    isCadastral: true
  },
  { 
    id: "config_empresa", 
    name: "Cadastro Empresa Franqueada", 
    collectionName: "config_empresa", 
    description: "Razão social, CNPJ, inscrições, endereço e dados societários", 
    category: "Cadastral",
    icon: Building2,
    isCadastral: true
  },
  { 
    id: "empregados", 
    name: "Empregados / Colaboradores", 
    collectionName: "empregados", 
    description: "Quadro de colaboradores, cargos, salários, admissões e dados bancários", 
    category: "Cadastral",
    icon: Users,
    isCadastral: true
  },
  { 
    id: "clientes_crm", 
    name: "Clientes e Condomínios (CRM)", 
    collectionName: "clientes_crm", 
    description: "Condomínios cadastrados, síndicos, zeladores, contatos e endereços", 
    category: "Cadastral",
    icon: Users,
    isCadastral: true
  },
  { 
    id: "fornecedores", 
    name: "Fornecedores e Distribuidores", 
    collectionName: "fornecedores", 
    description: "Cadastro de fornecedores, CNPJ, contatos e condições comerciais", 
    category: "Cadastral",
    icon: Building2,
    isCadastral: true
  },
  { 
    id: "produtos", 
    name: "Catálogo de Produtos", 
    collectionName: "produtos", 
    description: "Produtos, SKU, preços, estoque atual, custos e categorias", 
    category: "Estoque",
    icon: Boxes,
    isCadastral: true
  },
  { 
    id: "categorias_produtos", 
    name: "Categorias e Departamentos", 
    collectionName: "categorias_produtos", 
    description: "Estrutura mercadológica de categorias e departamentos", 
    category: "Estoque",
    icon: Layers,
    isCadastral: true
  },
  { 
    id: "servicos_essenciais", 
    name: "Serviços Condominiais", 
    collectionName: "servicos_essenciais", 
    description: "Tabela de serviços e manutenções rotineiras", 
    category: "Comercial",
    icon: FileCheck2,
    isCadastral: true
  },
  { 
    id: "pedidos_venda", 
    name: "Pedidos de Venda e E-commerce", 
    collectionName: "pedidos_venda", 
    description: "Histórico completo de pedidos, itens comprados, faturamento e entrega", 
    category: "Comercial",
    icon: ShoppingCart
  },
  { 
    id: "ordens_servico", 
    name: "Ordens de Serviço (OS)", 
    collectionName: "ordens_servico", 
    description: "Orçamentos, solicitações de serviços e status de atendimento", 
    category: "Comercial",
    icon: FileCheck2
  },
  { 
    id: "comissoes", 
    name: "Comissões Comerciais", 
    collectionName: "comissoes", 
    description: "Comissões apuradas por vendedor e representante", 
    category: "Comercial",
    icon: DollarSign
  },
  { 
    id: "contas_pagar", 
    name: "Contas a Pagar (Despesas)", 
    collectionName: "contas_pagar", 
    description: "Títulos a pagar, fornecedores, vencimentos e quitações", 
    category: "Financeiro",
    icon: DollarSign
  },
  { 
    id: "contas_receber", 
    name: "Contas a Receber (Faturas)", 
    collectionName: "contas_receber", 
    description: "Lançamentos de faturas, parcelas e recebimentos", 
    category: "Financeiro",
    icon: DollarSign
  },
  { 
    id: "bancos", 
    name: "Contas Bancárias & Caixas", 
    collectionName: "bancos", 
    description: "Contas correntes, saldos conciliados e instituições", 
    category: "Financeiro",
    icon: Building2
  },
  { 
    id: "centros_custo", 
    name: "Centros de Custo", 
    collectionName: "centros_custo", 
    description: "Classificação orçamentária e departamentos de custo", 
    category: "Financeiro",
    icon: Layers
  },
  { 
    id: "entregas", 
    name: "Entregas & Expedição", 
    collectionName: "entregas", 
    description: "Roteiros de despacho, transportadoras e status de entrega", 
    category: "Estoque",
    icon: Truck
  },
  { 
    id: "logs_sistema", 
    name: "Trilha de Auditoria do Sistema", 
    collectionName: "logs_sistema", 
    description: "Registros de ações, alterações cadastrais, IPs, usuários e datas", 
    category: "Auditoria",
    icon: History
  },
];

function flattenItem(item: any, prefix = ""): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key in item) {
    if (!Object.prototype.hasOwnProperty.call(item, key)) continue;

    const val = item[key];
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (val === null || val === undefined) {
      result[newKey] = "";
    } else if (typeof val === "object") {
      if (val.seconds !== undefined && val.nanoseconds !== undefined) {
        // Firestore Timestamp
        result[newKey] = new Date(val.seconds * 1000).toLocaleString("pt-BR");
      } else if (val instanceof Date) {
        result[newKey] = val.toLocaleString("pt-BR");
      } else if (Array.isArray(val)) {
        result[newKey] = val.map(v => typeof v === "object" ? JSON.stringify(v) : String(v)).join(" | ");
      } else {
        const nested = flattenItem(val, newKey);
        Object.assign(result, nested);
      }
    } else {
      result[newKey] = val;
    }
  }

  return result;
}

export function convertToCSV(data: Record<string, any>[], delimiter = ";"): string {
  if (!data || data.length === 0) return "";

  const flattenedData = data.map(item => flattenItem(item));

  // Collect all unique keys
  const keysSet = new Set<string>();
  flattenedData.forEach((item) => {
    Object.keys(item).forEach((k) => keysSet.add(k));
  });
  const headers = Array.from(keysSet);

  const csvRows: string[] = [];

  // Header row with UTF-8 support
  csvRows.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(delimiter));

  // Data rows
  for (const row of flattenedData) {
    const values = headers.map((header) => {
      let val = row[header];
      if (val === undefined || val === null) {
        val = "";
      } else if (typeof val === "string") {
        val = val.replace(/"/g, '""');
      } else {
        val = String(val).replace(/"/g, '""');
      }
      return `"${val}"`;
    });
    csvRows.push(values.join(delimiter));
  }

  return csvRows.join("\r\n");
}

export function triggerDownloadCSV(csvContent: string, fileName: string) {
  // Add UTF-8 BOM byte \uFEFF for Excel compatibility with Portuguese accents
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface BackupCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultFilter?: "todos" | "cadastral" | "financeiro" | "auditoria";
}

export function BackupCsvModal({ isOpen, onClose, defaultFilter = "todos" }: BackupCsvModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (defaultFilter === "cadastral") {
      return EXPORT_COLLECTIONS.filter(c => c.isCadastral || c.category === "Cadastral").map(c => c.id);
    }
    if (defaultFilter === "financeiro") {
      return EXPORT_COLLECTIONS.filter(c => c.category === "Financeiro").map(c => c.id);
    }
    if (defaultFilter === "auditoria") {
      return ["logs_sistema"];
    }
    return EXPORT_COLLECTIONS.map(c => c.id);
  });

  const [activeCategory, setActiveCategory] = useState<string>("Todas");
  const [delimiter, setDelimiter] = useState<";" | ",">(";");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [lastBackupDate, setLastBackupDate] = useState<string>(() => {
    return localStorage.getItem("uniao_last_csv_backup_date") || "Nenhum realizado nesta sessão";
  });
  const [exportSummary, setExportSummary] = useState<{ name: string; count: number }[] | null>(null);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectedIds.length === EXPORT_COLLECTIONS.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(EXPORT_COLLECTIONS.map(c => c.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectCadastraisOnly = () => {
    const ids = EXPORT_COLLECTIONS.filter(c => c.isCadastral || c.category === "Cadastral").map(c => c.id);
    setSelectedIds(ids);
    toast.success("Selecionadas 8 coleções de informações cadastrais!");
  };

  const selectAuditoriaOnly = () => {
    setSelectedIds(["logs_sistema"]);
    toast.success("Selecionada coleção de Logs de Auditoria!");
  };

  const handleExport = async () => {
    if (selectedIds.length === 0) {
      toast.error("Selecione pelo menos uma coleção para exportar.");
      return;
    }

    setLoading(true);
    setExportSummary(null);
    const summary: { name: string; count: number }[] = [];
    const nowStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    let totalExportedRecords = 0;

    try {
      const { db } = await initFirebase();
      const totalToExport = selectedIds.length;

      for (let i = 0; i < selectedIds.length; i++) {
        const id = selectedIds[i];
        const targetOption = EXPORT_COLLECTIONS.find(c => c.id === id);
        if (!targetOption) continue;

        setCurrentStep(`Exportando ${targetOption.name}... (${i + 1}/${totalToExport})`);
        setProgressPercent(Math.round(((i) / totalToExport) * 100));

        try {
          const querySnapshot = await getDocs(collection(db, targetOption.collectionName));
          const docsData: Record<string, any>[] = [];

          querySnapshot.forEach(docSnap => {
            docsData.push({ id: docSnap.id, ...docSnap.data() });
          });

          if (docsData.length > 0) {
            const csvText = convertToCSV(docsData, delimiter);
            const fileName = `export_${targetOption.collectionName}_${nowStr}.csv`;
            triggerDownloadCSV(csvText, fileName);
            summary.push({ name: targetOption.name, count: docsData.length });
            totalExportedRecords += docsData.length;
          } else {
            // Export empty placeholder file header
            const emptyCsv = `id${delimiter}status_observacao\r\n""${delimiter}"Nenhum registro cadastrado no momento"`;
            triggerDownloadCSV(emptyCsv, `export_${targetOption.collectionName}_${nowStr}.csv`);
            summary.push({ name: targetOption.name, count: 0 });
          }
        } catch (colErr) {
          console.warn(`Erro ao ler coleção ${targetOption.collectionName}:`, colErr);
        }

        // Brief delay between downloads to prevent browser popup block
        await new Promise(res => setTimeout(res, 280));
      }

      setProgressPercent(100);
      setCurrentStep("Exportação finalizada com sucesso!");

      const formattedDate = new Date().toLocaleString("pt-BR");
      setLastBackupDate(formattedDate);
      localStorage.setItem("uniao_last_csv_backup_date", formattedDate);
      setExportSummary(summary);

      // Audit Log for the export
      await logAction(
        `Exportou ${selectedIds.length} coleções em formato CSV para backup/auditoria (${totalExportedRecords} registros totais)`,
        "Administrativo",
        {
          selectedCollections: selectedIds,
          totalRecords: totalExportedRecords,
          delimiter: delimiter === ";" ? "Ponto e Vírgula (; Excel BR)" : "Vírgula (, Internacional)",
          timestamp: new Date().toISOString()
        }
      );

      toast.success(`Exportação CSV concluída! ${totalExportedRecords} registros baixados.`);
    } catch (err: any) {
      console.error("Erro ao gerar exportação CSV:", err);
      toast.error(`Falha durante a exportação: ${err.message || "Erro desconhecido"}`);
    } finally {
      setLoading(false);
    }
  };

  // Export single collection right now
  const handleExportSingle = async (col: CollectionExportOption) => {
    try {
      toast.loading(`Exportando "${col.name}"...`, { id: "single-csv" });
      const { db } = await initFirebase();
      const snap = await getDocs(collection(db, col.collectionName));
      const docsData: Record<string, any>[] = [];

      snap.forEach(docSnap => {
        docsData.push({ id: docSnap.id, ...docSnap.data() });
      });

      const nowStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const csvText = docsData.length > 0 
        ? convertToCSV(docsData, delimiter)
        : `id${delimiter}status_observacao\r\n""${delimiter}"Nenhum registro cadastrado no momento"`;

      triggerDownloadCSV(csvText, `export_${col.collectionName}_${nowStr}.csv`);

      await logAction(
        `Exportou dados da coleção [${col.name}] em CSV (${docsData.length} registros)`,
        "Administrativo",
        { collectionName: col.collectionName, count: docsData.length }
      );

      toast.success(`"${col.name}" exportado com sucesso (${docsData.length} registros)`, { id: "single-csv" });
    } catch (err: any) {
      toast.error(`Erro ao exportar "${col.name}": ${err.message || err}`, { id: "single-csv" });
    }
  };

  const filteredCollections = EXPORT_COLLECTIONS.filter(col => {
    if (activeCategory === "Todas") return true;
    if (activeCategory === "Cadastrais") return col.isCadastral || col.category === "Cadastral";
    return col.category === activeCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/30 shrink-0">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white">
                  Exportação de Dados Firestore em CSV
                </h2>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full">
                  Backup & Auditoria
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Exporte planilhas CSV com codificação UTF-8 BOM para auditoria, backup e análise no Excel
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Fechar janela"
          >
            <X size={22} />
          </button>
        </div>

        {/* Quick Actions & Status Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 px-6 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-600">
            <Clock size={15} className="text-slate-400 shrink-0" />
            <span>Última exportação: <strong className="text-slate-900 font-semibold">{lastBackupDate}</strong></span>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectCadastraisOnly}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition-colors cursor-pointer"
              title="Selecionar apenas tabelas cadastrais (Usuários, Empresa, Empregados, Clientes, Fornecedores, Produtos)"
            >
              <Users size={13} />
              <span>Apenas Cadastrais</span>
            </button>
            <button
              type="button"
              onClick={selectAuditoriaOnly}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 transition-colors cursor-pointer"
              title="Selecionar apenas os Logs de Auditoria do sistema"
            >
              <History size={13} />
              <span>Logs de Auditoria</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
          {/* Delimiter & Format Options */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-slate-900 block">Formatação de Delimitador do CSV:</span>
              <span className="text-[11px] text-slate-500">
                Padrão brasileiro (ponto e vírgula) abre colunas perfeitas no Excel sem necessidade de conversão.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDelimiter(";")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  delimiter === ";" 
                    ? "bg-indigo-600 text-white shadow-xs" 
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Ponto e Vírgula (;) [Excel BR]
              </button>
              <button
                type="button"
                onClick={() => setDelimiter(",")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  delimiter === "," 
                    ? "bg-indigo-600 text-white shadow-xs" 
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Vírgula (,) [US/Sheets]
              </button>
            </div>
          </div>

          {/* Category Tabs & Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {["Todas", "Cadastrais", "Financeiro", "Comercial", "Estoque", "Auditoria"].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeCategory === cat
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="text-slate-500">
                <strong className="text-indigo-600 font-bold">{selectedIds.length}</strong> de {EXPORT_COLLECTIONS.length} selecionadas
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={loading}
                className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
              >
                {selectedIds.length === EXPORT_COLLECTIONS.length ? "Desmarcar Todas" : "Marcar Todas"}
              </button>
            </div>
          </div>

          {/* Progress Bar when exporting */}
          {loading && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-2 animate-pulse">
              <div className="flex items-center justify-between text-xs font-semibold text-indigo-900">
                <span className="flex items-center gap-2">
                  <RefreshCw size={15} className="animate-spin text-indigo-600" />
                  {currentStep}
                </span>
                <span className="font-bold">{progressPercent}%</span>
              </div>
              <div className="w-full bg-indigo-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Success Summary if finished */}
          {exportSummary && !loading && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <span>Exportação Concluída com Sucesso!</span>
              </div>
              <p className="text-xs text-emerald-700">
                Os arquivos `.csv` foram baixados no navegador com codificação UTF-8 BOM e estão prontos para abertura no Excel.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {exportSummary.map((item, idx) => (
                  <div key={idx} className="bg-white/90 border border-emerald-200/90 rounded-xl p-2 text-[11px] flex justify-between items-center">
                    <span className="truncate font-medium text-slate-700">{item.name}</span>
                    <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md text-[10px]">
                      {item.count} reg.
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Collections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredCollections.map((col) => {
              const isChecked = selectedIds.includes(col.id);
              const IconComp = col.icon;
              return (
                <div
                  key={col.id}
                  className={`p-4 rounded-2xl border transition-all select-none flex items-start justify-between gap-3 ${
                    isChecked
                      ? "bg-white border-indigo-300 shadow-sm ring-1 ring-indigo-200"
                      : "bg-white/70 border-slate-200/90 hover:bg-white hover:border-slate-300 opacity-80 hover:opacity-100"
                  }`}
                >
                  <div 
                    onClick={() => !loading && toggleSelect(col.id)}
                    className="flex items-start gap-3 flex-1 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // handled by parent div
                      disabled={loading}
                      className="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/70 flex items-center justify-center text-slate-700 shrink-0">
                      <IconComp size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">{col.name}</span>
                        <code className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                          {col.collectionName}
                        </code>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {col.description}
                      </p>
                    </div>
                  </div>

                  {/* Single Export Direct Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportSingle(col);
                    }}
                    disabled={loading}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer shrink-0"
                    title={`Exportar apenas ${col.name} em CSV agora`}
                  >
                    <FileDown size={16} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs">
            <ShieldCheck size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold block text-slate-900">Auditoria & Segurança Operacional:</strong>
              Cada exportação gera um log auditável com data, IP, usuário autenticado e coleções exportadas, garantindo rastreabilidade e conformidade com a LGPD.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-white border-t border-slate-200 p-4 px-6 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={loading || selectedIds.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-98 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Processando Exportação...</span>
                </>
              ) : (
                <>
                  <HardDriveDownload size={16} />
                  <span>Exportar {selectedIds.length} Coleções em CSV</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
