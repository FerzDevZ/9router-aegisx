import { NextResponse } from "next/server";
import { getSaverStats, resetSaverStats, totalBytesSaved } from "open-sse/services/saverStats.js";
import { responseCacheStats, clearResponseCache } from "open-sse/services/responseCache.js";

export const dynamic = "force-dynamic";

// Token-saver scoreboard: what RTK / dedup / history GC / headroom / caveman /
// pxpipe / response cache actually saved since process start (or last reset).
export async function GET() {
  try {
    const stats = getSaverStats();
    return NextResponse.json({ ...stats, totalBytesSaved: totalBytesSaved(), responseCache: responseCacheStats() });
  } catch (error) {
    console.error("[API] Failed to get saver stats:", error);
    return NextResponse.json({ error: "Failed to fetch saver stats" }, { status: 500 });
  }
}

export async function POST() {
  try {
    resetSaverStats();
    clearResponseCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[API] Failed to reset saver stats:", error);
    return NextResponse.json({ error: "Failed to reset saver stats" }, { status: 500 });
  }
}
