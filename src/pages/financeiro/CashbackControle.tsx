import React, { useState, useEffect } from "react";
import { 
  collection, 
  getDocs, 
  collectionGroup,
  doc,
  updateDoc
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import { 
  Coins, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar,
  Clock,
  ListOrdered,
  CheckCircle2,
  AlertCircle,
  Check,
  Eye,
  X,
  Copy,
  CheckCheck,
  User,
  Mail,
  Phone,
  QrCode,
  Ticket,
  FileText,
  DollarSign,
  ShieldCheck,
  ArrowRight,
  Info
} from "lucide-react";

interface CashbackTransaction {
  id: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  userCpf?: string;
  type: string; // 'earning' | 'withdrawal' | 'discount'
  amount: number;
  netAmount?: number;
  description: string;
  date: string;
  status: string; // 'Aprovado' | 'Pendente' | 'Rejeitado'
  code?: string;
  pixKeyType?: string;
  pixKey?: string;
  pixPhone?: string;
}

interface RedemptionRequest {
  id: string;
  descricao: string;
  valor: number;
  vencimento?: string;
  dataInclusao?: string;
  createdAt?: string;
  dataCriacao?: string;
  pagoEm?: string;
  fornecedor: string;
  status: string; // 'Aberto' or 'Pago'
  itemPagamento?: string;
  categoria?: string;
  observacoes?: string;
  userId?: string;
  userEmail?: string;
  userPhone?: string;
  pixKeyType?: string;
  pixKey?: string;
  pixPhone?: string;
  cashbackTransactionId?: string;
}

export default function CashbackControle() {
  const [activeTab, setActiveTab] = useState<"history" | "requests">("history");
  
  // History States
  const [transactions, setTransactions] = useState<CashbackTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "earning" | "withdrawal" | "discount">("all");

  // Requests States
  const [requests, setRequests] = useState<RedemptionRequest[]>([]);
  const [requestsSearchTerm, setRequestsSearchTerm] = useState("");
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Modal Detail State
  const [selectedRecord, setSelectedRecord] = useState<{
    type: "transaction" | "request";
    data: CashbackTransaction | RedemptionRequest;
  } | null>(null);

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      // 1. Fetch all users to map their names, email, phone, cpf
      const usersMap = new Map();
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        usersSnap.forEach(userDoc => {
          const uData = userDoc.data();
          usersMap.set(userDoc.id, {
            nome: uData.nome || uData.displayName || "Cliente",
            email: uData.email || "",
            telefone: uData.telefone || uData.phone || "",
            cpf: uData.cpf || ""
          });
        });
      } catch (err: any) {
        console.warn("Could not fetch users:", err.message);
      }

      const txList: CashbackTransaction[] = [];

      // 2. Fetch transactions from collection group (subcollections)
      try {
        const cgSnap = await getDocs(collectionGroup(db, "cashback_transactions"));
        cgSnap.forEach(docSnap => {
          const data = docSnap.data();
          let userId = data.userId;
          if (!userId && docSnap.ref.parent.parent) {
            userId = docSnap.ref.parent.parent.id;
          }
          
          const uObj = userId ? usersMap.get(userId) : null;
          txList.push({
            id: docSnap.id,
            ...data,
            userId: userId,
            userName: uObj?.nome || data.userName || "Cliente Desconhecido",
            userEmail: uObj?.email || data.userEmail || "",
            userPhone: uObj?.telefone || data.userPhone || data.pixPhone || "",
            userCpf: uObj?.cpf || data.userCpf || ""
          } as CashbackTransaction);
        });
      } catch (err: any) {
        console.warn("Could not fetch collectionGroup cashback_transactions:", err.message);
      }

      // 3. Fetch transactions from root collection
      try {
        const rootSnap = await getDocs(collection(db, "cashback_transactions"));
        rootSnap.forEach(docSnap => {
          if (!txList.find(t => t.id === docSnap.id)) {
            const data = docSnap.data();
            const uObj = data.userId ? usersMap.get(data.userId) : null;
            txList.push({
              id: docSnap.id,
              ...data,
              userName: uObj?.nome || data.userName || "Cliente Desconhecido",
              userEmail: uObj?.email || data.userEmail || "",
              userPhone: uObj?.telefone || data.userPhone || data.pixPhone || "",
              userCpf: uObj?.cpf || data.userCpf || ""
            } as CashbackTransaction);
          }
        });
      } catch (err: any) {
        console.warn("Could not fetch root cashback_transactions:", err.message);
      }

      txList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(txList);
    } catch (err) {
      console.error("Error fetching all cashback transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequestsData = async () => {
    try {
      setLoadingRequests(true);
      // Fetch users for mapping
      const usersMap = new Map();
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        usersSnap.forEach(userDoc => {
          const uData = userDoc.data();
          usersMap.set(userDoc.id, {
            nome: uData.nome || uData.displayName || "Cliente",
            email: uData.email || "",
            telefone: uData.telefone || uData.phone || "",
            cpf: uData.cpf || ""
          });
        });
      } catch (e) {
        console.warn("Could not fetch users in fetchRequestsData:", e);
      }

      const payablesRef = collection(db, "contas_pagar");
      const payablesSnap = await getDocs(payablesRef);
      const allPayables = payablesSnap.docs.map(doc => {
        const data = doc.data();
        const uObj = data.userId ? usersMap.get(data.userId) : null;
        return { 
          id: doc.id, 
          ...data,
          userEmail: uObj?.email || data.userEmail || "",
          userPhone: uObj?.telefone || data.userPhone || data.pixPhone || ""
        } as RedemptionRequest;
      });
      
      const cashbackRequests = allPayables.filter((p: any) => 
        p.itemPagamento === "cashback" || p.categoria === "cashback" || p.categoria === "Cashback Cliente"
      );

      // Sort requests: Pending/Aberto first, then newest first
      cashbackRequests.sort((a, b) => {
        if (a.status === "Aberto" && b.status !== "Aberto") return -1;
        if (a.status !== "Aberto" && b.status === "Aberto") return 1;
        return new Date(b.createdAt || b.dataInclusao || b.dataCriacao || 0).getTime() - new Date(a.createdAt || a.dataInclusao || a.dataCriacao || 0).getTime();
      });

      setRequests(cashbackRequests);
    } catch (err) {
      console.error("Erro ao carregar dados do admin de cashback:", err);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      fetchAllData();
    } else {
      fetchRequestsData();
    }
  }, [activeTab]);

  const handleApproveRequest = async (request: RedemptionRequest) => {
    setSuccessMessage("");
    setErrorMessage("");
    try {
      try {
        const response = await fetch('/api/cashback/aprovar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: request.id,
            userId: request.userId,
            transactionId: request.cashbackTransactionId,
            clientName: request.fornecedor,
            amount: request.valor,
            observations: request.observacoes
          })
        });
        if (!response.ok) console.warn("API approval failed, falling back to direct update");
      } catch (e) {
        // Ignore API failure in dev
      }

      // Direct Firebase approval
      const payablesRef = doc(db, "contas_pagar", request.id);
      await updateDoc(payablesRef, {
        status: "Pago",
        pagoEm: new Date().toISOString().split('T')[0]
      });

      if (request.cashbackTransactionId && request.userId) {
        try {
           const txRef = doc(db, "users", request.userId, "cashback_transactions", request.cashbackTransactionId);
           await updateDoc(txRef, { status: "Aprovado" });
        } catch (e) {
           console.log("No subcollection doc found to update");
        }
        
        try {
           const rootTxRef = doc(db, "cashback_transactions", request.cashbackTransactionId);
           await updateDoc(rootTxRef, { status: "Aprovado" });
        } catch (e) {
           console.log("No root doc found to update");
        }
      }

      await logAction(
        `Aprovação de Reembolso Cashback via Pix: ${request.fornecedor}`,
        "Financeiro",
        { 
          requestId: request.id,
          cliente: request.fornecedor,
          valor: request.valor,
          chavePix: request.observacoes
        }
      );

      const msg = `Solicitação de reembolso de ${request.fornecedor} no valor de R$ ${request.valor.toFixed(2)} aprovada e marcada como Paga!`;
      setSuccessMessage(msg);
      
      // Update selected modal item if open
      if (selectedRecord && selectedRecord.data.id === request.id) {
        setSelectedRecord({
          ...selectedRecord,
          data: {
            ...selectedRecord.data,
            status: "Pago",
            pagoEm: new Date().toISOString().split('T')[0]
          }
        });
      }

      // Reload lists
      if (activeTab === "history") {
        await fetchAllData();
      } else {
        await fetchRequestsData();
      }

    } catch (err: any) {
      console.error("Erro ao aprovar solicitação de reembolso:", err);
      setErrorMessage("Ocorreu um erro ao aprovar a solicitação de reembolso.");
    }
  };

  const handleCopyText = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesFilter = activeFilter === "all" || t.type === activeFilter;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      t.description?.toLowerCase().includes(searchLower) ||
      t.userName?.toLowerCase().includes(searchLower) ||
      t.userEmail?.toLowerCase().includes(searchLower) ||
      t.code?.toLowerCase().includes(searchLower) ||
      t.pixKey?.toLowerCase().includes(searchLower) ||
      t.status?.toLowerCase().includes(searchLower);
      
    return matchesFilter && matchesSearch;
  });

  const filteredRequests = requests.filter(req => {
    const text = `${req.fornecedor} ${req.descricao} ${req.observacoes || ""} ${req.status} ${req.userEmail || ""}`.toLowerCase();
    return text.includes(requestsSearchTerm.toLowerCase());
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Coins className="text-brand-light" size={26} />
            Controle de Cashback - Aplicativo
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestão completa, auditoria detalhada de registros, saques via Pix (SAC) e cupons promocionais.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => { setActiveTab("history"); }}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "history"
              ? "border-brand-dark text-brand-dark font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <ListOrdered size={16} /> Histórico Geral ({transactions.length})
        </button>
        <button
          onClick={() => { setActiveTab("requests"); }}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "requests"
              ? "border-brand-dark text-brand-dark font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Clock size={16} /> Solicitações de Reembolso Pix (SAC)
          {requests.filter(r => r.status === "Aberto").length > 0 && (
            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold">
              {requests.filter(r => r.status === "Aberto").length}
            </span>
          )}
        </button>
      </div>

      {/* Active Tab 1: Histórico Geral */}
      {activeTab === "history" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-fadeIn">
          <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between">
            <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveFilter("all")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setActiveFilter("earning")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === "earning" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-emerald-700"
                }`}
              >
                Ganhos
              </button>
              <button
                onClick={() => setActiveFilter("withdrawal")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === "withdrawal" ? "bg-white text-sky-700 shadow-sm" : "text-slate-500 hover:text-sky-700"
                }`}
              >
                Saques (Pix)
              </button>
              <button
                onClick={() => setActiveFilter("discount")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === "discount" ? "bg-white text-yellow-800 shadow-sm" : "text-slate-500 hover:text-yellow-800"
                }`}
              >
                Cupons
              </button>
            </div>

            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por cliente, código, chave Pix..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-dark/50 text-sm"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Descrição / Detalhes</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Valor</th>
                  <th className="px-6 py-4 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-medium">
                      Carregando transações...
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-medium">
                      Nenhuma transação encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    let badgeBg = "bg-slate-50 text-slate-600";
                    if (tx.status === "Aprovado" || tx.status === "Pago") badgeBg = "bg-emerald-50 text-emerald-700";
                    else if (tx.status === "Pendente" || tx.status === "Aberto") badgeBg = "bg-amber-50 text-amber-700";
                    else if (tx.status === "Rejeitado") badgeBg = "bg-red-50 text-red-700";

                    return (
                      <tr 
                        key={tx.id} 
                        onClick={() => setSelectedRecord({ type: "transaction", data: tx })}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                            <Calendar size={14} />
                            {new Date(tx.date).toLocaleDateString("pt-BR", {
                              day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900 group-hover:text-brand-dark transition-colors">
                            {tx.userName}
                          </div>
                          {tx.userEmail && (
                            <span className="text-[11px] text-slate-400 block font-normal">{tx.userEmail}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {tx.type === "earning" ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg text-xs">
                              <ArrowDownLeft size={14} /> Ganho
                            </span>
                          ) : tx.type === "withdrawal" ? (
                            <span className="inline-flex items-center gap-1 font-bold text-sky-600 bg-sky-50 px-2 py-1 rounded-lg text-xs">
                              <ArrowUpRight size={14} /> Saque Pix (SAC)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-yellow-800 bg-yellow-50 px-2 py-1 rounded-lg text-xs">
                              <Ticket size={14} /> Cupom
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 max-w-[240px]">
                          <div className="truncate text-slate-800 text-xs font-medium" title={tx.description}>
                            {tx.description}
                          </div>
                          {tx.code && (
                            <span className="inline-block mt-1 text-[11px] font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Cupom: {tx.code}
                            </span>
                          )}
                          {tx.pixKey && (
                            <span className="inline-block mt-1 text-[11px] font-mono text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                              Pix ({tx.pixKeyType || 'Chave'}): {tx.pixKey}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${badgeBg}`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">
                          <span className={tx.type === "earning" ? "text-emerald-600" : "text-slate-900"}>
                            {tx.type === "earning" ? "+" : "-"} R$ {tx.amount.toFixed(2).replace(".", ",")}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRecord({ type: "transaction", data: tx });
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-brand-dark hover:text-white text-slate-600 rounded-lg transition-all inline-flex items-center gap-1 text-xs font-semibold"
                            title="Ver Detalhamento Completo"
                          >
                            <Eye size={15} />
                            <span className="hidden sm:inline">Detalhes</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Tab 2: Solicitações de Reembolso (Pix / SAC) */}
      {activeTab === "requests" && (
        <div className="space-y-4 animate-fadeIn">
          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-3 text-sm font-medium shadow-2xs">
              <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-3 text-sm font-medium shadow-2xs">
              <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <QrCode size={20} className="text-sky-600" />
                  Solicitações de Transferência Pix (SAC)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clique em qualquer linha ou botão para analisar o detalhamento completo antes de efetuar a transferência.
                </p>
              </div>
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, chave Pix..."
                  value={requestsSearchTerm}
                  onChange={(e) => setRequestsSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-dark/50 text-sm"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Descrição</th>
                    <th className="px-6 py-4">Chave Pix Selecionada</th>
                    <th className="px-6 py-4">Valor Líquido (75%)</th>
                    <th className="px-6 py-4">Data Solicitação</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {loadingRequests ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-medium">
                        Carregando solicitações...
                      </td>
                    </tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-medium">
                        Nenhuma solicitação de reembolso encontrada.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req) => (
                      <tr 
                        key={req.id} 
                        onClick={() => setSelectedRecord({ type: "request", data: req })}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4 font-semibold text-slate-900 group-hover:text-brand-dark transition-colors">
                          {req.fornecedor}
                          {req.userEmail && (
                            <span className="text-[11px] text-slate-400 block font-normal">{req.userEmail}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600 max-w-[180px] truncate">
                          {req.descricao}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs bg-slate-100 border border-slate-200 px-2 py-1 rounded-md font-mono text-slate-700 font-medium block w-fit max-w-[200px] truncate">
                            {req.observacoes ? req.observacoes.split('|')[0] : (req.pixKey || "Não informada")}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-emerald-600">
                          {req.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {req.dataInclusao ? new Date(req.dataInclusao + "T12:00:00").toLocaleDateString("pt-BR") : "-"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                            req.status === "Pago" 
                              ? "bg-emerald-100 text-emerald-800" 
                              : "bg-amber-100 text-amber-800 animate-pulse"
                          }`}>
                            {req.status === "Pago" ? "Pago (Aprovado)" : "Pendente"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRecord({ type: "request", data: req });
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1"
                              title="Ver Detalhes"
                            >
                              <Eye size={15} /> Detalhes
                            </button>
                            {req.status === "Aberto" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApproveRequest(req);
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 hover:shadow-xs"
                              >
                                <Check size={14} /> Aprovar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED RECORD MODAL (O Módulo Principal Solicitado) */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full border border-slate-100 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto relative">
            
            {/* Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  selectedRecord.type === "request" || (selectedRecord.data as CashbackTransaction).type === "withdrawal"
                    ? "bg-sky-50 text-sky-600"
                    : (selectedRecord.data as CashbackTransaction).type === "discount"
                    ? "bg-yellow-50 text-yellow-700"
                    : "bg-emerald-50 text-emerald-600"
                }`}>
                  {selectedRecord.type === "request" || (selectedRecord.data as CashbackTransaction).type === "withdrawal" ? (
                    <QrCode size={26} />
                  ) : (selectedRecord.data as CashbackTransaction).type === "discount" ? (
                    <Ticket size={26} />
                  ) : (
                    <Coins size={26} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Detalhamento do Registro
                    </span>
                    <span className="text-xs font-mono text-slate-400">ID: #{selectedRecord.data.id.slice(0, 8)}</span>
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                    {selectedRecord.type === "request" 
                      ? `Solicitação de Saque Pix - ${selectedRecord.data.fornecedor}`
                      : (selectedRecord.data as CashbackTransaction).type === "withdrawal"
                      ? `Resgate Pix (SAC) - ${(selectedRecord.data as CashbackTransaction).userName}`
                      : (selectedRecord.data as CashbackTransaction).type === "discount"
                      ? `Cupom de Desconto - ${(selectedRecord.data as CashbackTransaction).userName}`
                      : `Crédito de Cashback - ${(selectedRecord.data as CashbackTransaction).userName}`}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Financial Summary Top Bar */}
            {(() => {
              const isReq = selectedRecord.type === "request";
              const isWithdrawal = isReq || (selectedRecord.data as CashbackTransaction).type === "withdrawal";
              const isDiscount = !isReq && (selectedRecord.data as CashbackTransaction).type === "discount";
              
              let grossAmount = isReq ? (selectedRecord.data as RedemptionRequest).valor / 0.75 : (selectedRecord.data as CashbackTransaction).amount;
              let netAmount = isReq ? (selectedRecord.data as RedemptionRequest).valor : ((selectedRecord.data as CashbackTransaction).netAmount || (grossAmount * 0.75));
              let status = selectedRecord.data.status;

              return (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Tipo de Operação</span>
                    <div className="mt-1">
                      {isWithdrawal ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 bg-sky-100 px-2.5 py-1 rounded-lg">
                          <ArrowUpRight size={14} /> Saque Pix (SAC)
                        </span>
                      ) : isDiscount ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-yellow-800 bg-yellow-100 px-2.5 py-1 rounded-lg">
                          <Ticket size={14} /> Cupom de Desconto
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                          <ArrowDownLeft size={14} /> Acúmulo de Crédito
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Status do Registro</span>
                    <div className="mt-1">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg ${
                        status === "Pago" || status === "Aprovado"
                          ? "bg-emerald-100 text-emerald-800"
                          : status === "Aberto" || status === "Pendente"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }`}>
                        <ShieldCheck size={14} />
                        {status === "Pago" ? "Pago e Finalizado" : status === "Aprovado" ? "Aprovado" : status === "Aberto" ? "Pendente de Pagamento" : status}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase">
                      {isWithdrawal ? "Valor Líquido Pix" : "Valor do Crédito"}
                    </span>
                    <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                      {isWithdrawal ? (
                        <span className="text-emerald-600">
                          R$ {netAmount.toFixed(2).replace(".", ",")}
                        </span>
                      ) : (
                        <span>
                          R$ {grossAmount.toFixed(2).replace(".", ",")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Section 1: Customer Data */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <User size={15} className="text-slate-500" /> Dados do Solicitante / Cliente
              </h4>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Nome Completo:</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {selectedRecord.type === "request" 
                      ? (selectedRecord.data as RedemptionRequest).fornecedor
                      : (selectedRecord.data as CashbackTransaction).userName || "Cliente"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block font-medium">E-mail de Contato:</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <Mail size={12} className="text-slate-400 shrink-0" />
                    {selectedRecord.data.userEmail || "Não cadastrado"}
                  </span>
                </div>

                {selectedRecord.data.userPhone && (
                  <div>
                    <span className="text-slate-400 block font-medium">Telefone / WhatsApp:</span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1">
                      <Phone size={12} className="text-slate-400 shrink-0" />
                      {selectedRecord.data.userPhone}
                    </span>
                  </div>
                )}

                {selectedRecord.data.userId && (
                  <div>
                    <span className="text-slate-400 block font-medium">ID de Usuário no App:</span>
                    <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                      {selectedRecord.data.userId}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Specific Details for Pix Withdrawal (SAC) or Discount Code */}
            {(() => {
              const isReq = selectedRecord.type === "request";
              const isWithdrawal = isReq || (selectedRecord.data as CashbackTransaction).type === "withdrawal";
              const isDiscount = !isReq && (selectedRecord.data as CashbackTransaction).type === "discount";

              if (isWithdrawal) {
                const reqData = selectedRecord.data as any;
                let pixKey = reqData.pixKey;
                let pixKeyType = reqData.pixKeyType;
                let pixPhone = reqData.pixPhone;
                let obs = reqData.observacoes || "";

                // Fallback parse from observacoes string if direct field is missing
                if (!pixKey && obs) {
                  pixKey = obs.split('|')[0]?.replace('Chave Pix:', '').trim();
                }

                const grossVal = isReq ? reqData.valor / 0.75 : reqData.amount;
                const netVal = isReq ? reqData.valor : (reqData.netAmount || grossVal * 0.75);
                const feeVal = grossVal * 0.25;

                return (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-sky-700 uppercase tracking-wider flex items-center gap-1.5">
                      <QrCode size={15} className="text-sky-600" /> Detalhamento do Resgate Pix (SAC)
                    </h4>
                    
                    <div className="bg-sky-50/60 border border-sky-200/80 rounded-2xl p-4 space-y-4">
                      
                      {/* Chave Pix Box */}
                      <div className="bg-white border border-sky-100 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                        <div>
                          <span className="text-[11px] font-bold text-sky-800 uppercase">
                            Chave Pix Cadastrada pelo Cliente ({pixKeyType || "Pix"})
                          </span>
                          <div className="font-mono text-base font-extrabold text-slate-900 mt-0.5 tracking-wide">
                            {pixKey || "Chave não informada no registro"}
                          </div>
                        </div>
                        {pixKey && (
                          <button
                            onClick={() => handleCopyText(pixKey, "pixKey")}
                            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            {copiedField === "pixKey" ? (
                              <>
                                <CheckCheck size={14} />
                                <span>Chave Copiada!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={14} />
                                <span>Copiar Chave Pix</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Phone for Receipt */}
                      {pixPhone && (
                        <div className="flex items-center gap-2 text-xs text-sky-900">
                          <Phone size={14} className="text-sky-600 shrink-0" />
                          <span>Telefone informado para envio de comprovante: <strong>{pixPhone}</strong></span>
                        </div>
                      )}

                      {/* Financial Calculation Breakdown */}
                      <div className="border-t border-sky-200/60 pt-3 space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Valor bruto de cashback retido no painel:</span>
                          <span className="font-semibold text-slate-800">R$ {grossVal.toFixed(2).replace(".", ",")}</span>
                        </div>
                        <div className="flex justify-between text-red-600">
                          <span>Desconto de Taxa Operacional / Administrativa (25%):</span>
                          <span className="font-semibold">- R$ {feeVal.toFixed(2).replace(".", ",")}</span>
                        </div>
                        <div className="flex justify-between font-bold text-emerald-700 pt-1 border-t border-sky-200/40 text-sm">
                          <span>Valor Líquido a ser transferido via Pix (75%):</span>
                          <span className="bg-emerald-100/80 px-2 py-0.5 rounded text-emerald-900 font-extrabold">
                            R$ {netVal.toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              if (isDiscount) {
                const txData = selectedRecord.data as CashbackTransaction;
                const couponCode = txData.code || "CUPOM-INDISPONIVEL";

                return (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-yellow-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Ticket size={15} className="text-yellow-700" /> Detalhamento do Cupom de Desconto em Compras
                    </h4>

                    <div className="bg-yellow-50/60 border border-yellow-200 rounded-2xl p-4 space-y-3">
                      <div className="bg-white border border-yellow-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                        <div>
                          <span className="text-[11px] font-bold text-yellow-800 uppercase block">
                            Código Promocional de Desconto
                          </span>
                          <span className="font-mono text-xl font-extrabold text-slate-900 tracking-wider">
                            {couponCode}
                          </span>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Utilizável para abater R$ {txData.amount.toFixed(2).replace(".", ",")} nas compras de produtos e serviços do app.
                          </p>
                        </div>
                        <button
                          onClick={() => handleCopyText(couponCode, "couponCode")}
                          className="px-3.5 py-2 bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                        >
                          {copiedField === "couponCode" ? (
                            <>
                              <CheckCheck size={14} />
                              <span>Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={14} />
                              <span>Copiar Código</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              // Standard Earning Cashback
              const txData = selectedRecord.data as CashbackTransaction;
              return (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Coins size={15} className="text-emerald-600" /> Detalhamento do Acúmulo de Cashback
                  </h4>
                  <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Descrição da Origem:</span>
                      <span className="font-semibold text-slate-800">{txData.description}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Valor Acumulado no Saldo:</span>
                      <span className="font-bold text-emerald-700 text-sm">+ R$ {txData.amount.toFixed(2).replace(".", ",")}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Section 3: Technical & Processing Log */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={15} className="text-slate-500" /> Histórico & Auditoria
              </h4>
              <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 text-xs space-y-2 text-slate-600">
                <div className="flex justify-between items-center">
                  <span>Data e Hora de Inclusão:</span>
                  <span className="font-semibold font-mono text-slate-800">
                    {(() => {
                      const d = (selectedRecord.data as any).date || (selectedRecord.data as any).dataInclusao || (selectedRecord.data as any).dataCriacao;
                      if (!d) return "-";
                      return new Date(d.includes("T") ? d : d + "T12:00:00").toLocaleString("pt-BR");
                    })()}
                  </span>
                </div>

                {(selectedRecord.data as RedemptionRequest).pagoEm && (
                  <div className="flex justify-between items-center text-emerald-700 font-medium">
                    <span>Data do Pagamento Pix Realizado:</span>
                    <span className="font-bold font-mono">
                      {new Date((selectedRecord.data as RedemptionRequest).pagoEm + "T12:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-slate-200/60">
                  <span>Descrição Técnica / Observações:</span>
                  <span className="font-mono text-[11px] text-slate-700 max-w-[280px] truncate">
                    {(selectedRecord.data as any).observacoes || (selectedRecord.data as any).description || "Sem observações adicionais"}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100 justify-end">
              
              <button
                type="button"
                onClick={() => {
                  const summary = `
REGISTRO DE CASHBACK #${selectedRecord.data.id}
Cliente: ${selectedRecord.type === "request" ? (selectedRecord.data as RedemptionRequest).fornecedor : (selectedRecord.data as CashbackTransaction).userName}
Status: ${selectedRecord.data.status}
Valor: R$ ${(selectedRecord.data as any).valor || (selectedRecord.data as any).amount}
Chave Pix: ${(selectedRecord.data as any).pixKey || (selectedRecord.data as any).observacoes || "N/A"}
Cupom: ${(selectedRecord.data as any).code || "N/A"}
                  `.trim();
                  handleCopyText(summary, "fullSummary");
                }}
                className="py-2.5 px-4 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                {copiedField === "fullSummary" ? (
                  <>
                    <CheckCheck size={14} className="text-emerald-600" />
                    <span>Resumo Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copiar Resumo dos Dados</span>
                  </>
                )}
              </button>

              {/* Action Button to Approve Pix directly from modal if pending */}
              {selectedRecord.type === "request" && (selectedRecord.data as RedemptionRequest).status === "Aberto" && (
                <button
                  type="button"
                  onClick={() => handleApproveRequest(selectedRecord.data as RedemptionRequest)}
                  className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Check size={16} />
                  <span>Aprovar Reembolso Pix Agora</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
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
