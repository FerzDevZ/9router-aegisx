import { NextResponse } from "next/server";

// AegisX refuses in-app npm self-updates. The fork is not published to npm:
// `npm i -g 9router@latest` (what the legacy updater ran) installs the
// UPSTREAM package and silently replaces this fork — wiping its hardening.
// Updates come from the fork's GitHub Releases via git pull + rebuild.
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      code: "FORK_CHANNEL",
      message:
        "AegisX does not self-update via npm — that would install upstream 9router and wipe the fork. " +
        "Update from source instead: git pull && npm install && npm run build, then restart the server. " +
        "See the Releases page for tagged versions.",
      releaseUrl: "https://github.com/FerzDevZ/9router-aegisx/releases",
    },
    { status: 400 }
  );
}
