/**
 * Goalixa Asset Configuration - Production
 * Loads all external assets from CDN for production
 */

const AssetConfig = {
  // Load all external assets from CDN
  loadAssets() {
    console.log('[AssetConfig] Loading production assets from CDN');

    // Assets are already loaded via <link> tags in index.html
    // This is kept for compatibility but the actual loading happens
    // through the static HTML links for better performance
  }
};

console.log('[AssetConfig] Production CDN mode active');

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssetConfig;
}
