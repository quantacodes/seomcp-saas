/**
 * @seomcp/proxy — Version management
 *
 * Reads version from package.json at build time (embedded by bundler).
 * Handles version comparison and update checks.
 */

/** Package version — replaced at build time by bun build */
export const VERSION = "0.1.0";

/** Compare two semver strings. Returns -1, 0, or 1. */
export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

/** State tracked across the process lifetime */
let forceUpdate = false;
let minVersion: string | null = null;

export function setVersionState(headers: {
  minVersion?: string;
  forceUpdate?: boolean;
}) {
  if (headers.minVersion) minVersion = headers.minVersion;
  if (headers.forceUpdate !== undefined) forceUpdate = headers.forceUpdate;
}

export function isForceUpdate(): boolean {
  return forceUpdate;
}

export function getMinVersion(): string | null {
  return minVersion;
}

/**
 * Check version headers from cloud response.
 * Prints warning to stderr if outdated.
 * Sets forceUpdate flag if cloud demands it.
 */
export function checkVersionHeaders(headers: Record<string, string>): void {
  const min = headers["x-min-version"];
  const force = headers["x-force-update"];

  if (min) {
    setVersionState({ minVersion: min });
    if (compareSemver(VERSION, min) < 0) {
      process.stderr.write(
        `⚠️  seomcp-proxy ${VERSION} is outdated (minimum: ${min}). Run: npm i -g @seomcp/proxy\n`,
      );
    }
  }

  if (force === "true") {
    setVersionState({ forceUpdate: true });
    process.stderr.write(
      `🚫 seomcp-proxy ${VERSION} is no longer supported. Run: npm i -g @seomcp/proxy\n`,
    );
  }
}
