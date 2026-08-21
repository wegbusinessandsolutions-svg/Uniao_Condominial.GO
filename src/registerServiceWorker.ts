// Registro seguro do Service Worker para cache persistente de imagens e ativos estáticos
export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[ServiceWorker] Registrado com sucesso no escopo:', registration.scope);

          // Trata atualizações automáticas
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('[ServiceWorker] Novo conteúdo em cache disponível.');
                  } else {
                    console.log('[ServiceWorker] Conteúdo armazenado em cache para uso persistente.');
                  }
                }
              };
            }
          };
        })
        .catch((error) => {
          console.warn('[ServiceWorker] Falha ao registrar Service Worker:', error);
        });
    });
  }
}
