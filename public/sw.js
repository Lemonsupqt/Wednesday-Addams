// Nevermore Games Service Worker v2.2.0
// PWA support with deep linking for room share links

const CACHE_NAME = 'nevermore-v2.2.0';
const STATIC_CACHE = 'nevermore-static-v2.2.0';

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
  '/css/ultra-mobile.css',
  '/js/app.js',
  '/js/performance-enhancements.js',
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
  
  // Handle deep links - room URLs should open in app
  if (url.searchParams.has('room') || url.searchParams.has('join')) {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/'))
    );
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

// Handle notification clicks - open app to specific room if provided
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            // Navigate existing window to the URL
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Open new window if app not open
        return clients.openWindow(urlToOpen);
      })
  );
});

// Handle share target - when users share room links to the app
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Handle share target
  if (url.pathname === '/' && url.searchParams.has('share-target')) {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData();
        const sharedUrl = formData.get('url') || formData.get('text') || '';
        
        // Extract room code from shared URL
        const roomMatch = sharedUrl.match(/[?&]room=([^&]+)/);
        const roomCode = roomMatch ? roomMatch[1] : '';
        
        // Redirect to app with room code
        const redirectUrl = roomCode ? `/?room=${roomCode}` : '/';
        return Response.redirect(redirectUrl, 303);
      })()
    );
  }
});

// Handle launch queue for PWA launch handling
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'LAUNCH_URL') {
    const launchUrl = event.data.url;
    
    // Notify all clients about the launch URL
    clients.matchAll({ type: 'window' }).then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({
          type: 'NAVIGATE_TO',
          url: launchUrl
        });
      });
    });
  }
});
