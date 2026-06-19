/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_URL?: string;
  /** Optional Atlas Server (self-hostable sharing/social backend) instance URL. */
  readonly VITE_SELFHOST_URL?: string;
  /** Force pure local-first mode (no login wall) even if a backend URL is set. */
  readonly VITE_LOCAL_ONLY?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_DEMO_AUTH?: string;
  readonly VITE_DEMO_LOGIN?: string;
  readonly VITE_DEMO_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
