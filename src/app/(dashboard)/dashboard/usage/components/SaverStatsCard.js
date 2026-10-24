"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/shared/components/Card";

// Live token-saver scoreboard backed by GET /api/usage/savers.
// Counters are process-wide and reset on server restart or via the Reset button.

const REFRESH_MS = 30_000;

const fmtInt = (n) => new Intl.NumberFormat().format(n || 0);
const fmtBytes = (n) => {
  if (!n || n <= 0) return "0 B";
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MiB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${n} B`;
};
const fmtUptime = (ms) => {
  const s = Math.floor((ms || 0) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

export default function SaverStatsCard() {
  const [stats, setStats] = useState(null);
  const [resetting, setResetting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/usage/savers");
      if (res.ok) setStats(await res.json());
    } catch {
      // keep last snapshot; a transient fetch must not blank the card
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(t);
  }, [fetchData]);

  const handleReset = async () => {
    setResetting(true);
    try {
      await fetch("/api/usage/savers", { method: "POST" });
      await fetchData();
    } catch {
      /* ignore */
    } finally {
      setResetting(false);
    }
  };

  if (!stats) return null;

  const rows = [
    { label: "Tool output filters (RTK)", value: `${fmtInt(stats.rtkHits)} hits · ${fmtBytes(stats.rtkBytesSaved)}` },
    { label: "Duplicate tool results", value: `${fmtInt(stats.dedupHits)} hits · ${fmtBytes(stats.dedupBytesSaved)}` },
    { label: "Old history squash (GC)", value: `${fmtInt(stats.gcHits)} hits · ${fmtBytes(stats.gcBytesSaved)}` },
    { label: "Headroom compression", value: fmtInt(stats.headroomHits) },
    { label: "System prompt savers", value: `${fmtInt(stats.cavemanHits + stats.ponytailHits + stats.customPromptHits)} requests` },
    { label: "Images compressed (PXPIPE)", value: fmtInt(stats.pxpipeImages) },
    {
      label: "Response cache",
      value: `${fmtInt(stats.responseCacheHits)} hits · ${fmtInt(stats.responseCache?.entries ?? 0)} entries`,
    },
  ];

  return (
    <Card className="flex min-w-0 flex-col gap-3 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">Token Saver Scoreboard</p>
          <p className="text-xs text-text-muted">
            Since server start ({fmtUptime(stats.uptimeMs)}) · {fmtBytes(stats.totalBytesSaved)} of tool output elided
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:bg-bg-hover hover:text-text"
            title="Refresh"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
          </button>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:bg-bg-hover hover:text-text disabled:opacity-50"
          >
            {resetting ? "Resetting…" : "Reset"}
          </button>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="flex min-w-0 items-baseline justify-between gap-2 border-t border-border pt-2">
            <span className="truncate text-xs text-text-muted" title={r.label}>{r.label}</span>
            <span className="shrink-0 text-sm font-medium">{r.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
