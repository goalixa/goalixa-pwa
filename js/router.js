/**
 * Client-Side Router for Goalixa PWA
 * Hash-based routing with support for landing, auth, and app views
 */

import { isAuthenticated, initAuth } from './auth.js';
import { eventBus } from './utils.js';

// Route configuration
const routes = {
  '/': { view: 'landing', title: 'Goalixa - Goals, Plans, Projects, Tasks' },
  '/landing': { view: 'landing', title: 'Goalixa - Landing' },
  '/auth': { view: 'auth', title: 'Goalixa - Login' },
  '/login': { view: 'auth', title: 'Goalixa - Login' },
  '/signup': { view: 'auth', title: 'Goalixa - Sign Up' },
  '/register': { view: 'auth', title: 'Goalixa - Register' },
  '/forgot-password': { view: 'auth', title: 'Goalixa - Reset Password' },
  '/reset-password': { view: 'auth', title: 'Goalixa - Reset Password' },
  '/app': { view: 'app', title: 'Goalixa - App', auth: true },
  '/app/timer': { view: 'app', title: 'Goalixa - Timer', auth: true },
  '/app/overview': { view: 'app', title: 'Goalixa - Overview', auth: true },
  '/app/goals': { view: 'app', title: 'Goalixa - Goals', auth: true },
  '/app/habits': { view: 'app', title: 'Goalixa - Habits', auth: true },
  '/app/projects': { view: 'app', title: 'Goalixa - Projects', auth: true },
  '/app/tasks': { view: 'app', title: 'Goalixa - Tasks', auth: true },
  '/app/reports': { view: 'app', title: 'Goalixa - Reports', auth: true },
  '/app/calendar': { view: 'app', title: 'Goalixa - Calendar', auth: true },
  '/app/planner': { view: 'app', title: 'Goalixa - Planner', auth: true },
  '/app/account': { view: 'app', title: 'Goalixa - Account', auth: true }
};

// View modules registry
const viewModules = {
  landing: null,
  auth: null,
  app: null
};

// Current route state
let currentRoute = null;
let currentParams = {};

/**
 * Initialize router
 */
export async function initRouter() {
  // Wait for auth to initialize
  await initAuth();

  // Register view modules
  try {
    const landingModule = await import('./views/landing-view.js');
    viewModules.landing = landingModule.default || landingModule;
  } catch (err) {
    console.error('Failed to load landing view:', err);
  }

  try {
    const authModule = await import('./views/auth-view.js');
    viewModules.auth = authModule.default || authModule;
  } catch (err) {
    console.error('Failed to load auth view:', err);
  }

  try {
    const appModule = await import('./views/app-view.js');
    viewModules.app = appModule.default || appModule;
  } catch (err) {
    console.error('Failed to load app view:', err);
  }

  // Handle initial route
  handleRoute();

  // Listen for hash changes
  window.addEventListener('hashchange', handleRoute);

  // Listen for popstate (back/forward)
  window.addEventListener('popstate', handleRoute);

  // Listen for navigate events
  eventBus.on('navigate', (path) => {
    navigate(path);
  });

  // Mark app as ready
  window.dispatchEvent(new Event('app-ready'));
}

/**
 * Handle route change
 */
async function handleRoute() {
  // Get current hash without #
  const hash = window.location.hash.slice(1) || '/';
  const [path, queryString] = hash.split('?');

  // Parse query parameters
  currentParams = {};
  if (queryString) {
    queryString.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      currentParams[decodeURIComponent(key)] = decodeURIComponent(value);
    });
  }

  // Find matching route
  const route = routes[path] || findDynamicRoute(path);

  if (!route) {
    // 404 - redirect to landing
    navigate('/');
    return;
  }

  // Check authentication
  if (route.auth && !isAuthenticated()) {
    // Store intended destination
    sessionStorage.setItem('redirectAfterLogin', path);
    navigate('/login');
    return;
  }

  // Update document title
  document.title = route.title;

  // Render view
  await renderView(route.view, path);

  currentRoute = route;

  // Scroll to top
  window.scrollTo(0, 0);
}

/**
 * Find dynamic route (for /app/* patterns)
 */
function findDynamicRoute(path) {
  if (path.startsWith('/app/')) {
    return { view: 'app', title: 'Goalixa - App', auth: true };
  }
  return null;
}

/**
 * Render view
 */
async function renderView(viewName, path) {
  const container = document.getElementById('view-container');
  if (!container) return;

  // Clear current view
  container.innerHTML = '';

  // Get view module
  const viewModule = viewModules[viewName];

  if (!viewModule) {
    container.innerHTML = `
      <div class="error-view">
        <h2>View Not Found</h2>
        <p>The requested view could not be loaded.</p>
        <a href="#/" class="btn btn-primary">Go Home</a>
      </div>
    `;
    return;
  }

  try {
    // Render view
    if (typeof viewModule.render === 'function') {
      await viewModule.render(container, path, currentParams);
    } else if (typeof viewModule === 'function') {
      await viewModule(container, path, currentParams);
    }
  } catch (error) {
    console.error(`Error rendering ${viewName} view:`, error);
    container.innerHTML = `
      <div class="error-view">
        <h2>Something went wrong</h2>
        <p>${error.message}</p>
        <a href="#/" class="btn btn-primary">Go Home</a>
      </div>
    `;
  }
}

/**
 * Navigate to path
 */
export function navigate(path, params = {}) {
  const hash = path.startsWith('#') ? path : `#${path}`;

  // Add query parameters if provided
  if (Object.keys(params).length > 0) {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    window.location.hash = `${path}?${queryString}`;
  } else {
    window.location.hash = hash;
  }
}

/**
 * Get current route
 */
export function getCurrentRoute() {
  return currentRoute;
}

/**
 * Get current params
 */
export function getParams() {
  return { ...currentParams };
}

/**
 * Redirect to login with return URL
 */
export function redirectToLogin(returnPath = null) {
  const path = returnPath || window.location.hash.slice(1) || '/';
  sessionStorage.setItem('redirectAfterLogin', path);
  navigate('/login');
}

/**
 * Redirect after login
 */
export function redirectAfterLogin() {
  const redirectPath = sessionStorage.getItem('redirectAfterLogin');
  sessionStorage.removeItem('redirectAfterLogin');

  if (redirectPath && redirectPath !== '/login' && redirectPath !== '/signup') {
    navigate(redirectPath);
  } else {
    navigate('/app');
  }
}

/**
 * Initialize router on load
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRouter);
} else {
  initRouter();
}
