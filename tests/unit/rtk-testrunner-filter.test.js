import { describe, it, expect } from "vitest";
import { testRunner } from "../../open-sse/rtk/filters/testRunner.js";
import { autoDetectFilter } from "../../open-sse/rtk/autodetect.js";
import { safeApply } from "../../open-sse/rtk/applyFilter.js";

function vitestOutput(passes = 120, fails = 2) {
  const lines = [];
  for (let i = 0; i < passes; i++) lines.push(` ✓ src/lib/a${i}.test.js > works ${i} ${"-".repeat(30)}`);
  for (let i = 0; i < fails; i++) {
    lines.push(` × src/lib/fail${i}.test.js > broken ${i}`);
    lines.push(`  FailReason: expected 1 to be 2`);
    lines.push(`  at /repo/src/lib/fail${i}.test.js:10:15`);
  }
  lines.push("", " Test Files  8 passed (8)", "      Tests  120 passed | 2 failed (122)", "   Duration  3.21s");
  return lines.join("\n");
}

function pytestOutput() {
  const lines = ["============================= test session starts ============================="];
  lines.push("collected 60 items", "");
  lines.push("tests/test_a.py ..........");
  lines.push("[100%]");
  lines.push("=================================== FAILURES ===================================");
  lines.push("_______________________ test_register_invalid ______________________");
  lines.push("    def test_register_invalid():");
  lines.push("        assert register('x') == False");
  lines.push("E       AssertionError: assert True == False");
  lines.push("================================ 1 failed, 59 passed in 2.34s =================================");
  return lines.join("\n");
}

function goTestOutput() {
  const lines = [];
  for (let i = 0; i < 40; i++) lines.push(`--- PASS: TestOk${i} (0.00s)`);
  lines.push("--- FAIL: TestBroken (0.01s)");
  lines.push("    broken_test.go:12: got 1, want 2");
  lines.push("ok  	github.com/repo/pkg1	0.5s");
  lines.push("ok  	github.com/repo/pkg2	0.3s");
  lines.push("FAIL");
  return lines.join("\n");
}

function jestOutput() {
  const lines = [];
  for (let i = 0; i < 50; i++) lines.push(`PASS src/mod${i}.test.js (${i * 10 + 20}ms)`);
  lines.push("FAIL src/broken.test.js");
  lines.push("  ● Suite › failing case");
  lines.push("");
  lines.push("    expect(received).toBe(expected)");
  lines.push("");
  lines.push("Test Suites: 1 failed, 50 passed, 51 total");
  lines.push("Tests:       2 failed, 198 passed, 200 total");
  lines.push("Snapshots:   0 total");
  lines.push("Time:        4.2s");
  return lines.join("\n");
}

describe("test-runner filter", () => {
  it.each([
    ["vitest", vitestOutput()],
    ["pytest", pytestOutput()],
    ["go test", goTestOutput()],
    ["jest", jestOutput()],
  ])("compresses %s output: smaller, keeps failures and summary, never empty", (_name, input) => {
    const out = testRunner(input);
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThan(input.length);
  });

  it("keeps vitest failure details and the final summary", () => {
    const out = testRunner(vitestOutput());
    expect(out).toMatch(/Tests\s+120 passed \| 2 failed/);
    expect(out).toMatch(/× src\/lib\/fail0\.test\.js > broken 0/);
    expect(out).toMatch(/expected 1 to be 2/);
    expect(out).toMatch(/tests passing/); // pass wall elided to a count
  });

  it("keeps pytest assertion error lines", () => {
    const out = testRunner(pytestOutput());
    expect(out).toMatch(/AssertionError: assert True == False/);
    expect(out).toMatch(/1 failed, 59 passed/);
  });

  it("keeps go failing test excerpt and ok-package summary", () => {
    const out = testRunner(goTestOutput());
    expect(out).toMatch(/--- FAIL: TestBroken/);
    expect(out).toMatch(/got 1, want 2/);
    expect(out).toMatch(/^FAIL$/m);
    expect(out).not.toMatch(/--- PASS: TestOk5/); // passing wall elided
  });

  it("keeps jest summary counts", () => {
    const out = testRunner(jestOutput());
    expect(out).toMatch(/Tests:\s+2 failed, 198 passed/);
    expect(out).toMatch(/● Suite › failing case/);
  });

  it("autoDetectFilter picks test-runner for each runner flavor", () => {
    for (const input of [vitestOutput(), pytestOutput(), goTestOutput(), jestOutput()]) {
      const fn = autoDetectFilter(input);
      expect(fn?.filterName).toBe("test-runner");
    }
  });

  it("autodetect prefers test-runner over build-output for failed npm test", () => {
    const npmWrapped = [
      "> myapp@1.0.0 test",
      "> vitest run",
      "",
      ...vitestOutput().split("\n"),
      "npm ERR! Test failed.  See above for more details.",
    ].join("\n");
    const fn = autoDetectFilter(npmWrapped);
    expect(fn?.filterName).toBe("test-runner");
  });

  it("safeApply invariants hold (never empty, never grows)", () => {
    for (const input of [vitestOutput(), pytestOutput(), goTestOutput(), jestOutput()]) {
      const out = safeApply(testRunner, input);
      expect(out.length).toBeGreaterThan(0);
      expect(out.length).toBeLessThanOrEqual(input.length);
    }
  });

  it("returns input unchanged for tiny/garbage content", () => {
    expect(testRunner("hello world")).toBe("hello world");
  });
});
