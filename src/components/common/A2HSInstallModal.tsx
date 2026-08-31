import React, { useState } from "react";
import {
  X,
  Smartphone,
  Download,
  Share2,
  PlusSquare,
  MoreVertical,
  Laptop,
  CheckCircle2,
  Zap,
  Bell,
  ShieldCheck,
  HardDriveDownload,
  Sparkles,
} from "lucide-react";
import { useA2HS } from "../../context/A2HSContext";

export const A2HSInstallModal: React.FC = () => {
  const {
    isModalOpen,
    setIsModalOpen,
    isIOS,
    isAndroid,
    isDesktop,
    deferredPrompt,
    promptToInstall,
  } = useA2HS();

  // Tab inicial baseado na detecção automática do dispositivo
  const defaultTab = isIOS ? "ios" : isAndroid ? "android" : "desktop";
  const [activeTab, setActiveTab] = useState<"android" | "ios" | "desktop">(defaultTab);
  const [isInstalling, setIsInstalling] = useState(false);

  if (!isModalOpen) return null;

  const handleNativeInstall = async () => {
    setIsInstalling(true);
    try {
      await promptToInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh] border border-slate-100 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="relative bg-linear-to-br from-[#12235a] via-[#0071e3] to-[#0094ff] p-6 text-white text-center shrink-0">
          <button
            onClick={() => setIsModalOpen(false)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>

          {/* Logo / App Icon */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl p-2 mx-auto shadow-xl flex items-center justify-center mb-3">
            <img
              src="/uniao-condominial-logo.png"
              alt="União Condominial"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles size={13} className="text-amber-300" />
            <span>A2HS • Add to Home Screen</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Instalar Aplicativo Oficial
          </h2>
          <p className="text-blue-100 text-xs sm:text-sm mt-1 max-w-xs mx-auto">
            Adicione a União Condominial à tela inicial do seu celular ou computador para acesso instantâneo.
          </p>
        </div>

        {/* Tabs de Seleção de Dispositivo */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-center gap-2">
          <button
            onClick={() => setActiveTab("android")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "android"
                ? "bg-[#0071e3] text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Smartphone size={15} />
            <span>Android</span>
          </button>

          <button
            onClick={() => setActiveTab("ios")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "ios"
                ? "bg-[#0071e3] text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Share2 size={15} />
            <span>iPhone / iPad</span>
          </button>

          <button
            onClick={() => setActiveTab("desktop")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "desktop"
                ? "bg-[#0071e3] text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Laptop size={15} />
            <span>Computador</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-700 text-sm">
          {/* Botão de instalação com 1 clique (se o navegador suportar o evento nativo) */}
          {deferredPrompt && activeTab === (isAndroid ? "android" : "desktop") && (
            <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-[#0071e3] font-semibold text-sm">
                <HardDriveDownload size={18} />
                <span>Instalação rápida disponível no seu navegador</span>
              </div>
              <button
                onClick={handleNativeInstall}
                disabled={isInstalling}
                className="w-full py-3 px-4 bg-[#0071e3] hover:bg-[#005bb5] active:scale-98 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm sm:text-base"
              >
                <Download size={18} />
                {isInstalling ? "Instalando..." : "Instalar Agora na Tela Inicial"}
              </button>
            </div>
          )}

          {/* Guia Passo a Passo: iOS (iPhone / iPad) */}
          {activeTab === "ios" && (
            <div className="space-y-3.5">
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                No Safari do iOS, siga os passos abaixo para adicionar o ícone à sua tela de início:
              </p>

              <div className="flex items-start gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#0071e3] flex items-center justify-center font-bold text-sm shrink-0">
                  1
                </div>
                <div className="leading-snug">
                  <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                    Toque no botão Compartilhar <Share2 size={16} className="text-[#0071e3] inline" />
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Localizado na barra de ferramentas inferior do Safari (ou topo no iPad).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#0071e3] flex items-center justify-center font-bold text-sm shrink-0">
                  2
                </div>
                <div className="leading-snug">
                  <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                    Selecione &quot;Adicionar à Tela de Início&quot; <PlusSquare size={16} className="text-[#0071e3] inline" />
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Role o menu de opções para baixo até encontrar o ícone com sinal de mais (+).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#0071e3] flex items-center justify-center font-bold text-sm shrink-0">
                  3
                </div>
                <div className="leading-snug">
                  <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                    Confirme tocando em &quot;Adicionar&quot;
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    No canto superior direito da janela. O ícone da União Condominial aparecerá na tela do seu iPhone!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Guia Passo a Passo: Android */}
          {activeTab === "android" && !deferredPrompt && (
            <div className="space-y-3.5">
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                No Google Chrome ou navegador do Android:
              </p>

              <div className="flex items-start gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#0071e3] flex items-center justify-center font-bold text-sm shrink-0">
                  1
                </div>
                <div className="leading-snug">
                  <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                    Toque nos três pontos do menu <MoreVertical size={16} className="text-[#0071e3] inline" />
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    No canto superior direito do seu navegador Chrome.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#0071e3] flex items-center justify-center font-bold text-sm shrink-0">
                  2
                </div>
                <div className="leading-snug">
                  <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                    Toque em &quot;Instalar aplicativo&quot; ou &quot;Adicionar à tela inicial&quot;
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Procure a opção de instalação no menu suspenso.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#0071e3] flex items-center justify-center font-bold text-sm shrink-0">
                  3
                </div>
                <div className="leading-snug">
                  <p className="font-semibold text-slate-900">
                    Confirme em &quot;Instalar&quot;
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pronto! O aplicativo abrirá em tela cheia como um app nativo.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Guia Passo a Passo: Desktop / Computador */}
          {activeTab === "desktop" && !deferredPrompt && (
            <div className="space-y-3.5">
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                No Google Chrome, Microsoft Edge ou Brave no Computador:
              </p>

              <div className="flex items-start gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#0071e3] flex items-center justify-center font-bold text-sm shrink-0">
                  1
                </div>
                <div className="leading-snug">
                  <p className="font-semibold text-slate-900">
                    Observe a barra de endereços (URL)
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Clique no ícone de instalação (➕ ou 🖥️) localizado no lado direito da barra onde você digita o endereço do site.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#0071e3] flex items-center justify-center font-bold text-sm shrink-0">
                  2
                </div>
                <div className="leading-snug">
                  <p className="font-semibold text-slate-900">
                    Clique em &quot;Instalar&quot;
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    O sistema criará um atalho dedicado na sua Área de Trabalho e barra de tarefas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Vantagens do App */}
          <div className="pt-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Vantagens do Aplicativo
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                <Zap size={14} className="text-amber-500 shrink-0" />
                <span className="font-medium text-slate-700">Acesso em 1 toque</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                <HardDriveDownload size={14} className="text-emerald-500 shrink-0" />
                <span className="font-medium text-slate-700">Ocupa menos de 3MB</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                <Bell size={14} className="text-[#0071e3] shrink-0" />
                <span className="font-medium text-slate-700">Notificações e pedidos</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                <ShieldCheck size={14} className="text-indigo-500 shrink-0" />
                <span className="font-medium text-slate-700">100% Seguro & Leve</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span>Progressive Web App (PWA)</span>
          </div>

          <button
            onClick={() => setIsModalOpen(false)}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
