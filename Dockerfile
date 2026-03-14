# Production static site image for Goalixa PWA
FROM nginx:alpine

# Accept build arguments - MUST be provided during build
ARG BUILD_HASH
ARG BUILD_TIME

# Fail if build arguments are not provided
RUN if [ -z "$BUILD_HASH" ] || [ -z "$BUILD_TIME" ]; then \
      echo "ERROR: BUILD_HASH and BUILD_TIME must be provided during build"; \
      exit 1; \
    fi

# Remove default site
RUN rm /usr/share/nginx/html/*

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy PWA files
COPY index.html offline.html /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY icons /usr/share/nginx/html/icons
COPY manifest.webmanifest /usr/share/nginx/html/

# Copy and inject build hash into service worker
COPY sw.js /tmp/sw.js
RUN sed -i "s|__BUILD_HASH__|${BUILD_HASH}|g" /tmp/sw.js && \
    sed -i "s|__BUILD_TIME__|${BUILD_TIME}|g" /tmp/sw.js && \
    cp /tmp/sw.js /usr/share/nginx/html/sw.js

# Copy entrypoint script
COPY nginx-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080

# Use custom entrypoint that injects environment variables
ENTRYPOINT ["/docker-entrypoint.sh"]
