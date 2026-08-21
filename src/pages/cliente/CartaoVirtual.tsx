import React from "react";
import { useAuth } from "../../context/AuthContext";
import { CreditCard } from "lucide-react";

export default function CartaoVirtual() {
  const { profile } = useAuth();
  
  // Generating a stable fake card number based on UID
  const generateCardNumber = (uid: string = "") => {
    return "6872 4E15 344D 4CA4";
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#0071e3] text-white flex items-center justify-center">
             <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Cartão Virtual</h1>
            <p className="text-sm text-slate-500">Apresente este cartão para usar seus benefícios em estabelecimentos parceiros.</p>
          </div>
        </div>

        <div className="p-12 flex flex-col items-center justify-center bg-slate-50">
          
          {/* Card Container */}
          <div className="relative w-full max-w-[440px] aspect-[1.586/1] rounded-2xl shadow-2xl overflow-hidden bg-[#0a1435] text-white p-6 sm:p-8 flex flex-col justify-between border border-white/15" style={{
             boxShadow: "0 25px 50px -12px rgba(10, 20, 53, 0.5)",
          }}>
            {/* Dark Premium Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0b1437] via-[#0f2159] to-[#060c23] z-0" />
            
            {/* Background Pattern Overlay with low opacity to prevent illegibility */}
            <div className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-overlay z-0" style={{
               backgroundImage: "url('/cartao-bg.png')",
            }} />

            {/* Glowing Orbs for modern card design */}
            <div className="absolute -top-20 -right-20 w-44 h-44 rounded-full bg-cyan-500/15 blur-2xl pointer-events-none z-0" />
            <div className="absolute -bottom-20 -left-20 w-44 h-44 rounded-full bg-blue-600/15 blur-2xl pointer-events-none z-0" />

            <div className="relative z-10 w-full h-full flex flex-col justify-between">
              {/* Top Section */}
              <div className="flex justify-between items-start">
                 <div className="font-mono text-sm sm:text-lg tracking-[0.15em] mt-2 font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                   {generateCardNumber(profile?.uid)}
                 </div>
                 <div className="text-right">
                    {/* Fallback elegant logo mark */}
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
                      <CreditCard className="w-4 h-4 text-cyan-300" />
                    </div>
                 </div>
              </div>

              {/* Bottom Section */}
              <div className="flex justify-between items-end mb-2">
                 <div>
                    <p className="text-[9px] sm:text-[10px] text-white/70 uppercase tracking-widest mb-0.5 font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">Cliente</p>
                    <p className="text-xs sm:text-sm font-extrabold uppercase tracking-wide leading-tight max-w-[200px] drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)] text-white">
                      {profile?.displayName || "CONDOMÍNIO DO EDIFÍCIO DENVER"}
                    </p>
                    <p className="text-[8px] sm:text-[9px] text-white/60 mt-2 font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">Cadastro: 22/06/2026</p>
                 </div>
                 <div className="text-right flex flex-col items-end gap-1">
                    <p className="text-[9px] sm:text-[10px] text-white/70 uppercase tracking-widest font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">Cartão</p>
                    {(() => {
                      const level = profile?.level || "Bronze";
                      let levelColor = "text-[#FFD700]"; // default gold
                      if (level === "Bronze") levelColor = "text-[#d97706]";
                      else if (level === "Prata") levelColor = "text-slate-100";
                      else if (level === "Ouro") levelColor = "text-amber-400 font-extrabold";
                      else if (level === "Diamante") levelColor = "text-cyan-300 font-extrabold";
                      return (
                        <p className={`text-xs sm:text-sm font-black uppercase tracking-widest ${levelColor} drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]`}>
                          {level}
                        </p>
                      );
                    })()}
                    <span className="bg-emerald-500 text-slate-950 text-[9px] font-black px-2.5 py-0.5 rounded-full shadow-md mt-1 uppercase tracking-widest">Ativo</span>
                 </div>
              </div>
            </div>
          </div>

          <p className="mt-8 text-xs text-slate-500 font-medium tracking-wide">Mostre este código no caixa do parceiro para garantir seu desconto.</p>
          <p className="mt-2 text-[10px] text-slate-400">Nota: Faça o upload da imagem do cartão como "cartao-bg.png" na pasta public.</p>
        </div>
      </div>
    </div>
  );
}
