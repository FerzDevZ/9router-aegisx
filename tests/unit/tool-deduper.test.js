import { describe, it, expect } from "vitest";
import { dedupeTools } from "../../open-sse/utils/toolDeduper.js";

const BASH = (name = "Bash", desc = "Run a shell command") => ({
  name,
  description: desc,
  input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
});

const FUNC_SHAPE = (name = "Bash") => ({
  type: "function",
  function: { name, description: "Run a shell command", parameters: { type: "object", properties: { command: { type: "string" } } } },
});

const MCP_EXA = { name: "mcp__exa__web_search_exa", description: "search" };

describe("toolDeduper — MCP-equivalent built-in rules (existing behavior)", () => {
  it("claude client + Exa MCP → drops built-in WebSearch/WebFetch", () => {
    const { tools, stripped } = dedupeTools(
      [MCP_EXA, { name: "WebSearch", description: "web" }, { name: "WebFetch", description: "web" }, BASH()],
      { clientTool: "claude" }
    );
    expect(tools.map((t) => t.name)).toEqual(["Bash", "mcp__exa__web_search_exa"]);
    expect(stripped.sort()).toEqual(["WebFetch", "WebSearch"]);
  });

  it("non-claude client + Exa MCP + built-in web tools → rules apply too", () => {
    // Rules match strip names literally; any client carrying both an MCP trigger
    // and the redundant built-ins sheds the built-ins — token bloat is not
    // claude-specific.
    const { tools, stripped } = dedupeTools(
      [MCP_EXA, { name: "WebSearch", description: "web" }],
      { clientTool: "codex" }
    );
    expect(tools.map((t) => t.name)).toEqual(["mcp__exa__web_search_exa"]);
    expect(stripped).toEqual(["WebSearch"]);
  });

  it("no MCP trigger present → built-ins untouched regardless of client", () => {
    const tools = [MCP_EXA, BASH()];
    const { tools: out, stripped } = dedupeTools(tools, { clientTool: "codex" });
    expect(out).toHaveLength(2);
    expect(stripped).toEqual([]);
  });
});

describe("toolDeduper — DeepSeek same-name dedup (new)", () => {
  it("deepseek model + duplicate tool names → keeps first definition", () => {
    const first = BASH();
    const dup = BASH("Bash", "duplicate description");
    const { tools, stripped } = dedupeTools([first, dup], { model: "deepseek-v4-flash" });
    expect(tools).toEqual([first]); // first wins, including its description
    expect(stripped).toEqual(["Bash"]);
  });

  it("deepseek model + (max) thinking suffix → still dedups (suffix stripped before match)", () => {
    const { tools, stripped } = dedupeTools([BASH(), BASH("Bash", "dup")], { model: "deepseek-v4-flash(max)" });
    expect(tools).toHaveLength(1);
    expect(stripped).toEqual(["Bash"]);
  });

  it("deepseek + 3 same-name tools → keeps first, drops both duplicates", () => {
    const { tools, stripped } = dedupeTools([BASH(), BASH("Bash", "d1"), BASH("Bash", "d2")], { model: "deepseek-v4-pro" });
    expect(tools).toHaveLength(1);
    expect(stripped).toEqual(["Bash", "Bash"]);
  });

  it("deepseek + OpenAI function-shape tools → dedups by function.name", () => {
    const { tools } = dedupeTools([FUNC_SHAPE("Bash"), FUNC_SHAPE("Bash")], { model: "deepseek-v4-flash" });
    expect(tools).toHaveLength(1);
    expect(tools[0].function.name).toBe("Bash");
  });

  it("non-DeepSeek model + duplicate tool names → untouched (GLM/MiniMax/Kimi accept them)", () => {
    const tools = [BASH(), BASH("Bash", "dup")];
    const { tools: out, stripped } = dedupeTools(tools, { model: "glm-5.2" });
    expect(out).toBe(tools);
    expect(stripped).toEqual([]);
  });

  it("no model declared → same-name dedup does NOT run (safe default)", () => {
    const tools = [BASH(), BASH("Bash", "dup")];
    const { tools: out, stripped } = dedupeTools(tools, {});
    expect(out).toBe(tools);
    expect(stripped).toEqual([]);
  });

  it("deepseek + distinct names → nothing stripped", () => {
    const { tools, stripped } = dedupeTools([BASH("Bash"), BASH("ReadFile")], { model: "deepseek-v4-flash" });
    expect(tools).toHaveLength(2);
    expect(stripped).toEqual([]);
  });

  it("claude client + deepseek + MCP trigger → both rules apply (union stripped)", () => {
    const { tools, stripped } = dedupeTools(
      [MCP_EXA, { name: "WebSearch", description: "web" }, BASH(), BASH("Bash", "dup")],
      { clientTool: "claude", model: "deepseek-v4-flash" }
    );
    expect(tools.map((t) => t.name)).toEqual(["Bash", "mcp__exa__web_search_exa"]);
    expect(stripped.sort()).toEqual(["Bash", "WebSearch"]);
  });
});
