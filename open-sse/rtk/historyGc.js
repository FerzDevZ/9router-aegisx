// History GC: squash tool_result content older than the last K user turns
// into a short digest. Old tool output (yesterday's build log, a file read
// 30 turns ago) dominates long agent sessions but is rarely needed verbatim
// anymore — the digest keeps the head, size and fingerprint so the model can
// still ask for a re-read. Recent turns stay byte-identical.
// Fail-open: any error leaves the body untouched.

import { fnv1aHex } from "./dedup.js";

// Only squash results at least this big — smaller ones cost more as a digest
// than as content.
const MIN_GC_SIZE = 800;
// How much of the head to keep in the digest.
const DIGEST_HEAD = 160;

function makeDigest(content) {
  const lines = content.split("\n").length;
  const head = content.slice(0, DIGEST_HEAD).replace(/\s+/g, " ").trim();
  const ellipsis = content.length > DIGEST_HEAD ? "… " : " ";
  return (
    `[old tool result ${ellipsis}${head}] ` +
    `[${content.length}B, ${lines} lines total — squashed by history GC, ` +
    `fnv1a:${fnv1aHex(content)}; re-run the tool if you need it verbatim]`
  );
}

function squashViaVisitor(visit) {
  const stats = { hits: 0, bytesSaved: 0 };
  try {
    visit((getContent, setContent, { isError } = {}) => {
      if (isError) return; // preserve error traces verbatim
      const content = getContent();
      if (typeof content !== "string" || content.length < MIN_GC_SIZE) return;
      const digest = makeDigest(content);
      if (digest.length >= content.length) return; // never grow
      setContent(digest);
      stats.hits++;
      stats.bytesSaved += content.length - digest.length;
    });
  } catch {
    return null;
  }
  return stats.hits > 0 ? stats : null;
}

// Index of the message where the protected region starts: the K-th user
// turn counted from the end. Everything before it is history. Returns 0 when
// there are fewer than K user turns (nothing is old).
function protectedStartIndex(items, isUser, keepTurns) {
  let seen = 0;
  for (let i = items.length - 1; i >= 0; i--) {
    if (isUser(items[i])) {
      seen++;
      if (seen === keepTurns) return i;
    }
  }
  return 0;
}

// A real user turn — not a Claude-format user message that merely carries
// tool_result blocks (those are tool turns and must not extend protection).
function isRealUserTurn(m) {
  if (m?.role !== "user") return false;
  if (Array.isArray(m.content) && m.content.length > 0 && m.content.every((b) => b?.type === "tool_result")) {
    return false;
  }
  return true;
}

/**
 * Squash old tool results in `messages`/`input` (openai/claude/responses).
 * @param {Array} items - message array
 * @param {number} keepTurns - protect the last N user turns (default 6)
 */
export function gcHistory(items, keepTurns = 6) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const start = protectedStartIndex(items, isRealUserTurn, Math.max(1, keepTurns));
  if (start === 0) return null;
  const old = items.slice(0, start);

  let counter = 0;
  const visit = (cb) => {
    for (const msg of old) {
      if (!msg) continue;
      if (msg.type === "function_call_output") {
        if (typeof msg.output === "string") {
          counter++;
          const c = counter;
          cb(() => msg.output, (v) => { msg.output = v; }, {});
        } else if (Array.isArray(msg.output)) {
          for (const part of msg.output) {
            if (part?.type === "input_text" && typeof part.text === "string") {
              counter++;
              cb(() => part.text, (v) => { part.text = v; }, {});
            }
          }
        }
        continue;
      }
      if (msg.role === "tool") {
        if (typeof msg.content === "string") {
          counter++;
          cb(() => msg.content, (v) => { msg.content = v; }, {});
        } else if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part?.type === "text" && typeof part.text === "string") {
              counter++;
              cb(() => part.text, (v) => { part.text = v; }, {});
            }
          }
        }
        continue;
      }
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
  return squashViaVisitor(visit);
}

/**
 * Squash old tool results in a Kiro conversationState body. Kiro keeps all
 * turns in history[] — everything before the K-th user input from the end
 * is fair game.
 */
export function gcKiroHistory(state, keepTurns = 6) {
  const allMessages = [...(Array.isArray(state?.history) ? state.history : [])];
  if (state?.currentMessage) allMessages.push(state.currentMessage);
  if (allMessages.length === 0) return null;
  // A userInputMessage carrying toolResults is a tool turn, not a user turn.
  const isUser = (m) => {
    if (!m?.userInputMessage) return false;
    const tr = m.userInputMessage.userInputMessageContext?.toolResults;
    return !Array.isArray(tr) || tr.length === 0;
  };
  const start = protectedStartIndex(allMessages, isUser, Math.max(1, keepTurns));
  if (start === 0) return null;
  const old = allMessages.slice(0, start);

  const visit = (cb) => {
    for (const msg of old) {
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
  return squashViaVisitor(visit);
}
