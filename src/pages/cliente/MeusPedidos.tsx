import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag, Search, Calendar, MapPin, CreditCard, ChevronDown, ChevronUp, Clock, CheckCircle, X, RefreshCw, Clipboard, QrCode, FileText } from "lucide-react";
import { collection, onSnapshot, query, getDocs, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { isStaffRole } from "../../lib/permissions";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { CONFIG } from "../../lib/ecommerceFlow";
import { getMercadoPagoConfig, MercadoPagoConfig } from "../../lib/mercadoPago";
import { gerarPixCopiaECola } from "../../lib/documentValidators";

export default function MeusPedidos() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { addMultipleToCart } = useCart();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPedidoId, setExpandedPedidoId] = useState<string | null>(null);
  const [repeatingOrderId, setRepeatingOrderId] = useState<string | null>(null);

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
    async function loadConfig() {
      const config = await getMercadoPagoConfig();
      setMpConfig(config);
    }
    loadConfig();
  }, []);

  useEffect(() => {
    if (!profile?.email) {
      setLoading(false);
      return;
    }

    // Use snapshot listener so new orders appear immediately
    const q = query(collection(db, "pedidos_venda"), where("cliente.email", "==", profile.email));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customerOrders = snapshot.docs.map((doc) => ({
        firebaseId: doc.id,
        ...doc.data()
      }));

      // Sort by date (newest first)
      customerOrders.sort(
        (a: any, b: any) => new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
      );

      setPedidos(customerOrders);
      setLoading(false);
    }, (error) => {
      console.error("Error loading customer orders:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

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
      const totalAmount = payingPedido.totais?.totalPedido || payingPedido.pagamento?.valor || 0;
      const metName = paymentMethod === "17" ? "PIX via Mercado Pago (Retroativo)" : "Cartão de Crédito via Mercado Pago (Retroativo)";
      
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case CONFIG.STATUS.NOVO:
        return "Aguardando Confirmação";
      case CONFIG.STATUS.EM_CONFERENCIA:
        return "Em Separação / Conferência";
      case CONFIG.STATUS.CONFERIDO:
        return "Aprovado para Faturamento";
      case CONFIG.STATUS.FATURADO:
        return "Faturado (Nota Fiscal Emitida)";
      case CONFIG.STATUS.DESPACHADO:
        return "Despachado / Em Rota de Entrega";
      default:
        return status || "Em processamento";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case CONFIG.STATUS.NOVO:
        return "bg-slate-100 text-slate-700 border-slate-200";
      case CONFIG.STATUS.EM_CONFERENCIA:
        return "bg-amber-100 text-amber-700 border-amber-200";
      case CONFIG.STATUS.CONFERIDO:
        return "bg-teal-100 text-teal-700 border-teal-200";
      case CONFIG.STATUS.FATURADO:
        return "bg-blue-100 text-blue-700 border-blue-200";
      case CONFIG.STATUS.DESPACHADO:
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getPaymentLabel = (forma: string) => {
    switch (forma) {
      case "17":
        return "PIX";
      case "15":
        return "Boleto Bancário";
      case "03":
        return "Cartão de Crédito";
      default:
        return "Faturamento Direto";
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center text-slate-500">
        Carregando seus pedidos...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#0071e3] text-white flex items-center justify-center shadow-xs">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Meus Pedidos</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Acompanhe suas compras e notas fiscais na União Condominial.<span className="text-emerald-600 font-semibold">GO</span>.
            </p>
          </div>
        </div>

        {pedidos.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <div className="max-w-md mx-auto p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="font-semibold text-slate-700 mb-1">Você ainda não tem compras registradas.</p>
              <p className="text-xs text-slate-400 mb-4">Visite nosso catálogo de produtos e faça seu primeiro pedido.</p>
              <Link 
                to="/produtos" 
                className="inline-flex text-xs bg-[#0071e3] text-white font-bold px-4 py-2 rounded-lg"
              >
                Ir para o Catálogo
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pedidos.map((pedido) => {
              const isExpanded = expandedPedidoId === pedido.firebaseId;
              const dateObj = new Date(pedido.dataHora);
              const formattedDate = dateObj.toLocaleDateString("pt-BR");
              const formattedTime = dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

              return (
                <div key={pedido.firebaseId} className="p-4 sm:p-6 transition-colors hover:bg-slate-50/50">
                  {/* Order summary header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                          {pedido.id_externo || `PED-${pedido.numero}`}
                        </span>
                        <span className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full border ${getStatusColor(pedido.status)}`}>
                          {getStatusLabel(pedido.status)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formattedDate} às {formattedTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {pedido.itens?.reduce((acc: number, item: any) => acc + item.quantidade, 0) || 0} itens
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6">
                      <div className="text-left md:text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Valor Total</p>
                        <p className="font-black text-slate-900 text-base sm:text-lg">
                          R$ {(pedido.totais?.totalPedido || pedido.pagamento?.valor || 0).toFixed(2)}
                        </p>
                      </div>

                      <button
                        onClick={() => toggleExpand(pedido.firebaseId)}
                        className="p-2 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-500 transition-all flex items-center justify-center"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Order Details */}
                  {isExpanded && (
                    <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-slate-600 animate-fadeIn">
                      {/* Column 1: Items List */}
                      <div className="md:col-span-2 space-y-3.5">
                        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Itens do Pedido</h4>
                        <div className="space-y-2">
                          {pedido.itens?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl">
                              <div className="min-w-0 pr-2">
                                <p className="font-semibold text-slate-800 text-xs sm:text-sm truncate">{item.descricao}</p>
                                <p className="text-[10px] text-slate-400">Qtd: {item.quantidade} x R$ {item.valorUnitario.toFixed(2)}</p>
                              </div>
                              <span className="font-bold text-slate-800 text-xs sm:text-sm flex-shrink-0">
                                R$ {item.valorTotal?.toFixed(2) || (item.quantidade * item.valorUnitario).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Column 2: Delivery & Shipping */}
                      <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/80">
                        <div className="space-y-1.5">
                          <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1">
                            <MapPin size={12} className="text-[#0071e3]" />
                            Entrega
                          </h4>
                          <p className="text-xs text-slate-600 leading-relaxed font-medium">
                            {pedido.cliente?.nome} <br />
                            {pedido.cliente?.endereco?.logradouro}, {pedido.cliente?.endereco?.numero} <br />
                            {pedido.cliente?.endereco?.complemento && <>{pedido.cliente?.endereco?.complemento} <br /></>}
                            {pedido.cliente?.endereco?.bairro} <br />
                            {pedido.cliente?.endereco?.municipio} - {pedido.cliente?.endereco?.uf} <br />
                            CEP: {pedido.cliente?.endereco?.cep}
                          </p>
                        </div>

                        <div className="space-y-1.5 border-t border-slate-200/60 pt-3">
                          <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1">
                            <CreditCard size={12} className="text-[#0071e3]" />
                            Pagamento
                          </h4>
                          <div className="text-xs text-slate-600 font-medium space-y-1">
                            <p>Forma: {getPaymentLabel(pedido.pagamento?.forma)}</p>
                            <p>Frete: {pedido.frete?.valor === 0 ? "Grátis" : `R$ ${pedido.frete?.valor?.toFixed(2)}`}</p>
                            <div className="pt-1 flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status:</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                pedido.pagamento?.status === "Aprovado" 
                                  ? "bg-emerald-100 text-emerald-800" 
                                  : "bg-amber-100 text-amber-800"
                              }`}>
                                {pedido.pagamento?.status === "Aprovado" ? "✓ Pago e Conciliado" : "Aguardando Pagamento"}
                              </span>
                            </div>
                          </div>

                          {pedido.pagamento?.status !== "Aprovado" && mpConfig && (
                            <button
                              onClick={() => {
                                setPayingPedido(pedido);
                                setPaymentMethod("17"); // default to PIX
                              }}
                              className="w-full mt-3 bg-[#0071e3] hover:bg-[#0071e3]/90 text-white font-bold py-2 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                            >
                              <CreditCard size={13} />
                              Pagar com Mercado Pago
                            </button>
                          )}
                        </div>

                        <div className="border-t border-slate-200/60 pt-3">
                          <button
                            onClick={() => handleRepeatOrder(pedido)}
                            disabled={repeatingOrderId !== null}
                            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {repeatingOrderId === pedido.firebaseId ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            {repeatingOrderId === pedido.firebaseId ? "Repetindo Pedido..." : "Repetir Pedido (Comprar Novamente)"}
                          </button>
                        </div>
                        
                        {pedido.nfe && (
                          <div className="space-y-1 border-t border-slate-200/60 pt-3 bg-blue-50/50 -mx-4 -mb-4 p-4 rounded-b-2xl border-b border-l border-r border-blue-100/50">
                            <p className="text-[10px] font-black text-[#0071e3] uppercase tracking-wider">Nota Fiscal Emitida</p>
                            <p className="text-xs text-slate-700 font-bold">NFe Nº {pedido.nfe.numero}</p>
                            <p className="text-[9px] text-slate-400 font-mono break-all leading-tight">Chave: {pedido.nfe.chaveAccess || pedido.nfe.chaveAcesso}</p>
                          </div>
                        )}
                      </div>
                      {/* Order History */}
                      <div className="md:col-span-3 mt-4">
                        <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                          <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1">
                            <FileText size={12} className="text-[#0071e3]" />
                            Histórico do Pedido
                          </h4>
                          <div className="relative pl-4 space-y-4 before:absolute before:inset-y-0 before:left-[7px] before:w-[2px] before:bg-slate-200">
                            {(pedido.historico || []).map((evento: any, idx: number) => (
                              <div key={idx} className="relative">
                                <div className="absolute -left-[21px] w-4 h-4 rounded-full bg-blue-100 border-[3px] border-white flex items-center justify-center">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                                </div>
                                <div className="ml-2">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-0.5">
                                    <span className="font-bold text-slate-900 text-[13px]">
                                      {evento.statusAnterior ? (
                                        <>
                                          <span className="text-slate-500 font-medium">{evento.statusAnterior}</span>
                                          <span className="mx-1.5 text-slate-400">→</span>
                                          <span>{evento.novoStatus || evento.status || evento.evento}</span>
                                        </>
                                      ) : (
                                        evento.status || evento.evento
                                      )}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-100">
                                      {new Date(evento.dataHora || evento.data).toLocaleString("pt-BR")}
                                    </span>
                                  </div>
                                  {(evento.observacao || evento.descricao) && (
                                    <p className="text-xs text-slate-600 leading-relaxed mt-1">
                                      {evento.observacao || evento.descricao}
                                    </p>
                                  )}
                                  {evento.usuario && (
                                    <p className="text-[10px] text-slate-400 mt-1">
                                      Responsável: {evento.usuario}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                            {(!pedido.historico || pedido.historico.length === 0) && (
                              <p className="text-xs text-slate-500 italic pl-2">Nenhum histórico registrado.</p>
                            )}
                          </div>
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

      {/* Mercado Pago Payment Modal */}
      {payingPedido && mpConfig && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-xl text-[#0071e3]">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-950 text-base">Efetuar Pagamento</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Pedido {payingPedido.id_externo || `PED-${payingPedido.numero}`}</p>
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
              <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-2xl flex items-start gap-2.5 text-xs text-[#0071e3]">
                <span className="text-base">🛡️</span>
                <div>
                  <p className="font-bold">Checkout Integrado do Mercado Pago</p>
                  <p className="text-slate-600 leading-normal mt-0.5">
                    Utilizando chaves seguras homologadas do administrador. O pagamento irá liquidar e conciliar a fatura de forma automática e instantânea.
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-baseline bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Valor a Pagar:</span>
                <span className="text-xl font-black text-[#0071e3]">
                  R$ {(payingPedido.totais?.totalPedido || payingPedido.pagamento?.valor || 0).toFixed(2)}
                </span>
              </div>

              {/* Method choice */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Forma de Pagamento</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("17")}
                    className={`p-3 rounded-xl border font-bold text-xs transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      paymentMethod === "17"
                        ? "border-[#0071e3] bg-blue-50/30 text-[#0071e3]"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>⚡ PIX</span>
                    <span className="text-[9px] font-normal text-slate-400">Compensação instantânea</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("03")}
                    className={`p-3 rounded-xl border font-bold text-xs transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      paymentMethod === "03"
                        ? "border-[#0071e3] bg-blue-50/30 text-[#0071e3]"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>💳 Cartão</span>
                    <span className="text-[9px] font-normal text-slate-400">Em até 12 parcelas</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handlePayWithMercadoPago} className="space-y-4 pt-1">
                {paymentMethod === "17" ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-3">
                    <p className="text-xs font-bold text-slate-600">Escaneie o QR Code ou copie a linha PIX abaixo</p>
                    <div className="w-32 h-32 bg-white border border-slate-200 rounded-xl mx-auto p-2 flex items-center justify-center">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                          gerarPixCopiaECola({
                            chave: "63680806-d418-4b0b-9ef4-6562cde069d9",
                            valor: payingPedido.totais?.totalPedido || payingPedido.pagamento?.valor || 0,
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
                            valor: payingPedido.totais?.totalPedido || payingPedido.pagamento?.valor || 0,
                            nomeRecebedor: "Uniao Condominial",
                            cidadeRecebedor: "Goiania",
                            txid: "MPED" + (payingPedido.id_externo || payingPedido.id || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 10)
                          });
                          navigator.clipboard.writeText(code);
                          alert("Código PIX Copia e Cola copiado com sucesso!");
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0071e3] hover:underline bg-white py-2 px-4 rounded-xl border border-slate-200 shadow-3xs transition-all active:scale-95"
                      >
                        <Clipboard size={12} />
                        Copiar código PIX Copia e Cola
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-400 font-medium">
                      O sistema identificará a transferência em segundos através da conciliação do seu Access Token.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Nome no Cartão</label>
                      <input 
                        type="text" 
                        required
                        placeholder="NOME IMPRESSO NO CARTÃO"
                        value={cardNome}
                        onChange={(e) => setCardNome(e.target.value.toUpperCase())}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#0071e3]/20"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Número do Cartão</label>
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
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#0071e3]/20"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Validade</label>
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
                          className="w-full p-2.5 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#0071e3]/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Código CVV</label>
                        <input 
                          type="text" 
                          required
                          placeholder="123"
                          maxLength={4}
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ""))}
                          className="w-full p-2.5 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#0071e3]/20"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-[#0071e3] hover:bg-[#0071e3]/90 text-white font-bold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer mt-4"
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
