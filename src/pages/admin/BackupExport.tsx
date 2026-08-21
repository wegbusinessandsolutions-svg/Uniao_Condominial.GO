import React, { useState, useEffect, useMemo } from "react";
import {
  Download,
  Database,
  FileJson,
  FileSpreadsheet,
  RefreshCw,
  Eye,
  CheckSquare,
  Square,
  ShieldCheck,
  AlertCircle,
  HardDrive,
  FileCheck2,
  Clock,
  Layers,
  Search,
  Filter,
  ArrowDownToLine,
  SlidersHorizontal,
  Table,
  Code2,
  X,
  Copy,
  Check,
  Building2,
  Users,
  ShoppingCart,
  DollarSign,
  Boxes,
  Truck,
  Settings,
  Archive,
  FolderArchive,
  Info,
  Calendar,
  CalendarClock,
  Play,
  History,
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
  Trash2,
  Sparkles,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { initFirebase, db } from "../../lib/firebase";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { logAction } from "../../lib/audit";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import {
  BackupScheduleConfig,
  BackupLog,
  ALL_BACKUP_COLLECTIONS,
  DEFAULT_SCHEDULE_CONFIG,
  getBackupScheduleConfig,
  saveBackupScheduleConfig,
  executeBackupRoutine,
  calculateNextRun,
} from "../../services/backupSchedulerService";

interface CollectionMeta {
  id: string;
  name: string;
  category: "Administrativo" | "Comercial" | "Financeiro" | "Estoque" | "Sistema";
  description: string;
  icon: any;
  recommendedFormat: "JSON" | "CSV" | "AMBOS";
}

const COLLECTIONS_CONFIG: CollectionMeta[] = [
  {
    id: "users",
    name: "Usuários e Clientes",
    category: "Administrativo",
    description: "Perfis de usuários, permissões de acesso, logins e clientes cadastrados.",
    icon: Users,
    recommendedFormat: "AMBOS",
  },
  {
    id: "config_empresa",
    name: "Cadastro Empresa Franqueada",
    category: "Administrativo",
    description: "Razão social, CNPJ, inscrições, endereço e dados societários da franqueada.",
    icon: Building2,
    recommendedFormat: "JSON",
  },
  {
    id: "empregados",
    name: "Empregados / Colaboradores",
    category: "Administrativo",
    description: "Quadro de colaboradores, cargos, salários, jornadas e dados bancários.",
    icon: Users,
    recommendedFormat: "AMBOS",
  },
  {
    id: "produtos",
    name: "Catálogo de Produtos",
    category: "Estoque",
    description: "Produtos cadastrados, SKU, preços, estoque atual, custos e códigos de barras.",
    icon: Boxes,
    recommendedFormat: "AMBOS",
  },
  {
    id: "categorias_produtos",
    name: "Categorias de Produtos",
    category: "Estoque",
    description: "Categorias e departamentos do catálogo de produtos.",
    icon: Layers,
    recommendedFormat: "AMBOS",
  },
  {
    id: "kits_essenciais",
    name: "Kits Essenciais",
    category: "Estoque",
    description: "Combos de produtos e kits promocionais montados.",
    icon: Boxes,
    recommendedFormat: "JSON",
  },
  {
    id: "servicos_essenciais",
    name: "Serviços Essenciais",
    category: "Estoque",
    description: "Serviços ofertados no catálogo de serviços.",
    icon: Settings,
    recommendedFormat: "JSON",
  },
  {
    id: "ordens_servico",
    name: "Ordens de Serviço (OS)",
    category: "Comercial",
    description: "Solicitações de serviços, orçamentos, status e atendimento ao cliente.",
    icon: FileCheck2,
    recommendedFormat: "AMBOS",
  },
  {
    id: "pedidos_venda",
    name: "Pedidos de Venda",
    category: "Comercial",
    description: "Histórico completo de pedidos, itens comprados, faturamento e dados de pagamento.",
    icon: ShoppingCart,
    recommendedFormat: "AMBOS",
  },
  {
    id: "comissoes",
    name: "Comissões Comerciais",
    category: "Comercial",
    description: "Comissões geradas por vendas e vendedores.",
    icon: DollarSign,
    recommendedFormat: "AMBOS",
  },
  {
    id: "codigos_indicacao",
    name: "Códigos de Indicação & Cupons",
    category: "Comercial",
    description: "Cupons de parceiros, afiliados e regras de indicação.",
    icon: FileCheck2,
    recommendedFormat: "AMBOS",
  },
  {
    id: "visitas_crm",
    name: "Visitas Comerciais (CRM)",
    category: "Comercial",
    description: "Agendamentos, histórico de visitas e relacionamento comercial.",
    icon: Users,
    recommendedFormat: "AMBOS",
  },
  {
    id: "fornecedores",
    name: "Fornecedores",
    category: "Financeiro",
    description: "Cadastro de fornecedores, CNPJ, dados de contato e condições comerciais.",
    icon: Building2,
    recommendedFormat: "AMBOS",
  },
  {
    id: "contas_pagar",
    name: "Contas a Pagar",
    category: "Financeiro",
    description: "Despesas, contas a pagar, vencimentos, fornecedores e comprovantes.",
    icon: DollarSign,
    recommendedFormat: "AMBOS",
  },
  {
    id: "contas_receber",
    name: "Contas a Receber",
    category: "Financeiro",
    description: "Lançamentos de contas a receber, faturas de clientes e quitações.",
    icon: DollarSign,
    recommendedFormat: "AMBOS",
  },
  {
    id: "bancos",
    name: "Contas Bancárias & Caixas",
    category: "Financeiro",
    description: "Contas bancárias cadastradas, saldos e agências.",
    icon: HardDrive,
    recommendedFormat: "JSON",
  },
  {
    id: "centros_custo",
    name: "Centros de Custo",
    category: "Financeiro",
    description: "Divisões orçamentárias e centros de custo do sistema financeiro.",
    icon: Layers,
    recommendedFormat: "JSON",
  },
  {
    id: "entregas",
    name: "Entregas & Expedição",
    category: "Estoque",
    description: "Roteiros de entrega, despachos de pedidos e dados de transportadora.",
    icon: Truck,
    recommendedFormat: "AMBOS",
  },
  {
    id: "muralNotices",
    name: "Mural Condominial",
    category: "Comercial",
    description: "Publicações, comunicados e avisos do mural condominial.",
    icon: FileCheck2,
    recommendedFormat: "JSON",
  },
  {
    id: "clube_beneficios",
    name: "Clube de Benefícios",
    category: "Comercial",
    description: "Vantagens, convênios e benefícios cadastrados.",
    icon: ShieldCheck,
    recommendedFormat: "JSON",
  },
  {
    id: "marcas_parceiras",
    name: "Marcas Parceiras",
    category: "Comercial",
    description: "Logomarcas e marcas parceiras exibidas no portal.",
    icon: Layers,
    recommendedFormat: "JSON",
  },
  {
    id: "regras_cashback",
    name: "Regras de Cashback",
    category: "Comercial",
    description: "Tabelas de percentuais e configurações do programa de cashback.",
    icon: DollarSign,
    recommendedFormat: "JSON",
  },
  {
    id: "afiliados_uc",
    name: "Afiliados União Condominial",
    category: "Comercial",
    description: "Termos de adesão, status e cadastros de afiliados.",
    icon: ShieldCheck,
    recommendedFormat: "AMBOS",
  },
  {
    id: "integracao_pagamentos",
    name: "Configurações de Pagamentos",
    category: "Sistema",
    description: "Configurações de credenciais e provedores de pagamento (Mercado Pago, etc).",
    icon: Settings,
    recommendedFormat: "JSON",
  },
  {
    id: "configuracao_frete",
    name: "Configurações de Frete",
    category: "Sistema",
    description: "Tabelas de frete, faixas de CEP e taxas de entrega.",
    icon: Truck,
    recommendedFormat: "JSON",
  },
  {
    id: "configuracao_notificacoes",
    name: "Configuração de Notificações",
    category: "Sistema",
    description: "Modelos de e-mail e réguas de comunicação do sistema.",
    icon: Settings,
    recommendedFormat: "JSON",
  },
  {
    id: "notificacoes_clientes",
    name: "Notificações de Clientes",
    category: "Sistema",
    description: "Histórico de alertas e notificações disparadas para usuários.",
    icon: ShieldCheck,
    recommendedFormat: "AMBOS",
  },
  {
    id: "logs_sistema",
    name: "Logs de Auditoria",
    category: "Sistema",
    description: "Trilha de auditoria com histórico de todas as alterações críticas realizadas.",
    icon: Clock,
    recommendedFormat: "AMBOS",
  },
];

export default function BackupExport() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"agendamento" | "logs" | "manual" | "inspecionar">("agendamento");

  // Schedule Configuration State
  const [scheduleConfig, setScheduleConfig] = useState<BackupScheduleConfig>(DEFAULT_SCHEDULE_CONFIG);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [runningRoutine, setRunningRoutine] = useState(false);

  // Logs State
  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([]);
  const [logsFilterStatus, setLogsFilterStatus] = useState<string>("todos");
  const [selectedLogDetail, setSelectedLogDetail] = useState<BackupLog | null>(null);

  // Manual Export State
  const [counts, setCounts] = useState<{ [collectionId: string]: number | null }>({});
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [selectedCollections, setSelectedCollections] = useState<string[]>(
    COLLECTIONS_CONFIG.map((c) => c.id)
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Todas");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; collection: string } | null>(null);

  // Export Options
  const [includeDocId, setIncludeDocId] = useState(true);
  const [formatJsonPretty, setFormatJsonPretty] = useState(true);
  const [sanitizeDates, setSanitizeDates] = useState(true);

  // Preview Modal
  const [previewCollection, setPreviewCollection] = useState<CollectionMeta | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState<"table" | "json">("table");
  const [copiedJson, setCopiedJson] = useState(false);

  // Inspect Local File Modal
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectedBackup, setInspectedBackup] = useState<any | null>(null);

  // 1. Carrega configuração de agendamento
  useEffect(() => {
    const fetchConfig = async () => {
      setLoadingSchedule(true);
      try {
        const config = await getBackupScheduleConfig();
        setScheduleConfig(config);
      } catch (err) {
        console.error("Erro ao carregar configuração de agendamento:", err);
      } finally {
        setLoadingSchedule(false);
      }
    };
    fetchConfig();
  }, []);

  // 2. Escuta os logs de conclusão de backup em tempo real
  useEffect(() => {
    try {
      const q = query(
        collection(db, "logs_backup"),
        orderBy("iniciadoEm", "desc"),
        limit(50)
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          const logs: BackupLog[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));
          setBackupLogs(logs);
        },
        (err) => {
          console.warn("Erro ao monitorar logs de backup:", err);
        }
      );

      return () => unsub();
    } catch (e) {
      console.warn("Erro ao configurar snapshot de logs de backup:", e);
    }
  }, []);

  // 3. Contagem de registros do Firestore
  useEffect(() => {
    fetchAllCounts();
  }, []);

  const fetchAllCounts = async () => {
    setLoadingCounts(true);
    try {
      const { db } = await initFirebase();
      const newCounts: { [key: string]: number } = {};

      await Promise.all(
        COLLECTIONS_CONFIG.map(async (c) => {
          try {
            const snap = await getDocs(collection(db, c.id));
            newCounts[c.id] = snap.size;
          } catch (err) {
            newCounts[c.id] = 0;
          }
        })
      );

      setCounts(newCounts);
    } catch (err) {
      console.error("Error counting collections:", err);
    } finally {
      setLoadingCounts(false);
    }
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      await saveBackupScheduleConfig(
        scheduleConfig,
        profile?.displayName || user?.email || "Administrador"
      );
      toast.success("Configurações de agendamento salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar agendamento:", error);
      toast.error("Erro ao salvar configuração de agendamento.");
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleRunScheduledBackupNow = async () => {
    if (runningRoutine) return;
    setRunningRoutine(true);
    const toastId = toast.loading("Iniciando rotina de backup das coleções do Firestore...");

    try {
      const result = await executeBackupRoutine(
        "manual",
        profile?.displayName || user?.email || "Administrador",
        scheduleConfig.colecoesSelecionadas
      );

      if (result.success) {
        toast.success(
          `Backup concluído com sucesso! (${result.log.totalRegistros} docs em ${result.log.totalColecoes} coleções)`,
          { id: toastId }
        );

        // Envia notificação de conclusão para o backend
        try {
          await fetch("/api/admin/backups/log-conclusion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "sucesso",
              totalColecoes: result.log.totalColecoes,
              totalRegistros: result.log.totalRegistros,
              tamanhoBytes: result.log.tamanhoBytesEstimado,
              duracaoMs: result.log.duracaoMs,
              destinatarioEmail: scheduleConfig.notificarEmail ? scheduleConfig.emailDestinatario : undefined,
              tipoDisparo: "manual",
            }),
          });
        } catch (e) {
          // ignore
        }

        // Se houver dados, oferece download imediato
        if (result.backupData) {
          downloadJsonBundle(result.backupData, `backup_uniao_condominial_${new Date().toISOString().slice(0, 10)}.json`);
        }
      } else {
        toast.error(`Falha ao executar backup: ${result.log.erro || "Verifique os logs"}`, {
          id: toastId,
        });
      }
    } catch (error: any) {
      console.error("Erro na rotina de backup:", error);
      toast.error(`Erro: ${error.message || "Falha inesperada"}`, { id: toastId });
    } finally {
      setRunningRoutine(false);
      fetchAllCounts();
    }
  };

  const handleDeleteLog = async (logId: string) => {
    try {
      await deleteDoc(doc(db, "logs_backup", logId));
      toast.success("Log removido do histórico.");
      if (selectedLogDetail?.id === logId) {
        setSelectedLogDetail(null);
      }
    } catch (e) {
      toast.error("Erro ao excluir log.");
    }
  };

  const handleDownloadLogJson = (log: BackupLog) => {
    const jsonStr = JSON.stringify(log, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `log_backup_${log.id || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper para download de arquivo JSON
  const downloadJsonBundle = (data: any, fileName: string) => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper para formatar data de Timestamp ou String
  const formatTimestamp = (ts: any) => {
    if (!ts) return "—";
    try {
      if (typeof ts.toDate === "function") {
        return ts.toDate().toLocaleString("pt-BR");
      }
      if (ts instanceof Date) {
        return ts.toLocaleString("pt-BR");
      }
      return new Date(ts).toLocaleString("pt-BR");
    } catch {
      return "—";
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return "0 KB";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Filtragem de logs
  const filteredLogs = useMemo(() => {
    return backupLogs.filter((log) => {
      if (logsFilterStatus === "sucesso" && log.status !== "sucesso") return false;
      if (logsFilterStatus === "falha" && log.status !== "falha") return false;
      if (logsFilterStatus === "agendado" && log.tipoDisparo !== "agendado") return false;
      if (logsFilterStatus === "manual" && log.tipoDisparo !== "manual") return false;
      return true;
    });
  }, [backupLogs, logsFilterStatus]);

  // Contagem estimada de coleções manuais
  const totalRecordsEstimated = useMemo(() => {
    return Object.entries(counts).reduce((acc, [key, val]) => {
      if (selectedCollections.includes(key) && typeof val === "number") {
        return acc + val;
      }
      return acc;
    }, 0);
  }, [counts, selectedCollections]);

  const filteredCollections = useMemo(() => {
    return COLLECTIONS_CONFIG.filter((col) => {
      const matchesSearch =
        col.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        col.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        col.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        activeCategory === "Todas" || col.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, activeCategory]);

  const handleToggleSelectAll = () => {
    if (selectedCollections.length === COLLECTIONS_CONFIG.length) {
      setSelectedCollections([]);
    } else {
      setSelectedCollections(COLLECTIONS_CONFIG.map((c) => c.id));
    }
  };

  const handleToggleCollection = (id: string) => {
    setSelectedCollections((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleScheduleCollection = (id: string) => {
    setScheduleConfig((prev) => {
      const exists = prev.colecoesSelecionadas.includes(id);
      return {
        ...prev,
        colecoesSelecionadas: exists
          ? prev.colecoesSelecionadas.filter((c) => c !== id)
          : [...prev.colecoesSelecionadas, id],
      };
    });
  };

  const handleSelectAllScheduleCollections = () => {
    if (scheduleConfig.colecoesSelecionadas.length === ALL_BACKUP_COLLECTIONS.length) {
      setScheduleConfig((prev) => ({ ...prev, colecoesSelecionadas: [] }));
    } else {
      setScheduleConfig((prev) => ({
        ...prev,
        colecoesSelecionadas: ALL_BACKUP_COLLECTIONS.map((c) => c.id),
      }));
    }
  };

  // Processa documentos do Firestore para JSON sanitizado
  const processFirestoreDocs = (docs: any[]) => {
    return docs.map((docSnap) => {
      const data = docSnap.data();
      const processed: any = {};

      if (includeDocId) {
        processed._id = docSnap.id;
      }

      Object.entries(data).forEach(([key, val]) => {
        if (
          val &&
          typeof val === "object" &&
          "seconds" in val &&
          "nanoseconds" in val
        ) {
          const date = new Date((val as any).seconds * 1000);
          processed[key] = sanitizeDates
            ? date.toISOString()
            : date.toLocaleString("pt-BR");
        } else if (val instanceof Date) {
          processed[key] = sanitizeDates
            ? val.toISOString()
            : val.toLocaleString("pt-BR");
        } else {
          processed[key] = val;
        }
      });

      return processed;
    });
  };

  const flattenObject = (obj: any, prefix = ""): { [key: string]: any } => {
    const flattened: { [key: string]: any } = {};

    Object.keys(obj || {}).forEach((key) => {
      const propName = prefix ? `${prefix}.${key}` : key;
      const val = obj[key];

      if (
        val !== null &&
        typeof val === "object" &&
        !Array.isArray(val) &&
        !(val instanceof Date)
      ) {
        Object.assign(flattened, flattenObject(val, propName));
      } else if (Array.isArray(val)) {
        flattened[propName] = val
          .map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v)))
          .join("; ");
      } else {
        flattened[propName] = val;
      }
    });

    return flattened;
  };

  const convertToCSV = (data: any[]): string => {
    if (!data || data.length === 0) {
      return "Nenhum registro encontrado";
    }

    const flatRows = data.map((item) => flattenObject(item));
    const headersSet = new Set<string>();
    flatRows.forEach((row) => {
      Object.keys(row).forEach((h) => headersSet.add(h));
    });

    const headers = Array.from(headersSet);
    const escapeCell = (cell: any) => {
      if (cell === null || cell === undefined) return '""';
      let str = String(cell);
      str = str.replace(/"/g, '""');
      return `"${str}"`;
    };

    const headerRow = headers.map(escapeCell).join(";");
    const dataRows = flatRows.map((row) =>
      headers.map((h) => escapeCell(row[h])).join(";")
    );

    return "\uFEFF" + [headerRow, ...dataRows].join("\r\n");
  };

  // Exportação em Lote Completa (Bundle JSON)
  const handleExportFullBundle = async () => {
    if (selectedCollections.length === 0) {
      toast.error("Selecione ao menos uma coleção para exportar.");
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading("Iniciando exportação completa do Firestore...");

    try {
      const { db } = await initFirebase();
      const bundle: any = {
        _metadata: {
          generatedAt: new Date().toISOString(),
          generatedBy: {
            uid: user?.uid,
            email: user?.email,
          },
          totalCollections: selectedCollections.length,
          totalRecords: 0,
          system: "União Condominial.GO",
          version: "2.0",
        },
        collections: {},
      };

      let grandTotal = 0;

      for (let i = 0; i < selectedCollections.length; i++) {
        const colId = selectedCollections[i];
        const colMeta = COLLECTIONS_CONFIG.find((c) => c.id === colId);
        setExportProgress({
          current: i + 1,
          total: selectedCollections.length,
          collection: colMeta?.name || colId,
        });

        const snap = await getDocs(collection(db, colId));
        const processed = processFirestoreDocs(snap.docs);
        grandTotal += processed.length;

        bundle.collections[colId] = {
          name: colMeta?.name || colId,
          category: colMeta?.category || "Outros",
          count: processed.length,
          data: processed,
        };
      }

      bundle._metadata.totalRecords = grandTotal;

      const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const fileName = `backup_completo_uniao_condominial_${dateStr}.json`;
      downloadJsonBundle(bundle, fileName);

      toast.success(
        `Backup exportado com sucesso! (${grandTotal} registros em ${selectedCollections.length} coleções)`,
        { id: toastId }
      );
    } catch (err: any) {
      console.error("Export error:", err);
      toast.error(`Falha ao exportar backup: ${err.message}`, { id: toastId });
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  // Pré-visualização de dados da coleção
  const handleOpenPreview = async (col: CollectionMeta) => {
    setPreviewCollection(col);
    setPreviewLoading(true);
    setCopiedJson(false);

    try {
      const { db } = await initFirebase();
      const snap = await getDocs(collection(db, col.id));
      const processed = processFirestoreDocs(snap.docs.slice(0, 15));
      setPreviewData(processed);
    } catch (err) {
      toast.error(`Erro ao carregar pré-visualização de ${col.name}`);
      setPreviewData([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Database size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Backups & Agendamento Firestore
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                v2.0
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Agendamento automático, histórico em tempo real e exportação dos dados do condomínio.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchAllCounts}
            disabled={loadingCounts}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            title="Atualizar contagem de documentos"
          >
            <RefreshCw size={14} className={loadingCounts ? "animate-spin text-[#0071e3]" : ""} />
            <span>Atualizar Firestore</span>
          </button>

          <button
            onClick={handleRunScheduledBackupNow}
            disabled={runningRoutine}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#0071e3] to-indigo-600 hover:from-[#005bb5] hover:to-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {runningRoutine ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Processando Backup...</span>
              </>
            ) : (
              <>
                <Play size={15} className="fill-current" />
                <span>Executar Backup Agora</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs de Navegação */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("agendamento")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "agendamento"
              ? "bg-[#0071e3] text-white shadow-md shadow-blue-500/20"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <CalendarClock size={16} />
          <span>Agendador Automático</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === "agendamento" ? "bg-white/20 text-white" : scheduleConfig.ativo ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
          }`}>
            {scheduleConfig.ativo ? "Ativo" : "Pausado"}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "logs"
              ? "bg-[#0071e3] text-white shadow-md shadow-blue-500/20"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <History size={16} />
          <span>Logs de Conclusão</span>
          {backupLogs.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === "logs" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-800"
            }`}>
              {backupLogs.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("manual")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "manual"
              ? "bg-[#0071e3] text-white shadow-md shadow-blue-500/20"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Download size={16} />
          <span>Exportação Manual</span>
        </button>

        <button
          onClick={() => setActiveTab("inspecionar")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "inspecionar"
              ? "bg-[#0071e3] text-white shadow-md shadow-blue-500/20"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FileCheck2 size={16} />
          <span>Validar Arquivo Local</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* ABA 1: AGENDADOR AUTOMÁTICO DE BACKUPS                    */}
      {/* ======================================================== */}
      {activeTab === "agendamento" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Status Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status Agendador */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado do Agendador</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-3 h-3 rounded-full ${scheduleConfig.ativo ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}></span>
                  <p className="text-lg font-black text-slate-900">
                    {scheduleConfig.ativo ? "Ativo e Monitorando" : "Agendador Pausado"}
                  </p>
                </div>
              </div>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${scheduleConfig.ativo ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                <CalendarClock size={20} />
              </div>
            </div>

            {/* Frequência */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Periodicidade</p>
                <p className="text-lg font-black text-slate-900 capitalize mt-1">
                  {scheduleConfig.frequencia === "diario" ? "Diário (Todo dia)" :
                   scheduleConfig.frequencia === "semanal" ? "Semanal" :
                   scheduleConfig.frequencia === "mensal" ? "Mensal" :
                   scheduleConfig.frequencia === "a_cada_12h" ? "A cada 12 Horas" : "A cada 6 Horas"}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">Horário: {scheduleConfig.horario}</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0071e3] flex items-center justify-center">
                <Clock size={20} />
              </div>
            </div>

            {/* Última Execução */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Última Execução</p>
                <p className="text-sm font-bold text-slate-900 mt-1">
                  {formatTimestamp(scheduleConfig.ultimaExecucao)}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    scheduleConfig.statusUltimaExecucao === "sucesso" ? "bg-emerald-500" :
                    scheduleConfig.statusUltimaExecucao === "falha" ? "bg-red-500" : "bg-amber-500"
                  }`}></span>
                  <span className="text-[11px] font-semibold text-slate-600 capitalize">
                    {scheduleConfig.statusUltimaExecucao || "Pendente"}
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
            </div>

            {/* Próxima Execução */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Próxima Execução</p>
                <p className="text-sm font-bold text-slate-900 mt-1">
                  {formatTimestamp(scheduleConfig.proximaExecucao || calculateNextRun(scheduleConfig))}
                </p>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                  Programada
                </span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Calendar size={20} />
              </div>
            </div>
          </div>

          {/* Painel de Configuração do Agendamento */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Configurações da Rotina Automática</h3>
                <p className="text-xs text-slate-500">Defina o cronograma, coleções incluídas e regras de retenção.</p>
              </div>

              {/* Toggle Principal */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <span className="text-xs font-bold text-slate-700">
                  {scheduleConfig.ativo ? "Agendamento Habilitado" : "Agendamento Desabilitado"}
                </span>
                <div
                  onClick={() => setScheduleConfig((prev) => ({ ...prev, ativo: !prev.ativo }))}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer ${
                    scheduleConfig.ativo ? "bg-emerald-600" : "bg-slate-300"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      scheduleConfig.ativo ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Frequência */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Frequência de Execução
                </label>
                <select
                  value={scheduleConfig.frequencia}
                  onChange={(e) => setScheduleConfig((prev) => ({ ...prev, frequencia: e.target.value as any }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="a_cada_6h">A cada 6 Horas</option>
                  <option value="a_cada_12h">A cada 12 Horas</option>
                  <option value="diario">Diário (Todos os dias)</option>
                  <option value="semanal">Semanal (Uma vez por semana)</option>
                  <option value="mensal">Mensal (Uma vez por mês)</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  {scheduleConfig.frequencia === "diario" && "Executa automaticamente todas as madrugadas."}
                  {scheduleConfig.frequencia === "semanal" && "Ideal para consolidar os dados semanalmente."}
                  {scheduleConfig.frequencia === "mensal" && "Gera um snapshot contábil mensal."}
                  {scheduleConfig.frequencia.startsWith("a_cada") && "Recomendado para operações com alta rotatividade de vendas."}
                </p>
              </div>

              {/* Horário */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Horário Preferencial (Menor Tráfego)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={scheduleConfig.horario}
                    onChange={(e) => setScheduleConfig((prev) => ({ ...prev, horario: e.target.value }))}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <div className="flex gap-1">
                    {["02:00", "03:00", "04:00"].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setScheduleConfig((prev) => ({ ...prev, horario: h }))}
                        className={`px-2.5 py-2 text-[11px] font-bold rounded-xl border transition-all cursor-pointer ${
                          scheduleConfig.horario === h
                            ? "bg-blue-50 text-[#0071e3] border-blue-200"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">Horário recomendado entre 02:00 e 04:00 da manhã.</p>
              </div>

              {/* Retenção de Dados */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Política de Retenção de Logs
                </label>
                <select
                  value={scheduleConfig.retencaoDias}
                  onChange={(e) => setScheduleConfig((prev) => ({ ...prev, retencaoDias: Number(e.target.value) }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value={15}>15 Dias de Histórico</option>
                  <option value={30}>30 Dias (Recomendado)</option>
                  <option value={60}>60 Dias</option>
                  <option value={90}>90 Dias (Trimestral)</option>
                  <option value={180}>180 Dias (Semestral)</option>
                </select>
                <p className="text-[11px] text-slate-500">Limpa automaticamente logs anteriores para economizar espaço.</p>
              </div>
            </div>

            {/* Configurações de Notificação */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-3">
                <Mail className="w-5 h-5 text-[#0071e3] shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900 cursor-pointer">
                      Enviar Log de Conclusão por E-mail
                    </label>
                    <input
                      type="checkbox"
                      checked={scheduleConfig.notificarEmail}
                      onChange={(e) => setScheduleConfig((prev) => ({ ...prev, notificarEmail: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                  </div>
                  <input
                    type="email"
                    disabled={!scheduleConfig.notificarEmail}
                    value={scheduleConfig.emailDestinatario || ""}
                    onChange={(e) => setScheduleConfig((prev) => ({ ...prev, emailDestinatario: e.target.value }))}
                    placeholder="exemplo@condominio.com"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <p className="text-[11px] text-slate-500">
                    O administrador receberá um resumo com quantidade de documentos salvos e status da rotina.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <h4 className="text-xs font-bold text-slate-900">Segurança & Trilha de Auditoria</h4>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Todas as conclusões e disparos de backups automáticos são salvos na coleção de auditoria
                    <code className="text-indigo-600 font-mono text-[10px] mx-1">logs_sistema</code>
                    e no painel de administração em tempo real.
                  </p>
                </div>
              </div>
            </div>

            {/* Seleção de Coleções no Agendamento */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Coleções Incluídas no Backup Automático ({scheduleConfig.colecoesSelecionadas.length}/{ALL_BACKUP_COLLECTIONS.length})
                  </h4>
                  <p className="text-xs text-slate-500">Escolha quais coleções serão extraídas durante o agendamento.</p>
                </div>

                <button
                  type="button"
                  onClick={handleSelectAllScheduleCollections}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all cursor-pointer"
                >
                  {scheduleConfig.colecoesSelecionadas.length === ALL_BACKUP_COLLECTIONS.length
                    ? "Desmarcar Todas"
                    : "Selecionar Todas"}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-72 overflow-y-auto p-1">
                {ALL_BACKUP_COLLECTIONS.map((col) => {
                  const isSelected = scheduleConfig.colecoesSelecionadas.includes(col.id);
                  const count = counts[col.id];

                  return (
                    <div
                      key={col.id}
                      onClick={() => handleToggleScheduleCollection(col.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                        isSelected
                          ? "bg-blue-50/70 border-blue-200 shadow-3xs"
                          : "bg-slate-50/70 border-slate-200/80 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-4 h-4 rounded-md flex items-center justify-center ${isSelected ? "bg-[#0071e3] text-white" : "border border-slate-300 bg-white"}`}>
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                        <span className="font-bold text-slate-800 truncate">{col.name}</span>
                      </div>

                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200 shrink-0">
                        {count !== undefined && count !== null ? `${count} docs` : "..."}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ações de Salvamento */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleRunScheduledBackupNow}
                disabled={runningRoutine}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#0071e3] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {runningRoutine ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="fill-current" />}
                <span>Testar e Executar Agora</span>
              </button>

              <button
                type="button"
                onClick={handleSaveSchedule}
                disabled={savingSchedule}
                className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-[#0071e3] hover:bg-[#005bb5] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {savingSchedule ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                <span>Salvar Configuração de Agendamento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 2: LOGS DE CONCLUSÃO EM TEMPO REAL                   */}
      {/* ======================================================== */}
      {activeTab === "logs" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Barra de Filtros */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtrar:</span>
              <div className="flex gap-1">
                {[
                  { id: "todos", label: "Todos" },
                  { id: "sucesso", label: "Sucesso" },
                  { id: "falha", label: "Falhas" },
                  { id: "agendado", label: "Agendados" },
                  { id: "manual", label: "Manuais" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setLogsFilterStatus(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      logsFilterStatus === f.id
                        ? "bg-[#0071e3] text-white shadow-3xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Exibindo <strong className="text-slate-800">{filteredLogs.length}</strong> logs de conclusão
            </div>
          </div>

          {/* Tabela de Logs */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Disparo</th>
                    <th className="py-3.5 px-4">Data / Horário</th>
                    <th className="py-3.5 px-4">Coleções & Docs</th>
                    <th className="py-3.5 px-4">Tamanho</th>
                    <th className="py-3.5 px-4">Duração</th>
                    <th className="py-3.5 px-4">Executor</th>
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <History size={36} className="mx-auto mb-2 opacity-40" />
                        <p className="font-bold text-sm">Nenhum log de backup encontrado</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Execute uma rotina de backup ou aguarde o próximo agendamento automático.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const isSuccess = log.status === "sucesso";
                      const isFailure = log.status === "falha";
                      const isRunning = log.status === "em_andamento";

                      return (
                        <tr key={log.id || Math.random()} className="hover:bg-slate-50/80 transition-colors">
                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[11px] ${
                                isSuccess
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : isFailure
                                  ? "bg-red-50 text-red-700 border border-red-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {isSuccess && <CheckCircle2 size={13} className="text-emerald-600" />}
                              {isFailure && <XCircle size={13} className="text-red-600" />}
                              {isRunning && <Loader2 size={13} className="animate-spin text-amber-600" />}
                              <span className="capitalize">{log.status}</span>
                            </span>
                          </td>

                          {/* Tipo Disparo */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider ${
                                log.tipoDisparo === "agendado"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-purple-50 text-purple-700 border border-purple-200"
                              }`}
                            >
                              {log.tipoDisparo || "Manual"}
                            </span>
                          </td>

                          {/* Data / Hora */}
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            {formatTimestamp(log.iniciadoEm)}
                          </td>

                          {/* Coleções e Documentos */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">
                              {log.totalRegistros || 0} docs
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {log.totalColecoes || 0} coleções processadas
                            </div>
                          </td>

                          {/* Tamanho */}
                          <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                            {formatBytes(log.tamanhoBytesEstimado)}
                          </td>

                          {/* Duração */}
                          <td className="py-3.5 px-4 font-semibold text-slate-700">
                            {log.duracaoMs ? `${(log.duracaoMs / 1000).toFixed(1)}s` : "—"}
                          </td>

                          {/* Executor */}
                          <td className="py-3.5 px-4 text-slate-600 truncate max-w-[120px]">
                            {log.executadoPor || "Sistema"}
                          </td>

                          {/* Ações */}
                          <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                            <button
                              onClick={() => setSelectedLogDetail(log)}
                              className="p-1.5 rounded-xl border border-slate-200 hover:bg-blue-50 hover:text-[#0071e3] transition-all text-slate-600 cursor-pointer"
                              title="Ver Detalhamento do Backup"
                            >
                              <Eye size={14} />
                            </button>

                            <button
                              onClick={() => handleDownloadLogJson(log)}
                              className="p-1.5 rounded-xl border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 transition-all text-slate-600 cursor-pointer"
                              title="Baixar Registro do Log (JSON)"
                            >
                              <Download size={14} />
                            </button>

                            {log.id && (
                              <button
                                onClick={() => handleDeleteLog(log.id!)}
                                className="p-1.5 rounded-xl border border-slate-200 hover:bg-red-50 hover:text-red-600 transition-all text-slate-400 cursor-pointer"
                                title="Excluir Log"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 3: EXPORTAÇÃO MANUAL / INSTANTÂNEA                    */}
      {/* ======================================================== */}
      {activeTab === "manual" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Painel de Filtros e Busca */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar coleção por nome ou ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleSelectAll}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all cursor-pointer"
                >
                  {selectedCollections.length === COLLECTIONS_CONFIG.length
                    ? "Desmarcar Todas"
                    : "Selecionar Todas"}
                </button>

                <button
                  onClick={handleExportFullBundle}
                  disabled={isExporting || selectedCollections.length === 0}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                  <span>Exportar Pacote ({selectedCollections.length})</span>
                </button>
              </div>
            </div>

            {/* Categorias */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {["Todas", "Administrativo", "Comercial", "Financeiro", "Estoque", "Sistema"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeCategory === cat
                      ? "bg-slate-900 text-white shadow-3xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid de Coleções */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCollections.map((col) => {
              const isSelected = selectedCollections.includes(col.id);
              const count = counts[col.id];
              const IconComp = col.icon;

              return (
                <div
                  key={col.id}
                  className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? "bg-white border-blue-200 shadow-sm"
                      : "bg-slate-50/80 border-slate-200/80 opacity-70 hover:opacity-100"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          onClick={() => handleToggleCollection(col.id)}
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center cursor-pointer transition-all ${
                            isSelected ? "bg-blue-50 text-[#0071e3]" : "bg-slate-200/70 text-slate-500"
                          }`}
                        >
                          <IconComp size={20} />
                        </div>
                        <div>
                          <h4
                            onClick={() => handleToggleCollection(col.id)}
                            className="font-bold text-slate-900 text-sm cursor-pointer hover:text-[#0071e3]"
                          >
                            {col.name}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-400">{col.id}</span>
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleCollection(col.id)}
                        className="w-4 h-4 text-blue-600 rounded cursor-pointer mt-1"
                      />
                    </div>

                    <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                      {col.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      {count !== undefined && count !== null ? `${count} registros` : "Carregando..."}
                    </span>

                    <button
                      onClick={() => handleOpenPreview(col)}
                      className="text-xs font-bold text-[#0071e3] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={12} />
                      <span>Pré-visualizar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 4: VALIDAR / INSPECIONAR ARQUIVO DE BACKUP LOCAL     */}
      {/* ======================================================== */}
      {activeTab === "inspecionar" && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6 animate-in fade-in duration-200">
          <div>
            <h3 className="text-base font-bold text-slate-900">Validação e Análise de Arquivos de Backup</h3>
            <p className="text-xs text-slate-500">
              Faça upload de um arquivo <code className="font-mono text-indigo-600">.json</code> exportado para inspecionar seus metadados, contagem de registros e integridade dos dados.
            </p>
          </div>

          <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-3xl p-8 text-center transition-all bg-slate-50/50">
            <FolderArchive className="w-12 h-12 text-[#0071e3] mx-auto mb-3 opacity-80" />
            <p className="text-sm font-bold text-slate-800">Selecione o arquivo de backup (.json)</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">Arquivos gerados pelo sistema União Condominial.GO</p>

            <input
              type="file"
              accept=".json"
              id="upload-backup-inspect"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                  try {
                    const parsed = JSON.parse(event.target?.result as string);
                    setInspectedBackup(parsed);
                    setInspectModalOpen(true);
                  } catch (err) {
                    toast.error("Arquivo JSON inválido ou corrompido.");
                  }
                };
                reader.readAsText(file);
              }}
            />

            <label
              htmlFor="upload-backup-inspect"
              className="px-6 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-md shadow-slate-900/10 transition-all active:scale-95"
            >
              <FileCheck2 size={14} />
              <span>Carregar e Inspecionar Arquivo</span>
            </label>
          </div>
        </div>
      )}

      {/* Modal de Detalhamento do Log Selecionado */}
      {selectedLogDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  selectedLogDetail.status === "sucesso" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                }`}>
                  {selectedLogDetail.status === "sucesso" ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Relatório de Conclusão do Backup</h3>
                  <p className="text-xs text-slate-500">ID do Log: {selectedLogDetail.id || "Recente"}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedLogDetail(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Iniciado Em:</span>
                  <span className="font-bold text-slate-800">{formatTimestamp(selectedLogDetail.iniciadoEm)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Concluído Em:</span>
                  <span className="font-bold text-slate-800">{formatTimestamp(selectedLogDetail.concluidoEm)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Total de Registros:</span>
                  <span className="font-bold text-emerald-600">{selectedLogDetail.totalRegistros} docs</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Tamanho Estimado:</span>
                  <span className="font-bold text-indigo-600">{formatBytes(selectedLogDetail.tamanhoBytesEstimado)}</span>
                </div>
              </div>

              {/* Mensagem */}
              <div className="p-3 bg-blue-50 border border-blue-200/80 rounded-2xl text-xs text-slate-700">
                <strong>Resumo:</strong> {selectedLogDetail.mensagem}
              </div>

              {/* Tabela de Coleções Detalhadas */}
              {selectedLogDetail.colecoesDetalhadas && selectedLogDetail.colecoesDetalhadas.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Detalhamento por Coleção ({selectedLogDetail.colecoesDetalhadas.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {selectedLogDetail.colecoesDetalhadas.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between text-xs shadow-3xs"
                      >
                        <div>
                          <span className="font-bold text-slate-800 block">{c.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">{c.id}</span>
                        </div>
                        <span className="px-2.5 py-1 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {c.count} docs
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <button
                onClick={() => handleDownloadLogJson(selectedLogDetail)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-2"
              >
                <Download size={14} />
                <span>Exportar Relatório JSON</span>
              </button>

              <button
                onClick={() => setSelectedLogDetail(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pré-visualização de Dados */}
      {previewCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0071e3] flex items-center justify-center">
                  <Eye size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Pré-visualização: {previewCollection.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Amostra dos 15 primeiros registros da coleção <code className="font-mono">{previewCollection.id}</code>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setPreviewCollection(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {previewLoading ? (
                <div className="py-12 text-center">
                  <Loader2 size={32} className="animate-spin text-[#0071e3] mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">Carregando dados do Firestore...</p>
                </div>
              ) : previewData.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-sm font-bold">Nenhum registro encontrado nesta coleção.</p>
                </div>
              ) : (
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl text-xs font-mono overflow-x-auto max-h-96">
                  {JSON.stringify(previewData, null, 2)}
                </pre>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setPreviewCollection(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Inspeção de Arquivo */}
      {inspectModalOpen && inspectedBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FileCheck2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Validação do Arquivo de Backup</h3>
                  <p className="text-xs text-slate-500">Estrutura de dados inspecionada com sucesso</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setInspectModalOpen(false);
                  setInspectedBackup(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block">Data do Backup:</span>
                  <span className="font-bold text-slate-800">
                    {inspectedBackup._metadata?.generatedAt || inspectedBackup._metadata?.geradoEm || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Coleções:</span>
                  <span className="font-bold text-indigo-600">
                    {inspectedBackup.collections ? Object.keys(inspectedBackup.collections).length : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Total de Registros:</span>
                  <span className="font-bold text-emerald-600">
                    {inspectedBackup._metadata?.totalRecords ?? "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Versão:</span>
                  <span className="font-bold text-slate-700">
                    {inspectedBackup._metadata?.version || inspectedBackup._metadata?.versao || "2.0"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => {
                  setInspectModalOpen(false);
                  setInspectedBackup(null);
                }}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
