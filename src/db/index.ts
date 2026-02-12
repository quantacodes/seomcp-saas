import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { config } from "../config";
import * as schema from "./schema";

// Ensure data directory exists
mkdirSync(dirname(config.databasePath), { recursive: true });

const sqlite = new Database(config.databasePath);

// Enable WAL mode for better concurrent read performance
sqlite.exec("PRAGMA journal_mode = WAL");
sqlite.exec("PRAGMA foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };
export { sqlite };
