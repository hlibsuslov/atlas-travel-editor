# Builds the local-first Atlas web app into a static bundle and serves it.
# This image needs NO backend: everything is stored in the browser (IndexedDB).
# Build & run:  docker build -t atlas-web . && docker run -p 8080:80 atlas-web

# ---- Stage 1: build the static PWA ----------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 2: serve dist/ with a tiny SPA-fallback nginx ------------------
FROM nginx:alpine
# SPA fallback: any unknown path resolves to index.html so client routing works.
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / {\n    try_files $uri /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
