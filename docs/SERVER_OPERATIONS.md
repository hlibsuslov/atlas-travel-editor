# Atlas Server operations

This runbook covers the optional stateful server. It is separate from the Vercel
frontend and owns the SQLite database containing accounts, sessions, profiles,
documents, and follows.

## Safe baseline

```bash
ATLAS_CORS_ORIGINS=https://atlas.example.com docker compose up -d --build atlas-server
curl -fsS http://127.0.0.1:8787/healthz
```

Compose binds the server and web ports to `127.0.0.1` by default. Put a reverse
proxy in front for public HTTPS. Override `ATLAS_BIND_IP` only when you
deliberately want direct network exposure.

## Configuration

| Variable | Default | Operational guidance |
| --- | --- | --- |
| `PORT` | `8787` | Container port; Compose publishes 8787 |
| `ATLAS_DB` | `/data/atlas.db` in Docker | Keep under the persistent volume |
| `ATLAS_ALLOW_SIGNUP` | `1` | Set `0` after bootstrap for a private instance |
| `ATLAS_CORS_ORIGINS` | `*` | Set exact HTTPS frontend origin(s) in production |
| `ATLAS_BIND_IP` | `127.0.0.1` | Compose host bind only |

These are configuration values, not authentication secrets. User passwords and
session tokens still require private handling.

## Health and inspection

```bash
curl -fsS http://127.0.0.1:8787/healthz
curl -fsS http://127.0.0.1:8787/config
docker compose ps
docker compose logs --tail=200 atlas-server
```

`/healthz` confirms process/database startup and advertises capability/schema
versions. It does not prove login, document writes, public sharing, or backups.

For deeper acceptance, use temporary accounts and the API flow described in
[TESTING.md](TESTING.md).

## Backup

The database runs in WAL mode. Do not copy only `atlas.db` while the process is
actively writing.

A simple consistent backup with brief downtime:

```bash
atlas_stamp=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "backups/${atlas_stamp}"
docker compose stop atlas-server
docker compose cp atlas-server:/data/. "backups/${atlas_stamp}/"
docker compose start atlas-server
curl -fsS http://127.0.0.1:8787/healthz
```

Store backups off-host as well as locally. Encrypt them: the database contains
personal travel data, account email addresses, password hashes, and session-token
hashes.

Test restoration periodically; an untested archive is not a backup strategy.

## Restore

1. Stop writes and take a final copy of the current `/data`.
2. Stop the server.
3. Replace the volume contents with one known-good backup.
4. Preserve ownership/read-write permissions expected by the container.
5. Start and check `/healthz`.
6. Test login, a private document read, and a known public/revoked link.

Example for the Compose container:

```bash
docker compose stop atlas-server
docker compose cp backups/RESTORE_ID/. atlas-server:/data/
docker compose start atlas-server
curl -fsS http://127.0.0.1:8787/healthz
```

Do not merge files from two SQLite backups. Restore the database, WAL, and shared
memory files as one consistent set, or use a backup taken after a clean stop.

## Upgrade

```bash
git fetch origin
git switch main
git pull --ff-only
npm ci
npm run ci
npm --prefix server ci
npm --prefix server run ci
# take a backup here
docker compose build --pull atlas-server
docker compose up -d atlas-server
curl -fsS http://127.0.0.1:8787/healthz
```

Read the changelog and migration notes before replacing the container. Current
schema setup is idempotent, but future releases may introduce explicit migrations.

Keep the previous image and backup until acceptance succeeds.

## Rollback

Application-only rollback:

1. Redeploy the previous server image.
2. Keep the current database only if that server version understands it.
3. Run health and API acceptance.

Schema/data rollback:

1. Stop the server.
2. Restore the pre-upgrade backup.
3. Start the matching previous image.
4. Verify private and public paths.

Never point two active server instances at the same local SQLite file over a
network filesystem.

## Signup bootstrap

```bash
ATLAS_ALLOW_SIGNUP=1 docker compose up -d atlas-server
# register intended accounts through the app
ATLAS_ALLOW_SIGNUP=0 docker compose up -d atlas-server
```

Compose recreates the service with the new value. Confirm
`registrationOpen: false` in `/healthz`.

## TLS and CORS

The server speaks HTTP. A production reverse proxy terminates TLS:

```caddyfile
atlas-api.example.com {
    reverse_proxy 127.0.0.1:8787
}
```

Set:

```bash
ATLAS_CORS_ORIGINS=https://atlas-travel-editor.vercel.app
```

Use comma-separated exact origins when multiple frontends are intentional.
Wildcard CORS is for local development, not public operation.

## Incident priorities

1. Preserve the database and logs.
2. Stop writes if corruption or unintended public exposure is possible.
3. Revoke exposure by setting documents private, rotating slugs, closing signup,
   or taking the service private as appropriate.
4. Recover from a known-good image/backup.
5. Document timeline, affected data, and preventive changes.

Do not ask users to clear browser storage unless a verified client-cache defect
requires it; browser data may be their only local copy.
