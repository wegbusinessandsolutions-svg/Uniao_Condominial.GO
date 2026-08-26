import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { 
  Coins, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Check, 
  Copy, 
  PiggyBank, 
  HelpCircle, 
  TrendingUp, 
  Calendar, 
  Sparkles,
  ClipboardCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  X,
  Calculator
} from "lucide-react";
import { validarCPF, validarCNPJ } from "../../lib/documentValidators";

interface CashbackTransaction {
  id: string;
  type: "earning" | "withdrawal" | "discount";
  amount: number;
  description: string;
  date: string;
  status: "Aprovado" | "Pendente" | "Rejeitado";
}

function formatPixKey(type: string, val: string): string {
  const clean = val.replace(/\s/g, "");
  switch (type) {
    case "CPF": {
      const nums = val.replace(/\D/g, "");
      return nums
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
        .slice(0, 14);
    }
    case "CNPJ": {
      const nums = val.replace(/\D/g, "");
      return nums
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2")
        .slice(0, 18);
    }
    case "Telefone": {
      const nums = val.replace(/\D/g, "");
      if (nums.length <= 10) {
        return nums.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3").slice(0, 14);
      } else {
        return nums.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3").slice(0, 15);
      }
    }
    default:
      return val;
  }
}

function validatePixKey(type: string, key: string): { isValid: boolean; errorMsg?: string } {
  const cleanKey = key.trim();
  if (!cleanKey) {
    return { isValid: false, errorMsg: "A chave Pix não pode estar vazia." };
  }

  switch (type) {
    case "CPF": {
      const cleanCpf = cleanKey.replace(/\D/g, "");
      if (cleanCpf.length !== 11) {
        return { isValid: false, errorMsg: "O CPF deve possuir exatamente 11 dígitos numéricos." };
      }
      if (!validarCPF(cleanCpf)) {
        return { isValid: false, errorMsg: "CPF inválido. Por favor, verifique os dígitos verificadores." };
      }
      return { isValid: true };
    }
    case "CNPJ": {
      const cleanCnpj = cleanKey.replace(/\D/g, "");
      if (cleanCnpj.length !== 14) {
        return { isValid: false, errorMsg: "O CNPJ deve possuir exatamente 14 dígitos numéricos." };
      }
      if (!validarCNPJ(cleanCnpj)) {
        return { isValid: false, errorMsg: "CNPJ inválido. Por favor, verifique se o número está digitado corretamente." };
      }
      return { isValid: true };
    }
    case "E-mail": {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanKey)) {
        return { isValid: false, errorMsg: "Formato de e-mail inválido. Exemplo: usuario@email.com" };
      }
      return { isValid: true };
    }
    case "Telefone": {
      const cleanPhone = cleanKey.replace(/\D/g, "");
      if (cleanPhone.length < 10 || cleanPhone.length > 11) {
        return { isValid: false, errorMsg: "O telefone deve conter DDD + número com 8 ou 9 dígitos (ex: (11) 99999-9999)." };
      }
      return { isValid: true };
    }
    case "Chave Aleatória": {
      // EVP format can be raw alphanumeric 32-36, or have hyphens
      const cleanEvp = cleanKey.replace(/[^a-zA-Z0-9-]/g, "");
      if (cleanEvp.length < 32) {
        return { isValid: false, errorMsg: "A chave aleatória Pix deve ter pelo menos 32 caracteres alfanuméricos." };
      }
      return { isValid: true };
    }
    default:
      return { isValid: true };
  }
}

const DEFAULT_CASHBACK_RULES = [
  { nivel: "Bronze", percentual: 5, minimo: 0 },
  { nivel: "Prata", percentual: 7, minimo: 401 },
  { nivel: "Ouro", percentual: 10, minimo: 801 },
  { nivel: "Diamante", percentual: 12, minimo: 1200.01 }
];

