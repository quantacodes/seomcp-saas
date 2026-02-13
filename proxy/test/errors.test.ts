/**
 * @seomcp/proxy — Error handling tests
 */

import { describe, test, expect } from "bun:test";
import * as errors from "../src/errors.js";

describe("errors", () => {
  test("rpcError creates valid JSON-RPC error envelope", () => {
    const err = errors.rpcError(1, -32600, "bad request");
    expect(err).toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32600, message: "bad request" },
    });
  });

  test("rpcError includes data when provided", () => {
    const err = errors.rpcError(1, -32600, "bad", { detail: "foo" });
    expect(err).toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32600, message: "bad", data: { detail: "foo" } },
    });
  });

  test("rpcError handles null id", () => {
    const err = errors.rpcError(null, -32600, "bad");
    expect(err).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "bad" },
    });
  });

  test("invalidRequest", () => {
    const err = errors.invalidRequest(1) as any;
    expect(err.error.code).toBe(-32600);
    expect(err.error.message).toBe("Invalid JSON-RPC request");
  });

  test("invalidRequest with custom detail", () => {
    const err = errors.invalidRequest(1, "Missing method") as any;
    expect(err.error.message).toBe("Missing method");
  });

  test("methodNotFound", () => {
    const err = errors.methodNotFound(2, "foo/bar") as any;
    expect(err.error.code).toBe(-32601);
    expect(err.error.message).toBe("Unknown method: foo/bar");
  });

  test("missingCredentials", () => {
    const err = errors.missingCredentials(3) as any;
    expect(err.error.code).toBe(-32001);
    expect(err.error.message).toContain("GOOGLE_SERVICE_ACCOUNT");
  });

  test("invalidCredentials", () => {
    const err = errors.invalidCredentials(4, "private_key") as any;
    expect(err.error.code).toBe(-32002);
    expect(err.error.message).toContain("private_key");
  });

  test("apiKeyMissing", () => {
    const err = errors.apiKeyMissing(5) as any;
    expect(err.error.code).toBe(-32003);
    expect(err.error.message).toContain("SEOMCP_API_KEY");
  });

  test("apiKeyInvalid", () => {
    const err = errors.apiKeyInvalid(6) as any;
    expect(err.error.code).toBe(-32004);
    expect(err.error.message).toContain("Invalid API key");
  });

  test("rateLimited with remaining", () => {
    const err = errors.rateLimited(7, 42) as any;
    expect(err.error.code).toBe(-32005);
    expect(err.error.message).toContain("42");
    expect(err.error.message).toContain("seomcp.dev/pricing");
  });

  test("rateLimited without remaining", () => {
    const err = errors.rateLimited(7) as any;
    expect(err.error.code).toBe(-32005);
    expect(err.error.message).toContain("Rate limit exceeded");
  });

  test("cloudUnreachable", () => {
    const err = errors.cloudUnreachable(8) as any;
    expect(err.error.code).toBe(-32006);
    expect(err.error.message).toContain("api.seomcp.dev");
  });

  test("requestTimeout", () => {
    const err = errors.requestTimeout(9, 30000) as any;
    expect(err.error.code).toBe(-32007);
    expect(err.error.message).toContain("30000ms");
  });

  test("googleApiError", () => {
    const err = errors.googleApiError(10, "quota exceeded") as any;
    expect(err.error.code).toBe(-32008);
    expect(err.error.message).toContain("quota exceeded");
  });

  test("serverError", () => {
    const err = errors.serverError(11) as any;
    expect(err.error.code).toBe(-32009);
    expect(err.error.message).toContain("server error");
  });

  test("versionOutdated", () => {
    const err = errors.versionOutdated(12, "0.0.1") as any;
    expect(err.error.code).toBe(-32010);
    expect(err.error.message).toContain("0.0.1");
    expect(err.error.message).toContain("npm i -g @seomcp/proxy");
  });

  test("permissionDenied", () => {
    const err = errors.permissionDenied(
      13,
      "sc-domain:example.com",
      "bot@project.iam.gserviceaccount.com",
    ) as any;
    expect(err.error.code).toBe(-32011);
    expect(err.error.message).toContain("sc-domain:example.com");
    expect(err.error.message).toContain("bot@project.iam.gserviceaccount.com");
  });

  test("all error codes are unique", () => {
    const codes = [
      errors.PARSE_ERROR,
      errors.INVALID_REQUEST,
      errors.METHOD_NOT_FOUND,
      errors.INVALID_PARAMS,
      errors.MISSING_CREDENTIALS,
      errors.INVALID_CREDENTIALS,
      errors.API_KEY_MISSING,
      errors.API_KEY_INVALID,
      errors.RATE_LIMITED,
      errors.CLOUD_UNREACHABLE,
      errors.REQUEST_TIMEOUT,
      errors.GOOGLE_API_ERROR,
      errors.SERVER_ERROR,
      errors.VERSION_OUTDATED,
      errors.PERMISSION_DENIED,
    ];
    expect(new Set(codes).size).toBe(codes.length);
  });
});
