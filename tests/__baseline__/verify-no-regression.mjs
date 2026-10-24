// Gate: so kết quả test hiện tại với baseline known-fails.
// PASS nếu KHÔNG có test nào pass(baseline) → fail(now). Test mới được phép.
// Usage: node tests/__baseline__/verify-no-regression.mjs <current-results.json>
import { readFileSync } from "fs";

const knownFails = new Set(
  readFileSync(new URL("./known-fails.txt", import.meta.url), "utf8")
    .split("\n").map(s => s.trim()).filter(Boolean)
);

const resultsPath = process.argv[2];
if (!resultsPath) { console.error("Missing results.json path"); process.exit(2); }

const r = JSON.parse(readFileSync(resultsPath, "utf8"));
// Normalize on both sides: the committed baseline was recorded under an
// ".../router4/app/tests/..." path, but the suite runs from any checkout dir.
// Everything after the first "tests/" segment is stable across machines.
const norm = (p) => {
  const i = p.indexOf("tests/");
  return i === -1 ? p : p.slice(i);
};
const nowFails = r.testResults.flatMap(f =>
  f.assertionResults.filter(a => a.status === "failed")
    .map(a => norm(f.name) + " :: " + a.fullName)
);
const knownNorm = new Set([...knownFails].map(k => {
  // known-fails keys may still carry the legacy prefix — normalize them too
  const m = k.match(/(?:^|\/)tests\//);
  return m ? k.slice(k.indexOf("tests/")) : k;
}));

// Regression = fail bây giờ NHƯNG không có trong baseline known-fails
const regressions = nowFails.filter(f => !knownNorm.has(f));

if (regressions.length) {
  console.error(`\n❌ REGRESSION: ${regressions.length} test pass→fail:\n`);
  regressions.forEach(f => console.error("  - " + f));
  process.exit(1);
}
console.log(`✅ No regression. (now fails=${nowFails.length}, baseline known=${knownNorm.size}, all known)`);
