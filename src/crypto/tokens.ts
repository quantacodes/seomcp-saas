/**
 * AES-256-GCM encryption for Google OAuth tokens at rest.
 * 
 * Format: base64(iv):base64(ciphertext):base64(tag)
 * Each encryption uses a unique 12-byte IV.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { config } from "../config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;  // GCM standard IV size
const TAG_LENGTH = 16; // GCM auth tag size

/**
 * Get the encryption key from config (32 bytes / 64 hex chars).
 */
function getKey(): Buffer {
  const keyHex = config.tokenEncryptionKey;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypt a plaintext string.
 * Returns: "base64(iv):base64(ciphertext+tag)"
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);

  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  // Format: base64(iv):base64(ciphertext):base64(tag)
  return `${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

/**
 * Decrypt an encrypted token string.
 * Input format: "base64(iv):base64(ciphertext):base64(tag)"
 */
export function decryptToken(encrypted: string): string {
  const key = getKey();

  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format (expected iv:ciphertext:tag)");
  }

  const [ivB64, ciphertextB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const tag = Buffer.from(tagB64, "base64");

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: ${iv.length} (expected ${IV_LENGTH})`);
  }
  if (tag.length !== TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: ${tag.length} (expected ${TAG_LENGTH})`);
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf-8");
}
