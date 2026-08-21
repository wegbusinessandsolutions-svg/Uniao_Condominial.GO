import React from "react";
import { Package } from "lucide-react";

export default function Kits() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#0071e3] text-white flex items-center justify-center">
             <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Kits Essenciais Condominiais</h1>
            <p className="text-sm text-slate-500">Kits prontos para a rotina do seu condomínio, com tudo o que você precisa em um só lugar.</p>
          </div>
        </div>

        <div className="p-8 text-center text-slate-500 text-sm">
           Carregando kits...
        </div>
      </div>
    </div>
  );
}
