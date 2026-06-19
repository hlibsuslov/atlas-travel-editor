import { serve } from '@hono/node-server';
import { openDb } from './db';
import { APP_NAME, APP_VERSION, createApp } from './app';

/**
 * Atlas Server entry point. Opens (or creates) the SQLite database, builds the
 * Hono app, and serves it. Configure via env: PORT, ATLAS_DB, ATLAS_ALLOW_SIGNUP,
 * ATLAS_CORS_ORIGINS. With zero config it listens on :8787 and stores data in
 * ./data/atlas.db.
 */
const port = Number(process.env.PORT ?? 8787);
const db = openDb();
const app = createApp(db);

serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`${APP_NAME} v${APP_VERSION} listening on http://localhost:${info.port}`);
});
