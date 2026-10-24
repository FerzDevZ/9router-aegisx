// Process-wide token-saver statistics. Every saver pass in chatCore records
// what it saved here; /api/usage/savers surfaces the totals. Counters only —
// small, fixed shape, safe to keep for the process lifetime.
// Uses globalThis so Next.js dev hot-reload keeps the accumulator.

const EMPTY = () => ({
  startedAt: new Date().toISOString(),
  // RTK per-tool filters (git-diff, test-runner, …)
  rtkHits: 0,
  rtkBytesSaved: 0,
  // Exact-duplicate tool-result elision
  dedupHits: 0,
  dedupBytesSaved: 0,
  // Old-history squash
  gcHits: 0,
  gcBytesSaved: 0,
  // External compression proxy
  headroomHits: 0,
  // System-prompt savers
  cavemanHits: 0,
  ponytailHits: 0,
  customPromptHits: 0,
  // Image compression
  pxpipeImages: 0,
  // Exact-request response cache
  responseCacheHits: 0,
});

function store() {
  if (!globalThis._9rSaverStats) globalThis._9rSaverStats = EMPTY();
  return globalThis._9rSaverStats;
}

/**
 * Accumulate numeric deltas: bumpSaverStats({ rtkHits: 2, rtkBytesSaved: 1234 }).
 * Unknown keys are ignored; non-numeric values are ignored; never throws.
 */
export function bumpSaverStats(deltas) {
  if (!deltas || typeof deltas !== "object") return;
  const s = store();
  try {
    for (const [k, v] of Object.entries(deltas)) {
      if (!(k in s)) continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) continue;
      s[k] += n;
    }
  } catch { /* stats must never break requests */ }
}

/** Snapshot of the counters plus uptime. */
export function getSaverStats() {
  const s = store();
  return { ...s, uptimeMs: Date.now() - new Date(s.startedAt).getTime() };
}

/** Total bytes saved across all byte-accounting savers. */
export function totalBytesSaved() {
  const s = store();
  return s.rtkBytesSaved + s.dedupBytesSaved + s.gcBytesSaved;
}

/** Zero all counters (keeps a fresh startedAt). */
export function resetSaverStats() {
  globalThis._9rSaverStats = EMPTY();
}