export default function Cashback() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Pix Form State
  const [showPixModal, setShowPixModal] = useState(false);
  const [pixKeyType, setPixKeyType] = useState("CPF");
  const [pixKey, setPixKey] = useState("");
  const [pixPhone, setPixPhone] = useState("");
  const [pixAmount, setPixAmount] = useState("");
  const [pixError, setPixError] = useState("");

  // Discount Form State
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountError, setDiscountError] = useState("");
  const [generatedCoupon, setGeneratedCoupon] = useState<{ code: string; val: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [useFullBalance, setUseFullBalance] = useState(true);

  // Success Feedbacks
  const [successMessage, setSuccessMessage] = useState("");

  // Cashback Simulator States
  const [rules, setRules] = useState<any[]>(DEFAULT_CASHBACK_RULES);
  const [simValue, setSimValue] = useState<string>("100,00");

  const currentBalance = profile?.cashbackBalance || 0;
  const parsedSimValue = parseFloat(simValue.replace(/\./g, "").replace(",", ".")) || 0;

  const getLevelStyle = (levelName: string) => {
    const lvl = (levelName || "").toLowerCase();
    switch (lvl) {
      case "bronze":
        return {
          badge: "bg-amber-100/90 text-amber-800 border-amber-300",
          pill: "bg-amber-50 text-amber-900 border-amber-200",
          activePill: "bg-amber-600 text-white font-bold border-amber-700 shadow-xs",
          activeBadge: "bg-amber-500 text-white",
          dot: "bg-amber-500",
          emoji: "🥉"
        };
      case "prata":
        return {
          badge: "bg-slate-200/90 text-slate-800 border-slate-300",
          pill: "bg-slate-100 text-slate-800 border-slate-300",
          activePill: "bg-slate-700 text-white font-bold border-slate-800 shadow-xs",
          activeBadge: "bg-slate-600 text-white",
          dot: "bg-slate-400",
          emoji: "🥈"
        };
      case "ouro":
        return {
          badge: "bg-yellow-100/90 text-yellow-900 border-yellow-300",
          pill: "bg-yellow-50 text-yellow-900 border-yellow-200",
          activePill: "bg-yellow-500 text-slate-950 font-bold border-yellow-600 shadow-xs",
          activeBadge: "bg-yellow-500 text-slate-950",
          dot: "bg-yellow-500",
          emoji: "🥇"
        };
      case "diamante":
        return {
          badge: "bg-sky-100/90 text-sky-900 border-sky-300",
          pill: "bg-sky-50 text-sky-900 border-sky-200",
          activePill: "bg-[#0071e3] text-white font-bold border-blue-700 shadow-xs",
          activeBadge: "bg-[#0071e3] text-white",
          dot: "bg-sky-400",
          emoji: "💎"
        };
      default:
        return {
          badge: "bg-slate-100 text-slate-700 border-slate-200",
          pill: "bg-slate-50 text-slate-700 border-slate-200",
          activePill: "bg-slate-800 text-white font-bold border-slate-900 shadow-xs",
          activeBadge: "bg-slate-800 text-white",
          dot: "bg-slate-400",
          emoji: "⭐"
        };
    }
  };

  const userLevel = profile?.level ? profile.level.charAt(0).toUpperCase() + profile.level.slice(1).toLowerCase() : "Bronze";
  const currentUserRule = rules.find(r => (r.nivel || "").toLowerCase() === userLevel.toLowerCase());
  const currentPercentage = currentUserRule ? Number(currentUserRule.percentual) : 5;
  const currentTierStyle = getLevelStyle(userLevel);

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const snap = await getDocs(collection(db, "regras_cashback"));
        const rulesList: any[] = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        const standardOrder = ["bronze", "prata", "ouro", "diamante"];
        
        if (rulesList.length > 0) {
          // Merge with default levels to guarantee all standard tiers exist
          const merged = [...rulesList];
          DEFAULT_CASHBACK_RULES.forEach(defRule => {
            if (!merged.some(r => r.nivel?.toLowerCase() === defRule.nivel.toLowerCase())) {
              merged.push(defRule);
            }
          });
          
          merged.sort((a, b) => {
            const idxA = standardOrder.indexOf((a.nivel || "").toLowerCase());
            const idxB = standardOrder.indexOf((b.nivel || "").toLowerCase());
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return (Number(a.percentual) || 0) - (Number(b.percentual) || 0);
          });
          
          setRules(merged);
        } else {
          setRules(DEFAULT_CASHBACK_RULES);
        }
      } catch (err) {
        console.error("Error fetching cashback rules:", err);
        setRules(DEFAULT_CASHBACK_RULES);
      }
    };
    fetchRules();
  }, []);

  useEffect(() => {
    // Retaining useEffect in case it's needed for loading
    setLoading(false);
  }, [user?.uid]);

  const handleCopyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRequestPix = async (e: React.FormEvent) => {
    e.preventDefault();
    setPixError("");

    const amountNum = parseFloat(pixAmount.replace(",", "."));
    if (isNaN(amountNum) || amountNum <= 0) {
      setPixError("Por favor, digite um valor válido.");
      return;
    }

    if (amountNum > currentBalance) {
      setPixError("O valor solicitado é maior que seu saldo atual.");
      return;
    }

    if (amountNum < 10) {
      setPixError("O valor mínimo para saque via Pix é R$ 10,00.");
      return;
    }

    const valPix = validatePixKey(pixKeyType, pixKey);
    if (!valPix.isValid) {
      setPixError(valPix.errorMsg || "Chave Pix inválida.");
      return;
    }

    if (!pixPhone || pixPhone.replace(/\D/g, '').length < 10) {
      setPixError("Por favor, informe um telefone válido com DDD para o envio do comprovante.");
      return;
    }

    try {
      setSubmitting(true);
      
      const netValue = amountNum * 0.75; // 75% do valor

      // 1. Criar transação de cashback
      const newTxRef = doc(collection(db, "cashback_transactions"));
      const transactionData = {
        id: newTxRef.id,
        userId: user!.uid,
        type: "withdrawal",
        amount: amountNum,
        netAmount: netValue,
        description: `Saque Pix solicitado`,
        date: new Date().toISOString(),
        status: "Pendente",
        pixKeyType,
        pixKey,
        pixPhone
      };
      
      await addDoc(collection(db, "cashback_transactions"), transactionData);
      
      // 2. Criar lançamento no Contas a Pagar do financeiro
      await addDoc(collection(db, "contas_pagar"), {
        descricao: `Saque Cashback Pix - ${profile?.nome || 'Cliente'}`,
        valor: netValue,
        vencimento: new Date().toISOString().split('T')[0],
        status: "Aberto",
        categoria: "Cashback Cliente",
        centroCusto: "Comercial",
        fornecedorId: profile?.nome || "Cliente (Cashback)",
        observacoes: `Chave Pix: ${pixKey} (${pixKeyType}) | Telefone: ${pixPhone}`,
        pixKeyType,
        pixKey,
        pixPhone,
        userId: user!.uid,
        dataCriacao: new Date().toISOString(),
        cashbackTransactionId: newTxRef.id
      });
      
      // 3. Atualizar saldo do usuário
      const userRef = doc(db, "users", user!.uid);
      await updateDoc(userRef, {
        cashbackBalance: currentBalance - amountNum
      });

      // Refresh profile state in AuthContext
      await refreshProfile();

      setShowPixModal(false);
      setPixAmount("");
      setPixKey("");
      setPixPhone("");
      setSuccessMessage(`Solicitação de saque de R$ ${amountNum.toFixed(2)} enviada com sucesso! O valor será creditado em sua conta Pix após análise.`);
      setTimeout(() => setSuccessMessage(""), 7000);
    } catch (err: any) {
      console.error("Error writing Pix request:", err);
      setPixError(err.message || "Erro ao processar a solicitação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDiscountError("");

    const amountNum = parseFloat(discountAmount.replace(",", "."));
    if (isNaN(amountNum) || amountNum <= 0) {
      setDiscountError("Por favor, digite um valor válido.");
      return;
    }

    if (amountNum > currentBalance) {
      setDiscountError("O valor inserido é maior que seu saldo atual.");
      return;
    }

    try {
      setSubmitting(true);
      
      const code = `CASH-${amountNum.toFixed(0)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const newTxRef = doc(collection(db, "cashback_transactions"));
      const transactionData = {
        id: newTxRef.id,
        userId: user!.uid,
        type: "discount",
        amount: amountNum,
        description: `Saque/Desconto solicitado`,
        date: new Date().toISOString(),
        status: "Aprovado",
        code
      };
      
      await addDoc(collection(db, "cashback_transactions"), transactionData);
      
      const userRef = doc(db, "users", user!.uid);
      await updateDoc(userRef, {
        cashbackBalance: currentBalance - amountNum
      });
      
      // Refresh profile state in AuthContext
      await refreshProfile();

      setGeneratedCoupon({ code, val: amountNum });
      setShowDiscountModal(false);
      setDiscountAmount("");
    } catch (err: any) {
      console.error("Error creating discount coupon:", err);
      setDiscountError(err.message || "Erro ao gerar cupom.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Title Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-950 flex items-center gap-2">
          <Coins className="text-brand-light w-7 h-7" />
          Minha Carteira de Cashback
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Acompanhe seus créditos acumulados, faça saques imediatos para sua conta Pix ou gere cupons para descontos adicionais em nosso catálogo.
        </p>
      </div>

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-3 shadow-2xs">
          <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
          <p className="text-xs sm:text-sm font-medium">{successMessage}</p>
        </div>
      )}

      {/* Coupon Success Result Modal */}
      {generatedCoupon && (
        <div className="bg-[#e0f2fe] border border-sky-200 text-sky-950 p-6 rounded-3xl flex flex-col items-center text-center gap-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            <button 
              onClick={() => setGeneratedCoupon(null)}
              className="text-sky-500 hover:text-sky-700 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
          <div className="w-12 h-12 rounded-full bg-sky-500 text-white flex items-center justify-center">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Cupom Gerado com Sucesso!</h3>
            <p className="text-xs text-slate-600 mt-1">Utilize o código abaixo no campo de cupons no fechamento do seu carrinho para abater o valor do seu saldo.</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-sky-100 rounded-2xl p-3.5 pr-4 pl-5 shadow-xs w-full max-w-sm justify-between">
            <span className="font-mono font-bold text-lg text-slate-800 tracking-wider">{generatedCoupon.code}</span>
            <button
              onClick={() => handleCopyCoupon(generatedCoupon.code)}
              className="flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-800 transition-colors border border-sky-100 rounded-lg px-2.5 py-1.5 cursor-pointer bg-sky-50/50"
            >
              {copied ? (
                <>
                  <ClipboardCheck size={14} className="text-emerald-500" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs font-bold text-sky-700">Desconto de R$ {generatedCoupon.val.toFixed(2)} reservado para sua próxima compra.</p>
        </div>
      )}

      {/* Main Grid Card: Balance + Action Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Balance Card - Primeira Opção com percentual dinâmico por nível e tabela de contas */}
        <div className="md:col-span-1 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
            <Coins size={130} className="text-slate-900" />
          </div>
          
          <div className="space-y-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saldo Acumulado</span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border shadow-3xs ${currentTierStyle.badge}`}>
                <span>{currentTierStyle.emoji}</span>
                <span>{userLevel}</span>
              </span>
            </div>

            <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              R$ {currentBalance.toFixed(2).replace(".", ",")}
            </div>

            {/* Texto informativo do percentual do nível atual */}
            <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 space-y-1">
              <p className="text-xs text-slate-700 leading-snug">
                Conforme seu tipo de conta, você recebe <strong className="text-[#0071e3] font-extrabold text-sm">{currentPercentage}% de retorno</strong> em suas compras no nível <strong className="text-slate-900 font-bold">{userLevel}</strong>.
              </p>
              <p className="text-[10px] text-slate-400 leading-tight">
                Percentual configurado na tabela de regras de cashback.
              </p>
            </div>

            {/* Tabela dos 4 tipos de conta e seus respectivos percentuais */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Percentuais por Nível de Conta:
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {rules.length} categorias
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {rules.map((rule) => {
                  const isCurrent = (rule.nivel || "").toLowerCase() === userLevel.toLowerCase();
                  const style = getLevelStyle(rule.nivel);
                  const perc = Number(rule.percentual) || 0;
                  return (
                    <div
                      key={rule.id || rule.nivel}
                      className={`px-2.5 py-2 rounded-xl border text-[11px] flex items-center justify-between transition-all ${
                        isCurrent
                          ? `${style.activePill} ring-2 ring-sky-300/40 font-bold`
                          : "bg-slate-50/70 text-slate-700 border-slate-200/80 hover:bg-slate-100"
                      }`}
                    >
                      <span className="flex items-center gap-1 font-semibold truncate">
                        <span>{style.emoji}</span>
                        <span className="truncate">{rule.nivel}</span>
                      </span>
                      <span className={`font-extrabold shrink-0 ml-1 ${isCurrent ? "text-white" : "text-slate-900"}`}>
                        {perc}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Action Options Panels */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Saque Pix Option */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-600">
                <PiggyBank size={20} />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Resgatar via Pix</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Transfira o saldo disponível de forma rápida e segura direto para sua conta bancária de preferência.
              </p>
            </div>
            <div className="pt-4 mt-2">
              <button
                onClick={() => {
                  setPixError("");
                  setPixAmount(currentBalance.toFixed(2));
                  setShowPixModal(true);
                }}
                disabled={currentBalance < 10}
                className="w-full py-2 px-4 bg-sky-50 hover:bg-sky-100 disabled:bg-slate-50 disabled:text-slate-400 text-sky-700 font-semibold rounded-xl text-xs sm:text-sm transition-all text-center cursor-pointer disabled:cursor-not-allowed select-none"
              >
                {currentBalance < 10 ? "Mínimo R$ 10,00 para Saque" : "Solicitar Saque Pix"}
              </button>
            </div>
          </div>

          {/* Desconto de Cupom Option */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-yellow-50 flex items-center justify-center text-yellow-600">
                <TrendingUp size={20} />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Abater nas Compras</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Converta parte ou o total do seu saldo em um cupom de desconto personalizado para economizar em nosso site.
              </p>
            </div>
            <div className="pt-4 mt-2">
              <button
                onClick={() => {
                  setDiscountError("");
                  setUseFullBalance(true);
                  setDiscountAmount(currentBalance.toFixed(2));
                  setShowDiscountModal(true);
                }}
                disabled={currentBalance <= 0}
                className="w-full py-2 px-4 bg-yellow-50 hover:bg-yellow-100 disabled:bg-slate-50 disabled:text-slate-400 text-yellow-800 font-semibold rounded-xl text-xs sm:text-sm transition-all text-center cursor-pointer disabled:cursor-not-allowed select-none"
              >
                {currentBalance <= 0 ? "Sem saldo disponível" : "Gerar Cupom de Desconto"}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Cashback Simulator Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-[#0071e3]/10 flex items-center justify-center text-[#0071e3]">
            <Calculator size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Simulador de Cashback</h3>
            <p className="text-xs text-slate-500 mt-0.5">Simule o valor de uma compra e descubra o quanto você irá acumular de cashback!</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Form Input */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Valor da Compra Simulado</label>
              <div className="relative rounded-xl shadow-2xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">R$</span>
                <input
                  type="text"
                  placeholder="0,00"
                  value={simValue}
                  onChange={(e) => {
                    let val = e.target.value;
                    val = val.replace(/\D/g, "");
                    if (val === "") {
                      setSimValue("");
                    } else {
                      const floatVal = parseFloat(val) / 100;
                      setSimValue(floatVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                    }
                  }}
                  className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-sky-100 focus:border-[#0071e3] outline-none text-base font-bold text-slate-800"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Digite um valor para simular o retorno com base nos níveis de cliente configurados na tabela.</p>
            </div>

            {/* Quick buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              {[50, 100, 250, 500, 1000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setSimValue(val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                  }}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-semibold text-slate-600 transition-colors cursor-pointer select-none"
                >
                  R$ {val}
                </button>
              ))}
            </div>

            {/* Rules explanation box */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/50 text-xs text-slate-600 space-y-2">
              <span className="font-bold text-slate-700 block">Como funciona o nível e o acúmulo?</span>
              <p className="leading-relaxed">
                Todo cliente inicia como <strong>Bronze</strong> (compras de R$ 1,00 até R$ 400,00). Ao realizar compras de R$ 401,00 até R$ 800,00 avança para <strong>Prata</strong>; de R$ 801,00 até R$ 1.200,00 torna-se <strong>Ouro</strong>; e compras acima de R$ 1.200,00 alcançam o nível <strong>Diamante</strong>.
              </p>
              <p className="leading-relaxed">
                A cada recebimento de compra baixado no sistema financeiro, o nível do cliente é atualizado para as próximas compras, ajustando automaticamente a taxa de cashback e os preços exclusivos de sua categoria.
              </p>
              <p className="leading-relaxed">
                Seus créditos de cashback acumulados ficam salvos na sua carteira e podem ser usados para gerar cupons de desconto de até 100% ou resgatados via Pix com 75% do valor líquido.
              </p>
            </div>
          </div>

          {/* Right Column: Calculations */}
          <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-200/60 space-y-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Retorno por Nível de Cliente</span>
            
            <div className="space-y-2.5">
              {rules.map((rule) => {
                const percent = Number(rule.percentual) || 0;
                const minOrder = Number(rule.minimo) || 0;
                const isEligible = parsedSimValue >= minOrder;
                const earned = isEligible ? (parsedSimValue * percent) / 100 : 0;
                const isCurrent = (rule.nivel || "").toLowerCase() === userLevel.toLowerCase();
                const style = getLevelStyle(rule.nivel);

                return (
                  <div 
                    key={rule.id || rule.nivel}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isCurrent 
                        ? "bg-sky-50/60 border-sky-300 ring-2 ring-sky-200/50 shadow-2xs" 
                        : "bg-white border-slate-200/60 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-xs px-2.5 py-0.5 rounded-full border shadow-3xs ${style.badge}`}>
                          {style.emoji} {rule.nivel}
                        </span>
                        {isCurrent && (
                          <span className="bg-[#0071e3] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                            Seu Nível
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-600 font-bold">
                        {percent}% de retorno
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between mt-3">
                      <div>
                        {minOrder > 0 ? (
                          <p className="text-[10px] text-slate-400">
                            Compra mín: R$ {minOrder.toFixed(2).replace(".", ",")}
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400">
                            Sem valor mínimo
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {!isEligible ? (
                          <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                            Abaixo do valor mínimo
                          </span>
                        ) : (
                          <span className={`font-extrabold text-sm ${isCurrent ? "text-sky-700" : "text-slate-800"}`}>
                            + R$ {earned.toFixed(2).replace(".", ",")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Motivation Banner */}
            {(() => {
              const currentTierIdx = rules.findIndex(r => (r.nivel || "").toLowerCase() === userLevel.toLowerCase());
              const higherTier = rules.find((r, idx) => idx > currentTierIdx && (Number(r.percentual) || 0) > currentPercentage);
              
              if (higherTier) {
                const higherPercent = Number(higherTier.percentual) || 0;
                const diffPercent = higherPercent - currentPercentage;
                const extraEarned = (parsedSimValue * diffPercent) / 100;
                const higherStyle = getLevelStyle(higherTier.nivel);
                
                if (extraEarned > 0) {
                  return (
                    <div className="bg-emerald-50/80 border border-emerald-200 text-emerald-950 p-3 rounded-xl text-[11px] leading-relaxed flex items-center gap-2 shadow-3xs">
                      <Sparkles size={16} className="text-amber-500 shrink-0" />
                      <p>
                        No nível <strong>{higherStyle.emoji} {higherTier.nivel} ({higherPercent}%)</strong>, você acumularia mais <strong>R$ {extraEarned.toFixed(2).replace(".", ",")}</strong> nesta compra! Faça mais pedidos para subir de nível.
                      </p>
                    </div>
                  );
                }
              }
              return null;
            })()}
          </div>
        </div>
      </div>

      {/* Pix Modal Form */}
      {showPixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-100 shadow-xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Solicitar Saque via Pix</h3>
                <p className="text-xs text-slate-500 mt-1">Transfira seu cashback para sua chave Pix bancária.</p>
              </div>
              <button 
                onClick={() => setShowPixModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-all cursor-pointer p-1 rounded-full hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Reminder Warning Banner */}
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl text-xs flex flex-col gap-2 leading-relaxed shadow-3xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <AlertCircle size={15} className="text-amber-600 shrink-0" />
                <span>Aviso de Conversão via Pix</span>
              </div>
              <p>
                Lembramos que, caso você opte por receber o cashback disponível através de transferência Pix, <strong>será devido o valor de 75% sobre o valor apresentado no painel</strong> (com abatimento de 25% referente a taxas de operação administrativa).
              </p>
            </div>

            {pixError && (
              <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                <AlertCircle size={14} />
                <span>{pixError}</span>
              </div>
            )}

            <form onSubmit={handleRequestPix} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Valor do Saque</label>
                <div className="relative rounded-xl shadow-2xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">R$</span>
                  <input
                    type="text"
                    required
                    placeholder="0,00"
                    value={pixAmount}
                    onChange={(e) => setPixAmount(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-sky-100 focus:border-sky-500 outline-none text-sm transition-all text-slate-800"
                  />
                </div>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-[10px] text-slate-400">Saldo disponível: R$ {currentBalance.toFixed(2).replace(".", ",")}</p>
                  <button
                    type="button"
                    onClick={() => setPixAmount(currentBalance.toFixed(2))}
                    className="text-[10px] text-sky-600 hover:text-sky-800 font-bold hover:underline"
                  >
                    Usar Saldo Máximo
                  </button>
                </div>
              </div>

              {/* Dynamic Pix Calculation Preview */}
              {(() => {
                const amt = parseFloat(String(pixAmount).replace(",", "."));
                const val = isNaN(amt) ? 0 : amt;
                const adminFee = val * 0.25;
                const netValue = val * 0.75;
                return (
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-2 mt-2 shadow-3xs">
                    <div className="flex justify-between text-xs text-slate-500 font-medium">
                      <span>Valor solicitado (Painel):</span>
                      <span className="font-semibold text-slate-700">R$ {val.toFixed(2).replace(".", ",")}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 font-medium">
                      <span>Taxa Operacional / Administrativa (25%):</span>
                      <span className="font-semibold text-red-500">- R$ {adminFee.toFixed(2).replace(".", ",")}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-800 pt-2 border-t border-slate-200/50 items-center">
                      <span className="text-slate-600">Valor líquido creditado via Pix (75%):</span>
                      <span className="text-emerald-600 text-sm font-extrabold bg-emerald-50/70 px-2 py-1 rounded-lg border border-emerald-100">
                        R$ {netValue.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Tipo de Chave Pix</label>
                <select
                  value={pixKeyType}
                  onChange={(e) => {
                    setPixKeyType(e.target.value);
                    setPixKey(""); // Reset input when key type changes to prevent wrong mask
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-4 focus:ring-sky-100 focus:border-sky-500 outline-none text-sm transition-all text-slate-700"
                >
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                  <option value="E-mail">E-mail</option>
                  <option value="Telefone">Telefone</option>
                  <option value="Chave Aleatória">Chave Aleatória</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Chave Pix</label>
                <input
                  type="text"
                  required
                  placeholder={
                    pixKeyType === "CPF" 
                      ? "000.000.000-00" 
                      : pixKeyType === "CNPJ" 
                      ? "00.000.000/0000-00" 
                      : pixKeyType === "Telefone" 
                      ? "(00) 99999-9999" 
                      : pixKeyType === "E-mail"
                      ? "exemplo@email.com"
                      : "Digite a chave aleatória"
                  }
                  value={pixKey}
                  onChange={(e) => setPixKey(formatPixKey(pixKeyType, e.target.value))}
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-xl focus:bg-white focus:ring-4 focus:ring-sky-100 focus:border-sky-500 outline-none text-sm transition-all text-slate-800 ${
                    pixKey
                      ? validatePixKey(pixKeyType, pixKey).isValid
                        ? "border-green-400 focus:border-green-500"
                        : "border-red-300 focus:border-red-400"
                      : "border-slate-200"
                  }`}
                />
                {pixKey && (
                  <div className="mt-1">
                    {(() => {
                      const res = validatePixKey(pixKeyType, pixKey);
                      if (res.isValid) {
                        return (
                          <p className="text-xs text-green-600 flex items-center gap-1 font-medium">
                            <CheckCircle2 size={13} className="shrink-0" /> Chave {pixKeyType} válida
                          </p>
                        );
                      } else {
                        return (
                          <p className="text-xs text-red-500 flex items-center gap-1 font-medium">
                            <AlertCircle size={13} className="shrink-0" /> {res.errorMsg}
                          </p>
                        );
                      }
                    })()}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Telefone com DDD</label>
                <input
                  type="text"
                  required
                  placeholder="(00) 00000-0000"
                  value={pixPhone}
                  onChange={(e) => {
                    let v = e.target.value.replace(/\D/g, '');
                    if (v.length > 11) v = v.slice(0, 11);
                    if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
                    if (v.length > 9) v = `${v.slice(0, 10)}-${v.slice(10)}`;
                    setPixPhone(v);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-sky-100 focus:border-sky-500 outline-none text-sm transition-all text-slate-800"
                />
                <p className="text-[10px] text-slate-500">Para envio do comprovante do Pix realizado.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPixModal(false)}
                  className="flex-1 py-2 px-4 border border-slate-200 text-slate-600 font-semibold rounded-xl text-xs sm:text-sm hover:bg-slate-50 transition-colors cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 px-4 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer text-center animate-pulse-subtle"
                >
                  {submitting ? "Enviando..." : "Confirmar Saque Pix"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Discount Modal Form */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-100 shadow-xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Gerar Cupom de Desconto</h3>
                <p className="text-xs text-slate-500 mt-1">Converta seu cashback em um cupom promocional para compras.</p>
              </div>
              <button 
                onClick={() => setShowDiscountModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-all cursor-pointer p-1 rounded-full hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Explanatory Note */}
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 p-4 rounded-2xl text-xs flex flex-col gap-1.5 leading-relaxed shadow-3xs">
              <span className="font-bold flex items-center gap-1 text-yellow-850">
                <Sparkles size={14} className="text-yellow-600 shrink-0" />
                Utilização Total do Cashback
              </span>
              <p>
                A geração do código promocional permite a <strong>utilização de todo o valor de cashback disponível</strong> no painel de uma vez só ou de um valor parcial para abater no fechamento de suas próximas compras.
              </p>
            </div>

            {discountError && (
              <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                <AlertCircle size={14} />
                <span>{discountError}</span>
              </div>
            )}

            <form onSubmit={handleGenerateDiscount} className="space-y-4">
              {/* Checkbox for Full Balance Utilization */}
              <div className="flex items-center gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <input
                  type="checkbox"
                  id="useFullBalanceCheckbox"
                  checked={useFullBalance}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setUseFullBalance(checked);
                    if (checked) {
                      setDiscountAmount(currentBalance.toFixed(2));
                    }
                  }}
                  className="w-4 h-4 text-yellow-500 border-slate-300 rounded focus:ring-yellow-400 focus:ring-2"
                />
                <label htmlFor="useFullBalanceCheckbox" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  Resgatar TODO o saldo disponível (R$ {currentBalance.toFixed(2).replace(".", ",")})
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Valor do Cupom</label>
                <div className="relative rounded-xl shadow-2xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">R$</span>
                  <input
                    type="text"
                    required
                    disabled={useFullBalance}
                    placeholder="0,00"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-yellow-100 focus:border-yellow-500 disabled:opacity-75 disabled:bg-slate-100 disabled:cursor-not-allowed outline-none text-sm transition-all font-bold text-slate-800"
                  />
                </div>
                {!useFullBalance && (
                  <p className="text-[10px] text-slate-400">Saldo disponível para conversão parcial: R$ {currentBalance.toFixed(2).replace(".", ",")}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDiscountModal(false)}
                  className="flex-1 py-2 px-4 border border-slate-200 text-slate-600 font-semibold rounded-xl text-xs sm:text-sm hover:bg-slate-50 transition-colors cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 px-4 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-400 text-slate-900 font-bold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer text-center"
                >
                  {submitting ? "Gerando..." : "Gerar Cupom de Desconto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

{/* Transaction History removed from Client side as requested */}

    </div>
  );
}
