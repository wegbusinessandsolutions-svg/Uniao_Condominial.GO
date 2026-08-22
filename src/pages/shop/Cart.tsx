import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, ShoppingBag, CreditCard, ChevronRight, CheckCircle2, QrCode, Clipboard, User, Check, Printer, MapPin, Phone, Mail, Package, ExternalLink } from "lucide-react";
import { isStaffRole } from "../../lib/permissions";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { processarPedidoWebsite } from "../../lib/ecommerceFlow";
import OptimizedImage from "../../components/ui/OptimizedImage";
import { getMercadoPagoConfig, MercadoPagoConfig } from "../../lib/mercadoPago";
import { doc, getDoc } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { gerarPixCopiaECola } from "../../lib/documentValidators";

// Helper mask and validation functions for Checkout
const formatCEP = (value: string) => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
};

const formatCpfCnpj = (value: string) => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    let formatted = digits;
    if (digits.length > 3) formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length > 6) formatted = `${formatted.slice(0, 7)}.${formatted.slice(7)}`;
    if (digits.length > 9) formatted = `${formatted.slice(0, 11)}-${formatted.slice(11)}`;
    return formatted;
  } else {
    let formatted = digits;
    if (digits.length > 2) formatted = `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length > 5) formatted = `${formatted.slice(0, 6)}.${formatted.slice(6)}`;
    if (digits.length > 8) formatted = `${formatted.slice(0, 10)}/${formatted.slice(10)}`;
    if (digits.length > 12) formatted = `${formatted.slice(0, 15)}-${formatted.slice(15)}`;
    return formatted;
  }
};

const formatTelefone = (value: string) => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "").slice(0, 11);
  let formatted = digits;
  if (digits.length > 0) {
    formatted = `(${digits.slice(0, 2)}`;
  }
  if (digits.length > 2) {
    formatted = `${formatted}) ${digits.slice(2, 7)}`;
  }
  if (digits.length > 7) {
    if (digits.length === 11) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    } else {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
    }
  }
  return formatted;
};

const validateCPF = (cpf: string): boolean => {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1+$/.test(clean)) return false;

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) {
    sum = sum + parseInt(clean.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum = sum + parseInt(clean.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.substring(10, 11))) return false;

  return true;
};

const validateCNPJ = (cnpj: string): boolean => {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return false;
  if (/^(\d)\1+$/.test(clean)) return false;

  let size = clean.length - 2;
  let numbers = clean.substring(0, size);
  const digits = clean.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  size = size + 1;
  numbers = clean.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
};

export default function Cart() {
  const { profile } = useAuth();
  const { cartItems, updateQuantity, removeFromCart, clearCart, totalAmount, totalItems } = useCart();
  const navigate = useNavigate();

  const [step, setStep] = useState<"cart" | "checkout" | "success">("cart");
  const [createdOrderId, setCreatedOrderId] = useState("");
  const [loading, setLoading] = useState(false);

  // Form states (prefilled from profile if logged in)
  const [nome, setNome] = useState(profile?.displayName || "");
  const [cpfCnpj, setCpfCnpj] = useState(formatCpfCnpj(profile?.cnpj || profile?.cpf || profile?.documento || profile?.cpfCnpj || ""));
  const [telefone, setTelefone] = useState(formatTelefone(profile?.phone || profile?.telefone || ""));
  const [endereco, setEndereco] = useState(profile?.endereco || "");
  const [numero, setNumero] = useState(profile?.numero || "");
  const [complemento, setComplemento] = useState(profile?.complemento || "");
  const [bairro, setBairro] = useState(profile?.bairro || "");
  const [cidade, setCidade] = useState(profile?.cidade || "Goiânia");
  const [estado, setEstado] = useState(profile?.estado || "GO");
  const [cep, setCep] = useState(formatCEP(profile?.cep || ""));
  const [formaPagamento, setFormaPagamento] = useState("17"); // Default to PIX ("17")

  useEffect(() => {
    if (profile) {
      if (profile.displayName) setNome(profile.displayName);
      const docVal = profile.cnpj || profile.cpf || profile.documento || profile.cpfCnpj || "";
      if (docVal) setCpfCnpj(formatCpfCnpj(docVal));
      const telVal = profile.phone || profile.telefone || "";
      if (telVal) setTelefone(formatTelefone(telVal));
      if (profile.endereco) setEndereco(profile.endereco);
      if (profile.numero) setNumero(profile.numero);
      if (profile.complemento) setComplemento(profile.complemento);
      if (profile.bairro) setBairro(profile.bairro);
      if (profile.cidade) setCidade(profile.cidade);
      if (profile.estado) setEstado(profile.estado);
      if (profile.cep) setCep(formatCEP(profile.cep));
    }
  }, [profile]);

  // Mercado Pago states
  const [mpConfig, setMpConfig] = useState<MercadoPagoConfig | null>(null);
  const [cardNome, setCardNome] = useState("");
  const [cardNumero, setCardNumero] = useState("");
  const [cardValidade, setCardValidade] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardParcelas, setCardParcelas] = useState("1");

  useEffect(() => {
    async function loadMpConfig() {
      const config = await getMercadoPagoConfig();
      setMpConfig(config);
    }
    loadMpConfig();
  }, []);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shippingConfig, setShippingConfig] = useState<any>(null);

  useEffect(() => {
    async function loadShippingConfig() {
      try {
        const { db } = await initFirebase();
        const docRef = doc(db, "config", "shipping");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setShippingConfig(docSnap.data());
        }
      } catch (err) {
        console.error("Erro ao carregar configuracoes de frete:", err);
      }
    }
    loadShippingConfig();
  }, []);

  // Capture total values before cart is cleared on success
  const [confirmedTotal, setConfirmedTotal] = useState(0);
  const [confirmedShippingCost, setConfirmedShippingCost] = useState(0);
  const [confirmedFormaPagamento, setConfirmedFormaPagamento] = useState("17");
  const [confirmedItems, setConfirmedItems] = useState<any[]>([]);
  const [confirmedCustomer, setConfirmedCustomer] = useState<any>(null);

  const getShippingCost = () => {
    if (totalAmount === 0) return 0;
    if (!shippingConfig) {
      // Fallback
      return totalAmount >= 300 ? 0 : 25;
    }

    // 1. Check free shipping minimum
    if (shippingConfig.freteGratisMinimo > 0 && totalAmount >= shippingConfig.freteGratisMinimo) {
      return 0;
    }

    // 2. Tabela de Faixas
    if (shippingConfig.tipoCalculo === "tabela") {
      const totalWeight = cartItems.reduce((acc, item) => acc + (item.quantidade * 0.5), 0);
      
      const matchedWeight = (shippingConfig.faixasPeso || [])
        .slice()
        .sort((a: any, b: any) => a.pesoMaximo - b.pesoMaximo)
        .find((b: any) => totalWeight <= b.pesoMaximo);

      if (matchedWeight) {
        return Number(matchedWeight.valor);
      }

      const matchedPrice = (shippingConfig.faixasPreco || []).find(
        (b: any) => totalAmount >= b.valorMinimo && totalAmount <= b.valorMaximo
      );

      if (matchedPrice) {
        return Number(matchedPrice.valor);
      }

      return Number(shippingConfig.valorFixoPadrao ?? 25);
    }

    // 3. API Integrations (Correios / Melhor Envio)
    const targetCep = (cep || "").replace(/\D/g, "");
    if (!targetCep) {
      return Number(shippingConfig.valorFixoPadrao ?? 25);
    }

    const totalWeight = cartItems.reduce((acc, item) => acc + (item.quantidade * 0.5), 0);
    const isLocal = targetCep.startsWith("74") || targetCep.startsWith("75");

    if (shippingConfig.tipoCalculo === "correios") {
      const distanceMultiplier = isLocal ? 1.0 : 1.8;
      return (15 + totalWeight * 4) * distanceMultiplier;
    } else if (shippingConfig.tipoCalculo === "melhor_envio") {
      const baseCost = isLocal ? 11.50 : 21.90;
      return baseCost + (totalWeight * 3.20);
    }

    return Number(shippingConfig.valorFixoPadrao ?? 25);
  };

  const shippingCost = getShippingCost();
  const finalTotal = totalAmount + shippingCost;

  const getDynamicPixCode = (amount: number) => {
    return gerarPixCopiaECola({
      chave: "63680806-d418-4b0b-9ef4-6562cde069d9",
      valor: amount,
      nomeRecebedor: "Uniao Condominial",
      cidadeRecebedor: "Goiania",
      txid: "CAR" + Math.floor(Math.random() * 1000)
    });
  };

  const renderStepper = () => {
    const isIdentificacaoPreenchida = 
      nome.trim() !== "" && 
      cpfCnpj.trim() !== "" && 
      telefone.trim() !== "" && 
      endereco.trim() !== "" && 
      numero.trim() !== "" && 
      bairro.trim() !== "" && 
      cep.trim() !== "";

    const currentStepIndex = step === "cart" ? 0 : step === "success" ? 3 : isIdentificacaoPreenchida ? 2 : 1;

    const stepsConfig = [
      { label: "Carrinho", icon: ShoppingBag, desc: "Itens selecionados" },
      { label: "Identificação", icon: User, desc: "Seus dados e entrega" },
      { label: "Pagamento", icon: CreditCard, desc: "Forma de pagamento" },
      { label: "Confirmação", icon: CheckCircle2, desc: "Pedido concluído" }
    ];

    return (
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-sm mb-8">
        <div className="relative flex items-center justify-between w-full max-w-4xl mx-auto">
          {/* Background line connecting all steps */}
          <div className="absolute left-4 right-4 sm:left-6 sm:right-6 top-5 sm:top-6 -translate-y-1/2 h-1 bg-slate-100 rounded-full z-0" />
          
          {/* Active progress fill */}
          <div 
            className="absolute left-4 sm:left-6 top-5 sm:top-6 -translate-y-1/2 h-1 bg-[#0071e3] rounded-full transition-all duration-500 ease-in-out z-0"
            style={{ 
              width: `calc(${(currentStepIndex / (stepsConfig.length - 1)) * 100}% - ${currentStepIndex === 3 ? "32px" : "16px"})`
            }}
          />

          {stepsConfig.map((item, idx) => {
            const StepIcon = item.icon;
            const isCompleted = idx < currentStepIndex;
            const isActive = idx === currentStepIndex;
            
            return (
              <div key={idx} className="relative flex flex-col items-center z-10 flex-1">
                {/* Step bubble */}
                <div 
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isCompleted 
                      ? "bg-[#0071e3] border-[#0071e3] text-white shadow-xs" 
                      : isActive 
                        ? "bg-white border-[#0071e3] text-[#0071e3] shadow-md ring-4 ring-[#0071e3]/10 scale-110" 
                        : "bg-white border-slate-200 text-slate-400"
                  }`}
                >
                  {isCompleted ? (
                    <Check size={18} strokeWidth={3} />
                  ) : (
                    <StepIcon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  )}
                </div>

                {/* Step Label */}
                <span 
                  className={`text-[10px] sm:text-xs font-bold mt-2.5 text-center transition-colors ${
                    isActive 
                      ? "text-slate-900 font-extrabold" 
                      : isCompleted 
                        ? "text-slate-600 font-semibold" 
                        : "text-slate-400"
                  }`}
                >
                  {item.label}
                </span>
                
                {/* Step Description */}
                <span 
                  className={`hidden md:block text-[9px] text-center mt-0.5 transition-colors ${
                    isActive 
                      ? "text-[#0071e3] font-semibold" 
                      : "text-slate-400"
                  }`}
                >
                  {item.desc}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleUpdateQty = (id: string, current: number, delta: number) => {
    const newVal = current + delta;
    if (newVal >= 1) {
      updateQuantity(id, newVal);
    }
  };

  // Dynamic CEP auto-lookup with ViaCEP API
  useEffect(() => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length === 8) {
      const fetchCep = async () => {
        try {
          const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
          if (response.ok) {
            const data = await response.json();
            if (data.erro) {
              setErrors(prev => ({ ...prev, cep: "CEP não encontrado" }));
            } else {
              setErrors(prev => {
                const updated = { ...prev };
                delete updated.cep;
                delete updated.endereco;
                delete updated.bairro;
                return updated;
              });
              if (data.logradouro) setEndereco(data.logradouro);
              if (data.bairro) setBairro(data.bairro);
              if (data.localidade) setCidade(data.localidade);
              if (data.uf) setEstado(data.uf);
            }
          }
        } catch (err) {
          console.error("Erro ao buscar CEP:", err);
          setErrors(prev => ({ ...prev, cep: "Falha ao consultar o CEP" }));
        }
      };
      fetchCep();
    }
  }, [cep]);

  const validateField = (name: string, value: string) => {
    const newErrors = { ...errors };
    const cleanValue = value.replace(/\D/g, "");

    if (name === "nome") {
      if (!value.trim()) {
        newErrors.nome = "Nome é obrigatório";
      } else if (value.trim().split(/\s+/).filter(Boolean).length < 2) {
        newErrors.nome = "Por favor, insira nome e sobrenome completo";
      } else {
        delete newErrors.nome;
      }
    }

    if (name === "cpfCnpj") {
      if (!value.trim()) {
        newErrors.cpfCnpj = "CPF ou CNPJ é obrigatório para faturamento";
      } else if (cleanValue.length <= 11) {
        if (cleanValue.length < 11) {
          newErrors.cpfCnpj = "CPF deve ter 11 dígitos";
        } else if (!validateCPF(cleanValue)) {
          newErrors.cpfCnpj = "CPF inválido";
        } else {
          delete newErrors.cpfCnpj;
        }
      } else {
        if (cleanValue.length < 14) {
          newErrors.cpfCnpj = "CNPJ deve ter 14 dígitos";
        } else if (!validateCNPJ(cleanValue)) {
          newErrors.cpfCnpj = "CNPJ inválido";
        } else {
          delete newErrors.cpfCnpj;
        }
      }
    }

    if (name === "telefone") {
      if (!value.trim()) {
        newErrors.telefone = "Telefone é obrigatório";
      } else if (cleanValue.length < 10 || cleanValue.length > 11) {
        newErrors.telefone = "Telefone deve conter o DDD e ter 10 ou 11 dígitos";
      } else {
        delete newErrors.telefone;
      }
    }

    if (name === "cep") {
      if (!value.trim()) {
        newErrors.cep = "CEP é obrigatório";
      } else if (cleanValue.length !== 8) {
        newErrors.cep = "CEP deve ter 8 dígitos";
      } else {
        delete newErrors.cep;
      }
    }

    if (name === "endereco") {
      if (!value.trim()) {
        newErrors.endereco = "Endereço é obrigatório";
      } else {
        delete newErrors.endereco;
      }
    }

    if (name === "numero") {
      if (!value.trim()) {
        newErrors.numero = "Número é obrigatório";
      } else {
        delete newErrors.numero;
      }
    }

    if (name === "bairro") {
      if (!value.trim()) {
        newErrors.bairro = "Bairro é obrigatório";
      } else {
        delete newErrors.bairro;
      }
    }

    setErrors(newErrors);
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    
    if (!nome.trim()) {
      errs.nome = "Nome é obrigatório";
    } else if (nome.trim().split(/\s+/).filter(Boolean).length < 2) {
      errs.nome = "Por favor, insira nome e sobrenome completo";
    }

    const cleanCpfCnpj = cpfCnpj.replace(/\D/g, "");
    if (!cpfCnpj.trim()) {
      errs.cpfCnpj = "CPF ou CNPJ é obrigatório para faturamento";
    } else if (cleanCpfCnpj.length <= 11) {
      if (cleanCpfCnpj.length < 11) {
        errs.cpfCnpj = "CPF deve ter 11 dígitos";
      } else if (!validateCPF(cleanCpfCnpj)) {
        errs.cpfCnpj = "CPF inválido";
      }
    } else {
      if (cleanCpfCnpj.length < 14) {
        errs.cpfCnpj = "CNPJ deve ter 14 dígitos";
      } else if (!validateCNPJ(cleanCpfCnpj)) {
        errs.cpfCnpj = "CNPJ inválido";
      }
    }

    const cleanTelefone = telefone.replace(/\D/g, "");
    if (!telefone.trim()) {
      errs.telefone = "Telefone é obrigatório";
    } else if (cleanTelefone.length < 10 || cleanTelefone.length > 11) {
      errs.telefone = "Telefone deve conter o DDD e ter 10 ou 11 dígitos";
    }

    if (!endereco.trim()) errs.endereco = "Endereço é obrigatório";
    if (!numero.trim()) errs.numero = "Número é obrigatório";
    if (!bairro.trim()) errs.bairro = "Bairro é obrigatório";
    if (!cidade.trim()) errs.cidade = "Cidade é obrigatória";
    if (!estado.trim()) errs.estado = "Estado é obrigatório";

    const cleanCep = cep.replace(/\D/g, "");
    if (!cep.trim()) {
      errs.cep = "CEP é obrigatório";
    } else if (cleanCep.length !== 8) {
      errs.cep = "CEP deve ter 8 dígitos";
    }
    
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCheckout = async (e: React.FormEvent) => {
    if (isStaffRole(profile?.role)) {
      alert("Apenas clientes podem realizar compras no aplicativo.");
      return;
    }
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);

    try {
      // Map local cart items to the website order format required by ecommerceFlow
      const orderItems = cartItems.map((item) => ({
        codigo: item.sku || item.id,
        descricao: item.nome,
        ncm: item.sku ? "34022000" : "34022000", // Standard cleaning product NCM
        unidade: "UN",
        quantidade: item.quantidade,
        valorUnitario: item.precoAplicado,
        ean: "SEM GTIN",
      }));

      const websiteOrder = {
        cliente: {
          nome: nome.trim(),
          cpfCnpj: cpfCnpj.trim(),
          ie: "ISENTO",
          email: profile?.email || "cliente@uniaocondominial.com",
          telefone: telefone.trim(),
          endereco: {
            logradouro: endereco.trim(),
            numero: numero.trim(),
            complemento: complemento.trim(),
            bairro: bairro.trim(),
            municipio: cidade.trim(),
            uf: estado.trim().toUpperCase(),
            cep: cep.trim().replace(/\D/g, ""),
            codigoMunicipio: "5208707", // Default Goiânia IBGE code
          }
        },
        itens: orderItems,
        frete: {
          modalidade: "0",
          transportadora: "União Logística",
          valor: shippingCost,
        },
        pagamento: {
          forma: formaPagamento,
          valor: finalTotal,
        }
      };

      // Capture total values and payment method before cart is cleared
      setConfirmedTotal(finalTotal);
      setConfirmedShippingCost(shippingCost);
      setConfirmedFormaPagamento(formaPagamento);
      setConfirmedItems([...cartItems]);
      setConfirmedCustomer({
        nome: nome.trim(),
        cpfCnpj: cpfCnpj.trim(),
        telefone: telefone.trim(),
        email: profile?.email || "cliente@uniaocondominial.com",
        endereco: {
          logradouro: endereco.trim(),
          numero: numero.trim(),
          complemento: complemento.trim(),
          bairro: bairro.trim(),
          municipio: cidade.trim(),
          uf: estado.trim().toUpperCase(),
          cep: cep.trim()
        }
      });

      // Call the flow processor
      const response = await processarPedidoWebsite(websiteOrder);

      // Automatic reconciliation with Mercado Pago API keys
      // In a real flow, a webhook would reconcile the payment.
      // We removed reconciliarFatura() local call.
      
      setCreatedOrderId(response.id_externo || `PED-${response.numero}`);
      setStep("success");
      clearCart();
    } catch (error: any) {
      console.error("Error finalizing purchase:", error);
      alert("Ocorreu um erro ao finalizar sua compra: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === "success") {
    const formatOrderId = (id: string) => {
      if (!id) return "";
      let target = id;
      if (id.startsWith("PED-")) {
        target = id.slice(4);
      }
      if (/^[A-Z]{2}\d{9}$/.test(target)) {
        return `${target.slice(0, 2)}-${target.slice(2, 8)}-${target.slice(8)}`;
      }
      return id;
    };

    const formattedOrderId = formatOrderId(createdOrderId);

    return (
      <div className="space-y-8 max-w-7xl mx-auto px-1 print:p-0 print:m-0">
        {/* Steps Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-5 print:hidden">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Pedido Confirmado
            </h1>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-2 px-4 rounded-xl transition-all border border-slate-200 cursor-pointer text-sm"
          >
            <Printer size={16} />
            Imprimir Resumo
          </button>
        </div>

        {/* Hide Stepper when printing */}
        <div className="print:hidden">
          {renderStepper()}
        </div>

        {/* Success Banner */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 shadow-sm mb-6 print:border-none print:bg-white print:p-0">
          <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-md shadow-emerald-200/50 flex-shrink-0 animate-pulse">
            <CheckCircle2 size={36} />
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-black text-slate-900">Seu pedido foi recebido com sucesso!</h2>
            <p className="text-slate-600 mt-1 text-sm sm:text-base">
              Obrigado pela sua compra. O pedido foi encaminhado diretamente para o setor de conferência e expedição.
            </p>
          </div>
          {mpConfig && (
            <div className="sm:ml-auto bg-white border border-emerald-200 text-emerald-800 text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-2 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              Fatura Conciliada via Mercado Pago
            </div>
          )}
        </div>

        {/* Dynamic Tracking Timeline */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-xs print:hidden">
          <h3 className="font-bold text-slate-800 text-base mb-6 flex items-center gap-2">
            <Package size={18} className="text-brand-primary" />
            Etapa Atual do Pedido
          </h3>
          <div className="relative">
            {/* Horizontal Line for timeline */}
            <div className="absolute top-1/2 left-4 right-4 h-1 bg-slate-100 -translate-y-1/2 hidden md:block" />
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
              <div className="flex items-center md:flex-col gap-4 md:text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-100">
                  <Check size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Pedido Criado</h4>
                  <p className="text-xs text-slate-500">Registrado no sistema</p>
                </div>
              </div>

              <div className="flex items-center md:flex-col gap-4 md:text-center">
                <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold shadow-md shadow-blue-100 animate-pulse">
                  <span className="text-xs">2</span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Aguardando Pagamento</h4>
                  <p className="text-xs text-slate-500">Processando faturamento</p>
                </div>
              </div>

              <div className="flex items-center md:flex-col gap-4 md:text-center opacity-50">
                <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold">
                  <span className="text-xs">3</span>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">Preparação & Expedição</h4>
                  <p className="text-xs text-slate-500">Separação no estoque</p>
                </div>
              </div>

              <div className="flex items-center md:flex-col gap-4 md:text-center opacity-50">
                <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold">
                  <span className="text-xs">4</span>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">Rota de Entrega</h4>
                  <p className="text-xs text-slate-500">União Logística a caminho</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Summary Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1 & 2: Items & Addresses */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Purchase Summary - Products */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-xs">
              <h3 className="font-bold text-slate-900 text-base mb-4 pb-3 border-b border-slate-100">
                Resumo dos Itens Comprados
              </h3>
              
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
                {confirmedItems.map((item) => (
                  <div key={item.id} className="py-4 flex gap-4 items-center">
                    <div className="w-14 h-14 bg-slate-50 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-100">
                      <OptimizedImage src={item.imagemPrincipal} alt={item.nome} width={100} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-bold text-brand-dark uppercase tracking-widest">{item.categoria}</span>
                      <h4 className="font-bold text-slate-900 text-sm truncate leading-snug">{item.nome}</h4>
                      <p className="text-xs text-slate-500">SKU: {item.sku || "N/A"}</p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-sm font-bold text-slate-800 block">
                        R$ {(Number(item.precoAplicado) * item.quantidade).toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {item.quantidade}x R$ {Number(item.precoAplicado).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Billing & Shipping Details */}
            {confirmedCustomer && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Contact and Billing */}
                <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-xs">
                  <h3 className="font-bold text-slate-900 text-base mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
                    <User size={18} className="text-brand-light" />
                    Dados do Comprador
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">Nome completo / Razão Social</span>
                      <span className="font-bold text-slate-800">{confirmedCustomer.nome}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">CPF / CNPJ</span>
                      <span className="font-mono text-slate-800">{confirmedCustomer.cpfCnpj}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:gap-4 gap-2">
                      <div className="flex-1">
                        <span className="text-xs text-slate-400 block font-medium">Telefone</span>
                        <span className="text-slate-800 flex items-center gap-1">
                          <Phone size={12} className="text-slate-400" />
                          {confirmedCustomer.telefone}
                        </span>
                      </div>
                      <div className="flex-1">
                        <span className="text-xs text-slate-400 block font-medium">Email</span>
                        <span className="text-slate-800 flex items-center gap-1 truncate" title={confirmedCustomer.email}>
                          <Mail size={12} className="text-slate-400 font-semibold" />
                          {confirmedCustomer.email}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shipping / Delivery */}
                <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-xs">
                  <h3 className="font-bold text-slate-900 text-base mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
                    <MapPin size={18} className="text-brand-light" />
                    Endereço de Entrega
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">Logradouro</span>
                      <span className="font-bold text-slate-800">{confirmedCustomer.endereco.logradouro}, {confirmedCustomer.endereco.numero}</span>
                    </div>
                    {confirmedCustomer.endereco.complemento && (
                      <div>
                        <span className="text-xs text-slate-400 block font-medium">Complemento</span>
                        <span className="text-slate-800">{confirmedCustomer.endereco.complemento}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-xs text-slate-400 block font-medium">Bairro</span>
                        <span className="text-slate-800">{confirmedCustomer.endereco.bairro}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 block font-medium">Cidade / UF</span>
                        <span className="text-slate-800">{confirmedCustomer.endereco.municipio} - {confirmedCustomer.endereco.uf}</span>
                      </div>
                    </div>
                    <div className="pt-1">
                      <span className="text-xs text-slate-400 block font-medium">CEP</span>
                      <span className="font-mono text-slate-800">{formatCEP(confirmedCustomer.endereco.cep)}</span>
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* Column 3: Totals & Payment triggers */}
          <div className="space-y-6">
            
            {/* Financial Details Box */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-xs">
              <h3 className="font-bold text-slate-900 text-base mb-4 pb-3 border-b border-slate-100">
                Resumo de Valores
              </h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-slate-800">
                    R$ {(Number(confirmedTotal) - Number(confirmedShippingCost)).toFixed(2)}
                  </span>
                </div>
                
                <div className="flex justify-between text-slate-500">
                  <span>Custo de Frete:</span>
                  <span className="font-semibold text-slate-800">
                    {confirmedShippingCost > 0 ? `R$ ${Number(confirmedShippingCost).toFixed(2)}` : "Grátis"}
                  </span>
                </div>

                <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-100 pt-3">
                  <span>Valor Total:</span>
                  <span className="text-lg text-emerald-600">
                    R$ {Number(confirmedTotal).toFixed(2)}
                  </span>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-400 block font-medium">Forma de Pagamento</span>
                  <span className="font-bold text-[#0071e3] text-sm flex items-center gap-1.5 mt-0.5">
                    <CreditCard size={14} />
                    {confirmedFormaPagamento === "17" ? "PIX" : confirmedFormaPagamento === "15" ? "Boleto Bancário" : "Cartão de Crédito"}
                  </span>
                </div>

                <div className="pt-2">
                  <span className="text-xs text-slate-400 block font-medium">Identificador do Pedido</span>
                  <span className="font-mono text-slate-800 font-bold block bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center text-xs mt-1">
                    {formattedOrderId}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Call To Actions */}
            {confirmedFormaPagamento === "17" && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-6 text-center space-y-4 shadow-xs">
                <p className="text-sm font-bold text-slate-700 flex items-center justify-center gap-2">
                  <QrCode size={18} className="text-[#0071e3]" />
                  Pague com PIX para liberação rápida
                </p>
                <div className="w-44 h-44 bg-white border border-slate-200 rounded-2xl mx-auto flex items-center justify-center shadow-sm overflow-hidden p-3 transition-all hover:scale-105">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(getDynamicPixCode(confirmedTotal))}`}
                    alt="QR Code PIX"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(getDynamicPixCode(confirmedTotal));
                    alert("Chave PIX Copiada!");
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold text-[#0071e3] bg-white hover:bg-slate-50 py-3 px-4 rounded-xl border border-slate-200 shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <Clipboard size={14} />
                  Copiar chave PIX Copia e Cola
                </button>
              </div>
            )}

            {confirmedFormaPagamento === "15" && (
              <div className="bg-[#00B1EA]/10 border border-[#00B1EA]/30 rounded-3xl p-6 text-center space-y-4 shadow-xs animate-fade-in">
                <div className="w-16 h-16 mx-auto bg-[#00B1EA]/20 text-[#00B1EA] rounded-full flex items-center justify-center">
                  <CreditCard size={32} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Pagamento via Mercado Pago</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Você escolheu pagar com Boleto Bancário. O processo de faturamento agora será concluído com segurança através do Mercado Pago.
                  </p>
                </div>
                <button 
                  onClick={() => window.open('https://www.mercadopago.com.br/', '_blank')}
                  className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-white bg-[#00B1EA] hover:bg-[#00B1EA]/90 py-3.5 px-4 rounded-xl shadow-md shadow-[#00B1EA]/20 transition-all active:scale-95 cursor-pointer"
                >
                  Continuar para Mercado Pago <ExternalLink size={16} />
                </button>
              </div>
            )}

            {/* Back Home & Orders Actions */}
            <div className="space-y-2 pt-2 print:hidden">
              <Link
                to="/cliente/pedidos"
                className="w-full flex items-center justify-center bg-brand-dark hover:bg-brand-primary text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-sm active:scale-[0.98]"
              >
                Acompanhar Meus Pedidos
              </Link>
              <Link
                to="/produtos"
                className="w-full flex items-center justify-center bg-white hover:bg-slate-50 text-[#0071e3] border border-slate-200 font-bold py-3.5 px-6 rounded-xl transition-all shadow-xs active:scale-[0.98]"
              >
                Voltar para o Catálogo
              </Link>
            </div>

          </div>

        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-brand-light">
          <ShoppingBag size={48} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Seu carrinho está vazio</h2>
        <p className="text-slate-500 mb-8 max-w-md">
          Explore nosso catálogo e encontre os melhores produtos de limpeza para o seu condomínio.
        </p>
        <Link
          to="/produtos"
          className="bg-brand-dark hover:bg-brand-primary text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-sm"
        >
          Ir para o Catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-1">
      {/* Steps Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => step === "checkout" ? setStep("cart") : navigate("/produtos")} 
            className="text-slate-400 hover:text-brand-dark transition-colors cursor-pointer"
            title="Voltar"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {step === "cart" ? "Seu Carrinho" : "Finalizar Compra"}
          </h1>
        </div>
      </div>

      {renderStepper()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {step === "cart" ? (
          <>
            {/* Cart Items List */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-xs flex gap-4 items-center"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-100">
                    <OptimizedImage src={item.imagemPrincipal} alt={item.nome} width={150} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold text-brand-dark uppercase tracking-widest">{item.categoria}</span>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate leading-snug">{item.nome}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">SKU: {item.sku || "N/A"}</p>
                    
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-xs sm:text-sm font-bold text-slate-800">R$ {Number(item.precoAplicado).toFixed(2)}</span>
                      {Number(item.precoOriginal) > Number(item.precoAplicado) && (
                        <span className="text-[10px] sm:text-xs text-slate-400 line-through">R$ {Number(item.precoOriginal).toFixed(2)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
                    {/* Quantity Selector */}
                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                      <button 
                        onClick={() => handleUpdateQty(item.id, item.quantidade, -1)}
                        className="px-2 py-1 text-slate-600 hover:bg-slate-200 text-sm font-bold transition-all"
                      >
                        -
                      </button>
                      <span className="px-3 text-slate-800 text-sm font-bold select-none">{item.quantidade}</span>
                      <button 
                        onClick={() => handleUpdateQty(item.id, item.quantidade, 1)}
                        className="px-2 py-1 text-slate-600 hover:bg-slate-200 text-sm font-bold transition-all"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right hidden sm:block min-w-[80px]">
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total</p>
                      <p className="font-bold text-slate-950 text-sm">R$ {(Number(item.precoAplicado) * Number(item.quantidade)).toFixed(2)}</p>
                    </div>

                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="text-slate-400 hover:text-red-500 p-2 transition-colors"
                      title="Remover"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary Box */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm h-fit space-y-6">
              <h3 className="font-bold text-slate-900 text-lg">Resumo do Pedido</h3>
              
              <div className="space-y-3.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal ({totalItems} itens):</span>
                  <span className="font-bold text-slate-900">R$ {Number(totalAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Frete estimado:</span>
                  <span className="font-bold text-emerald-600">
                    {shippingCost === 0 ? "Grátis" : `R$ ${Number(shippingCost).toFixed(2)}`}
                  </span>
                </div>
                {shippingCost > 0 && (shippingConfig ? Number(shippingConfig.freteGratisMinimo ?? 300) : 300) > 0 && (
                  <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    💡 Dica: Adicione mais R$ {Number((shippingConfig ? Number(shippingConfig.freteGratisMinimo ?? 300) : 300) - totalAmount).toFixed(2)} em produtos para ganhar frete grátis!
                  </p>
                )}
                
                <div className="border-t border-slate-100 pt-4 flex justify-between items-baseline">
                  <span className="text-base font-bold text-slate-900">Total:</span>
                  <span className="text-2xl font-black text-[#0071e3]">R$ {Number(finalTotal).toFixed(2)}</span>
                </div>
              </div>

              {!profile ? (
                <div className="space-y-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                  <p className="text-xs text-slate-600">Faça login para faturar seu pedido.</p>
                  <Link 
                    to="/minha-conta"
                    className="w-full bg-[#0071e3] hover:bg-[#0071e3]/90 text-white font-bold py-3 px-4 rounded-xl block text-center text-sm shadow-sm transition-all"
                  >
                    Fazer Login
                  </Link>
                </div>
              ) : (
                <button
                  onClick={() => {
                  if (isStaffRole(profile?.role)) {
                    alert("Apenas clientes podem realizar faturamento.");
                    return;
                  }
                  setStep("checkout");
                }}
                  className="w-full bg-brand-dark hover:bg-brand-primary text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 text-base shadow-md transition-all hover:scale-101 active:scale-99"
                >
                  Prosseguir para o Faturamento
                  <ChevronRight size={18} />
                </button>
              )}

              <Link
                to="/produtos"
                className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-3 px-4 rounded-xl block text-center text-sm shadow-3xs transition-all active:scale-99 flex items-center justify-center gap-2"
              >
                <ShoppingBag size={16} />
                Continuar Comprando
              </Link>
            </div>
          </>
        ) : (
          /* Checkout Billing and Address form */
          <form onSubmit={handleCheckout} className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form Fields Column */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
              <h3 className="font-bold text-slate-900 text-xl border-b border-slate-100 pb-3">Informações de Faturamento e Entrega</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Nome Completo / Razão Social</label>
                  <input 
                    type="text" 
                    value={nome}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNome(val);
                      validateField("nome", val);
                    }}
                    onBlur={(e) => validateField("nome", e.target.value)}
                    className={`w-full p-3 border rounded-xl outline-none text-sm transition-all ${errors.nome ? "border-red-500 bg-red-50/20" : "border-slate-200 focus:ring-2 focus:ring-brand-light"}`}
                    placeholder="Nome ou Razão Social"
                  />
                  {errors.nome && <p className="text-red-500 text-[11px] font-semibold">{errors.nome}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">CPF ou CNPJ (obrigatório para NF-e)</label>
                  <input 
                    type="text" 
                    value={cpfCnpj}
                    onChange={(e) => {
                      const masked = formatCpfCnpj(e.target.value);
                      setCpfCnpj(masked);
                      validateField("cpfCnpj", masked);
                    }}
                    onBlur={(e) => validateField("cpfCnpj", e.target.value)}
                    className={`w-full p-3 border rounded-xl outline-none text-sm transition-all ${errors.cpfCnpj ? "border-red-500 bg-red-50/20" : "border-slate-200 focus:ring-2 focus:ring-brand-light"}`}
                    placeholder="000.000.000-00 ou 00.000.000/0001-00"
                  />
                  {errors.cpfCnpj && <p className="text-red-500 text-[11px] font-semibold">{errors.cpfCnpj}</p>}
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Telefone / Celular</label>
                  <input 
                    type="text" 
                    value={telefone}
                    onChange={(e) => {
                      const masked = formatTelefone(e.target.value);
                      setTelefone(masked);
                      validateField("telefone", masked);
                    }}
                    onBlur={(e) => validateField("telefone", e.target.value)}
                    className={`w-full p-3 border rounded-xl outline-none text-sm transition-all ${errors.telefone ? "border-red-500 bg-red-50/20" : "border-slate-200 focus:ring-2 focus:ring-brand-light"}`}
                    placeholder="(62) 99999-9999"
                  />
                  {errors.telefone && <p className="text-red-500 text-[11px] font-semibold">{errors.telefone}</p>}
                </div>

                <div className="space-y-1.5 sm:col-span-2 border-t border-slate-100 pt-4 mt-2">
                  <h4 className="font-bold text-slate-800 text-sm mb-1">Endereço de Entrega</h4>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Endereço (Rua, Avenida, etc.)</label>
                  <input 
                    type="text" 
                    value={endereco}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEndereco(val);
                      validateField("endereco", val);
                    }}
                    onBlur={(e) => validateField("endereco", e.target.value)}
                    className={`w-full p-3 border rounded-xl outline-none text-sm transition-all ${errors.endereco ? "border-red-500 bg-red-50/20" : "border-slate-200 focus:ring-2 focus:ring-brand-light"}`}
                    placeholder="Rua das Acácias"
                  />
                  {errors.endereco && <p className="text-red-500 text-[11px] font-semibold">{errors.endereco}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Número</label>
                  <input 
                    type="text" 
                    value={numero}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNumero(val);
                      validateField("numero", val);
                    }}
                    onBlur={(e) => validateField("numero", e.target.value)}
                    className={`w-full p-3 border rounded-xl outline-none text-sm transition-all ${errors.numero ? "border-red-500 bg-red-50/20" : "border-slate-200 focus:ring-2 focus:ring-brand-light"}`}
                    placeholder="123"
                  />
                  {errors.numero && <p className="text-red-500 text-[11px] font-semibold">{errors.numero}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Complemento</label>
                  <input 
                    type="text" 
                    value={complemento}
                    onChange={(e) => setComplemento(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl outline-none text-sm focus:ring-2 focus:ring-brand-light transition-all"
                    placeholder="Apto 101, Bloco B"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Bairro</label>
                  <input 
                    type="text" 
                    value={bairro}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBairro(val);
                      validateField("bairro", val);
                    }}
                    onBlur={(e) => validateField("bairro", e.target.value)}
                    className={`w-full p-3 border rounded-xl outline-none text-sm transition-all ${errors.bairro ? "border-red-500 bg-red-50/20" : "border-slate-200 focus:ring-2 focus:ring-brand-light"}`}
                    placeholder="Jardim América"
                  />
                  {errors.bairro && <p className="text-red-500 text-[11px] font-semibold">{errors.bairro}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">CEP</label>
                  <input 
                    type="text" 
                    value={cep}
                    onChange={(e) => {
                      const masked = formatCEP(e.target.value);
                      setCep(masked);
                      validateField("cep", masked);
                    }}
                    onBlur={(e) => validateField("cep", e.target.value)}
                    className={`w-full p-3 border rounded-xl outline-none text-sm transition-all ${errors.cep ? "border-red-500 bg-red-50/20" : "border-slate-200 focus:ring-2 focus:ring-brand-light"}`}
                    placeholder="74000-000"
                    maxLength={9}
                  />
                  {errors.cep && <p className="text-red-500 text-[11px] font-semibold">{errors.cep}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Cidade</label>
                  <input 
                    type="text" 
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none text-sm"
                    readOnly
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Estado</label>
                  <input 
                    type="text" 
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none text-sm"
                    readOnly
                  />
                </div>
              </div>
            </div>

            {/* Payment and Submission Column */}
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 text-lg">Método de Pagamento</h3>
                  {mpConfig && (
                    <span className="text-[10px] bg-blue-100 text-[#0071e3] font-bold py-1 px-2.5 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Mercado Pago Ativo
                    </span>
                  )}
                </div>

                {mpConfig && (
                  <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-[11px] text-[#0071e3] space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      🛡️ Gateway Seguro Mercado Pago
                    </p>
                    <p className="text-slate-600">
                      Suas credenciais estão ativas. A faturamento e conciliação serão processadas de forma 100% automática usando chaves terminadas em <code className="bg-blue-100 px-1 py-0.5 rounded text-xs">...{mpConfig.publicKey ? mpConfig.publicKey.substring(mpConfig.publicKey.length - 6) : "API"}</code>.
                    </p>
                  </div>
                )}
                
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-4 border rounded-2xl cursor-pointer transition-colors hover:bg-slate-50 border-slate-200 bg-white">
                    <input 
                      type="radio" 
                      name="payment" 
                      value="17" 
                      checked={formaPagamento === "17"} 
                      onChange={() => setFormaPagamento("17")} 
                      className="text-[#0071e3] focus:ring-[#0071e3]"
                    />
                    <div className="flex-1">
                      <p className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        PIX
                        {mpConfig && <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">Automático</span>}
                      </p>
                      <p className="text-xs text-slate-500">Liberação imediata</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-4 border rounded-2xl cursor-pointer transition-colors hover:bg-slate-50 border-slate-200 bg-white">
                    <input 
                      type="radio" 
                      name="payment" 
                      value="15" 
                      checked={formaPagamento === "15"} 
                      onChange={() => setFormaPagamento("15")} 
                      className="text-[#0071e3] focus:ring-[#0071e3]"
                    />
                    <div className="flex-1">
                      <p className="font-bold text-slate-900 text-sm">Boleto Bancário</p>
                      <p className="text-xs text-slate-500">Faturamento em até 2 dias</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-4 border rounded-2xl cursor-pointer transition-colors hover:bg-slate-50 border-slate-200 bg-white">
                    <input 
                      type="radio" 
                      name="payment" 
                      value="03" 
                      checked={formaPagamento === "03"} 
                      onChange={() => setFormaPagamento("03")} 
                      className="text-[#0071e3] focus:ring-[#0071e3]"
                    />
                    <div className="flex-1">
                      <p className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        Cartão de Crédito
                        {mpConfig && <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">Automático</span>}
                      </p>
                      <p className="text-xs text-slate-500">Em até 12x via Mercado Pago</p>
                    </div>
                  </label>

                  {formaPagamento === "03" && mpConfig && (
                    <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/60 space-y-3.5 mt-3 animate-fade-in text-left">
                      <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                        💳 Dados do Cartão de Crédito
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Nome Completo do Titular</label>
                        <input 
                          type="text" 
                          required
                          placeholder="Nome impresso no cartão"
                          value={cardNome}
                          onChange={(e) => setCardNome(e.target.value)}
                          className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs outline-none focus:ring-2 focus:ring-[#0071e3]/20"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Número do Cartão</label>
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
                          className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs outline-none focus:ring-2 focus:ring-[#0071e3]/20"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 uppercase">Validade</label>
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
                            className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs outline-none focus:ring-2 focus:ring-[#0071e3]/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 uppercase">Código CVV</label>
                          <input 
                            type="text" 
                            required
                            placeholder="123"
                            maxLength={4}
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ""))}
                            className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs outline-none focus:ring-2 focus:ring-[#0071e3]/20"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Parcelamento</label>
                        <select 
                          value={cardParcelas}
                          onChange={(e) => setCardParcelas(e.target.value)}
                          className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs outline-none focus:ring-2 focus:ring-[#0071e3]/20"
                        >
                          <option value="1">1x de R$ {Number(finalTotal).toFixed(2)} sem juros</option>
                          <option value="2">2x de R$ {Number(finalTotal / 2).toFixed(2)} sem juros</option>
                          <option value="3">3x de R$ {Number(finalTotal / 3).toFixed(2)} sem juros</option>
                          <option value="4">4x de R$ {Number(finalTotal / 4).toFixed(2)} sem juros</option>
                          <option value="6">6x de R$ {Number(finalTotal / 6).toFixed(2)} sem juros</option>
                          <option value="12">12x de R$ {Number(finalTotal * 1.08 / 12).toFixed(2)} com juros do gateway</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Final Summary */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-900 text-lg">Resumo do Pedido</h3>
                
                <div className="space-y-3.5 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-bold text-slate-950">R$ {Number(totalAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Frete:</span>
                    <span className="font-bold text-emerald-600">
                      {shippingCost === 0 ? "Grátis" : `R$ ${Number(shippingCost).toFixed(2)}`}
                    </span>
                  </div>
                  <div className="border-t border-slate-100 pt-4 flex justify-between items-baseline">
                    <span className="text-base font-bold text-slate-900">Total:</span>
                    <span className="text-xl font-black text-[#0071e3]">R$ {Number(finalTotal).toFixed(2)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0071e3] hover:bg-[#0071e3]/90 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 text-base shadow-lg transition-all disabled:opacity-50 mt-4 cursor-pointer"
                >
                  {loading ? (
                    "Processando..."
                  ) : (
                    <>
                      <CreditCard size={18} />
                      Confirmar e Finalizar Compra
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
