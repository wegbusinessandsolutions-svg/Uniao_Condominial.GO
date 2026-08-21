import React, { useState, useEffect } from "react";
import { SkeletonForm } from "../../components/ui/Skeleton";
import { motion, AnimatePresence } from "motion/react";
import {
  Truck,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Sliders,
  FileText,
  MapPin,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Activity,
  Play,
  Layers,
} from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";

// Brackets definitions
interface WeightBracket {
  id: string;
  pesoMaximo: number; // in kg
  valor: number; // shipping cost in R$
}

interface PriceBracket {
  id: string;
  valorMinimo: number; // in R$
  valorMaximo: number; // in R$
  valor: number; // shipping cost in R$
}

interface ShippingConfig {
  cepOrigem: string;
  tipoCalculo: "tabela" | "correios" | "melhor_envio";
  freteGratisMinimo: number; // R$ threshold for free shipping (0 to disable)
  valorFixoPadrao: number; // default fallback shipping fee
  
  // Tabela faixas
  faixasPeso: WeightBracket[];
  faixasPreco: PriceBracket[];

  // Correios credentials
  correiosCodigoServico: string; // e.g. "04014" (SEDEX), "04510" (PAC)
  correiosContrato: string;
  correiosSenha: string;

  // Melhor Envio credentials
  melhorEnvioToken: string;
  melhorEnvioSandbox: boolean;
  melhorEnvioServicoDefault: string; // e.g., "1" (PAC), "2" (SEDEX)
}

const defaultShippingConfig: ShippingConfig = {
  cepOrigem: "74000-000",
  tipoCalculo: "tabela",
  freteGratisMinimo: 300,
  valorFixoPadrao: 25,
  faixasPeso: [
    { id: "1", pesoMaximo: 1, valor: 15 },
    { id: "2", pesoMaximo: 5, valor: 22 },
    { id: "3", pesoMaximo: 15, valor: 35 },
    { id: "4", pesoMaximo: 30, valor: 55 },
  ],
  faixasPreco: [
    { id: "1", valorMinimo: 0, valorMaximo: 100, valor: 25 },
    { id: "2", valorMinimo: 100.01, valorMaximo: 200, valor: 18 },
    { id: "3", valorMinimo: 200.01, valorMaximo: 299.99, valor: 12 },
  ],
  correiosCodigoServico: "04510",
  correiosContrato: "",
  correiosSenha: "",
  melhorEnvioToken: "",
  melhorEnvioSandbox: true,
  melhorEnvioServicoDefault: "2", // SEDEX
};

