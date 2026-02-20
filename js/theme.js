const THEME_KEY = 'goalixa-theme';
const LIGHT_THEME_COLOR = '#f8fafc';
const DARK_THEME_COLOR = '#0f172a';

let initialized = false;
let mediaQuery = null;
let mediaHandler = null;

function isThemeValue(value) {
  return value === 'light' || value === 'dark';
}

function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return isThemeValue(stored) ? stored : null;
  } catch (error) {
    return null;
  }
}

function getSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function updateMetaThemeColor(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  meta.setAttribute('content', theme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
}

function dispatchThemeChange(theme) {
  window.dispatchEvent(new CustomEvent('goalixa:theme-change', { detail: { theme } }));
  window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
}

export function getTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  if (isThemeValue(current)) return current;
  const stored = getStoredTheme();
  if (stored) return stored;
  return getSystemTheme();
}

export function applyTheme(theme, persist = true) {
  const nextTheme = isThemeValue(theme) ? theme : getSystemTheme();
  document.documentElement.setAttribute('data-theme', nextTheme);
  updateMetaThemeColor(nextTheme);
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, nextTheme);
    } catch (error) {
      // Ignore storage write failures.
    }
  }
  dispatchThemeChange(nextTheme);
  return nextTheme;
}

export function toggleTheme() {
  const nextTheme = getTheme() === 'dark' ? 'light' : 'dark';
  return applyTheme(nextTheme, true);
}

export function initTheme() {
  if (initialized) {
    return getTheme();
  }

  const stored = getStoredTheme();
  const initial = stored || getSystemTheme();
  applyTheme(initial, Boolean(stored));

  if (!mediaQuery && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaHandler = (event) => {
      if (getStoredTheme()) return;
      applyTheme(event.matches ? 'dark' : 'light', false);
    };
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', mediaHandler);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(mediaHandler);
    }
  }

  initialized = true;
  return getTheme();
}
