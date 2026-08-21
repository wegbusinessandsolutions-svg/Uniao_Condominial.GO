import React, { useState, useEffect } from "react";
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
import FormularioBeneficioModal from "../../components/admin/FormularioBeneficioModal";

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
  const [data, setData] = useState<any[]>(staticData);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Stock/Custom filtering states
  const [showFilters, setShowFilters] = useState(false);
  const [filterTipo, setFilterTipo] = useState("Todos");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

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
      setEditingId(item.id);
      setFormData(item);
      setOriginalData(JSON.parse(JSON.stringify(item)));
    } else {
      setEditingId(null);
      setFormData({});
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
      const dataToSave = { ...formData };

      Object.keys(dataToSave).forEach((key) => {
        if (dataToSave[key] === undefined) {
          delete dataToSave[key];
        }
      });

      const itemName = dataToSave.nome || dataToSave.descricao || dataToSave.nivel || dataToSave.titulo || "Sem Nome";

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

  const filteredData = data.filter((item) => {
    // Search Term Filter
    if (searchTerm) {
      const matchesSearch = Object.values(item).some((val) =>
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (!matchesSearch) return false;
    }

    // Filters for "Controle de Estoque"
    if (collectionName === "estoque_movimentacoes") {
      // Tipo Filter (Entrada / Saída)
      if (filterTipo && filterTipo !== "Todos") {
        if (item.tipo !== filterTipo) return false;
      }

      // Date Filter (createdAt)
      if (item.createdAt) {
        const itemDate = new Date(item.createdAt);
        if (filterStartDate) {
          const start = new Date(filterStartDate);
          start.setHours(0, 0, 0, 0);
          if (itemDate < start) return false;
        }
        if (filterEndDate) {
          const end = new Date(filterEndDate);
          end.setHours(23, 59, 59, 999);
          if (itemDate > end) return false;
        }
      } else if (filterStartDate || filterEndDate) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => {
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between gap-4 print:hidden">
          <div className="relative max-w-md w-full">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light focus:border-transparent text-sm"
            />
          </div>
          
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer select-none ${
              showFilters || filterTipo !== "Todos" || filterStartDate || filterEndDate
                ? "bg-brand-light/15 border-brand-light text-brand-dark shadow-2xs"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Filter size={16} /> 
            <span>Filtros</span>
            {(filterTipo !== "Todos" || filterStartDate || filterEndDate) && (
              <span className="w-2 h-2 rounded-full bg-brand-light animate-pulse inline-block" />
            )}
          </button>
        </div>

        {/* Dynamic Expandable Filter Panel */}
        {showFilters && collectionName === "estoque_movimentacoes" && (
          <div className="bg-slate-50/75 border-b border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end animate-fadeIn print:hidden">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</label>
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-light focus:border-transparent outline-none text-slate-700 font-medium transition-all"
              >
                <option value="Todos">Todos os tipos</option>
                <option value="Entrada">Entrada</option>
                <option value="Saída">Saída</option>
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">De (Data)</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-light focus:border-transparent outline-none text-slate-700 font-medium transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Até (Data)</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-light focus:border-transparent outline-none text-slate-700 font-medium transition-all"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setFilterTipo("Todos");
                  setFilterStartDate("");
                  setFilterEndDate("");
                }}
                className="flex-1 py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer select-none text-center"
              >
                Limpar
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="flex-1 py-1.5 px-3 bg-brand-dark text-white rounded-lg text-xs font-bold hover:bg-brand-dark/95 transition-all cursor-pointer select-none text-center"
              >
                Aplicar
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-3 font-semibold">
                    {col.label}
                  </th>
                ))}
                {collectionName && (
                  <th className="px-4 py-3 font-semibold w-[100px] print:hidden">
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
                          style={{ width: cIdx === 0 ? '60%' : cIdx === 1 ? '45%' : '75%' }}
                        />
                      </td>
                    ))}
                    {collectionName && (
                      <td className="px-4 py-4 print:hidden">
                        <div className="h-4 bg-slate-100 rounded w-16" />
                      </td>
                    )}
                  </tr>
                ))
              ) : filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (collectionName ? 1 : 0)}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    <FileText className="mx-auto h-8 w-8 mb-3 text-slate-300" />
                    <p>Nenhum registro encontrado.</p>
                  </td>
                </tr>
              ) : (
                filteredData.map((row, i) => (
                  <tr
                    key={i}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-slate-700">
                        {col.render
                          ? col.render(row[col.key], row)
                          : row[col.key] || "-"}
                      </td>
                    ))}
                    {collectionName && (
                      <td className="px-4 py-3 print:hidden">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={handlePrint}
                            className="text-slate-400 hover:text-blue-900 transition-colors"
                            title="Imprimir"
                          >
                            <Printer size={18} />
                          </button>
                          <button
                            onClick={() => handleExportPdf(row)}
                            disabled={isExportingPdf}
                            className="text-slate-400 hover:text-sky-600 transition-colors cursor-pointer disabled:opacity-50"
                            title="Baixar PDF deste Benefício"
                          >
                            <Download size={18} />
                          </button>
                          <button
                            onClick={() => handleOpenModal(row)}
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                            title="Editar"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={() => setItemToDelete(row.id)}
                            className="text-slate-400 hover:text-red-600 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
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
        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-sm text-slate-500 print:hidden">
          <p>Mostrando {filteredData.length} registros</p>
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
