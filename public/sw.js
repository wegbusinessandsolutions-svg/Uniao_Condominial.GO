// Service Worker - Estratégia de Cache Persistente para Imagens e Suporte a Notificações Push
const CACHE_NAME = 'uniao-condominial-v3';
const IMAGE_CACHE_NAME = 'uniao-condominial-images-v3';

const PRECACHE_ASSETS = [
  '/',
  '/Cond_vert_Horiz_UC.jpg',
  '/cond_vert_horiz_uc_final.jpg',
  '/images/Cond_vert_Horiz_UC.jpg',
  '/images/cond_vert_horiz_uc_final.jpg',
  '/banner-servicos-condominiais.jpg',
  '/cartao-bg-novo-2.jpg',
  '/cartao-bg-novo.jpg',
  '/cartao-bg.png',
  '/servicos-condominiais-banner.jpg',
  '/servicos-rotineiros-oficial.jpg',
  '/uniao-condominial-logo.png',
  '/img_end_page.png',
  '/images/badge_bronze_1787100127454.jpg',
  '/images/badge_prata_1787100145745.jpg',
  '/images/badge_ouro_1787100156882.jpg',
  '/images/badge_diamante_1787100168869.jpg',
  '/images/servicos_10_banner_1786882130711.jpg',
  '/images/servicos_condominiais_banner_1786880543455.jpg',
  '/images/servicos_uniao_exact_1786882355270.jpg',
  '/images/uniao_condominial_illustrative_1786572811824.jpg'
];

// Instalação do Service Worker e pré-armazenamento em cache das imagens principais
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(IMAGE_CACHE_NAME);
      try {
        await Promise.all(
          PRECACHE_ASSETS.map(async (url) => {
            try {
              const response = await fetch(url, { cache: 'reload' });
              if (response.ok) {
                await cache.put(url, response);
              }
            } catch (err) {
              console.warn('[SW] Não foi possível pré-carregar recurso:', url, err);
            }
          })
        );
      } catch (err) {
        console.warn('[SW] Falha parcial no pré-cache:', err);
      }
      return self.skipWaiting();
    })()
  );
});

// Ativação e limpeza de versões antigas de cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys.map((key) => {
          if (key !== CACHE_NAME && key !== IMAGE_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
      return self.clients.claim();
    })()
  );
});

// Interceptação de requisições: Estratégia Cache-First com atualização em background para imagens
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Apenas métodos GET são passíveis de cache
  if (request.method !== 'GET') return;

  // Não intercepta chamadas de API, Firebase ou autenticação
  if (
    url.pathname.startsWith('/api') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('firebase')
  ) {
    return;
  }

  // Verifica se é uma requisição de imagem ou arquivo estático de imagem
  const isImage =
    request.destination === 'image' ||
    /\.(jpg|jpeg|png|webp|svg|gif|ico|bmp)(\?.*)?$/i.test(url.pathname) ||
    url.pathname.includes('/assets/') ||
    url.pathname.includes('/images/');

  if (isImage) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMAGE_CACHE_NAME);
        
        // 1. Tenta buscar no cache imediatamente
        const cachedResponse = await cache.match(request);
        
        // Se houver no cache, retorna imediatamente e atualiza em segundo plano (Stale-While-Revalidate)
        if (cachedResponse) {
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
            })
            .catch(() => {
              // Silencioso se estiver offline ou em restart
            });
          return cachedResponse;
        }

        // 2. Se não estiver no cache, busca na rede
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          const fallback = await cache.match('/Cond_vert_Horiz_UC.jpg');
          if (fallback) return fallback;
          throw error;
        }
      })()
    );
  }
});

// ==========================================
// SUPORTE A NOTIFICAÇÕES PUSH & TEMPO REAL
// ==========================================

// Evento Push padrão (Web Push API)
self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'União Condominial.GO',
    body: 'Você tem uma nova atualização no seu condomínio.',
    icon: '/uniao-condominial-logo.png',
    badge: '/uniao-condominial-logo.png',
    data: { url: '/cliente' },
    tag: 'uniao-notificacao-' + Date.now(),
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Ver Agora' },
      { action: 'close', title: 'Fechar' }
    ]
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = { ...notificationData, ...payload };
    } catch (e) {
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon || '/uniao-condominial-logo.png',
    badge: notificationData.badge || '/uniao-condominial-logo.png',
    image: notificationData.image,
    data: notificationData.data || { url: '/cliente' },
    tag: notificationData.tag || 'uc-notification',
    renotify: true,
    requireInteraction: notificationData.requireInteraction || false,
    vibrate: notificationData.vibrate || [200, 100, 200],
    actions: notificationData.actions || [
      { action: 'open', title: 'Ver Agora' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Evento de clique na notificação (redireciona para o status do pedido, clube ou página correta)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/cliente';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se já houver uma aba aberta com a mesma origem, navega nela e a foca
      for (const client of clientList) {
        if ('focus' in client && client.url.includes(self.location.origin)) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Caso contrário, abre uma nova janela
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Evento Message para mensagens disparadas em tempo real pela aplicação (Firestore listeners)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const payload = event.data.payload || {};
    const title = payload.title || 'União Condominial.GO';
    const options = {
      body: payload.body || '',
      icon: payload.icon || '/uniao-condominial-logo.png',
      badge: payload.badge || '/uniao-condominial-logo.png',
      image: payload.image,
      data: payload.data || { url: '/cliente' },
      tag: payload.tag || ('uc-' + Date.now()),
      renotify: true,
      vibrate: payload.vibrate || [200, 100, 200],
      actions: payload.actions || [
        { action: 'open', title: 'Ver Agora' }
      ]
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});
