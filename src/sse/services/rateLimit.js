// Lightweight in-memory rate limiter for the /v1 inference path: token bucket
// per API key (or per client IP when keyless-local) plus a concurrency cap.
// Before this, one holder of a single valid key could fire unlimited parallel
// requests and burn every upstream account's quota. Process-local by design —
// the gateway is single-process (see auth.js selection mutex).

// globalThis: survive Next.js dev hot-reload
if (!globalThis._9rRateLimit) {
  globalThis._9rRateLimit = { buckets: new Map(), inflight: new Map() };
}
const rl = globalThis._9rRateLimit;

const DEFAULT_PER_MINUTE = 600; // 10 rps sustained — far above human/agentic use
const DEFAULT_CONCURRENCY = 64;
const BUCKET_WINDOW_MS = 60_000;
const MAX_BUCKETS = 10_000;

function pruneBuckets(now) {
  if (rl.buckets.size < MAX_BUCKETS) return;
  for (const [k, b] of rl.buckets) {
    if (now - b.updated > BUCKET_WINDOW_MS) rl.buckets.delete(k);
  }
}

/**
 * Check a request against the per-minute bucket.
 * @returns {{ allowed: boolean, retryAfterSec?: number }}
 */
export function checkRateLimit(identity, { perMinute = DEFAULT_PER_MINUTE } = {}) {
  if (!perMinute || perMinute <= 0) return { allowed: true };
  const now = Date.now();
  pruneBuckets(now);
  let b = rl.buckets.get(identity);
  if (!b || now - b.updated >= BUCKET_WINDOW_MS) {
    b = { tokens: perMinute, updated: now };
    rl.buckets.set(identity, b);
  }
  // Refill proportionally to elapsed time
  const refill = ((now - b.updated) / BUCKET_WINDOW_MS) * perMinute;
  b.tokens = Math.min(perMinute, b.tokens + refill);
  b.updated = now;
  if (b.tokens < 1) {
    const retryAfterSec = Math.max(1, Math.ceil(((1 - b.tokens) / perMinute) * BUCKET_WINDOW_MS / 1000));
    return { allowed: false, retryAfterSec };
  }
  b.tokens -= 1;
  return { allowed: true };
}

/**
 * Concurrency guard. Call begin() before dispatch, end() in a finally.
 * @returns {{ allowed: boolean, end: () => void }}
 */
export function beginConcurrency(identity, { concurrency = DEFAULT_CONCURRENCY } = {}) {
  if (!concurrency || concurrency <= 0) return { allowed: true, end: () => {} };
  const current = rl.inflight.get(identity) || 0;
  if (current >= concurrency) return { allowed: false, end: () => {} };
  rl.inflight.set(identity, current + 1);
  return {
    allowed: true,
    end: () => {
      const n = rl.inflight.get(identity) || 1;
      if (n <= 1) rl.inflight.delete(identity);
      else rl.inflight.set(identity, n - 1);
    },
  };
}

/** Test/ops helper. */
export function resetRateLimits() {
  rl.buckets.clear();
  rl.inflight.clear();
}
