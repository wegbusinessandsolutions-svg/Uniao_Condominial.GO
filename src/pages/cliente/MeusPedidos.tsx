import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ShoppingBag, Search, Calendar, MapPin, CreditCard, ChevronDown, ChevronUp, 
  Clock, CheckCircle, X, RefreshCw, Clipboard, QrCode, FileText, Truck, 
  Package, ExternalLink, Printer, ShieldCheck, ArrowRight, Banknote, 
  AlertCircle, ChevronRight, Eye, Check, Tag, Bell, Volume2, Sparkles
} from "lucide-react";
import { collection, onSnapshot, query, getDocs, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { isStaffRole } from "../../lib/permissions";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useToast } from "../../context/ToastContext";
import { CONFIG } from "../../lib/ecommerceFlow";
import { getMercadoPagoConfig, MercadoPagoConfig } from "../../lib/mercadoPago";
import { gerarPixCopiaECola } from "../../lib/documentValidators";

// Helper para normalizar textos para comparações precisas de SKU, ID e Nomes de Produtos
const normalizeCompare = (val: any): string => {
  return String(val || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-–—/._\s]+/g, " ")
    .trim();
};

// Helper robusto para converter qualquer formato de número, objeto ou moeda para number
const parseNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (typeof val === "object") {
    if (val.valorUnitario !== undefined) return parseNumber(val.valorUnitario);
    if (val.precoAplicado !== undefined) return parseNumber(val.precoAplicado);
    if (val.precoOriginal !== undefined) return parseNumber(val.precoOriginal);
    if (val.preco !== undefined) return parseNumber(val.preco);
    if (val.precoVenda !== undefined) return parseNumber(val.precoVenda);
    if (val.valorTotal !== undefined) return parseNumber(val.valorTotal);
    if (val.valor !== undefined) return parseNumber(val.valor);
    if (val.total !== undefined) return parseNumber(val.total);
    if (val.amount !== undefined) return parseNumber(val.amount);
    if (val.value !== undefined) return parseNumber(val.value);
    return 0;
  }
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

const formatBRL = (val: any): string => {
  const num = parseNumber(val);
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

const getPedidoItensList = (pedido: any): any[] => {
  if (!pedido) return [];
  if (Array.isArray(pedido.itens) && pedido.itens.length > 0) return pedido.itens;
  if (Array.isArray(pedido.items) && pedido.items.length > 0) return pedido.items;
  if (Array.isArray(pedido.produtos) && pedido.produtos.length > 0) return pedido.produtos;
  if (Array.isArray(pedido.carrinho) && pedido.carrinho.length > 0) return pedido.carrinho;
  if (Array.isArray(pedido.linhas) && pedido.linhas.length > 0) return pedido.linhas;
  
  // Se estiver salvo como objeto/mapa no Firestore com chaves numéricas
  if (pedido.itens && typeof pedido.itens === "object") {
    const vals = Object.values(pedido.itens);
    if (vals.length > 0) return vals;
  }
  if (pedido.items && typeof pedido.items === "object") {
    const vals = Object.values(pedido.items);
    if (vals.length > 0) return vals;
  }
  if (pedido.produtos && typeof pedido.produtos === "object") {
    const vals = Object.values(pedido.produtos);
    if (vals.length > 0) return vals;
  }
  if (pedido.carrinho && typeof pedido.carrinho === "object") {
    const vals = Object.values(pedido.carrinho);
    if (vals.length > 0) return vals;
  }
  return [];
};

const getItemQuantity = (item: any): number => {
  if (!item) return 1;
  const q = parseNumber(item.quantidade ?? item.qtd ?? item.quantity ?? item.quant ?? item.qnt ?? item.count ?? item.unidades);
  return q > 0 ? q : 1;
};

const getProductPriceFromCatalog = (item: any, catalogProducts?: any[], clientTier?: string): number => {
  if (!item || !catalogProducts || catalogProducts.length === 0) return 0;
  
  const rawCode = String(item.codigo || item.sku || item.id || "").trim();
  const rawDesc = String(item.descricao || item.nome || "").trim();
  const normCode = normalizeCompare(rawCode);
  const normDesc = normalizeCompare(rawDesc);

  // 1. Busca por ID ou SKU exato / normalizado
  let match = catalogProducts.find((p: any) => {
    const pId = String(p.id || "").trim();
    const pSku = String(p.sku || "").trim();
    const normPId = normalizeCompare(pId);
    const normPSku = normalizeCompare(pSku);

    return (
      (rawCode && (pId === rawCode || pSku === rawCode)) ||
      (normCode && (normPId === normCode || normPSku === normCode)) ||
      (item.id && (pId === String(item.id).trim() || pSku === String(item.id).trim())) ||
      (item.sku && (pSku === String(item.sku).trim() || pId === String(item.sku).trim()))
    );
  });

  // 2. Se não achou por código/SKU, busca pelo nome/descrição
  if (!match && normDesc) {
    match = catalogProducts.find((p: any) => {
      const pNome = String(p.nome || "").trim();
      const normPNome = normalizeCompare(pNome);
      return (
        pNome.toLowerCase() === rawDesc.toLowerCase() ||
        normPNome === normDesc ||
        (normDesc.length > 4 && normPNome.includes(normDesc)) ||
        (normPNome.length > 4 && normDesc.includes(normPNome))
      );
    });
  }

  if (match) {
    // 1º Tenta preço pela categoria/nível do cliente
    let tierPrice = 0;
    if (clientTier === "Bronze") tierPrice = parseNumber(match.precoBronze);
    else if (clientTier === "Prata") tierPrice = parseNumber(match.precoPrata);
    else if (clientTier === "Ouro") tierPrice = parseNumber(match.precoOuro);
    else if (clientTier === "Diamante") tierPrice = parseNumber(match.precoDiamante);

    if (tierPrice > 0) return tierPrice;

    // 2º Tenta preços cadastrados no produto
    const candidatePrices = [
      parseNumber(match.precoPromocional),
      parseNumber(match.precoVenda),
      parseNumber(match.preco),
      parseNumber(match.precoBronze),
      parseNumber(match.precoPrata),
      parseNumber(match.precoOuro),
      parseNumber(match.precoDiamante),
      parseNumber(match.precoMinimo),
      parseNumber(match.custoUltimo),
    ].filter((p) => p > 0);

    if (candidatePrices.length > 0) {
      return candidatePrices[0];
    }
  }

  return 0;
};

const getItemUnitPrice = (item: any, pedido?: any, catalogProducts?: any[], clientTier?: string): number => {
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
    item.precoTabela,
    item.precoFinal,
    item.produto?.preco,
    item.produto?.precoVenda,
    item.produto?.precoAplicado,
    item.produto?.precoOriginal,
    item.produto?.valor,
    item.produto?.valorUnitario,
    item.product?.price,
    item.product?.preco,
    item.product?.precoAplicado,
    item.servico?.preco,
    item.servico?.valor,
  ];

  for (const cand of candidates) {
    const val = parseNumber(cand);
    if (val > 0) return val;
  }

  // Se não achou nos campos unitários, mas tem total e quantidade
  const tot = parseNumber(
    item.valorTotal ?? 
    item.total ?? 
    item.totalItem ?? 
    item.subtotal ?? 
    item.vlTotal ?? 
    item.vProd ?? 
    item.valor_total ?? 
    item.valor ?? 
    item.valorFaturar
  );
  const q = getItemQuantity(item);
  if (tot > 0 && q > 0) {
    return tot / q;
  }

  // 3º Consulta no catálogo de produtos do Firestore
  const catalogPrice = getProductPriceFromCatalog(item, catalogProducts, clientTier);
  if (catalogPrice > 0) {
    return catalogPrice;
  }

  // 4º Fallback com base nos totais do pedido
  if (pedido) {
    const itens = getPedidoItensList(pedido);
    const orderTotal = parseNumber(
      pedido.totais?.totalProdutos ?? 
      pedido.totalProdutos ?? 
      pedido.subtotal ?? 
      pedido.valorProdutos ?? 
      pedido.produtosTotal ?? 
      pedido.valorOriginal ?? 
      pedido.totais?.totalPedido ?? 
      pedido.totalPedido ?? 
      pedido.valorTotal ?? 
      pedido.totalGeral ?? 
      pedido.total ?? 
      pedido.pagamento?.valor ?? 
      pedido.valorFaturar ?? 
      pedido.valor
    );

    if (orderTotal > 0 && itens.length > 0) {
      const frete = getFreteValor(pedido);
      const sub = Math.max(0, orderTotal - (pedido.totais?.totalProdutos ? 0 : frete));
      const totalQtd = itens.reduce((sum, it) => sum + getItemQuantity(it), 0);
      if (totalQtd > 0 && sub > 0) {
        return sub / totalQtd;
      }
    }
  }

  return parseNumber(item.valor);
};

