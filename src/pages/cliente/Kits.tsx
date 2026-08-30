import React from "react";
import { Package } from "lucide-react";

export default function Kits() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-3xl shadow-md overflow-hidden">
        <div className="p-6 md:p-8 flex items-center gap-4 bg-gradient-to-r from-slate-50 to-white">
          <div className="w-12 h-12 rounded-2xl bg-[#0071e3] text-white flex items-center justify-center shadow-md">
             <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-normal text-slate-900 tracking-tight">Kits Essenciais Condominiais</h1>
            <p className="text-sm text-slate-500 font-normal">Kits prontos para a rotina do seu condomínio, com tudo o que você precisa em um só lugar.</p>
          </div>
        </div>

        <div className="p-8 text-center text-slate-500 text-sm font-normal">
           Carregando kits...
        </div>
      </div>
    </div>
  );
}