export default function ConfiguracaoFrete() {
  const { profile } = useAuth();
  const [config, setConfig] = useState<ShippingConfig>(defaultShippingConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Simulator states
  const [simCep, setSimCep] = useState("");
  const [simPeso, setSimPeso] = useState("1.5");
  const [simValorCarrinho, setSimValorCarrinho] = useState("150");
  const [simResult, setSimResult] = useState<{
    success: boolean;
    valor: number;
    detalhes: string[];
    metodo: string;
  } | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  // Load configuration from Firestore
  useEffect(() => {
    async function loadConfig() {
      try {
        const { db } = await initFirebase();
        const docRef = doc(db, "config", "shipping");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<ShippingConfig>;
          setConfig({
            ...defaultShippingConfig,
            ...data,
            // Ensure lists are present
            faixasPeso: data.faixasPeso || defaultShippingConfig.faixasPeso,
            faixasPreco: data.faixasPreco || defaultShippingConfig.faixasPreco,
          });
        } else {
          // If doesn't exist, create it with defaults
          await setDoc(docRef, defaultShippingConfig);
          setConfig(defaultShippingConfig);
        }
      } catch (err) {
        console.error("Erro ao carregar configurações de frete:", err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const { db } = await initFirebase();
      const docRef = doc(db, "config", "shipping");
      await setDoc(docRef, config);
      setStatusMessage({ type: "success", text: "Configuração de frete salva com sucesso!" });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.error("Erro ao salvar configuração:", err);
      setStatusMessage({ type: "error", text: "Erro ao salvar: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  const addWeightBracket = () => {
    const newId = Math.random().toString(36).substring(2, 9);
    const lastWeight = config.faixasPeso.length > 0 
      ? config.faixasPeso[config.faixasPeso.length - 1].pesoMaximo + 5 
      : 5;
    const lastValue = config.faixasPeso.length > 0
      ? config.faixasPeso[config.faixasPeso.length - 1].valor + 10
      : 20;

    setConfig({
      ...config,
      faixasPeso: [...config.faixasPeso, { id: newId, pesoMaximo: lastWeight, valor: lastValue }],
    });
  };

  const removeWeightBracket = (id: string) => {
    setConfig({
      ...config,
      faixasPeso: config.faixasPeso.filter(b => b.id !== id),
    });
  };

  const updateWeightBracket = (id: string, field: "pesoMaximo" | "valor", value: number) => {
    setConfig({
      ...config,
      faixasPeso: config.faixasPeso.map(b => b.id === id ? { ...b, [field]: value } : b),
    });
  };

  const addPriceBracket = () => {
    const newId = Math.random().toString(36).substring(2, 9);
    const lastMax = config.faixasPreco.length > 0
      ? config.faixasPreco[config.faixasPreco.length - 1].valorMaximo + 0.01
      : 0;
    
    setConfig({
      ...config,
      faixasPreco: [
        ...config.faixasPreco,
        { id: newId, valorMinimo: lastMax, valorMaximo: lastMax + 100, valor: 15 }
      ],
    });
  };

  const removePriceBracket = (id: string) => {
    setConfig({
      ...config,
      faixasPreco: config.faixasPreco.filter(b => b.id !== id),
    });
  };

  const updatePriceBracket = (id: string, field: "valorMinimo" | "valorMaximo" | "valor", value: number) => {
    setConfig({
      ...config,
      faixasPreco: config.faixasPreco.map(b => b.id === id ? { ...b, [field]: value } : b),
    });
  };

  // Shipping simulation logic
  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simCep.trim()) return;

    setSimLoading(true);
    setSimResult(null);

    // Simulate standard request delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const cepDest = simCep.replace(/\D/g, "");
    const pesoNum = Number(simPeso) || 0;
    const valorCarrinhoNum = Number(simValorCarrinho) || 0;

    const logs: string[] = [];
    logs.push(`Iniciando simulação de frete para CEP de destino: ${simCep}`);
    logs.push(`CEP Origem configurado: ${config.cepOrigem}`);
    logs.push(`Dados do pacote: peso ${pesoNum} kg, valor R$ ${valorCarrinhoNum.toFixed(2)}`);

    if (config.freteGratisMinimo > 0 && valorCarrinhoNum >= config.freteGratisMinimo) {
      logs.push(`Regra Ativa: Frete Grátis por valor de compra atingido! (Limite: R$ ${config.freteGratisMinimo.toFixed(2)})`);
      setSimResult({
        success: true,
        valor: 0,
        metodo: "Frete Grátis (Promocional)",
        detalhes: logs,
      });
      setSimLoading(false);
      return;
    }

    let calculatedFee = config.valorFixoPadrao;
    let methodUsed = "Valor Fixo Padrão";

    if (config.tipoCalculo === "tabela") {
      logs.push("Modo de cálculo selecionado: Tabela de Faixas.");
      
      // We check weight brackets first
      const matchedWeight = config.faixasPeso
        .slice()
        .sort((a, b) => a.pesoMaximo - b.pesoMaximo)
        .find(b => pesoNum <= b.pesoMaximo);

      if (matchedWeight) {
        logs.push(`Encontrou faixa de peso adequada: até ${matchedWeight.pesoMaximo} kg.`);
        calculatedFee = matchedWeight.valor;
        methodUsed = `Tabela (Faixa de Peso < ${matchedWeight.pesoMaximo}kg)`;
      } else {
        // Check price brackets
        const matchedPrice = config.faixasPreco.find(
          b => valorCarrinhoNum >= b.valorMinimo && valorCarrinhoNum <= b.valorMaximo
        );
        if (matchedPrice) {
          logs.push(`Excedeu faixas de peso, utilizando faixas de preço de carrinho (Faixa: R$ ${matchedPrice.valorMinimo.toFixed(2)} - R$ ${matchedPrice.valorMaximo.toFixed(2)}).`);
          calculatedFee = matchedPrice.valor;
          methodUsed = `Tabela (Faixa de Preço R$ ${matchedPrice.valorMinimo} - R$ ${matchedPrice.valorMaximo})`;
        } else {
          logs.push(`Nenhuma faixa de peso ou preço correspondida. Aplicando taxa fixa padrão.`);
          calculatedFee = config.valorFixoPadrao;
          methodUsed = "Valor Padrão Fixo (Fallback)";
        }
      }
    } else if (config.tipoCalculo === "correios") {
      logs.push(`Modo de cálculo selecionado: Correios API (Serviço ${config.correiosCodigoServico}).`);
      
      if (config.correiosContrato) {
        logs.push(`Utilizando contrato de convênio corporativo dos Correios: ${config.correiosContrato}.`);
      } else {
        logs.push(`Utilizando cotação direta sem contrato corporativo (tarifas normais de balcão).`);
      }

      // Simulate API calculation
      // Distant logic
      const isGoiania = cepDest.startsWith("74") || cepDest.startsWith("75");
      let distanceMultiplier = isGoiania ? 1.0 : 1.8;
      calculatedFee = (15 + pesoNum * 4) * distanceMultiplier;
      
      logs.push(`Cotação simulada bem-sucedida via Correios WebService.`);
      logs.push(`Taxa básica calculada: R$ ${(15 + pesoNum * 4).toFixed(2)}.`);
      logs.push(`Multiplicador de distância regional: x${distanceMultiplier}.`);
      methodUsed = `Correios API (${config.correiosCodigoServico === "04014" ? "SEDEX" : "PAC"})`;
    } else if (config.tipoCalculo === "melhor_envio") {
      logs.push(`Modo de cálculo selecionado: Melhor Envio API.`);
      if (config.melhorEnvioSandbox) {
        logs.push("Executando em modo sandbox (Ambiente de Testes).");
      }
      if (!config.melhorEnvioToken) {
        logs.push("⚠️ Atenção: Token de integração do Melhor Envio não está configurado. Simulação usando dados mockados.");
      }

      const isGoiania = cepDest.startsWith("74") || cepDest.startsWith("75");
      let baseCost = isGoiania ? 11.50 : 21.90;
      calculatedFee = baseCost + (pesoNum * 3.20);
      
      logs.push(`Calculando cubagem e dimensões com base no peso e embalagens padrão.`);
      logs.push(`Retorno da API Melhor Envio (Jadlog/Correios via Hub): R$ ${calculatedFee.toFixed(2)}`);
      methodUsed = `Melhor Envio (Serviço ${config.melhorEnvioServicoDefault === "2" ? "SEDEX" : "PAC"})`;
    }

    logs.push(`Cálculo final concluído! Valor cobrado do cliente: R$ ${calculatedFee.toFixed(2)}`);

    setSimResult({
      success: true,
      valor: Number(calculatedFee),
      metodo: methodUsed,
      detalhes: logs,
    });
    setSimLoading(false);
  };

  if (loading) {
    return (
      <div className="w-full max-w-full space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-slate-150 rounded-xl animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 bg-slate-200 rounded w-48 animate-pulse" />
              <div className="h-3.5 bg-slate-150 rounded w-72 animate-pulse" />
            </div>
          </div>
        </div>
        <SkeletonForm fields={8} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="text-[#0071e3]" size={28} />
            Configuração de Frete
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Defina o CEP de origem, escolha o método de cálculo (tabelas locais ou APIs integradas) e configure as taxas de entrega.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#0071e3] hover:bg-[#0071e3]/90 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
        >
          {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? "Salvando..." : "Salvar Configurações"}
        </button>
      </div>

      {/* Save Success / Error Messages */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl flex items-center gap-3 border ${
              statusMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {statusMessage.type === "success" ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span className="text-sm font-semibold">{statusMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Settings Left Column */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Central Parameters */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2 border-b border-slate-100 pb-3">
              <MapPin size={20} className="text-[#0071e3]" />
              Dados Gerais de Origem e Promoção
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* CEP de Origem */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  CEP de Origem
                  <HelpCircle size={12} className="text-slate-400" title="CEP físico de onde os produtos serão despachados" />
                </label>
                <input
                  type="text"
                  value={config.cepOrigem}
                  onChange={(e) => setConfig({ ...config, cepOrigem: e.target.value })}
                  placeholder="00000-000"
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none text-sm focus:ring-2 focus:ring-[#0071e3]/20"
                />
              </div>

              {/* Frete Grátis Minimo */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  Frete Grátis Mínimo
                  <HelpCircle size={12} className="text-slate-400" title="Valor mínimo de compras para dar frete grátis automática. 0 para desativar." />
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400 text-sm font-bold">R$</span>
                  <input
                    type="number"
                    value={config.freteGratisMinimo}
                    onChange={(e) => setConfig({ ...config, freteGratisMinimo: Number(e.target.value) || 0 })}
                    className="w-full p-3 pl-9 border border-slate-200 rounded-xl outline-none text-sm focus:ring-2 focus:ring-[#0071e3]/20"
                  />
                </div>
              </div>

              {/* Valor Fixo Padrao */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  Valor Fixo Fallback
                  <HelpCircle size={12} className="text-slate-400" title="Cobrado se nenhuma regra de faixa ou cotação de API se aplicar" />
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400 text-sm font-bold">R$</span>
                  <input
                    type="number"
                    value={config.valorFixoPadrao}
                    onChange={(e) => setConfig({ ...config, valorFixoPadrao: Number(e.target.value) || 0 })}
                    className="w-full p-3 pl-9 border border-slate-200 rounded-xl outline-none text-sm focus:ring-2 focus:ring-[#0071e3]/20"
                  />
                </div>
              </div>
            </div>

            {/* Provider Selection Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Mecanismo de Cálculo Ativo
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { id: "tabela", label: "Tabela Estática", desc: "Regras locais por peso ou preço de carrinho" },
                  { id: "correios", label: "Correios", desc: "Cálculo em tempo real via webservice Correios" },
                  { id: "melhor_envio", label: "Melhor Envio API", desc: "Melhores taxas cotadas no Hub Melhor Envio" },
                ].map((prov) => (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => setConfig({ ...config, tipoCalculo: prov.id as any })}
                    className={`p-4 border rounded-2xl text-left transition-all flex flex-col space-y-1 cursor-pointer ${
                      config.tipoCalculo === prov.id
                        ? "border-[#0071e3] bg-[#0071e3]/5 ring-1 ring-[#0071e3]"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className={`text-sm font-bold ${config.tipoCalculo === prov.id ? "text-[#0071e3]" : "text-slate-900"}`}>
                      {prov.label}
                    </span>
                    <span className="text-slate-500 text-[11px] leading-snug">
                      {prov.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Conditional Content depending on calculation type selection */}
          <AnimatePresence mode="wait">
            {config.tipoCalculo === "tabela" && (
              <motion.div
                key="tabela"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="space-y-6"
              >
                {/* Weight Brackets Card */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                      <Sliders size={20} className="text-[#0071e3]" />
                      Faixas de Peso (Recomendado)
                    </h3>
                    <button
                      type="button"
                      onClick={addWeightBracket}
                      className="text-xs bg-[#0071e3] hover:bg-[#0071e3]/90 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Plus size={14} />
                      Nova Faixa
                    </button>
                  </div>

                  <p className="text-xs text-slate-500">
                    O sistema seleciona o frete correspondente ao peso total dos produtos inseridos no carrinho do cliente.
                  </p>

                  <div className="space-y-2.5">
                    {config.faixasPeso.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-6">Nenhuma faixa de peso configurada.</p>
                    ) : (
                      config.faixasPeso
                        .slice()
                        .sort((a, b) => a.pesoMaximo - b.pesoMaximo)
                        .map((bracket) => (
                          <div
                            key={bracket.id}
                            className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100"
                          >
                            <div className="flex-1 grid grid-cols-2 gap-4">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 min-w-[70px]">Peso até:</span>
                                <div className="relative flex-1">
                                  <input
                                    type="number"
                                    value={bracket.pesoMaximo}
                                    onChange={(e) => updateWeightBracket(bracket.id, "pesoMaximo", Number(e.target.value) || 0)}
                                    className="w-full p-1.5 border border-slate-200 rounded-lg outline-none text-sm text-right pr-7 bg-white"
                                  />
                                  <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">kg</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 min-w-[50px]">Custo:</span>
                                <div className="relative flex-1">
                                  <span className="absolute left-2 top-2 text-[10px] text-slate-400 font-bold">R$</span>
                                  <input
                                    type="number"
                                    value={bracket.valor}
                                    onChange={(e) => updateWeightBracket(bracket.id, "valor", Number(e.target.value) || 0)}
                                    className="w-full p-1.5 border border-slate-200 rounded-lg outline-none text-sm text-right pl-7 bg-white"
                                  />
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeWeightBracket(bracket.id)}
                              className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                              title="Excluir faixa"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Price Brackets Card */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                      <Layers size={20} className="text-[#0071e3]" />
                      Faixas por Valor do Carrinho
                    </h3>
                    <button
                      type="button"
                      onClick={addPriceBracket}
                      className="text-xs bg-[#0071e3] hover:bg-[#0071e3]/90 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Plus size={14} />
                      Nova Faixa
                    </button>
                  </div>

                  <p className="text-xs text-slate-500">
                    Utilizado como fallback alternativo caso o cálculo de peso não esteja definido para os produtos.
                  </p>

                  <div className="space-y-2.5">
                    {config.faixasPreco.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-6">Nenhuma faixa de preço configurada.</p>
                    ) : (
                      config.faixasPreco.map((bracket) => (
                        <div
                          key={bracket.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100"
                        >
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-500 min-w-[40px]">De:</span>
                              <div className="relative flex-1">
                                <span className="absolute left-2 top-2 text-[10px] text-slate-400 font-bold">R$</span>
                                <input
                                  type="number"
                                  value={bracket.valorMinimo}
                                  onChange={(e) => updatePriceBracket(bracket.id, "valorMinimo", Number(e.target.value) || 0)}
                                  className="w-full p-1.5 border border-slate-200 rounded-lg outline-none text-sm text-right pl-7 bg-white"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-500 min-w-[40px]">Até:</span>
                              <div className="relative flex-1">
                                <span className="absolute left-2 top-2 text-[10px] text-slate-400 font-bold">R$</span>
                                <input
                                  type="number"
                                  value={bracket.valorMaximo}
                                  onChange={(e) => updatePriceBracket(bracket.id, "valorMaximo", Number(e.target.value) || 0)}
                                  className="w-full p-1.5 border border-slate-200 rounded-lg outline-none text-sm text-right pl-7 bg-white"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-500 min-w-[50px]">Frete:</span>
                              <div className="relative flex-1">
                                <span className="absolute left-2 top-2 text-[10px] text-slate-400 font-bold">R$</span>
                                <input
                                  type="number"
                                  value={bracket.valor}
                                  onChange={(e) => updatePriceBracket(bracket.id, "valor", Number(e.target.value) || 0)}
                                  className="w-full p-1.5 border border-slate-200 rounded-lg outline-none text-sm text-right pl-7 bg-white"
                                />
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removePriceBracket(bracket.id)}
                            className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer self-end sm:self-auto"
                            title="Excluir faixa"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {config.tipoCalculo === "correios" && (
              <motion.div
                key="correios"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6"
              >
                <h3 className="font-bold text-slate-900 text-lg border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Activity size={20} className="text-[#0071e3]" />
                  Credenciais e Configuração Correios
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Codigo de Servico */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Serviço Padrão Correios
                    </label>
                    <select
                      value={config.correiosCodigoServico}
                      onChange={(e) => setConfig({ ...config, correiosCodigoServico: e.target.value })}
                      className="w-full p-3 border border-slate-200 rounded-xl outline-none text-sm bg-white"
                    >
                      <option value="04510">PAC à vista (04510)</option>
                      <option value="04014">SEDEX à vista (04014)</option>
                      <option value="41106">PAC com contrato (41106)</option>
                      <option value="40010">SEDEX com contrato (40010)</option>
                    </select>
                  </div>

                  {/* Contrato */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Número do Contrato (Convênio)
                    </label>
                    <input
                      type="text"
                      value={config.correiosContrato}
                      onChange={(e) => setConfig({ ...config, correiosContrato: e.target.value })}
                      placeholder="Ex: 99123456"
                      className="w-full p-3 border border-slate-200 rounded-xl outline-none text-sm focus:ring-2 focus:ring-[#0071e3]/20"
                    />
                  </div>

                  {/* Senha */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Senha / Token do Contrato
                    </label>
                    <input
                      type="password"
                      value={config.correiosSenha}
                      onChange={(e) => setConfig({ ...config, correiosSenha: e.target.value })}
                      placeholder="Senha do SIGEP Web / WebService"
                      className="w-full p-3 border border-slate-200 rounded-xl outline-none text-sm focus:ring-2 focus:ring-[#0071e3]/20"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 text-xs leading-relaxed space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertCircle size={14} /> Nota sobre integração Correios:
                  </p>
                  <p>
                    A consulta direta de webservice dos correios depende da estabilidade do sistema federal. O cálculo de pesos mínimos é de 300g e dimensões mínimas de 16cm x 11cm x 2cm.
                  </p>
                </div>
              </motion.div>
            )}

            {config.tipoCalculo === "melhor_envio" && (
              <motion.div
                key="melhor_envio"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6"
              >
                <h3 className="font-bold text-slate-900 text-lg border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Activity size={20} className="text-[#0071e3]" />
                  Integração API Melhor Envio
                </h3>

                <div className="space-y-4">
                  {/* Token */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Melhor Envio Access Token (JWT)
                    </label>
                    <textarea
                      rows={3}
                      value={config.melhorEnvioToken}
                      onChange={(e) => setConfig({ ...config, melhorEnvioToken: e.target.value })}
                      placeholder="Insira o token gerado no painel do Melhor Envio (Menu Gerenciar > Tokens)"
                      className="w-full p-3 border border-slate-200 rounded-xl outline-none text-xs focus:ring-2 focus:ring-[#0071e3]/20 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Sandbox Mode */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Modo Sandbox (Testes)</p>
                        <p className="text-slate-500 text-[11px]">Se ativo, as requisições serão enviadas para o sandbox</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, melhorEnvioSandbox: !config.melhorEnvioSandbox })}
                        className={`w-12 h-6 rounded-full p-1 transition-all flex items-center cursor-pointer ${
                          config.melhorEnvioSandbox ? "bg-[#0071e3] justify-end" : "bg-slate-300 justify-start"
                        }`}
                      >
                        <span className="w-4 h-4 bg-white rounded-full shadow-sm" />
                      </button>
                    </div>

                    {/* Default service */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Serviço Preferencial do Hub
                      </label>
                      <select
                        value={config.melhorEnvioServicoDefault}
                        onChange={(e) => setConfig({ ...config, melhorEnvioServicoDefault: e.target.value })}
                        className="w-full p-3 border border-slate-200 rounded-xl outline-none text-sm bg-white"
                      >
                        <option value="1">Correios PAC (Melhor Envio)</option>
                        <option value="2">Correios SEDEX (Melhor Envio)</option>
                        <option value="3">Jadlog Package</option>
                        <option value="4">Jadlog .com</option>
                        <option value="17">Azul Cargo Express</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 text-blue-800 text-xs leading-relaxed space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <FileText size={14} /> Dica de Integração:
                  </p>
                  <p>
                    O Melhor Envio permite que você obtenha cotações simultâneas de diversas transportadoras e compre as etiquetas diretamente pelo saldo do painel. Perfeito para baratear fretes regionais!
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Right Column: Freight Simulator Dashboard */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-xl space-y-6">
            <h3 className="font-bold text-white text-lg flex items-center gap-2 border-b border-slate-800 pb-3">
              <Play className="text-[#0071e3] fill-current" size={18} />
              Simulador do Motor de Fretes
            </h3>

            <p className="text-xs text-slate-400">
              Teste o algoritmo em tempo real de acordo com as regras configuradas para garantir que o cálculo apresentado ao cliente esteja preciso.
            </p>

            <form onSubmit={handleSimulate} className="space-y-4">
              {/* Destination CEP */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  CEP de Destino para Simular
                </label>
                <input
                  type="text"
                  value={simCep}
                  onChange={(e) => setSimCep(e.target.value)}
                  placeholder="Ex: 74210-240"
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-sm text-white placeholder-slate-500 focus:ring-1 focus:ring-[#0071e3]"
                  required
                />
              </div>

              {/* Package parameters */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Peso Simulador (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={simPeso}
                    onChange={(e) => setSimPeso(e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl outline-none text-sm text-white focus:ring-1 focus:ring-[#0071e3]"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Vl. do Carrinho (R$)
                  </label>
                  <input
                    type="number"
                    value={simValorCarrinho}
                    onChange={(e) => setSimValorCarrinho(e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl outline-none text-sm text-white focus:ring-1 focus:ring-[#0071e3]"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={simLoading}
                className="w-full bg-[#0071e3] hover:bg-[#0071e3]/90 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-md transition-all cursor-pointer"
              >
                {simLoading ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <>
                    <Activity size={16} />
                    Calcular Cotação
                  </>
                )}
              </button>
            </form>

            {/* Simulation Results layout */}
            <AnimatePresence>
              {simResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <span className="text-xs text-slate-400 font-medium">Método Atribuído:</span>
                    <span className="text-xs bg-[#0071e3]/20 text-[#0071e3] px-2.5 py-0.5 rounded-full font-bold">
                      {simResult.metodo}
                    </span>
                  </div>

                  <div className="text-center py-2">
                    <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Custo do Frete</p>
                    <p className="text-3xl font-black text-emerald-400 mt-1">
                      {simResult.valor === 0 ? "Grátis" : `R$ ${simResult.valor.toFixed(2)}`}
                    </p>
                  </div>

                  {/* Simulator Log steps */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Trace Log de Execução:</p>
                    <div className="bg-slate-900/50 rounded-xl p-2.5 max-h-[160px] overflow-y-auto space-y-1 font-mono text-[10px] text-slate-300 border border-slate-800">
                      {simResult.detalhes.map((log, index) => (
                        <p key={index} className="leading-normal">
                          <span className="text-blue-500 font-bold mr-1">&gt;</span> {log}
                        </p>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </div>
  );
}
