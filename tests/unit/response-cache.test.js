import { describe, it, expect, beforeEach } from "vitest";
import {
  responseCacheKey,
  cacheGet,
  cacheSet,
  responseCacheStats,
  clearResponseCache,
} from "../../open-sse/services/responseCache.js";
import { getSaverStats, resetSaverStats } from "../../open-sse/services/saverStats.js";

describe("response cache", () => {
  beforeEach(() => {
    clearResponseCache();
    resetSaverStats();
  });

  it("miss then hit for the same exact request", () => {
    const key = responseCacheKey("openai", "gpt-5", { messages: [{ role: "user", content: "hi" }] });
    expect(cacheGet(key)).toBeNull();
    cacheSet(key, JSON.stringify({ ok: true }), 200, { ttlMs: 60_000 });
    const hit = cacheGet(key);
    expect(hit).not.toBeNull();
    expect(hit.status).toBe(200);
    expect(JSON.parse(hit.bodyJson)).toEqual({ ok: true });
  });

  it("different bodies produce different keys", () => {
    const a = responseCacheKey("openai", "gpt-5", { messages: [{ role: "user", content: "hi" }] });
    const b = responseCacheKey("openai", "gpt-5", { messages: [{ role: "user", content: "bye" }] });
    expect(a).not.toBe(b);
  });

  it("stream flag does not change the key", () => {
    const a = responseCacheKey("openai", "gpt-5", { messages: [{ role: "user", content: "hi" }], stream: false });
    const b = responseCacheKey("openai", "gpt-5", { messages: [{ role: "user", content: "hi" }], stream: true });
    expect(a).toBe(b);
  });

  it("provider or model differences change the key", () => {
    const base = { messages: [{ role: "user", content: "hi" }] };
    expect(responseCacheKey("openai", "gpt-5", base)).not.toBe(responseCacheKey("anthropic", "gpt-5", base));
    expect(responseCacheKey("openai", "gpt-5", base)).not.toBe(responseCacheKey("openai", "gpt-6", base));
  });

  it("expired entries are misses", async () => {
    const key = responseCacheKey("openai", "m", { messages: [] });
    cacheSet(key, "{}", 200, { ttlMs: 5 });
    await new Promise((r) => setTimeout(r, 20));
    expect(cacheGet(key)).toBeNull();
  });

  it("evicts beyond maxEntries (LRU)", () => {
    const keys = [];
    for (let i = 0; i < 5; i++) {
      const k = responseCacheKey("openai", `m${i}`, { i });
      keys.push(k);
      cacheSet(k, "{}", 200, { ttlMs: 60_000, maxEntries: 3 });
    }
    expect(responseCacheStats().entries).toBeLessThanOrEqual(3);
    expect(cacheGet(keys[0])).toBeNull(); // oldest evicted
    expect(cacheGet(keys[4])).not.toBeNull(); // newest kept
  });

  it("records hits in saver stats", () => {
    const key = responseCacheKey("openai", "m", { messages: [] });
    cacheSet(key, "{}", 200, { ttlMs: 60_000 });
    cacheGet(key);
    cacheGet(key);
    expect(getSaverStats().responseCacheHits).toBe(2);
  });

  it("refuses empty and oversized payloads", () => {
    const key = responseCacheKey("openai", "m", { messages: [] });
    cacheSet(key, "", 200, { ttlMs: 60_000 });
    cacheSet(key, "x".repeat(3 * 1024 * 1024), 200, { ttlMs: 60_000 });
    expect(cacheGet(key)).toBeNull();
  });
});
