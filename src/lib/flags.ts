/**
 * Helpers for the circular flag artwork vendored to `public/flags/<iso>.svg`
 * (HatScripts/circle-flags, derived from Wikimedia Commons). The PWA precaches
 * the SVG glob, so these assets resolve offline once the app has been visited.
 */

/**
 * URL of the circular flag SVG for an ISO 3166-1 alpha-2 `code`.
 *
 * We build it from `import.meta.env.BASE_URL` (not a leading-slash absolute
 * path) so it resolves correctly under GitHub Pages' `/atlas-travel-editor/`
 * base as well as a root-domain / self-host deploy at `/`.
 */
export function flagUrl(code: string): string {
  return `${import.meta.env.BASE_URL}flags/${code.toLowerCase()}.svg`;
}

/**
 * Whether `code` looks like a plausible ISO alpha-2 country code we may have a
 * flag for. This is a shape guard only — the real source of truth is the
 * vendored file set, so callers still rely on the `<img onError>` fallback for
 * the rare case a valid code has no asset.
 */
export function hasFlag(code: string | undefined | null): code is string {
  return !!code && /^[a-z]{2}$/i.test(code);
}
