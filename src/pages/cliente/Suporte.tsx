import React, { useState, useEffect, useRef } from "react";
import { 
  Headphones, MessageCircle, Send, ShoppingBag, Clock, 
  CheckCircle, Truck, AlertCircle, ChevronDown, Sparkles, 
  User, Bot, Phone, Mail, MessageSquare, ShieldCheck, 
  HelpCircle, ChevronRight, FileText, CheckCircle2
} from "lucide-react";
import { 
  collection, addDoc, onSnapshot, query, where, orderBy 
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

export default function Suporte() {
  const { profile } = useAuth();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [selectedPedidoId, setSelectedPedidoId] = useState<string>("geral");
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [inputText, setInputText] = useState("");
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [sending, setSending] = useState(false);
  const [botTyping, setBotTyping] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensagens, botTyping]);

  // Carrega os pedidos do cliente para seleção
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
        const loaded: any[] = [];
        snapshot.forEach((docSnap) => {
          loaded.push({ firebaseId: docSnap.id, ...docSnap.data() });
        });
        loaded.sort((a, b) => {
          const tA = a.dataHora ? new Date(a.dataHora).getTime() : 0;
          const tB = b.dataHora ? new Date(b.dataHora).getTime() : 0;
          return tB - tA;
        });
        setPedidos(loaded);
        setLoadingOrders(false);
      },
      (err) => {
        console.error("Erro ao carregar pedidos para suporte:", err);
        setLoadingOrders(false);
      }
    );

    return () => unsubscribe();
  }, [profile]);

  // Mensagem inicial de boas-vindas
  useEffect(() => {
    if (mensagens.length === 0) {
      const initialMsg: MensagemChat = {
        sender: "bot",
        senderName: "Atendente Virtual",
        text: `Olá, ${profile?.displayName || "Cliente"}! 👋 Bem-vindo à Central de Atendimento e Suporte da União Condominial.GO. Como podemos te ajudar hoje? Você pode selecionar um pedido abaixo ou digitar sua dúvida.`,
        dataHora: new Date().toISOString(),
        pedidoContexto: "geral",
      };
      setMensagens([initialMsg]);
    }
  }, [profile]);

  const selectedPedidoObj = pedidos.find(
    (p) =>
      p.numeroPedido === selectedPedidoId ||
      p.codigoPedido === selectedPedidoId ||
      p.firebaseId === selectedPedidoId
  );

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || sending) return;

    const novaMensagem: MensagemChat = {
      sender: "cliente",
      senderName: profile?.displayName || "Cliente",
      text: textToSend,
      dataHora: new Date().toISOString(),
      pedidoContexto: selectedPedidoId,
    };

    setMensagens((prev) => [...prev, novaMensagem]);
    setInputText("");
    setSending(true);

    try {
      if (profile?.uid || profile?.email) {
        await addDoc(collection(db, "suporte_mensagens"), {
          ...novaMensagem,
          clienteUid: profile?.uid || "",
          clienteEmail: profile?.email || "",
          clienteNome: profile?.displayName || "Cliente",
          statusAtendimento: "Aberto",
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn("Mensagem salva localmente no chat:", err);
    } finally {
      setSending(false);
    }

    // Auto-resposta do bot
    setBotTyping(true);
    setTimeout(() => {
      setBotTyping(false);
      let replyText = "";
      const lower = textToSend.toLowerCase();

      if (lower.includes("status") || lower.includes("rastreio") || lower.includes("onde está") || lower.includes("chega")) {
        if (selectedPedidoObj) {
          const status = selectedPedidoObj.status || "Em Processamento";
          const dataEntrega = selectedPedidoObj.dataEntregaEstimada 
            ? `\n📅 Previsão de entrega: ${selectedPedidoObj.dataEntregaEstimada}` 
            : "";
          replyText = `📦 O status atual do pedido #${selectedPedidoObj.numeroPedido || selectedPedidoObj.codigoPedido || selectedPedidoObj.firebaseId} é: **${status}**.${dataEntrega}\n\nNossa equipe de logística está acompanhando cada etapa para garantir a entrega rápida e segura no seu condomínio.`;
        } else {
          replyText = `📦 Selecione o pedido desejado no menu acima para consultar o status em tempo real, ou informe o número do pedido aqui no chat.`;
        }
      } else if (lower.includes("endereço") || lower.includes("local") || lower.includes("entrega")) {
        replyText = `📍 Para alterações no endereço de entrega ou inclusão de instruções específicas para a portaria, nossa equipe administrativa pode atualizar os dados antes do envio. Por favor, confirme o número do pedido e o novo endereço com ponto de referência.`;
      } else if (lower.includes("pagamento") || lower.includes("pix") || lower.includes("cartão") || lower.includes("cashback") || lower.includes("boleto")) {
        replyText = `💳 Pagamentos via Pix são confirmados instantaneamente. Boletos faturados para condomínios possuem compensação em até 1 dia útil. O seu saldo de cashback é creditado na carteira automaticamente após a entrega dos produtos!`;
      } else if (lower.includes("atendente") || lower.includes("humano") || lower.includes("falar com alguém")) {
        replyText = `👨‍💼 Um de nossos consultores da União Condominial.GO visualizou a sua mensagem e prestará assistência personalizada aqui ou via WhatsApp.`;
      } else {
        replyText = `Recebemos sua solicitação! Nossa central de suporte está à disposição. Se desejar atendimento direto, você também pode nos contatar pelo WhatsApp (62) 99925-0523.`;
      }

      setMensagens((prev) => [
        ...prev,
        {
          sender: "bot",
          senderName: "Atendente Virtual",
          text: replyText,
          dataHora: new Date().toISOString(),
          pedidoContexto: selectedPedidoId,
        },
      ]);
    }, 1000);
  };

  const getStatusBadge = (status: string) => {
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

  const faqs = [
    {
      q: "Qual o prazo padrão de entrega para Goiânia e Região Metropolitana?",
      a: "Para condomínios cadastrados em Goiânia, Aparecida de Goiânia e região metropolitana, o prazo padrão é de 24 a 48 horas úteis após a confirmação do pedido."
    },
    {
      q: "Como funciona a emissão de nota fiscal e boleto para o Condomínio?",
      a: "As notas fiscais e boletos são emitidos diretamente no CNPJ do Condomínio cadastrado, facilitando a prestação de contas do síndico e administradora."
    },
    {
      q: "Como utilizar o saldo acumulado de Cashback?",
      a: "Você pode utilizar o saldo acumulado para abater no valor das próximas compras de produtos de limpeza ou solicitar resgate via PIX diretamente na aba 'Meu Cashback'."
    },
    {
      q: "Como agendar um serviço rotineiro com desconto?",
      a: "Acesse a aba 'Serviços Condominiais Rotineiros', escolha os serviços necessários e indique a data de preferência na nossa Agenda Virtual."
    }
  ];

  return (
    <div id="suporte-page" className="max-w-6xl mx-auto space-y-6">
      {/* Header da Página */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 text-[#0071e3] text-xs font-bold uppercase tracking-wider mb-2 border border-sky-100">
            <Headphones size={14} />
            <span>Central de Relacionamento</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Fale Conosco - Suporte
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Atendimento exclusivo para condomínios afiliados à <strong>União Condominial.<span className="text-emerald-600 font-bold">GO</span></strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 text-xs font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <span>Atendimento Online</span>
          </div>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Esquerda: Chat Interativo de Suporte */}
        <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden min-h-[580px]">
          {/* Header do Chat */}
          <div className="bg-gradient-to-r from-[#0071e3] to-[#005bb5] text-white p-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center border border-white/25 shadow-inner">
                <Headphones size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm flex items-center gap-1">
                  <span className="text-sky-200">Suporte União Condominial.</span>
                  <span className="text-emerald-300 font-extrabold">GO</span>
                </h3>
                <p className="text-xs text-blue-100 font-normal">
                  Respostas instantâneas e suporte aos seus pedidos
                </p>
              </div>
            </div>
          </div>

          {/* Seletor de Contexto do Pedido */}
          <div className="bg-slate-50 p-3.5 border-b border-slate-200">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag size={13} className="text-[#0071e3]" />
                Atendimento referente a qual pedido?
              </label>
            </div>

            <div className="relative">
              <select
                value={selectedPedidoId}
                onChange={(e) => setSelectedPedidoId(e.target.value)}
                className="w-full bg-white text-slate-800 text-xs font-semibold rounded-xl border border-slate-300 py-2.5 pl-3 pr-8 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#0071e3] transition-all appearance-none cursor-pointer"
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
              <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
            </div>

            {selectedPedidoObj && (
              <div className="mt-2.5 bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between text-xs">
                <div className="min-w-0">
                  <span className="font-bold text-slate-900">
                    Pedido #{selectedPedidoObj.numeroPedido || selectedPedidoObj.codigoPedido || selectedPedidoObj.firebaseId}
                  </span>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {selectedPedidoObj.itens?.length || 0} item(ns) • Total: R$ {Number(selectedPedidoObj.total || 0).toFixed(2).replace(".", ",")}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <span className={`inline-block px-2.5 py-1 text-[11px] font-bold rounded-full border ${getStatusBadge(selectedPedidoObj.status).bg}`}>
                    {getStatusBadge(selectedPedidoObj.status).label}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Chips com Perguntas Rápidas */}
          <div className="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200 flex gap-2 overflow-x-auto text-xs scrollbar-none">
            <button
              onClick={() => handleSendMessage("Qual o status do meu pedido?")}
              className="shrink-0 bg-white hover:bg-sky-50 text-slate-700 hover:text-[#0071e3] font-semibold px-3 py-1.5 rounded-full border border-slate-200 shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Truck size={13} className="text-[#0071e3]" />
              Status do Pedido
            </button>
            <button
              onClick={() => handleSendMessage("Quero alterar o endereço de entrega")}
              className="shrink-0 bg-white hover:bg-sky-50 text-slate-700 hover:text-[#0071e3] font-semibold px-3 py-1.5 rounded-full border border-slate-200 shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
            >
              <AlertCircle size={13} className="text-amber-500" />
              Alterar Endereço
            </button>
            <button
              onClick={() => handleSendMessage("Dúvida sobre Pagamento / Cashback")}
              className="shrink-0 bg-white hover:bg-sky-50 text-slate-700 hover:text-[#0071e3] font-semibold px-3 py-1.5 rounded-full border border-slate-200 shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Sparkles size={13} className="text-emerald-500" />
              Pagamento & Cashback
            </button>
            <button
              onClick={() => handleSendMessage("Quero falar com um atendente humano")}
              className="shrink-0 bg-white hover:bg-sky-50 text-slate-700 hover:text-[#0071e3] font-semibold px-3 py-1.5 rounded-full border border-slate-200 shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
            >
              <User size={13} className="text-indigo-500" />
              Falar com Atendente
            </button>
          </div>

          {/* Área de Mensagens */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/50 max-h-[400px]">
            {mensagens.map((msg, idx) => {
              const isUser = msg.sender === "cliente";
              const isBot = msg.sender === "bot";

              return (
                <div
                  key={msg.id || idx}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[11px] font-bold text-slate-400">
                      {isUser ? "Você" : isBot ? "Atendente Virtual" : msg.senderName || "Suporte"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {msg.dataHora ? new Date(msg.dataHora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>

                  <div
                    className={`
                      max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-xs whitespace-pre-line
                      ${
                        isUser
                          ? "bg-[#0071e3] text-white rounded-br-none"
                          : isBot
                          ? "bg-white text-slate-800 border border-slate-200 rounded-bl-none font-sans"
                          : "bg-emerald-700 text-white rounded-bl-none"
                      }
                    `}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {botTyping && (
              <div className="flex items-center gap-2 text-xs text-slate-500 italic bg-white p-3 rounded-xl border border-slate-200 w-fit">
                <Bot size={15} className="text-[#0071e3] animate-spin" />
                <span>Atendente digitando...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Formulário de Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-2.5"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Digite sua dúvida ou mensagem para nossa equipe..."
              className="flex-1 bg-slate-100 text-slate-800 text-xs sm:text-sm rounded-xl px-4 py-3 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:bg-white transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || sending}
              className="bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-50 text-white px-5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm active:scale-95 flex items-center gap-2 shrink-0"
            >
              <Send size={16} />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </form>
        </div>

        {/* Coluna Direita: Informações de Contato e FAQ */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card Canais de Atendimento */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Phone className="text-[#0071e3] w-5 h-5" />
              <span>Canais Diretos de Contato</span>
            </h3>

            <div className="space-y-3">
              <a
                href="https://wa.me/5562999250523"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-200 flex items-start gap-3 transition-colors group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 group-hover:bg-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 transition-colors">
                  <MessageSquare size={18} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">WhatsApp Suporte</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Conversar</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 mt-0.5 group-hover:text-emerald-700 transition-colors">(62) 99925-0523</p>
                  <p className="text-[11px] text-slate-500">Atendimento rápido para síndicos e gestores</p>
                </div>
              </a>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#0071e3] flex items-center justify-center shrink-0">
                  <Mail size={18} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">E-mail Oficial</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">suporte@uniaocondominial.com.br</p>
                  <p className="text-[11px] text-slate-500">Envio de notas fiscais e relatórios</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Clock size={18} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Horário de Operação</span>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">Segunda a Sexta: 08h às 18h</p>
                  <p className="text-xs text-slate-600">Sábado: 08h às 12h</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card Perguntas Frequentes */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
              <HelpCircle className="text-[#0071e3] w-5 h-5" />
              <span>Dúvidas Frequentes</span>
            </h3>

            <div className="space-y-2.5">
              {faqs.map((faq, idx) => {
                const isOpen = faqOpen === idx;
                return (
                  <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setFaqOpen(isOpen ? null : idx)}
                      className="w-full text-left p-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between gap-2 transition-colors text-xs font-bold text-slate-800"
                    >
                      <span>{faq.q}</span>
                      <ChevronRight size={14} className={`text-slate-400 shrink-0 transform transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="p-3 bg-white text-xs text-slate-600 leading-relaxed border-t border-slate-200">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
