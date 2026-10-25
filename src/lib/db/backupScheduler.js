import fs from "fs";
import path from "path";
import { DATA_DIR } from "@/lib/dataDir.js";

// Scheduled JSON backups of the SQLite-backed config (providers, combos,
// settings, keys...) into DATA_DIR/backups. Opt-in via the `backupEnabled`
// setting; `backupIntervalHours` (default 24) and `backupKeep` (default 7)
// tune the cadence and retention. Usage history is intentionally NOT included
// (exportDb is the config surface); copy the sqlite file for a full snapshot.
//
// Settings are re-read every cycle so dashboard changes apply without a
// restart; the poll floor (1h) keeps a bad interval value from hot-looping.

const MIN_POLL_MS = 60 * 60 * 1000;
const BACKUP_DIR = path.join(DATA_DIR, "backups");

const state = (global.__backupScheduler ??= { timer: null, running: false });

function timestampFile(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export async function runBackupNow() {
  const { exportDb } = await import("./index.js");
  const payload = await exportDb();
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `backup-${timestampFile(new Date())}.json`);
  fs.writeFileSync(file, JSON.stringify(payload), { mode: 0o600 });
  return { file, bytes: fs.statSync(file).size };
}

// Delete the oldest backups beyond the keep count. Returns removed paths.
export function pruneBackups(keep) {
  const keepN = Number.isFinite(Number(keep)) ? Math.max(1, Math.floor(Number(keep))) : 7;
  let entries;
  try {
    entries = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("backup-") && f.endsWith(".json"))
      .sort(); // timestamped names sort chronologically
  } catch {
    return [];
  }
  const excess = entries.length > keepN ? entries.slice(0, entries.length - keepN) : [];
  const removed = [];
  for (const name of excess) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, name));
      removed.push(name);
    } catch { /* best effort */ }
  }
  return removed;
}

async function readSettings() {
  try {
    const { getSettings } = await import("@/lib/localDb");
    return await getSettings();
  } catch {
    return {};
  }
}

async function cycle() {
  const settings = await readSettings();
  if (settings.backupEnabled !== true) return;
  try {
    const result = await runBackupNow();
    const removed = pruneBackups(settings.backupKeep);
    console.log(`[backup] saved ${path.basename(result.file)} (${result.bytes}B)${removed.length ? `, pruned ${removed.length}` : ""}`);
  } catch (e) {
    console.error("[backup] scheduled backup failed:", e?.message || e);
  }
}

function scheduleNext(delayMs) {
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(async () => {
    state.timer = null;
    await cycle();
    scheduleNext(delayMs);
  }, delayMs);
  state.timer.unref?.();
}

export function startBackupScheduler() {
  if (state.running) return;
  state.running = true;

  const intervalHours = Number(process.env.BACKUP_INTERVAL_HOURS);
  const pollMs = Number.isFinite(intervalHours) && intervalHours > 0
    ? Math.max(MIN_POLL_MS, intervalHours * 3600_000)
    : MIN_POLL_MS;

  // First cycle shortly after boot (covers "enabled while server was down"),
  // then on the fixed cadence.
  const boot = setTimeout(async () => {
    await cycle();
    scheduleNext(pollMs);
  }, 30_000);
  boot.unref?.();
  console.log(`[backup] scheduler armed (poll every ${Math.round(pollMs / 60000)}m, opt-in via backupEnabled)`);
}
