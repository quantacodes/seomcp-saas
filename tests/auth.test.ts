import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { generateApiKey, hashApiKey, isValidKeyFormat } from "../src/auth/keys";

describe("API Key Generation", () => {
  it("generates keys with correct format", () => {
    const { raw, hash, prefix } = generateApiKey();
    
    expect(raw).toStartWith("sk_live_");
    expect(raw).toHaveLength(56); // 8 prefix + 48 hex
    expect(prefix).toHaveLength(16);
    expect(prefix).toStartWith("sk_live_");
    expect(hash).toHaveLength(64); // SHA-256 hex
  });

  it("generates unique keys each time", () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    
    expect(key1.raw).not.toBe(key2.raw);
    expect(key1.hash).not.toBe(key2.hash);
  });

  it("hashing is deterministic", () => {
    const { raw } = generateApiKey();
    const hash1 = hashApiKey(raw);
    const hash2 = hashApiKey(raw);
    
    expect(hash1).toBe(hash2);
  });

  it("validates key format correctly", () => {
    expect(isValidKeyFormat("sk_live_REDACTED")).toBe(true);
    expect(isValidKeyFormat("sk_test_REDACTED")).toBe(false);
    expect(isValidKeyFormat("invalid")).toBe(false);
    expect(isValidKeyFormat("")).toBe(false);
    expect(isValidKeyFormat("sk_live_REDACTED")).toBe(false);
  });
});
