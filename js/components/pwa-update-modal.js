/**
 * PWA Update Notification Component
 * Shows a modal when a new version of the PWA is available
 */

let updateModal = null;
let deferredPrompt = null;

/**
 * Show a modal notification when a new PWA version is available
 * @param {Function} onUpdate - Callback when user clicks "Get New Version"
 */
export function showUpdateNotification(onUpdate) {
  // Close any existing modal
  closeUpdateModal();

  // Create modal element
  const modal = document.createElement('div');
  modal.className = 'pwa-update-modal-overlay';
  modal.id = 'pwa-update-modal';
  modal.innerHTML = `
    <div class="pwa-update-modal" role="dialog" aria-labelledby="pwa-update-modal-title" aria-modal="true">
      <div class="pwa-update-modal-icon">
        <i class="bi bi-arrow-repeat"></i>
      </div>
      <div class="pwa-update-modal-content">
        <h2 id="pwa-update-modal-title">New Version Available</h2>
        <p class="pwa-update-modal-text">
          A new version of Goalixa is ready to install. Update now to get the latest features and improvements.
        </p>
      </div>
      <div class="pwa-update-modal-actions">
        <button type="button" class="btn btn-outline-secondary pwa-update-dismiss-btn">
          Not Now
        </button>
        <button type="button" class="btn btn-primary pwa-update-apply-btn">
          <i class="bi bi-download"></i>
          Get New Version
        </button>
      </div>
      <button type="button" class="pwa-update-modal-close" aria-label="Close notification">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>
  `;

  // Add to document
  document.body.appendChild(modal);
  updateModal = modal;

  // Animate in
  requestAnimationFrame(() => {
    modal.classList.add('is-visible');
  });

  // Handle "Get New Version" button
  const applyBtn = modal.querySelector('.pwa-update-apply-btn');
  applyBtn.addEventListener('click', async () => {
    applyBtn.disabled = true;
    applyBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Updating...';

    try {
      // Call the update callback
      if (typeof onUpdate === 'function') {
        await onUpdate();
      }
    } catch (error) {
      console.error('[PWA Update] Failed to update:', error);
      applyBtn.disabled = false;
      applyBtn.innerHTML = '<i class="bi bi-download"></i> Retry';
    }
  });

  // Handle "Not Now" button
  const dismissBtn = modal.querySelector('.pwa-update-dismiss-btn');
  dismissBtn.addEventListener('click', () => {
    closeUpdateModal();
  });

  // Handle close button
  const closeBtn = modal.querySelector('.pwa-update-modal-close');
  closeBtn.addEventListener('click', () => {
    closeUpdateModal();
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeUpdateModal();
    }
  });

  // Auto-dismiss after 5 minutes
  setTimeout(() => {
    if (document.body.contains(modal)) {
      closeUpdateModal();
    }
  }, 5 * 60 * 1000);
}

/**
 * Close the update modal
 */
export function closeUpdateModal() {
  if (updateModal) {
    updateModal.classList.remove('is-visible');
    setTimeout(() => {
      if (updateModal && document.body.contains(updateModal)) {
        updateModal.remove();
      }
      updateModal = null;
    }, 300);
  }
}

/**
 * Register service worker with update detection
 * @param {Object} options - Configuration options
 * @param {string} options.swPath - Path to service worker file (default: '/sw.js')
 * @param {Function} options.onUpdate - Callback when update is available
 * @param {Function} options.onUpdated - Callback after successful update
 */
export function registerServiceWorker(options = {}) {
  const {
    swPath = '/sw.js',
    onUpdate = null,
    onUpdated = null
  } = options;

  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Worker not supported');
    return null;
  }

  return navigator.serviceWorker.register(swPath, { scope: '/' })
    .then((registration) => {
      console.log('[PWA] Service Worker registered:', registration.scope);

      // Listen for new service worker installation
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        console.log('[PWA] New service worker installing...');

        newWorker.addEventListener('statechange', () => {
          console.log('[PWA] Service Worker state:', newWorker.state);

          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available, old SW still controlling
            console.log('[PWA] New version available!');

            // Show update notification
            showUpdateNotification(async () => {
              console.log('[PWA] User requested update, activating new service worker...');

              // Tell new SW to skip waiting
              newWorker.postMessage({ type: 'SKIP_WAITING' });

              // Wait for the new service worker to become active
              await new Promise((resolve) => {
                const handleControllerChange = () => {
                  console.log('[PWA] New service worker is now controlling the page');
                  navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
                  resolve();
                };
                navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

                // Fallback timeout in case controllerchange doesn't fire
                setTimeout(() => {
                  navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
                  console.warn('[PWA] Controller change timeout, proceeding anyway');
                  resolve();
                }, 3000);
              });

              // Clear all caches to ensure fresh content
              if ('caches' in window) {
                try {
                  const cacheNames = await caches.keys();
                  console.log('[PWA] Clearing caches:', cacheNames);
                  await Promise.all(cacheNames.map(name => caches.delete(name)));
                  console.log('[PWA] All caches cleared successfully');
                } catch (err) {
                  console.warn('[PWA] Failed to clear caches:', err);
                }
              }

              // Call custom update callback
              if (typeof onUpdate === 'function') {
                try {
                  await onUpdate();
                } catch (err) {
                  console.warn('[PWA] Update callback failed:', err);
                }
              }

              // Small delay to ensure SW is fully activated
              await new Promise(resolve => setTimeout(resolve, 100));

              // Hard refresh to get new version
              console.log('[PWA] Refreshing to load new version...');
              window.location.reload(true);
            });
          }
        });
      });

      // Handle messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('[PWA] Message from service worker:', event.data);
      });

      // Check for updates when window gains focus
      window.addEventListener('focus', () => {
        registration.update().catch(err => {
          console.warn('[PWA] Update check failed:', err);
        });
      });

      // Call custom updated callback
      if (typeof onUpdated === 'function') {
        onUpdated(registration);
      }

      return registration;
    })
    .catch((error) => {
      console.error('[PWA] Service Worker registration failed:', error);
      throw error;
    });
}

/**
 * Unregister all service workers and clear caches
 * Useful for development or troubleshooting
 */
export async function unregisterServiceWorkers() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(reg => reg.unregister()));
    console.log('[PWA] All service workers unregistered');
  }

  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('[PWA] All caches cleared');
  }
}
