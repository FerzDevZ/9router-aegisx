import { describe, it, expect } from "vitest";
import { compressMessages } from "../../open-sse/rtk/index.js";
import { gcHistory } from "../../open-sse/rtk/historyGc.js";

function bigToolResult(seed = 1) {
  return Array.from({ length: 80 }, (_, i) => `old-${seed}-${i} ${"y".repeat(40)}`).join("\n");
}

// 8 user turns, each followed by a tool result; last 6 turns are protected.
function makeBody(keepTurns = 6) {
  const messages = [];
  for (let turn = 0; turn < 8; turn++) {
    messages.push({ role: "user", content: `turn ${turn}` });
    messages.push({
      role: "user",
      content: [{ type: "tool_result", content: [{ type: "text", text: bigToolResult(turn) }] }],
    });
  }
  return messages;
}

describe("rtk history GC", () => {
  it("squashes old tool results but keeps the last K user turns verbatim", () => {
    const items = makeBody();
    const stats = compressMessages({ messages: items }, { enabled: true, historyGc: true, historyGcKeepTurns: 6 });
    expect(stats.historyGc.hits).toBe(2); // turns 0 and 1 are older than the last 6

    const texts = items.map((m) => m.content?.[0]?.content?.[0]?.text ?? m.content?.[0]?.text).filter(Boolean);
    const squashed = texts.filter((t) => t.includes("squashed by history GC"));
    const verbatim = texts.filter((t) => t === bigToolResult(0) || t === bigToolResult(1));
    expect(squashed.length).toBe(2);
    expect(verbatim.length).toBe(0);
    // recent turns untouched
    expect(texts.filter((t) => t === bigToolResult(7)).length).toBe(1);
    expect(texts.filter((t) => t === bigToolResult(2)).length).toBe(1);
  });

  it("no-op when there are fewer user turns than keepTurns", () => {
    const items = [
      { role: "user", content: "hi" },
      { role: "user", content: [{ type: "tool_result", content: [{ type: "text", text: bigToolResult(9) }] }] },
    ];
    const stats = compressMessages({ messages: items }, { enabled: true, historyGc: true, historyGcKeepTurns: 6 });
    expect(stats?.historyGc).toBeUndefined(); // base stats may exist; GC must not have run
    expect(items[1].content[0].content[0].text).toBe(bigToolResult(9));
  });

  it("preserves is_error results even when old", () => {
    const items = [
      { role: "user", content: "old turn" },
      { role: "user", content: [{ type: "tool_result", is_error: true, content: bigToolResult(10) }] },
      ...Array.from({ length: 6 }, (_, i) => ({ role: "user", content: `recent ${i}` })),
    ];
    compressMessages({ messages: items }, { enabled: true, historyGc: true, historyGcKeepTurns: 6 });
    expect(items[1].content[0].content).toBe(bigToolResult(10));
  });

  it("skips small results", () => {
    const items = [
      { role: "user", content: "old" },
      { role: "tool", content: "small" },
      ...Array.from({ length: 6 }, (_, i) => ({ role: "user", content: `recent ${i}` })),
    ];
    const stats = compressMessages({ messages: items }, { enabled: true, historyGc: true });
    expect(stats?.historyGc).toBeUndefined();
    expect(items[1].content).toBe("small");
  });

  it("disabled by default (no historyGc option)", () => {
    const items = makeBody();
    compressMessages({ messages: items }, { enabled: true });
    const texts = items.map((m) => m.content?.[0]?.text).filter(Boolean);
    expect(texts.some((t) => t.includes("squashed by history GC"))).toBe(false);
  });

  it("digest contains fingerprint, size and re-run hint", () => {
    const items = makeBody();
    compressMessages({ messages: items }, { enabled: true, historyGc: true });
    const digest = items[1].content[0].content[0].text;
    expect(digest).toMatch(/old tool result/);
    expect(digest).toMatch(/fnv1a:[0-9a-f]{8}/);
    expect(digest).toMatch(/re-run the tool/);
    expect(digest.length).toBeLessThan(bigToolResult(0).length);
  });

  it("gcHistory standalone on empty array returns null", () => {
    expect(gcHistory([])).toBeNull();
  });
});
