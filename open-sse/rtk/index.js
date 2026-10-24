// RTK port: compress tool_result content in LLM request bodies
// Applied in chatCore on the source-format body, before translateRequest.
// Options (beyond `enabled`): dedup elides exact-duplicate tool results,
// historyGc squashes tool results older than the last N user turns.
import { RAW_CAP, MIN_COMPRESS_SIZE } from "./constants.js";
import { autoDetectFilter } from "./autodetect.js";
import { safeApply } from "./applyFilter.js";
import { dedupToolResults, dedupKiroToolResults } from "./dedup.js";
import { gcHistory, gcKiroHistory } from "./historyGc.js";

// Normalize the legacy boolean form; undefined `enabled` defaults to true so
// an options object built elsewhere cannot silently disable the pass.
function normalizeOptions(opts) {
  const o = typeof opts === "boolean" ? { enabled: opts } : (opts && typeof opts === "object" ? opts : {});
  return {
    enabled: o.enabled !== false,
    dedup: o.dedup !== false,
    historyGc: o.historyGc === true,
    historyGcKeepTurns: Number.isFinite(+o.historyGcKeepTurns) && +o.historyGcKeepTurns > 0
      ? Math.floor(+o.historyGcKeepTurns)
      : 6,
  };
}

// Compress tool_result content in-place. Returns stats or null if disabled/failed.
export function compressMessages(body, opts = true) {
  const options = normalizeOptions(opts);
  if (!options.enabled) return null;
  if (!body) return null;

  // Kiro format: conversationState.history + conversationState.currentMessage
  if (body.conversationState) {
    return compressKiroFormat(body, options);
  }

  // Support both OpenAI/Claude "messages" and OpenAI Responses "input"
  const items = Array.isArray(body.messages) ? body.messages
    : Array.isArray(body.input) ? body.input
    : null;
  if (!items) return null;

  const stats = { bytesBefore: 0, bytesAfter: 0, hits: [] };
  try {
    for (let i = 0; i < items.length; i++) {
      const msg = items[i];
      if (!msg) continue;

      // Shape 4: OpenAI Responses — top-level { type:"function_call_output", output: string | [{type:"input_text", text}] }
      if (msg.type === "function_call_output") {
        if (typeof msg.output === "string") {
          msg.output = compressText(msg.output, stats, "openai-responses-string");
        } else if (Array.isArray(msg.output)) {
          for (let k = 0; k < msg.output.length; k++) {
            const part = msg.output[k];
            if (part && part.type === "input_text" && typeof part.text === "string") {
              part.text = compressText(part.text, stats, "openai-responses-array");
            }
          }
        }
        continue;
      }

      // Shape 1: OpenAI tool message — { role:"tool", content: "string" }
      if (msg.role === "tool" && typeof msg.content === "string") {
        msg.content = compressText(msg.content, stats, "openai-tool");
        continue;
      }

      if (!Array.isArray(msg.content)) continue;

      // Shape 1b: OpenAI tool message — { role:"tool", content:[{type:"text", text:"..."}] }
      if (msg.role === "tool") {
        for (let k = 0; k < msg.content.length; k++) {
          const part = msg.content[k];
          if (part && part.type === "text" && typeof part.text === "string") {
            part.text = compressText(part.text, stats, "openai-tool-array");
          }
        }
        continue;
      }

      // Shape 2/3: blocks array with tool_result entries
      for (let j = 0; j < msg.content.length; j++) {
        const block = msg.content[j];
        if (!block || block.type !== "tool_result") continue;
        if (block.is_error === true) continue; // preserve error traces

        if (typeof block.content === "string") {
          // Shape 2: claude string form
          block.content = compressText(block.content, stats, "claude-string");
        } else if (Array.isArray(block.content)) {
          // Shape 3: claude array form — compress each text part
          for (let k = 0; k < block.content.length; k++) {
            const part = block.content[k];
            if (part && part.type === "text" && typeof part.text === "string") {
              part.text = compressText(part.text, stats, "claude-array");
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("[RTK] compressMessages error:", e.message);
    return null;
  }
  // Post-passes: exact-duplicate elision, then old-history squash. Order
  // matters — dedup first keeps one verbatim copy, GC then squashes the
  // surviving copy if it is old (references stay short either way).
  if (options.dedup) {
    const dedupStats = dedupToolResults(items);
    if (dedupStats) stats.dedup = dedupStats;
  }
  if (options.historyGc) {
    const gcStats = gcHistory(items, options.historyGcKeepTurns);
    if (gcStats) stats.historyGc = gcStats;
  }
  return stats;
}

// Compress Kiro format: conversationState.history[].userInputMessage.userInputMessageContext.toolResults[].content[].text
function compressKiroFormat(body, options) {
  const stats = { bytesBefore: 0, bytesAfter: 0, hits: [] };
  try {
    const state = body.conversationState;
    const allMessages = [...(Array.isArray(state?.history) ? state.history : [])];
    if (state?.currentMessage) allMessages.push(state.currentMessage);

    for (const msg of allMessages) {
      const toolResults = msg?.userInputMessage?.userInputMessageContext?.toolResults;
      if (!Array.isArray(toolResults)) continue;

      for (const tr of toolResults) {
        if (tr.status === "error") continue; // preserve error traces
        if (!Array.isArray(tr.content)) continue;

        for (const part of tr.content) {
          if (part && typeof part.text === "string") {
            part.text = compressText(part.text, stats, "kiro-tool-result");
          }
        }
      }
    }
  } catch (e) {
    console.warn("[RTK] compressKiroFormat error:", e.message);
    return null;
  }
  if (options.dedup) {
    const dedupStats = dedupKiroToolResults(body.conversationState);
    if (dedupStats) stats.dedup = dedupStats;
  }
  if (options.historyGc) {
    const gcStats = gcKiroHistory(body.conversationState, options.historyGcKeepTurns);
    if (gcStats) stats.historyGc = gcStats;
  }
  return stats;
}

function compressText(text, stats, shape) {
  const bytesIn = text.length;
  stats.bytesBefore += bytesIn;

  if (bytesIn < MIN_COMPRESS_SIZE || bytesIn > RAW_CAP) {
    stats.bytesAfter += bytesIn;
    return text;
  }

  const fn = autoDetectFilter(text);
  if (!fn) {
    stats.bytesAfter += bytesIn;
    return text;
  }

  const out = safeApply(fn, text);

  // Safety: never return empty, never grow the input
  if (!out || out.length === 0 || out.length >= bytesIn) {
    stats.bytesAfter += bytesIn;
    return text;
  }

  stats.bytesAfter += out.length;
  stats.hits.push({ shape, filter: fn.filterName || fn.name, saved: bytesIn - out.length });
  return out;
}

// Convenience: format a log line from stats
export function formatRtkLog(stats) {
  if (!stats) return null;
  const hasFilterHits = stats.hits && stats.hits.length > 0;
  if (!hasFilterHits && !stats.dedup && !stats.historyGc) return null;
  const saved = stats.bytesBefore - stats.bytesAfter;
  const pct = stats.bytesBefore > 0 ? ((saved / stats.bytesBefore) * 100).toFixed(1) : "0";
  const filters = hasFilterHits ? Array.from(new Set(stats.hits.map(h => h.filter))).join(",") : "none";
  let line = `[RTK] saved ${saved}B / ${stats.bytesBefore}B (${pct}%) via [${filters}] hits=${hasFilterHits ? stats.hits.length : 0}`;
  if (stats.dedup) line += ` | dedup saved ${stats.dedup.bytesSaved}B (${stats.dedup.hits}x)`;
  if (stats.historyGc) line += ` | historyGC saved ${stats.historyGc.bytesSaved}B (${stats.historyGc.hits}x)`;
  return line;
}
