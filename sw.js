const CACHE_NAME = 'prisma-flow-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png'
];

// Instalação - Pré-cache dos assets essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cache aberto, adicionando assets estáticos');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((err) => {
        console.error('[SW] Erro ao pré-cachar:', err);
      })
  );
  // Ativa imediatamente
  self.skipWaiting();
});

// Ativação - Limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deletando cache antigo:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Toma controle das páginas imediatamente
  self.clients.claim();
});

// Interceptação de requisições - Estratégia Cache-First para assets estáticos
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requisições não-GET
  if (request.method !== 'GET') return;

  // Ignora requisições de extensões do Chrome e analytics
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Estratégia Cache-First para recursos estáticos (CSS, JS, imagens, fontes)
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.includes('.css') ||
    url.pathname.includes('.js') ||
    url.pathname.includes('.png') ||
    url.pathname.includes('.jpg') ||
    url.pathname.includes('.svg') ||
    url.pathname.includes('.woff') ||
    url.pathname.includes('.woff2')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        // Retorna do cache se encontrado
        if (cachedResponse) {
          return cachedResponse;
        }

        // Senão, busca na rede e cacheia
        return fetch(request)
          .then((networkResponse) => {
            if (!networkResponse || !networkResponse.ok) {
              return networkResponse;
            }

            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });

            return networkResponse;
          })
          .catch(() => {
            // Fallback silencioso para offline
            console.log('[SW] Recurso não disponível offline:', url.pathname);
          });
      })
    );
    return;
  }

  // Para navegação (HTML), usa Network-First com fallback para cache
  if (request.destination === 'document' || request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Atualiza o cache com a versão mais recente
          if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback para cache quando offline
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Se não tem no cache, retorna a página inicial como último recurso
            return caches.match('/index.html');
          });
        })
    );
    return;
  }

  // Para outras requisições, tenta cache primeiro
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      return cachedResponse || fetch(request);
    })
  );
});

// Mensagens do cliente (para atualização manual)
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
