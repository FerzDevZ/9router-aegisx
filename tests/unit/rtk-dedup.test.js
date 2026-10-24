import { describe, it, expect } from "vitest";
import { compressMessages, formatRtkLog } from "../../open-sse/rtk/index.js";
import { dedupToolResults, fnv1aHex } from "../../open-sse/rtk/dedup.js";

function bigPayload(seed = 1) {
  return Array.from({ length: 60 }, (_, i) => `line-${seed}-${i} ${"x".repeat(30)}`).join("\n");
}

describe("rtk dedup — exact duplicate tool results", () => {
  it("elides later openai role:tool duplicates, keeps the first verbatim", () => {
    const content = bigPayload();
    const items = [
      { role: "user", content: "run tests" },
      { role: "assistant", content: "calling" },
      { role: "tool", content },
      { role: "user", content: "again" },
      { role: "tool", content },
    ];
    const stats = compressMessages({ messages: items }, { enabled: true, dedup: true });
    expect(items[2].content).toBe(content); // first kept
    expect(items[4].content).toMatch(/duplicate of tool result #1/);
    expect(items[4].content.length).toBeLessThan(content.length);
    expect(stats.dedup.hits).toBe(1);
    expect(stats.dedup.bytesSaved).toBeGreaterThan(0);
  });

  it("elides claude tool_result array duplicates", () => {
    const content = bigPayload(2);
    const items = [
      { role: "user", content: [{ type: "tool_result", content: [{ type: "text", text: content }] }] },
      { role: "user", content: [{ type: "tool_result", content: [{ type: "text", text: content }] }] },
    ];
    compressMessages({ messages: items }, { enabled: true, dedup: true });
    expect(items[0].content[0].content[0].text).toBe(content);
    expect(items[1].content[0].content[0].text).toMatch(/duplicate of tool result #1/);
  });

  it("never touches is_error tool results", () => {
    const content = bigPayload(3);
    const items = [
      { role: "user", content: [{ type: "tool_result", is_error: true, content }] },
      { role: "user", content: [{ type: "tool_result", is_error: true, content }] },
    ];
    const stats = compressMessages({ messages: items }, { enabled: true, dedup: true });
    expect(items[0].content[0].content).toBe(content);
    expect(items[1].content[0].content).toBe(content);
    expect(stats?.dedup).toBeUndefined();
  });

  it("skips small duplicates (reference would cost as much)", () => {
    const items = [
      { role: "tool", content: "tiny" },
      { role: "tool", content: "tiny" },
    ];
    const stats = compressMessages({ messages: items }, { enabled: true, dedup: true });
    expect(items[1].content).toBe("tiny");
    expect(stats?.dedup).toBeUndefined();
  });

  it("dedups responses function_call_output strings", () => {
    const content = bigPayload(4);
    const items = [
      { type: "function_call_output", output: content },
      { type: "function_call_output", output: content },
    ];
    compressMessages({ input: items }, { enabled: true, dedup: true });
    expect(items[1].output).toMatch(/duplicate of tool result #1/);
  });

  it("different content is never deduped", () => {
    const items = [
      { role: "tool", content: bigPayload(5) },
      { role: "tool", content: bigPayload(6) },
    ];
    const stats = compressMessages({ messages: items }, { enabled: true, dedup: true });
    expect(items[1].content).toBe(bigPayload(6));
    expect(stats?.dedup).toBeUndefined();
  });

  it("dedup can be disabled via options", () => {
    const content = bigPayload(7);
    const items = [
      { role: "tool", content },
      { role: "tool", content },
    ];
    const stats = compressMessages({ messages: items }, { enabled: true, dedup: false });
    expect(items[1].content).toBe(content);
    expect(stats?.dedup).toBeUndefined();
  });

  it("boolean form still works (back-compat)", () => {
    const content = bigPayload(8);
    const items = [
      { role: "tool", content },
      { role: "tool", content },
    ];
    compressMessages({ messages: items }, true);
    expect(items[1].content).toMatch(/duplicate of tool result #1/);
  });

  it("formatRtkLog mentions dedup savings even without filter hits", () => {
    const stats = { bytesBefore: 0, bytesAfter: 0, hits: [], dedup: { hits: 2, bytesSaved: 4096 } };
    expect(formatRtkLog(stats)).toMatch(/dedup saved 4096B \(2x\)/);
  });

  it("fnv1aHex is stable and 8 hex chars", () => {
    expect(fnv1aHex("abc")).toBe(fnv1aHex("abc"));
    expect(fnv1aHex("abc")).toMatch(/^[0-9a-f]{8}$/);
    expect(fnv1aHex("abc")).not.toBe(fnv1aHex("abd"));
  });

  it("dedupToolResults returns null on empty input (fail-open)", () => {
    expect(dedupToolResults([])).toBeNull();
  });
});
