import { env } from '@/lib/env';

/**
 * Thin client for an Atlas Server instance (the self-hostable sharing/social
 * backend). It holds the configured instance URL and the opaque session token,
 * and exposes typed calls the auth provider and the SelfHostStore build on. The
 * app stays local-first: nothing here runs unless the user connects a server.
 */

const URL_KEY = 'atlas:url';
const TOKEN_KEY = 'atlas:token';

/** The configured instance base URL (user choice in localStorage, else env). */
export function getAtlasUrl(): string | null {
  try {
    const stored = localStorage.getItem(URL_KEY);
    if (stored) return stored;
  } catch {
    /* storage unavailable */
  }
  return env.selfHostUrl ?? null;
}

export function setAtlasUrl(url: string | null): void {
  try {
    if (url) localStorage.setItem(URL_KEY, url.replace(/\/+$/, ''));
    else localStorage.removeItem(URL_KEY);
  } catch {
    /* ignore */
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export interface AtlasUser {
  id: string;
  email: string;
  username: string;
}
export interface AtlasProfile {
  display_name: string;
  accent_color: string;
  handle: string | null;
}
export interface AtlasDocResponse {
  data: unknown;
  is_public: boolean;
  share_slug: string | null;
  version: number;
}

/** Low-level request helper: prefixes the base URL, attaches the Bearer token. */
async function req(path: string, init: RequestInit = {}): Promise<Response> {
  const base = getAtlasUrl();
  if (!base) throw new Error('No Atlas Server configured.');
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body !== undefined && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  return fetch(base.replace(/\/+$/, '') + path, { ...init, headers });
}

/** Parse a JSON error body into a message, falling back to the status text. */
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) return body.error;
  } catch {
    /* not JSON */
  }
  return `Request failed (${res.status})`;
}

export async function atlasHealth(): Promise<{
  ok: boolean;
  capabilities?: { sharing?: boolean; social?: boolean };
  registrationOpen?: boolean;
} | null> {
  try {
    const res = await req('/healthz');
    if (!res.ok) return null;
    return (await res.json()) as { ok: boolean };
  } catch {
    return null;
  }
}

export async function atlasRegister(
  email: string,
  username: string,
  password: string,
): Promise<AtlasUser> {
  const res = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, username, password }),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  const body = (await res.json()) as { token: string; user: AtlasUser };
  setToken(body.token);
  return body.user;
}

export async function atlasLogin(login: string, password: string): Promise<AtlasUser> {
  const res = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login, password }),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  const body = (await res.json()) as { token: string; user: AtlasUser };
  setToken(body.token);
  return body.user;
}

export async function atlasLogout(): Promise<void> {
  try {
    await req('/auth/logout', { method: 'POST' });
  } catch {
    /* best-effort; clear the local token regardless */
  }
  setToken(null);
}

/** Resolve the current session to its user + profile, or null if unauthenticated. */
export async function atlasMe(): Promise<{ user: AtlasUser; profile: AtlasProfile | null } | null> {
  try {
    const res = await req('/me');
    if (!res.ok) return null;
    return (await res.json()) as { user: AtlasUser; profile: AtlasProfile | null };
  } catch {
    return null;
  }
}

/** Load the signed-in user's document, or null if none exists yet. */
export async function atlasLoadDoc(): Promise<AtlasDocResponse | null> {
  const res = await req('/me/document');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as AtlasDocResponse;
}

export interface AtlasSaveResult {
  conflict: boolean;
  doc: AtlasDocResponse;
}

/** Save the document with optimistic concurrency; reports a conflict on 409. */
export async function atlasSaveDoc(
  data: unknown,
  expectedVersion: number | null,
): Promise<AtlasSaveResult> {
  const headers: Record<string, string> = {};
  if (expectedVersion !== null) headers['If-Match'] = String(expectedVersion);
  const res = await req('/me/document', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ data }),
  });
  if (res.status === 409) {
    const body = (await res.json()) as { remote: AtlasDocResponse };
    return { conflict: true, doc: body.remote };
  }
  if (!res.ok) throw new Error(await errorMessage(res));
  return { conflict: false, doc: (await res.json()) as AtlasDocResponse };
}

export type Visibility = 'private' | 'unlisted' | 'public';

/** Set the document's visibility (mints/keeps the share slug). */
export async function atlasSetVisibility(visibility: Visibility): Promise<AtlasDocResponse> {
  const res = await req('/me/document/visibility', {
    method: 'PATCH',
    body: JSON.stringify({ visibility }),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as AtlasDocResponse;
}

/** Rotate the share slug, revoking the previous link. */
export async function atlasRotateSlug(): Promise<AtlasDocResponse> {
  const res = await req('/me/document/rotate-slug', { method: 'POST' });
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as AtlasDocResponse;
}

export interface AtlasPublicView {
  data: unknown;
  profile: { display_name: string; accent_color: string; handle: string | null };
}

/** Read a publicly-shared map by its opaque slug, or null if not shared/found. */
export async function atlasGetPublic(slug: string): Promise<AtlasPublicView | null> {
  const res = await req(`/share/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as AtlasPublicView;
}

/** Read a publicly-discoverable map by its owner's handle, or null. */
export async function atlasGetPublicByHandle(handle: string): Promise<AtlasPublicView | null> {
  const res = await req(`/u/${encodeURIComponent(handle)}/map`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as AtlasPublicView;
}

/** Create or update the signed-in user's profile (name, color, handle). */
export async function atlasUpdateProfile(patch: {
  display_name?: string;
  accent_color?: string;
  handle?: string | null;
}): Promise<AtlasProfile> {
  const res = await req('/me/profile', { method: 'PUT', body: JSON.stringify(patch) });
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as AtlasProfile;
}

/** Whether a handle is free for the signed-in user to claim. */
export async function atlasHandleAvailable(handle: string): Promise<boolean> {
  const res = await req(`/handles/${encodeURIComponent(handle)}/available`);
  if (!res.ok) return false;
  return ((await res.json()) as { available: boolean }).available;
}

export interface AtlasFollow {
  handle: string | null;
  display_name: string;
  accent_color: string;
  share_slug: string | null;
  label: string | null;
}

/** The people the signed-in user follows, each with their public profile + slug. */
export async function atlasListFollows(): Promise<AtlasFollow[]> {
  const res = await req('/follows');
  if (!res.ok) return [];
  return (await res.json()) as AtlasFollow[];
}

/** Follow someone by handle and/or share slug (the server resolves the target). */
export async function atlasAddFollow(target: {
  handle?: string;
  slug?: string;
  label?: string;
}): Promise<AtlasFollow> {
  const res = await req('/follows', { method: 'POST', body: JSON.stringify(target) });
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as AtlasFollow;
}

/** Unfollow by handle. */
export async function atlasRemoveFollow(handle: string): Promise<void> {
  await req(`/follows/${encodeURIComponent(handle)}`, { method: 'DELETE' });
}
