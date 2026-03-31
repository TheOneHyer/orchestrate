/**
 * Authentication utilities for the local preview sign-in flow.
 *
 * DEMO-ONLY: The hashing provided here is a lightweight client-side safeguard
 * for the preview/demo environment only. It must NOT be used as a substitute
 * for proper server-side authentication (e.g., bcrypt / Argon2 with a unique
 * per-user salt, transmitted over TLS). In production, all credential
 * verification must happen on the server, and passwords must never be stored
 * as plain text.
 */

/**
 * Hashes a password using SHA-256 via the Web Crypto API.
 *
 * DEMO-ONLY: SHA-256 without key-stretching is not suitable for production
 * password storage. Use bcrypt, Argon2, or PBKDF2 with a unique per-user salt
 * on the server before shipping.
 *
 * @param password - The plain-text password to hash.
 * @returns A hex-encoded SHA-256 digest of the password.
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Verifies a plain-text password against a stored SHA-256 hash.
 *
 * DEMO-ONLY: See {@link hashPassword} for production-readiness caveats.
 *
 * @param password - The plain-text password to verify.
 * @param storedHash - The previously stored SHA-256 hex hash to compare against.
 * @returns `true` if the password matches the stored hash, `false` otherwise.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash) {
    return false
  }
  const hash = await hashPassword(password)
  return hash === storedHash
}
