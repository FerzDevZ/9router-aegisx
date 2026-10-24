/**
 * Tool normalization before dispatch:
 * - MCP-equivalent built-in tool dedup (reduces token bloat).
 * - Exact same-name tool dedup for DeepSeek models — the DeepSeek upstream rejects
 *   duplicate tool names with 400 "Tool names must be unique" on every endpoint
 *   (verified live 2026-08-15 against api.deepseek.com, opencode.go and a LiteLLM
 *   gateway; GLM/MiniMax/Kimi upstreams accept duplicates). First definition wins,
 *   tool_choice and message-history references are by name/id so nothing breaks.
 */
import { isDeepSeekModel } from "../providers/models/helpers.js";

const DEDUP_RULES = [
  {
    // Exa MCP present → drop built-in web tools (Exa is preferred).
    triggers: ["mcp__exa__web_search_exa", "mcp__exa__web_fetch_exa"],
    strip: ["WebSearch", "WebFetch", "mcp__workspace__web_fetch"],
  },
  {
    // Tavily MCP present → drop built-in web tools.
    triggers: ["mcp__tavily__tavily_search", "mcp__tavily__tavily_extract"],
    strip: ["WebSearch", "WebFetch", "mcp__workspace__web_fetch"],
  },
  {
    // Browser MCP present → drop Cowork's duplicate Claude_in_Chrome connector.
    triggers: [/^mcp__browsermcp__/],
    strip: [/^mcp__Claude_in_Chrome__/],
  },
];

function getToolName(t) {
  return t?.name || t?.function?.name || "";
}

function matches(name, pattern) {
  if (typeof pattern === "string") return name === pattern;
  return pattern instanceof RegExp ? pattern.test(name) : false;
}

/**
 * @param {Array} tools - translated tools array
 * @param {Object} [opts]
 * @param {string|null} [opts.clientTool] - detected client ("claude" | "codex" | ...)
 * @param {string|null} [opts.model] - model id, may carry a (level) thinking suffix
 * @returns {{ tools: Array, stripped: Array<string> }}
 */
function dedupeTools(tools, opts = {}) {
  if (!Array.isArray(tools) || tools.length === 0) return { tools, stripped: [] };
  const names = tools.map(getToolName);
  const toStrip = new Set();
  const toDrop = new Set(); // indices of duplicate same-name tools

  // MCP-based built-in dedup: any client carrying an MCP trigger sheds the
  // redundant built-ins. Strip names are matched literally (WebSearch,
  // WebFetch, …), so tool sets that never define them are untouched — no
  // client gating needed.
  for (const rule of DEDUP_RULES) {
    const hasTrigger = names.some((n) => rule.triggers.some((p) => matches(n, p)));
    if (!hasTrigger) continue;
    for (const n of names) {
      if (rule.strip.some((p) => matches(n, p))) toStrip.add(n);
    }
  }

  // Exact-name dedup: DeepSeek upstream rejects duplicate tool names. Applies to
  // every client × provider that serves a deepseek-* model (official API, Console Go,
  // LiteLLM gateways); non-DeepSeek models are untouched.
  if (isDeepSeekModel(opts.model)) {
    const seen = new Set();
    for (let i = 0; i < tools.length; i++) {
      const n = getToolName(tools[i]);
      if (!n) continue;
      if (seen.has(n)) toDrop.add(i);
      else seen.add(n);
    }
  }

  if (toStrip.size === 0 && toDrop.size === 0) {
    // Canonical name order even when nothing is stripped: client-side tool-order
    // jitter between turns invalidates provider prompt-prefix caches every turn.
    // Identity-preserving fast path: already-canonical arrays return as-is.
    const sorted = [...tools].sort((a, b) => (getToolName(a) || "").localeCompare(getToolName(b) || ""));
    const sameOrder = sorted.every((t, i) => t === tools[i]);
    return { tools: sameOrder ? tools : sorted, stripped: [] };
  }
  const out = tools.filter((t, i) => !toDrop.has(i) && !toStrip.has(getToolName(t)));
  out.sort((a, b) => (getToolName(a) || "").localeCompare(getToolName(b) || ""));
  const stripped = Array.from(toDrop).map((i) => getToolName(tools[i])).concat(Array.from(toStrip));
  return { tools: out, stripped };
}

export { dedupeTools };
