import React, { useState, useEffect } from "react";
import { 
  History, 
  ShieldAlert, 
  Search, 
  Boxes, 
  Package, 
  User, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  FileText, 
  CheckCircle2, 
  Info,
  ArrowRight,
  Sparkles,
  Layers,
  Clock,
  Globe
} from "lucide-react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";

export interface AuditLogItem {
  id: string;
  action: string;
  category: "Administrativo" | "Comercial" | "Financeiro" | "Estoque" | "Sistema" | string;
  userName: string;
  userEmail: string;
  ip?: string;
  date: any;
  details?: any;
  before?: any;
  after?: any;
}

const FALLBACK_LOGS: AuditLogItem[] = [
  {
    id: "log-1",
    action: "Entrada de Estoque: +120 un. Sabão Líquido Omo 5L",
    category: "Estoque",
    userName: "Carlos Eduardo",
    userEmail: "carlos.almoxarifado@limpeza.com",
    ip: "192.168.1.45",
    date: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    details: { produto: "Sabão Líquido Omo 5L", quantidade: 120, tipoMovimentacao: "Entrada (Nota Fiscal 48192)", fornecedor: "Unilever Brasil" },
    before: { estoqueAtual: 35 },
    after: { estoqueAtual: 155 }
  },
  {
    id: "log-2",
    action: "Alteração de Preço: Desinfetante Pinho Sol 5L (R$ 24,90 ➔ R$ 28,50)",
    category: "Produtos",
    userName: "Mariana Silva",
    userEmail: "mariana.admin@limpeza.com",
    ip: "189.24.112.8",
    date: new Date(Date.now() - 1000 * 60 * 54).toISOString(),
    details: { produto: "Desinfetante Pinho Sol 5L", campoAlterado: "precoVenta", motivo: "Reajuste de custos do fornecedor" },
    before: { precoVenda: 24.90, margem: "28%" },
    after: { precoVenda: 28.50, margem: "34%" }
  },
  {
    id: "log-3",
    action: "Ajuste de Estoque por Avaria: -4 un. Detergente Neutro 5L",
    category: "Estoque",
    userName: "João Pedro (Estoquista)",
    userEmail: "joao.expedicao@limpeza.com",
    ip: "192.168.1.102",
    date: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    details: { produto: "Detergente Neutro 5L", quantidade: -4, motivo: "Galões danificados no descarregamento", local: "Doca 2" },
    before: { estoque: 88 },
    after: { estoque: 84 }
  },
  {
    id: "log-4",
    action: "Cadastro de Novo Produto: Mop Giratório Inox com Balde 12L",
    category: "Produtos",
    userName: "Mariana Silva",
    userEmail: "mariana.admin@limpeza.com",
    ip: "189.24.112.8",
    date: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
    details: { codigoSku: "EQUIP-MOP-009", categoria: "Equipamentos", precoCusto: 65.00, precoVenda: 119.90, estoqueInicial: 40 },
    before: null,
    after: { sku: "EQUIP-MOP-009", produto: "Mop Giratório Inox 12L", ativo: true }
  },
  {
    id: "log-5",
    action: "Saída de Estoque para Pedido #10482: 15 Kits Condominiais",
    category: "Estoque",
    userName: "Sistema Automático",
    userEmail: "expedicao.bot@limpeza.com",
    ip: "Servidor Interno",
    date: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    details: { cliente: "Condomínio Residencial Jardins", pedidoId: "10482", itensTotal: 15 },
    before: { statusPedido: "Aguardando Separação" },
    after: { statusPedido: "Despachado / Em Rota" }
  },
  {
    id: "log-6",
    action: "Alteração de Nível de Permissão de Usuário",
    category: "Administrativo",
    userName: "Gerência Geral",
    userEmail: "admin@limpeza.com",
    ip: "201.88.19.4",
    date: new Date(Date.now() - 1000 * 60 * 540).toISOString(),
    details: { usuarioAfetado: "Fernanda Lima", perfilAntigo: "Operador", perfilNovo: "Supervisora de Estoque" },
    before: { role: "Operador" },
    after: { role: "Estoquista" }
  }
];

