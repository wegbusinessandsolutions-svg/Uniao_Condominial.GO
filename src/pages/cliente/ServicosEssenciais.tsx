import React, { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { isStaffRole } from "../../lib/permissions";
import { useAuth } from "../../context/AuthContext";
import { Wrench, CheckCircle, Plus, Minus, ShoppingBag, Trash2, X, Calendar, ClipboardList, Clock, Coins, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { compareSkuAscending } from "../../lib/serviceUtils";

// Standard fallback services if none registered in database
const DEFAULT_SERVICES = [
  { id: "def-1", codigo: "SERV-001", nome: "Limpeza de Caixa de Gordura", descricao: "Higienização e desobstrução completa de caixa de gordura predial com destinação adequada de resíduos.", valor: 150.00, prazoExecucaoHoras: 2, imagem: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80" },
  { id: "def-2", codigo: "SERV-002", nome: "Limpeza de Reservatório Inferior de Água", descricao: "Limpeza, higienização e desinfecção com emissão de laudo potabilidade.", valor: 280.00, prazoExecucaoHoras: 4, imagem: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=80" },
  { id: "def-3", codigo: "SERV-003", nome: "Limpeza de Caixa de Água", descricao: "Higienização técnica de caixas de água superiores conforme normas sanitárias.", valor: 220.00, prazoExecucaoHoras: 3, imagem: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80" },
  { id: "def-5", codigo: "SERV-005", nome: "Serviços de Jardinagem", descricao: "Poda de gramados e arbustos, adubação e limpeza geral de áreas verdes.", valor: 200.00, prazoExecucaoHoras: 3, imagem: "https://images.unsplash.com/photo-1558904541-efa8c196b27d?auto=format&fit=crop&w=600&q=80" },
  { id: "def-6", codigo: "SERV-006", nome: "Manutenção em Portas e Portões Eletrônicos", descricao: "Regulagem de motores, lubrificação de trilhos, ajuste de fim de curso e placas.", valor: 160.00, prazoExecucaoHoras: 2, imagem: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80" },
  { id: "def-7", codigo: "SERV-007", nome: "Manutenção de Cercas Elétricas", descricao: "Testes de tensão, substituição de hastes, isoladores e tensionamento de fios.", valor: 140.00, prazoExecucaoHoras: 2, imagem: "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=600&q=80" },
  { id: "def-8", codigo: "SERV-008", nome: "Serviços de Troca de Plafons, Spots LED e Emergência", descricao: "Substituição e reparo do sistema de iluminação de emergência e áreas comuns.", valor: 120.00, prazoExecucaoHoras: 2, imagem: "https://images.unsplash.com/photo-1565814636199-ae8133055c1c?auto=format&fit=crop&w=600&q=80" },
  { id: "def-9", codigo: "SERV-009", nome: "Serviços de Manutenção em Sistemas CFTV", descricao: "Revisão de câmeras, conectores, fonte de alimentação e alinhamento de imagens.", valor: 190.00, prazoExecucaoHoras: 3, imagem: "https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=600&q=80" },
  { id: "def-14", codigo: "SERV-014", nome: "Manutenção em Sistema de Alarme", descricao: "Manutenção preventiva e corretiva em centrais de alarme, sensores e sirenes.", valor: 150.00, prazoExecucaoHoras: 2, imagem: "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=600&q=80" },
  { id: "def-15", codigo: "SERV-015", nome: "Manutenção em Porteiros Eletrônicos", descricao: "Reparo e manutenção em interfones, porteiros eletrônicos e fechaduras elétricas.", valor: 130.00, prazoExecucaoHoras: 2, imagem: "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=600&q=80" }
];

// Helper function to safely extract numeric value from string or number
const parsePrice = (item: any): number => {
  if (!item) return 0;
  const val = typeof item === "object"
    ? (item.valor ?? item.preco ?? item.valorFixo ?? item.valor_fixo ?? item.price)
    : item;

  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    let cleaned = val.replace(/R\$\s?/gi, "").trim();
    if (cleaned.includes(",") && cleaned.includes(".")) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (cleaned.includes(",")) {
      cleaned = cleaned.replace(",", ".");
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

const formatCurrency = (val: number): string => {
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function ServicosEssenciais() {
  const [servicos, setServicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Quantities selected per item ID in the catalog
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({});
  
  // Cart items state: Array of { servico, quantidade }
  const [cartItems, setCartItems] = useState<{ servico: any; quantidade: number }[]>([]);
  
  // Drawer visibility
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Additional form fields
  const [dataPreferencial, setDataPreferencial] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [dateError, setDateError] = useState("");
  const [successModal, setSuccessModal] = useState(false);

  // Cashback abatement states
  const [useCashback, setUseCashback] = useState(false);
  const [cashbackOption, setCashbackOption] = useState<"total" | "parcial">("total");
  const [customCashbackAmount, setCustomCashbackAmount] = useState("");

  const getMinDateString = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      setDataPreferencial("");
      setDateError("");
      return;
    }

    const [year, month, day] = val.split("-").map(Number);
    const selectedDate = new Date(year, month - 1, day);

    const minAllowed = new Date();
    minAllowed.setHours(0, 0, 0, 0);
    minAllowed.setDate(minAllowed.getDate() + 7);

    if (selectedDate < minAllowed) {
      setDateError("O agendamento deve ser feito com no mínimo 7 dias de antecedência.");
      setDataPreferencial("");
      return;
    }

    const dayOfWeek = selectedDate.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      setDateError("Agendamentos disponíveis apenas de segunda a sexta-feira. Sábados e domingos não estão disponíveis.");
      setDataPreferencial("");
      return;
    }

    setDateError("");
    setDataPreferencial(val);
  };

  useEffect(() => {
    const fetchServicos = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "servicos_essenciais"));
        const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const listToUse = docs.length > 0 ? docs : DEFAULT_SERVICES;
        const sorted = [...listToUse].sort(compareSkuAscending);
        setServicos(sorted);
      } catch (error) {
        console.error("Erro ao buscar serviços:", error);
        const sortedDefaults = [...DEFAULT_SERVICES].sort(compareSkuAscending);
        setServicos(sortedDefaults);
      } finally {
        setLoading(false);
      }
    };
    fetchServicos();
  }, []);

  const getQuantity = (id: string) => quantities[id] || 1;

  const handleQuantityChange = (id: string, delta: number) => {
    setQuantities(prev => {
      const current = prev[id] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const handleAddToCart = (servico: any) => {
    if (isStaffRole(profile?.role)) {
      alert("Apenas clientes podem realizar solicitações de serviços no aplicativo.");
      return;
    }
    const qtd = getQuantity(servico.id);
    setCartItems(prev => {
      const existingIndex = prev.findIndex(item => item.servico.id === servico.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantidade += qtd;
        return updated;
      } else {
        return [...prev, { servico, quantidade: qtd }];
      }
    });

    // Reset local card quantity selector to 1
    setQuantities(prev => ({ ...prev, [servico.id]: 1 }));
    
    // Automatically open cart drawer to give immediate feedback
    setIsDrawerOpen(true);
  };

  const handleUpdateCartItemQty = (servicoId: string, delta: number) => {
    setCartItems(prev => {
      return prev.map(item => {
        if (item.servico.id === servicoId) {
          const newQty = item.quantidade + delta;
          return newQty > 0 ? { ...item, quantidade: newQty } : null;
        }
        return item;
      }).filter(Boolean) as { servico: any; quantidade: number }[];
    });
  };

  const handleRemoveCartItem = (servicoId: string) => {
    setCartItems(prev => prev.filter(item => item.servico.id !== servicoId));
  };

  const userCashback = Number(profile?.cashbackBalance || 0);
  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantidade, 0);
  const totalCartValue = cartItems.reduce((acc, item) => {
    return acc + (parsePrice(item.servico) * item.quantidade);
  }, 0);

  const maxCashbackDeductible = Math.min(userCashback, totalCartValue);

  let appliedCashback = 0;
  if (useCashback && userCashback > 0 && totalCartValue > 0) {
    if (cashbackOption === "total") {
      appliedCashback = maxCashbackDeductible;
    } else {
      const customNum = parseFloat(customCashbackAmount.replace(",", "."));
      if (!isNaN(customNum) && customNum > 0) {
        appliedCashback = Math.min(customNum, maxCashbackDeductible);
      }
    }
  }

  const finalPayableValue = Math.max(0, totalCartValue - appliedCashback);

  const handleSubmitOrder = async () => {
    if (!profile) {
      alert("Você precisa estar logado na sua conta de cliente para enviar a solicitação.");
      return;
    }

    if (cartItems.length === 0) {
      alert("Adicione ao menos um serviço para solicitar.");
      return;
    }

    if (!dataPreferencial) {
      setDateError("Por favor, escolha uma data preferencial válida (de segunda a sexta-feira, com antecedência mínima de 7 dias).");
      return;
    }

    setSubmitting(true);
    try {
      if (appliedCashback > 0) {
        // Verify latest balance directly from user doc
        const userRef = doc(db, "users", profile.uid);
        const userSnap = await getDoc(userRef);
        const freshBalance = Number(userSnap.data()?.cashbackBalance || 0);

        if (freshBalance < appliedCashback) {
          alert(`Saldo de cashback insuficiente. Seu saldo atual é R$ ${formatCurrency(freshBalance)}.`);
          setSubmitting(false);
          return;
        }

        const newBalance = Math.max(0, freshBalance - appliedCashback);

        // Deduct cashback balance from user in Firestore
        await updateDoc(userRef, {
          cashbackBalance: newBalance
        });

        // Record cashback transaction logs
        await addDoc(collection(db, "cashback_transactions"), {
          userId: profile.uid,
          type: "resgate_servico",
          amount: appliedCashback,
          description: `Abatimento em Ordem de Serviço`,
          date: new Date().toISOString(),
          createdAt: new Date(),
          status: "Aprovado"
        });

        await addDoc(collection(db, "users", profile.uid, "cashback_transactions"), {
          userId: profile.uid,
          type: "resgate_servico",
          amount: -appliedCashback,
          description: `Abatimento em Ordem de Serviço`,
          date: new Date().toISOString(),
          createdAt: new Date(),
          status: "Aprovado"
        });

        if (refreshProfile) {
          await refreshProfile();
        }
      }

      const mainServiceName = cartItems.length === 1 
        ? `${cartItems[0].quantidade}x ${cartItems[0].servico.nome}`
        : `${cartItems.length} Serviços: ` + cartItems.map(i => `${i.quantidade}x ${i.servico.nome}`).join(", ");

      const generateNumeroOS = (estado: string = "GO") => {
        const now = new Date();
        const dia = String(now.getDate()).padStart(2, '0');
        const mes = String(now.getMonth() + 1).padStart(2, '0');
        const hora = String(now.getHours()).padStart(2, '0');
        const minuto = String(now.getMinutes()).padStart(2, '0');
        const numero = String(Math.floor(Math.random() * 100)).padStart(2, '0');
        return `${estado}${dia}${mes}${hora}${minuto}${numero}`;
      };

      const orderPayload = {
        numeroOS: generateNumeroOS(profile?.endereco?.uf || "GO"),
        clienteId: profile.uid,
        clienteNome: (profile as any)?.displayName || (profile as any)?.nome || (profile as any)?.razaoSocial || (profile as any)?.nomeCondominio || (profile as any)?.name || profile?.email?.split('@')[0] || "Cliente",
        clienteEmail: profile.email || "",
        servicoNome: mainServiceName,
        valorOriginal: totalCartValue,
        cashbackUsado: appliedCashback,
        valor: finalPayableValue,
        valorFaturar: finalPayableValue,
        itens: cartItems.map(i => {
          const unitPrice = parsePrice(i.servico);
          return {
            servicoId: i.servico.id,
            nome: i.servico.nome,
            quantidade: i.quantidade,
            valorUnitario: unitPrice,
            subtotal: unitPrice * i.quantidade
          };
        }),
        dataPreferencial: dataPreferencial || "A combinar com departamento comercial",
        observacoes: observacoes || "",
        status: "Aguardando confirmação - Data",
        createdAt: new Date()
      };

      await addDoc(collection(db, "ordens_servico"), orderPayload);

      setCartItems([]);
      setDataPreferencial("");
      setObservacoes("");
      setUseCashback(false);
      setCustomCashbackAmount("");
      setIsDrawerOpen(false);
      setSuccessModal(true);
    } catch (error) {
      console.error("Erro ao enviar Ordem de Serviço:", error);
      alert("Ocorreu um erro ao enviar sua solicitação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 relative pb-12">
      {/* Header with Title and Top-Right Services Cart Icon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-sky-100 text-sky-800 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Tabela de Serviços
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Serviços Condominiais Rotineiros
          </h1>
          <p className="text-slate-500 text-sm mt-1 max-w-2xl">
            Catálogo com valores simbólicos para condomínios parceiros. Selecione os serviços desejados, ajuste as quantidades e envie sua Ordem de Serviço.
          </p>
        </div>

        {/* Top-Right Services Cart Icon Button */}
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="relative self-start sm:self-center bg-[#0071e3] hover:bg-[#0071e3]/90 text-white px-5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2.5 shadow-md active:scale-95 shrink-0"
        >
          <ClipboardList size={20} />
          <span>Solicitações de Serviços</span>
          {totalCartCount > 0 ? (
            <span className="bg-amber-400 text-slate-900 font-black text-xs h-6 min-w-6 px-1.5 rounded-full flex items-center justify-center animate-bounce shadow-sm">
              {totalCartCount}
            </span>
          ) : (
            <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
              0
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0071e3]"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {servicos.map(s => {
            const currentQty = getQuantity(s.id);
            const valorUnitario = parsePrice(s);

            return (
              <div
                key={s.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col h-full group"
              >
                {/* Image / Fallback */}
                <div className="aspect-video w-full bg-slate-100 relative overflow-hidden">
                  {s.imagem ? (
                    <img
                      src={s.imagem}
                      alt={s.nome}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          const placeholder = parent.querySelector(".fallback-placeholder");
                          if (placeholder) (placeholder as HTMLElement).style.display = "flex";
                        }
                      }}
                    />
                  ) : null}
                  <div
                    className={`fallback-placeholder w-full h-full bg-slate-50 items-center justify-center text-slate-300 ${
                      s.imagem ? "hidden" : "flex"
                    }`}
                  >
                    <Wrench size={40} />
                  </div>
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-700 shadow-2xs">
                    50% de Desconto sobre o Valor de Mercado
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-bold text-slate-900 text-base mb-1.5 line-clamp-2">
                    {s.nome}
                  </h3>
                  <p className="text-slate-500 text-xs mb-3 flex-1 line-clamp-3 leading-relaxed text-justify">
                    {s.descricao}
                  </p>

                  {(s.prazoExecucaoHoras || s.prazoPrevisto || s.prazoHoras || s.prazo_execucao) && (
                    <div className="flex items-center gap-1.5 text-slate-600 text-[11px] font-medium mb-2 bg-blue-50/60 text-blue-800 px-2.5 py-1 rounded-lg border border-blue-100/80 w-fit">
                      <Clock size={13} className="text-[#0071e3]" />
                      <span>Prazo previsto: <strong>{s.prazoExecucaoHoras || s.prazoPrevisto || s.prazoHoras || s.prazo_execucao}h</strong></span>
                    </div>
                  )}

                  {(s.preRequisitos || s.pre_requisitos || s.prerequisitos) && (
                    <div className="flex items-start gap-1.5 text-slate-600 text-[11px] font-medium mb-3 bg-amber-50/70 text-amber-900 px-2.5 py-1.5 rounded-lg border border-amber-200/80">
                      <ClipboardList size={14} className="text-amber-600 mt-0.5 shrink-0" />
                      <span className="line-clamp-2"><strong>Pré-requisitos:</strong> {s.preRequisitos || s.pre_requisitos || s.prerequisitos}</span>
                    </div>
                  )}

                  {/* Price display - Prominently visible for all users */}
                  <div className="mb-4 bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Valor Fixo</span>
                    <span className={`text-xl font-black ${valorUnitario === 0 ? 'text-slate-600' : 'text-[#0071e3]'}`}>
                      {valorUnitario === 0 ? "Sob consulta" : `R$ ${formatCurrency(valorUnitario)}`}
                    </span>
                  </div>

                  {/* Quantity selector */}
                  <div className="flex items-center justify-between bg-slate-100/80 rounded-xl p-1 mb-3">
                    <span className="text-xs font-semibold text-slate-600 pl-2">Qtd:</span>
                    <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-slate-200 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(s.id, -1)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-100 font-bold transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-xs font-extrabold text-slate-900">
                        {currentQty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(s.id, 1)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-100 font-bold transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={() => handleAddToCart(s)}
                    className="w-full bg-[#0071e3] hover:bg-[#0071e3]/90 text-white font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer"
                  >
                    <CheckCircle size={15} />
                    <span>Solicitar serviço</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SERVICE CART DRAWER / SIDEBAR */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end transition-opacity animate-fadeIn">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-[#0071e3] flex items-center justify-center font-bold">
                  <ClipboardList size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-base">Ordem de Serviço</h2>
                  <p className="text-xs text-slate-500">{totalCartCount} item(ns) selecionado(s)</p>
                </div>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Body - Items List */}
            <div className="p-5 flex-1 space-y-4 overflow-y-auto">
              {cartItems.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {cartItems.map((item, idx) => {
                      const itemVal = parsePrice(item.servico);
                      const subtotal = itemVal * item.quantidade;

                      return (
                        <div
                          key={item.servico.id || idx}
                          className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-start gap-3 relative"
                        >
                          {item.servico.imagem ? (
                            <img
                              src={item.servico.imagem}
                              alt={item.servico.nome}
                              className="w-14 h-14 object-cover rounded-xl border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 bg-slate-200 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                              <Wrench size={20} />
                            </div>
                          )}

                          <div className="flex-1 min-w-0 pr-6">
                            <h4 className="font-bold text-xs text-slate-900 line-clamp-2 mb-1">
                              {item.servico.nome}
                            </h4>
                            <p className="text-xs text-slate-500 font-medium">
                              {itemVal === 0 ? "Sob consulta" : `R$ ${formatCurrency(itemVal)} / un`}
                            </p>

                            <div className="flex items-center justify-between mt-2">
                              {/* Quantity Controls */}
                              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCartItemQty(item.servico.id, -1)}
                                  className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="w-6 text-center text-xs font-bold text-slate-900">
                                  {item.quantidade}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCartItemQty(item.servico.id, 1)}
                                  className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>

                              <span className={`font-extrabold text-xs ${subtotal === 0 ? 'text-slate-600' : 'text-[#0071e3]'}`}>
                                {subtotal === 0 ? "Sob consulta" : `R$ ${formatCurrency(subtotal)}`}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveCartItem(item.servico.id)}
                            className="absolute top-3 right-3 text-slate-400 hover:text-red-500 p-1"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Date & Details Inputs */}
                  <div className="bg-sky-50/60 border border-sky-100 rounded-2xl p-4 space-y-3 mt-4">
                    <h3 className="font-bold text-xs text-sky-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar size={14} /> Preferência de Agendamento
                    </h3>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Data Preferencial para Visita *
                      </label>
                      <input
                        type="date"
                        min={getMinDateString()}
                        value={dataPreferencial}
                        onChange={handleDateChange}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#0071e3]/20"
                      />
                      <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                        * Atendimento disponível de <strong>segunda a sexta-feira</strong>, com antecedência mínima de <strong>7 dias</strong>.
                      </p>
                      {dateError && (
                        <p className="text-xs text-red-600 font-bold mt-1 bg-red-50 p-2 rounded-lg border border-red-200">
                          {dateError}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Observações do Condomínio
                      </label>
                      <textarea
                        placeholder="Ex: Ponto de contato na portaria, restrições de horário, bloco ou área técnica."
                        rows={2}
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#0071e3]/20 resize-none"
                      />
                    </div>
                  </div>

                  {/* Cashback Abatement Option Section */}
                  <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 space-y-3 mt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-extrabold shadow-xs">
                          <Coins size={20} />
                        </div>
                        <div>
                          <span className="text-xs font-black text-emerald-950 block">Uso de Cashback</span>
                          <span className="text-xs text-emerald-700 font-bold">
                            Saldo disponível: R$ {formatCurrency(userCashback)}
                          </span>
                        </div>
                      </div>

                      {userCashback > 0 ? (
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useCashback}
                            onChange={(e) => {
                              setUseCashback(e.target.checked);
                              if (e.target.checked) {
                                setCashbackOption("total");
                              }
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                          Sem saldo
                        </span>
                      )}
                    </div>

                    {useCashback && userCashback > 0 && (
                      <div className="pt-2.5 border-t border-emerald-200/60 space-y-2.5 text-xs">
                        <p className="font-bold text-emerald-900">Como deseja abater seu cashback?</p>
                        
                        <div className="space-y-2">
                          <label className="flex items-start gap-2.5 cursor-pointer font-medium text-slate-800">
                            <input
                              type="radio"
                              name="cashbackOpt"
                              checked={cashbackOption === "total"}
                              onChange={() => setCashbackOption("total")}
                              className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div>
                              <span className="font-bold text-slate-900 block">Abater valor máximo/total disponível</span>
                              <span className="text-[11px] text-emerald-700">
                                Abate até R$ {formatCurrency(maxCashbackDeductible)} do total a faturar
                              </span>
                            </div>
                          </label>

                          <label className="flex items-start gap-2.5 cursor-pointer font-medium text-slate-800">
                            <input
                              type="radio"
                              name="cashbackOpt"
                              checked={cashbackOption === "parcial"}
                              onChange={() => setCashbackOption("parcial")}
                              className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div>
                              <span className="font-bold text-slate-900 block">Abater valor parcial</span>
                              <span className="text-[11px] text-slate-500">
                                Digite a quantia exata de cashback a utilizar
                              </span>
                            </div>
                          </label>
                        </div>

                        {cashbackOption === "parcial" && (
                          <div className="pl-6 pt-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-600">R$</span>
                              <input
                                type="text"
                                placeholder={`Até ${formatCurrency(maxCashbackDeductible)}`}
                                value={customCashbackAmount}
                                onChange={(e) => setCustomCashbackAmount(e.target.value)}
                                className="bg-white border border-emerald-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 w-36 focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                              />
                            </div>
                          </div>
                        )}

                        {appliedCashback > 0 && (
                          <div className="bg-white/90 p-3 rounded-xl border border-emerald-200/80 space-y-1 font-medium shadow-2xs">
                            <div className="flex justify-between text-emerald-800 text-xs">
                              <span className="font-bold">Desconto por Cashback:</span>
                              <span className="font-black text-emerald-700">- R$ {formatCurrency(appliedCashback)}</span>
                            </div>
                            <div className="flex justify-between text-slate-500 text-[11px]">
                              <span>Novo saldo de cashback:</span>
                              <span>R$ {formatCurrency(Math.max(0, userCashback - appliedCashback))}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-16 space-y-3">
                  <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                    <ClipboardList size={32} />
                  </div>
                  <h3 className="font-bold text-slate-700">Sua lista está vazia</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Selecione a quantidade dos serviços no catálogo e clique em "Solicitar serviço" para compor sua ordem de serviço.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="mt-2 inline-flex items-center gap-2 bg-[#0071e3] text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-[#0071e3]/90 transition-all shadow-xs cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>Adicionar mais serviços à Ordem de Serviço</span>
                  </button>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            {cartItems.length > 0 && (
              <div className="p-5 border-t border-slate-200 bg-white space-y-3 shadow-lg">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>Valor dos Serviços:</span>
                    <span className="font-bold text-slate-800">
                      {totalCartValue === 0 ? "Sob consulta" : `R$ ${formatCurrency(totalCartValue)}`}
                    </span>
                  </div>

                  {appliedCashback > 0 && (
                    <div className="flex justify-between items-center text-xs text-emerald-700 font-bold">
                      <span className="flex items-center gap-1">
                        <Coins size={13} /> Abatimento Cashback:
                      </span>
                      <span>- R$ {formatCurrency(appliedCashback)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-slate-900 pt-1.5 border-t border-slate-100">
                    <span className="text-xs font-black uppercase text-slate-600">Valor Final a Faturar</span>
                    <span className={`text-2xl font-black ${finalPayableValue === 0 ? 'text-slate-600' : 'text-[#0071e3]'}`}>
                      {finalPayableValue === 0 ? "Sob consulta" : `R$ ${formatCurrency(finalPayableValue)}`}
                    </span>
                  </div>
                </div>

                {/* Button 1: Add more services */}
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 border border-slate-200 cursor-pointer"
                >
                  <Plus size={16} />
                  <span>Adicionar mais serviços à Ordem de Serviço</span>
                </button>

                {/* Button 2: Complete order request */}
                <button
                  type="button"
                  onClick={handleSubmitOrder}
                  disabled={submitting}
                  className="w-full bg-[#0071e3] hover:bg-[#0071e3]/90 text-white font-bold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50 active:scale-95 cursor-pointer"
                >
                  {submitting ? (
                    "Enviando solicitação..."
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      <span>Concluir solicitação de Ordem de serviço</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {successModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border border-slate-100">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={36} />
            </div>

            <h3 className="text-xl font-extrabold text-slate-900">
              Ordem de Serviço Enviada!
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              Sua solicitação de serviços com a data de preferência foi encaminhada com sucesso. O status atual é <strong>Aguardando confirmação - Data</strong>.
            </p>

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setSuccessModal(false);
                  navigate("/cliente/ordens-servico");
                }}
                className="w-full bg-[#0071e3] text-white font-bold py-3 rounded-xl text-xs hover:bg-[#0071e3]/90 transition-all shadow-md"
              >
                Ver Minhas Ordens de Serviço
              </button>

              <button
                type="button"
                onClick={() => setSuccessModal(false)}
                className="w-full bg-slate-100 text-slate-600 font-bold py-2.5 rounded-xl text-xs hover:bg-slate-200 transition-all"
              >
                Continuar Navegando
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
