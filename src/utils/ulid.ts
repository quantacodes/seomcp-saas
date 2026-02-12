import { randomBytes } from "crypto";

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford Base32

/**
 * Generate a ULID using crypto-safe randomness.
 * Format: 10 char timestamp + 16 char random = 26 chars
 */
export function ulid(): string {
  const now = Date.now();

  // Timestamp component (10 chars, millisecond precision)
  let ts = "";
  let t = now;
  for (let i = 9; i >= 0; i--) {
    ts = ENCODING[t % 32] + ts;
    t = Math.floor(t / 32);
  }

  // Random component (16 chars, crypto-safe)
  const bytes = randomBytes(10);
  let rand = "";
  for (let i = 0; i < 10; i++) {
    rand += ENCODING[bytes[i] % 32];
    if (rand.length >= 16) break;
  }
  // Pad to 16 with more random
  while (rand.length < 16) {
    rand += ENCODING[randomBytes(1)[0] % 32];
  }

  return ts + rand;
}
