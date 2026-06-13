/**
 * Shown in place of the app when required environment variables are missing or
 * invalid (see lib/env). Vite embeds `VITE_*` vars at build time, so the fix is
 * to set them in the host (e.g. Vercel) and re-deploy. This screen turns an
 * otherwise blank white page into an actionable message.
 */
export function ConfigError({ detail }: { detail: string }) {
  return (
    <div className="error-screen" role="alert">
      <h1>Configuration error</h1>
      <p className="helper">
        The app can’t reach its backend because some build-time environment variables are missing or
        invalid:
      </p>
      <pre className="config-error-detail">{detail}</pre>
      <p className="helper">
        Set these <code>VITE_*</code> variables in your hosting provider (e.g. Vercel → Project →
        Settings → Environment Variables) and trigger a new deployment — Vite embeds them at build
        time, so a redeploy is required after changing them.
      </p>
    </div>
  );
}
