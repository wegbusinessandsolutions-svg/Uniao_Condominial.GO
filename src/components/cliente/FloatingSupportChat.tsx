import React, { useState, useEffect, useRef } from "react";
import { 
  MessageCircle, X, Send, Headphones, ShoppingBag, 
  Clock, CheckCircle, Truck, AlertCircle, ChevronDown, 
  Sparkles, RefreshCw, Paperclip, User, Bot, Minimize2
} from "lucide-react";
import { 
  collection, doc, setDoc, addDoc, onSnapshot, query, where, orderBy, getDocs 
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";

interface MensagemChat {
  id?: string;
  sender: "cliente" | "suporte" | "bot" | "sistema";
  senderName: string;
  text: string;
  dataHora: string;
  pedidoContexto?: string;
}

export default function FloatingSupportChat() {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [selectedPedidoId, setSelectedPedidoId] = useState<string>("geral");
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [inputText, setInputText] = useState("");
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [botTyping, setBotTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [mensagens, isOpen, botTyping]);

  // Load customer orders from Firestore for selection
  useEffect(() => {
    if (!profile?.email && !profile?.uid) return;

    setLoadingOrders(true);
    const q = query(
      collection(db, "pedidos_venda"),
      where("cliente.email", "==", profile.email)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          firebaseId: docSnap.id,
          ...docSnap.data(),
        }));
        // Sort newest first
        list.sort(
          (a: any, b: any) =>
            new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
        );
        setPedidos(list);
        setLoadingOrders(false);

        // Auto select first/latest order if available and still on "geral"
        if (list.length > 0 && selectedPedidoId === "geral") {
          const firstOrder = list[0] as any;
          const firstOrderId = firstOrder.numeroPedido || firstOrder.codigoPedido || firstOrder.firebaseId;
          setSelectedPedidoId(firstOrderId);
        }
      },
      (error) => {
        console.error("Erro ao carregar pedidos no chat:", error);
        setLoadingOrders(false);
      }
    );

    return () => unsubscribe();
  }, [profile]);

  // Determine chat document ID based on user and selected order
  const chatDocId = profile?.uid
    ? `chat_${profile.uid}_${selectedPedidoId.replace(/[^a-zA-Z0-9]/g, "_")}`
    : "chat_guest";

  // Listen to real-time chat messages from Firestore
  useEffect(() => {
    if (!profile?.uid) return;

    const messagesRef = collection(db, "suporte_pedidos", chatDocId, "mensagens");
    const q = query(messagesRef, orderBy("dataHora", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const msgs: MensagemChat[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as MensagemChat),
          }));
          setMensagens(msgs);

          // Calculate unread count if chat closed
          if (!isOpen) {
            const unread = msgs.filter(m => m.sender === "suporte" || m.sender === "bot").length;
            setUnreadCount(unread > 0 ? 1 : 0);
          } else {
            setUnreadCount(0);
          }
        } else {
          // Send initial welcome message if chat is empty
          initWelcomeMessage();
        }
      },
      (error) => {
        console.error("Erro ao escutar mensagens do chat:", error);
      }
    );

    return () => unsubscribe();
  }, [profile, chatDocId, selectedPedidoId, isOpen]);

  // Initialize initial welcome message for this ticket
  const initWelcomeMessage = async () => {
    if (!profile?.uid) return;

    const initialMsg: MensagemChat = {
      sender: "bot",
      senderName: "Atendente Virtual",
      text: `Olá, ${profile.displayName || "Cliente"}! 👋 Bem-vindo ao Suporte de Pedidos da União Condominial.GO. ${
        selectedPedidoId !== "geral"
          ? `Estou pronto para ajudar você com o pedido #${selectedPedidoId}.`
          : "Como posso te ajudar com seus pedidos hoje?"
      }`,
      dataHora: new Date().toISOString(),
      ...(selectedPedidoId !== "geral" ? { pedidoContexto: selectedPedidoId } : {}),
    };

    try {
      // Create main chat document
      const parentDocRef = doc(db, "suporte_pedidos", chatDocId);
      await setDoc(parentDocRef, {
        chatId: chatDocId,
        clienteUid: profile.uid,
        clienteNome: profile.displayName || "Cliente",
        clienteEmail: profile.email || "",
        pedidoId: selectedPedidoId,
        status: "aberto",
        updatedAt: new Date().toISOString(),
        lastMessage: initialMsg.text,
      }, { merge: true });

      // Add initial message
      await addDoc(collection(db, "suporte_pedidos", chatDocId, "mensagens"), initialMsg);
    } catch (err) {
      console.error("Erro ao criar mensagem inicial de suporte:", err);
    }
  };

  const getSelectedPedidoObj = () => {
    if (selectedPedidoId === "geral") return null;
    return pedidos.find(
      (p) =>
        p.numeroPedido === selectedPedidoId ||
        p.codigoPedido === selectedPedidoId ||
        p.firebaseId === selectedPedidoId
    );
  };

  // Helper to send a message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !profile?.uid) return;

    if (!textToSend) setInputText("");
    setSending(true);

    const userMsg: MensagemChat = {
      sender: "cliente",
      senderName: profile.displayName || "Você",
      text,
      dataHora: new Date().toISOString(),
      ...(selectedPedidoId !== "geral" ? { pedidoContexto: selectedPedidoId } : {}),
    };

    try {
      const parentDocRef = doc(db, "suporte_pedidos", chatDocId);
      await setDoc(
        parentDocRef,
        {
          chatId: chatDocId,
          clienteUid: profile.uid,
          clienteNome: profile.displayName || "Cliente",
          clienteEmail: profile.email || "",
          pedidoId: selectedPedidoId,
          status: "aberto",
          updatedAt: new Date().toISOString(),
          lastMessage: text,
          unreadAdmin: true,
        },
        { merge: true }
      );

      await addDoc(collection(db, "suporte_pedidos", chatDocId, "mensagens"), userMsg);
      setSending(false);

      // Check if trigger keywords for automated bot assistant match
      processBotAutoReply(text);
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      setSending(false);
    }
  };

  // Bot logic for instant automated response about order status & help
  const processBotAutoReply = async (userText: string) => {
    const lower = userText.toLowerCase();
    const pedidoObj = getSelectedPedidoObj();

    let replyText = "";

    if (lower.includes("status") || lower.includes("onde está") || lower.includes("rastre") || lower.includes("previsão")) {
      if (pedidoObj) {
        const statusStr = pedidoObj.status || "Em Processamento";
        const totalStr = pedidoObj.totais?.totalPedido 
          ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(pedidoObj.totais.totalPedido)
          : "";
        const dataStr = pedidoObj.dataHora ? new Date(pedidoObj.dataHora).toLocaleDateString("pt-BR") : "";

        replyText = `📦 **Informações em tempo real do Pedido #${selectedPedidoId}**:\n` +
          `• **Status Atual**: ${statusStr}\n` +
          (dataStr ? `• **Data do Pedido**: ${dataStr}\n` : "") +
          (totalStr ? `• **Valor Total**: ${totalStr}\n` : "") +
          (pedidoObj.cliente?.endereco ? `• **Endereço de Entrega**: ${pedidoObj.cliente.endereco}\n` : "") +
          `\nSeu pedido está registrado em nosso sistema. Qualquer atualização adicional de transporte será refletida aqui instantaneamente!`;
      } else {
        replyText = `Você possui ${pedidos.length} pedido(s) cadastrado(s). Selecione um pedido específico no menu acima para verificar o status e o rastreamento em tempo real!`;
      }
    } else if (lower.includes("endereço") || lower.includes("local") || lower.includes("mudar")) {
      replyText = `📍 Para solicitar a alteração do endereço de entrega do seu pedido, nossa equipe de expedição foi notificada! Por favor, confirme o novo endereço completo e o número do condomínio/bloco.`;
    } else if (lower.includes("pagamento") || lower.includes("pix") || lower.includes("cartão") || lower.includes("cashback")) {
      replyText = `💳 Para pagamentos via PIX, a confirmação ocorre em poucos segundos. Pagamentos via Cartão passam por análise de segurança da operadora. Seu saldo de cashback é creditado automaticamente após a entrega do pedido!`;
    } else if (lower.includes("atendente") || lower.includes("humano") || lower.includes("falar com alguém")) {
      replyText = `👨‍💼 Um de nossos atendentes da União Condominial.GO visualizou a sua mensagem e responderá neste chat em instantes!`;
    }

    if (replyText) {
      setBotTyping(true);
      setTimeout(async () => {
        try {
          const botMsg: MensagemChat = {
            sender: "bot",
            senderName: "Atendente Virtual",
            text: replyText,
            dataHora: new Date().toISOString(),
            ...(selectedPedidoId !== "geral" ? { pedidoContexto: selectedPedidoId } : {}),
          };
          await addDoc(collection(db, "suporte_pedidos", chatDocId, "mensagens"), botMsg);
        } catch (e) {
          console.error("Erro no auto reply do bot:", e);
        } finally {
          setBotTyping(false);
        }
      }, 1000);
    }
  };

  const selectedPedidoObj = getSelectedPedidoObj();

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "A Caminho":
      case "Em Trânsito":
        return { label: "A Caminho", bg: "bg-amber-100 text-amber-800 border-amber-200" };
      case "Entregue":
      case "Concluído":
        return { label: "Entregue", bg: "bg-emerald-100 text-emerald-800 border-emerald-200" };
      case "Em Separação":
      case "Aprovado":
        return { label: "Em Separação", bg: "bg-blue-100 text-blue-800 border-blue-200" };
      case "Cancelado":
        return { label: "Cancelado", bg: "bg-rose-100 text-rose-800 border-rose-200" };
      default:
        return { label: status || "Pendente", bg: "bg-slate-100 text-slate-800 border-slate-200" };
    }
  };

  return (
    <>
      {/* Botão Flutuante (Bottom-Right) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {!isOpen && (
          <button
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
              setUnreadCount(0);
            }}
            className="group flex items-center gap-3 bg-[#0071e3] hover:bg-[#0077ed] text-white px-5 py-3.5 rounded-full shadow-2xl transition-all transform hover:scale-105 active:scale-95 border border-white/20"
            title="Suporte em tempo real"
          >
            <div className="relative">
              <MessageCircle size={24} className="animate-pulse" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white animate-bounce" />
              )}
            </div>
            <span className="font-bold text-sm tracking-wide hidden sm:inline">
              Suporte Pedidos
            </span>
            <span className="bg-white/20 text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full text-white">
              Online
            </span>
          </button>
        )}

        {/* Janela do Chat de Suporte */}
        {isOpen && (
          <div
            className={`
              w-[92vw] sm:w-[410px] bg-white rounded-2xl shadow-2xl border border-slate-200 
              flex flex-col overflow-hidden transition-all duration-300 z-50
              ${isMinimized ? "h-[64px]" : "h-[560px] max-h-[82vh]"}
            `}
          >
            {/* Header do Chat */}
            <div className="bg-gradient-to-r from-[#0071e3] to-sky-700 p-4 text-white flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/20 shrink-0">
                  <Headphones size={20} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-extrabold text-sm tracking-tight truncate text-sky-200">
                      Suporte União Condominial.<span className="text-emerald-300 font-extrabold">GO</span>
                    </h3>
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  </div>
                  <p className="text-[11px] text-sky-100 truncate">
                    Atendimento em tempo real sobre seus pedidos
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors"
                  title={isMinimized ? "Expandir" : "Minimizar"}
                >
                  <Minimize2 size={16} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors"
                  title="Fechar Chat"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Seletor de Pedido para Contexto */}
                <div className="bg-slate-50 p-3 border-b border-slate-200 shrink-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <ShoppingBag size={12} className="text-[#0071e3]" />
                      Atendimento referente ao pedido:
                    </label>
                  </div>

                  <div className="relative">
                    <select
                      value={selectedPedidoId}
                      onChange={(e) => setSelectedPedidoId(e.target.value)}
                      className="w-full bg-white text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 py-2 pl-3 pr-8 shadow-2xl focus:outline-none focus:ring-2 focus:ring-[#0071e3] transition-all appearance-none cursor-pointer"
                    >
                      <option value="geral">Dúvida / Atendimento Geral</option>
                      {pedidos.map((p) => {
                        const num = p.numeroPedido || p.codigoPedido || p.firebaseId;
                        const status = p.status || "Pendente";
                        return (
                          <option key={p.firebaseId || num} value={num}>
                            Pedido #{num} ({status})
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Card do Pedido Selecionado */}
                  {selectedPedidoObj && (
                    <div className="mt-2.5 bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xl flex items-center justify-between text-xs">
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800">
                          #{selectedPedidoObj.numeroPedido || selectedPedidoObj.codigoPedido || selectedPedidoObj.firebaseId}
                        </span>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {selectedPedidoObj.itens?.length || 0} item(ns) • {selectedPedidoObj.dataHora ? new Date(selectedPedidoObj.dataHora).toLocaleDateString("pt-BR") : ""}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full border ${getStatusBadge(selectedPedidoObj.status).bg}`}>
                          {getStatusBadge(selectedPedidoObj.status).label}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sugestões Rápidas (Chips) */}
                <div className="px-3 py-2 bg-slate-100/70 border-b border-slate-200 flex gap-1.5 overflow-x-auto text-[11px] scrollbar-none shrink-0">
                  <button
                    onClick={() => handleSendMessage("Qual o status do meu pedido?")}
                    className="shrink-0 bg-white hover:bg-sky-50 text-slate-700 hover:text-[#0071e3] font-medium px-2.5 py-1 rounded-full border border-slate-200 shadow-2xl transition-all flex items-center gap-1 active:scale-95"
                  >
                    <Truck size={12} className="text-[#0071e3]" />
                    Status do Pedido
                  </button>
                  <button
                    onClick={() => handleSendMessage("Quero alterar o endereço de entrega")}
                    className="shrink-0 bg-white hover:bg-sky-50 text-slate-700 hover:text-[#0071e3] font-medium px-2.5 py-1 rounded-full border border-slate-200 shadow-2xl transition-all flex items-center gap-1 active:scale-95"
                  >
                    <AlertCircle size={12} className="text-amber-500" />
                    Alterar Endereço
                  </button>
                  <button
                    onClick={() => handleSendMessage("Dúvida sobre Pagamento / Cashback")}
                    className="shrink-0 bg-white hover:bg-sky-50 text-slate-700 hover:text-[#0071e3] font-medium px-2.5 py-1 rounded-full border border-slate-200 shadow-2xl transition-all flex items-center gap-1 active:scale-95"
                  >
                    <Sparkles size={12} className="text-emerald-500" />
                    Pagamento & Cashback
                  </button>
                  <button
                    onClick={() => handleSendMessage("Quero falar com um atendente humano")}
                    className="shrink-0 bg-white hover:bg-sky-50 text-slate-700 hover:text-[#0071e3] font-medium px-2.5 py-1 rounded-full border border-slate-200 shadow-2xl transition-all flex items-center gap-1 active:scale-95"
                  >
                    <User size={12} className="text-indigo-500" />
                    Atendente Humano
                  </button>
                </div>

                {/* ÁREA DE MENSAGENS (Scrollable) */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
                  {mensagens.map((msg, idx) => {
                    const isUser = msg.sender === "cliente";
                    const isBot = msg.sender === "bot";

                    return (
                      <div
                        key={msg.id || idx}
                        className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-1 mb-1 px-1">
                          <span className="text-[10px] font-bold text-slate-400">
                            {isUser ? "Você" : isBot ? "Atendente Virtual" : msg.senderName || "Suporte"}
                          </span>
                          <span className="text-[9px] text-slate-300">
                            {msg.dataHora ? new Date(msg.dataHora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                        </div>

                        <div
                          className={`
                            max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-xs whitespace-pre-line
                            ${
                              isUser
                                ? "bg-[#0071e3] text-white rounded-br-none"
                                : isBot
                                ? "bg-white text-slate-800 border border-slate-200/80 rounded-bl-none font-sans"
                                : "bg-emerald-700 text-white rounded-bl-none"
                            }
                          `}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}

                  {/* Bot Typing Indicator */}
                  {botTyping && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 italic bg-white p-2.5 rounded-xl border border-slate-200 w-fit">
                      <Bot size={14} className="text-[#0071e3] animate-spin" />
                      <span>Atendente digitando...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* CAMPO DE INPUT */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
                >
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Digite sua dúvida sobre o pedido..."
                    className="flex-1 bg-slate-100 text-slate-800 text-xs rounded-xl px-3.5 py-2.5 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:bg-white transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || sending}
                    className="bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-50 text-white p-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center shrink-0"
                    title="Enviar mensagem"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
