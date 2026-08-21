import React from "react";
import CalculadoraPrecosComponent from "../../components/admin/CalculadoraPrecos";

export default function CalculadoraPrecos() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calculadora de Preços</h1>
          <p className="text-sm text-slate-500">Ferramenta de formação de preço de venda e margens.</p>
        </div>
      </div>
      
      <CalculadoraPrecosComponent />
    </div>
  );
}
