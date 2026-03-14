// Build: ac17f7d18c78a39e1dd43e63ebe70819536e6283
// Build Time: 2026-03-14T12:13:42Z

// Build: __BUILD_HASH__
// Build Time: __BUILD_TIME__

/**
 * Production PWA Service Worker for Goalixa
 * Handles intelligent caching with automatic invalidation on deployments
 *
 * Cache Strategy:
 * - Core assets (HTML, CSS, JS): Cache-first for instant loading
 * - Static assets (images, fonts): Cache-first with long TTL
 * - API requests: Network-first with cache fallback
 * - Navigation: Network-first with offline fallback
 *
 * Cache Invalidation:
 * - BUILD_HASH changes on every deployment
 * - Old caches automatically cleaned on service worker activation
 * - No manual cache clearing required
 */

const CACHE_VERSION = '__BUILD_HASH__';
const CACHE_PREFIX = 'goalixa-pwa';

// Cache names for different strategies
const CACHES = {
  CORE: `${CACHE_PREFIX}-core-${CACHE_VERSION}`,
  ASSETS: `${CACHE_PREFIX}-assets-${CACHE_VERSION}`,
  API: `${CACHE_PREFIX}-api-${CACHE_VERSION}`,
  PAGES: `${CACHE_PREFIX}-pages-${CACHE_VERSION}`
};

// Core assets to cache immediately on install
const CORE_ASSETS = [
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

// Message handling for manual cache updates and update control
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING message, activating new service worker...');
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHES.PAGES).then((cache) => cache.addAll(event.data.urls))
    );
  }

  // Respond to ping messages to check if SW is active
  if (event.data && event.data.type === 'PING') {
    event.ports[0].postMessage({ type: 'PONG' });
  }
});
