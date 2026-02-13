#!/usr/bin/env node

/**
 * @seomcp/proxy CLI entrypoint
 *
 * This script loads the bundled proxy from dist/index.js.
 * All logic lives in the TypeScript sources, compiled by `bun build`.
 */

import "../dist/index.js";
