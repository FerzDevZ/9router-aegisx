#!/usr/bin/env node
// Flip token-saver settings directly in the local 9Router SQLite DB — the
// dashboard equivalent of toggling them by hand, but scriptable.
//
//   node scripts/enable-token-savers.mjs                 # safe set (see below)
//   node scripts/enable-token-savers.mjs --response-cache  # + exact-request cache
//   node scripts/enable-token-savers.mjs --smart-combo     # + global combo strategy "smart"
//   node scripts/enable-token-savers.mjs --revert          # back to defaults
//   node scripts/enable-token-savers.mjs --dry-run
//
// Safe set (default): rtkEnabled, rtkDedupEnabled, historyGcEnabled.
// NOT touched by default: headroom (needs a running compression service),
// caveman/ponytail (changes model output style), pxpipe (needs install).
//
// Stop the server before running, or restart it afterwards — settings are
// read per request, but a restart guarantees a clean slate.

import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const REVERT = args.has("--revert");
const RESPONSE_CACHE = args.has("--response-cache");
const SMART_COMBO = args.has("--smart-combo");

const DATA_DIR = process.env.DATA_DIR || path.join(os.homedir(), ".9router");
const DB_FILE = path.join(DATA_DIR, "db", "data.sqlite");

if (!fs.existsSync(DB_FILE)) {
  console.error(`DB not found: ${DB_FILE}`);
  console.error("Start the 9Router server once to initialize it, or set DATA_DIR.");
  process.exit(1);
}

function openDb() {
  // Prefer the built-in node:sqlite (Node >= 22.5); fall back to the optional
  // better-sqlite3 dependency from the repo's node_modules.
  const [maj, min] = process.versions.node.split(".").map(Number);
  if (!process.versions.bun && (maj > 22 || (maj === 22 && min >= 5))) {
    const { DatabaseSync } = require("node:sqlite");
    return new DatabaseSync(DB_FILE);
  }
  const better = path.join(process.cwd(), "node_modules", "better-sqlite3");
  try {
    const mod = require(better);
    return new mod(DB_FILE);
  } catch {
    console.error("No SQLite driver available (need Node >= 22.5 or better-sqlite3 installed).");
    process.exit(1);
  }
}

const db = openDb();
const row = db.prepare("SELECT data FROM settings WHERE id = 1").get();
if (!row) {
  console.error("Settings row missing — start the server once to initialize the DB.");
  process.exit(1);
}

const settings = JSON.parse(row.data);

const changes = REVERT
  ? { rtkEnabled: true, rtkDedupEnabled: true, historyGcEnabled: false, responseCacheEnabled: false }
  : {
      rtkEnabled: true,
      rtkDedupEnabled: true,
      historyGcEnabled: true,
      ...(RESPONSE_CACHE ? { responseCacheEnabled: true } : {}),
      ...(SMART_COMBO ? { comboStrategy: "smart" } : {}),
    };

console.log(`DB: ${DB_FILE}`);
for (const [k, v] of Object.entries(changes)) {
  const before = settings[k];
  if (before === v) { console.log(`  = ${k}: ${JSON.stringify(v)} (unchanged)`); continue; }
  console.log(`  ${DRY_RUN ? "(dry)" : ""} ${k}: ${JSON.stringify(before)} → ${JSON.stringify(v)}`);
  settings[k] = v;
}

if (!DRY_RUN) {
  db.prepare("UPDATE settings SET data = ? WHERE id = 1").run(JSON.stringify(settings));
  console.log("Saved.");
} else {
  console.log("Dry run — nothing written.");
}
db.close();
