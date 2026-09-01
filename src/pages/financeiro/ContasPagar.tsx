import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Pencil, 
  Trash2, 
  X, 
  Printer, 
  FileText, 
  RefreshCw, 
  Calendar,
  CheckSquare,
  Square,
  MinusSquare,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Layers,
  Sparkles,
  DollarSign
} from "lucide-react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, writeBatch } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";
import { useFranqueada } from "../../context/FranqueadaContext";
import { exportTableToPdf } from "../../lib/pdfExport";
import { formatDateBR } from "../../lib/dateUtils";

export default function ContasPagar() {
  const { filterByFranqueada, injectFranqueada, canModify, isFranqueada, userUnidade } = useFranqueada();
  const [data, setData] = useState<any[]>([]);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("Todos status");
  const [centroCustoFilter, setCentroCustoFilter] = useState("Todos centros");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchField, setSearchField] = useState("Descrição");
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  
  // Seleção múltipla / Ações em lote
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isCentroCustoDropdownOpen, setIsCentroCustoDropdownOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Filtros de Período por Data
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [tipoDataFiltro, setTipoDataFiltro] = useState("vencimento");
  const [activeDatePreset, setActiveDatePreset] = useState<string>("todos");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({ 
    status: "Aberto",
    parcelas: 1,
    recorrente: false
  });
  const [isSaving, setIsSaving] = useState(false);
  const [bancos, setBancos] = useState<any[]>([]);

  const fetchDependencies = async (db: any) => {
    try {
      const fSnap = await getDocs(collection(db, "fornecedores"));
      setFornecedores(fSnap.docs.map(d => ({ ...d.data(), id: d.id })));
      const bSnap = await getDocs(collection(db, "bancos"));
      setBancos(bSnap.docs.map(d => ({ ...d.data(), id: d.id })));
      
      try {
        const ccSnap = await getDocs(collection(db, "centros_custo"));
        setCentrosCusto(ccSnap.docs.map(d => ({ ...d.data(), id: d.id })));
      } catch (e) {
        console.warn("Aviso ao carregar centros_custo:", e);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { db } = await initFirebase();
      await fetchDependencies(db);
      const q = collection(db, "contas_pagar");
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      
      // Sort by vencimento descending as default if no DB sort
      items.sort((a: any, b: any) => {
        return new Date(b.vencimento || 0).getTime() - new Date(a.vencimento || 0).getTime();
      });
      
      setData(items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setFormData(injectFranqueada({ 
      status: "Aberto",
      parcelas: 1,
      recorrente: false
    }));
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    if (!canModify(item)) {
      alert("Acesso Restrito: Você só pode editar contas a pagar da sua própria franquia.");
      return;
    }
    setFormData({ ...item, fornecedorId: item.fornecedorId || item.fornecedor || "" });
    setEditingId(item.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({});
    setEditingId(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { db } = await initFirebase();
      const { id: _, ...cleanFormData } = formData;
      const rawPayload: any = {
        ...cleanFormData,
        updatedAt: new Date().toISOString()
      };
      const savePayload: any = injectFranqueada(rawPayload);
      
      const { getDoc, runTransaction } = await import("firebase/firestore");

      let oldStatus = "Aberto";
      if (editingId) {
        const oldDoc = data.find(d => d.id === editingId);
        if (oldDoc) {
          if (!canModify(oldDoc)) {
            alert("Acesso Restrito: Permissão negada para alterar contas a pagar de outra franquia.");
            setIsSaving(false);
            return;
          }
          oldStatus = oldDoc.status || "Aberto";
        }
        await updateDoc(doc(db, "contas_pagar", editingId), savePayload);
      } else {
        savePayload.createdAt = new Date().toISOString();
        const docRef = await addDoc(collection(db, "contas_pagar"), savePayload);
        savePayload.id = docRef.id;
      }

      // Se mudou para Pago e tem banco selecionado, realiza a liquidação
      if (oldStatus !== "Pago" && savePayload.status === "Pago" && savePayload.contaBancaria) {
        const valorLiquidar = Number(savePayload.valor) || 0;
        const bancoId = savePayload.contaBancaria;
        
        await runTransaction(db, async (transaction) => {
          const bancoRef = doc(db, "bancos", bancoId);
          const bancoSnap = await transaction.get(bancoRef);
          
          if (bancoSnap.exists()) {
            const bancoData = bancoSnap.data();
            const novoSaldo = Number(bancoData.saldoAtual || 0) - valorLiquidar;
            
            // Atualiza saldo
            transaction.update(bancoRef, { 
              saldoAtual: novoSaldo,
              updatedAt: new Date().toISOString()
            });
            
            // Registra a movimentação no banco
            const movRef = doc(collection(db, `bancos/${bancoId}/movimentacoes`));
            transaction.set(movRef, {
              data: savePayload.pagoEm || new Date().toISOString().split("T")[0],
              tipo: "Despesa",
              valor: valorLiquidar,
              descricao: `Pagamento: ${savePayload.descricao || "Conta a Pagar"}`,
              createdAt: new Date().toISOString()
            });
          }
        });
        
        await logAction(
          `Liquidação de pagamento: ${savePayload.descricao}`,
          "Financeiro",
          { accountId: editingId || savePayload.id, valor: savePayload.valor }
        );
      }

      closeModal();
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar a conta a pagar.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { db } = await initFirebase();
      const itemToDelete = data.find(item => item.id === id);
      if (itemToDelete && !canModify(itemToDelete)) {
        alert("Acesso Restrito: Você só pode excluir contas a pagar da sua própria franquia.");
        return;
      }
      const description = itemToDelete ? `${itemToDelete.descricao || "Conta"} (R$ ${itemToDelete.valor || 0})` : id;

      await deleteDoc(doc(db, "contas_pagar", id));

      // LOG ACTION
      await logAction(
        `Exclusão de conta a pagar: ${description}`,
        "Financeiro",
        { accountId: id, description }
      );

      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir.");
    }
  };

  const applyDatePreset = (preset: "hoje" | "este_mes" | "mes_passado" | "prox_30" | "ano_atual" | "todos") => {
    setActiveDatePreset(preset);
    const now = new Date();
    if (preset === "hoje") {
      const today = now.toISOString().slice(0, 10);
      setDataInicio(today);
      setDataFim(today);
    } else if (preset === "este_mes") {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      setDataInicio(`${year}-${month}-01`);
      setDataFim(`${year}-${month}-${String(lastDay).padStart(2, "0")}`);
    } else if (preset === "mes_passado") {
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const year = prevMonthDate.getFullYear();
      const month = String(prevMonthDate.getMonth() + 1).padStart(2, "0");
      const lastDay = new Date(year, prevMonthDate.getMonth() + 1, 0).getDate();
      setDataInicio(`${year}-${month}-01`);
      setDataFim(`${year}-${month}-${String(lastDay).padStart(2, "0")}`);
    } else if (preset === "prox_30") {
      const today = now.toISOString().slice(0, 10);
      const next30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setDataInicio(today);
      setDataFim(next30);
    } else if (preset === "ano_atual") {
      const year = now.getFullYear();
      setDataInicio(`${year}-01-01`);
      setDataFim(`${year}-12-31`);
    } else {
      setDataInicio("");
      setDataFim("");
    }
  };

  const handleClearDates = () => {
    setDataInicio("");
    setDataFim("");
    setActiveDatePreset("todos");
  };

  const filteredData = filterByFranqueada(data).filter(item => {
    // Filtro de Data (Início e Fim)
    if (dataInicio || dataFim) {
      const targetDate = tipoDataFiltro === "pagamento" 
        ? (item.pagoEm || item.dataPagamento || item.vencimento || "") 
        : tipoDataFiltro === "criacao" 
        ? (item.createdAt ? item.createdAt.slice(0, 10) : "") 
        : (item.vencimento || "");

      if (dataInicio && targetDate && targetDate < dataInicio) {
        return false;
      }
      if (dataFim && targetDate && targetDate > dataFim) {
        return false;
      }
      if ((dataInicio || dataFim) && !targetDate) {
        return false;
      }
    }

    if (statusFilter === "Aberto (A Pagar)") {
      if (item.status === "Pago" || item.status === "Cancelado") return false;
    } else if (statusFilter !== "Todos status" && item.status !== statusFilter) {
      return false;
    }

    if (centroCustoFilter !== "Todos centros") {
      if (item.centroCusto !== centroCustoFilter) return false;
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      switch (searchField) {
        case "Data":
          return item.vencimento && item.vencimento.includes(term);
        case "Descrição":
          return item.descricao && item.descricao.toLowerCase().includes(term);
        case "Valor":
          return item.valor && item.valor.toString().includes(term);
        case "Centro de Custo":
          return item.centroCusto && item.centroCusto.toLowerCase().includes(term);
        case "Observações":
          return item.observacoes && item.observacoes.toLowerCase().includes(term);
        case "Fornecedor": {
          const fornecedor = fornecedores.find(f => f.id === item.fornecedorId);
          return fornecedor?.razaoSocial?.toLowerCase().includes(term) || fornecedor?.nome?.toLowerCase().includes(term) || (item.fornecedorId && item.fornecedorId.toLowerCase().includes(term));
        }
        default:
          return true;
      }
    }
    
    return true;
  });

  // Helpers de Seleção Múltipla
  const filteredIds = useMemo(() => filteredData.map(i => i.id), [filteredData]);
  
  const selectedFilteredCount = useMemo(() => {
    return filteredIds.filter(id => selectedIds.includes(id)).length;
  }, [filteredIds, selectedIds]);

  const isAllFilteredSelected = filteredIds.length > 0 && selectedFilteredCount === filteredIds.length;
  const isSomeFilteredSelected = selectedFilteredCount > 0 && selectedFilteredCount < filteredIds.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isSomeFilteredSelected;
    }
  }, [isSomeFilteredSelected]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleExportPdf = () => {
    exportTableToPdf(
      filteredData,
      "Contas a Pagar",
      [
        { key: "descricao", label: "Descrição" },
        { key: "fornecedorNome", label: "Fornecedor" },
        { key: "centroCusto", label: "Centro de Custo" },
        { key: "vencimento", label: "Vencimento", format: "date" },
        { key: "valor", label: "Valor", format: "currency" },
        { key: "status", label: "Status" }
      ]
    );
  };

  const handleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      // Desmarca todos os itens filtrados atualmente
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Marca todos os itens filtrados atualmente
      setSelectedIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const selectedTotalSum = useMemo(() => {
    return data
      .filter(item => selectedIds.includes(item.id))
      .reduce((acc, curr) => acc + (parseFloat(curr.valor) || 0), 0);
  }, [data, selectedIds]);

  // Ação em Lote: Alterar Status
  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedIds.length === 0) return;
    setIsBulkProcessing(true);
    setIsStatusDropdownOpen(false);
    try {
      const { db } = await initFirebase();
      const today = new Date().toISOString().slice(0, 10);
      
      const BATCH_SIZE = 400;
      for (let i = 0; i < selectedIds.length; i += BATCH_SIZE) {
        const chunk = selectedIds.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(id => {
          const itemRef = doc(db, "contas_pagar", id);
          const updateData: any = { status: newStatus, updatedAt: new Date().toISOString() };
          if (newStatus === "Pago") {
            updateData.pagoEm = today;
            updateData.dataPagamento = today;
          } else if (newStatus === "Aberto" || newStatus === "Atrasado") {
            updateData.pagoEm = "";
            updateData.dataPagamento = "";
            updateData.valorPago = 0;
          }
          batch.update(itemRef, updateData);
        });
        
        await batch.commit();
      }

      await logAction(
        `Atualização de status em lote para '${newStatus}' em ${selectedIds.length} conta(s) a pagar`,
        "Financeiro",
        { count: selectedIds.length, status: newStatus, ids: selectedIds }
      );

      setSelectedIds([]);
      await fetchData();
    } catch (err) {
      console.error("Erro ao alterar status em lote:", err);
      alert("Erro ao alterar o status dos registros selecionados.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Ação em Lote: Alterar Centro de Custo
  const handleBulkCentroCustoChange = async (novoCentroCusto: string) => {
    if (selectedIds.length === 0) return;
    setIsBulkProcessing(true);
    setIsCentroCustoDropdownOpen(false);
    try {
      const { db } = await initFirebase();
      const BATCH_SIZE = 400;
      for (let i = 0; i < selectedIds.length; i += BATCH_SIZE) {
        const chunk = selectedIds.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(id => {
          const itemRef = doc(db, "contas_pagar", id);
          batch.update(itemRef, { 
            centroCusto: novoCentroCusto,
            updatedAt: new Date().toISOString()
          });
        });
        
        await batch.commit();
      }

      await logAction(
        `Alteração de Centro de Custo em lote para '${novoCentroCusto}' em ${selectedIds.length} conta(s) a pagar`,
        "Financeiro",
        { count: selectedIds.length, centroCusto: novoCentroCusto }
      );

      setSelectedIds([]);
      await fetchData();
    } catch (err) {
      console.error("Erro ao alterar centro de custo em lote:", err);
      alert("Erro ao alterar o centro de custo dos registros selecionados.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Ação em Lote: Excluir
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      const { db } = await initFirebase();
      const BATCH_SIZE = 400;
      for (let i = 0; i < selectedIds.length; i += BATCH_SIZE) {
        const chunk = selectedIds.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(id => {
          batch.delete(doc(db, "contas_pagar", id));
        });
        
        await batch.commit();
      }

      await logAction(
        `Exclusão em lote de ${selectedIds.length} conta(s) a pagar`,
        "Financeiro",
        { count: selectedIds.length, ids: selectedIds }
      );

      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error("Erro ao excluir em lote:", err);
      alert("Erro ao excluir os registros selecionados.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const formatDate = (dateString?: any) => {
    return formatDateBR(dateString, "-");
  };

  const formatCurrency = (value: string | number) => {
    if (!value) return "R$ 0,00";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  // Base para cálculo dos totais (respeitando o filtro de data se selecionado)
  const baseDataTotals = (dataInicio || dataFim) ? data.filter(item => {
    const targetDate = tipoDataFiltro === "pagamento" 
      ? (item.pagoEm || item.dataPagamento || item.vencimento || "") 
      : tipoDataFiltro === "criacao" 
      ? (item.createdAt ? item.createdAt.slice(0, 10) : "") 
      : (item.vencimento || "");

    if (dataInicio && targetDate && targetDate < dataInicio) return false;
    if (dataFim && targetDate && targetDate > dataFim) return false;
    if ((dataInicio || dataFim) && !targetDate) return false;
    return true;
  }) : data;

  const totalAberto = baseDataTotals.filter(i => i.status !== "Pago" && i.status !== "Cancelado").reduce((acc, curr) => acc + (parseFloat(curr.valor) || 0), 0);
  const totalPago = baseDataTotals.filter(i => i.status === "Pago").reduce((acc, curr) => acc + (parseFloat(curr.valorPago || curr.valor) || 0), 0);
  const totalCancelado = baseDataTotals.filter(i => i.status === "Cancelado").reduce((acc, curr) => acc + (parseFloat(curr.valor) || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contas a Pagar</h1>
          <p className="text-sm text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Em aberto: <strong className="text-red-500 font-semibold">{formatCurrency(totalAberto)}</strong></span>
            <span>·</span>
            <span>Pago: <strong className="text-emerald-500 font-semibold">{formatCurrency(totalPago)}</strong></span>
            {totalCancelado > 0 && (
              <>
                <span>·</span>
                <span>Cancelado: <strong className="text-slate-400 font-medium">{formatCurrency(totalCancelado)}</strong></span>
              </>
            )}
            {(dataInicio || dataFim) && (
              <span className="inline-flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-medium ml-1">
                (Totais do período filtrado)
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-dark/90 transition-colors text-sm font-medium shadow-sm cursor-pointer"
          >
            <Plus size={16} />
            Nova conta
          </button>
        </div>
      </div>

      {/* Barra de Filtro de Período (Data Início / Data Fim) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Calendar size={16} />
            </div>
            <span>Filtrar Período:</span>
          </div>

          {/* Seleção do Tipo de Data */}
          <select
            value={tipoDataFiltro}
            onChange={(e) => setTipoDataFiltro(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
            title="Critério de data para o filtro"
          >
            <option value="vencimento">Data de Vencimento</option>
            <option value="pagamento">Data de Pagamento</option>
            <option value="criacao">Data de Lançamento</option>
          </select>

          {/* Inputs de Data Início e Fim */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus-within:ring-2 focus-within:ring-brand-dark/50">
              <span className="text-slate-500 font-semibold">De:</span>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  setActiveDatePreset("custom");
                }}
                className="bg-transparent text-slate-700 text-xs focus:outline-none font-medium"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus-within:ring-2 focus-within:ring-brand-dark/50">
              <span className="text-slate-500 font-semibold">Até:</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value);
                  setActiveDatePreset("custom");
                }}
                className="bg-transparent text-slate-700 text-xs focus:outline-none font-medium"
              />
            </div>

            {(dataInicio || dataFim) && (
              <button
                type="button"
                onClick={handleClearDates}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-slate-200"
                title="Limpar período"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Botões Rápidos de Presets de Período */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 font-medium mr-1 hidden sm:inline">Períodos:</span>
          
          <button
            type="button"
            onClick={() => applyDatePreset("este_mes")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              activeDatePreset === "este_mes"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            Este Mês
          </button>

          <button
            type="button"
            onClick={() => applyDatePreset("mes_passado")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              activeDatePreset === "mes_passado"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            Mês Anterior
          </button>

          <button
            type="button"
            onClick={() => applyDatePreset("prox_30")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              activeDatePreset === "prox_30"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            Próximos 30 Dias
          </button>

          <button
            type="button"
            onClick={() => applyDatePreset("ano_atual")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              activeDatePreset === "ano_atual"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            Ano Atual
          </button>

          <button
            type="button"
            onClick={() => applyDatePreset("todos")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              activeDatePreset === "todos" && !dataInicio && !dataFim
                ? "bg-slate-800 text-white border-slate-800 shadow-xs"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            Todos
          </button>
        </div>
      </div>

      {/* Menu / Barra de Ações em Lote quando houver itens selecionados */}
      {selectedIds.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-4 rounded-xl shadow-lg border border-indigo-700/50 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-white/20">
              <CheckSquare size={18} className="text-emerald-400" />
              <span className="font-bold text-sm">
                {selectedIds.length} {selectedIds.length === 1 ? "registro selecionado" : "registros selecionados"}
              </span>
            </div>

            <div className="text-xs text-indigo-200 font-medium">
              Valor Total: <strong className="text-white text-sm font-bold">{formatCurrency(selectedTotalSum)}</strong>
            </div>

            {selectedFilteredCount < filteredIds.length && (
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-xs text-indigo-300 hover:text-white underline cursor-pointer transition-colors"
              >
                Selecionar todos os {filteredIds.length} filtrados
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {/* Dropdown de Alteração de Status em Lote */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsStatusDropdownOpen(!isStatusDropdownOpen);
                  setIsCentroCustoDropdownOpen(false);
                }}
                disabled={isBulkProcessing}
                className="flex items-center gap-2 px-3 py-2 bg-white/15 hover:bg-white/25 border border-white/30 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                <span>Alterar Status</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isStatusDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isStatusDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Definir Status
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => handleBulkStatusChange("Pago")}
                    className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 flex items-center gap-2 cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Marcar como <strong>Pago</strong></span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBulkStatusChange("Aberto")}
                    className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-blue-50 text-slate-700 hover:text-blue-700 flex items-center gap-2 cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>Marcar como <strong>Aberto</strong></span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBulkStatusChange("Atrasado")}
                    className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-orange-50 text-slate-700 hover:text-orange-700 flex items-center gap-2 cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    <span>Marcar como <strong>Atrasado</strong></span>
                  </button>

                  <div className="border-t border-slate-100 my-1"></div>

                  <button
                    type="button"
                    onClick={() => handleBulkStatusChange("Cancelado")}
                    className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-100 text-slate-700 hover:text-slate-900 flex items-center gap-2 cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span>Marcar como <strong>Cancelado</strong></span>
                  </button>
                </div>
              )}
            </div>

            {/* Dropdown de Centro de Custo em Lote */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsCentroCustoDropdownOpen(!isCentroCustoDropdownOpen);
                  setIsStatusDropdownOpen(false);
                }}
                disabled={isBulkProcessing}
                className="flex items-center gap-2 px-3 py-2 bg-white/15 hover:bg-white/25 border border-white/30 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                <Layers size={14} className="text-amber-300" />
                <span>Centro de Custo</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isCentroCustoDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isCentroCustoDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-150 max-h-60 overflow-y-auto">
                  <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Atribuir Centro de Custo
                  </div>

                  <button
                    type="button"
                    onClick={() => handleBulkCentroCustoChange("Administrativo")}
                    className="w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-slate-100 text-slate-700 flex items-center gap-2 cursor-pointer"
                  >
                    <span>Administrativo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBulkCentroCustoChange("Operacional")}
                    className="w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-slate-100 text-slate-700 flex items-center gap-2 cursor-pointer"
                  >
                    <span>Operacional</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBulkCentroCustoChange("Comercial")}
                    className="w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-slate-100 text-slate-700 flex items-center gap-2 cursor-pointer"
                  >
                    <span>Comercial</span>
                  </button>

                  {centrosCusto.map((cc) => (
                    <button
                      key={cc.id}
                      type="button"
                      onClick={() => handleBulkCentroCustoChange(cc.nome)}
                      className="w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-slate-100 text-slate-700 flex items-center gap-2 cursor-pointer"
                    >
                      <span>{cc.nome}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Botão de Excluir em Lote */}
            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              disabled={isBulkProcessing}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-sm disabled:opacity-50"
              title="Excluir selecionados"
            >
              <Trash2 size={14} />
              <span>Excluir</span>
            </button>

            {/* Botão Limpar Seleção */}
            <button
              type="button"
              onClick={handleClearSelection}
              disabled={isBulkProcessing}
              className="p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Limpar seleção"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Indicador de Processamento em Lote */}
      {isBulkProcessing && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-xl flex items-center gap-3 text-xs font-semibold animate-pulse">
          <RefreshCw size={15} className="animate-spin text-amber-600" />
          <span>Processando alterações em lote na base de contas a pagar... Por favor, aguarde.</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex flex-col xl:flex-row gap-4 justify-between items-center bg-slate-50/50 rounded-t-xl">
          <div className="text-sm font-medium text-slate-600 whitespace-nowrap">
            {filteredData.length} lançamento(s)
          </div>
          
          <div className="flex flex-col sm:flex-row w-full xl:w-auto items-center gap-3">
            <div className="flex w-full sm:w-auto items-center gap-2">
              <select
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
                className="w-32 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark focus:border-transparent"
              >
                <option value="Data">Data</option>
                <option value="Descrição">Descrição</option>
                <option value="Valor">Valor</option>
                <option value="Centro de Custo">Centro de Custo</option>
                <option value="Observações">Observações</option>
                <option value="Fornecedor">Fornecedor</option>
              </select>
              <div className="relative flex-1 sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={`Buscar por ${searchField.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex w-full sm:w-auto items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-40 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark focus:border-transparent"
              >
                <option value="Todos status">Todos status</option>
                <option value="Aberto">Aberto</option>
                <option value="Pago">Pago</option>
                <option value="Atrasado">Atrasado</option>
                <option value="Cancelado">Cancelado</option>
              </select>
              
              <button
                onClick={handleExportPdf}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors text-sm font-medium cursor-pointer"
                title="Exportar para PDF"
              >
                <FileText size={16} />
              </button>
              
              <button
                onClick={() => window.print()}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors text-sm font-medium cursor-pointer"
                title="Imprimir resultados"
              >
                <Printer size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs uppercase bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="w-12 px-4 py-4 text-center">
                  <input
                    type="checkbox"
                    ref={selectAllRef}
                    checked={isAllFilteredSelected}
                    onChange={handleSelectAllFiltered}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    title={isAllFilteredSelected ? "Desmarcar todos" : "Selecionar todos os registros filtrados"}
                  />
                </th>
                <th className="px-6 py-4 whitespace-nowrap">Vencimento</th>
                <th className="px-6 py-4 whitespace-nowrap">Fornecedor</th>
                <th className="px-6 py-4 whitespace-nowrap">Descrição</th>
                <th className="px-6 py-4 whitespace-nowrap">Valor</th>
                <th className="px-6 py-4 whitespace-nowrap">Parc.</th>
                <th className="px-6 py-4 whitespace-nowrap">Pago em</th>
                <th className="px-6 py-4 whitespace-nowrap">Observações</th>
                <th className="px-6 py-4 whitespace-nowrap">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, rIdx) => (
                  <tr key={rIdx} className="animate-pulse">
                    <td className="w-12 px-4 py-4 text-center">
                      <div className="w-4 h-4 bg-slate-100 rounded mx-auto" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-20" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-48" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-32" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-16" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-100 rounded w-8 mx-auto" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-20" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-20" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-16" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-100 rounded w-12 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-slate-500">
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => {
                  const isItemSelected = selectedIds.includes(item.id);
                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50 transition-colors ${
                        isItemSelected ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600' : ''
                      }`}
                    >
                      <td className="w-12 px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isItemSelected}
                          onChange={() => handleToggleSelect(item.id)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">{formatDate(item.vencimento)}</td>
                      <td className="px-6 py-4 font-medium">
                        {fornecedores.find(f => f.id === item.fornecedorId)?.razaoSocial || fornecedores.find(f => f.id === item.fornecedorId)?.nome || item.fornecedorId || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">{item.descricao}</div>
                        {item.centroCusto && (
                          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 mt-0.5">
                            <span>{item.centroCusto}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium">{formatCurrency(item.valor)}</td>
                      <td className="px-6 py-4">{item.parcelas || 1}</td>
                      <td className="px-6 py-4">{formatDate(item.pagoEm)}</td>
                      <td className="px-6 py-4 max-w-xs truncate text-xs text-slate-500" title={item.observacoes || ""}>
                        {item.observacoes || "-"}
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          let displayStatus = item.status || 'Pendente';
                          let badgeColor = 'bg-blue-100 text-blue-700';
                          
                          if (item.status === 'Pago') {
                            displayStatus = 'Pago';
                            badgeColor = 'bg-emerald-100 text-emerald-700';
                          } else if (item.status === 'Cancelado') {
                            displayStatus = 'Cancelado';
                            badgeColor = 'bg-slate-100 text-slate-700';
                          } else {
                            const today = new Date().toISOString().slice(0, 10);
                            if (item.vencimento && item.vencimento < today) {
                              displayStatus = 'Atrasado';
                              badgeColor = 'bg-red-100 text-red-700';
                            } else {
                              displayStatus = 'Pendente';
                              badgeColor = 'bg-amber-100 text-amber-700';
                            }
                          }

                          return (
                            <span className={`px-2.5 py-1 text-[11px] font-bold tracking-wide rounded-full border ${badgeColor.replace('bg-', 'border-').replace('100', '200')} ${badgeColor} shadow-sm`}>
                              {displayStatus}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => window.print()}
                            className="text-slate-400 hover:text-blue-900 transition-colors cursor-pointer"
                            title="Imprimir"
                          >
                            <Printer size={18} />
                          </button>
                          <button
                            onClick={() => {
                              exportTableToPdf(
                                [item],
                                `Conta a Pagar - ${item.descricao || "Detalhe"}`,
                                [
                                  { key: "descricao", label: "Descrição" },
                                  { key: "fornecedorNome", label: "Fornecedor" },
                                  { key: "centroCusto", label: "Centro de Custo" },
                                  { key: "vencimento", label: "Vencimento", format: "date" },
                                  { key: "valor", label: "Valor", format: "currency" },
                                  { key: "status", label: "Status" }
                                ]
                              );
                            }}
                            className="text-slate-400 hover:text-orange-500 transition-colors cursor-pointer"
                            title="Baixar PDF"
                          >
                            <Download size={18} />
                          </button>
                          <button
                            onClick={() => openEditModal(item)}
                            className="text-slate-400 hover:text-amber-800 transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={() => setItemToDelete(item.id)}
                            className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
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

      {/* Modal de Exclusão Individual */}
      <ConfirmDeleteModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => itemToDelete && handleDelete(itemToDelete)}
      />

      {/* Modal de Confirmação de Exclusão em Lote */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-rose-50/50">
              <div className="flex items-center gap-2 text-rose-600 font-bold">
                <AlertTriangle size={20} />
                <span>Excluir Contas a Pagar em Lote</span>
              </div>
              <button
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-3">
              <p className="text-slate-800 text-sm">
                Tem certeza de que deseja excluir permanentemente <strong>{selectedIds.length}</strong> conta(s) a pagar selecionada(s)?
              </p>
              
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Quantidade:</span>
                  <strong className="text-slate-900">{selectedIds.length} lançamento(s)</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Montante Total:</span>
                  <strong className="text-rose-600 font-bold">{formatCurrency(selectedTotalSum)}</strong>
                </div>
              </div>

              <p className="text-xs text-rose-600 font-medium">
                ⚠️ Esta ação não poderá ser desfeita e os registros serão apagados do banco de dados.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                disabled={isBulkProcessing}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isBulkProcessing}
                className="px-5 py-2 text-sm font-bold text-white bg-rose-600 rounded-lg shadow-sm hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isBulkProcessing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Sim, excluir {selectedIds.length} registro(s)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? "Editar conta" : "Nova conta a pagar"}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <form id="conta-form" onSubmit={handleSubmit} className="space-y-5">
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Descrição <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="descricao"
                    required
                    value={formData.descricao || ""}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Valor <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="valor"
                      required
                      step="0.01"
                      min="0"
                      value={formData.valor || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Vencimento <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="vencimento"
                      required
                      value={formData.vencimento || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Parcelas
                    </label>
                    <input
                      type="number"
                      name="parcelas"
                      min="1"
                      value={formData.parcelas || 1}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Fornecedor
                    </label>
                    <select
                      name="fornecedorId"
                      value={formData.fornecedorId || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                    >
                      <option value="">— Nenhum —</option>
                      {formData.fornecedorId && !fornecedores.find(f => f.id === formData.fornecedorId) && (
                        <option value={formData.fornecedorId}>{formData.fornecedorId}</option>
                      )}
                      {fornecedores.map(f => (
                        <option key={f.id} value={f.id}>{f.razaoSocial || f.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status || "Aberto"}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                    >
                      <option value="Aberto">Aberto</option>
                      <option value="Pago">Pago</option>
                      <option value="Atrasado">Atrasado</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Conta bancária
                    </label>
                    <select
                      name="contaBancaria"
                      value={formData.contaBancaria || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                    >
                      <option value="">— Nenhuma —</option>
                      {formData.contaBancaria && !bancos.find(b => b.id === formData.contaBancaria) && (
                        <option value={formData.contaBancaria}>{formData.contaBancaria}</option>
                      )}
                      {bancos.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.banco} - {b.agencia}/{b.conta}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Centro de custo
                    </label>
                    <select
                      name="centroCusto"
                      value={formData.centroCusto || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                    >
                      <option value="">— Nenhum —</option>
                      <option value="Administrativo">Administrativo</option>
                      <option value="Operacional">Operacional</option>
                      <option value="Comercial">Comercial</option>
                      {centrosCusto.map(cc => (
                        <option key={cc.id} value={cc.nome}>{cc.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Pago em
                    </label>
                    <input
                      type="date"
                      name="pagoEm"
                      value={formData.pagoEm || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Valor pago
                    </label>
                    <input
                      type="number"
                      name="valorPago"
                      step="0.01"
                      min="0"
                      value={formData.valorPago || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    URL da NF
                  </label>
                  <input
                    type="url"
                    name="urlNf"
                    placeholder="https://..."
                    value={formData.urlNf || ""}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                  />
                </div>

                <div className="pt-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Observações
                  </label>
                  <textarea
                    name="observacoes"
                    rows={3}
                    placeholder="Informações adicionais, Chave Pix, etc."
                    value={formData.observacoes || ""}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                  />
                </div>

              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="conta-form"
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-dark rounded-lg shadow-sm hover:bg-brand-dark/90 transition-colors disabled:opacity-50"
              >
                {isSaving ? "Salvando..." : editingId ? "Atualizar" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
