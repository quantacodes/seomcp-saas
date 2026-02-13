/**
 * @seomcp/proxy — Credential validation tests
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readCredentials, validateApiKey } from "../src/credentials.js";

const TMP_DIR = join(import.meta.dir, ".tmp-cred-test");

function tmpFile(name: string, content: string): string {
  const path = join(TMP_DIR, name);
  writeFileSync(path, content, "utf-8");
  return path;
}

beforeEach(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(TMP_DIR)) {
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
});

const VALID_SA = {
  type: "service_account",
  project_id: "my-project",
  private_key_id: "key123",
  private_key: "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----\n",
  client_email: "bot@my-project.iam.gserviceaccount.com",
  client_id: "123456789",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
};

describe("readCredentials", () => {
  test("valid service account JSON passes", () => {
    const path = tmpFile("valid.json", JSON.stringify(VALID_SA));
    const result = readCredentials(path);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.credentials.client_email).toBe(
        "bot@my-project.iam.gserviceaccount.com",
      );
      expect(result.credentials.type).toBe("service_account");
      expect(result.credentials.project_id).toBe("my-project");
    }
  });

  test("undefined path returns missing error", () => {
    const result = readCredentials(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("missing");
    }
  });

  test("non-existent file returns missing error", () => {
    const result = readCredentials("/nonexistent/path/sa.json");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("missing");
    }
  });

  test("invalid JSON returns invalid error", () => {
    const path = tmpFile("bad.json", "not json{{{");
    const result = readCredentials(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid");
      expect(result.message).toContain("invalid JSON");
    }
  });

  test("array instead of object returns invalid", () => {
    const path = tmpFile("array.json", "[]");
    const result = readCredentials(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid");
      expect(result.message).toContain("expected an object");
    }
  });

  test("missing type field returns invalid with field name", () => {
    const sa = { ...VALID_SA };
    delete (sa as any).type;
    const path = tmpFile("no-type.json", JSON.stringify(sa));
    const result = readCredentials(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid");
      expect(result.field).toBe("type");
      expect(result.message).toContain("type");
    }
  });

  test("missing project_id returns invalid with field name", () => {
    const sa = { ...VALID_SA };
    delete (sa as any).project_id;
    const path = tmpFile("no-pid.json", JSON.stringify(sa));
    const result = readCredentials(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("project_id");
    }
  });

  test("missing private_key returns invalid with field name", () => {
    const sa = { ...VALID_SA };
    delete (sa as any).private_key;
    const path = tmpFile("no-pk.json", JSON.stringify(sa));
    const result = readCredentials(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("private_key");
    }
  });

  test("missing private_key_id returns invalid with field name", () => {
    const sa = { ...VALID_SA };
    delete (sa as any).private_key_id;
    const path = tmpFile("no-pkid.json", JSON.stringify(sa));
    const result = readCredentials(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("private_key_id");
    }
  });

  test("missing client_email returns invalid with field name", () => {
    const sa = { ...VALID_SA };
    delete (sa as any).client_email;
    const path = tmpFile("no-email.json", JSON.stringify(sa));
    const result = readCredentials(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("client_email");
    }
  });

  test("empty string field returns invalid", () => {
    const sa = { ...VALID_SA, client_email: "" };
    const path = tmpFile("empty-email.json", JSON.stringify(sa));
    const result = readCredentials(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("client_email");
    }
  });

  test("extra fields are preserved", () => {
    const sa = { ...VALID_SA, custom_field: "hello" };
    const path = tmpFile("extra.json", JSON.stringify(sa));
    const result = readCredentials(path);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.credentials.custom_field).toBe("hello");
    }
  });
});

describe("validateApiKey", () => {
  test("valid key passes", () => {
    const err = validateApiKey("sk_live_REDACTED");
    expect(err).toBeNull();
  });

  test("undefined key fails", () => {
    const err = validateApiKey(undefined);
    expect(err).not.toBeNull();
    expect(err).toContain("SEOMCP_API_KEY not set");
  });

  test("empty string fails", () => {
    const err = validateApiKey("");
    expect(err).not.toBeNull();
  });

  test("wrong prefix fails", () => {
    const err = validateApiKey("sk_test_REDACTED");
    expect(err).not.toBeNull();
    expect(err).toContain("format invalid");
  });

  test("too short fails", () => {
    const err = validateApiKey("sk_live_REDACTED");
    expect(err).not.toBeNull();
  });

  test("too long fails", () => {
    const err = validateApiKey(
      "sk_live_REDACTED",
    );
    expect(err).not.toBeNull();
  });

  test("uppercase hex fails", () => {
    const err = validateApiKey("sk_live_REDACTED");
    expect(err).not.toBeNull();
  });

  test("non-hex characters fail", () => {
    const err = validateApiKey("sk_live_REDACTED");
    expect(err).not.toBeNull();
  });
});