const getItemTotal = (item: any, pedido?: any, catalogProducts?: any[], clientTier?: string): number => {
  if (!item) return 0;
  const candidates = [
    item.valorTotal,
    item.total,
    item.totalItem,
    item.subtotal,
    item.vlTotal,
    item.vProd,
    item.valor_total,
    item.valorFaturar,
  ];

  for (const cand of candidates) {
    const val = parseNumber(cand);
    if (val > 0) return val;
  }

  const q = getItemQuantity(item);
  const u = getItemUnitPrice(item, pedido, catalogProducts, clientTier);
  if (q > 0 && u > 0) {
    return q * u;
  }

  if (pedido) {
    const itens = getPedidoItensList(pedido);
    if (itens.length === 1) {
      const sub = getSubtotalProdutos(pedido, catalogProducts, clientTier);
      if (sub > 0) return sub;
    }
  }

  return parseNumber(item.valor);
};

const getFreteValor = (pedido: any): number => {
  if (!pedido) return 0;
  const candidates = [
    pedido.frete?.valor,
    pedido.totais?.totalFrete,
    pedido.valorFrete,
    pedido.valor_frete,
    pedido.freteValor,
    pedido.totalFrete,
    pedido.custoFrete,
    pedido.taxaEntrega,
    typeof pedido.frete === "number" ? pedido.frete : null,
  ];

  for (const cand of candidates) {
    const val = parseNumber(cand);
    if (val > 0) return val;
  }

  return 0;
};

const getSubtotalProdutos = (pedido: any, catalogProducts?: any[], clientTier?: string): number => {
  if (!pedido) return 0;
  const candidates = [
    pedido.totais?.totalProdutos,
    pedido.totalProdutos,
    pedido.subtotal,
    pedido.valorProdutos,
    pedido.subtotalProdutos,
    pedido.produtosTotal,
    pedido.valorOriginal,
  ];

  for (const cand of candidates) {
    const val = parseNumber(cand);
    if (val > 0) return val;
  }

  const itens = getPedidoItensList(pedido);
  if (itens.length > 0) {
    let sum = 0;
    for (const it of itens) {
      const itemTot = parseNumber(it.valorTotal ?? it.total ?? it.totalItem ?? it.subtotal ?? it.vlTotal ?? it.vProd ?? it.valor_total);
      if (itemTot > 0) {
        sum += itemTot;
      } else {
        const q = getItemQuantity(it);
        const u = getItemUnitPrice(it, pedido, catalogProducts, clientTier);
        if (u > 0) {
          sum += q * u;
        }
      }
    }
    if (sum > 0) return sum;
  }

  const total = parseNumber(
    pedido.totais?.totalPedido ?? 
    pedido.totalPedido ?? 
    pedido.valorTotal ?? 
    pedido.valor_total ?? 
    pedido.totalGeral ?? 
    pedido.total ?? 
    pedido.pagamento?.valor ?? 
    pedido.valorFaturar ?? 
    pedido.valor
  );
  const frete = getFreteValor(pedido);
  if (total > 0) {
    return Math.max(0, total - frete);
  }

  return 0;
};

const getTotalGeral = (pedido: any, catalogProducts?: any[], clientTier?: string): number => {
  if (!pedido) return 0;
  const candidates = [
    pedido.totais?.totalPedido,
    pedido.totalPedido,
    pedido.valorTotal,
    pedido.valor_total,
    pedido.totalGeral,
    pedido.total,
    pedido.pagamento?.valor,
    pedido.valorFaturar,
    pedido.valor,
  ];

  for (const cand of candidates) {
    const val = parseNumber(cand);
    if (val > 0) return val;
  }

  const subtotal = getSubtotalProdutos(pedido, catalogProducts, clientTier);
  const frete = getFreteValor(pedido);
  if (subtotal > 0 || frete > 0) {
    return subtotal + frete;
  }

  return 0;
};

