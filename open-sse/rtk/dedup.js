// Exact-duplicate tool_result elision (request-scoped).
// Agentic conversations resend full history, so a repeated test/build run
// appears verbatim in multiple tool results inside ONE request body. The
// first occurrence is kept; later byte-identical copies become a short
// reference. Zero information is lost (the model can still read result #N).
// Fail-open: any error leaves the body untouched.

// FNV-1a 32-bit → 8 hex chars. Display-only fingerprint (dedup itself is
// exact string equality), so a collision only mislabels a reference note.
export function fnv1aHex(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// Minimum size for a duplicate to be worth replacing — below this the
// reference text costs about as much as the content itself.
const MIN_DUP_SIZE = 200;

/**
 * Walk tool-result locations in source order and replace later exact
 * duplicates with a reference. Mutates blocks in-place.
 * @param {Function} visit - called with (getContent, setContent, meta) for
 *   each tool-result text location; getContent() → string|null.
 * @returns {{ hits: number, bytesSaved: number } | null}
 */
export function dedupViaVisitor(visit) {
  const seen = new Map(); // content → 1-based result number
  const stats = { hits: 0, bytesSaved: 0 };
  let counter = 0;
  try {
    visit((getContent, setContent, { isError } = {}) => {
      counter++;
      const content = getContent();
      if (content === null || content === undefined) return;
      if (isError) return; // preserve error traces verbatim
      const prior = seen.get(content);
      if (prior === undefined) {
        if (content.length >= MIN_DUP_SIZE) seen.set(content, counter);
        return;
      }
      if (content.length < MIN_DUP_SIZE) return;
      const replacement =
        `[duplicate of tool result #${prior} above — ${content.length}B identical, ` +
        `fnv1a:${fnv1aHex(content)} — omitted by RTK dedup]`;
      if (replacement.length >= content.length) return; // never grow
      setContent(replacement);
      stats.hits++;
      stats.bytesSaved += content.length - replacement.length;
    });
  } catch {
    return null;
  }
  return stats.hits > 0 ? stats : null;
}

// ---- Shape walkers: one per request format RTK already knows ----

function visitMessages(items) {
  return (cb) => {
    for (const msg of items) {
      if (!msg) continue;

      // OpenAI Responses: { type:"function_call_output", output }
      if (msg.type === "function_call_output") {
        if (typeof msg.output === "string") {
          cb(() => msg.output, (v) => { msg.output = v; }, {});
        } else if (Array.isArray(msg.output)) {
          for (const part of msg.output) {
            if (part?.type === "input_text" && typeof part.text === "string") {
              cb(() => part.text, (v) => { part.text = v; }, {});
            }
          }
        }
        continue;
      }

      // OpenAI: { role:"tool", content: string | [{type:"text", text}] }
      if (msg.role === "tool") {
        if (typeof msg.content === "string") {
          cb(() => msg.content, (v) => { msg.content = v; }, {});
        } else if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part?.type === "text" && typeof part.text === "string") {
              cb(() => part.text, (v) => { part.text = v; }, {});
            }
          }
        }
        continue;
      }

      // Claude: content blocks with tool_result entries
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block?.type !== "tool_result") continue;
          const isError = block.is_error === true;
          if (typeof block.content === "string") {
            cb(() => block.content, (v) => { block.content = v; }, { isError });
          } else if (Array.isArray(block.content)) {
            for (const part of block.content) {
              if (part?.type === "text" && typeof part.text === "string") {
                cb(() => part.text, (v) => { part.text = v; }, { isError });
              }
            }
          }
        }
      }
    }
  };
}

function visitKiro(allMessages) {
  return (cb) => {
    for (const msg of allMessages) {
      const toolResults = msg?.userInputMessage?.userInputMessageContext?.toolResults;
      if (!Array.isArray(toolResults)) continue;
      for (const tr of toolResults) {
        if (tr.status === "error") continue; // preserve error traces
        if (!Array.isArray(tr.content)) continue;
        for (const part of tr.content) {
          if (part && typeof part.text === "string") {
            cb(() => part.text, (v) => { part.text = v; }, {});
          }
        }
      }
    }
  };
}

/**
 * Dedup tool results in an OpenAI/Claude/Responses `messages`/`input` array.
 */
export function dedupToolResults(items) {
  return dedupViaVisitor(visitMessages(items));
}

/**
 * Dedup tool results in a Kiro conversationState body.
 */
export function dedupKiroToolResults(state) {
  const allMessages = [...(Array.isArray(state?.history) ? state.history : [])];
  if (state?.currentMessage) allMessages.push(state.currentMessage);
  return dedupViaVisitor(visitKiro(allMessages));
}
