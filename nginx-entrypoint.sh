#!/bin/sh
# Nginx entrypoint script that injects environment variables

# Set default asset source if not provided
export ASSET_SOURCE=${GOALIXA_ASSET_SOURCE:-local}

# Replace placeholder in index.html with actual value
if [ -f /usr/share/nginx/html/index.html ]; then
    sed -i "s|__GOALIXA_ASSET_SOURCE__|${ASSET_SOURCE}|g" /usr/share/nginx/html/index.html
fi

# Replace placeholder in config.js if it exists
if [ -f /usr/share/nginx/html/js/config.js ]; then
    sed -i "s|__GOALIXA_ASSET_SOURCE__|${ASSET_SOURCE}|g" /usr/share/nginx/html/js/config.js
fi

echo "Nginx starting with GOALIXA_ASSET_SOURCE=${ASSET_SOURCE}"

# Start nginx
exec nginx -g 'daemon off;'
