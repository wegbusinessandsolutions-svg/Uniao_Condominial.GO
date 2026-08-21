import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Play,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
} from "lucide-react";
import { initFirebase } from "../../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";

export interface TourStep {
  selector: string;
  title: string;
  content: string;
  placement: "bottom" | "top" | "left" | "right";
  badge?: string;
}

const defaultSteps: TourStep[] = [
  {
    selector: ".tour-step-profile",
    title: "Bem-vindo ao União Condominial.GO!",
    content: "Aqui está o seu perfil de usuário. O sistema reconhece o seu cargo e personaliza todas as permissões de acesso automaticamente.",
    placement: "right",
    badge: "Boas-vindas",
  },
  {
    selector: ".tour-step-dashboard",
    title: "Painel de Controle Central",
    content: "Este é o painel de bordo principal. Nele você acompanha o faturamento geral, as taxas de adimplência e o progresso das entregas em tempo real.",
    placement: "right",
    badge: "Visão Geral",
  },
  {
    selector: ".tour-step-payments",
    title: "Configuração de Pagamentos Digitais",
    content: "Configure as chaves Pix, prazos de vencimento dos boletos e credenciais das integradoras parceiras (Mercado Pago, ASAAS, Efí) para as cobranças automáticas.",
    placement: "right",
    badge: "Meios de Pagamento",
  },
  {
    selector: ".tour-step-reports",
    title: "Relatórios e Demonstrativos Gerenciais",
    content: "Acesse relatórios completos de adimplência, fluxo de caixa detalhado e o DRE estruturado para tomada de decisões financeiras precisas.",
    placement: "right",
    badge: "Análises",
  },
  {
    selector: ".tour-step-theme",
    title: "Modo Claro e Modo Escuro",
    content: "Ajuste a iluminação do painel para o seu conforto visual a qualquer hora do dia ou da noite com apenas um clique.",
    placement: "bottom",
    badge: "Conforto Visual",
  },
];

interface GuidedTourProps {
  onTourClose?: () => void;
  forceStart?: boolean;
  key?: any;
}

