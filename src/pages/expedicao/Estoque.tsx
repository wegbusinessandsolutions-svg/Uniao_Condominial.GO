import React, { useState, useEffect } from "react";
import {
  Boxes,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  Trash2,
  Pencil,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Package,
  Layers,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  TrendingDown,
  X
} from "lucide-react";
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
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";
import { useAuth } from "../../context/AuthContext";

interface ProdutoEstoque {
  id: string;
  nome: string;
  sku?: string;
  categoria?: string;
  categorias?: string[];
  precoVenda?: string | number;
  custoUltimo?: string | number;
  qtdAtual?: string | number;
  estoqueMinimo?: string | number;
  unidade?: string;
  localizacao?: string;
  imagemPrincipal?: string;
}

interface MovimentacaoEstoque {
  id?: string;
  produtoId?: string;
  produto: string;
  tipo: "Entrada" | "Saída";
  quantidade: number;
  motivo?: string;
  responsavel?: string;
  createdAt?: string;
}

export default function EstoqueControle() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"produtos" | "movimentacoes">("produtos");
  
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filtros
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"todos" | "baixo" | "zerado" | "normal">("todos");
  const [filterTipoMov, setFilterTipoMov] = useState<string>("Todos");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // Modal Movimentação
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProdutoId, setSelectedProdutoId] = useState<string>("");
  const [movTipo, setMovTipo] = useState<"Entrada" | "Saída">("Entrada");
  const [movQtd, setMovQtd] = useState<number>(1);
  const [movMotivo, setMovMotivo] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { db } = await initFirebase();
      
      // Buscar Produtos
      const prodSnap = await getDocs(collection(db, "produtos"));
      const prodList: ProdutoEstoque[] = [];
      prodSnap.forEach((docSnap) => {
        prodList.push({ id: docSnap.id, ...docSnap.data() } as ProdutoEstoque);
      });
      setProdutos(prodList);

      // Buscar Movimentações
      const movSnap = await getDocs(collection(db, "estoque_movimentacoes"));
      const movList: MovimentacaoEstoque[] = [];
      movSnap.forEach((docSnap) => {
        movList.push({ id: docSnap.id, ...docSnap.data() } as MovimentacaoEstoque);
      });
      // Ordenar mais recentes primeiro
      movList.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      setMovimentacoes(movList);
    } catch (error) {
      console.error("Erro ao carregar dados do estoque:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Métricas
  const totalItensDistintos = produtos.length;
  const totalUnidades = produtos.reduce((acc, p) => acc + (Number(p.qtdAtual) || 0), 0);
  
  // Regra de negócio: Alerta visual quando quantidade disponível for inferior a 5 unidades
  const produtosBaixoEstoque = produtos.filter((p) => {
    const qtd = Number(p.qtdAtual) || 0;
    return qtd < 5;
  });

  const produtosEstoqueZerado = produtos.filter((p) => {
    const qtd = Number(p.qtdAtual) || 0;
    return qtd <= 0;
  });

  // Filtragem dos Produtos
  const filteredProdutos = produtos.filter((item) => {
    const qtd = Number(item.qtdAtual) || 0;
    
    // Filtro por texto
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      item.nome?.toLowerCase().includes(searchLower) ||
      item.sku?.toLowerCase().includes(searchLower) ||
      item.categoria?.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    // Filtro por status
    if (filterStatus === "baixo") return qtd > 0 && qtd < 5;
    if (filterStatus === "zerado") return qtd <= 0;
    if (filterStatus === "normal") return qtd >= 5;

    return true;
  });

  // Filtragem das Movimentações
  const filteredMovimentacoes = movimentacoes.filter((item) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      item.produto?.toLowerCase().includes(searchLower) ||
      item.motivo?.toLowerCase().includes(searchLower) ||
      item.responsavel?.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    if (filterTipoMov !== "Todos" && item.tipo !== filterTipoMov) return false;

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
    }

    return true;
  });

  const handleOpenMovimentacaoModal = (produto?: ProdutoEstoque) => {
    if (produto) {
      setSelectedProdutoId(produto.id);
    } else if (produtos.length > 0) {
      setSelectedProdutoId(produtos[0].id);
    }
    setMovTipo("Entrada");
    setMovQtd(1);
    setMovMotivo("");
    setIsModalOpen(true);
  };

  const handleSalvarMovimentacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProdutoId || movQtd <= 0 || isSaving) return;

    setIsSaving(true);
    try {
      const { db } = await initFirebase();
      const targetProd = produtos.find((p) => p.id === selectedProdutoId);
      if (!targetProd) {
        alert("Produto não encontrado.");
        return;
      }

      const qtdAtual = Number(targetProd.qtdAtual) || 0;
      let novaQtd = qtdAtual;

      if (movTipo === "Entrada") {
        novaQtd = qtdAtual + Number(movQtd);
      } else {
        if (qtdAtual < Number(movQtd)) {
          const confirmar = confirm(`Atenção: A quantidade atual (${qtdAtual}) é menor que a saída (${movQtd}). Deseja continuar e deixar o estoque negativo?`);
          if (!confirmar) {
            setIsSaving(false);
            return;
          }
        }
        novaQtd = Math.max(0, qtdAtual - Number(movQtd));
      }

      // 1. Atualizar produto no Firestore
      await updateDoc(doc(db, "produtos", selectedProdutoId), {
        qtdAtual: String(novaQtd),
      });

      // 2. Registrar movimentação no histórico
      const novaMov: MovimentacaoEstoque = {
        produtoId: selectedProdutoId,
        produto: targetProd.nome,
        tipo: movTipo,
        quantidade: Number(movQtd),
        motivo: movMotivo || (movTipo === "Entrada" ? "Reposição de Estoque" : "Saída Operacional / Venda"),
        responsavel: profile?.nome || profile?.displayName || "Administrador",
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "estoque_movimentacoes"), novaMov);

      // 3. Registrar Log de Auditoria
      await logAction(
        `Movimentação de Estoque: ${movTipo} de ${movQtd} un. em "${targetProd.nome}"`,
        "Estoque",
        { produtoId: selectedProdutoId, produto: targetProd.nome, tipo: movTipo, quantidade: movQtd, saldoAnterior: qtdAtual, novoSaldo: novaQtd },
        { qtdAtual },
        { qtdAtual: novaQtd }
      );

      setIsModalOpen(false);
      await fetchData();
    } catch (error) {
      console.error("Erro ao salvar movimentação:", error);
      alert("Erro ao registrar movimentação.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMovimentacao = async (id: string) => {
    try {
      const { db } = await initFirebase();
      await deleteDoc(doc(db, "estoque_movimentacoes", id));
      await fetchData();
    } catch (error) {
      console.error("Erro ao excluir movimentação:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Controle de Estoque
            </h1>
            {produtosBaixoEstoque.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                <AlertTriangle size={13} className="text-amber-600 animate-pulse" />
                {produtosBaixoEstoque.length} {produtosBaixoEstoque.length === 1 ? "item com estoque baixo" : "itens com estoque baixo"}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gestão de inventário, alertas de quantidade crítica (&lt; 5 un) e histórico de movimentações.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Printer size={16} /> Imprimir
          </button>
          <button
            onClick={() => handleOpenMovimentacaoModal()}
            className="bg-[#0071e3] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0071e3]/90 transition shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Movimentação
          </button>
        </div>
      </div>

      {/* Cards de Métricas e Alertas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Total de Produtos
            </span>
            <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
              {totalItensDistintos}
            </span>
            <span className="text-xs text-slate-500">Itens cadastrados</span>
          </div>
          <div className="w-11 h-11 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center">
            <Package size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Saldo em Unidades
            </span>
            <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
              {totalUnidades}
            </span>
            <span className="text-xs text-slate-500">Total físico estocado</span>
          </div>
          <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Layers size={22} />
          </div>
        </div>

        <div 
          onClick={() => {
            setActiveTab("produtos");
            setFilterStatus(filterStatus === "baixo" ? "todos" : "baixo");
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-2xs flex items-center justify-between ${
            produtosBaixoEstoque.length > 0 
              ? "bg-amber-50/70 border-amber-300 hover:bg-amber-100/60" 
              : "bg-white border-slate-200"
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">
                Estoque Baixo (&lt; 5 un)
              </span>
            </div>
            <span className="text-2xl font-extrabold text-amber-900 mt-1 block flex items-center gap-2">
              {produtosBaixoEstoque.length}
              {produtosBaixoEstoque.length > 0 && (
                <AlertTriangle size={18} className="text-amber-600" />
              )}
            </span>
            <span className="text-xs text-amber-700 font-medium">Requer reposição urgente</span>
          </div>
          <div className="w-11 h-11 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center">
            <AlertTriangle size={22} />
          </div>
        </div>

        <div 
          onClick={() => {
            setActiveTab("produtos");
            setFilterStatus(filterStatus === "zerado" ? "todos" : "zerado");
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-2xs flex items-center justify-between ${
            produtosEstoqueZerado.length > 0 
              ? "bg-rose-50/70 border-rose-300 hover:bg-rose-100/60" 
              : "bg-white border-slate-200"
          }`}
        >
          <div>
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider block">
              Estoque Zerado
            </span>
            <span className="text-2xl font-extrabold text-rose-900 mt-1 block">
              {produtosEstoqueZerado.length}
            </span>
            <span className="text-xs text-rose-700 font-medium">Itens indisponíveis</span>
          </div>
          <div className="w-11 h-11 bg-rose-100 text-rose-700 rounded-xl flex items-center justify-center">
            <TrendingDown size={22} />
          </div>
        </div>
      </div>

      {/* Alerta Visual em Banner (quando houver produtos com estoque inferior a 5 unidades) */}
      {produtosBaixoEstoque.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                Aviso de Estoque Crítico
                <span className="bg-amber-200 text-amber-900 text-[11px] px-2 py-0.5 rounded-md font-extrabold">
                  {produtosBaixoEstoque.length} {produtosBaixoEstoque.length === 1 ? "produto" : "produtos"} &lt; 5 un
                </span>
              </h3>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Os seguintes produtos estão com saldo inferior a 5 unidades disponíveis e precisam de reposição imediata:{" "}
                <span className="font-semibold text-amber-950">
                  {produtosBaixoEstoque.map(p => `${p.nome} (${p.qtdAtual || 0} un)`).slice(0, 4).join(", ")}
                  {produtosBaixoEstoque.length > 4 ? ` e mais ${produtosBaixoEstoque.length - 4}...` : ""}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTab("produtos");
              setFilterStatus("baixo");
            }}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0 shadow-2xs flex items-center justify-center gap-1.5"
          >
            <Filter size={13} /> Ver Apenas Itens Críticos
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("produtos")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "produtos"
              ? "border-[#0071e3] text-[#0071e3]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Package size={17} />
          <span>Saldos de Produtos em Estoque</span>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
            {produtos.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("movimentacoes")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "movimentacoes"
              ? "border-[#0071e3] text-[#0071e3]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Boxes size={17} />
          <span>Histórico de Movimentações (Entradas/Saídas)</span>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
            {movimentacoes.length}
          </span>
        </button>
      </div>

      {/* Painel Principal */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Barra de Busca e Filtro */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder={activeTab === "produtos" ? "Buscar por produto, SKU ou categoria..." : "Buscar movimentação..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0071e3] focus:border-transparent text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "produtos" && (
              <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
                <button
                  onClick={() => setFilterStatus("todos")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    filterStatus === "todos" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Todos ({produtos.length})
                </button>
                <button
                  onClick={() => setFilterStatus("baixo")}
                  className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1 ${
                    filterStatus === "baixo" ? "bg-amber-500 text-white shadow-2xs" : "text-amber-700 hover:bg-amber-50"
                  }`}
                >
                  <AlertTriangle size={12} />
                  &lt; 5 un ({produtosBaixoEstoque.length})
                </button>
                <button
                  onClick={() => setFilterStatus("zerado")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    filterStatus === "zerado" ? "bg-rose-600 text-white shadow-2xs" : "text-rose-700 hover:bg-rose-50"
                  }`}
                >
                  Zerados ({produtosEstoqueZerado.length})
                </button>
              </div>
            )}

            {activeTab === "movimentacoes" && (
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 border rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer select-none ${
                  showFilters || filterTipoMov !== "Todos" || filterStartDate || filterEndDate
                    ? "bg-blue-50 border-[#0071e3] text-[#0071e3] shadow-2xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Filter size={16} /> 
                <span>Filtros</span>
                {(filterTipoMov !== "Todos" || filterStartDate || filterEndDate) && (
                  <span className="w-2 h-2 rounded-full bg-[#0071e3] animate-pulse inline-block" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Filtros expandidos para movimentações */}
        {showFilters && activeTab === "movimentacoes" && (
          <div className="bg-slate-50 border-b border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end animate-fadeIn">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</label>
              <select
                value={filterTipoMov}
                onChange={(e) => setFilterTipoMov(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#0071e3] outline-none text-slate-700 font-medium"
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
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#0071e3] outline-none text-slate-700 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Até (Data)</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#0071e3] outline-none text-slate-700 font-medium"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setFilterTipoMov("Todos");
                  setFilterStartDate("");
                  setFilterEndDate("");
                }}
                className="flex-1 py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Limpar
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="flex-1 py-1.5 px-3 bg-[#0071e3] text-white rounded-lg text-xs font-bold hover:bg-[#0071e3]/90 transition-all cursor-pointer"
              >
                Aplicar
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: LISTAGEM DE PRODUTOS COM ALERTA VISUAL (< 5 UNIDADES) */}
        {activeTab === "produtos" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold w-14">Foto</th>
                  <th className="px-4 py-3 font-semibold">SKU</th>
                  <th className="px-4 py-3 font-semibold">Produto</th>
                  <th className="px-4 py-3 font-semibold">Categoria</th>
                  <th className="px-4 py-3 font-semibold text-right">Preço Venda</th>
                  <th className="px-4 py-3 font-semibold text-center">Quantidade Atual</th>
                  <th className="px-4 py-3 font-semibold text-center">Status / Alerta</th>
                  <th className="px-4 py-3 font-semibold text-right w-36">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="p-4"><div className="w-10 h-10 bg-slate-100 rounded-lg" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-16" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-48" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-24" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-16 ml-auto" /></td>
                      <td className="p-4"><div className="h-6 bg-slate-100 rounded-full w-16 mx-auto" /></td>
                      <td className="p-4"><div className="h-6 bg-slate-100 rounded-full w-28 mx-auto" /></td>
                      <td className="p-4"><div className="h-8 bg-slate-100 rounded w-24 ml-auto" /></td>
                    </tr>
                  ))
                ) : filteredProdutos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      <Package className="mx-auto h-8 w-8 mb-2 text-slate-300" />
                      <p className="font-medium">Nenhum produto encontrado com os filtros atuais.</p>
                    </td>
                  </tr>
                ) : (
                  filteredProdutos.map((item) => {
                    const qtd = Number(item.qtdAtual) || 0;
                    const isEstoqueBaixo = qtd < 5; // REGRA: Menos de 5 unidades
                    const isZerado = qtd <= 0;

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50/60 transition-colors ${
                          isZerado 
                            ? "bg-rose-50/30" 
                            : isEstoqueBaixo 
                            ? "bg-amber-50/30" 
                            : ""
                        }`}
                      >
                        {/* Imagem */}
                        <td className="p-4">
                          {item.imagemPrincipal ? (
                            <img
                              src={item.imagemPrincipal}
                              alt={item.nome}
                              className="w-10 h-10 object-cover rounded-lg bg-slate-100 border border-slate-200"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                              <Package size={18} />
                            </div>
                          )}
                        </td>

                        {/* SKU */}
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {item.sku || "—"}
                        </td>

                        {/* Nome */}
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{item.nome}</span>
                            {/* Ícone de Aviso em destaque para produtos com menos de 5 unidades */}
                            {isEstoqueBaixo && (
                              <span 
                                title={`Atenção: Apenas ${qtd} unidade(s) disponível(is)! Quantidade inferior ao limite mínimo de segurança (5 un).`}
                                className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-md border border-amber-300 shrink-0"
                              >
                                <AlertTriangle size={13} className="text-amber-600 animate-pulse" />
                                {isZerado ? "Sem Estoque" : "Estoque Crítico"}
                              </span>
                            )}
                          </div>
                          {item.unidade && (
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              Unidade: {item.unidade} {item.localizacao ? `• Loc: ${item.localizacao}` : ""}
                            </span>
                          )}
                        </td>

                        {/* Categoria */}
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {item.categorias?.length ? item.categorias.join(", ") : (item.categoria || "Geral")}
                        </td>

                        {/* Preço */}
                        <td className="px-4 py-3 font-semibold text-slate-900 text-right">
                          {item.precoVenda ? `R$ ${Number(item.precoVenda).toFixed(2)}` : "—"}
                        </td>

                        {/* Quantidade Atual com destaque visual */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 rounded-full text-xs font-extrabold ${
                              isZerado
                                ? "bg-rose-100 text-rose-800 border border-rose-300"
                                : isEstoqueBaixo
                                ? "bg-amber-100 text-amber-900 border border-amber-300 font-black"
                                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {qtd} {item.unidade || "un"}
                          </span>
                        </td>

                        {/* Status / Alerta Visual */}
                        <td className="px-4 py-3 text-center">
                          {isZerado ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertCircle size={13} className="text-rose-600" />
                              Esgotado (0)
                            </span>
                          ) : isEstoqueBaixo ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-400 shadow-2xs">
                              <AlertTriangle size={14} className="text-amber-600" />
                              Alerta: &lt; 5 unidades
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                              <CheckCircle2 size={13} className="text-emerald-600" />
                              Regular
                            </span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleOpenMovimentacaoModal(item)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-[#0071e3] hover:text-white text-slate-700 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title="Lançar Entrada ou Saída deste produto"
                          >
                            <Boxes size={13} />
                            Movimentar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: LISTAGEM DE MOVIMENTAÇÕES */}
        {activeTab === "movimentacoes" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">Data / Hora</th>
                  <th className="px-4 py-3 font-semibold">Produto</th>
                  <th className="px-4 py-3 font-semibold text-center">Tipo</th>
                  <th className="px-4 py-3 font-semibold text-center">Quantidade</th>
                  <th className="px-4 py-3 font-semibold">Motivo / Observação</th>
                  <th className="px-4 py-3 font-semibold">Responsável</th>
                  <th className="px-4 py-3 font-semibold text-right w-20">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-24" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-40" /></td>
                      <td className="p-4"><div className="h-5 bg-slate-100 rounded-full w-16 mx-auto" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-12 mx-auto" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-48" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-24" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-8 ml-auto" /></td>
                    </tr>
                  ))
                ) : filteredMovimentacoes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      <Boxes className="mx-auto h-8 w-8 mb-2 text-slate-300" />
                      <p className="font-medium">Nenhuma movimentação registrada.</p>
                    </td>
                  </tr>
                ) : (
                  filteredMovimentacoes.map((mov) => {
                    const isEntrada = mov.tipo === "Entrada";

                    return (
                      <tr key={mov.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {mov.createdAt ? new Date(mov.createdAt).toLocaleString("pt-BR") : "—"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {mov.produto}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              isEntrada
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {isEntrada ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
                            {mov.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-center text-slate-800">
                          {isEntrada ? `+${mov.quantidade}` : `-${mov.quantidade}`}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {mov.motivo || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {mov.responsavel || "Sistema"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => mov.id && setItemToDelete(mov.id)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                            title="Excluir Registro"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-2">
          <p>
            Exibindo{" "}
            <strong>
              {activeTab === "produtos" ? filteredProdutos.length : filteredMovimentacoes.length}
            </strong>{" "}
            {activeTab === "produtos" ? "produtos" : "movimentações"}
          </p>
          <p className="text-slate-400">
            Regra do Sistema: Alerta automático acionado quando estoque &lt; 5 unidades
          </p>
        </div>
      </div>

      {/* Modal Lançar Movimentação */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-blue-50 text-[#0071e3] rounded-xl flex items-center justify-center">
                <Boxes size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Lançar Movimentação de Estoque
                </h3>
                <p className="text-xs text-slate-500">
                  Atualize o saldo físico com registro automático no histórico.
                </p>
              </div>
            </div>

            <form onSubmit={handleSalvarMovimentacao} className="space-y-4">
              {/* Seleção de Produto */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Produto *
                </label>
                <select
                  value={selectedProdutoId}
                  onChange={(e) => setSelectedProdutoId(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-[#0071e3] outline-none"
                >
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (Saldo Atual: {p.qtdAtual || 0} un) {Number(p.qtdAtual || 0) < 5 ? "⚠️ [Estoque Baixo]" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo de Movimentação */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Tipo de Movimentação *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMovTipo("Entrada")}
                    className={`py-2.5 px-4 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      movTipo === "Entrada"
                        ? "bg-emerald-500 border-emerald-600 text-white shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <ArrowDownRight size={16} /> Entrada (Reposição)
                  </button>

                  <button
                    type="button"
                    onClick={() => setMovTipo("Saída")}
                    className={`py-2.5 px-4 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      movTipo === "Saída"
                        ? "bg-rose-500 border-rose-600 text-white shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <ArrowUpRight size={16} /> Saída (Uso / Venda)
                  </button>
                </div>
              </div>

              {/* Quantidade */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Quantidade *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={movQtd}
                  onChange={(e) => setMovQtd(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold focus:ring-2 focus:ring-[#0071e3] outline-none"
                  placeholder="Ex: 10"
                />
              </div>

              {/* Motivo */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Motivo / Nota Fiscal / Observações
                </label>
                <input
                  type="text"
                  value={movMotivo}
                  onChange={(e) => setMovMotivo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-[#0071e3] outline-none"
                  placeholder="Ex: Compra NF 1234, Ajuste de Inventário, Consumo Interno..."
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-[#0071e3] hover:bg-[#0071e3]/90 text-white rounded-xl text-sm font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? "Gravando..." : "Confirmar Movimentação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDeleteModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => {
          if (itemToDelete) {
            handleDeleteMovimentacao(itemToDelete);
            setItemToDelete(null);
          }
        }}
        title="Excluir Registro de Movimentação"
        message="Tem certeza que deseja excluir este registro do histórico de movimentações?"
      />
    </div>
  );
}
