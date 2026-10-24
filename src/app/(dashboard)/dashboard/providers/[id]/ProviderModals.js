"use client";

import { Button, Modal, OAuthModal, KiroOAuthWrapper, CursorAuthModal, ZedAuthModal, XiaomiMimoAuthModal, IFlowCookieModal, GitLabAuthModal, EditConnectionModal, ConfirmModal } from "@/shared/components";
import AddApiKeyModal from "./AddApiKeyModal";
import EditCompatibleNodeModal from "./EditCompatibleNodeModal";
import AddCustomModelModal from "./AddCustomModelModal";
import BulkImportCodexModal from "./BulkImportCodexModal";
import BulkImportGrokCliModal from "./BulkImportGrokCliModal";
import AutoPingScheduleModal from "./AutoPingScheduleModal";

export default function ProviderModals({
  providerId,
  providerInfo,
  isCompatible,
  isAnthropicCompatible,
  connections,
  proxyPools,
  selectedConnection,
  providerNode,
  providerStorageAlias,
  providerDisplayAlias,
  addConnectionError,
  autoPing,
  scheduleConnection,
  confirmState,
  showBulkProxyModal,
  bulkUpdatingProxy,
  showOAuthModal,
  showXiaomiMimoModal,
  showIFlowCookieModal,
  showAddApiKeyModal,
  showEditModal,
  showEditNodeModal,
  showAddCustomModel,
  showBulkImportCodex,
  showBulkImportGrokCli,
  showAgRiskModal,
  onCloseBulkProxyModal: closeBulkProxyModal,
  onApplyOneToOne: handleApplyOneToOne,
  onApplySinglePool: handleApplySinglePool,
  onOAuthSuccess: handleOAuthSuccess,
  onSetOAuthModal: setShowOAuthModal,
  onSetXiaomiMimoModal: setShowXiaomiMimoModal,
  onIFlowCookieSuccess: handleIFlowCookieSuccess,
  onSetIFlowCookieModal: setShowIFlowCookieModal,
  onSaveApiKey: handleSaveApiKey,
  onBulkDone: fetchConnections,
  onSetAddApiKeyModal: setShowAddApiKeyModal,
  onSetAddConnectionError: setAddConnectionError,
  onUpdateConnection: handleUpdateConnection,
  onSetEditModal: setShowEditModal,
  onUpdateNode: handleUpdateNode,
  onSetEditNodeModal: setShowEditNodeModal,
  onAddCustomModel: handleAddCustomModel,
  onSetAddCustomModel: setShowAddCustomModel,
  onSetBulkImportCodex: setShowBulkImportCodex,
  onSetBulkImportGrokCli: setShowBulkImportGrokCli,
  onSetScheduleConnection: setScheduleConnection,
  onSaveAutoPing: handleSaveAutoPing,
  onSetAgRiskModal: setShowAgRiskModal,
  onAgRiskConfirm: handleAgRiskConfirm,
  onSetConfirmState: setConfirmState,
}) {
  const activePools = proxyPools.filter((p) => p.isActive === true);

  const bulkActionModal = (
    <Modal
      isOpen={showBulkProxyModal}
      onClose={closeBulkProxyModal}
      title={`Apply Proxy (${connections.length} connections)`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col">
          <button
            onClick={handleApplyOneToOne}
            disabled={bulkUpdatingProxy || activePools.length === 0}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-text-muted text-[18px]">sync_alt</span>
            <span className="text-sm text-text-main">One-to-one (rotate)</span>
          </button>
          <button
            onClick={() => handleApplySinglePool(null)}
            disabled={bulkUpdatingProxy}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-text-muted text-[18px]">link_off</span>
            <span className="text-sm text-text-main">None (unbind all)</span>
          </button>
          {proxyPools.map((pool) => (
            <button
              key={pool.id}
              onClick={() => handleApplySinglePool(pool.id)}
              disabled={bulkUpdatingProxy || pool.isActive !== true}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-text-muted text-[18px]">lan</span>
              <span className="truncate text-sm text-text-main">{pool.name}</span>
              {pool.isActive !== true && (
                <span className="text-[10px] text-text-muted">(inactive)</span>
              )}
            </button>
          ))}
        </div>

        {bulkUpdatingProxy && <p className="text-xs text-text-muted">Applying...</p>}

        <Button onClick={closeBulkProxyModal} variant="ghost" fullWidth disabled={bulkUpdatingProxy}>
          Cancel
        </Button>
      </div>
    </Modal>
  );

  return (
    <>
      {bulkActionModal}

      {/* Modals */}
      {providerId === "kiro" ? (
        <KiroOAuthWrapper
          isOpen={showOAuthModal}
          providerInfo={providerInfo}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuthModal(false)}
        />
      ) : providerId === "cursor" ? (
        <CursorAuthModal
          isOpen={showOAuthModal}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuthModal(false)}
        />
      ) : providerId === "zed" ? (
        <ZedAuthModal
          isOpen={showOAuthModal}
          providerInfo={providerInfo}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuthModal(false)}
        />
      ) : providerId === "gitlab" ? (
        <GitLabAuthModal
          isOpen={showOAuthModal}
          providerInfo={providerInfo}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuthModal(false)}
        />
      ) : (
        <OAuthModal
          isOpen={showOAuthModal}
          provider={providerId}
          providerInfo={providerInfo}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuthModal(false)}
        />
      )}

      {/* Xiaomi Desktop: auto-import local credentials modal */}
      <XiaomiMimoAuthModal
        isOpen={showXiaomiMimoModal}
        onSuccess={handleOAuthSuccess}
        onClose={() => setShowXiaomiMimoModal(false)}
      />
      {providerId === "iflow" && (
        <IFlowCookieModal
          isOpen={showIFlowCookieModal}
          onSuccess={handleIFlowCookieSuccess}
          onClose={() => setShowIFlowCookieModal(false)}
        />
      )}
      <AddApiKeyModal
        isOpen={showAddApiKeyModal}
        provider={providerId}
        providerName={providerInfo.name}
        isCompatible={isCompatible}
        isAnthropic={isAnthropicCompatible}
        authType={providerInfo?.authType}
        authHint={providerInfo?.authHint}
        website={providerInfo?.website}
        proxyPools={proxyPools}
        error={addConnectionError}
        existingNames={connections.map((c) => c.name).filter(Boolean)}
        onSave={handleSaveApiKey}
        onBulkDone={fetchConnections}
        onClose={() => {
          setAddConnectionError("");
          setShowAddApiKeyModal(false);
        }}
      />
      <EditConnectionModal
        isOpen={showEditModal}
        connection={selectedConnection}
        proxyPools={proxyPools}
        onSave={handleUpdateConnection}
        onClose={() => setShowEditModal(false)}
      />
      {isCompatible && (
        <EditCompatibleNodeModal
          isOpen={showEditNodeModal}
          node={providerNode}
          onSave={handleUpdateNode}
          onClose={() => setShowEditNodeModal(false)}
          isAnthropic={isAnthropicCompatible}
        />
      )}
      {!isCompatible && (
        <AddCustomModelModal
          isOpen={showAddCustomModel}
          providerAlias={providerStorageAlias}
          providerDisplayAlias={providerDisplayAlias}
          onSave={async (modelId, caps, transport) => {
            // caps.stt is a UI-only flag; the API accepts transports only on
            // type "stt" records, so the save derives the type from it.
            await handleAddCustomModel(modelId, caps?.stt ? "stt" : "llm", providerStorageAlias, caps, transport);
            setShowAddCustomModel(false);
          }}
          onClose={() => setShowAddCustomModel(false)}
        />
      )}

      {providerId === "codex" && (
        <BulkImportCodexModal
          isOpen={showBulkImportCodex}
          onClose={() => setShowBulkImportCodex(false)}
          onSuccess={fetchConnections}
        />
      )}

      {providerId === "grok-cli" && (
        <BulkImportGrokCliModal
          isOpen={showBulkImportGrokCli}
          onClose={() => setShowBulkImportGrokCli(false)}
          onSuccess={fetchConnections}
        />
      )}

      {scheduleConnection && (
        <AutoPingScheduleModal
          isOpen={!!scheduleConnection}
          onClose={() => setScheduleConnection(null)}
          connection={scheduleConnection}
          reactive={autoPing.connections[scheduleConnection.id] === true}
          schedule={autoPing.schedules?.[scheduleConnection.id] || null}
          onSave={(result) => handleSaveAutoPing(scheduleConnection.id, result)}
        />
      )}

      {/* AG Risk Confirmation Modal */}
      <ConfirmModal
        isOpen={showAgRiskModal}
        onClose={() => setShowAgRiskModal(false)}
        onConfirm={handleAgRiskConfirm}
        title="Risk Notice"
        message={providerInfo?.deprecationNotice}
        confirmText="I Understand, Continue"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={confirmState?.onConfirm}
        title={confirmState?.title || "Confirm"}
        message={confirmState?.message}
        variant="danger"
      />
    </>
  );
}
