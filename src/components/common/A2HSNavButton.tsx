import React from "react";
import { Download, Smartphone, CheckCircle2 } from "lucide-react";
import { useA2HS } from "../../context/A2HSContext";

interface A2HSNavButtonProps {
  variant?: "sidebar" | "header" | "compact" | "pill" | "banner";
  className?: string;
  label?: string;
}

export const A2HSNavButton: React.FC<A2HSNavButtonProps> = ({
  variant = "sidebar",
  className = "",
  label,
}) => {
  const { isInstalled, isIOS, openInstallGuide } = useA2HS();

  // Se o aplicativo já estiver instalado e rodando em modo standalone
  if (isInstalled) {
    if (variant === "compact") {
      return (
        <span
          className={`inline-flex items-center gap-1 text-xs text-emerald-600 font-medium ${className}`}
          title="Aplicativo instalado na tela inicial"
        >
          <CheckCircle2 size={14} />
          <span>App Instalado</span>
        </span>
      );
    }

    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 text-xs text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200/60 ${className}`}
      >
        <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
        <span className="truncate font-medium">App Oficial Instalado</span>
      </div>
    );
  }

  const defaultLabel = label || (isIOS ? "Instalar App (A2HS)" : "Instalar App (A2HS)");

  if (variant === "header") {
    return (
      <button
        type="button"
        onClick={openInstallGuide}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0071e3] hover:text-white bg-blue-50 hover:bg-[#0071e3] border border-blue-200/80 hover:border-transparent rounded-full shadow-2xs transition-all duration-200 cursor-pointer ${className}`}
        title="Adicionar à Tela de Início (A2HS)"
      >
        <Download size={14} />
        <span className="hidden sm:inline">{defaultLabel}</span>
        <span className="sm:hidden">App</span>
      </button>
    );
  }

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={openInstallGuide}
        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-linear-to-r from-[#0071e3] to-[#0094ff] hover:from-[#005bb5] hover:to-[#0071e3] text-white rounded-full text-xs font-semibold shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer ${className}`}
        title="Adicionar o aplicativo à sua tela inicial"
      >
        <Smartphone size={14} />
        <span>{defaultLabel}</span>
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={openInstallGuide}
        className={`flex items-center gap-1.5 text-xs text-[#0071e3] hover:text-[#005bb5] font-semibold py-1 px-2 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer ${className}`}
        title="Adicionar o aplicativo à tela inicial"
      >
        <Download size={14} />
        <span>{defaultLabel}</span>
      </button>
    );
  }

  // Sidebar variant (default)
  return (
    <button
      type="button"
      onClick={openInstallGuide}
      className={`flex items-center space-x-3 px-3 py-2 w-full text-slate-700 hover:bg-blue-50 hover:text-[#0071e3] rounded-xl transition-all duration-150 text-base font-normal group text-left cursor-pointer ${className}`}
      title="Instalar aplicativo na tela inicial do seu celular ou computador"
    >
      <div className="w-5 h-5 rounded-lg bg-blue-100/70 text-[#0071e3] flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
        <Download className="w-3.5 h-3.5" />
      </div>
      <span className="whitespace-nowrap font-medium text-sm sm:text-base text-slate-800 group-hover:text-[#0071e3]">
        {defaultLabel}
      </span>
    </button>
  );
};
