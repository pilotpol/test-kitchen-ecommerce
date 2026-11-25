/**
 * AES-GCM encryption for cookie values.
 *
 * Why AES-GCM (not AES-CBC or CryptoJS): Node.js native `crypto` module
 * provides authenticated encryption, preventing tampering. No npm dependency needed.
 *
 * Why encrypt cookies: HttpOnly cookies are safe from XSS, but their values
 * travel over the network. Encryption adds defense-in-depth — even if someone
 * intercepts the cookie, they cannot extract the Keycloak tokens.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard nonce length
const TAG_LENGTH = 16;
const SALT = "auth-bff-salt"; // Static salt — key derivation uses scrypt

/**
 * Derive a 32-byte key from the secret using scrypt.
 *
 * Why scrypt: converts a human-readable secret into a proper 256-bit key
 * suitable for AES-256. Using the secret directly would be insecure if
 * it's shorter than 32 bytes.
 */
function deriveKey(secret: string): Buffer {
  return scryptSync(secret, SALT, 32);
}

/** Encrypt plaintext → base64 string (IV + ciphertext + authTag) */
export function encrypt(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Pack: IV (12) + Tag (16) + Ciphertext (variable)
  const result = Buffer.concat([iv, tag, encrypted]);
  return result.toString("base64url"); // URL-safe for cookies
}

/** Decrypt base64url string → plaintext */
export function decrypt(ciphertext: string, secret: string): string {
  const key = deriveKey(secret);
  const data = Buffer.from(ciphertext, "base64url");

  if (data.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid ciphertext: too short");
  }

  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
