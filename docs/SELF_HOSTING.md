# Self-hosting & run modes

Travel Editor runs in three modes. Pick the one that matches how much
infrastructure you want to own:

| Mode | Account? | Data lives in | Sharing / friends | Best for |
| ---- | -------- | ------------- | ----------------- | -------- |
| **(a) Local-only / no backend** | no | your device + JSON files you export | no | trying it out, private/offline use |
| **(b) Hosted Supabase** | yes | a Supabase project you create | yes | multi-user, multi-device, public share links |
| **(c) Fully self-hosted Supabase** | yes | a Supabase stack you run | yes | owning the whole stack, air-gapped/on-prem |

All three use the same build — the difference is configuration in `.env` and
where the document is stored.

> The pluggable storage layer (`src/lib/storage/`) is being introduced
> incrementally. Local-only mode and the Supabase path are available today;
> bring-your-own-cloud providers (Google Drive, Dropbox, WebDAV, GitHub) are
> landing behind the same seam — see [`docs/STRATEGY.md`](STRATEGY.md) §4 for the
> roadmap. Don't enable a provider that isn't listed as available below.

---

## (a) Local-only / no backend

No Supabase project, no account, no network. Your travel document is kept on the
device, and you move it between machines by exporting and importing a JSON file.

```bash
git clone <your-fork-url> atlas-travel-editor
cd atlas-travel-editor
npm install
cp .env.example .env
```

Then enable a no-backend mode in `.env` — either one works:

```dotenv
# Option 1 — pure local-first, no login screen.
VITE_LOCAL_ONLY=1

# Option 2 — demo auth: a minimal login screen, credentials 1 / 1.
VITE_DEMO_AUTH=1
VITE_DEMO_LOGIN=1
VITE_DEMO_PASSWORD=1
```

```bash
npm run dev          # http://localhost:5173
```

You can now edit the document, see the live JSON preview, colour the map, and
**Export** / **Import** a JSON file to back up or move your data. Account-only
features (public sharing, friends, public profile) are hidden in this mode —
they genuinely need a server.

`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are **not required** in this mode;
the env gate is relaxed when `VITE_LOCAL_ONLY=1` or `VITE_DEMO_AUTH=1` is set.

---

## (b) Hosted Supabase (managed)

The original multi-user path: each signed-in user owns one travel document in a
Supabase project, protected by Row Level Security, and can mint a public
read-only share link.

1. Create a project at [supabase.com](https://supabase.com) and copy its **URL**
   and **anon** key (Project Settings → API). The anon key is public by design —
   access is enforced by RLS, never by hiding the key. Never put the
   `service_role` key in this app.

2. Fill in `.env`:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   VITE_APP_URL=http://localhost:5173
   ```

3. Apply the schema with the [Supabase CLI](https://supabase.com/docs/guides/cli):

   ```bash
   supabase link --project-ref your-project-ref
   supabase db push
   ```

4. Configure auth (login screen supports email + password, magic link, and
   Google OAuth). In **Authentication → URL Configuration**, set the **Site URL**
   and add `http://localhost:5173` (and your deployed origin) to **Redirect
   URLs** so confirmation/magic links and OAuth return to the app. For Google,
   enable the Google provider with its client credentials.

5. Run it:

   ```bash
   npm run dev
   ```

After any schema change, regenerate the typed client:

```bash
supabase gen types typescript --linked > src/lib/database.types.ts
```

---

## (c) Fully self-hosted Supabase

Run the entire Supabase stack (Postgres + Auth + the API gateway) yourself —
locally via the CLI, or on your own server. This keeps every byte on
infrastructure you control.

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker.

2. Start the stack and apply the migrations from a fresh database:

   ```bash
   supabase start          # boots Postgres, Auth, Studio, etc. in Docker
   supabase db reset       # applies everything in supabase/migrations
   ```

   `supabase start` prints a local **API URL** and **anon key**. Put those in
   `.env`:

   ```dotenv
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=<anon key printed by `supabase start`>
   VITE_APP_URL=http://localhost:5173
   ```

3. Run the app against your local stack:

   ```bash
   npm run dev
   ```

For a server deployment, run the same stack on your host (or use Supabase's
self-host docker-compose) and point `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
at that origin instead.

### Widen the CSP for a non-default origin

The deployed Content-Security-Policy in [`vercel.json`](../vercel.json) hardcodes
`connect-src` to the managed Supabase domains:

```
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io;
```

A **self-hosted Supabase** (e.g. `http://127.0.0.1:54321` or
`https://supabase.example.com`) or any **bring-your-own-cloud** origin is *not*
covered by `*.supabase.co`, so the browser will block its requests. Add your
origin (both `https://` and, if you use realtime, `wss://`) to the `connect-src`
directive in `vercel.json` before deploying — for example:

```diff
- connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io;
+ connect-src 'self' https://supabase.example.com wss://supabase.example.com https://*.sentry.io;
```

> The Vite dev server (`npm run dev`) does not apply `vercel.json` headers, so
> local development works without this edit; it only matters for a hosted build.
> If you deploy somewhere other than Vercel, the headers in `vercel.json` are not
> served at all — re-express the CSP for your host (see
> [`docs/SECURITY.md`](SECURITY.md)).

---

## Which mode am I in?

- No Supabase env and `VITE_LOCAL_ONLY=1` (or `VITE_DEMO_AUTH=1`) → **local-only**.
- Supabase env set, pointing at `*.supabase.co` → **hosted Supabase**.
- Supabase env set, pointing at your own origin → **self-hosted Supabase**
  (remember the CSP widening above for a hosted build).

See [`docs/STRATEGY.md`](STRATEGY.md) for the full architecture and the
bring-your-own-cloud roadmap, and [`docs/SECURITY.md`](SECURITY.md) for the
security model.
