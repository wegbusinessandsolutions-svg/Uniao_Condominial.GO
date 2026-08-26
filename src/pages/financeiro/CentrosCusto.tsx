import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Printer,
  Download,
  RefreshCw,
  Layers,
  Search,
  Filter,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Building2,
  Tag,
  ArrowDownRight,
  ArrowUpRight,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";
import {
  garantirCentroCustoAfiliacao,
  CENTRO_CUSTO_AFILIACAO,
} from "../../services/afiliacaoFinanceiroService";
import { useFranqueada } from "../../context/FranqueadaContext";

export type TipoCentro = "custo" | "lucro";

export interface CentroCustoItem {
  id: string;
  nome: string;
  tipo: TipoCentro;
  categoria: string;
  centroPai?: string;
  descricao?: string;
  status: "Ativo" | "Inativo";
  createdAt?: string;
  updatedAt?: string;
}

export default function CentrosCusto() {
  const { filterByFranqueada, injectFranqueada, canModify, isFranqueada } = useFranqueada();
  const [data, setData] = useState<CentroCustoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [migrationNotice, setMigrationNotice] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState<"todos" | "custo" | "lucro">("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "Ativo" | "Inativo">("todos");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("todas");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<CentroCustoItem>>({
    tipo: "custo",
    status: "Ativo",
    categoria: "fixo",
    nome: "",
    centroPai: "",
    descricao: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setMigrationNotice(null);
    try {
      // Garante que o centro padrão de afiliação exista no banco
      await garantirCentroCustoAfiliacao();

      const { db } = await initFirebase();
      const q = collection(db, "centros_custo");
      const snapshot = await getDocs(q);

      let migratedCount = 0;
      const rawItems: CentroCustoItem[] = [];

      for (const d of snapshot.docs) {
        const docData = d.data();
        let tipo: TipoCentro = "custo";

        // Se o registro não tiver tipo definido ou tiver tipo diferente de 'custo'/'lucro', migra para 'custo'
        if (
          !docData.tipo ||
          (docData.tipo !== "custo" && docData.tipo !== "lucro")
        ) {
          tipo = "custo";
          try {
            await updateDoc(doc(db, "centros_custo", d.id), {
              tipo: "custo",
              updatedAt: new Date().toISOString(),
            });
            migratedCount++;
          } catch (upErr) {
            console.warn(`Erro ao migrar tipo do centro ${d.id}:`, upErr);
          }
        } else {
          tipo = docData.tipo as TipoCentro;
        }

        rawItems.push({
          id: d.id,
          nome: docData.nome || "",
          tipo: tipo,
          categoria: docData.categoria || "fixo",
          centroPai: docData.centroPai || "",
          descricao: docData.descricao || "",
          status: docData.status === "Inativo" ? "Inativo" : "Ativo",
          createdAt: docData.createdAt,
          updatedAt: docData.updatedAt,
        });
      }

      if (migratedCount > 0) {
        setMigrationNotice(
          `${migratedCount} registro(s) existente(s) foram padronizados e atualizados automaticamente como "Centro de Custo".`
        );
      }

      setData(
        rawItems.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
      );
    } catch (err) {
      console.error("Erro ao buscar centros de custo e lucro:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setFormData(injectFranqueada({
      tipo: "custo",
      status: "Ativo",
      categoria: "fixo",
      nome: "",
      centroPai: "",
      descricao: "",
    }));
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: CentroCustoItem) => {
    if (!canModify(item)) {
      alert("Acesso Restrito: Você só pode editar centros de custo/lucro da sua própria franquia.");
      return;
    }
    setFormData({
      tipo: item.tipo || "custo",
      status: item.status || "Ativo",
      categoria: item.categoria || "fixo",
      nome: item.nome || "",
      centroPai: item.centroPai || "",
      descricao: item.descricao || "",
    });
    setEditingId(item.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({
      tipo: "custo",
      status: "Ativo",
      categoria: "fixo",
      nome: "",
      centroPai: "",
      descricao: "",
    });
    setEditingId(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome?.trim()) {
      alert("Por favor, informe o nome do centro.");
      return;
    }

    setIsSaving(true);
    try {
      const { db } = await initFirebase();
      const rawPayload: any = {
        nome: formData.nome.trim(),
        tipo: formData.tipo || "custo",
        categoria: formData.categoria || "fixo",
        centroPai: formData.centroPai?.trim() || "",
        descricao: formData.descricao?.trim() || "",
        status: formData.status || "Ativo",
        updatedAt: new Date().toISOString(),
      };
      const savePayload: any = injectFranqueada(rawPayload);

      if (editingId) {
        const oldDoc = data.find((d) => d.id === editingId);
        if (oldDoc && !canModify(oldDoc)) {
          alert("Acesso Restrito: Permissão negada para alterar centro de outra franquia.");
          setIsSaving(false);
          return;
        }
        await updateDoc(doc(db, "centros_custo", editingId), savePayload);
        await logAction(
          `Edição de centro (${savePayload.tipo === "lucro" ? "Centro de Lucro" : "Centro de Custo"}): ${savePayload.nome}`,
          "Financeiro",
          { costCenterId: editingId, ...savePayload }
        );
      } else {
        savePayload.createdAt = new Date().toISOString();
        const newDoc = await addDoc(
          collection(db, "centros_custo"),
          savePayload
        );
        await logAction(
          `Criação de centro (${savePayload.tipo === "lucro" ? "Centro de Lucro" : "Centro de Custo"}): ${savePayload.nome}`,
          "Financeiro",
          { costCenterId: newDoc.id, ...savePayload }
        );
      }
      closeModal();
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar o centro.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { db } = await initFirebase();
      const itemToDeleteObj = data.find((item) => item.id === id);
      if (itemToDeleteObj && !canModify(itemToDeleteObj)) {
        alert("Acesso Restrito: Você só pode excluir centros da sua própria franquia.");
        return;
      }
      const name = itemToDeleteObj?.nome || id;
      const tipo = itemToDeleteObj?.tipo || "custo";

      await deleteDoc(doc(db, "centros_custo", id));

      await logAction(
        `Exclusão de ${tipo === "lucro" ? "Centro de Lucro" : "Centro de Custo"}: ${name}`,
        "Financeiro",
        { costCenterId: id, name, tipo }
      );

      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir.");
    }
  };

  // Exportar para CSV
  const handleExportCsv = () => {
    if (filteredData.length === 0) {
      alert("Nenhum registro para exportar.");
      return;
    }

    const headers = ["ID", "Nome", "Tipo", "Categoria", "Centro Pai", "Status", "Descrição", "Criado Em"];
    const rows = filteredData.map((item) => [
      item.id,
      `"${item.nome.replace(/"/g, '""')}"`,
      item.tipo === "lucro" ? "Centro de Lucro" : "Centro de Custo",
      `"${(item.categoria || "").replace(/"/g, '""')}"`,
      `"${(item.centroPai || "").replace(/"/g, '""')}"`,
      item.status,
      `"${(item.descricao || "").replace(/"/g, '""')}"`,
      item.createdAt || "",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `centros_custo_lucro_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics
  const scopedData = useMemo(() => filterByFranqueada(data), [data, filterByFranqueada]);
  const totalGeral = scopedData.length;
  const totalCusto = scopedData.filter((d) => d.tipo === "custo").length;
  const totalLucro = scopedData.filter((d) => d.tipo === "lucro").length;
  const totalAtivos = scopedData.filter((d) => d.status === "Ativo").length;

  // Filtered List
  const filteredData = useMemo(() => {
    return scopedData.filter((item) => {
      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchNome = (item.nome || "").toLowerCase().includes(term);
        const matchCat = (item.categoria || "").toLowerCase().includes(term);
        const matchPai = (item.centroPai || "").toLowerCase().includes(term);
        const matchDesc = (item.descricao || "").toLowerCase().includes(term);
        if (!matchNome && !matchCat && !matchPai && !matchDesc) {
          return false;
        }
      }

      // Tipo Filter
      if (tipoFilter !== "todos" && item.tipo !== tipoFilter) {
        return false;
      }

      // Status Filter
      if (statusFilter !== "todos" && item.status !== statusFilter) {
        return false;
      }

      // Categoria Filter
      if (categoriaFilter !== "todas" && (item.categoria || "").toLowerCase() !== categoriaFilter.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [data, searchTerm, tipoFilter, statusFilter, categoriaFilter]);

  const getCategoriaBadge = (cat: string) => {
    const c = (cat || "").toLowerCase();
    switch (c) {
      case "fixo":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "pessoal":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "imobilizado":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "variavel":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "bancario":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "comercial":
        return "bg-teal-50 text-teal-700 border-teal-200";
      case "operacional":
        return "bg-cyan-50 text-cyan-700 border-cyan-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">
              Centro de Custo - Lucro
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-[#0071e3]">
              Financeiro
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gestão e categorização estratégica de saídas (Centros de Custo) e entradas (Centros de Lucro).
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3.5 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium shadow-xs"
            title="Recarregar dados"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-[#0071e3]" : ""} />
            Atualizar
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3.5 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium shadow-xs"
            title="Exportar registros filtrados para CSV"
          >
            <Download size={15} className="text-slate-500" />
            Exportar CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium shadow-xs"
            title="Imprimir relatório"
          >
            <Printer size={15} className="text-slate-500" />
            Imprimir
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-[#0B1A3A] text-white rounded-lg hover:bg-[#0B1A3A]/90 transition-colors text-sm font-semibold shadow-xs cursor-pointer"
          >
            <Plus size={16} />
            Novo Centro
          </button>
        </div>
      </div>

      {/* Migration Notice Banner */}
      {migrationNotice && (
        <div className="flex items-start gap-3 p-4 bg-blue-50/80 border border-blue-200 rounded-xl text-sm text-blue-900 shadow-2xs">
          <Sparkles className="w-5 h-5 text-[#0071e3] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-blue-950">Padronização Concluída com Sucesso</p>
            <p className="text-xs text-blue-800 mt-0.5">{migrationNotice}</p>
          </div>
          <button
            onClick={() => setMigrationNotice(null)}
            className="text-blue-500 hover:text-blue-800 p-1"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Cadastrado</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalGeral}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
            <Layers size={20} />
          </div>
        </div>

        <div
          onClick={() => setTipoFilter(tipoFilter === "custo" ? "todos" : "custo")}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-xs flex items-center justify-between ${
            tipoFilter === "custo"
              ? "bg-rose-50/80 border-rose-300 ring-2 ring-rose-400"
              : "bg-white border-slate-200/80 hover:border-rose-200"
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Centros de Custo</p>
            </div>
            <p className="text-2xl font-bold text-rose-700 mt-1">{totalCusto}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-100/80 flex items-center justify-center text-rose-700">
            <TrendingDown size={20} />
          </div>
        </div>

        <div
          onClick={() => setTipoFilter(tipoFilter === "lucro" ? "todos" : "lucro")}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-xs flex items-center justify-between ${
            tipoFilter === "lucro"
              ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400"
              : "bg-white border-slate-200/80 hover:border-emerald-200"
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Centros de Lucro</p>
            </div>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{totalLucro}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-100/80 flex items-center justify-center text-emerald-700">
            <TrendingUp size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Centros Ativos</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalAtivos}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-[#0071e3]">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por nome, centro pai ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0071e3]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Tabs / Type Filters */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200/60 self-start md:self-auto">
            <button
              onClick={() => setTipoFilter("todos")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                tipoFilter === "todos"
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Todos ({totalGeral})
            </button>
            <button
              onClick={() => setTipoFilter("custo")}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                tipoFilter === "custo"
                  ? "bg-rose-600 text-white shadow-2xs font-bold"
                  : "text-rose-700 hover:bg-rose-100/60"
              }`}
            >
              <TrendingDown size={13} />
              Custo ({totalCusto})
            </button>
            <button
              onClick={() => setTipoFilter("lucro")}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                tipoFilter === "lucro"
                  ? "bg-emerald-600 text-white shadow-2xs font-bold"
                  : "text-emerald-700 hover:bg-emerald-100/60"
              }`}
            >
              <TrendingUp size={13} />
              Lucro ({totalLucro})
            </button>
          </div>
        </div>

        {/* Secondary Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Filter size={13} className="text-slate-400" />
            <span className="font-semibold text-slate-700">Filtros avançados:</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-slate-500">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="todos">Todos os Status</option>
              <option value="Ativo">Apenas Ativos</option>
              <option value="Inativo">Apenas Inativos</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-slate-500">Categoria:</label>
            <select
              value={categoriaFilter}
              onChange={(e) => setCategoriaFilter(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="todas">Todas as Categorias</option>
              <option value="fixo">Fixo</option>
              <option value="variavel">Variável</option>
              <option value="pessoal">Pessoal</option>
              <option value="imobilizado">Imobilizado</option>
              <option value="bancario">Bancário</option>
              <option value="comercial">Comercial</option>
              <option value="operacional">Operacional</option>
              <option value="outros">Outros</option>
            </select>
          </div>

          {(searchTerm || tipoFilter !== "todos" || statusFilter !== "todos" || categoriaFilter !== "todas") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setTipoFilter("todos");
                setStatusFilter("todos");
                setCategoriaFilter("todas");
              }}
              className="ml-auto text-xs text-[#0071e3] hover:underline font-semibold"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Layers className="text-slate-500" size={16} />
            <span className="text-sm font-bold text-slate-800">
              Registros Encontrados ({filteredData.length})
            </span>
          </div>
          <span className="text-xs text-slate-500">
            Total na base: <strong className="text-slate-700">{data.length}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/90 text-slate-700 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Nome do Centro</th>
                <th className="px-5 py-3.5 text-center">Tipo de Centro</th>
                <th className="px-5 py-3.5 text-center">Categoria</th>
                <th className="px-5 py-3.5 text-left">Centro Pai</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, rIdx) => (
                  <tr key={rIdx} className="animate-pulse">
                    <td className="px-5 py-4">
                      <div className="h-4 bg-slate-100 rounded w-44" />
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="h-5 bg-slate-100 rounded-full w-28 mx-auto" />
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="h-5 bg-slate-100 rounded-full w-20 mx-auto" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-4 bg-slate-100 rounded w-28" />
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="h-5 bg-slate-100 rounded-full w-16 mx-auto" />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="h-4 bg-slate-100 rounded w-16 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-sm font-semibold text-slate-700">Nenhum registro encontrado</p>
                      <p className="text-xs text-slate-400">
                        Nenhum centro de custo ou lucro corresponde aos critérios de busca selecionados.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => {
                  const isLucro = item.tipo === "lucro";
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Nome */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isLucro
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {isLucro ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block">{item.nome}</span>
                            {item.descricao && (
                              <span className="text-[11px] text-slate-400 line-clamp-1">
                                {item.descricao}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Tipo: Custo ou Lucro */}
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        {isLucro ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                            <TrendingUp size={12} className="text-emerald-600" />
                            Centro de Lucro
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs">
                            <TrendingDown size={12} className="text-rose-600" />
                            Centro de Custo
                          </span>
                        )}
                      </td>

                      {/* Categoria */}
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-md border capitalize ${getCategoriaBadge(
                            item.categoria
                          )}`}
                        >
                          {item.categoria || "Fixo"}
                        </span>
                      </td>

                      {/* Centro Pai */}
                      <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                        {item.centroPai ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                            <Building2 size={13} className="text-slate-400" />
                            {item.centroPai}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">— Principal</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                            item.status === "Ativo"
                              ? "bg-emerald-100/80 text-emerald-800"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.status === "Ativo" ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          {item.status || "Ativo"}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-slate-400 hover:text-[#0B1A3A] hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar Centro"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => setItemToDelete(item.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir Centro"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => itemToDelete && handleDelete(itemToDelete)}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este centro? Lançamentos financeiros associados a ele manterão seu histórico."
      />

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col my-auto border border-slate-100 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#0B1A3A] text-white flex items-center justify-center">
                  <Layers size={16} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingId ? "Editar Centro" : "Novo Centro de Custo / Lucro"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Defina o tipo, classificação e dados do centro financeiro.
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <form id="centro-form" onSubmit={handleSubmit} className="space-y-4">
                {/* Tipo de Centro Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Tipo de Centro <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        formData.tipo === "custo"
                          ? "border-rose-500 bg-rose-50/50 shadow-xs"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                          <TrendingDown size={15} />
                          Centro de Custo
                        </span>
                        <input
                          type="radio"
                          name="tipo"
                          value="custo"
                          checked={formData.tipo === "custo"}
                          onChange={() => setFormData((p) => ({ ...p, tipo: "custo" }))}
                          className="text-rose-600 focus:ring-rose-500"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Despesas, compras operacionais e saídas de caixa.
                      </p>
                    </label>

                    <label
                      className={`flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        formData.tipo === "lucro"
                          ? "border-emerald-500 bg-emerald-50/50 shadow-xs"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                          <TrendingUp size={15} />
                          Centro de Lucro
                        </span>
                        <input
                          type="radio"
                          name="tipo"
                          value="lucro"
                          checked={formData.tipo === "lucro"}
                          onChange={() => setFormData((p) => ({ ...p, tipo: "lucro" }))}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Receitas, faturamentos, vendas e afiliações.
                      </p>
                    </label>
                  </div>
                </div>

                {/* Nome do Centro */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome do Centro <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nome"
                    required
                    placeholder="Ex: Comercial - Vendas Diretas ou Administrativo - RH"
                    value={formData.nome || ""}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3]"
                  />
                </div>

                {/* Categoria e Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Categoria <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="categoria"
                      required
                      value={formData.categoria || "fixo"}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3]"
                    >
                      <option value="fixo">Fixo</option>
                      <option value="variavel">Variável</option>
                      <option value="pessoal">Pessoal (RH/Salários)</option>
                      <option value="imobilizado">Imobilizado / Ativos</option>
                      <option value="bancario">Bancário / Tarifas</option>
                      <option value="comercial">Comercial / Vendas</option>
                      <option value="operacional">Operacional / Logística</option>
                      <option value="outros">Outros</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="status"
                      required
                      value={formData.status || "Ativo"}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3]"
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                    </select>
                  </div>
                </div>

                {/* Centro Pai */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Centro Pai (Grupo Superior)
                  </label>
                  <input
                    type="text"
                    name="centroPai"
                    placeholder="Deixe em branco caso seja um centro principal"
                    value={formData.centroPai || ""}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3]"
                  />
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Descrição / Finalidade (Opcional)
                  </label>
                  <textarea
                    name="descricao"
                    rows={2}
                    placeholder="Finalidade deste centro para lançamentos contábeis..."
                    value={formData.descricao || ""}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] resize-none"
                  />
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-xs hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="centro-form"
                disabled={isSaving}
                className="px-6 py-2 text-sm font-semibold text-white bg-[#0B1A3A] rounded-lg shadow-xs hover:bg-[#0B1A3A]/90 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? "Salvando..." : "Salvar Centro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
