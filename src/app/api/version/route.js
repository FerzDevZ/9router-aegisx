import https from "https";
import pkg from "../../../../package.json" with { type: "json" };

// AegisX release channel: the fork's GitHub Releases (it is NOT on npm —
// comparing against the npm `9router` package would flag upstream releases
// and push users toward an install that replaces the fork with upstream).
const RELEASES_API = "https://api.github.com/repos/FerzDevZ/9router-aegisx/releases/latest";
const RELEASES_URL = "https://github.com/FerzDevZ/9router-aegisx/releases";
const VERSION_CACHE_TTL_MS = 3600000; // cache the release lookup for 1h

// Survive hot reload; one cache per process
const versionCache = (global.__releaseVersionCache ??= { value: null, fetchedAt: 0 });

// Fetch the fork's latest release tag from the GitHub API
function fetchLatestReleaseTag() {
  return new Promise((resolve) => {
    const req = https.get(
      RELEASES_API,
      {
        timeout: 4000,
        headers: {
          "User-Agent": "9router-aegisx-version-check",
          Accept: "application/vnd.github+json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data).tag_name || null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

function normalizeVersion(tag) {
  return typeof tag === "string" ? tag.replace(/^v/, "").trim() : null;
}

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

async function getLatestVersionCached() {
  if (versionCache.value && Date.now() - versionCache.fetchedAt < VERSION_CACHE_TTL_MS) {
    return versionCache.value;
  }
  const latest = normalizeVersion(await fetchLatestReleaseTag());
  if (latest) {
    versionCache.value = latest;
    versionCache.fetchedAt = Date.now();
  }
  return latest;
}

export async function GET() {
  const latestVersion = await getLatestVersionCached();
  const currentVersion = pkg.version;
  const hasUpdate = latestVersion ? compareVersions(latestVersion, currentVersion) > 0 : false;

  return Response.json({
    currentVersion,
    latestVersion,
    hasUpdate,
    updateChannel: "github-releases",
    releaseUrl: RELEASES_URL,
  });
}