export default function GuidedTour({ onTourClose, forceStart }: GuidedTourProps) {
  const { user, profile } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  
  // To avoid running when DOM is not fully rendered, check element presence
  const [domReady, setDomReady] = useState(false);

  useEffect(() => {
    // Check if the user has completed the tour already
    const tourCompleted = localStorage.getItem("union_admin_tour_completed");
    
    // Auto-start for new admin users or if explicitly forced
    if (forceStart || !tourCompleted) {
      // Small timeout to let pages render
      const timer = setTimeout(() => {
        setIsActive(true);
        setDomReady(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [forceStart]);

  // Recalculate bounding rect on step change, window resize, or scroll
  useEffect(() => {
    if (!isActive || !domReady) return;

    const updatePosition = () => {
      const step = defaultSteps[currentStep];
      if (!step) return;

      const element = document.querySelector(step.selector);
      if (element) {
        // Scroll element into view if not visible
        element.scrollIntoView({ behavior: "smooth", block: "nearest" });
        setTargetRect(element.getBoundingClientRect());
      } else {
        // If element is not found on current screen, search for standard alternative or skip
        setTargetRect(null);
      }
    };

    updatePosition();

    // Set up listeners for responsiveness
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, { passive: true });
    
    // Periodic check to capture dynamically rendered elements
    const interval = setInterval(updatePosition, 500);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
      clearInterval(interval);
    };
  }, [currentStep, isActive, domReady]);

  const handleNext = () => {
    if (currentStep < defaultSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    setIsActive(false);
    localStorage.setItem("union_admin_tour_completed", "true");

    // Persist to user profile in Firebase Firestore if logged in
    if (user && profile) {
      try {
        const { db } = await initFirebase();
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          tourCompleted: true,
          tourCompletedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn("Could not save tour completed status to Firestore, using local fallback:", err);
      }
    }

    if (onTourClose) {
      onTourClose();
    }
  };

  if (!isActive) return null;

  const currentStepData = defaultSteps[currentStep];
  if (!currentStepData) return null;

  // Calculate coordinates for the floating tooltip card
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      // Fallback: center of screen if target is missing
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 9999,
      };
    }

    const margin = 14;
    const tooltipWidth = 320;
    const tooltipHeight = 220; // estimate
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let top = 0;
    let left = 0;

    switch (currentStepData.placement) {
      case "right":
        left = targetRect.right + margin;
        top = targetRect.top + (targetRect.height / 2) - 100; // middle alignment
        
        // Overflow safety checks
        if (left + tooltipWidth > windowWidth) {
          left = targetRect.left - tooltipWidth - margin;
        }
        break;
      case "bottom":
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        top = targetRect.bottom + margin;
        
        if (top + tooltipHeight > windowHeight) {
          top = targetRect.top - tooltipHeight - margin;
        }
        break;
      case "top":
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        top = targetRect.top - tooltipHeight - margin;
        break;
      case "left":
        left = targetRect.left - tooltipWidth - margin;
        top = targetRect.top + (targetRect.height / 2) - 100;
        break;
    }

    // Secondary bounds protection
    if (left < 10) left = 10;
    if (left + tooltipWidth > windowWidth - 10) left = windowWidth - tooltipWidth - 10;
    if (top < 10) top = 10;
    if (top + tooltipHeight > windowHeight - 10) top = windowHeight - tooltipHeight - 10;

    return {
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
      zIndex: 9999,
    };
  };

  return (
    <div id="guided-tour-overlay" className="fixed inset-0 z-50 pointer-events-none select-none">
      
      {/* SVG Mask for the Spotlight effect */}
      <div className="absolute inset-0 bg-slate-950/70 pointer-events-auto transition-all duration-300">
        {targetRect && (
          <div
            style={{
              position: "fixed",
              top: targetRect.top - 6,
              left: targetRect.left - 6,
              width: targetRect.width + 12,
              height: targetRect.height + 12,
              borderRadius: "12px",
              boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.75)",
              border: "2px solid #0071e3",
              pointerEvents: "none",
              transition: "all 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
            }}
          />
        )}
      </div>

      {/* Floating Tooltip Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.93, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          style={getTooltipStyle()}
          className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl p-5 space-y-4 pointer-events-auto select-text text-slate-900"
        >
          {/* Tooltip Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="p-1 bg-[#0071e3]/10 text-[#0071e3] rounded-lg">
                <Sparkles size={14} className="animate-pulse" />
              </span>
              {currentStepData.badge && (
                <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {currentStepData.badge}
                </span>
              )}
            </div>
            <button
              onClick={handleSkip}
              className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="Pular Tour"
            >
              <X size={15} />
            </button>
          </div>

          {/* Title and Content */}
          <div className="space-y-1.5">
            <h4 className="text-[14px] font-black text-slate-900 tracking-tight leading-snug">
              {currentStepData.title}
            </h4>
            <p className="text-slate-600 text-xs leading-relaxed">
              {currentStepData.content}
            </p>
          </div>

          {/* Progress and controls */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            {/* Steps indicator dot list */}
            <div className="flex items-center gap-1">
              {defaultSteps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStep ? "w-4 bg-[#0071e3]" : "w-1.5 bg-slate-200"
                  }`}
                />
              ))}
              <span className="text-[10px] text-slate-400 font-bold ml-1">
                {currentStep + 1}/{defaultSteps.length}
              </span>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="p-1.5 px-2.5 hover:bg-slate-50 text-slate-600 hover:text-slate-900 font-bold text-[11px] rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft size={12} />
                  Anterior
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="p-1.5 px-3 bg-[#0071e3] hover:bg-[#0071e3]/90 text-white font-bold text-[11px] rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1"
              >
                {currentStep === defaultSteps.length - 1 ? (
                  <>
                    <CheckCircle2 size={12} />
                    Concluir
                  </>
                ) : (
                  <>
                    Próximo
                    <ChevronRight size={12} />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
