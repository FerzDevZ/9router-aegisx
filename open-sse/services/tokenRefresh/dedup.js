const REFRESH_RESULT_TTL_MS = 10_000;
const refreshDedupCache = new Map();

const MAX_DEDUP_ENTRIES = 64;
function sweepStaleRefreshEntries() {
  if (refreshDedupCache.size <= MAX_DEDUP_ENTRIES) return;
  const now = Date.now();
  for (const [k, v] of refreshDedupCache) {
    if (!v?.promise && v?.expiresAt && v.expiresAt <= now) refreshDedupCache.delete(k);
  }
}

export async function dedupRefresh(provider, oldToken, fn, log) {
  if (!oldToken) return fn();
  sweepStaleRefreshEntries();
  const key = `${provider}:${oldToken}`;
  const hit = refreshDedupCache.get(key);
  if (hit) {
    if (hit.promise) {
      log?.info?.("TOKEN_REFRESH", `Reusing in-flight refresh for ${provider}`);
      return hit.promise;
    }
    if (hit.expiresAt > Date.now()) {
      log?.info?.("TOKEN_REFRESH", `Reusing recent refresh result for ${provider}`);
      return hit.result;
    }
    refreshDedupCache.delete(key);
  }
  const promise = (async () => {
    try {
      const result = await fn();
      refreshDedupCache.set(key, { result, expiresAt: Date.now() + REFRESH_RESULT_TTL_MS });
      return result;
    } catch (err) {
      refreshDedupCache.delete(key);
      throw err;
    }
  })();
  refreshDedupCache.set(key, { promise });
  return promise;
}
