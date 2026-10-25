import { NextResponse } from "next/server";
import { runBackupNow, pruneBackups } from "@/lib/db/backupScheduler.js";
import { getSettings } from "@/lib/localDb";

export const dynamic = "force-dynamic";

// POST /api/settings/database/backup — write a config backup immediately
// (same payload as the dashboard's DB export) into DATA_DIR/backups and apply
// retention. Runs regardless of backupEnabled so it doubles as "Back up now".
export async function POST() {
  try {
    const result = await runBackupNow();
    const settings = await getSettings();
    const removed = pruneBackups(settings.backupKeep);
    return NextResponse.json({
      success: true,
      file: result.file,
      bytes: result.bytes,
      pruned: removed.length,
    });
  } catch (error) {
    console.error("Backup failed:", error);
    return NextResponse.json({ error: error.message || "Backup failed" }, { status: 500 });
  }
}
