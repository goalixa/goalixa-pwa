/**
 * Goalixa Asset Configuration
 * Reads from environment variables to determine asset source (local vs CDN)
 */

const AssetConfig = {
  // Asset source: 'local' or 'cdn' (set by environment via local)
  // This placeholder will be replaced by nginx entrypoint script
  source: 'local' || 'local',

  // Font Awesome configuration
  fontAwesome: {
    local: {
      css: '/vendor/font-awesome/css/all.min.css'
    },
    cdn: {
      css: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
    }
  },

  // Bootstrap Icons configuration
  bootstrapIcons: {
    local: {
      css: '/vendor/bootstrap-icons/font/bootstrap-icons.min.css'
    },
    cdn: {
      css: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'
    }
  },

  // Google Fonts configuration
  googleFonts: {
    local: {
      css: '/vendor/fonts/google-fonts.css'
    },
    cdn: {
      css: 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Montserrat:wght@600;700&display=swap'
    }
  },

  // Get URL based on current source
  getUrl(assetType) {
    const config = this[assetType];
    if (!config) {
      console.warn(`[AssetConfig] Unknown asset type: ${assetType}`);
      return null;
    }
    return config[this.source] || config.cdn;
  },

  // Load all external assets dynamically
  loadAssets() {
    console.log(`[AssetConfig] Loading assets from source: ${this.source}`);

    // Load Google Fonts
    const fontsUrl = this.getUrl('googleFonts');
    if (fontsUrl) {
      this.loadCSS(fontsUrl, 'google-fonts');
    }

    // Load Font Awesome
    const fontAwesomeUrl = this.getUrl('fontAwesome');
    if (fontAwesomeUrl) {
      this.loadCSS(fontAwesomeUrl, 'font-awesome');
    }

    // Load Bootstrap Icons
    const bootstrapIconsUrl = this.getUrl('bootstrapIcons');
    if (bootstrapIconsUrl) {
      this.loadCSS(bootstrapIconsUrl, 'bootstrap-icons');
    }
  },

  // Helper to load CSS file dynamically
  loadCSS(url, id) {
    // Check if already loaded
    if (document.getElementById(id)) {
      console.log(`[AssetConfig] CSS already loaded: ${id}`);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.id = id;
    document.head.appendChild(link);
    console.log(`[AssetConfig] Loaded CSS: ${id} from ${url}`);
  }
};

// Initialize configuration - use injected value or fallback to local/CDN based on hostname
const injectedSource = 'local';
window.local = injectedSource && injectedSource !== 'local'
  ? injectedSource
  : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'local' : 'cdn');

console.log('[AssetConfig] Using asset source:', window.local);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssetConfig;
}
