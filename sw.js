/**
 * Unified PWA Service Worker for Goalixa
 * Handles caching for landing, auth, and app views
 */

const CACHE_VERSION = 'v1';
const CACHE_PREFIX = 'goalixa-pwa';

// Cache names for different strategies
const CACHES = {
  CORE: `${CACHE_PREFIX}-core-${CACHE_VERSION}`,
  ASSETS: `${CACHE_PREFIX}-assets-${CACHE_VERSION}`,
  API: `${CACHE_PREFIX}-api-${CACHE_VERSION}`,
  PAGES: `${CACHE_PREFIX}-pages-${CACHE_VERSION}`
};

// Core assets to cache immediately
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/css/styles.css',
  '/js/router.js',
  '/js/api.js',
  '/js/auth.js',
  '/js/utils.js',
  '/js/views/landing-view.js',
  '/js/views/auth-view.js',
  '/js/views/app-view.js'
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
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Montserrat:wght@800;900&display=swap'
];

// API base URLs - use network first
const API_PATTERNS = [
  /\/api\//,
  /https:\/\/auth\.goalixa\.com/,
  /https:\/\/app\.goalixa\.com/
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    Promise.all([
      caches.open(CACHES.CORE).then((cache) => cache.addAll(CORE_ASSETS)),
      caches.open(CACHES.ASSETS).then((cache) => cache.addAll(ASSET_URLS))
    ])
      .then(() => {
        console.log('[SW] Core assets cached');
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
  return /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|css|js)$/.test(url.pathname);
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
