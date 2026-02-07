/**
 * App View Module
 * Embeds the main app in an iframe with postMessage communication
 */

import { getAuthToken, shareAuthWithIframe } from '../auth.js';

// Store reference to iframe for communication
let appIframe = null;

/**
 * Render app view
 */
export async function render(container, path, params) {
  // Get the sub-path (e.g., /timer, /overview)
  const subPath = path.replace('/app', '') || '/';

  // Render HTML
  container.innerHTML = `
    <div class="app-view">
      <iframe
        id="app-iframe"
        src="https://app.goalixa.com${subPath}"
        frameborder="0"
        allow="clipboard-read; clipboard-write"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
      ></iframe>
    </div>
  `;

  // Get iframe reference
  appIframe = container.querySelector('#app-iframe');

  // Wait for iframe to load, then share auth
  if (appIframe) {
    appIframe.addEventListener('load', () => {
      // Share auth token with iframe
      shareAuthWithIframe(appIframe);

      // Send initial path if provided
      if (subPath && subPath !== '/') {
        appIframe.contentWindow.postMessage({
          type: 'NAVIGATE',
          path: subPath
        }, '*');
      }
    });

    // Handle iframe load errors
    appIframe.addEventListener('error', () => {
      showLoadError(container);
    });
  }

  // Listen for messages from iframe
  initMessageListener();
}

/**
 * Show load error
 */
function showLoadError(container) {
  container.innerHTML = `
    <div class="app-error">
      <div class="error-content">
        <i class="fas fa-exclamation-triangle"></i>
        <h2>Unable to Load App</h2>
        <p>We couldn't connect to the Goalixa app. Please check your connection and try again.</p>
        <button class="btn btn-primary" onclick="location.reload()">Retry</button>
      </div>
    </div>
  `;
}

/**
 * Initialize message listener for iframe communication
 */
function initMessageListener() {
  // Remove existing listener to avoid duplicates
  window.removeEventListener('message', handleMessage);

  // Add new listener
  window.addEventListener('message', handleMessage);
}

/**
 * Handle messages from iframe
 */
function handleMessage(event) {
  // Verify origin for security
  if (event.origin !== 'https://app.goalixa.com' && event.origin !== window.location.origin) {
    return;
  }

  const { type, data } = event.data;

  switch (type) {
    case 'REQUEST_AUTH':
      // Iframe is requesting auth token
      if (appIframe) {
        shareAuthWithIframe(appIframe);
      }
      break;

    case 'NAVIGATE':
      // Iframe wants to update URL
      if (data.path) {
        const hash = data.path.startsWith('/') ? `#/app${data.path}` : `#/app/${data.path}`;
        window.location.hash = hash;
      }
      break;

    case 'AUTH_EXPIRED':
      // Iframe reports auth expired - refresh token
      console.log('Auth expired in iframe, refreshing...');
      // Token refresh will be handled by auth.js
      break;

    case 'LOGOUT':
      // Iframe triggered logout
      window.location.hash = '#/login';
      break;

    case 'NOTIFICATION':
      // Show notification from iframe
      if (data.message) {
        showNotification(data.message, data.type || 'info');
      }
      break;

    case 'RESIZE':
      // Iframe wants to resize
      if (appIframe && data.height) {
        appIframe.style.height = `${data.height}px`;
      }
      break;

    case 'COPY':
      // Handle copy request from iframe
      if (data.text) {
        navigator.clipboard.writeText(data.text).then(() => {
          if (appIframe) {
            appIframe.contentWindow.postMessage({
              type: 'COPY_SUCCESS'
            }, '*');
          }
        });
      }
      break;
  }
}

/**
 * Show notification from iframe
 */
function showNotification(message, type = 'info') {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
    <span>${message}</span>
  `;

  // Add to container
  const container = document.getElementById('toast-container');
  if (container) {
    container.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }
}

/**
 * Navigate iframe to specific path
 */
export function navigateIframe(path) {
  if (appIframe && appIframe.contentWindow) {
    appIframe.contentWindow.postMessage({
      type: 'NAVIGATE',
      path: path
    }, '*');
  }
}

/**
 * Send message to iframe
 */
export function sendToIframe(type, data = {}) {
  if (appIframe && appIframe.contentWindow) {
    appIframe.contentWindow.postMessage({
      type,
      data
    }, '*');
  }
}

// Export as default
export default {
  render,
  navigate: navigateIframe,
  send: sendToIframe,
  name: 'app'
};
