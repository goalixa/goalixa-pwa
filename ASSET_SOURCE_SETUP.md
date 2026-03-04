# Goalixa PWA - Local/CDN Asset Configuration

This setup allows Goalixa PWA to work offline in Iran by loading fonts and icons from local files instead of CDNs.

## Overview

The PWA now supports two modes for loading external assets (fonts and icons):

1. **Local Mode** - Uses files from `/vendor/` directory (no internet required)
2. **CDN Mode** - Uses internet CDNs (Google Fonts, Font Awesome CDN, etc.)

## How It Works

### Environment Variable

Set the `GOALIXA_ASSET_SOURCE` environment variable:
- `local` - Use local files from `/vendor/`
- `cdn` - Use internet CDNs
- **Default**: If not set, defaults to `local` for localhost, `cdn` for production

### File Structure

```
vendor/
├── fonts/
│   ├── google-fonts.css          # Local font definitions
│   ├── montserrat-600.ttf
│   ├── montserrat-700.ttf
│   ├── poppins-300.ttf
│   ├── poppins-400.ttf
│   ├── poppins-500.ttf
│   ├── poppins-600.ttf
│   └── poppins-700.ttf
├── font-awesome/
│   ├── css/all.min.css           # Font Awesome CSS
│   └── webfonts/                  # Font files
└── bootstrap-icons/
    ├── font/bootstrap-icons.min.css  # Bootstrap Icons CSS
    └── fonts/                       # Icon font files
```

### Configuration Files

1. **js/config.js** - Asset configuration module
   - Reads `GOALIXA_ASSET_SOURCE` environment variable
   - Dynamically loads appropriate CSS files
   - Falls back to intelligent defaults

2. **nginx-entrypoint.sh** - Docker entrypoint script
   - Injects `GOALIXA_ASSET_SOURCE` value into JavaScript
   - Replaces `__GOALIXA_ASSET_SOURCE__` placeholder

3. **Dockerfile** - Uses custom entrypoint script

4. **docker-compose.yml** - Sets `GOALIXA_ASSET_SOURCE: local`

## Usage

### Local Development (Offline)

The docker-compose.yml is already configured for local mode:

```yaml
pwa:
  environment:
    GOALIXA_ASSET_SOURCE: local
```

Just run:
```bash
docker-compose up
```

### Production (Online)

For production, change the environment variable to `cdn`:

```yaml
pwa:
  environment:
    GOALIXA_ASSET_SOURCE: cdn
```

Or remove it entirely to use the default CDN behavior.

### Manual Override

You can also override the asset source in your browser's localStorage:

```javascript
// In browser console
localStorage.setItem('goalixa_asset_source', 'local');
location.reload();
```

## Assets Loaded

When in **local mode**, the following are loaded from local files:

1. **Google Fonts**
   - Montserrat (600, 700)
   - Poppins (300, 400, 500, 600, 700)

2. **Font Awesome 6.4.0**
   - All icons and fonts

3. **Bootstrap Icons 1.11.3**
   - All icons and fonts

When in **CDN mode**, these are loaded from their respective CDNs.

## Adding New Assets

To add new local assets:

1. Download files to `vendor/` directory
2. Update `js/config.js` to add new asset configuration
3. Update `vendor/fonts/google-fonts.css` for fonts
4. Rebuild the Docker container

## Troubleshooting

### Fonts/Icons Not Loading

1. Check the browser console for errors
2. Verify the `GOALIXA_ASSET_SOURCE` environment variable is set
3. Check that files exist in the `vendor/` directory
4. Look for `[AssetConfig]` log messages in the console

### Switching Between Local and CDN

Simply change the environment variable and restart:

```bash
# Stop
docker-compose down

# Edit docker-compose.yml to change GOALIXA_ASSET_SOURCE

# Start
docker-compose up
```

## Benefits

- **Offline Support**: Works without internet connection
- **Faster Loading**: No external HTTP requests
- **Reliability**: No dependency on third-party CDNs
- **Flexibility**: Easy switch between local and CDN modes
- **Development Friendly**: Test offline behavior easily
