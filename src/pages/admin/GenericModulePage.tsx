import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { flushSync } from "react-dom";
import {
  Plus,
  Search,
  Filter,
  Download,
  FileText,
  Trash2,
  Pencil,
  Printer,
  X,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  TrendingUp,
  MousePointer,
  Award,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { initFirebase } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";
import { validarCPF, validarCNPJ, formatarCpfCnpj } from "../../lib/documentValidators";
import { exportBeneficiosPdf, exportServicosPdf, exportGenericPdf } from "../../lib/pdfExport";
import { compareSkuAscending } from "../../lib/serviceUtils";
import { useAuth } from "../../context/AuthContext";
import { useFranqueada } from "../../context/FranqueadaContext";
import FormularioBeneficioModal from "../../components/admin/FormularioBeneficioModal";
import GenericTableFilters, {
  FilterState,
  initialFilterState,
  DynamicFilterOption,
} from "../../components/admin/GenericTableFilters";

interface Metric {
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
}

export interface Field {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "date" | "image";
  options?: string[]; // for select
  required?: boolean;
}


interface Column {
  key: string;
  label: string;
  render?: (val: any, row: any) => React.ReactNode;
}

interface GenericModulePageProps {
  title: string;
  description?: string;
  metrics?: Metric[];
  columns?: Column[];
  fields?: Field[];
  collectionName?: string;
  onAddMessage?: string;
  // Fallback static data if no collectionName
  data?: any[];
}

export default function GenericModulePage({
  title,
  description,
  metrics = [],
  columns = [],
  fields = [],
  collectionName,
  onAddMessage = "Novo Registro",
  data: staticData = [],
}: GenericModulePageProps) {
  const { profile } = useAuth();
  const {
    filterByFranqueada,
    injectFranqueada,
    canModify,
    isFranqueada,
    userUnidade,
  } = useFranqueada();
  const [data, setData] = useState<any[]>(staticData);
  const [loading, setLoading] = useState(false);

  // Advanced Filtering & Search State
  const [filters, setFilters] = useState<FilterState>(initialFilterState);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(15);
  const [jumpPageInput, setJumpPageInput] = useState<string>("");
  const tableRef = React.useRef<HTMLDivElement>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [originalData, setOriginalData] = useState<any>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [uploadingImages, setUploadingImages] = useState<Record<string, boolean>>({});
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  const handleImageUpload = (key: string, file: File) => {
    if (!file) return;

    setUploadingImages(prev => ({ ...prev, [key]: true }));
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        let width = img.width;
        let height = img.height;
        const maxDim = 800; // max width/height

        if (width > height) {
          if (width > maxDim) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        const base64String = canvas.toDataURL("image/webp", 0.7); // compress to webp
        handleChange(key, base64String);
        setUploadingImages(prev => ({ ...prev, [key]: false }));
      };
      img.onerror = () => {
        alert("Erro ao processar a imagem.");
        setUploadingImages(prev => ({ ...prev, [key]: false }));
      }
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      alert("Erro ao ler o arquivo.");
      setUploadingImages(prev => ({ ...prev, [key]: false }));
    };
    reader.readAsDataURL(file);
  };

  const fetchData = async () => {
    if (!collectionName) return;
    setLoading(true);
    try {
      const { db } = await initFirebase();
      const querySnapshot = await getDocs(collection(db, collectionName));
      const items: any[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setData(items);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (collectionName) {
      fetchData();
    } else {
      setData(staticData);
    }
  }, [collectionName]);

  useEffect(() => {
    if (searchParams.get("novo") === "true" || searchParams.get("action") === "new") {
      handleOpenModal();
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("novo");
      newParams.delete("action");
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams]);

  const handleOpenModal = (item?: any) => {
    if (item) {
      if (!canModify(item)) {
        alert("Acesso Restrito: Você só pode editar registros pertencentes à sua própria unidade franqueada.");
        return;
      }
      setEditingId(item.id);
      setFormData(item);
      setOriginalData(JSON.parse(JSON.stringify(item)));
    } else {
      setEditingId(null);
      setFormData(injectFranqueada({}));
      setOriginalData(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({});
    setOriginalData(null);
  };

  const handleChange = (key: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectionName || isSaving) return;
    
    // Check if any image is currently uploading
    if (Object.values(uploadingImages).some(isUploading => isUploading)) {
      alert("Aguarde o upload das imagens concluir.");
      return;
    }

    // Validate CPF / CNPJ fields
    for (const field of fields) {
      const isDocField = field.key === "documento" || field.key === "cpf" || field.key === "cnpj" || field.key === "cpfCnpj" ||
                         field.label.toUpperCase().includes("CPF") || field.label.toUpperCase().includes("CNPJ");
      
      if (isDocField) {
        const val = formData[field.key];
        if (val) {
          const clean = String(val).replace(/\D/g, "");
          const isCPF = clean.length <= 11;
          const isValid = isCPF ? validarCPF(clean) : validarCNPJ(clean);
          if (!isValid) {
            alert(`O ${isCPF ? "CPF" : "CNPJ"} informado no campo "${field.label}" é inválido. Por favor, verifique.`);
            return;
          }
        }
      }
    }

    setIsSaving(true);
    try {
      const { db } = await initFirebase();
      const rawData = { ...formData };

      Object.keys(rawData).forEach((key) => {
        if (rawData[key] === undefined) {
          delete rawData[key];
        }
      });

      // Injeta franqueadaId e codigoUnidade de acordo com a política de isolamento
      const dataToSave = injectFranqueada(rawData);
      const itemName = dataToSave.nome || dataToSave.descricao || dataToSave.nivel || dataToSave.titulo || "Sem Nome";

      if (editingId) {
        if (originalData && !canModify(originalData)) {
          alert("Acesso Restrito: Permissão negada para atualizar dados de outra franquia.");
          setIsSaving(false);
          return;
        }
        await updateDoc(doc(db, collectionName, editingId), dataToSave);
        await logAction(
          `Edição no módulo "${title || collectionName}": ${itemName}`,
          "Administrativo",
          { collection: collectionName, documentId: editingId, itemName },
          originalData,
          dataToSave
        );
      } else {
        const docRef = await addDoc(collection(db, collectionName), {
          ...dataToSave,
          createdAt: new Date().toISOString(),
        });
        await logAction(
          `Criação no módulo "${title || collectionName}": ${itemName}`,
          "Administrativo",
          { collection: collectionName, documentId: docRef.id, itemName },
          null,
          dataToSave
        );
      }

      handleCloseModal();
      fetchData();
    } catch (error) {
      console.error("Error saving document:", error);
      alert("Erro ao formatar os dados.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!collectionName) return;
    try {
      const { db } = await initFirebase();
      const itemToDelete = data.find(item => item.id === id);
      if (itemToDelete && !canModify(itemToDelete)) {
        alert("Acesso Restrito: Você só pode excluir registros pertencentes à sua própria unidade franqueada.");
        return;
      }
      const itemName = itemToDelete ? (itemToDelete.nome || itemToDelete.descricao || itemToDelete.nivel || itemToDelete.titulo || id) : id;

      await deleteDoc(doc(db, collectionName, id));

      // LOG ACTION
      await logAction(
        `Exclusão no módulo "${title || collectionName}": ${itemName}`,
        "Administrativo",
        { collection: collectionName, documentId: id, itemName },
        itemToDelete || null,
        null
      );

      fetchData();
    } catch (error) {
      console.error("Error deleting document:", error);
      alert("Erro interno.");
    }
  };

  const handlePrint = () => {
    flushSync(() => { setIsPrinting(true); });
    window.print();
  };

  const handleExportPdf = async (singleRow?: any) => {
    setIsExportingPdf(true);
    try {
      const listToExport = singleRow ? [singleRow] : filteredData;
      const condomName = profile?.nome || profile?.razaoSocial || profile?.displayName || profile?.condominio || profile?.empresa || "Condomínio";

      if (collectionName === "clube_beneficios") {
        await exportBeneficiosPdf(listToExport, title, {
          userName: profile?.nome || "Administrador",
          userCpf: profile?.cpf,
          condominioName: condomName,
          condominioCnpj: profile?.cnpj || profile?.cpfCnpj || profile?.cpf,
          cardSuffix: profile?.uid?.slice(-6).toUpperCase(),
        });
      } else if (collectionName === "servicos_essenciais" || title?.toLowerCase().includes("serviço") || title?.toLowerCase().includes("servico")) {
        await exportServicosPdf(listToExport, title || "Serviços Condominiais Rotineiros", columns, {
          userName: profile?.nome || "Administrador",
          condominioName: condomName,
        });
      } else {
        await exportGenericPdf(listToExport, title || "Relatório", columns, {
          userName: profile?.nome || "Administrador",
          condominioName: condomName,
        });
      }
    } catch (err) {
      console.error("Erro na exportação PDF:", err);
      alert("Erro ao realizar exportação PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleSort = (colKey: string) => {
    if (filters.sortBy === colKey) {
      if (filters.sortOrder === "asc") {
        setFilters((prev) => ({ ...prev, sortOrder: "desc" }));
      } else if (filters.sortOrder === "desc") {
        setFilters((prev) => ({ ...prev, sortBy: "", sortOrder: "default" }));
      } else {
        setFilters((prev) => ({ ...prev, sortOrder: "asc" }));
      }
    } else {
      setFilters((prev) => ({ ...prev, sortBy: colKey, sortOrder: "asc" }));
    }
  };

  // Reset pagination to page 1 on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Dynamic status options from fields & data
  const { statusOptions, statusCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    const set = new Set<string>();

    const statusField = fields.find(
      (f) => f.key === "status" || f.key === "situacao" || f.key === "estado"
    );
    if (statusField?.options) {
      statusField.options.forEach((opt) => set.add(opt));
    }

    data.forEach((item) => {
      const st = item.status || item.situacao || item.estado;
      if (st && typeof st === "string") {
        set.add(st);
        counts[st] = (counts[st] || 0) + 1;
      }
    });

    return {
      statusOptions: Array.from(set),
      statusCounts: counts,
    };
  }, [fields, data]);

  // Dynamic filter options for selects, dates, and numbers
  const dynamicOptions: DynamicFilterOption[] = useMemo(() => {
    const list: DynamicFilterOption[] = [];

    // Fields configured in props
    fields.forEach((f) => {
      if (f.key === "status" || f.key === "situacao" || f.key === "estado") return;
      if (f.type === "select") {
        const uniqueValues = new Set<string>(f.options || []);
        data.forEach((item) => {
          if (item[f.key] && typeof item[f.key] === "string") {
            uniqueValues.add(item[f.key]);
          }
        });
        list.push({
          key: f.key,
          label: f.label,
          type: "select",
          options: Array.from(uniqueValues),
        });
      } else if (f.type === "number") {
        list.push({
          key: f.key,
          label: f.label,
          type: "number",
        });
      } else if (f.type === "date") {
        list.push({
          key: f.key,
          label: f.label,
          type: "date",
        });
      }
    });

    // Also check for common categorical columns not in fields
    columns.forEach((c) => {
      if (
        c.key === "status" ||
        c.key === "situacao" ||
        c.key === "imagem" ||
        c.key === "logomarca" ||
        list.some((o) => o.key === c.key)
      ) {
        return;
      }
      if (
        c.key === "tipo" ||
        c.key === "categoria" ||
        c.key === "categoriaPai" ||
        c.key === "departamento" ||
        c.key === "nivel" ||
        c.key === "cargo" ||
        c.key === "unidade"
      ) {
        const uniqueVals = new Set<string>();
        data.forEach((item) => {
          if (item[c.key] && typeof item[c.key] === "string") {
            uniqueVals.add(item[c.key]);
          }
        });
        if (uniqueVals.size > 0 && uniqueVals.size <= 30) {
          list.push({
            key: c.key,
            label: c.label,
            type: "select",
            options: Array.from(uniqueVals),
          });
        }
      }
    });

    return list;
  }, [fields, columns, data]);

  const filteredData = useMemo(() => {
    const scopedList = filterByFranqueada(data);
    return scopedList
      .filter((item) => {
        // 1. Search Term Filter (Global or Column-specific)
        if (filters.search.trim()) {
          const query = filters.search.trim().toLowerCase();
          if (filters.searchField === "all") {
            const matchesSearch = Object.entries(item).some(([k, val]) => {
              if (val === null || val === undefined) return false;
              if (typeof val === "object") return false;
              return String(val).toLowerCase().includes(query);
            });
            if (!matchesSearch) return false;
          } else {
            const val = item[filters.searchField];
            if (val === null || val === undefined || !String(val).toLowerCase().includes(query)) {
              return false;
            }
          }
        }

        // 2. Status Filter
        if (filters.status !== "all") {
          const itemStatus = item.status || item.situacao || item.estado;
          if (itemStatus !== filters.status) return false;
        }

        // 3. Date Range Filter
        if (filters.startDate || filters.endDate) {
          const dateVal =
            item[filters.dateField] ||
            item.createdAt ||
            item.data ||
            item.updatedAt ||
            item.dataHora ||
            item.validade;

          if (dateVal) {
            const itemDate = new Date(dateVal);
            if (!isNaN(itemDate.getTime())) {
              if (filters.startDate) {
                const start = new Date(filters.startDate);
                start.setHours(0, 0, 0, 0);
                if (itemDate < start) return false;
              }
              if (filters.endDate) {
                const end = new Date(filters.endDate);
                end.setHours(23, 59, 59, 999);
                if (itemDate > end) return false;
              }
            }
          } else if (filters.startDate || filters.endDate) {
            return false;
          }
        }

        // 4. Dynamic Select / Category Filters
        for (const [key, selectedVal] of Object.entries(filters.selectFilters)) {
          if (selectedVal && selectedVal !== "all") {
            if (String(item[key] || "") !== selectedVal) {
              return false;
            }
          }
        }

        // 5. Dynamic Number Filters (Min / Max)
        for (const [key, range] of Object.entries(filters.numberFilters) as [
          string,
          { min?: number | ""; max?: number | "" }
        ][]) {
          const numVal = Number(item[key]);
          if (range?.min !== "" && range?.min !== undefined) {
            if (isNaN(numVal) || numVal < Number(range.min)) return false;
          }
          if (range?.max !== "" && range?.max !== undefined) {
            if (isNaN(numVal) || numVal > Number(range.max)) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Custom Column Header Sort
        if (filters.sortBy && filters.sortOrder !== "default") {
          const valA = a[filters.sortBy];
          const valB = b[filters.sortBy];
          const multiplier = filters.sortOrder === "asc" ? 1 : -1;

          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;

          if (typeof valA === "number" && typeof valB === "number") {
            return (valA - valB) * multiplier;
          }

          const strA = String(valA).toLowerCase();
          const strB = String(valB).toLowerCase();
          return strA.localeCompare(strB, "pt-BR", { numeric: true }) * multiplier;
        }

        // Default Sort Fallbacks
        if (
          collectionName === "servicos_essenciais" ||
          title?.toLowerCase().includes("serviço") ||
          title?.toLowerCase().includes("servico")
        ) {
          return compareSkuAscending(a, b);
        }
        if (
          collectionName === "marcas_parceiras" ||
          title?.toLowerCase().includes("marca")
        ) {
          const nomeA = (a.nome || "").trim();
          const nomeB = (b.nome || "").trim();
          return nomeA.localeCompare(nomeB, "pt-BR", { sensitivity: "base", numeric: true });
        }
        return 0;
      });
  }, [data, filters, collectionName, title]);

  // Reset to first page whenever filter or collection changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, collectionName]);

  // Pagination calculations
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(filteredData.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    if (pageSize === "all") return filteredData;
    const startIndex = (validCurrentPage - 1) * pageSize;
    return filteredData.slice(startIndex, startIndex + pageSize);
  }, [filteredData, validCurrentPage, pageSize]);

  const availableFilterColumns = useMemo(() => {
    return columns.map((col) => ({
      key: col.key,
      label: col.label,
    }));
  }, [columns]);

  const isClubeBeneficios = collectionName === "clube_beneficios";

  const totalClicksClube = isClubeBeneficios
    ? data.reduce((acc, curr) => acc + (Number(curr.clicks) || 0), 0)
    : 0;

  const sortedClubePartners = isClubeBeneficios
    ? [...data]
        .map((item) => ({
          id: item.id,
          nome: item.nome || "Sem Nome",
          clicks: Number(item.clicks) || 0,
          tipo: item.tipo || "Parceiro",
          valor: item.valor ? `${item.tipo === "Desconto (%)" ? `${item.valor}%` : `R$ ${item.valor}`}` : "-",
        }))
        .sort((a, b) => b.clicks - a.clicks)
    : [];

  const topClubePartner = sortedClubePartners.length > 0 ? sortedClubePartners[0] : null;

  return (
    <>
    <div className="space-y-6 print:hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-slate-500 mt-1">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Printer size={16} /> Imprimir
          </button>
          <button
            onClick={() => handleExportPdf()}
            disabled={isExportingPdf}
            className="px-4 py-2 bg-sky-700 text-white border border-sky-800 rounded-lg text-sm font-medium hover:bg-sky-800 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60 shadow-xs"
            title="Exportar em PDF com todos os contatos e comunicado para condôminos"
          >
            <Download size={16} /> {isExportingPdf ? "Gerando PDF..." : "Exportar PDF"}
          </button>
          {collectionName && (
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-brand-dark text-white rounded-lg text-sm font-medium hover:bg-brand-dark/90 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} /> {onAddMessage}
            </button>
          )}
        </div>
      </div>

      {metrics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4 print:hidden">
          {metrics.map((m, i) => (
            <div
              key={i}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"
            >
              <p className="text-sm font-medium text-slate-500 mb-1">
                {m.label}
              </p>
              <div className="flex items-end justify-between">
                <h3 className="text-2xl font-bold text-slate-900">{m.value}</h3>
                {m.trend && (
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${m.trendUp ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}
                  >
                    {m.trend}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gráfico e Métricas do Clube de Benefícios */}
      {isClubeBeneficios && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 print:hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 text-sky-700 text-xs font-bold uppercase tracking-wider mb-1">
                <QrCode size={16} />
                <span>Métricas de Engajamento dos Condôminos</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Interesse por Empresa Parceira (Acessos ao QR Code)
              </h2>
              <p className="text-xs text-slate-500">
                Acompanhe quais parceiros e vantagens estão gerando mais interesse aos condôminos através das leituras de QR Code.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-sky-50 px-3.5 py-2 rounded-xl border border-sky-100 text-right">
                <span className="text-[10px] uppercase font-bold text-sky-600 block">Total de Leituras</span>
                <span className="text-lg font-extrabold text-sky-900 flex items-center justify-end gap-1">
                  <MousePointer size={16} className="text-sky-600" />
                  {totalClicksClube}
                </span>
              </div>
              {topClubePartner && (
                <div className="bg-amber-50 px-3.5 py-2 rounded-xl border border-amber-200 text-right">
                  <span className="text-[10px] uppercase font-bold text-amber-700 block">Parceiro Mais Popular</span>
                  <span className="text-sm font-bold text-amber-950 truncate max-w-[160px] block" title={topClubePartner.nome}>
                    🏆 {topClubePartner.nome} ({topClubePartner.clicks})
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Gráfico de Barras do Recharts */}
            <div className="lg:col-span-2 h-72 w-full bg-slate-50/50 p-3 rounded-xl border border-slate-100 flex flex-col justify-center">
              {sortedClubePartners.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
                  <QrCode size={28} className="text-slate-300" />
                  <span>Nenhum parceiro cadastrado para exibir no gráfico.</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sortedClubePartners}
                    margin={{ top: 15, right: 15, left: -25, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="nome"
                      tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                      interval={0}
                      angle={-10}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const dataItem = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1 border border-slate-800">
                              <p className="font-bold text-sky-300 text-sm">{dataItem.nome}</p>
                              <p className="text-slate-200 flex items-center gap-1.5 font-medium">
                                <QrCode size={13} className="text-sky-400" />
                                <span>{dataItem.clicks} {dataItem.clicks === 1 ? 'acesso / leitura' : 'acessos / leituras'}</span>
                              </p>
                              {dataItem.valor !== "-" && (
                                <p className="text-emerald-400 font-semibold text-[11px]">Vantagem: {dataItem.valor}</p>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="clicks" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {sortedClubePartners.map((_, index) => {
                        const colors = ["#0284c7", "#0369a1", "#0284c7", "#2563eb", "#4f46e5", "#7c3aed"];
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Ranking dos Mais Acessados */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Award size={15} className="text-amber-500" />
                  <span>Ranking de Interesse</span>
                </h3>
                <div className="space-y-2 overflow-y-auto max-h-52 pr-1">
                  {sortedClubePartners.length === 0 ? (
                    <p className="text-xs text-slate-400">Nenhum parceiro registrado.</p>
                  ) : (
                    sortedClubePartners.map((partner, idx) => (
                      <div
                        key={partner.id || idx}
                        className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200/80 shadow-2xs text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                              idx === 0
                                ? "bg-amber-400 text-amber-950"
                                : idx === 1
                                ? "bg-slate-300 text-slate-800"
                                : idx === 2
                                ? "bg-amber-700/30 text-amber-900"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="truncate">
                            <span className="font-semibold text-slate-800 block truncate">
                              {partner.nome}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-sky-700 text-xs block">
                            {partner.clicks} {partner.clicks === 1 ? "clique" : "cliques"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Total de parceiros: <strong className="text-slate-800">{sortedClubePartners.length}</strong></span>
                <span className="text-sky-600 font-semibold">Atualizado ao vivo</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Global Search Component */}
      <GenericTableFilters
        filters={filters}
        onFilterChange={setFilters}
        onResetFilters={() => setFilters(initialFilterState)}
        availableColumns={availableFilterColumns}
        dynamicOptions={dynamicOptions}
        statusOptions={statusOptions}
        statusCounts={statusCounts}
        totalCount={data.length}
        filteredCount={filteredData.length}
        isOpen={isFilterPanelOpen}
        onToggleOpen={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
      />

      <div ref={tableRef} className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Table Top Info & Quick Pagination Bar */}
        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">
              {filteredData.length === 0 ? (
                "Nenhum registro"
              ) : (
                <>
                  Página <strong className="text-sky-700">{validCurrentPage}</strong> de{" "}
                  <strong className="text-slate-800">{totalPages}</strong> • Mostrando{" "}
                  <strong className="text-slate-800">
                    {pageSize === "all"
                      ? `1 - ${filteredData.length}`
                      : `${(validCurrentPage - 1) * pageSize + 1} - ${Math.min(
                          validCurrentPage * pageSize,
                          filteredData.length
                        )}`}
                  </strong>{" "}
                  de <strong className="text-slate-900">{filteredData.length}</strong> itens
                  {data.length !== filteredData.length && (
                    <span className="text-slate-400 font-normal ml-1">
                      (filtrado de {data.length})
                    </span>
                  )}
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Itens por pág.:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value === "all" ? "all" : Number(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold text-slate-700 outline-none cursor-pointer hover:bg-slate-50 focus:ring-1 focus:ring-sky-500"
              >
                <option value={10}>10 por pág.</option>
                <option value={15}>15 por pág.</option>
                <option value={25}>25 por pág.</option>
                <option value={50}>50 por pág.</option>
                <option value={100}>100 por pág.</option>
                <option value="all">Exibir Todos</option>
              </select>
            </div>

            {pageSize !== "all" && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setCurrentPage((p) => Math.max(1, p - 1));
                    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  disabled={validCurrentPage === 1}
                  className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Página Anterior"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-slate-700 font-bold px-1 min-w-[32px] text-center">
                  {validCurrentPage}/{totalPages}
                </span>
                <button
                  onClick={() => {
                    setCurrentPage((p) => Math.min(totalPages, p + 1));
                    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  disabled={validCurrentPage === totalPages}
                  className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Próxima Página"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                {columns.map((col) => {
                  const isSorted = filters.sortBy === col.key;
                  const isSortable = col.key !== "imagem" && col.key !== "logomarca" && col.key !== "acoes";

                  return (
                    <th
                      key={col.key}
                      onClick={() => isSortable && handleSort(col.key)}
                      className={`px-4 py-3 font-semibold select-none transition-colors ${
                        isSortable ? "cursor-pointer hover:bg-slate-100/80" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col.label}</span>
                        {isSortable && (
                          <span className="text-slate-400">
                            {isSorted ? (
                              filters.sortOrder === "asc" ? (
                                <ArrowUp size={14} className="text-sky-600" />
                              ) : filters.sortOrder === "desc" ? (
                                <ArrowDown size={14} className="text-sky-600" />
                              ) : (
                                <ArrowUpDown size={14} className="opacity-40" />
                              )
                            ) : (
                              <ArrowUpDown size={13} className="opacity-40 hover:opacity-100" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
                {collectionName && (
                  <th className="px-4 py-3 font-semibold w-[120px] text-right print:hidden">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, rIdx) => (
                  <tr key={rIdx} className="animate-pulse">
                    {columns.map((col, cIdx) => (
                      <td key={col.key} className="px-4 py-4">
                        <div
                          className="h-4 bg-slate-100 rounded"
                          style={{ width: cIdx === 0 ? "60%" : cIdx === 1 ? "45%" : "75%" }}
                        />
                      </td>
                    ))}
                    {collectionName && (
                      <td className="px-4 py-4 print:hidden">
                        <div className="h-4 bg-slate-100 rounded w-16 ml-auto" />
                      </td>
                    )}
                  </tr>
                ))
              ) : filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (collectionName ? 1 : 0)}
                    className="px-4 py-16 text-center text-slate-500"
                  >
                    <FileText className="mx-auto h-10 w-10 mb-3 text-slate-300" />
                    <p className="font-semibold text-slate-700">Nenhum registro encontrado</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {data.length > 0
                        ? "Tente ajustar ou limpar os filtros de busca para visualizar os itens."
                        : "Nenhum item cadastrado nesta categoria até o momento."}
                    </p>
                    {data.length > 0 && (
                      <button
                        onClick={() => setFilters(initialFilterState)}
                        className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        Limpar todos os filtros
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, i) => (
                  <tr
                    key={row.id || i}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3.5 text-slate-700">
                        {col.render
                          ? col.render(row[col.key], row)
                          : row[col.key] !== undefined && row[col.key] !== null && row[col.key] !== ""
                          ? String(row[col.key])
                          : "—"}
                      </td>
                    ))}
                    {collectionName && (
                      <td className="px-4 py-3.5 print:hidden text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={handlePrint}
                            className="p-1 text-slate-400 hover:text-blue-900 hover:bg-slate-100 rounded-md transition-colors"
                            title="Imprimir"
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            onClick={() => handleExportPdf(row)}
                            disabled={isExportingPdf}
                            className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                            title="Baixar PDF deste Registro"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            onClick={() => handleOpenModal(row)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Editar"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => setItemToDelete(row.id)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination Controls */}
        <div className="p-4 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-600 print:hidden bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium">
              {filteredData.length === 0 ? (
                "0 registros"
              ) : (
                <>
                  Mostrando{" "}
                  <strong>
                    {pageSize === "all"
                      ? `1 a ${filteredData.length}`
                      : `${(validCurrentPage - 1) * pageSize + 1} a ${Math.min(
                          validCurrentPage * pageSize,
                          filteredData.length
                        )}`}
                  </strong>{" "}
                  de <strong>{filteredData.length}</strong> registros
                  {data.length !== filteredData.length && (
                    <span className="text-slate-400 ml-1">
                      (total cadastrado: {data.length})
                    </span>
                  )}
                </>
              )}
            </span>

            <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
              <span className="text-slate-500">Exibir:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value === "all" ? "all" : Number(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 outline-none cursor-pointer hover:bg-slate-50 focus:ring-1 focus:ring-sky-500"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value="all">Todos</option>
              </select>
            </div>
          </div>

          {/* Pagination Navigation Buttons */}
          {pageSize !== "all" && totalPages > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setCurrentPage(1);
                    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  disabled={validCurrentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  title="Primeira Página"
                >
                  <ChevronsLeft size={14} />
                </button>

                <button
                  onClick={() => {
                    setCurrentPage((p) => Math.max(1, p - 1));
                    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  disabled={validCurrentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  title="Página Anterior"
                >
                  <ChevronLeft size={14} />
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    // Show current page, first, last, and immediate neighbors
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= validCurrentPage - 1 && pageNum <= validCurrentPage + 1)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => {
                            setCurrentPage(pageNum);
                            tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          className={`min-w-[28px] h-7 px-2 rounded-lg font-bold text-xs transition-colors ${
                            validCurrentPage === pageNum
                              ? "bg-sky-600 text-white shadow-xs"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (
                      (pageNum === 2 && validCurrentPage > 3) ||
                      (pageNum === totalPages - 1 && validCurrentPage < totalPages - 2)
                    ) {
                      return (
                        <span key={pageNum} className="px-1 text-slate-400 font-bold">
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>

                <button
                  onClick={() => {
                    setCurrentPage((p) => Math.min(totalPages, p + 1));
                    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  disabled={validCurrentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  title="Próxima Página"
                >
                  <ChevronRight size={14} />
                </button>

                <button
                  onClick={() => {
                    setCurrentPage(totalPages);
                    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  disabled={validCurrentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  title="Última Página"
                >
                  <ChevronsRight size={14} />
                </button>
              </div>

              {totalPages > 4 && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const targetPage = parseInt(jumpPageInput, 10);
                    if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
                      setCurrentPage(targetPage);
                      setJumpPageInput("");
                      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  className="flex items-center gap-1 pl-2 border-l border-slate-200"
                >
                  <span className="text-slate-500 text-[11px]">Ir para:</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={jumpPageInput}
                    onChange={(e) => setJumpPageInput(e.target.value)}
                    placeholder={`${validCurrentPage}`}
                    className="w-12 px-1.5 py-1 text-xs border border-slate-200 rounded text-center font-medium outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors"
                  >
                    Ir
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal for Add / Edit */}
      {isModalOpen && collectionName === "clube_beneficios" && (
        <FormularioBeneficioModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          editingItem={editingId ? formData : null}
          onSave={async (dataToSave) => {
            setIsSaving(true);
            try {
              const { db } = await initFirebase();
              const itemName = dataToSave.nome || "Sem Nome";

              if (editingId) {
                await updateDoc(doc(db, collectionName, editingId), dataToSave);
                await logAction(
                  `Edição no módulo "${title || collectionName}": ${itemName}`,
                  "Administrativo",
                  { collection: collectionName, documentId: editingId, itemName },
                  originalData,
                  dataToSave
                );
              } else {
                const docRef = await addDoc(collection(db, collectionName), {
                  ...dataToSave,
                  createdAt: new Date().toISOString(),
                });
                await logAction(
                  `Criação no módulo "${title || collectionName}": ${itemName}`,
                  "Administrativo",
                  { collection: collectionName, documentId: docRef.id, itemName },
                  null,
                  dataToSave
                );
              }

              handleCloseModal();
              fetchData();
            } catch (error) {
              console.error("Error saving document:", error);
              alert("Erro ao salvar os dados.");
            } finally {
              setIsSaving(false);
            }
          }}
          isSaving={isSaving}
        />
      )}

      {isModalOpen && collectionName !== "clube_beneficios" && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? "Editar Registro" : "Novo Registro"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form
                id="generic-form"
                onSubmit={handleSave}
                className="space-y-4"
              >
                {fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      {field.label}{" "}
                      {field.required && (
                        <span className="text-red-500">*</span>
                      )}
                    </label>
                    {field.type === "textarea" ? (
                      <textarea
                        required={field.required}
                        value={formData[field.key] || ""}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        rows={4}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light focus:border-transparent text-sm resize-y"
                      />
                    ) : field.type === "select" ? (
                      <select
                        required={field.required}
                        value={formData[field.key] || ""}
                        onChange={(e) =>
                          handleChange(field.key, e.target.value)
                        }
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light focus:border-transparent text-sm"
                      >
                        <option value="">Selecione...</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "image" ? (
                      <div className="space-y-2">
                        {formData[field.key] && (
                          <img src={formData[field.key]} alt="Preview" className="w-24 h-24 object-cover rounded-lg border border-slate-200" />
                        )}
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(field.key, file);
                            }}
                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-light/10 file:text-brand-dark hover:file:bg-brand-light/20"
                          />
                          {uploadingImages[field.key] && (
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                <span className="text-xs text-brand-dark font-medium animate-pulse">Enviando...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {(() => {
                          const isDocField = field.key === "documento" || field.key === "cpf" || field.key === "cnpj" || field.key === "cpfCnpj" ||
                                             field.label.toUpperCase().includes("CPF") || field.label.toUpperCase().includes("CNPJ");
                          return (
                            <>
                              <input
                                type={field.type}
                                required={field.required}
                                placeholder={isDocField ? "000.000.000-00 ou 00.000.000/0000-00" : ""}
                                value={formData[field.key] || ""}
                                onChange={(e) => {
                                  const val = isDocField ? formatarCpfCnpj(e.target.value) : e.target.value;
                                  handleChange(
                                    field.key,
                                    field.type === "number" && val !== ""
                                      ? Number(val)
                                      : val,
                                  );
                                }}
                                className={`w-full px-4 py-2 rounded-lg border outline-none focus:ring-2 focus:border-transparent text-sm ${
                                  isDocField && formData[field.key]
                                    ? (() => {
                                        const clean = String(formData[field.key]).replace(/\D/g, "");
                                        const isCPF = clean.length <= 11;
                                        const isValid = isCPF ? validarCPF(clean) : validarCNPJ(clean);
                                        return isValid ? "border-green-500 focus:ring-green-500/30" : "border-red-500 focus:ring-red-500/30";
                                      })()
                                    : "border-slate-200 focus:ring-brand-light"
                                }`}
                              />
                              {isDocField && formData[field.key] && (
                                <div className="mt-1 flex items-center gap-1 text-xs">
                                  {(() => {
                                    const clean = String(formData[field.key]).replace(/\D/g, "");
                                    const isCPF = clean.length <= 11;
                                    const isValid = isCPF ? validarCPF(clean) : validarCNPJ(clean);
                                    if (isValid) {
                                      return (
                                        <span className="text-green-600 font-medium flex items-center gap-1">
                                          <CheckCircle2 size={13} /> {isCPF ? "CPF válido" : "CNPJ válido"}
                                        </span>
                                      );
                                    } else {
                                      return (
                                        <span className="text-red-600 font-medium flex items-center gap-1">
                                          <AlertTriangle size={13} /> {isCPF ? "CPF inválido" : "CNPJ inválido ou incompleto"}
                                        </span>
                                      );
                                    }
                                  })()}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </>
                    )}
                  </div>
                ))}
              </form>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="generic-form"
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-dark rounded-lg shadow-sm hover:bg-brand-dark/90 transition-colors disabled:opacity-50"
              >
                {isSaving
                  ? "Salvando..."
                  : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>

      <ConfirmDeleteModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => itemToDelete && handleDelete(itemToDelete)}
      />

      {isPrinting && (
        <div className="hidden print:block w-full bg-white text-black font-sans text-[12px] p-8 absolute top-0 left-0 min-h-screen z-50">
          <div className="flex justify-between items-baseline border-b-2 border-slate-900 pb-2 mb-6">
            <div>
              <h1 className="text-xl font-bold">
                {title} — Relatório Detalhado
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {filteredData.length} registro(s) listado(s)
              </p>
            </div>
            <div className="text-slate-500 text-xs">
              Emitido em {new Date().toLocaleDateString("pt-BR")},{" "}
              {new Date().toLocaleTimeString("pt-BR")}
            </div>
          </div>

          {filteredData.map((item, idx) => {
            const mainTitle =
              item.nome ||
              item.name ||
              item.titulo ||
              item.title ||
              item.descricao ||
              `Registro #${idx + 1}`;
            return (
              <div
                key={item.id || idx}
                className="mb-8"
                style={{ pageBreakInside: "avoid" }}
              >
                <h2 className="text-sm font-bold uppercase mb-2">
                  {mainTitle}
                </h2>
                <table className="w-full border border-slate-200">
                  <tbody>
                    {columns.map((col) => (
                      <tr
                        key={col.key}
                        className="border-b border-slate-200 last:border-0"
                      >
                        <td className="bg-slate-50 font-semibold px-3 py-2 w-1/4 border-r border-slate-200">
                          {col.label}
                        </td>
                        <td className="px-3 py-2">{item[col.key] || "—"}</td>
                      </tr>
                    ))}
                    {item.status && (
                      <tr className="border-b border-slate-200">
                        <td className="bg-slate-50 font-semibold px-3 py-2 w-1/4 border-r border-slate-200">
                          Status
                        </td>
                        <td className="px-3 py-2">{item.status}</td>
                      </tr>
                    )}
                    <tr className="border-b border-slate-200">
                      <td className="bg-slate-50 font-semibold px-3 py-2 w-1/4 border-r border-slate-200">
                        ID
                      </td>
                      <td className="px-3 py-2">{item.id || "—"}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="bg-slate-50 font-semibold px-3 py-2 w-1/4 border-r border-slate-200">
                        Criado em
                      </td>
                      <td className="px-3 py-2">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString("pt-BR")
                          : "—"}
                      </td>
                    </tr>
                    <tr>
                      <td className="bg-slate-50 font-semibold px-3 py-2 w-1/4 border-r border-slate-200">
                        Atualizado em
                      </td>
                      <td className="px-3 py-2">
                        {item.updatedAt
                          ? new Date(item.updatedAt).toLocaleString("pt-BR")
                          : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}

          <div style={{ pageBreakInside: "avoid" }}>
            <table className="w-full border border-slate-200 mb-6">
              <thead>
                <tr>
                  <th
                    colSpan={columns.length + 1}
                    className="bg-slate-900 text-white text-left px-3 py-1.5 font-bold uppercase text-[11px]"
                  >
                    Resumo Geral
                  </th>
                </tr>
                <tr className="bg-slate-100 border-b border-slate-200">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="text-left px-3 py-2 font-semibold text-[11px] uppercase border-r border-slate-200"
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="text-left px-3 py-2 font-semibold text-[11px] uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item, idx) => (
                  <tr
                    key={item.id || idx}
                    className="border-b border-slate-200 last:border-0"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="px-3 py-2 border-r border-slate-200"
                      >
                        {item[col.key] || "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2">{item.status || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-center text-slate-500 text-[10px] mt-8 pt-4 border-t border-slate-200">
            Relatório analítico — gerado pelo sistema
          </div>
        </div>
      )}
      </>
  );
}