export function ActivityAuditTable() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: () => void;

    const fetchLogs = async () => {
      try {
        setLoading(true);
        const { db } = await initFirebase();
        const logsRef = collection(db, "logs_sistema");
        const q = query(logsRef, orderBy("date", "desc"), limit(40));

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            if (!snapshot.empty) {
              const fetchedLogs = snapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                  id: doc.id,
                  action: data.action || "Ação de Sistema",
                  category: data.category || "Sistema",
                  userName: data.userName || data.userEmail || "Usuário do Sistema",
                  userEmail: data.userEmail || "N/A",
                  ip: data.ip || "IP Local",
                  date: data.date?.toDate ? data.date.toDate().toISOString() : data.date || new Date().toISOString(),
                  details: data.details,
                  before: data.before,
                  after: data.after,
                } as AuditLogItem;
              });
              setLogs(fetchedLogs);
            } else {
              setLogs(FALLBACK_LOGS);
            }
            setLoading(false);
          },
          (err) => {
            console.warn("Nenhum log ao vivo retornado, utilizando logs de auditoria padronizados:", err);
            setLogs(FALLBACK_LOGS);
            setLoading(false);
          }
        );
      } catch (err) {
        console.error("Erro ao conectar no banco de auditoria:", err);
        setLogs(FALLBACK_LOGS);
        setLoading(false);
      }
    };

    fetchLogs();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const formatDate = (isoOrTimestamp: any) => {
    if (!isoOrTimestamp) return "N/A";
    try {
      const d = new Date(isoOrTimestamp);
      if (isNaN(d.getTime())) return "N/A";
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch {
      return "N/A";
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "Estoque":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 text-amber-700 border border-amber-200/80">
            <Boxes size={12} className="text-amber-600 shrink-0" />
            Estoque & Movimentações
          </span>
        );
      case "Produtos":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-200/80">
            <Package size={12} className="text-blue-600 shrink-0" />
            Cadastro de Produtos
          </span>
        );
      case "Financeiro":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
            Financeiro
          </span>
        );
      case "Administrativo":
      case "Sistema":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-purple-50 text-purple-700 border border-purple-200/80">
            <ShieldAlert size={12} className="text-purple-600 shrink-0" />
            {category || "Sistema"}
          </span>
        );
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesCategory =
      selectedCategory === "Todas" ||
      (selectedCategory === "Estoque" && log.category === "Estoque") ||
      (selectedCategory === "Produtos" && log.category === "Produtos") ||
      (selectedCategory === "Outros" && log.category !== "Estoque" && log.category !== "Produtos");

    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      log.action.toLowerCase().includes(term) ||
      log.userName.toLowerCase().includes(term) ||
      log.userEmail.toLowerCase().includes(term) ||
      JSON.stringify(log.details || {}).toLowerCase().includes(term);

    return matchesCategory && matchesSearch;
  });

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden mt-8">
      {/* Header Bar */}
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
            <History size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Histórico de Atividades & Auditoria Interna</h2>
              <span className="px-2 py-0.5 text-[10px] font-extrabold bg-blue-100 text-blue-800 rounded-full">
                Logs em Tempo Real
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Rastreabilidade de alterações críticas no estoque, tabela de preços, cadastros e permissões
            </p>
          </div>
        </div>

        {/* Action Indicators */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
            <Clock size={14} className="text-slate-400" />
            Total: <strong>{filteredLogs.length} registros</strong>
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedCategory("Todas")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              selectedCategory === "Todas"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Todas as Atividades
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("Estoque")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              selectedCategory === "Estoque"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/50"
            }`}
          >
            <Boxes size={13} className="inline mr-1" />
            Movimentações de Estoque
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("Produtos")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              selectedCategory === "Produtos"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/50"
            }`}
          >
            <Package size={13} className="inline mr-1" />
            Cadastro de Produtos
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("Outros")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              selectedCategory === "Outros"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/50"
            }`}
          >
            Administrativo / Outros
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por produto, usuário ou ação..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <th className="py-3 px-4">Data & Hora</th>
              <th className="py-3 px-4">Categoria</th>
              <th className="py-3 px-4">Ação / Alteração Crítica</th>
              <th className="py-3 px-4">Usuário Responsável</th>
              <th className="py-3 px-4 text-right">Detalhes Technical</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <RefreshCw size={24} className="animate-spin text-blue-600" />
                    <span>Carregando registros de auditoria...</span>
                  </div>
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Info size={28} className="text-slate-400" />
                    <span className="font-semibold text-slate-700">Nenhum registro encontrado</span>
                    <span className="text-xs text-slate-400">Nenhuma atividade corresponde aos filtros selecionados.</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <React.Fragment key={log.id}>
                    <tr 
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                        isExpanded ? "bg-blue-50/40" : ""
                      }`}
                      onClick={() => toggleExpand(log.id)}
                    >
                      {/* Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-400 shrink-0" />
                          <span>{formatDate(log.date)}</span>
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getCategoryBadge(log.category)}
                      </td>

                      {/* Action Description */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-md">
                        <div className="truncate" title={log.action}>
                          {log.action}
                        </div>
                      </td>

                      {/* User */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-700">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {log.userName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-slate-800 leading-none">{log.userName}</div>
                            <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{log.userEmail}</div>
                          </div>
                        </div>
                      </td>

                      {/* Detail Expand Button */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(log.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <FileText size={13} />
                          <span>{isExpanded ? "Ocultar" : "Expandir"}</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Technical View */}
                    {isExpanded && (
                      <tr className="bg-slate-900 text-slate-100 border-b border-slate-800">
                        <td colSpan={5} className="p-4 sm:p-5">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Sparkles size={14} className="text-blue-400" />
                                Detalhamento do Audit Payload
                              </span>
                              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                <Globe size={12} />
                                IP Origem: {log.ip || "192.168.1.1"}
                              </span>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              {/* Summary / Meta */}
                              <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
                                <strong className="text-blue-400 block mb-1 text-[11px] uppercase tracking-wider">Metadados da Ação</strong>
                                <ul className="space-y-1 text-slate-300 text-[11px]">
                                  <li><strong>ID Log:</strong> {log.id}</li>
                                  <li><strong>Categoria:</strong> {log.category}</li>
                                  <li><strong>Executor:</strong> {log.userName} ({log.userEmail})</li>
                                </ul>
                              </div>

                              {/* Before State */}
                              <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
                                <strong className="text-amber-400 block mb-1 text-[11px] uppercase tracking-wider">Estado Anterior (Before)</strong>
                                <pre className="text-[11px] text-amber-200/90 font-mono overflow-x-auto whitespace-pre-wrap">
                                  {log.before ? JSON.stringify(log.before, null, 2) : "Nenhum registro prévio"}
                                </pre>
                              </div>

                              {/* After State */}
                              <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
                                <strong className="text-emerald-400 block mb-1 text-[11px] uppercase tracking-wider">Novo Estado (After)</strong>
                                <pre className="text-[11px] text-emerald-200/90 font-mono overflow-x-auto whitespace-pre-wrap">
                                  {log.after ? JSON.stringify(log.after, null, 2) : "Atualização direta"}
                                </pre>
                              </div>
                            </div>

                            {/* Raw Details Object */}
                            {log.details && (
                              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                                <span className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Payload de Detalhes Adicionais:</span>
                                <pre className="text-[11px] text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
