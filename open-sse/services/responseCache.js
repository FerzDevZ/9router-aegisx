// Exact-request response cache for non-streaming chat (opt-in via
// settings.responseCacheEnabled). Agentic traffic retries the identical
// request surprisingly often (client-side retries, scripted prompts) — a
// byte-identical body deserves a byte-identical answer at zero token cost.
// In-memory LRU + TTL; intentionally NOT persisted (a restart is a fine
// cache flush). Only JSON, non-stream responses are stored.

import { bumpSaverStats } from "./saverStats.js";

// globalThis: survive Next.js dev hot-reload.
if (!globalThis._9rResponseCache) {
  globalThis._9rResponseCache = { map: new Map(), hits: 0, misses: 0, evictions: 0 };
}
const cache = globalThis._9rResponseCache;

const DEFAULT_TTL_MS = 60 * 60 * 1000;      // 1 hour
const DEFAULT_MAX_ENTRIES = 100;

// FNV-1a over the stringified body — display/diagnostic only; the stored
// key itself is the full canonical string, so collisions cannot alias entries.
function fnv1aHex(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Stable cache key for a client request. `stream` is excluded on purpose —
 * the caller only caches non-stream requests anyway, and stripping it lets
 * a stream:true retry of the same prompt hit the entry.
 */
export function responseCacheKey(provider, model, body) {
  const { stream, ...rest } = body || {};
  return `${provider}/${model}:${fnv1aHex(JSON.stringify(rest))}`;
}

function purge(maxEntries) {
  const now = Date.now();
  for (const [k, v] of cache.map) {
    if (now - v.createdAt > v.ttlMs) { cache.map.delete(k); cache.evictions++; }
  }
  while (cache.map.size > maxEntries) {
    const oldest = cache.map.keys().next().value; // Map preserves insertion order
    cache.map.delete(oldest);
    cache.evictions++;
  }
}

/**
 * Look up a cached response.
 * @returns {{ bodyJson: string, status: number } | null}
 */
export function cacheGet(key, { ttlMs = DEFAULT_TTL_MS, maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
  const hit = cache.map.get(key);
  if (!hit) { cache.misses++; return null; }
  if (Date.now() - hit.createdAt > (hit.ttlMs || ttlMs)) {
    cache.map.delete(key);
    cache.evictions++;
    cache.misses++;
    return null;
  }
  // LRU refresh: re-insert so recently used entries survive eviction.
  cache.map.delete(key);
  cache.map.set(key, hit);
  cache.hits++;
  bumpSaverStats({ responseCacheHits: 1 });
  return { bodyJson: hit.bodyJson, status: hit.status };
}

/**
 * Store a response body (serialized JSON string).
 */
export function cacheSet(key, bodyJson, status, { ttlMs = DEFAULT_TTL_MS, maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
  if (typeof bodyJson !== "string" || bodyJson.length === 0) return;
  if (bodyJson.length > 2 * 1024 * 1024) return; // don't pin huge payloads in RAM
  cache.map.delete(key);
  cache.map.set(key, { bodyJson, status, createdAt: Date.now(), ttlMs });
  purge(maxEntries);
}

/** Diagnostics for /api/usage/savers. */
export function responseCacheStats() {
  return {
    entries: cache.map.size,
    hits: cache.hits,
    misses: cache.misses,
    evictions: cache.evictions,
  };
}

/** Test/ops helper. */
export function clearResponseCache() {
  cache.map.clear();
}
