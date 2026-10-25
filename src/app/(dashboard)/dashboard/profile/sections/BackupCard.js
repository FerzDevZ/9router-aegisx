"use client";

import { useState } from "react";
import { Card, Toggle, Button } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";

const fmtKB = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

export default function BackupCard({ settings, loading, onSettingsChange }) {
  const notify = useNotificationStore();
  const [running, setRunning] = useState(false);
  const backupEnabled = settings.backupEnabled === true;
  const intervalHours = settings.backupIntervalHours || 24;
  const keep = settings.backupKeep || 7;

  const patchSettings = async (patch) => {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) onSettingsChange(prev => ({ ...prev, ...patch }));
  };

  const updateEnabled = async (enabled) => {
    try {
      await patchSettings({ backupEnabled: enabled });
    } catch (err) {
      console.error("Failed to update backupEnabled:", err);
    }
  };

  const updateNumber = (key, value, min, max) => {
    const n = parseInt(value, 10);
    if (Number.isNaN(n) || n < min || n > max) return;
    patchSettings({ [key]: n }).catch((err) => console.error(`Failed to update ${key}:`, err));
  };

  const backupNow = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/settings/database/backup", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        notify.success(`Backup saved (${fmtKB(data.bytes)})${data.pruned ? ` · pruned ${data.pruned} old` : ""}`);
      } else {
        notify.error(data.error || "Backup failed");
      }
    } catch (err) {
      notify.error("Backup failed");
      console.error("Backup failed:", err);
    } finally {
      setRunning(false);
    }
  };

  const inputCls = "w-20 rounded-md border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none";

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-500 shrink-0">
          <span className="material-symbols-outlined text-[20px]">backup</span>
        </div>
        <h3 className="text-base sm:text-lg font-semibold">Scheduled Backups</h3>
      </div>
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm sm:text-base">Back up configuration</p>
          <p className="text-xs sm:text-sm text-text-muted">
            Providers, combos, settings and keys → <code className="font-mono">DATA_DIR/backups</code> (usage history excluded)
          </p>
        </div>
        <Toggle
          aria-label="Scheduled backups"
          checked={backupEnabled}
          onChange={updateEnabled}
          disabled={loading}
        />
      </div>
      {backupEnabled && (
        <div className="mt-3 flex flex-wrap items-end gap-4 border-t border-border pt-3">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Every (hours)
            <input
              type="number" min={1} max={720} defaultValue={intervalHours}
              onBlur={(e) => updateNumber("backupIntervalHours", e.target.value, 1, 720)}
              className={inputCls}
              aria-label="Backup interval in hours"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Keep (files)
            <input
              type="number" min={1} max={100} defaultValue={keep}
              onBlur={(e) => updateNumber("backupKeep", e.target.value, 1, 100)}
              className={inputCls}
              aria-label="Backups to keep"
            />
          </label>
          <Button size="sm" variant="secondary" onClick={backupNow} disabled={running}>
            {running ? "Backing up..." : "Back up now"}
          </Button>
        </div>
      )}
    </Card>
  );
}
