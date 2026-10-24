"use client";

import { Card, Button, Toggle, NoAuthProxyCard } from "@/shared/components";
import { translate } from "@/i18n/runtime";
import { getScheduleSlotLabels } from "@/shared/services/quotaPingSchedule";
import ConnectionRow from "./ConnectionRow";
import WebLoginButton, { WEB_LOGIN_PROVIDERS } from "../components/WebLoginButton.js";

export default function ConnectionsSection({
  providerId,
  connections,
  proxyPools,
  isFreeNoAuth,
  isOAuth,
  isCompatible,
  hasDualAuthModes,
  oauthConnectionLabel,
  apiKeyConnectionLabel,
  selectedConnectionIds,
  allSelected,
  autoPing,
  autoPingSettingsKey,
  oneByOneRunning,
  oneByOneStopping,
  oneByOneCurrentConnectionId,
  oneByOneSummary,
  oneByOneResults,
  providerStrategy,
  providerStickyLimit,
  onToggleSelectConnection: toggleSelectConnection,
  onToggleSelectAllConnections: toggleSelectAllConnections,
  onSwapPriority: handleSwapPriority,
  onUpdateConnectionStatus: handleUpdateConnectionStatus,
  onDeleteConnection: handleDelete,
  onSetConnections: setConnections,
  onSelectConnection: setSelectedConnection,
  onShowEditModal: setShowEditModal,
  onScheduleConnection: setScheduleConnection,
  onRoundRobinToggle: handleRoundRobinToggle,
  onStickyLimitChange: handleStickyLimitChange,
  onBulkDelete: handleBulkDelete,
  onRunOneByOneTest: handleRunOneByOneTest,
  onStopOneByOneTest: handleStopOneByOneTest,
  onShowBulkProxyModal: setShowBulkProxyModal,
  onOAuthConnection: triggerOAuthConnection,
  onApiKeyConnection: triggerApiKeyConnection,
  onAddConnection: triggerAddConnection,
  onConnected: fetchConnections,
  onShowIFlowCookieModal: setShowIFlowCookieModal,
  onShowBulkImportCodex: setShowBulkImportCodex,
  onShowBulkImportGrokCli: setShowBulkImportGrokCli,
}) {
  const isSelected = (connectionId) => selectedConnectionIds.includes(connectionId);

  const connectionsList = (
    <div className="flex min-w-0 flex-col divide-y divide-black/[0.03] dark:divide-white/[0.03] max-h-[500px] overflow-y-auto pr-1">
      {connections
        .map((conn, index) => (
          <div key={conn.id} className="flex min-w-0 items-stretch">
            <div className="flex shrink-0 items-center pl-1 sm:pl-2">
              <input
                type="checkbox"
                checked={isSelected(conn.id)}
                onChange={() => toggleSelectConnection(conn.id)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </div>
            <div className="flex-1 min-w-0">
              <ConnectionRow
                connection={conn}
                proxyPools={proxyPools}
                isOAuth={isOAuth}
                isFirst={index === 0}
                isLast={index === connections.length - 1}
                onMoveUp={() => handleSwapPriority(index, index - 1)}
                onMoveDown={() => handleSwapPriority(index, index + 1)}
                onToggleActive={(isActive) => handleUpdateConnectionStatus(conn.id, isActive)}
                autoPing={autoPingSettingsKey && conn.authType === "oauth" ? {
                  isActive: autoPing.connections[conn.id] === true || autoPing.schedules?.[conn.id]?.enabled === true,
                  reactiveOn: autoPing.connections[conn.id] === true,
                  provider: providerId,
                  scheduleOn: autoPing.schedules?.[conn.id]?.enabled === true,
                  scheduleSummary: getScheduleSlotLabels(autoPing.schedules?.[conn.id]).join(" / "),
                  onConfigure: () => setScheduleConnection(conn),
                } : null}
                onUpdateProxy={async (proxyPoolId) => {
                  try {
                    const res = await fetch(`/api/providers/${conn.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ proxyPoolId: proxyPoolId || null }),
                    });
                    if (res.ok) {
                      setConnections(prev => prev.map(c =>
                        c.id === conn.id
                          ? { ...c, providerSpecificData: { ...c.providerSpecificData, proxyPoolId: proxyPoolId || null } }
                          : c
                      ));
                    }
                  } catch (error) {
                    console.log("Error updating proxy:", error);
                  }
                }}
                onEdit={() => {
                  setSelectedConnection(conn);
                  setShowEditModal(true);
                }}
                onDelete={() => handleDelete(conn.id)}
                oneByOneStatus={oneByOneResults[conn.id] || null}
              />
            </div>
          </div>
        ))}
    </div>
  );

  return (
    isFreeNoAuth ? (
      <NoAuthProxyCard providerId={providerId} />
    ) : (
      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Connections</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {connections.length > 0 && proxyPools.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                icon="lan"
                onClick={() => setShowBulkProxyModal(true)}
              >
                Apply Proxy
              </Button>
            )}
            {connections.length > 0 && (
              <>
                {selectedConnectionIds.length > 0 && (
                  <Button
                    size="sm"
                    variant="danger"
                    icon="delete"
                    onClick={handleBulkDelete}
                  >
                    Delete Selected ({selectedConnectionIds.length})
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  icon="sync"
                  onClick={handleRunOneByOneTest}
                  disabled={oneByOneRunning}
                >
                  {oneByOneRunning ? "Testing Connection One-by-One..." : "Test Connection One-by-One"}
                </Button>
                {oneByOneRunning && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="stop"
                    onClick={handleStopOneByOneTest}
                    disabled={oneByOneStopping}
                  >
                    {oneByOneStopping ? "Stopping..." : "Stop"}
                  </Button>
                )}
              </>
            )}
            {/* Round Robin toggle */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-text-muted font-medium">Round Robin</span>
              <Toggle
                aria-label="Round Robin strategy"
                checked={providerStrategy === "round-robin"}
                onChange={handleRoundRobinToggle}
              />
              {providerStrategy === "round-robin" && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-muted">Sticky:</span>
                  <input
                    type="number"
                    min={1}
                    value={providerStickyLimit}
                    onChange={(e) => handleStickyLimitChange(e.target.value)}
                    placeholder="1"
                    className="w-14 px-2 py-1 text-xs border border-border rounded-md bg-background focus:outline-none focus:border-primary"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {connections.length === 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary shrink-0">
                <span className="material-symbols-outlined text-[18px]">{isOAuth ? "lock" : "key"}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm text-text-muted">No connections yet</p>
                {hasDualAuthModes && (
                  <p className="text-xs text-text-muted">
                    Choose {oauthConnectionLabel} or {apiKeyConnectionLabel}.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {hasDualAuthModes ? (
                <>
                  <Button size="sm" icon="lock" variant="secondary" onClick={triggerOAuthConnection}>
                    {oauthConnectionLabel}
                  </Button>
                  <Button size="sm" icon="key" onClick={triggerApiKeyConnection}>
                    {apiKeyConnectionLabel}
                  </Button>
                </>
              ) : (
                <>
                  {!isCompatible && WEB_LOGIN_PROVIDERS.has(providerId) && (
                    <WebLoginButton providerId={providerId} onConnected={fetchConnections} />
                  )}
                  {!isCompatible && providerId === "iflow" && (
                    <Button size="sm" icon="cookie" variant="secondary" onClick={() => setShowIFlowCookieModal(true)}>
                      Cookie
                    </Button>
                  )}
                  {providerId === "codex" && (
                    <Button size="sm" icon="playlist_add" variant="secondary" onClick={() => setShowBulkImportCodex(true)}>
                      {translate("Bulk Add")}
                    </Button>
                  )}
                  {providerId === "grok-cli" && (
                    <Button size="sm" icon="playlist_add" variant="secondary" onClick={() => setShowBulkImportGrokCli(true)}>
                      {translate("Bulk Add")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    icon="add"
                    onClick={triggerAddConnection}
                  >
                    {isCompatible ? "Add API Key" : (providerId === "iflow" ? "OAuth" : "Add Connection")}
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {oneByOneSummary && (
              <div className="mb-4 rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-xs text-text-muted dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex flex-wrap items-center gap-3">
                  <span>Total: {oneByOneSummary.total}</span>
                  <span>Completed: {oneByOneSummary.completed}</span>
                  <span>Passed: {oneByOneSummary.passed}</span>
                  <span>Failed: {oneByOneSummary.failed}</span>
                  {oneByOneSummary.stopped && (
                    <span className="text-amber-600 dark:text-amber-400">Stopped</span>
                  )}
                  {oneByOneRunning && oneByOneCurrentConnectionId && (
                    <span>Running: {connections.find((conn) => conn.id === oneByOneCurrentConnectionId)?.name || oneByOneCurrentConnectionId}</span>
                  )}
                </div>
              </div>
            )}
            {connections.length > 0 && (
              <div className="mb-3 flex items-center gap-2 border-b border-black/[0.03] pb-2 dark:border-white/[0.03]">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-muted hover:text-primary">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAllConnections}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  Select All
                </label>
              </div>
            )}
            {connectionsList}
            {!isCompatible && (
              <div className="mt-4 grid grid-cols-1 gap-2 sm:flex">
                {WEB_LOGIN_PROVIDERS.has(providerId) && (
                  <WebLoginButton providerId={providerId} onConnected={fetchConnections} />
                )}
                {providerId === "iflow" && (
                  <Button
                    size="sm"
                    icon="cookie"
                    variant="secondary"
                    onClick={() => setShowIFlowCookieModal(true)}
                    title="Add connection using browser cookie"
                    className="w-full sm:w-auto"
                  >
                    Cookie
                  </Button>
                )}
                {providerId === "codex" && (
                  <Button
                    size="sm"
                    icon="playlist_add"
                    variant="secondary"
                    onClick={() => setShowBulkImportCodex(true)}
                    title={translate("Bulk import codex accounts from JSON")}
                    className="w-full sm:w-auto"
                  >
                    {translate("Bulk Add")}
                  </Button>
                )}
                {providerId === "grok-cli" && (
                  <Button
                    size="sm"
                    icon="playlist_add"
                    variant="secondary"
                    onClick={() => setShowBulkImportGrokCli(true)}
                    title={translate("Bulk import Grok CLI accounts from JSON")}
                    className="w-full sm:w-auto"
                  >
                    {translate("Bulk Add")}
                  </Button>
                )}
                {hasDualAuthModes ? (
                  <>
                    <Button
                      size="sm"
                      icon="lock"
                      variant="secondary"
                      onClick={triggerOAuthConnection}
                      className="w-full sm:w-auto"
                    >
                      {oauthConnectionLabel}
                    </Button>
                    <Button
                      size="sm"
                      icon="key"
                      onClick={triggerApiKeyConnection}
                      className="w-full sm:w-auto"
                    >
                      {apiKeyConnectionLabel}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    icon="add"
                    onClick={triggerAddConnection}
                    className="w-full sm:w-auto"
                  >
                    Add
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </Card>
    )
  );
}
