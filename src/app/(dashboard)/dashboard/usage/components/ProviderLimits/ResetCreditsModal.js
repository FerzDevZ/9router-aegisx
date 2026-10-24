"use client";

import { getConnectionLabel } from "./utils";
import {
  claudeGrantStatus,
  formatClaudeResetClears,
  formatCreditDate,
  formatTimeRemaining,
} from "./helpers";

// Reset-credit detail overlay: Claude limit-reset grants or Codex credit
// expiry, depending on state.data.kind. Pure presentation — parent owns state.
export default function ResetCreditsModal({ state, onClose }) {
  if (!state) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-black/15 bg-white shadow-2xl ring-1 ring-black/10 dark:border-white/15 dark:bg-neutral-950 dark:ring-white/10">
        <div className="flex items-start justify-between gap-3 border-b border-black/10 bg-black/[0.03] px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-text-primary">
              {state.data?.kind === "claude" ? "Claude Code Limit Resets" : "Codex Reset Credit Expiry"}
            </h3>
            <p className="mt-0.5 truncate text-xs text-text-muted">
              {getConnectionLabel(state.connection) || (state.data?.kind === "claude" ? "Claude account" : "Codex account")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5"
            aria-label="Close reset credit expiry modal"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto bg-white p-4 dark:bg-neutral-950">
          {state.loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-muted">
              <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
              Loading reset credits...
            </div>
          ) : state.error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
              {state.error}
            </div>
          ) : state.data?.kind === "claude" && state.data.grants?.length ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-xs text-text-muted dark:border-white/10 dark:bg-white/[0.03]">
                <span>{state.data.availableCount ?? 0} reset{state.data.availableCount === 1 ? "" : "s"} left</span>
                <span>Weekly reset day: {formatCreditDate(state.data.weeklyResetsAt)}</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-black/[0.03] text-xs uppercase tracking-wide text-text-muted dark:bg-white/[0.04]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Reset</th>
                      <th className="px-3 py-2 font-medium">Left</th>
                      <th className="px-3 py-2 font-medium">Refills</th>
                      <th className="px-3 py-2 font-medium">Use By</th>
                      <th className="px-3 py-2 font-medium">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(state.data.grants || []).map((grant) => (
                      <tr key={grant.id} className="border-t border-black/5 dark:border-white/5">
                        <td className="px-3 py-2">
                          <div className="text-text-primary">{grant.label || grant.id}</div>
                          <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {claudeGrantStatus(grant)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-medium tabular-nums text-text-primary">{grant.resetsLeft} / {grant.resetsTotal}</td>
                        <td className="px-3 py-2 text-text-muted">{formatClaudeResetClears(grant.clears)}</td>
                        <td className="px-3 py-2 text-text-primary">{formatCreditDate(grant.endsAt)}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-medium text-text-primary">{formatTimeRemaining(grant.endsAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : state.data?.credits?.length ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-xs text-text-muted dark:border-white/10 dark:bg-white/[0.03]">
                <span>{state.data.credits.length} reset credit{state.data.credits.length === 1 ? "" : "s"}</span>
                <span>{state.data.availableCount ?? 0} available</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-black/[0.03] text-xs uppercase tracking-wide text-text-muted dark:bg-white/[0.04]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Granted At</th>
                      <th className="px-3 py-2 font-medium">Expires At</th>
                      <th className="px-3 py-2 font-medium">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.credits.map((credit, index) => (
                      <tr key={`${credit.status}-${credit.expiresAt || index}`} className="border-t border-black/5 dark:border-white/5">
                        <td className="px-3 py-2">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {credit.status || "unknown"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-text-muted">{formatCreditDate(credit.grantedAt)}</td>
                        <td className="px-3 py-2 text-text-primary">{formatCreditDate(credit.expiresAt)}</td>
                        <td className="px-3 py-2 font-medium text-text-primary">{formatTimeRemaining(credit.expiresAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-black/10 bg-black/[0.02] px-3 py-8 text-center text-sm text-text-muted dark:border-white/10 dark:bg-white/[0.03]">
              {state.data?.kind === "claude" ? "No limit resets available for this account." : "No reset credit details returned for this account."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
