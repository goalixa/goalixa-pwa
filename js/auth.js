/**
 * Authentication State Manager
 * Handles auth state across the PWA and shares with iframe
 */

import { getCookie, deleteCookie, storage, eventBus } from './utils.js';
import { authApi } from './api.js';
import { authMonitor } from './authMonitor.js';

// Auth state
let authState = {
  isAuthenticated: false,
  user: null,
  token: null,
  isLoading: true
};

// Token refresh management
let refreshPromise = null;
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 3;
const REFRESH_BACKOFF_MS = [1000, 2000, 5000]; // Exponential backoff

// Proactive refresh timer
let proactiveRefreshTimer = null;
const PROACTIVE_REFRESH_INTERVAL = 13 * 60 * 1000; // 13 minutes (refresh before 15min expiry)

// Auth state change listeners
const listeners = [];

/**
 * Initialize auth state from cookies/storage
 */
export async function initAuth() {
  authState.isLoading = true;
  notifyListeners();

  try {
    // Always verify with server (auth uses HttpOnly cookies)
    const result = await authApi.getCurrentUser();
    const user = result && result.user ? result.user : result;

    if (user && user.id) {
      authState.isAuthenticated = true;
      authState.user = user;
      authState.token = null;

      // Start proactive token refresh timer
      startProactiveRefresh();
    } else {
      authState.isAuthenticated = false;
      authState.user = null;
      authState.token = null;
    }
  } catch (error) {
    console.error('Auth initialization failed:', error);
    // Offline fallback (best-effort)
    const storedAuth = storage.get('auth');
    if (!navigator.onLine && storedAuth && storedAuth.user) {
      authState.isAuthenticated = true;
      authState.user = storedAuth.user;
      authState.token = null;
    } else {
      authState.isAuthenticated = false;
      authState.user = null;
      authState.token = null;
    }
  } finally {
    authState.isLoading = false;
    notifyListeners();
  }

  return authState;
}

/**
 * Login user
 */
export async function login(email, password) {
  try {
    const response = await authApi.login(email, password);

    // Backend sets HttpOnly cookies (goalixa_access, goalixa_refresh)
    // No need to manually set cookies
    if (response.success || response.user) {
      // Update state
      authState.isAuthenticated = true;
      authState.user = response.user;
      authState.token = null; // Token is in HttpOnly cookie

      // Store in localStorage as backup (without sensitive token)
      storage.set('auth', {
        isAuthenticated: true,
        user: response.user,
        token: null
      });

      notifyListeners();
      eventBus.emit('auth:login', { user: response.user });

      // Start proactive token refresh
      startProactiveRefresh();

      return { success: true, user: response.user };
    }

    return { success: false, error: 'Invalid response from server' };
  } catch (error) {
    console.error('Login failed:', error);
    return {
      success: false,
      error: error.message || 'Login failed. Please try again.'
    };
  }
}

/**
 * Register new user
 */
export async function register(userData) {
  try {
    const response = await authApi.register(userData);

    // Backend sets HttpOnly cookies
    if (response.success || response.user) {
      authState.isAuthenticated = true;
      authState.user = response.user;
      authState.token = null;

      storage.set('auth', {
        isAuthenticated: true,
        user: response.user,
        token: null
      });

      notifyListeners();
      eventBus.emit('auth:register', { user: response.user });

      // Start proactive token refresh
      startProactiveRefresh();

      return { success: true, user: response.user };
    }

    return { success: false, error: 'Invalid response from server' };
  } catch (error) {
    console.error('Registration failed:', error);
    return {
      success: false,
      error: error.message || 'Registration failed. Please try again.'
    };
  }
}

/**
 * Logout user
 */
export async function logout() {
  try {
    await authApi.logout();
  } catch (error) {
    console.error('Logout API call failed:', error);
  } finally {
    // Clear auth state regardless of API result
    deleteCookie('goalixa_access');
    deleteCookie('goalixa_refresh');
    deleteCookie('goalixa_auth'); // Legacy cookie
    storage.remove('auth');

    authState.isAuthenticated = false;
    authState.user = null;
    authState.token = null;

    // Stop proactive refresh timer
    stopProactiveRefresh();

    // Reset refresh attempts
    refreshAttempts = 0;
    refreshPromise = null;

    notifyListeners();
    eventBus.emit('auth:logout');
  }
}

/**
 * Get current auth state
 */
export function getAuthState() {
  return { ...authState };
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
  return authState.isAuthenticated;
}

/**
 * Get current user
 */
export function getCurrentUser() {
  return authState.user;
}

/**
 * Get auth token
 */
