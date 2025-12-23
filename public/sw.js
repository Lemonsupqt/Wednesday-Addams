// Nevermore Games Service Worker v2.1.0
// Lightweight caching for PWA support without causing lag

const CACHE_NAME = 'nevermore-v2.1.0';
const STATIC_CACHE = 'nevermore-static-v2.1.0';

// Only cache essential static assets
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/css/themes.css',
  '/css/premium-animations.css',
  '/css/mobile-responsive.css',
  '/css/profile-stats.css',
  '/css/new-games-styles.css',
  '/css/sudoku-enhanced.css',
  '/js/app.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        // Cache assets one by one to prevent failures
        return Promise.allSettled(
          STATIC_ASSETS.map(url => 
            cache.add(url).catch(err => console.log('Cache skip:', url))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network first, cache fallback (for real-time game data)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and socket connections
  if (request.method !== 'GET' || url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }
  
  // Skip API calls - always go to network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    return;
  }
  
  // For static assets, try cache first
  if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith(asset.split('/').pop()))) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Return cache but also update in background
            fetch(request)
              .then((response) => {
                if (response.ok) {
                  caches.open(STATIC_CACHE)
                    .then((cache) => cache.put(request, response));
                }
              })
              .catch(() => {});
            return cachedResponse;
          }
          return fetch(request);
        })
    );
    return;
  }
  
  // For everything else, network first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Don't cache non-successful responses
        if (!response.ok) {
          return response;
        }
        
        // Clone and cache
        const responseClone = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => cache.put(request, responseClone))
          .catch(() => {});
        
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return offline page for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/');
            }
            return new Response('Offline', { status: 503 });
          });
      })
  );
});

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'New game notification!',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      vibrate: [100, 50, 100],
      data: data.data || {},
      actions: data.actions || []
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'Nevermore Games', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return clients.openWindow('/');
      })
  );
});