export default function MeusPedidos() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { addMultipleToCart } = useCart();
  const { addToast, addOrderToast } = useToast();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPedidoId, setExpandedPedidoId] = useState<string | null>(null);
  const [selectedPedidoModal, setSelectedPedidoModal] = useState<any | null>(null);
  const [repeatingOrderId, setRepeatingOrderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Mercado Pago states
  const [mpConfig, setMpConfig] = useState<MercadoPagoConfig | null>(null);
  const [payingPedido, setPayingPedido] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"17" | "03">("17"); // 17 = PIX, 03 = Card
  const [cardNome, setCardNome] = useState("");
  const [cardNumero, setCardNumero] = useState("");
  const [cardValidade, setCardValidade] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Escuta catálogo de produtos do Firestore para resolução precisa de preços e itens
    const unsubscribeProds = onSnapshot(
      collection(db, "produtos"),
      (snapshot) => {
        const prods = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setCatalogProducts(prods);
      },
      (error) => {
        console.error("Erro ao carregar catálogo para cálculo de pedidos:", error);
      }
    );

    return () => unsubscribeProds();
  }, []);

  useEffect(() => {
    async function loadConfig() {
      const config = await getMercadoPagoConfig();
      setMpConfig(config);
    }
    loadConfig();
  }, []);

  useEffect(() => {
    const userEmail = profile?.email || user?.email;
    const userId = user?.uid;

    if (!userEmail && !userId) {
      setLoading(false);
      return;
    }

    // Escuta pedidos_venda pelo email do cliente ou ID
    const q = userEmail
      ? query(collection(db, "pedidos_venda"), where("cliente.email", "==", userEmail))
      : query(collection(db, "pedidos_venda"), where("clienteId", "==", userId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const customerOrders = snapshot.docs.map((doc) => ({
          firebaseId: doc.id,
          ...doc.data(),
        }));

        // Sort by date (newest first)
        customerOrders.sort(
          (a: any, b: any) =>
            new Date(b.dataHora || b.createdAt || 0).getTime() -
            new Date(a.dataHora || a.createdAt || 0).getTime()
        );

        setPedidos(customerOrders);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading customer orders:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile?.email, user?.email, user?.uid]);

  // Filtered orders
  const filteredPedidos = useMemo(() => {
    return pedidos.filter((pedido) => {
      const orderId = (pedido.id_externo || `PED-${pedido.numero}` || pedido.firebaseId || "").toLowerCase();
      const clientName = (pedido.cliente?.nome || "").toLowerCase();
      const itemsList = getPedidoItensList(pedido);
      const itemsMatch = itemsList.some((it: any) => 
        (it.descricao || it.nome || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (it.codigo || it.sku || it.id || "").toLowerCase().includes(searchTerm.toLowerCase())
      );
      const matchesSearch = orderId.includes(searchTerm.toLowerCase()) || 
                            clientName.includes(searchTerm.toLowerCase()) ||
                            itemsMatch;

      if (!matchesSearch) return false;

      if (statusFilter === "todos") return true;
      if (statusFilter === "aguardando") return pedido.status === CONFIG.STATUS.NOVO;
      if (statusFilter === "separacao") return pedido.status === CONFIG.STATUS.EM_CONFERENCIA || pedido.status === CONFIG.STATUS.CONFERIDO;
      if (statusFilter === "faturado") return pedido.status === CONFIG.STATUS.FATURADO;
      if (statusFilter === "despachado") return pedido.status === CONFIG.STATUS.DESPACHADO;
      return true;
    });
  }, [pedidos, searchTerm, statusFilter]);

  const handlePayWithMercadoPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingPedido || !mpConfig) return;

    if (paymentMethod === "03") {
      if (!cardNome.trim()) {
        alert("Por favor, preencha o nome impresso no cartão.");
        return;
      }
      if (cardNumero.replace(/\D/g, "").length < 16) {
        alert("Número de cartão inválido.");
        return;
      }
      if (!cardValidade.trim()) {
        alert("Digite a validade do cartão.");
        return;
      }
      if (cardCvv.length < 3) {
        alert("Código de segurança (CVV) inválido.");
        return;
      }
    }

    setIsProcessing(true);

    try {
      // In a real environment, the payment gateway webhook would trigger backend logic.
      const success = true; // Simulated success
      if (success) {
        alert("Pagamento processado com sucesso (simulado)! A fatura deverá ser conciliada pelo webhook.");
        setPayingPedido(null);
        setCardNome("");
        setCardNumero("");
        setCardValidade("");
        setCardCvv("");
      } else {
        alert("Houve um erro ao processar seu pagamento. Tente novamente mais tarde.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Falha no pagamento: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRepeatOrder = async (pedido: any) => {
    if (isStaffRole(profile?.role)) {
      alert("Apenas clientes podem realizar compras no aplicativo.");
      return;
    }
    if (!pedido.itens || pedido.itens.length === 0) {
      alert("Este pedido não possui itens para repetir.");
      return;
    }

    setRepeatingOrderId(pedido.firebaseId);

    try {
      // Fetch all products from Firestore to check updated prices
      const prodSnap = await getDocs(collection(db, "produtos"));
      const allProducts = prodSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const itemsToAdd: { product: any; quantity: number }[] = [];

      for (const item of pedido.itens) {
        // Find matching product in catalog
        const foundProduct = allProducts.find(
          (p: any) => p.id === item.codigo || (p.sku && p.sku === item.codigo)
        );

        if (foundProduct) {
          itemsToAdd.push({
            product: foundProduct,
            quantity: item.quantidade
          });
        } else {
          // Fallback to custom product object if not found in catalog (e.g., deleted product)
          const fallbackProduct = {
            id: item.codigo,
            nome: item.descricao,
            precoVenda: item.valorUnitario,
            sku: item.codigo,
            categorias: ["Geral"],
            imagemPrincipal: ""
          };
          itemsToAdd.push({
            product: fallbackProduct,
            quantity: item.quantidade
          });
        }
      }

      if (itemsToAdd.length > 0) {
        await addMultipleToCart(itemsToAdd);
        alert("Todos os itens do pedido foram adicionados ao seu carrinho de compras com valores atualizados com sucesso!");
        navigate("/carrinho");
      } else {
        alert("Não foi possível adicionar os itens ao carrinho.");
      }
    } catch (error: any) {
      console.error("Error repeating order:", error);
      alert("Houve um erro ao repetir o pedido: " + (error.message || error));
    } finally {
      setRepeatingOrderId(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedPedidoId(expandedPedidoId === id ? null : id);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case CONFIG.STATUS.NOVO:
        return "Aguardando Confirmação";
      case CONFIG.STATUS.EM_CONFERENCIA:
        return "Em Separação";
      case CONFIG.STATUS.CONFERIDO:
        return "Aprovado p/ Faturamento";
      case CONFIG.STATUS.FATURADO:
        return "Faturado (Nota Fiscal Emitida)";
      case CONFIG.STATUS.DESPACHADO:
        return "Despachado / Em Rota";
      default:
        return status || "Em processamento";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case CONFIG.STATUS.NOVO:
        return "bg-amber-50 text-amber-700 border-amber-200";
      case CONFIG.STATUS.EM_CONFERENCIA:
        return "bg-purple-50 text-purple-700 border-purple-200";
      case CONFIG.STATUS.CONFERIDO:
        return "bg-teal-50 text-teal-700 border-teal-200";
      case CONFIG.STATUS.FATURADO:
        return "bg-blue-50 text-blue-700 border-blue-200";
      case CONFIG.STATUS.DESPACHADO:
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getPaymentLabel = (forma: string) => {
    switch (forma) {
      case "17":
        return "PIX (Instantâneo)";
      case "15":
        return "Boleto Bancário";
      case "03":
        return "Cartão de Crédito";
      case "01":
        return "Dinheiro";
      default:
        return "Faturamento Direto";
    }
  };

  const getPaymentIcon = (forma: string) => {
    switch (forma) {
      case "17":
        return <QrCode size={15} className="text-emerald-600" />;
      case "15":
        return <FileText size={15} className="text-amber-600" />;
      case "03":
        return <CreditCard size={15} className="text-[#0071e3]" />;
      default:
        return <Banknote size={15} className="text-slate-600" />;
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center text-slate-500 space-y-3">
        <div className="w-10 h-10 border-4 border-[#0071e3] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="font-medium text-slate-600">Carregando seus pedidos...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-3xl shadow-md overflow-hidden">
        <div className="p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-50 via-white to-sky-50/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#0071e3] text-white flex items-center justify-center shadow-md shrink-0">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-normal text-slate-900 tracking-tight">Meus Pedidos</h1>
                <span className="bg-blue-100 text-[#0071e3] text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {pedidos.length}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1 font-normal">
                Consulte itens comprados, valores de frete, método de pagamento e histórico de entregas.
              </p>
            </div>
          </div>

          <Link 
            to="/produtos"
            className="inline-flex items-center justify-center gap-2 bg-[#0071e3] hover:bg-[#005bb5] text-white text-xs sm:text-sm font-medium px-5 py-2.5 rounded-2xl shadow-md transition-all active:scale-95 shrink-0"
          >
            <ShoppingBag size={15} />
            Novo Pedido
          </Link>
        </div>

        {/* Real-time Order Notification Status & Live Simulator Bar */}
        <div className="px-6 py-3.5 bg-gradient-to-r from-blue-50/90 via-sky-50/60 to-emerald-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-slate-700">
            <div className="w-7 h-7 rounded-xl bg-blue-600/10 text-[#0071e3] flex items-center justify-center shrink-0">
              <Bell size={15} className="animate-pulse" />
            </div>
            <div>
              <span className="font-medium text-slate-900 block leading-tight">
                Notificações em Tempo Real Ativas
              </span>
              <span className="text-[11px] text-slate-500 font-normal">
                Você recebe alertas instantâneos de Toast e Notificações Push sobre qualquer mudança de status no seu pedido.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <div className="flex items-center gap-1 bg-white/80 p-1.5 rounded-2xl shadow-xs">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 px-1.5">
                Testar:
              </span>
              <button
                onClick={() => {
                  const sampleNum = pedidos[0]?.id_externo || pedidos[0]?.numero || "PED-8492";
                  addOrderToast({
                    title: "🚚 Pedido Despachado!",
                    message: `Seu pedido #${sampleNum} foi despachado pela expedição e está a caminho do seu condomínio!`,
                    orderNumber: `#${sampleNum}`,
                    status: "Em Rota de Entrega",
                    actionUrl: "/cliente/pedidos",
                    actionLabel: "Rastrear Entrega",
                    duration: 8000
                  });
                }}
                className="bg-sky-50 hover:bg-sky-100 text-[#0071e3] px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                title="Testar alerta de Pedido Enviado"
              >
                <Truck size={12} /> Enviado
              </button>

              <button
                onClick={() => {
                  const sampleNum = pedidos[0]?.id_externo || pedidos[0]?.numero || "PED-8492";
                  addOrderToast({
                    title: "✅ Pedido Entregue!",
                    message: `Seu pedido #${sampleNum} foi entregue com sucesso e recebido na portaria do condomínio!`,
                    orderNumber: `#${sampleNum}`,
                    status: "Entregue",
                    actionUrl: "/cliente/pedidos",
                    actionLabel: "Ver Comprovante",
                    duration: 8000
                  });
                }}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                title="Testar alerta de Pedido Entregue"
              >
                <CheckCircle size={12} /> Entregue
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 sm:p-6 bg-slate-50/60 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por número do pedido ou produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white rounded-2xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#0071e3]/20 shadow-xs transition-all font-normal"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { id: "todos", label: "Todos" },
              { id: "aguardando", label: "Aguardando" },
              { id: "separacao", label: "Em Separação" },
              { id: "faturado", label: "Faturados" },
              { id: "despachado", label: "Em Rota" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 shadow-xs"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        {filteredPedidos.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <div className="max-w-md mx-auto p-8 bg-slate-50 rounded-3xl text-center space-y-3 shadow-xs">
              <Package className="w-12 h-12 text-slate-300 mx-auto" />
              <div>
                <p className="font-medium text-slate-800 text-base">Nenhum pedido encontrado</p>
                <p className="text-xs text-slate-400 mt-1 font-normal">
                  {searchTerm || statusFilter !== "todos"
                    ? "Tente ajustar seus termos de busca ou filtros aplicados."
                    : "Você ainda não realizou compras. Explore nosso catálogo de produtos condominiais."}
                </p>
              </div>
              <Link 
                to="/produtos" 
                className="inline-flex items-center gap-2 text-xs bg-[#0071e3] hover:bg-[#005bb5] text-white font-medium px-5 py-2.5 rounded-2xl shadow-md transition-all"
              >
                Ir para o Catálogo de Produtos
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-4 sm:p-6">
            {filteredPedidos.map((pedido) => {
              const isExpanded = expandedPedidoId === pedido.firebaseId;
              const dateObj = new Date(pedido.dataHora);
              const formattedDate = dateObj.toLocaleDateString("pt-BR");
              const formattedTime = dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
              const freteVal = getFreteValor(pedido);
              const subtotalProd = getSubtotalProdutos(pedido, catalogProducts, profile?.level);
              const totalGeral = getTotalGeral(pedido, catalogProducts, profile?.level);
              const itensList = getPedidoItensList(pedido);
              const totalQtdItens = itensList.reduce((acc: number, item: any) => acc + getItemQuantity(item), 0);

              return (
                <div key={pedido.firebaseId} className="p-5 sm:p-6 rounded-3xl bg-white shadow-md hover:shadow-lg transition-all space-y-4">
                  {/* Order Main Header */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Identifier, Date, Status */}
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-medium text-slate-900 text-lg tracking-tight">
                          {pedido.id_externo || `PED-${pedido.numero}`}
                        </span>
                        <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${getStatusColor(pedido.status)}`}>
                          {getStatusLabel(pedido.status)}
                        </span>
                        {pedido.pagamento?.status === "Aprovado" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full shadow-xs">
                            <Check size={11} /> Pago
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-normal">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} className="text-slate-400" />
                          {formattedDate} às {formattedTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package size={13} className="text-slate-400" />
                          {totalQtdItens} {totalQtdItens === 1 ? "item" : "itens"}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Badges for Frete & Método de Pagamento */}
                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                      {/* Frete Badge */}
                      <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-2xl shadow-xs">
                        <Truck size={15} className="text-[#0071e3] shrink-0" />
                        <div className="text-left">
                          <span className="block text-[9px] uppercase font-medium text-slate-400 leading-none">Frete</span>
                          <span className="text-xs font-medium text-slate-800">
                            {freteVal === 0 ? "Grátis" : `R$ ${freteVal.toFixed(2)}`}
                          </span>
                        </div>
                      </div>

                      {/* Pagamento Badge */}
                      <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-2xl shadow-xs">
                        {getPaymentIcon(pedido.pagamento?.forma)}
                        <div className="text-left">
                          <span className="block text-[9px] uppercase font-medium text-slate-400 leading-none">Pagamento</span>
                          <span className="text-xs font-medium text-slate-800 truncate max-w-[110px]">
                            {getPaymentLabel(pedido.pagamento?.forma).split(" ")[0]}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Total Value & Expand/Modal Controls */}
                    <div className="flex items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0">
                      <div className="text-left lg:text-right">
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Total do Pedido</p>
                        <p className="font-medium text-slate-900 text-lg sm:text-xl text-[#0071e3]">
                          R$ {totalGeral.toFixed(2)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Open Complete Details Modal */}
                        <button
                          onClick={() => setSelectedPedidoModal(pedido)}
                          title="Ver Detalhes Completos do Pedido"
                          className="px-3.5 py-2 bg-blue-50 hover:bg-[#0071e3] text-[#0071e3] hover:text-white font-medium text-xs rounded-2xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                        >
                          <Eye size={15} />
                          <span>Ver Pedido</span>
                        </button>

                        {/* Inline Expand Accordion */}
                        <button
                          onClick={() => toggleExpand(pedido.firebaseId)}
                          aria-label={isExpanded ? "Recolher detalhes" : "Expandir detalhes"}
                          className={`p-2 rounded-2xl transition-all flex items-center justify-center cursor-pointer ${
                            isExpanded
                              ? "bg-slate-900 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Inline Expandable Panel (Painel Expansível) */}
                  {isExpanded && (
                    <div className="pt-4 space-y-6 animate-fadeIn">
                      {/* Grid with 3 Pillars: Itens Comprados, Frete & Entrega, Demonstrativo Financeiro */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        
                        {/* PILLAR 1: Itens Comprados */}
                        <div className="lg:col-span-7 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-slate-900 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5">
                              <Package size={16} className="text-[#0071e3]" />
                              Itens do Pedido ({itensList.length} {itensList.length === 1 ? "produto" : "produtos"} • {totalQtdItens} un)
                            </h4>
                            <span className="text-xs font-medium text-slate-700 bg-slate-100 px-3 py-1 rounded-xl shadow-xs">
                              Subtotal: <strong className="text-slate-900 font-mono font-medium">{formatBRL(subtotalProd)}</strong>
                            </span>
                          </div>

                          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                            {itensList.map((item: any, idx: number) => {
                              const uPrice = getItemUnitPrice(item, pedido, catalogProducts, profile?.level);
                              const q = getItemQuantity(item);
                              const iTot = getItemTotal(item, pedido, catalogProducts, profile?.level);
                              const unidadeMedida = item.unidade || item.un || "UN";

                              return (
                                <div 
                                  key={idx} 
                                  className="bg-slate-50/70 p-4 rounded-2xl shadow-xs hover:bg-slate-50 transition-all space-y-2.5"
                                >
                                  {/* Item Header: Name & SKU */}
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                      <div className="w-7 h-7 rounded-xl bg-blue-100 text-[#0071e3] font-medium text-xs flex items-center justify-center shrink-0 mt-0.5">
                                        #{idx + 1}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-medium text-slate-900 text-xs sm:text-sm leading-snug" title={item.descricao || item.nome}>
                                          {item.descricao || item.nome || "Produto"}
                                        </p>
                                        <span className="inline-block text-[10px] font-mono text-slate-400 mt-0.5">
                                          SKU/Cód: <strong className="text-slate-600 font-medium">{item.codigo || item.sku || item.id || "N/A"}</strong>
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Item Metrics Row: Structured 3-column breakdown */}
                                  <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-xl shadow-xs text-center">
                                    <div className="text-left pl-1">
                                      <span className="block text-[9px] uppercase font-medium text-slate-400 tracking-wider">Quantidade</span>
                                      <span className="text-xs font-medium text-slate-800">
                                        {q} <span className="text-[10px] text-slate-500 font-normal">{unidadeMedida}</span>
                                      </span>
                                    </div>
                                    <div className="text-center">
                                      <span className="block text-[9px] uppercase font-medium text-slate-400 tracking-wider">Valor Unitário</span>
                                      <span className="text-xs font-medium text-slate-800 font-mono">
                                        {formatBRL(uPrice)}
                                      </span>
                                    </div>
                                    <div className="text-right pr-1">
                                      <span className="block text-[9px] uppercase font-medium text-slate-400 tracking-wider">Subtotal Item</span>
                                      <span className="text-xs font-medium text-[#0071e3] font-mono">
                                        {formatBRL(iTot)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* PILLAR 2 & 3: Frete & Demonstrativo Financeiro */}
                        <div className="lg:col-span-5 space-y-4">
                          
                          {/* Financial Summary Card */}
                          <div className="bg-slate-50/80 p-5 rounded-3xl shadow-xs space-y-3.5">
                            <h4 className="font-medium text-slate-900 text-xs sm:text-sm uppercase tracking-wider flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <CreditCard size={16} className="text-[#0071e3]" />
                                Resumo Financeiro
                              </span>
                              <span className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full ${
                                pedido.pagamento?.status === "Aprovado" 
                                  ? "bg-emerald-100 text-emerald-800" 
                                  : "bg-amber-100 text-amber-800"
                              }`}>
                                {pedido.pagamento?.status === "Aprovado" ? "✓ Liquidado" : "⏳ Pendente"}
                              </span>
                            </h4>

                            {/* Detailed Math Breakdown */}
                            <div className="space-y-2 text-xs divide-y divide-slate-200/50">
                              {/* 1. Subtotal de Itens */}
                              <div className="flex items-center justify-between pt-1">
                                <div className="text-slate-600">
                                  <span className="font-medium">Subtotal dos Itens:</span>
                                  <span className="block text-[10px] text-slate-400 font-normal">({itensList.length} itens • {totalQtdItens} un)</span>
                                </div>
                                <span className="font-medium text-slate-900 font-mono text-xs sm:text-sm">
                                  {formatBRL(subtotalProd)}
                                </span>
                              </div>

                              {/* 2. Frete Calculado */}
                              <div className="flex items-center justify-between pt-2">
                                <div className="text-slate-600">
                                  <span className="font-medium">Frete Calculado:</span>
                                  <span className="block text-[10px] text-slate-400 font-normal">
                                    {freteVal === 0 ? "Entrega Bonificada" : "Grande Goiânia"}
                                  </span>
                                </div>
                                <div className="text-right">
                                  {freteVal === 0 ? (
                                    <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-xl inline-block">
                                      FRETE GRÁTIS
                                    </span>
                                  ) : (
                                    <span className="font-medium text-slate-900 font-mono text-xs sm:text-sm">
                                      {formatBRL(freteVal)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* 3. Descontos se houver */}
                              {(parseNumber(pedido.desconto) > 0 || parseNumber(pedido.totais?.totalDesconto) > 0) && (
                                <div className="flex items-center justify-between pt-2 text-emerald-700">
                                  <span className="font-medium">Descontos Aplicados:</span>
                                  <span className="font-medium font-mono">
                                    - {formatBRL(parseNumber(pedido.desconto || pedido.totais?.totalDesconto))}
                                  </span>
                                </div>
                              )}

                              {/* 4. Valor Total Final Destacado */}
                              <div className="flex items-baseline justify-between pt-3">
                                <div>
                                  <span className="text-xs font-medium uppercase tracking-wider text-slate-900 block">
                                    Valor Total Final:
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-normal">
                                    {getPaymentLabel(pedido.pagamento?.forma)}
                                  </span>
                                </div>
                                <span className="text-lg sm:text-xl font-medium text-[#0071e3] font-mono">
                                  {formatBRL(totalGeral)}
                                </span>
                              </div>
                            </div>

                            {/* Pay button if pending */}
                            {pedido.pagamento?.status !== "Aprovado" && mpConfig && (
                              <button
                                onClick={() => {
                                  setPayingPedido(pedido);
                                  setPaymentMethod("17");
                                }}
                                className="w-full mt-2 bg-[#0071e3] hover:bg-[#005bb5] text-white font-medium py-2.5 px-3 rounded-2xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-98"
                              >
                                <CreditCard size={14} />
                                Pagar Agora com Mercado Pago
                              </button>
                            )}
                          </div>

                          {/* Shipping Destination Card */}
                          <div className="bg-slate-50/80 p-5 rounded-3xl shadow-xs space-y-2 text-xs">
                            <h4 className="font-medium text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                              <Truck size={15} className="text-[#0071e3]" />
                              Endereço de Entrega
                            </h4>
                            <div className="text-slate-600 space-y-0.5 pt-1 font-normal">
                              <p className="font-medium text-slate-900">{pedido.cliente?.nome}</p>
                              <p className="text-[11px] leading-relaxed text-slate-600">
                                {pedido.cliente?.endereco?.logradouro}, {pedido.cliente?.endereco?.numero}
                                {pedido.cliente?.endereco?.complemento && ` - ${pedido.cliente?.endereco?.complemento}`} <br />
                                {pedido.cliente?.endereco?.bairro} • {pedido.cliente?.endereco?.municipio}/{pedido.cliente?.endereco?.uf} <br />
                                <span className="font-mono text-slate-500">CEP: {pedido.cliente?.endereco?.cep}</span>
                              </p>
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Footer Actions of the Expandable Panel */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedPedidoModal(pedido)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0071e3] hover:text-[#005bb5] hover:underline cursor-pointer bg-blue-50/80 px-3.5 py-2 rounded-2xl shadow-xs"
                          >
                            <Eye size={14} />
                            Ver Modal Completo com Itens e Rastreio
                          </button>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => handleRepeatOrder(pedido)}
                            disabled={repeatingOrderId !== null}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 px-4 rounded-2xl text-xs transition-all flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                          >
                            {repeatingOrderId === pedido.firebaseId ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            <span>Comprar Novamente</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================
          DETAILED ORDER MODAL (Modal Completo de Detalhes do Pedido)
          ============================================================ */}
      {selectedPedidoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-6 md:p-8 flex justify-between items-center bg-gradient-to-r from-slate-50 to-sky-50/40">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[#0071e3] text-white rounded-2xl shadow-md">
                  <FileText size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-950 text-base sm:text-lg">
                      {selectedPedidoModal.id_externo || `PED-${selectedPedidoModal.numero}`}
                    </h3>
                    <span className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full ${getStatusColor(selectedPedidoModal.status)}`}>
                      {getStatusLabel(selectedPedidoModal.status)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-normal">
                    Realizado em {new Date(selectedPedidoModal.dataHora).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  title="Imprimir Pedido"
                  className="p-2 hover:bg-slate-200/70 rounded-xl text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <Printer size={18} />
                </button>
                <button 
                  onClick={() => setSelectedPedidoModal(null)}
                  className="p-2 hover:bg-slate-200/70 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 overflow-y-auto space-y-6 text-slate-700">
              
              {/* Section 1: Itens Comprados */}
              <div className="space-y-3">
                {(() => {
                  const modalItens = getPedidoItensList(selectedPedidoModal);
                  const modalTotalQtd = modalItens.reduce((acc: number, item: any) => acc + getItemQuantity(item), 0);
                  const modalSubtotal = getSubtotalProdutos(selectedPedidoModal, catalogProducts, profile?.level);

                  return (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-blue-50 text-[#0071e3] flex items-center justify-center font-medium">
                            <Package size={15} />
                          </div>
                          <div>
                            <h4 className="font-medium text-slate-900 text-xs sm:text-sm uppercase tracking-wider">
                              Itens do Pedido ({modalItens.length} {modalItens.length === 1 ? "produto" : "produtos"})
                            </h4>
                            <p className="text-[11px] text-slate-400 font-normal">
                              Volume total de {modalTotalQtd} {modalTotalQtd === 1 ? "unidade" : "unidades"}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-slate-700 bg-slate-100 px-3 py-1 rounded-2xl shadow-xs">
                          Subtotal dos Itens: <strong className="text-slate-900 font-mono font-medium ml-1">{formatBRL(modalSubtotal)}</strong>
                        </span>
                      </div>

                      <div className="rounded-3xl overflow-hidden bg-slate-50/80 shadow-xs divide-y divide-slate-200/50">
                        {/* Table Header on Desktop */}
                        <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-100 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                          <div className="col-span-6">Produto / Descrição</div>
                          <div className="col-span-2 text-center">Quantidade</div>
                          <div className="col-span-2 text-right">Valor Unitário</div>
                          <div className="col-span-2 text-right">Subtotal Item</div>
                        </div>

                        {modalItens.map((item: any, idx: number) => {
                          const uPrice = getItemUnitPrice(item, selectedPedidoModal, catalogProducts, profile?.level);
                          const q = getItemQuantity(item);
                          const iTot = getItemTotal(item, selectedPedidoModal, catalogProducts, profile?.level);
                          const unidadeMedida = item.unidade || item.un || "UN";

                          return (
                            <div key={idx} className="p-3.5 sm:px-4 sm:py-3.5 hover:bg-slate-100/60 transition-colors">
                              {/* Desktop Row */}
                              <div className="hidden sm:grid grid-cols-12 gap-3 items-center">
                                <div className="col-span-6 flex items-center gap-3 min-w-0">
                                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#0071e3] font-medium text-xs flex items-center justify-center shrink-0">
                                    #{idx + 1}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium text-slate-900 text-xs sm:text-sm truncate" title={item.descricao || item.nome}>
                                      {item.descricao || item.nome || "Produto"}
                                    </p>
                                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                      SKU/Código: <strong className="text-slate-600 font-medium">{item.codigo || item.sku || item.id || "N/A"}</strong>
                                    </p>
                                  </div>
                                </div>

                                <div className="col-span-2 text-center">
                                  <span className="inline-block bg-white text-slate-800 text-xs font-medium px-2.5 py-1 rounded-xl shadow-xs">
                                    {q} {unidadeMedida}
                                  </span>
                                </div>

                                <div className="col-span-2 text-right font-medium text-slate-700 font-mono text-xs sm:text-sm">
                                  {formatBRL(uPrice)}
                                  <span className="block text-[10px] text-slate-400 font-sans font-normal">por {unidadeMedida}</span>
                                </div>

                                <div className="col-span-2 text-right font-medium text-slate-900 font-mono text-xs sm:text-sm text-[#0071e3]">
                                  {formatBRL(iTot)}
                                </div>
                              </div>

                              {/* Mobile Card Layout */}
                              <div className="sm:hidden space-y-2.5">
                                <div className="flex items-start gap-2.5">
                                  <span className="w-6 h-6 rounded-lg bg-blue-50 text-[#0071e3] font-medium text-xs flex items-center justify-center shrink-0 mt-0.5">
                                    #{idx + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-slate-900 text-xs leading-snug">
                                      {item.descricao || item.nome || "Produto"}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                      SKU/Código: <span className="text-slate-600 font-medium">{item.codigo || item.sku || item.id || "N/A"}</span>
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-2xl text-center shadow-xs">
                                  <div className="text-left pl-1">
                                    <span className="block text-[9px] uppercase font-medium text-slate-400 tracking-wider">Quantidade</span>
                                    <span className="text-xs font-medium text-slate-800">{q} {unidadeMedida}</span>
                                  </div>
                                  <div className="text-center">
                                    <span className="block text-[9px] uppercase font-medium text-slate-400 tracking-wider">Unitário</span>
                                    <span className="text-xs font-medium text-slate-800 font-mono">{formatBRL(uPrice)}</span>
                                  </div>
                                  <div className="text-right pr-1">
                                    <span className="block text-[9px] uppercase font-medium text-slate-400 tracking-wider">Subtotal</span>
                                    <span className="text-xs font-medium text-[#0071e3] font-mono">{formatBRL(iTot)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Section 2 & 3: Logistics & Financial Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* Column Left (7 cols): Shipping Address & Timeline */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Shipping Destination Card */}
                  <div className="p-5 bg-slate-50/80 rounded-3xl shadow-xs space-y-3">
                    <h4 className="font-medium text-slate-900 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5 pb-2">
                      <Truck size={15} className="text-[#0071e3]" />
                      Local de Entrega e Logística
                    </h4>

                    <div className="space-y-1 text-xs">
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Destinatário:</p>
                      <p className="text-xs font-medium text-slate-900">{selectedPedidoModal.cliente?.nome}</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed pt-1 font-normal">
                        {selectedPedidoModal.cliente?.endereco?.logradouro}, {selectedPedidoModal.cliente?.endereco?.numero}
                        {selectedPedidoModal.cliente?.endereco?.complemento && ` - ${selectedPedidoModal.cliente?.endereco?.complemento}`} <br />
                        {selectedPedidoModal.cliente?.endereco?.bairro} • {selectedPedidoModal.cliente?.endereco?.municipio}/{selectedPedidoModal.cliente?.endereco?.uf} <br />
                        <span className="font-mono text-slate-500 font-medium">CEP: {selectedPedidoModal.cliente?.endereco?.cep}</span>
                      </p>
                    </div>
                  </div>

                  {/* NF-e se emitida */}
                  {selectedPedidoModal.nfe && (
                    <div className="p-5 bg-emerald-50/50 rounded-3xl shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                          <FileText size={13} /> Nota Fiscal Eletrônica Emitida
                        </span>
                        <span className="text-xs font-medium text-emerald-900 font-mono">
                          NFe Nº {selectedPedidoModal.nfe.numero}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-2xl shadow-xs">
                        <span className="text-[10px] font-mono text-slate-600 break-all">
                          Chave: {selectedPedidoModal.nfe.chaveAccess || selectedPedidoModal.nfe.chaveAcesso}
                        </span>
                        <button
                          onClick={() => copyToClipboard(selectedPedidoModal.nfe.chaveAccess || selectedPedidoModal.nfe.chaveAcesso, "nfe")}
                          className="text-xs font-medium text-[#0071e3] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          {copiedKey === "nfe" ? <Check size={12} /> : <Clipboard size={12} />}
                          <span>{copiedKey === "nfe" ? "Copiado!" : "Copiar"}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Histórico do Pedido */}
                  <div className="p-5 bg-slate-50/80 rounded-3xl shadow-xs space-y-3">
                    <h4 className="font-medium text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5 pb-2">
                      <Clock size={14} className="text-[#0071e3]" />
                      Histórico e Rastreamento do Pedido
                    </h4>
                    
                    <div className="relative pl-4 space-y-3 before:absolute before:inset-y-0 before:left-[7px] before:w-[2px] before:bg-slate-200">
                      {(selectedPedidoModal.historico || []).map((evento: any, idx: number) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[21px] w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#0071e3]"></div>
                          </div>
                          <div className="ml-2">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-0.5">
                              <span className="font-medium text-slate-900 text-xs">
                                {evento.novoStatus || evento.status || evento.evento}
                              </span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                {new Date(evento.dataHora || evento.data).toLocaleString("pt-BR")}
                              </span>
                            </div>
                            {(evento.observacao || evento.descricao) && (
                              <p className="text-xs text-slate-600 mt-0.5 font-normal">
                                {evento.observacao || evento.descricao}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                      {(!selectedPedidoModal.historico || selectedPedidoModal.historico.length === 0) && (
                        <p className="text-xs text-slate-400 italic font-normal">Pedido cadastrado no sistema. Acompanhe as próximas atualizações.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Column Right (5 cols): Demonstrativo Financeiro */}
                <div className="lg:col-span-5 space-y-4">
                  {(() => {
                    const freteVal = getFreteValor(selectedPedidoModal);
                    const subtotalProd = getSubtotalProdutos(selectedPedidoModal, catalogProducts, profile?.level);
                    const totalGeral = getTotalGeral(selectedPedidoModal, catalogProducts, profile?.level);
                    const modalItens = getPedidoItensList(selectedPedidoModal);
                    const modalTotalQtd = modalItens.reduce((acc: number, item: any) => acc + getItemQuantity(item), 0);
                    const descontoVal = parseNumber(selectedPedidoModal.desconto || selectedPedidoModal.totais?.totalDesconto);

                    return (
                      <div className="p-5 sm:p-6 bg-slate-50/90 rounded-3xl shadow-xs space-y-4">
                        <div className="flex items-center justify-between pb-3">
                          <h4 className="font-medium text-slate-900 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5">
                            <CreditCard size={16} className="text-[#0071e3]" />
                            Demonstrativo Financeiro
                          </h4>
                          <span className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full ${
                            selectedPedidoModal.pagamento?.status === "Aprovado" 
                              ? "bg-emerald-100 text-emerald-800" 
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {selectedPedidoModal.pagamento?.status === "Aprovado" ? "✓ Liquidado" : "⏳ Aguardando Pagamento"}
                          </span>
                        </div>

                        {/* Payment Method Badge */}
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-white text-xs shadow-xs">
                          <span className="text-slate-600 font-medium flex items-center gap-1.5">
                            {getPaymentIcon(selectedPedidoModal.pagamento?.forma)}
                            Forma de Pagamento:
                          </span>
                          <span className="font-medium text-slate-900">
                            {getPaymentLabel(selectedPedidoModal.pagamento?.forma)}
                          </span>
                        </div>

                        {/* Calculation Line Items */}
                        <div className="space-y-2.5 text-xs divide-y divide-slate-200/50">
                          {/* 1. Subtotal dos Produtos */}
                          <div className="flex items-center justify-between pt-1">
                            <div className="text-slate-600">
                              <span className="font-medium">Subtotal dos Itens:</span>
                              <span className="block text-[10px] text-slate-400 font-normal">({modalItens.length} produtos • {modalTotalQtd} un)</span>
                            </div>
                            <span className="font-medium text-slate-900 font-mono text-xs sm:text-sm">
                              {formatBRL(subtotalProd)}
                            </span>
                          </div>

                          {/* 2. Frete Calculado */}
                          <div className="flex items-center justify-between pt-2.5">
                            <div className="text-slate-600">
                              <span className="font-medium">Frete Calculado:</span>
                              <span className="block text-[10px] text-slate-400 font-normal">
                                {freteVal === 0 ? "Isenção aplicada p/ condomínio" : "Transporte Grande Goiânia"}
                              </span>
                            </div>
                            <div className="text-right">
                              {freteVal === 0 ? (
                                <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-xl inline-block">
                                  FRETE GRÁTIS
                                </span>
                              ) : (
                                <span className="font-medium text-slate-900 font-mono text-xs sm:text-sm">
                                  {formatBRL(freteVal)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 3. Descontos se houver */}
                          {descontoVal > 0 && (
                            <div className="flex items-center justify-between pt-2.5 text-emerald-700">
                              <div>
                                <span className="font-medium">Descontos Aplicados:</span>
                                <span className="block text-[10px] text-emerald-600/80 font-normal">Cupom ou benefício promocional</span>
                              </div>
                              <span className="font-medium font-mono text-xs sm:text-sm">
                                - {formatBRL(descontoVal)}
                              </span>
                            </div>
                          )}

                          {/* 4. Total Final em Destaque */}
                          <div className="flex items-baseline justify-between pt-3.5">
                            <div>
                              <span className="text-xs font-medium uppercase tracking-wider text-slate-900 block">
                                Valor Total Final:
                              </span>
                              <span className="text-[10px] text-slate-500 font-normal">
                                Total consolidado do pedido
                              </span>
                            </div>
                            <span className="text-xl sm:text-2xl font-medium text-[#0071e3] font-mono">
                              {formatBRL(totalGeral)}
                            </span>
                          </div>
                        </div>

                        {/* Pay button if pending */}
                        {selectedPedidoModal.pagamento?.status !== "Aprovado" && mpConfig && (
                          <button
                            onClick={() => {
                              const ped = selectedPedidoModal;
                              setSelectedPedidoModal(null);
                              setPayingPedido(ped);
                              setPaymentMethod("17");
                            }}
                            className="w-full mt-2 bg-[#0071e3] hover:bg-[#005bb5] text-white font-medium py-2.5 px-3 rounded-2xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-98"
                          >
                            <CreditCard size={14} />
                            Pagar Agora com Mercado Pago
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 md:p-6 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
              <button
                onClick={() => setSelectedPedidoModal(null)}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-all cursor-pointer shadow-xs"
              >
                Fechar
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const ped = selectedPedidoModal;
                    setSelectedPedidoModal(null);
                    handleRepeatOrder(ped);
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={13} />
                  Comprar Novamente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mercado Pago Payment Modal */}
      {payingPedido && mpConfig && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            <div className="p-6 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2.5 bg-blue-100 rounded-2xl text-[#0071e3] shadow-xs">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="font-medium text-slate-950 text-base">Efetuar Pagamento</h3>
                  <p className="text-[11px] text-slate-500 font-normal">Pedido {payingPedido.id_externo || `PED-${payingPedido.numero}`}</p>
                </div>
              </div>
              <button 
                onClick={() => setPayingPedido(null)}
                className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="p-4 bg-blue-50/60 rounded-2xl flex items-start gap-2.5 text-xs text-[#0071e3] shadow-xs">
                <span className="text-base">🛡️</span>
                <div>
                  <p className="font-medium">Checkout Integrado do Mercado Pago</p>
                  <p className="text-slate-600 leading-normal mt-0.5 font-normal">
                    Utilizando chaves seguras homologadas do administrador. O pagamento irá liquidar e conciliar a fatura de forma automática e instantânea.
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-baseline bg-slate-50 p-4 rounded-2xl shadow-xs">
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Valor a Pagar:</span>
                <span className="text-xl font-medium text-[#0071e3]">
                  R$ {getTotalGeral(payingPedido).toFixed(2)}
                </span>
              </div>

              {/* Method choice */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wider">Forma de Pagamento</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("17")}
                    className={`p-3 rounded-2xl font-medium text-xs transition-all flex flex-col items-center gap-1 cursor-pointer shadow-xs ${
                      paymentMethod === "17"
                        ? "bg-blue-50 text-[#0071e3]"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>⚡ PIX</span>
                    <span className="text-[9px] font-normal text-slate-400">Compensação instantânea</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("03")}
                    className={`p-3 rounded-2xl font-medium text-xs transition-all flex flex-col items-center gap-1 cursor-pointer shadow-xs ${
                      paymentMethod === "03"
                        ? "bg-blue-50 text-[#0071e3]"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>💳 Cartão</span>
                    <span className="text-[9px] font-normal text-slate-400">Em até 12 parcelas</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handlePayWithMercadoPago} className="space-y-4 pt-1">
                {paymentMethod === "17" ? (
                  <div className="bg-slate-50 rounded-2xl p-4 text-center space-y-3 shadow-xs">
                    <p className="text-xs font-medium text-slate-600">Escaneie o QR Code ou copie a linha PIX abaixo</p>
                    <div className="w-32 h-32 bg-white rounded-2xl mx-auto p-2 flex items-center justify-center shadow-xs">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                          gerarPixCopiaECola({
                            chave: "63680806-d418-4b0b-9ef4-6562cde069d9",
                            valor: getTotalGeral(payingPedido),
                            nomeRecebedor: "Uniao Condominial",
                            cidadeRecebedor: "Goiania",
                            txid: "MPED" + (payingPedido.id_externo || payingPedido.id || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 10)
                          })
                        )}`}
                        alt="QR Code"
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div>
                      <button 
                        type="button"
                        onClick={() => {
                          const code = gerarPixCopiaECola({
                            chave: "63680806-d418-4b0b-9ef4-6562cde069d9",
                            valor: getTotalGeral(payingPedido),
                            nomeRecebedor: "Uniao Condominial",
                            cidadeRecebedor: "Goiania",
                            txid: "MPED" + (payingPedido.id_externo || payingPedido.id || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 10)
                          });
                          navigator.clipboard.writeText(code);
                          alert("Código PIX Copia e Cola copiado com sucesso!");
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0071e3] hover:underline bg-white py-2 px-4 rounded-2xl shadow-xs transition-all active:scale-95 cursor-pointer"
                      >
                        <Clipboard size={12} />
                        Copiar código PIX Copia e Cola
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-400 font-normal">
                      O sistema identificará a transferência em segundos através da conciliação do seu Access Token.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-slate-500 uppercase">Nome no Cartão</label>
                      <input 
                        type="text" 
                        required
                        placeholder="NOME IMPRESSO NO CARTÃO"
                        value={cardNome}
                        onChange={(e) => setCardNome(e.target.value.toUpperCase())}
                        className="w-full p-2.5 bg-slate-50 rounded-2xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3]/20 font-medium"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-slate-500 uppercase">Número do Cartão</label>
                      <input 
                        type="text" 
                        required
                        placeholder="0000 0000 0000 0000"
                        maxLength={19}
                        value={cardNumero}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          const formatted = val.match(/.{1,4}/g)?.join(" ") || val;
                          setCardNumero(formatted);
                        }}
                        className="w-full p-2.5 bg-slate-50 rounded-2xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3]/20 font-medium font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-slate-500 uppercase">Validade</label>
                        <input 
                          type="text" 
                          required
                          placeholder="MM/AA"
                          maxLength={5}
                          value={cardValidade}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            if (val.length > 2) {
                              setCardValidade(val.substring(0, 2) + "/" + val.substring(2, 4));
                            } else {
                              setCardValidade(val);
                            }
                          }}
                          className="w-full p-2.5 bg-slate-50 rounded-2xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3]/20 font-medium font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-slate-500 uppercase">Código CVV</label>
                        <input 
                          type="text" 
                          required
                          placeholder="123"
                          maxLength={4}
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ""))}
                          className="w-full p-2.5 bg-slate-50 rounded-2xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3]/20 font-medium font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-[#0071e3] hover:bg-[#005bb5] text-white font-medium py-3.5 rounded-2xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer mt-4"
                >
                  {isProcessing ? (
                    "Processando e Conciliando..."
                  ) : (
                    <>
                      <CheckCircle size={14} />
                      Simular e Confirmar Pagamento Mercado Pago
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
