import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { MapPin, Navigation, ShieldCheck, Truck, Wrench, X, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useLocation } from "react-router-dom";

export const GeolocationLoginPrompt: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { addToast } = useToast();
  const location = useLocation();
  
  const [isOpen, setIsOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    // Only prompt when user is authenticated, validated and profile is loaded
    if (!user || !profile) {
      setIsOpen(false);
      return;
    }

    // Apenas solicitar se o usuário acabou de realizar o login
    const askNow = sessionStorage.getItem('ask_geolocation_now') === 'true';
    if (!askNow) {
      setIsOpen(false);
      return;
    }

    // Apenas solicita para Clientes
    if (profile.role !== "Cliente" && profile.role !== "cliente") {
      sessionStorage.removeItem('ask_geolocation_now');
      setIsOpen(false);
      return;
    }

    // If location is already active, don't prompt
    if (profile.geolocalizacaoAtiva) {
      sessionStorage.removeItem('ask_geolocation_now');
      setIsOpen(false);
      return;
    }

    // Trigger after a brief natural delay
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [user?.uid, profile?.uid, profile?.geolocalizacaoAtiva, profile?.role]);

  // We can also expose a global event listener to allow triggering it manually from buttons
  useEffect(() => {
    const handleRequireLocation = () => {
      if (!profile?.geolocalizacaoAtiva) {
        setIsOpen(true);
      }
    };
    window.addEventListener("requireGeolocation", handleRequireLocation);
    return () => window.removeEventListener("requireGeolocation", handleRequireLocation);
  }, [profile?.geolocalizacaoAtiva]);

  const handleActivateLocation = () => {
    if (!navigator.geolocation) {
      addToast("Geolocalização não é suportada por este dispositivo ou navegador.", "error");
      closePrompt("unsupported");
      return;
    }

    setRequesting(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          if (user?.uid) {
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
              latitude: lat,
              longitude: lng,
              geolocalizacaoAtiva: true,
              geolocalizacaoAtualizadaEm: serverTimestamp()
            });
            await refreshProfile();
          }

          addToast("📍 Localização em tempo real ativada com sucesso! Coordenadas registradas para seu condomínio.", "success");
          closePrompt("allowed");
        } catch (error) {
          console.error("Erro ao salvar geolocalização no perfil:", error);
          addToast("Localização obtida com sucesso no navegador.", "success");
          closePrompt("allowed");
        } finally {
          setRequesting(false);
        }
      },
      (error) => {
        console.warn("Permissão de geolocalização recusada ou indisponível:", error);
        if (error.code === error.PERMISSION_DENIED) {
          addToast("Permissão de localização não concedida. Você precisa ativá-la nas configurações do navegador para prosseguir ou voltar ao início.", "error");
        } else {
          addToast("Não foi possível capturar a localização atual. Tente novamente mais tarde.", "warning");
        }
        setRequesting(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  };

  const closePrompt = (reason: string) => {
    if (user?.uid) {
      sessionStorage.setItem(`geo_prompt_resolved_${user.uid}`, reason);
    }
    sessionStorage.removeItem('ask_geolocation_now');
    setIsOpen(false);
  };

  if (!isOpen || !user || !profile) {
    return null;
  }

  const userName = profile.displayName || profile.nomeCompleto || "Afiliado";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="geo-prompt-title"
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 flex flex-col transform transition-all duration-300"
      >
        {/* Top visual banner */}
        <div className="relative bg-gradient-to-br from-[#0B1A3A] via-[#0E2554] to-[#0071e3] p-6 sm:p-7 text-white text-center overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-[#0071e3]/30 rounded-full blur-xl pointer-events-none"></div>

          {/* Close button */}
          <button
            onClick={() => closePrompt('dismissed')}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            aria-label="Fechar"
            title="Fechar"
          >
            <X size={18} />
          </button>

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-[11px] font-semibold text-white/95 border border-white/20 mb-3.5 shadow-2xs">
            <ShieldCheck size={13} className="text-emerald-300" />
            <span>Validação de Acesso Concluída</span>
          </div>

          {/* Pulsing Icon Halo */}
          <div className="relative mx-auto w-16 h-16 mb-3 flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-white/20 animate-ping opacity-40"></div>
            <div className="relative w-14 h-14 rounded-2xl bg-white text-[#0B1A3A] flex items-center justify-center shadow-lg transform rotate-3">
              <Navigation size={28} className="text-[#0071e3] transform -rotate-12" />
            </div>
          </div>

          <h2 id="geo-prompt-title" className="text-xl sm:text-2xl font-bold tracking-tight text-yellow-100">
            Ativação de Localização em Tempo Real
          </h2>
          <p className="text-xs sm:text-sm text-slate-200 mt-1.5 font-normal max-w-sm mx-auto leading-relaxed">
            Olá, <strong className="font-semibold text-white">{userName}</strong>! Para otimizar os serviços do seu condomínio, ative a sua localização.
          </p>
        </div>

        {/* Benefits & Details */}
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                <Truck size={17} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Precisão na Entrega de Produtos</h4>
                <p className="text-[11px] text-slate-600 leading-normal mt-0.5">
                  Facilita o deslocamento e localização exata da portaria/doca do seu condomínio pelos entregadores.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 border-t border-slate-200/60 pt-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <Wrench size={17} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Ordens de Serviço e Manutenções</h4>
                <p className="text-[11px] text-slate-600 leading-normal mt-0.5">
                  Roteirização inteligente para atendimento ágil de técnicos e prestadores parceiros da sua região.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 border-t border-slate-200/60 pt-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin size={17} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Privacidade & Controle Total</h4>
                <p className="text-[11px] text-slate-600 leading-normal mt-0.5">
                  Seus dados de localização são utilizados estritamente para fins operacionais e logísticos da plataforma.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2.5">
            <button
              onClick={handleActivateLocation}
              disabled={requesting}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-[#0071e3] to-brand-dark hover:opacity-95 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 disabled:opacity-60 cursor-pointer"
            >
              {requesting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Obtendo coordenadas do navegador...</span>
                </>
              ) : (
                <>
                  <Navigation size={18} />
                  <span>Ativar Localização em Tempo Real</span>
                </>
              )}
            </button>

            <button
              onClick={() => closePrompt('dismissed')}
              disabled={requesting}
              className="w-full py-2.5 px-4 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
