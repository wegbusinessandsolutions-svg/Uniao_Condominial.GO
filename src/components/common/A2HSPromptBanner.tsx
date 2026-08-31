import React from "react";
import { Download, X, Sparkles, Smartphone, ArrowRight } from "lucide-react";
import { useA2HS } from "../../context/A2HSContext";

export const A2HSPromptBanner: React.FC = () => {
  const {
    isBannerVisible,
    isInstalled,
    dismissBanner,
    openInstallGuide,
    isIOS,
  } = useA2HS();

  if (!isBannerVisible || isInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-40 animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto">
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-white/10 flex items-center justify-between gap-3 sm:gap-4 ring-1 ring-black/5">
        {/* App Icon */}
        <div className="relative shrink-0">
          <div className="w-12 h-12 bg-white rounded-xl p-1.5 shadow-md flex items-center justify-center overflow-hidden">
            <img
              src="/uniao-condominial-logo.png"
              alt="União Condominial Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-blue-500/30 text-blue-300 rounded-md">
              A2HS • App
            </span>
            <span className="text-[11px] text-slate-400 truncate">
              {isIOS ? "Adicionar ao iPhone" : "Instalar Aplicativo"}
            </span>
          </div>
          <h4 className="text-xs sm:text-sm font-semibold text-white truncate mt-0.5">
            União Condominial.GO
          </h4>
          <p className="text-[11px] text-slate-300 truncate">
            Acesse direto da sua tela inicial
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={openInstallGuide}
            className="px-3 py-2 bg-[#0071e3] hover:bg-[#005bb5] active:scale-95 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            {isIOS ? (
              <>
                <Smartphone size={14} />
                <span>Instalar</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>Instalar</span>
              </>
            )}
          </button>

          <button
            onClick={dismissBanner}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            aria-label="Dispensar banner de instalação"
            title="Agora não"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
