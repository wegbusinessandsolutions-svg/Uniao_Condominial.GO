import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Package, Truck, CheckCircle2, Clock, Calendar, Wrench, 
  FileText, ChevronRight, ArrowRight, Sparkles, ShoppingBag, 
  Eye, RefreshCw, AlertCircle, ShieldCheck, MapPin, Check, 
  Layers, ExternalLink, ChevronDown, ChevronUp
} from "lucide-react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { CONFIG } from "../../lib/ecommerceFlow";

interface DashboardLiveTrackerProps {
  isAfiliado?: boolean;
}

export const DashboardLiveTracker: React.FC<DashboardLiveTrackerProps> = ({ isAfiliado }) => {
  const { profile, user } = useAuth();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [ordens, setOrdens] = useState<any[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(true);
  const [loadingOrdens, setLoadingOrdens] = useState(true);
  const [activeTab, setActiveTab] = useState<"todos" | "pedidos" | "ordens">("todos");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // 0. Real-time listener for Product Catalog (for accurate item prices)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "produtos"),
      (snapshot) => {
        const prods = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setCatalogProducts(prods);
      },
      (err) => {
        console.warn("Erro ao escutar catálogo no dashboard tracker:", err);
      }
    );
    return () => unsub();
  }, []);

  // 1. Real-time listener for Product Orders (pedidos_venda)
  useEffect(() => {
    const customerEmail = profile?.email || user?.email;
    if (!customerEmail && !user?.uid) {
      setLoadingPedidos(false);
      return;
    }

    let qOrders;
    if (customerEmail) {
      qOrders = query(
        collection(db, "pedidos_venda"),
        where("cliente.email", "==", customerEmail)
      );
    } else {
      qOrders = query(
        collection(db, "pedidos_venda"),
        where("clienteId", "==", user?.uid)
      );
    }

    const unsubscribe = onSnapshot(
      qOrders,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          firebaseId: d.id,
          ...d.data(),
        }));

        list.sort(
          (a: any, b: any) =>
            new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
        );

        setPedidos(list);
        setLoadingPedidos(false);
      },
      (err) => {
        console.warn("Erro ao escutar pedidos no dashboard:", err);
        setLoadingPedidos(false);
      }
    );

    return () => unsubscribe();
  }, [profile?.email, user?.uid, user?.email]);

  // 2. Real-time listener for Service Orders (ordens_servico)
  useEffect(() => {
    const customerUid = profile?.uid || user?.uid;
    const customerEmail = profile?.email || user?.email;
    if (!customerUid && !customerEmail) {
      setLoadingOrdens(false);
      return;
    }

    let qOS;
    if (customerUid) {
      qOS = query(
        collection(db, "ordens_servico"),
        where("clienteId", "==", customerUid)
      );
    } else {
      qOS = query(
        collection(db, "ordens_servico"),
        where("clienteEmail", "==", customerEmail)
      );
    }

    const unsubscribe = onSnapshot(
      qOS,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        list.sort((a: any, b: any) => {
          const dateA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
          const dateB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });

        setOrdens(list);
        setLoadingOrdens(false);
      },
      (err) => {
        console.warn("Erro ao escutar ordens de serviço no dashboard:", err);
        setLoadingOrdens(false);
      }
    );

    return () => unsubscribe();
  }, [profile?.uid, user?.uid, profile?.email, user?.email]);

  // Helper: Format Dates
  const formatDate = (val: any) => {
    if (!val) return "—";
    if (typeof val === "object" && typeof val.seconds === "number") {
      return new Date(val.seconds * 1000).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    } catch {
      // ignore
    }
    return String(val);
  };

  // Helper: Format Currency
  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  // Status mapping for product orders
  const getPedidoStatusInfo = (rawStatus: string) => {
    switch (rawStatus) {
      case "Novo":
      case "AGUARDANDO_CONFERENCIA":
      case "Aguardando":
        return {
          label: "Aguardando Confirmação",
          step: 1,
          badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
          icon: <Clock size={14} className="text-blue-600 animate-pulse" />,
          desc: "Pedido recebido e aguardando processamento da central.",
        };
      case "EM_CONFERENCIA":
      case "Em Separação":
      case "Em Conferencia":
        return {
          label: "Em Separação no Estoque",
          step: 2,
          badgeBg: "bg-amber-50 text-amber-800 border-amber-200",
          icon: <Package size={14} className="text-amber-600" />,
          desc: "Itens sendo separados e conferidos no Centro de Distribuição.",
        };
      case "CONFERIDO":
      case "Aprovado":
      case "APROVADO_PARA_FATURAMENTO":
      case "FATURADO":
      case "Faturado":
        return {
          label: "Faturado (NF-e Emitida)",
          step: 3,
          badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
          icon: <FileText size={14} className="text-purple-600" />,
          desc: "Nota fiscal emitida e produtos embalados para envio.",
        };
      case "DESPACHADO":
      case "Despachado":
      case "Em trânsito":
      case "Em Rota de Entrega":
      case "Saiu para Entrega":
        return {
          label: "Em Rota de Entrega",
          step: 4,
          badgeBg: "bg-sky-50 text-sky-700 border-sky-200",
          icon: <Truck size={14} className="text-sky-600 animate-bounce" />,
          desc: "Entregador a caminho do endereço do seu condomínio.",
        };
      case "Entregue":
      case "ENTREGUE":
      case "Finalizado":
        return {
          label: "Entregue com Sucesso",
          step: 5,
          badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-200",
          icon: <CheckCircle2 size={14} className="text-emerald-600" />,
          desc: "Mercadorias entregues e recebidas na portaria/administração.",
        };
      case "Cancelado":
      case "REJEITADO_PELA_EXPEDICAO":
      case "Devolvido":
        return {
          label: "Cancelado",
          step: 0,
          badgeBg: "bg-rose-50 text-rose-700 border-rose-200",
          icon: <AlertCircle size={14} className="text-rose-600" />,
          desc: "Pedido cancelado ou estornado.",
        };
      default:
        return {
          label: rawStatus || "Em Processamento",
          step: 1,
          badgeBg: "bg-slate-100 text-slate-700 border-slate-200",
          icon: <Clock size={14} />,
          desc: "Processando informações do pedido.",
        };
    }
  };

  // Status mapping for service orders
  const getOSStatusInfo = (rawStatus: string) => {
    const sLower = (rawStatus || "").toLowerCase();
    if (sLower.includes("aguardando") || sLower.includes("solicitado") || sLower.includes("pendente") || sLower === "novo") {
      return {
        label: "Aguardando confirmação - Data",
        step: 1,
        badgeBg: "bg-amber-50 text-amber-900 border-amber-300",
        icon: <Clock size={14} className="text-amber-600 animate-pulse" />,
        desc: "Solicitação recebida com data de preferência. Aguardando confirmação da data.",
      };
    }

    switch (rawStatus) {
      case "Confirmada a Visita":
      case "Agendado":
      case "Em Análise":
        return {
          label: "Visita Agendada",
          step: 2,
          badgeBg: "bg-sky-50 text-sky-700 border-sky-200",
          icon: <Calendar size={14} className="text-sky-600" />,
          desc: "Data confirmada para visita técnica e execução no condomínio.",
        };
      case "Em Execução":
      case "Em Andamento":
        return {
          label: "Em Execução",
          step: 3,
          badgeBg: "bg-amber-50 text-amber-800 border-amber-200",
          icon: <Wrench size={14} className="text-amber-600" />,
          desc: "Técnicos executando os serviços solicitados nas dependências.",
        };
      case "Serviço Concluído":
      case "Finalizado":
        return {
          label: "Serviço Concluído",
          step: 4,
          badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-200",
          icon: <CheckCircle2 size={14} className="text-emerald-600" />,
          desc: "Ordem de serviço finalizada com termo de entrega e garantia.",
        };
      case "Cancelada pelo Cliente":
      case "Cancelado":
        return {
          label: "Cancelada",
          step: 0,
          badgeBg: "bg-rose-50 text-rose-700 border-rose-200",
          icon: <AlertCircle size={14} className="text-rose-600" />,
          desc: "Ordem de serviço cancelada a pedido do condomínio.",
        };
      default:
        return {
          label: rawStatus || "Em Análise",
          step: 1,
          badgeBg: "bg-slate-100 text-slate-700 border-slate-200",
          icon: <FileText size={14} />,
          desc: "Em processamento com o departamento comercial.",
        };
    }
  };

  // Helper robusto para converter qualquer formato de número ou moeda para number
  const parseNum = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    if (typeof val === "string") {
      const cleaned = val.replace(/[^\d.,-]/g, "").trim();
      if (!cleaned) return 0;
      if (cleaned.includes(",") && cleaned.includes(".")) {
        return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
      }
      if (cleaned.includes(",")) {
        return parseFloat(cleaned.replace(",", ".")) || 0;
      }
      return parseFloat(cleaned) || 0;
    }
    return 0;
  };

  const getPedidoItens = (pedido: any): any[] => {
    if (!pedido) return [];
    if (Array.isArray(pedido.itens) && pedido.itens.length > 0) return pedido.itens;
    if (Array.isArray(pedido.items) && pedido.items.length > 0) return pedido.items;
    if (Array.isArray(pedido.produtos) && pedido.produtos.length > 0) return pedido.produtos;
    if (Array.isArray(pedido.carrinho) && pedido.carrinho.length > 0) return pedido.carrinho;
    return [];
  };

  const getItemUnitPriceTracker = (item: any): number => {
    if (!item) return 0;
    const candidates = [
      item.valorUnitario,
      item.precoAplicado,
      item.precoUnitario,
      item.precoOriginal,
      item.precoVenda,
      item.preco,
      item.valor_unitario,
      item.preco_unitario,
      item.vlUnitario,
      item.vUnit,
      item.unitario,
      item.unitPrice,
      item.price,
      item.precoPromocional,
      item.precoBronze,
      item.precoPrata,
      item.precoOuro,
      item.precoDiamante,
      item.produto?.preco,
      item.produto?.precoVenda,
      item.produto?.valorUnitario,
    ];

    for (const cand of candidates) {
      const val = parseNum(cand);
      if (val > 0) return val;
    }

    const tot = parseNum(item.valorTotal ?? item.total ?? item.totalItem ?? item.subtotal ?? item.vlTotal ?? item.vProd ?? item.valor);
    const q = parseNum(item.quantidade ?? item.qtd ?? item.quantity ?? 1) || 1;
    if (tot > 0 && q > 0) {
      return tot / q;
    }

    // Catalog lookup fallback
    if (catalogProducts && catalogProducts.length > 0) {
      const itemCode = String(item.codigo || item.sku || item.id || "").trim().toLowerCase();
      const itemDesc = String(item.descricao || item.nome || "").trim().toLowerCase();

      const match = catalogProducts.find((p: any) => {
        const pId = String(p.id || "").trim().toLowerCase();
        const pSku = String(p.sku || "").trim().toLowerCase();
        const pNome = String(p.nome || "").trim().toLowerCase();
        return (
          (itemCode && (pId === itemCode || pSku === itemCode)) ||
          (itemDesc && (pNome === itemDesc || pNome.includes(itemDesc) || itemDesc.includes(pNome)))
        );
      });

      if (match) {
        let tierPrice = 0;
        if (profile?.level === "Bronze") tierPrice = parseNum(match.precoBronze);
        else if (profile?.level === "Prata") tierPrice = parseNum(match.precoPrata);
        else if (profile?.level === "Ouro") tierPrice = parseNum(match.precoOuro);
        else if (profile?.level === "Diamante") tierPrice = parseNum(match.precoDiamante);

        if (tierPrice > 0) return tierPrice;

        const possible = [
          parseNum(match.precoPromocional),
          parseNum(match.precoVenda),
          parseNum(match.preco),
          parseNum(match.precoBronze),
          parseNum(match.precoPrata),
          parseNum(match.precoOuro),
          parseNum(match.precoDiamante),
          parseNum(match.precoMinimo),
        ].filter((p) => p > 0);

        if (possible.length > 0) return possible[0];
      }
    }

    return parseNum(item.valor);
  };

  const getPedidoTotal = (pedido: any) => {
    if (pedido?.totais?.totalPedido !== undefined && parseNum(pedido.totais.totalPedido) > 0) {
      return parseNum(pedido.totais.totalPedido);
    }
    if (pedido?.totalPedido !== undefined && parseNum(pedido.totalPedido) > 0) {
      return parseNum(pedido.totalPedido);
    }
    if (pedido?.pagamento?.valor !== undefined && parseNum(pedido.pagamento.valor) > 0) {
      return parseNum(pedido.pagamento.valor);
    }
    if (pedido?.valorTotal !== undefined && parseNum(pedido.valorTotal) > 0) {
      return parseNum(pedido.valorTotal);
    }
    const itens = getPedidoItens(pedido);
    if (itens.length > 0) {
      const sub = itens.reduce((s: number, i: any) => {
        const q = parseNum(i.quantidade ?? i.qtd ?? 1) || 1;
        const u = getItemUnitPriceTracker(i);
        const tot = parseNum(i.valorTotal ?? i.total ?? i.totalItem ?? i.subtotal);
        return s + (tot > 0 ? tot : q * u);
      }, 0);
      return sub + parseNum(pedido.frete?.valor || pedido.totais?.totalFrete || pedido.valorFrete || 0);
    }
    return 0;
  };

  // Active / Ongoing items filter
  const activePedidos = pedidos.filter(
    (p) =>
      p.status !== "Entregue" &&
      p.status !== "ENTREGUE" &&
      p.status !== "Finalizado" &&
      p.status !== "Cancelado" &&
      p.status !== "REJEITADO_PELA_EXPEDICAO" &&
      p.status !== "Devolvido"
  );

  const activeOrdens = ordens.filter(
    (o) =>
      o.status !== "Serviço Concluído" &&
      o.status !== "Finalizado" &&
      o.status !== "Cancelada pelo Cliente" &&
      o.status !== "Cancelado"
  );

  const hasAnyData = pedidos.length > 0 || ordens.length > 0;
  const hasActiveItems = activePedidos.length > 0 || activeOrdens.length > 0;
  const isLoading = loadingPedidos || loadingOrdens;

  return (
    <div className="space-y-4">
      {/* Top Header Card with Quick Stats and Filter Pills */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0071e3] to-sky-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight">
                  Painel de Acompanhamento
                </h3>
                {hasActiveItems && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Em Tempo Real
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                Rastreamento instantâneo de pedidos de compras e ordens de serviço
              </p>
            </div>
          </div>

          {/* Quick Tab Filters */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80 self-start sm:self-auto overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab("todos")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "todos"
                  ? "bg-white text-slate-900 shadow-3xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Todos ({pedidos.length + ordens.length})
            </button>
            <button
              onClick={() => setActiveTab("pedidos")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === "pedidos"
                  ? "bg-white text-[#0071e3] shadow-3xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ShoppingBag size={13} />
              Pedidos ({pedidos.length})
              {activePedidos.length > 0 && (
                <span className="bg-[#0071e3] text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {activePedidos.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("ordens")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === "ordens"
                  ? "bg-white text-sky-700 shadow-3xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Wrench size={13} />
              Serviços ({ordens.length})
              {activeOrdens.length > 0 && (
                <span className="bg-sky-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {activeOrdens.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 animate-pulse space-y-4">
            <div className="h-4 bg-slate-200 rounded w-1/3" />
            <div className="h-10 bg-slate-100 rounded-2xl" />
            <div className="h-20 bg-slate-50 rounded-2xl" />
          </div>
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 animate-pulse space-y-4">
            <div className="h-4 bg-slate-200 rounded w-1/3" />
            <div className="h-10 bg-slate-100 rounded-2xl" />
            <div className="h-20 bg-slate-50 rounded-2xl" />
          </div>
        </div>
      ) : !hasAnyData ? (
        /* Empty State: No Orders or Service Requests yet */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card to Make First Purchase */}
          <div className="bg-gradient-to-br from-white to-blue-50/40 border border-blue-200/80 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-blue-300 transition-all">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-[#0071e3] flex items-center justify-center shadow-3xs group-hover:scale-105 transition-transform">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                  Loja Direta
                </span>
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-black text-slate-900">
                  Nenhum pedido de produtos no momento
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                  Adquira produtos químicos profissionais, sacos para lixo, papéis e equipamentos para seu condomínio com tabela exclusiva.
                </p>
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-blue-100/80">
              <Link
                to="/produtos"
                className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 bg-[#0071e3] hover:bg-[#005bb5] text-white font-bold rounded-2xl text-xs sm:text-sm shadow-sm transition-all active:scale-98"
              >
                <span>Conhecer Catálogo de Produtos</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          {/* Card to Request First Service */}
          <div className="bg-gradient-to-br from-white to-emerald-50/40 border border-emerald-200/80 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-emerald-300 transition-all">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-3xs group-hover:scale-105 transition-transform">
                  <Wrench className="w-6 h-6" />
                </div>
                {isAfiliado ? (
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full border border-emerald-300">
                    50% OFF para Afiliados
                  </span>
                ) : (
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                    Serviços Rotineiros
                  </span>
                )}
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-black text-slate-900">
                  Nenhuma ordem de serviço aberta
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                  Precisa de limpeza de caixas d'água, higienização de caixas de gordura, jardinagem ou manutenção predial? Abra uma O.S. online.
                </p>
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-emerald-100/80">
              <Link
                to="/cliente/servicos"
                className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-sm transition-all active:scale-98"
              >
                <span>Solicitar Ordem de Serviço</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Main Active Feed: Displays Active and Recent Orders & OS */
        <div className="space-y-4">
          {/* Section 1: Product Orders (pedidos_venda) */}
          {(activeTab === "todos" || activeTab === "pedidos") && pedidos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-[#0071e3] flex items-center justify-center text-xs font-bold">
                    <ShoppingBag size={14} />
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                    Pedidos de Produtos ({pedidos.length})
                  </h4>
                </div>
                <Link
                  to="/cliente/pedidos"
                  className="text-xs font-bold text-[#0071e3] hover:underline flex items-center gap-1"
                >
                  <span>Ver todos em Meus Pedidos</span>
                  <ChevronRight size={13} />
                </Link>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pedidos.slice(0, 4).map((pedido) => {
                  const statusInfo = getPedidoStatusInfo(pedido.status);
                  const total = getPedidoTotal(pedido);
                  const orderNum =
                    pedido.id_externo ||
                    pedido.numero ||
                    (pedido.numeroPedido ? `#${pedido.numeroPedido}` : `#${pedido.firebaseId.slice(-6).toUpperCase()}`);
                  const isExpanded = expandedItemId === `order-${pedido.firebaseId}`;

                  return (
                    <div
                      key={pedido.firebaseId}
                      className={`bg-white border rounded-3xl p-5 shadow-xs transition-all hover:shadow-md flex flex-col justify-between ${
                        statusInfo.step > 0 && statusInfo.step < 5
                          ? "border-blue-200/90 ring-1 ring-blue-100"
                          : "border-slate-200/80"
                      }`}
                    >
                      <div>
                        {/* Order Header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0071e3] flex items-center justify-center font-bold text-sm shrink-0 border border-blue-100">
                              <ShoppingBag size={18} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-slate-900 text-sm">
                                  {orderNum}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 font-medium">
                                Realizado em {formatDate(pedido.dataHora || pedido.createdAt)}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${statusInfo.badgeBg}`}
                          >
                            {statusInfo.icon}
                            {statusInfo.label}
                          </span>
                        </div>

                        {/* Visual Progress Steps */}
                        <div className="my-4 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-extrabold text-slate-700">
                              Etapa Atual do Pedido:
                            </span>
                            <span className="text-[11px] font-bold text-[#0071e3]">
                              {statusInfo.step === 5 ? "100% Concluído" : `Etapa ${statusInfo.step} de 4`}
                            </span>
                          </div>

                          {/* 4-Step Progress Bar */}
                          <div className="grid grid-cols-4 gap-1.5 mb-2">
                            {[
                              { step: 1, label: "Recebido" },
                              { step: 2, label: "Separação" },
                              { step: 3, label: "Faturado" },
                              { step: 4, label: "Em Rota" },
                            ].map((s) => {
                              const isCompleted = statusInfo.step >= s.step || statusInfo.step === 5;
                              const isCurrent = statusInfo.step === s.step;

                              return (
                                <div key={s.step} className="space-y-1">
                                  <div
                                    className={`h-1.5 rounded-full transition-all ${
                                      isCompleted
                                        ? "bg-[#0071e3]"
                                        : "bg-slate-200"
                                    } ${isCurrent ? "animate-pulse" : ""}`}
                                  />
                                  <span
                                    className={`text-[9px] font-bold block text-center truncate ${
                                      isCompleted ? "text-slate-900" : "text-slate-400"
                                    }`}
                                  >
                                    {s.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          <p className="text-[11px] text-slate-500 leading-snug mt-1">
                            {statusInfo.desc}
                          </p>
                        </div>

                        {/* Order Summary Specs */}
                        <div className="flex items-center justify-between text-xs py-2 px-1 border-t border-slate-100">
                          <div className="text-slate-600">
                            <span>Itens: </span>
                            <strong className="text-slate-900">
                              {getPedidoItens(pedido).length} produto(s)
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Total: </span>
                            <strong className="text-slate-900 font-extrabold text-sm text-[#0071e3]">
                              {formatCurrency(total)}
                            </strong>
                          </div>
                        </div>

                        {/* Inline Item Peek Toggle */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                              Produtos no Pedido:
                            </p>
                            <div className="space-y-1.5 max-h-36 overflow-y-auto">
                              {getPedidoItens(pedido).map((it: any, iIdx: number) => {
                                const q = parseNum(it.quantidade ?? it.qtd ?? 1) || 1;
                                const u = getItemUnitPriceTracker(it);
                                const itemTot = parseNum(it.valorTotal ?? it.total ?? it.totalItem ?? it.subtotal) || (q * u);

                                return (
                                  <div
                                    key={iIdx}
                                    className="flex items-center justify-between gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100"
                                  >
                                    <div className="min-w-0 pr-2">
                                      <p className="text-slate-800 font-bold truncate max-w-[180px]" title={it.descricao || it.nome}>
                                        {it.descricao || it.nome || "Produto"}
                                      </p>
                                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                                        {q}x {formatCurrency(u)}
                                      </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className="text-slate-900 font-black text-xs">
                                        {formatCurrency(itemTot)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-100">
                        <button
                          onClick={() =>
                            setExpandedItemId(
                              isExpanded ? null : `order-${pedido.firebaseId}`
                            )
                          }
                          className="text-[11px] font-bold text-slate-600 hover:text-slate-900 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp size={13} />
                              Ocultar itens
                            </>
                          ) : (
                            <>
                              <ChevronDown size={13} />
                              Ver itens ({pedido.itens?.length || 0})
                            </>
                          )}
                        </button>

                        <Link
                          to="/cliente/pedidos"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-[#0071e3] text-[#0071e3] hover:text-white text-xs font-bold transition-all shadow-3xs"
                        >
                          <span>Acompanhar Pedido</span>
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Service Orders (ordens_servico) */}
          {(activeTab === "todos" || activeTab === "ordens") && ordens.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold">
                    <Wrench size={14} />
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                    Ordens de Serviço ({ordens.length})
                  </h4>
                </div>
                <Link
                  to="/cliente/ordens-servico"
                  className="text-xs font-bold text-sky-700 hover:underline flex items-center gap-1"
                >
                  <span>Ver todas em Minhas O.S.</span>
                  <ChevronRight size={13} />
                </Link>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {ordens.slice(0, 4).map((os) => {
                  const statusInfo = getOSStatusInfo(os.status);
                  const osNumber = `#OS-${os.id.slice(-6).toUpperCase()}`;
                  const isExpanded = expandedItemId === `os-${os.id}`;

                  return (
                    <div
                      key={os.id}
                      className={`bg-white border rounded-3xl p-5 shadow-xs transition-all hover:shadow-md flex flex-col justify-between ${
                        statusInfo.step > 0 && statusInfo.step < 4
                          ? "border-sky-200/90 ring-1 ring-sky-100"
                          : "border-slate-200/80"
                      }`}
                    >
                      <div>
                        {/* OS Header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold text-sm shrink-0 border border-sky-100">
                              <Wrench size={18} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-slate-900 text-sm">
                                  {osNumber}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 font-medium">
                                Solicitado em {formatDate(os.createdAt)}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${statusInfo.badgeBg}`}
                          >
                            {statusInfo.icon}
                            {statusInfo.label}
                          </span>
                        </div>

                        {/* Service Title */}
                        <div className="my-2">
                          <h5 className="font-extrabold text-slate-900 text-sm leading-snug">
                            {os.servicoNome || os.itens?.[0]?.nome || "Serviço Condominial"}
                          </h5>
                          {os.dataConfirmada || os.dataAgendada ? (
                            <p className="text-xs text-emerald-700 flex items-center gap-1 mt-1 font-bold">
                              <Calendar size={12} className="text-emerald-600" />
                              <span>Visita Confirmada: {os.dataConfirmada || os.dataAgendada} {os.turnoAgendado ? `(${os.turnoAgendado})` : ''}</span>
                            </p>
                          ) : os.dataPreferencial ? (
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1 font-medium">
                              <Calendar size={12} className="text-sky-600" />
                              <span>Data preferencial: {os.dataPreferencial}</span>
                            </p>
                          ) : null}
                        </div>

                        {/* Visual Progress Steps */}
                        <div className="my-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-extrabold text-slate-700">
                              Progresso do Atendimento:
                            </span>
                            <span className="text-[11px] font-bold text-sky-700">
                              {statusInfo.step === 4 ? "Concluído" : `Etapa ${statusInfo.step} de 3`}
                            </span>
                          </div>

                          {/* 3-Step Progress Bar */}
                          <div className="grid grid-cols-3 gap-1.5 mb-2">
                            {[
                              { step: 1, label: "Solicitação" },
                              { step: 2, label: "Agendamento" },
                              { step: 3, label: "Execução" },
                            ].map((s) => {
                              const isCompleted = statusInfo.step >= s.step || statusInfo.step === 4;
                              const isCurrent = statusInfo.step === s.step;

                              return (
                                <div key={s.step} className="space-y-1">
                                  <div
                                    className={`h-1.5 rounded-full transition-all ${
                                      isCompleted
                                        ? "bg-sky-600"
                                        : "bg-slate-200"
                                    } ${isCurrent ? "animate-pulse" : ""}`}
                                  />
                                  <span
                                    className={`text-[9px] font-bold block text-center truncate ${
                                      isCompleted ? "text-slate-900" : "text-slate-400"
                                    }`}
                                  >
                                    {s.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          <p className="text-[11px] text-slate-500 leading-snug">
                            {statusInfo.desc}
                          </p>
                        </div>

                        {/* Price / Items spec */}
                        <div className="flex items-center justify-between text-xs py-2 px-1 border-t border-slate-100">
                          <div className="text-slate-600">
                            {os.itens?.length ? (
                              <span>{os.itens.length} serviço(s)</span>
                            ) : (
                              <span>Serviço único</span>
                            )}
                          </div>
                          <div>
                            <span className="text-slate-500">Valor: </span>
                            <strong className="text-slate-900 font-extrabold text-sm">
                              {formatCurrency(os.valor || os.valorFaturar || os.valorOriginal || 0)}
                            </strong>
                          </div>
                        </div>

                        {/* Inline Item Peek */}
                        {isExpanded && os.observacoes && (
                          <div className="mt-3 pt-3 border-t border-slate-100 bg-sky-50/50 p-2.5 rounded-xl border border-sky-100">
                            <p className="text-[11px] font-bold text-sky-900 mb-1">
                              Observações / Instruções:
                            </p>
                            <p className="text-xs text-slate-700 leading-relaxed">
                              {os.observacoes}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-100">
                        {os.observacoes ? (
                          <button
                            onClick={() =>
                              setExpandedItemId(isExpanded ? null : `os-${os.id}`)
                            }
                            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp size={13} /> Ocultar detalhes
                              </>
                            ) : (
                              <>
                                <ChevronDown size={13} /> Ver instruções
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Atendimento prioritário</span>
                        )}

                        <Link
                          to="/cliente/ordens-servico"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-600 text-sky-700 hover:text-white text-xs font-bold transition-all shadow-3xs"
                        >
                          <span>Acompanhar O.S.</span>
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardLiveTracker;
