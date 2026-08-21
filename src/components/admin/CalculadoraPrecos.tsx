import React, { useState, useEffect } from "react";
import { Calculator } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";

export default function CalculadoraPrecos() {
  const [nomeProduto, setNomeProduto] = useState("");
  const [custo, setCusto] = useState<number | "">("");
  
  const [cashbackRates, setCashbackRates] = useState({
    Bronze: 5,
    Prata: 7,
    Ouro: 10,
    Diamante: 12
  });

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const { db } = await initFirebase();
        const snap = await getDocs(collection(db, "clube_beneficios"));
        if (!snap.empty) {
          const newRates = { ...cashbackRates };
          snap.docs.forEach(doc => {
            const data = doc.data();
            const nivel = data.nivel?.toLowerCase();
            const perc = Number(data.percentual) || 0;
            if (nivel === "bronze") newRates.Bronze = perc;
            if (nivel === "prata") newRates.Prata = perc;
            if (nivel === "ouro") newRates.Ouro = perc;
            if (nivel === "diamante") newRates.Diamante = perc;
          });
          setCashbackRates(newRates);
        }
      } catch (err) {
        console.error("Erro ao buscar regras de cashback", err);
      }
    };
    fetchRates();
  }, []);

  const [impostosPerc, setImpostosPerc] = useState<number | "">(9.25);
  const [custoNegocioPerc, setCustoNegocioPerc] = useState<number | "">(10);
  const [indicacaoPerc, setIndicacaoPerc] = useState<number | "">(1);
  const [lucroFixoPerc, setLucroFixoPerc] = useState<number | "">(15);

  const impostos = Number(impostosPerc) / 100 || 0;
  const indicacao = Number(indicacaoPerc) / 100 || 0;
  const custoNegocio = Number(custoNegocioPerc) / 100 || 0;
  const lucroFixo = Number(lucroFixoPerc) / 100 || 0;
  
  // Base fixed percentages
  const fixedPercentages = impostos + indicacao + custoNegocio + lucroFixo;

  const calculatePrice = (cashbackPerc: number) => {
    if (!custo || custo <= 0) return 0;
    const totalPercentage = fixedPercentages + (cashbackPerc / 100);
    // P = C / (1 - totalPercentage)
    if (totalPercentage >= 1) return 0; // Invalid math if percentages exceed 100%
    return custo / (1 - totalPercentage);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-8">
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center text-brand-dark">
          <Calculator className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Calculadora de Preço de Venda</h2>
          <p className="text-sm text-slate-500">Formação automática com base em Custo, Impostos e Cashback.</p>
        </div>
      </div>
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1">Nome do Produto</label>
            <input 
              type="text" 
              value={nomeProduto}
              onChange={e => setNomeProduto(e.target.value)}
              placeholder="Ex: Desinfetante 5L"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-light outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1">Preço de Custo (R$)</label>
            <input 
              type="number" 
              min="0"
              step="0.01"
              value={custo}
              onChange={e => setCusto(parseFloat(e.target.value) || "")}
              placeholder="0,00"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-light outline-none"
            />
          </div>
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 mt-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Composição Padrão (%)</h4>
            <div className="flex justify-between items-center text-sm gap-4">
              <span className="text-slate-500 whitespace-nowrap">Impostos (Lucro Real)</span>
              <input 
                type="number"
                step="0.01"
                min="0"
                value={impostosPerc}
                onChange={e => setImpostosPerc(parseFloat(e.target.value) || "")}
                className="w-24 px-2 py-1.5 text-right rounded-md border border-slate-300 focus:ring-2 focus:ring-brand-light outline-none"
              />
            </div>
            <div className="flex justify-between items-center text-sm gap-4">
              <span className="text-slate-500 whitespace-nowrap">Margem Custo do Negócio</span>
              <input 
                type="number"
                step="0.01"
                min="0"
                value={custoNegocioPerc}
                onChange={e => setCustoNegocioPerc(parseFloat(e.target.value) || "")}
                className="w-24 px-2 py-1.5 text-right rounded-md border border-slate-300 focus:ring-2 focus:ring-brand-light outline-none"
              />
            </div>
            <div className="flex justify-between items-center text-sm gap-4">
              <span className="text-slate-500 whitespace-nowrap">Indicação de Consultor</span>
              <input 
                type="number"
                step="0.01"
                min="0"
                value={indicacaoPerc}
                onChange={e => setIndicacaoPerc(parseFloat(e.target.value) || "")}
                className="w-24 px-2 py-1.5 text-right rounded-md border border-slate-300 focus:ring-2 focus:ring-brand-light outline-none"
              />
            </div>
            <div className="flex justify-between items-center text-sm gap-4">
              <span className="text-slate-500 whitespace-nowrap">Margem de Lucro Fixa</span>
              <input 
                type="number"
                step="0.01"
                min="0"
                value={lucroFixoPerc}
                onChange={e => setLucroFixoPerc(parseFloat(e.target.value) || "")}
                className="w-24 px-2 py-1.5 text-right rounded-md border border-slate-300 focus:ring-2 focus:ring-brand-light outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-4">Preços de Venda Sugeridos</h3>
          <div className="space-y-4">
            {[
              { level: "Bronze", perc: cashbackRates.Bronze, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
              { level: "Prata", perc: cashbackRates.Prata, color: "text-slate-700", bg: "bg-slate-100", border: "border-slate-300" },
              { level: "Ouro", perc: cashbackRates.Ouro, color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-300" },
              { level: "Diamante", perc: cashbackRates.Diamante, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-300" }
            ].map(tier => {
              const pVenda = calculatePrice(tier.perc);
              const isValido = pVenda > 0;
              const formatMoney = (val: number) => `R$ ${val.toFixed(2).replace('.', ',')}`;
              
              return (
                <div key={tier.level} className={`rounded-xl border overflow-hidden ${tier.border}`}>
                  <div className={`p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${tier.bg}`}>
                    <div>
                      <div className={`font-bold ${tier.color} text-sm uppercase tracking-wider`}>{tier.level}</div>
                      <div className="text-xs opacity-75 mt-0.5">Venda Sugerida</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-slate-900">
                        {isValido ? formatMoney(pVenda) : "R$ 0,00"}
                      </div>
                    </div>
                  </div>
                  
                  {isValido && (
                    <div className="p-4 bg-white space-y-2 border-t border-slate-100/50">
                      <div className="text-xs font-bold text-slate-500 uppercase mb-2">Composição do Preço</div>
                      <div className="flex justify-between items-center text-sm py-1 border-b border-slate-50">
                        <span className="text-slate-600">Preço de Custo ({( (Number(custo) / pVenda) * 100 ).toFixed(2).replace('.', ',')}%)</span>
                        <span className="font-medium text-slate-900">{formatMoney(Number(custo))}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm py-1 border-b border-slate-50">
                        <span className="text-slate-600">Impostos ({Number(impostosPerc).toFixed(2).replace('.', ',')}%)</span>
                        <span className="font-medium text-red-600">{formatMoney(pVenda * impostos)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm py-1 border-b border-slate-50">
                        <span className="text-slate-600">Custo do Negócio ({Number(custoNegocioPerc).toFixed(2).replace('.', ',')}%)</span>
                        <span className="font-medium text-red-600">{formatMoney(pVenda * custoNegocio)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm py-1 border-b border-slate-50">
                        <span className="text-slate-600">Indicação de Consultor ({Number(indicacaoPerc).toFixed(2).replace('.', ',')}%)</span>
                        <span className="font-medium text-red-600">{formatMoney(pVenda * indicacao)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm py-1 border-b border-slate-50">
                        <span className="text-slate-600">Cashback Cliente ({tier.perc.toFixed(2).replace('.', ',')}%)</span>
                        <span className="font-medium text-red-600">{formatMoney(pVenda * (tier.perc / 100))}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm py-1 pt-2">
                        <span className="font-bold text-brand-dark">Margem de Lucro ({Number(lucroFixoPerc).toFixed(2).replace('.', ',')}%)</span>
                        <span className="font-bold text-green-600">{formatMoney(pVenda * lucroFixo)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
