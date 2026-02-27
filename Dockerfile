# Basic static site image for Goalixa PWA
FROM nginx:alpine

# Accept build arguments
ARG BUILD_HASH=dev
ARG BUILD_TIME=unknown

# Remove default site
RUN rm /usr/share/nginx/html/*

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy PWA files
COPY index.html offline.html /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY icons /usr/share/nginx/html/icons
COPY vendor /usr/share/nginx/html/vendor
COPY manifest.webmanifest /usr/share/nginx/html/

# Copy and inject build hash into service worker
COPY sw.js /tmp/sw.js
RUN sed -i "s/__BUILD_HASH__/${BUILD_HASH}/g" /tmp/sw.js && \
    sed -i "s/__BUILD_TIME__/${BUILD_TIME}/g" /tmp/sw.js && \
    cp /tmp/sw.js /usr/share/nginx/html/sw.js

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
