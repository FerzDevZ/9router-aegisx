// #1998 — Headroom compression treated a Codex (openai-responses) body.input
// array as OpenAI messages: it sent Responses items to /v1/compress and then
// assigned the returned OpenAI messages back to body.input, violating the
// Responses format contract. body.input must stay Responses-shaped.
import { describe, it, expect, vi, afterEach } from "vitest";
import { compressWithHeadroom } from "../../open-sse/rtk/headroom.js";

describe("compressWithHeadroom openai-responses format (#1998)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps body.input in Responses format after compressing an openai-responses request", async () => {
    // Headroom always returns compressed OpenAI-style messages.
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        messages: [{ role: "user", content: "compressed text" }],
        tokens_before: 100,
        tokens_after: 90,
        tokens_saved: 10,
      }),
    }));

    const body = {
      input: [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "a long original message ".repeat(20) }],
        },
      ],
    };

    const data = await compressWithHeadroom(body, {
      enabled: true,
      url: "http://headroom.test",
      model: "gpt-5",
      format: "openai-responses",
    });

    expect(data).not.toBeNull();
    // body.input must remain Responses items (type:"message" + content array),
    // NOT the raw OpenAI messages ({ role, content: "<string>" }) the bug produced.
    expect(Array.isArray(body.input)).toBe(true);
    expect(body.input[0]).toMatchObject({ type: "message", role: "user" });
    expect(Array.isArray(body.input[0].content)).toBe(true);
    expect(typeof body.input[0].content).not.toBe("string");
  });

  it("Responses reasoning-only history is never compressed (#2132)", async () => {
    // Non-message items route headroom to the tool-output-only lane: with no
    // plain-text function_call_output present there is nothing safe to
    // compress, so the whole body is left untouched.
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        messages: [{ role: "user", content: "compressed reasoning history" }],
        tokens_saved: 10,
      }),
    }));

    const input = [
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "investigate bug" }],
      },
      {
        type: "reasoning",
        summary: [{ type: "summary_text", text: "Need a plan" }],
      },
    ];
    const body = { input: structuredClone(input) };
    const diagnostics = {};

    const data = await compressWithHeadroom(body, {
      enabled: true,
      url: "http://headroom.test",
      model: "gpt-5",
      format: "openai-responses",
      diagnostics,
    });

    expect(data).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(body.input).toEqual(input);
    expect(diagnostics.reason).toBe("no eligible plain-text tool output");
  });

  it("compresses Responses tool OUTPUT text via the dedicated tool-output lane (#4070)", async () => {
    // Supersedes the blanket #2132 skip for tool history: plain-text
    // function_call_output leaves are compressed in place; the conversation
    // items themselves are never collapsed into a message. Write-back only
    // accepts strictly shorter text.
    const longOutput = "patch applied successfully; 3 files changed; ".repeat(12);
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        messages: [{ role: "tool", tool_call_id: "headroom-tool-0", content: "patch ok (3 files)" }],
        tokens_saved: 10,
      }),
    }));

    const body = {
      input: [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "investigate bug" }],
        },
        {
          type: "function_call",
          call_id: "call_apply_patch_123",
          name: "apply_patch",
          arguments: "*** Begin Patch\n*** End Patch",
        },
        {
          type: "function_call_output",
          call_id: "call_apply_patch_123",
          output: longOutput,
        },
      ],
      tools: [
        {
          type: "custom",
          name: "apply_patch",
          format: { type: "grammar", syntax: "lark", definition: "start: /.+/" },
        },
      ],
    };

    const data = await compressWithHeadroom(body, {
      enabled: true,
      url: "http://headroom.test",
      model: "gpt-5",
      format: "openai-responses",
    });

    expect(data).not.toBeNull();
    expect(global.fetch).toHaveBeenCalledOnce();
    // The protocol items survive untouched; only the output text was compressed.
    expect(body.input.find((i) => i.type === "function_call").call_id).toBe("call_apply_patch_123");
    expect(body.input.find((i) => i.type === "function_call_output").output).toBe("patch ok (3 files)");
  });
});

