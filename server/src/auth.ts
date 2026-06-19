import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Authentication primitives. Passwords are hashed with Node's built-in scrypt
 * (no native dependency); session tokens are opaque random strings stored only as
 * a SHA-256 hash, so a database leak never yields a usable token. The plaintext
 * token is returned to the client once and sent back as a Bearer credential.
 */

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const dk = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('base64')}$${dk.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1]!, 'base64');
  const expected = Buffer.from(parts[2]!, 'base64');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** A fresh opaque session token (the plaintext shown to the client once). */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** The at-rest form of a token (what we store / look up by). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** An opaque, URL-safe share slug for a published document. */
export function newSlug(): string {
  return randomBytes(9).toString('base64url');
}

/** A stable-ish unique id (no external uuid dependency needed). */
export function newId(): string {
  return randomBytes(16).toString('hex');
}
