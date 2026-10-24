// Compress test-runner output (vitest, jest, pytest, go test, mocha, TAP).
// Keeps: failing tests with a bounded excerpt, error/assertion lines, final
// summary. Strips: the long list of passing tests and suite scaffolding —
// a green wall of ✓ is exactly what an agent does not need verbatim.

const MAX_FAILURES = 10;
const FAILURE_EXCERPT_LINES = 6;   // lines kept after a failure marker
const MAX_ERR_CONTEXT = 3;

// vitest/mocha pass/fail marks may be indented; go uses "ok"/"not ok", jest "PASS"/"FAIL".
const RE_PASS_MARK = /^(?:\s*)[✔✓√]\s|^PASS\s+\S|^ok\s+\S|^--- PASS:|^# (?:pass|testsuite)\b/i;
const RE_FAIL_MARK = /^(?:\s*)[✗×✘]\s|^FAIL\s+\S|^--- FAIL:|^not ok\b|^●|^# fail\b/i;
// mocha/jest numbered failure list: "1) Suite name test name"
const RE_NUMBERED_FAIL = /^\d+\)\s\S/;
// pytest failure section header: "_____ test_name _____"
const RE_PYTEST_HEADER = /^_{3,}.+_{3,}$/;
// Lines that belong to a failure excerpt (pytest "E ...", assertion dumps…)
const RE_ERR_LINE = /^\s*(E\s{1,3}\S|AssertionError|Error:|Expect(ed|ed by)?|Received|at\s+\S+\s+\()/;
// Summary lines worth keeping verbatim (vitest uses "Tests  3 passed", jest "Tests:")
const RE_SUMMARY =
  /^(Test Files|Test Suites|Tests|Snapshots|Time|Duration)[:\s]|^\s*\d+\s+(passing|failing|pending)|^(OK|FAILED)\b|^\s*\d+\s+tests?\s+(passed|failed)|^Ran \d+ tests?|^=+.*\d+ (passed|failed)|^FAIL(\t|\s|$)|^# tests\b|^# (fail|pass)\b/;

export function testRunner(input) {
  const lines = input.split("\n");
  const summary = [];
  const failures = [];
  let passCount = 0;
  let suiteCount = 0;
  let pending = 0; // remaining lines to copy verbatim into the current failure excerpt

  for (const line of lines) {
    const trimmed = line.trim();

    // Inside a failure excerpt — copy until the budget runs out
    if (pending > 0) {
      failures.push(line);
      pending--;
      continue;
    }

    if (!trimmed) continue;

    if (RE_PASS_MARK.test(trimmed)) {
      // "ok  pkg" / "PASS file" are suite-level; ✓/✔ are test-level
      if (/^(ok|PASS)\s|^(--- PASS:|# testsuite)/i.test(trimmed)) suiteCount++;
      else passCount++;
      continue;
    }

    if (RE_FAIL_MARK.test(trimmed) || RE_NUMBERED_FAIL.test(trimmed) || RE_PYTEST_HEADER.test(trimmed)) {
      if (failures.length < MAX_FAILURES * FAILURE_EXCERPT_LINES) {
        failures.push(line);
        pending = FAILURE_EXCERPT_LINES;
      }
      continue;
    }

    // Errors outside a marked failure (assertion dumps, stack heads)
    if (RE_ERR_LINE.test(line)) {
      if (failures.length < MAX_FAILURES * FAILURE_EXCERPT_LINES + MAX_ERR_CONTEXT) {
        failures.push(line);
        pending = 2;
      }
      continue;
    }

    if (RE_SUMMARY.test(trimmed)) {
      summary.push(line);
      continue;
    }
  }

  let result = "";
  if (passCount > 0 || suiteCount > 0) {
    const parts = [];
    if (passCount > 0) parts.push(`${passCount} tests passing`);
    if (suiteCount > 0) parts.push(`${suiteCount} suites/packages ok`);
    result += `[${parts.join(", ")} — pass details elided by test-runner filter]\n`;
  }
  for (const f of failures) result += `${f}\n`;
  if (failures.length >= MAX_FAILURES * FAILURE_EXCERPT_LINES) {
    result += `... more failure output truncated\n`;
  }
  for (const s of summary) result += `${s}\n`;

  result = result.replace(/\n+$/, "");
  return result || input;
}

testRunner.filterName = "test-runner";
