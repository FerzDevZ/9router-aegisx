import { describe, it, expect, beforeEach } from "vitest";
import { bumpSaverStats, getSaverStats, resetSaverStats, totalBytesSaved } from "../../open-sse/services/saverStats.js";

describe("saver stats", () => {
  beforeEach(() => resetSaverStats());

  it("accumulates numeric deltas", () => {
    bumpSaverStats({ rtkHits: 2, rtkBytesSaved: 1000 });
    bumpSaverStats({ rtkHits: 1, dedupHits: 3, dedupBytesSaved: 500 });
    const s = getSaverStats();
    expect(s.rtkHits).toBe(3);
    expect(s.rtkBytesSaved).toBe(1000);
    expect(s.dedupHits).toBe(3);
    expect(s.dedupBytesSaved).toBe(500);
    expect(totalBytesSaved()).toBe(1500);
  });

  it("ignores unknown keys, non-numeric and non-positive values, and garbage input", () => {
    bumpSaverStats({ nope: 5, rtkHits: "x", gcBytesSaved: -10, gcHits: 1.5 });
    bumpSaverStats(null);
    bumpSaverStats("junk");
    const s = getSaverStats();
    expect(s.rtkHits).toBe(0);
    expect(s.gcBytesSaved).toBe(0);
    expect(s.gcHits).toBe(1.5); // finite fractional values accumulate as-is
  });

  it("snapshot includes uptime and startedAt", () => {
    const s = getSaverStats();
    expect(s.startedAt).toBeTruthy();
    expect(s.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it("reset zeroes counters", () => {
    bumpSaverStats({ rtkHits: 5, rtkBytesSaved: 100 });
    resetSaverStats();
    const s = getSaverStats();
    expect(s.rtkHits).toBe(0);
    expect(s.rtkBytesSaved).toBe(0);
    expect(totalBytesSaved()).toBe(0);
  });
});