export function getAuthToken() {
  return authState.token;
}

/**
 * Subscribe to auth state changes
 */
export function subscribe(callback) {
  listeners.push(callback);
  callback(authState); // Immediately call with current state

  // Return unsubscribe function
  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

/**
 * Notify all listeners of state change
 */
function notifyListeners() {
  listeners.forEach(callback => callback(authState));
}

/**
 * Refresh auth token with retry logic
 */
export async function refreshToken() {
  // If a refresh is already in progress, return that promise
  if (refreshPromise) {
    return refreshPromise;
  }

  // Check if we've exceeded max attempts
  if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
    console.error('Token refresh failed: max attempts exceeded');
    await logout();
    return { success: false, error: 'Session expired. Please login again.' };
  }

  refreshPromise = (async () => {
    try {
      const response = await authApi.refreshToken();

      // Backend sets HttpOnly cookies automatically
      if (response.success || response.access_token) {
        // Reset attempts on success
        refreshAttempts = 0;

        authMonitor.logEvent('auth:refresh', { success: true });
        eventBus.emit('auth:refresh', { success: true });

        return { success: true };
      }

      // Retry with backoff on failure
      refreshAttempts++;
      const backoffDelay = REFRESH_BACKOFF_MS[Math.min(refreshAttempts - 1, REFRESH_BACKOFF_MS.length - 1)];

      console.warn(`Token refresh failed, retrying in ${backoffDelay}ms (attempt ${refreshAttempts}/${MAX_REFRESH_ATTEMPTS})`);

      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return refreshToken();

    } catch (error) {
      console.error('Token refresh failed:', error);

      // Retry with backoff on network error
      refreshAttempts++;
      const backoffDelay = REFRESH_BACKOFF_MS[Math.min(refreshAttempts - 1, REFRESH_BACKOFF_MS.length - 1)];

      if (refreshAttempts < MAX_REFRESH_ATTEMPTS) {
        console.warn(`Token refresh error, retrying in ${backoffDelay}ms (attempt ${refreshAttempts}/${MAX_REFRESH_ATTEMPTS})`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        return refreshToken();
      }

      // Max attempts reached, logout user
      authMonitor.logEvent('auth:error', { type: 'refresh_max_attempts', attempts: refreshAttempts });
      await logout();
      return { success: false, error: 'Session expired. Please login again.' };
    } finally {
      // Clear the in-progress promise after completion
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Start proactive token refresh timer
 */
function startProactiveRefresh() {
  stopProactiveRefresh();

  proactiveRefreshTimer = setInterval(async () => {
    if (authState.isAuthenticated) {
      console.log('Proactively refreshing token before expiration');
      await refreshToken();
    }
  }, PROACTIVE_REFRESH_INTERVAL);
}

/**
 * Stop proactive token refresh timer
 */
function stopProactiveRefresh() {
  if (proactiveRefreshTimer) {
    clearInterval(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
}

/**
 * Share auth state with iframe (app view)
 * Note: Tokens are HttpOnly, so we only share user info
 */
export function shareAuthWithIframe(iframe) {
  if (!iframe || !authState.isAuthenticated) return;

  try {
    iframe.contentWindow.postMessage({
      type: 'AUTH_STATE',
      authenticated: authState.isAuthenticated,
      user: authState.user
    }, '*');
  } catch (error) {
    console.error('Failed to share auth with iframe:', error);
  }
}

/**
 * Listen for messages from iframe
 */
export function listenForIframeMessages() {
  window.addEventListener('message', (event) => {
    // Verify origin for security
    const allowedOrigins = [
      'https://app.goalixa.com',
      'https://auth.goalixa.com',
      window.location.origin
    ];

    if (!allowedOrigins.includes(event.origin)) {
      return;
    }

    const { type, data } = event.data;

    switch (type) {
      case 'REQUEST_AUTH':
        // Iframe is requesting auth state
        const iframe = document.querySelector('#app-iframe');
        if (iframe) {
          shareAuthWithIframe(iframe);
        }
        break;

      case 'AUTH_EXPIRED':
        // Iframe reports auth expired - attempt refresh with retry
        console.log('Auth expired notification from iframe, refreshing...');
        refreshToken().catch(err => {
          console.error('Failed to refresh after iframe notification:', err);
        });
        break;

      case 'LOGOUT':
        // Iframe triggered logout
        logout();
        break;

      case 'NAVIGATE':
        // Iframe wants to navigate
        eventBus.emit('navigate', data.path);
        break;
    }
  });
}

// Initialize iframe message listener on load
if (typeof window !== 'undefined') {
  listenForIframeMessages();
}
