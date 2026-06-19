# Atlas Server — single, dependency-light container. No native modules: SQLite is
# Node's built-in node:sqlite, so the image builds and runs anywhere Node 24 does.
FROM node:24-slim

WORKDIR /app

# Install only runtime dependencies (hono, @hono/node-server, tsx, zod).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App source (TypeScript is run directly via tsx — no build step).
COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src

ENV NODE_ENV=production
ENV PORT=8787
ENV ATLAS_DB=/data/atlas.db
EXPOSE 8787
VOLUME ["/data"]

CMD ["npm", "start"]
