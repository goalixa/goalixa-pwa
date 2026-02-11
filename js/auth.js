/**
 * Authentication State Manager
 * Handles auth state across the PWA and shares with iframe
 */

import { getCookie, setCookie, deleteCookie, storage, eventBus } from './utils.js';
import { authApi } from './api.js';

// Auth state
let authState = {
  isAuthenticated: false,
  user: null,
  token: null,
  isLoading: true
};

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
      authState.token = storedAuth.token || null;
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

    if (response.token) {
      // Set auth cookie
      setCookie('goalixa_auth', response.token);

      // Update state
      authState.isAuthenticated = true;
      authState.user = response.user;
      authState.token = response.token;

      // Store in localStorage as backup
      storage.set('auth', {
        isAuthenticated: true,
        user: response.user,
        token: response.token
      });

      notifyListeners();
      eventBus.emit('auth:login', { user: response.user });

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

    if (response.token || response.user) {
      const token = response.token || getCookie('goalixa_auth');

      if (token) {
        setCookie('goalixa_auth', token);
      }

      authState.isAuthenticated = true;
      authState.user = response.user;
      authState.token = token;

      storage.set('auth', {
        isAuthenticated: true,
        user: response.user,
        token
      });

      notifyListeners();
      eventBus.emit('auth:register', { user: response.user });

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
    deleteCookie('goalixa_auth');
    storage.remove('auth');

    authState.isAuthenticated = false;
    authState.user = null;
    authState.token = null;

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
 * Refresh auth token
 */
export async function refreshToken() {
  try {
    const response = await authApi.refreshToken();

    if (response.token) {
      setCookie('goalixa_auth', response.token);
      authState.token = response.token;
      storage.set('auth', { ...authState });

      return { success: true, token: response.token };
    }

    return { success: false };
  } catch (error) {
    console.error('Token refresh failed:', error);
    return { success: false };
  }
}

/**
 * Share auth token with iframe (app view)
 */
export function shareAuthWithIframe(iframe) {
  if (!iframe || !authState.token) return;

  try {
    iframe.contentWindow.postMessage({
      type: 'AUTH_TOKEN',
      token: authState.token,
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
        // Iframe is requesting auth token
        const iframe = document.querySelector('#app-iframe');
        if (iframe) {
          shareAuthWithIframe(iframe);
        }
        break;

      case 'AUTH_EXPIRED':
        // Iframe reports auth expired
        refreshToken();
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
