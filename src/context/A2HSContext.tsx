import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface A2HSContextType {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isDesktop: boolean;
  isBannerVisible: boolean;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  promptToInstall: () => Promise<boolean>;
  dismissBanner: () => void;
  openInstallGuide: () => void;
}

const A2HSContext = createContext<A2HSContextType | undefined>(undefined);

const A2HS_DISMISS_KEY = "uc_a2hs_dismissed_until";

export const A2HSProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isBannerVisible, setIsBannerVisible] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(false);

  useEffect(() => {
    // 1. Identificar plataforma / SO
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (window.navigator.platform === "MacIntel" && (window.navigator as any).maxTouchPoints > 1);
    const isAndroidDevice = /android/.test(userAgent);
    const isDesktopDevice = !isIOSDevice && !isAndroidDevice;

    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);
    setIsDesktop(isDesktopDevice);

    // 2. Verificar se já está rodando em modo standalone (já instalado)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes("android-app://");
      return isStandaloneMode;
    };

    const standalone = checkStandalone();
    setIsInstalled(standalone);

    // Monitorar mudanças no display-mode
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches);
      if (e.matches) {
        setIsBannerVisible(false);
        setDeferredPrompt(null);
      }
    };
    try {
      mediaQuery.addEventListener("change", handleDisplayModeChange);
    } catch {
      // Fallback para navegadores antigos
      mediaQuery.addListener(handleDisplayModeChange);
    }

    // 3. Capturar evento nativo `beforeinstallprompt` (Chromium / Android / Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);

      // Verificar se o usuário dispensou recentemente o banner (ex: nos últimos 3 dias)
      const dismissedUntil = localStorage.getItem(A2HS_DISMISS_KEY);
      const isDismissed = dismissedUntil && Number(dismissedUntil) > Date.now();

      if (!standalone && !isDismissed) {
        // Pequeno delay suave para não interromper o carregamento imediato
        setTimeout(() => {
          setIsBannerVisible(true);
        }, 2000);
      }
    };

    // 4. Capturar evento nativo `appinstalled`
    const handleAppInstalled = () => {
      console.log("[A2HS] Aplicativo instalado com sucesso!");
      setIsInstalled(true);
      setIsBannerVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // 5. Para dispositivos iOS (que não disparam `beforeinstallprompt`), exibir banner se não instalado e não dispensado
    if (isIOSDevice && !standalone) {
      const dismissedUntil = localStorage.getItem(A2HS_DISMISS_KEY);
      const isDismissed = dismissedUntil && Number(dismissedUntil) > Date.now();
      if (!isDismissed) {
        setTimeout(() => {
          setIsBannerVisible(true);
        }, 3000);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      try {
        mediaQuery.removeEventListener("change", handleDisplayModeChange);
      } catch {
        mediaQuery.removeListener(handleDisplayModeChange);
      }
    };
  }, []);

  const promptToInstall = async (): Promise<boolean> => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === "accepted") {
          console.log("[A2HS] Usuário aceitou a instalação do aplicativo!");
          setDeferredPrompt(null);
          setIsBannerVisible(false);
          setIsInstalled(true);
          return true;
        } else {
          console.log("[A2HS] Usuário recusou a instalação.");
          return false;
        }
      } catch (err) {
        console.warn("[A2HS] Erro ao disparar prompt de instalação:", err);
        setIsModalOpen(true);
        return false;
      }
    } else {
      // Se não há prompt nativo disponível (ex: iOS Safari ou navegador sem suporte direto), abre o guia ilustrado
      setIsModalOpen(true);
      return false;
    }
  };

  const dismissBanner = () => {
    setIsBannerVisible(false);
    // Não exibir o banner flutuante novamente pelos próximos 4 dias
    const fourDaysInMs = 4 * 24 * 60 * 60 * 1000;
    localStorage.setItem(A2HS_DISMISS_KEY, String(Date.now() + fourDaysInMs));
  };

  const openInstallGuide = () => {
    if (deferredPrompt) {
      promptToInstall();
    } else {
      setIsModalOpen(true);
    }
  };

  const isInstallable = !isInstalled && (deferredPrompt !== null || isIOS || isAndroid || isDesktop);

  return (
    <A2HSContext.Provider
      value={{
        deferredPrompt,
        isInstallable,
        isInstalled,
        isIOS,
        isAndroid,
        isDesktop,
        isBannerVisible,
        isModalOpen,
        setIsModalOpen,
        promptToInstall,
        dismissBanner,
        openInstallGuide,
      }}
    >
      {children}
    </A2HSContext.Provider>
  );
};

export const useA2HS = () => {
  const context = useContext(A2HSContext);
  if (!context) {
    throw new Error("useA2HS deve ser utilizado dentro de um A2HSProvider");
  }
  return context;
};
