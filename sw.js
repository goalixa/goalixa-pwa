// Build: 08d2cca2e9382920dc51b4a5783be0f2206f0a2b (2026-03-12T07:52:52Z)

// Build: ea21fe499e45bae53b0ef2b8be449c18808e5d09 (2026-03-11T20:16:36Z)

// Build: 0346638468bcc856369ecc799bc86998514890fd (2026-03-11T20:09:02Z)

// Build: 804f44a48a0523839e511f60ad870f1a0c75cadb (2026-03-11T19:28:46Z)

// Build: 9815fab093bf58a96c20fd3dabb333c9732d4bb5 (2026-03-11T18:33:51Z)

// Build: 74a9656bf3797c18aec21d066685dd7aa109bbe2 (2026-03-11T12:10:26Z)

// Build: 0a96a739b705d70298b093da084b7084a2579b25 (2026-03-06T18:44:38Z)

// Build: aa22e1a530497d8bb3f44ea87dd205c325118182 (2026-03-06T17:17:02Z)

// Build: e274d7182f2872bf9c386448d183bcccfe4c2393 (2026-03-06T17:04:02Z)

// Build: 9e8da5ca6bab2f539310036970a65dcab4d56a02 (2026-03-06T15:08:26Z)

// Build: 465d46c10ba6b3a1d3df4230f3d4aa7340bc358a (2026-02-27T10:13:57Z)

// Build: 43c16c86d7a82dd83927e7105612acc7eea01f70 (2026-02-27T09:23:00Z)

// Build: __BUILD_HASH__
// Build Time: __BUILD_TIME__

/**
 * Unified PWA Service Worker for Goalixa
 * Handles caching for auth and app views
 * DEVELOPMENT MODE: Network-first for all local files to see changes immediately
 */

const CACHE_VERSION = '__BUILD_HASH__';
const CACHE_PREFIX = 'goalixa-pwa';
const DEV_MODE = true; // Set to false for production

// Cache names for different strategies
const CACHES = {
  CORE: `${CACHE_PREFIX}-core-${CACHE_VERSION}`,
  ASSETS: `${CACHE_PREFIX}-assets-${CACHE_VERSION}`,
  API: `${CACHE_PREFIX}-api-${CACHE_VERSION}`,
  PAGES: `${CACHE_PREFIX}-pages-${CACHE_VERSION}`
};

// Core assets to cache immediately (only cache in production)
const CORE_ASSETS = DEV_MODE ? [] : [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/css/styles.css',
  '/js/router.js',
  '/js/theme.js',
  '/js/api.js',
  '/js/auth.js',
  '/js/utils.js',
  '/js/charts.js',
  '/js/views/auth-view.js',
  '/js/views/app-view.js',
  '/js/views/app/tasks-view.js',
  '/js/components/task-edit-modal.js'
];

// Asset URLs for icons and external resources
const ASSET_URLS = [
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-144.png',
  '/icons/icon-152.png',
  '/icons/icon-192.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/apexcharts@3.45.1/dist/apexcharts.min.js',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Montserrat:wght@800;900&display=swap'
];

// API base URLs - use network first
const API_PATTERNS = [
  /\/bff\//,
  /https:\/\/app\.goalixa\.com\/bff\//
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    Promise.all([
      caches.open(CACHES.CORE).then((cache) => {
        // Add each asset individually, continue on failures
        return Promise.allSettled(
          CORE_ASSETS.map(url =>
            cache.add(url).catch(err => {
              console.warn('[SW] Failed to cache core asset:', url, err);
            })
          )
        );
      }),
      caches.open(CACHES.ASSETS).then((cache) => {
        // Add each asset individually, continue on failures
        return Promise.allSettled(
          ASSET_URLS.map(url =>
            cache.add(url).catch(err => {
              console.warn('[SW] Failed to cache asset:', url, err);
            })
          )
        );
      })
    ])
      .then(() => {
        console.log('[SW] Service worker installed');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Install failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && !key.endsWith(CACHE_VERSION))
            .map((key) => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => {
        console.log('[SW] Old caches cleaned');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle different strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Ignore non-GET requests and different protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // DEVELOPMENT MODE: Always use network-first for local JS/CSS files
  if (DEV_MODE && isLocalDevFile(url)) {
    event.respondWith(networkFirstStrategy(request, CACHES.PAGES));
    return;
  }

  // Handle API requests - network first, fallback to cache
  if (isApiRequest(url)) {
    event.respondWith(networkFirstStrategy(request, CACHES.API));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Handle static assets - cache first, fallback to network
  if (isAssetRequest(url)) {
    event.respondWith(cacheFirstStrategy(request, CACHES.ASSETS));
    return;
  }

  // Default: network first with cache fallback
  event.respondWith(networkFirstStrategy(request, CACHES.PAGES));
});

/**
 * Check if request is for API
 */
function isApiRequest(url) {
  return API_PATTERNS.some(pattern => pattern.test(url.pathname || url.href));
}

/**
 * Check if request is for local development file (JS/CSS)
 * In dev mode, these should always be fetched from network
 */
function isLocalDevFile(url) {
  const pathname = url.pathname || '';
  // Check for local JS and CSS files (not CDN)
  return (pathname.startsWith('/js/') || pathname.startsWith('/css/')) &&
    !pathname.includes('node_modules');
}

/**
 * Check if request is for static asset
 */
function isAssetRequest(url) {
  return /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/.test(url.pathname);
}

/**
 * Handle navigation requests
 */
async function handleNavigation(request) {
  try {
    // Try network first
    const response = await fetch(request);
    if (response && response.status === 200) {
      // Cache successful responses
      const cache = await caches.open(CACHES.PAGES);
      cache.put(request, response.clone());
      return response;
    }
  } catch (error) {
    console.log('[SW] Network failed, trying cache...');
  }

  // Fallback to cache
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  // Final fallback to offline page
  const offlineResponse = await caches.match('/offline.html');
  if (offlineResponse) {
    return offlineResponse;
  }

  // Return a basic offline response
  return new Response(
    '<html><body><h1>Offline</h1><p>You are currently offline. Please check your connection.</p></body></html>',
    { headers: { 'Content-Type': 'text/html' } }
  );
}

/**
 * Network first strategy - for API calls and dynamic content
 */
async function networkFirstStrategy(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache...');
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * Cache first strategy - for static assets
 */
async function cacheFirstStrategy(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Fetch failed:', error);
    throw error;
  }
}

// Message handling for manual cache updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHES.PAGES).then((cache) => cache.addAll(event.data.urls))
    );
  }
});
