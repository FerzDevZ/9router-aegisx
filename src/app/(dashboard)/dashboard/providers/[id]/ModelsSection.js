"use client";

import { Card, Button } from "@/shared/components";
import { getModelKind } from "@/shared/constants/models";
import { getThinkingLevels } from "open-sse/providers/thinkingLevels.js";
import { translate } from "@/i18n/runtime";
import { getProviderCustomModelRows } from "@/shared/utils/providerCustomModels";
import ModelRow from "./ModelRow";
import CompatibleModelsSection from "./CompatibleModelsSection";

export default function ModelsSection({
  isCompatible,
  isAnthropic,
  isFreeNoAuth,
  providerId,
  providerStorageAlias,
  providerDisplayAlias,
  connections,
  models,
  kiloFreeModels,
  customModels,
  modelAliases,
  disabledModelIds,
  suggestedModels,
  modelTestResults,
  testingModelIds,
  copied,
  copy,
  getCaps,
  thinkingMode,
  modelsTestError,
  liveModelsError,
  onSetAlias: handleSetAlias,
  onDeleteAlias: handleDeleteAlias,
  onAddCustomModel: handleAddCustomModel,
  onDeleteCustomModel: handleDeleteCustomModel,
  onTestModel: handleTestModel,
  onDisableModel: handleDisableModel,
  onEnableModel: handleEnableModel,
  onEnableAll: handleEnableAll,
  onDisableAll: handleDisableAll,
  onThinkingModeChange: handleThinkingModeChange,
  onShowAddCustomModel: setShowAddCustomModel,
  importingQoderModels,
  importingClineModels,
  onImportQoderModels: handleImportQoderModels,
  onImportClineModels: handleImportClineModels,
}) {
  // Resolve suffix "(level)" for a model when a thinking level is picked and the model supports it.
  const resolveThinkingSuffix = (modelId) => {
    if (!thinkingMode || thinkingMode === "auto") return null;
    const levels = getThinkingLevels(providerId, modelId);
    return levels && levels.includes(thinkingMode) ? thinkingMode : null;
  };
  // Union of levels across this provider's reasoning models — drives the level picker options.
  // Include custom models too (e.g. manually added gpt-5.6-sol → max).
  const providerThinkingLevels = (() => {
    const set = new Set();
    const seen = new Set();
    const addLevels = (modelId) => {
      if (!modelId || seen.has(modelId)) return;
      seen.add(modelId);
      const lv = getThinkingLevels(providerId, modelId);
      if (lv) lv.forEach((l) => { if (l !== "none") set.add(l); });
    };
    for (const m of models) addLevels(m.id);
    for (const m of kiloFreeModels) addLevels(m.id);
    for (const entry of customModels) {
      if (entry.providerAlias !== providerStorageAlias) continue;
      if ((entry.kind || entry.type || "llm") !== "llm") continue;
      addLevels(entry.id);
    }
    return set.size ? ["auto", ...[...set]] : null;
  })();

  const renderModels = () => {
    if (isCompatible) {
      return (
        <CompatibleModelsSection
          providerStorageAlias={providerStorageAlias}
          providerDisplayAlias={providerDisplayAlias}
          modelAliases={modelAliases}
          customModels={customModels}
          copied={copied}
          onCopy={copy}
          onSetAlias={handleSetAlias}
          onDeleteAlias={handleDeleteAlias}
          onAddCustomModel={(modelId) => handleAddCustomModel(modelId, "llm", providerStorageAlias)}
          onDeleteCustomModel={(modelId) => handleDeleteCustomModel(modelId, "llm", providerStorageAlias)}
          connections={connections}
          isAnthropic={isAnthropic}
        />
      );
    }
    // Combine hardcoded models with Kilo free models (deduplicated)
    // Exclude non-llm models (embedding, tts, etc.) — they have dedicated pages under media-providers
    const allModels = [
      ...models,
      ...kiloFreeModels.filter((fm) => !models.some((m) => m.id === fm.id)),
    ].filter((m) => { const k = getModelKind(m); return !k || k === "llm"; });
    const disabledSet = new Set(disabledModelIds);
    const displayModels = allModels.filter((m) => !disabledSet.has(m.id));
    const disabledDisplayModels = allModels.filter((m) => disabledSet.has(m.id));
    const customModelRows = getProviderCustomModelRows({
      customModels,
      modelAliases,
      providerAlias: providerStorageAlias,
      builtInModels: models,
      type: "llm",
    });

    return (
      <div className="flex flex-wrap gap-3">
        {/* Custom models first */}
        {customModelRows.map((model) => (
          <ModelRow
            key={`${model.source}-${model.fullModel}`}
            model={{ id: model.id, name: model.name }}
            fullModel={`${providerDisplayAlias}/${model.id}`}
            alias={model.alias}
            copied={copied}
            onCopy={copy}
            onSetAlias={() => {}}
            onDeleteAlias={() => {
              if (model.source === "custom") {
                handleDeleteCustomModel(model.id, "llm", providerStorageAlias);
              } else {
                handleDeleteAlias(model.alias);
              }
            }}
            testStatus={modelTestResults[model.id]}
            onTest={connections.length > 0 || isFreeNoAuth ? () => handleTestModel(model.id) : undefined}
            isTesting={testingModelIds.has(model.id)}
            isCustom
            isFree={false}
            caps={getCaps(`${providerId}/${model.id}`)}
            thinkingSuffix={resolveThinkingSuffix(model.id)}
          />
        ))}

        {displayModels.map((model) => {
          const fullModel = `${providerStorageAlias}/${model.id}`;
          const oldFormatModel = `${providerId}/${model.id}`;
          const existingAlias = Object.entries(modelAliases).find(
            ([, m]) => m === fullModel || m === oldFormatModel
          )?.[0];
          return (
            <ModelRow
              key={model.id}
              model={model}
              fullModel={`${providerDisplayAlias}/${model.id}`}
              alias={existingAlias}
              copied={copied}
              onCopy={copy}
              onSetAlias={(alias) => handleSetAlias(model.id, alias, providerStorageAlias)}
              onDeleteAlias={() => handleDeleteAlias(existingAlias)}
              testStatus={modelTestResults[model.id]}
              onTest={connections.length > 0 || isFreeNoAuth ? () => handleTestModel(model.id) : undefined}
              isTesting={testingModelIds.has(model.id)}
              isFree={model.isFree}
              onDisable={() => handleDisableModel(model.id)}
              caps={getCaps(`${providerId}/${model.id}`)}
              thinkingSuffix={resolveThinkingSuffix(model.id)}
            />
          );
        })}

        {/* Add model button — inline, same style as model chips */}
        <button
          onClick={() => setShowAddCustomModel(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/40 px-3 py-2 text-xs text-primary transition-colors hover:border-primary hover:bg-primary/5 sm:w-auto"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add Model
        </button>

        {/* Import Qoder models button — only show for qoder/qoder-cn provider */}
        {(providerId === "qoder" || providerId === "qoder-cn") && connections.some((conn) => conn.isActive !== false) && (
          <button
            onClick={handleImportQoderModels}
            disabled={importingQoderModels}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-blue-500/40 px-3 py-2 text-xs text-blue-600 dark:text-blue-400 transition-colors hover:border-blue-500 hover:bg-blue-500/5 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-sm" style={importingQoderModels ? { animation: "spin 1s linear infinite" } : undefined}>
              {importingQoderModels ? "progress_activity" : "download"}
            </span>
            {importingQoderModels ? translate("Fetching...") : translate("Fetch Qoder Models")}
          </button>
        )}

        {/* Import Cline /models catalog button — only show for cline and clinepass providers */}
        {(providerId === "cline" || providerId === "clinepass") && connections.some((conn) => conn.isActive !== false) && (
          <button
            onClick={handleImportClineModels}
            disabled={importingClineModels}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-blue-500/40 px-3 py-2 text-xs text-blue-600 dark:text-blue-400 transition-colors hover:border-blue-500 hover:bg-blue-500/5 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-sm" style={importingClineModels ? { animation: "spin 1s linear infinite" } : undefined}>
              {importingClineModels ? "progress_activity" : "download"}
            </span>
            {importingClineModels ? translate("Fetching...") : translate("Import from /models")}
          </button>
        )}

        {/* Suggested models from provider API — show only models not yet added */}
        {suggestedModels.length > 0 && (() => {
          const addedFullModels = new Set([
            ...Object.values(modelAliases),
            ...customModelRows.map((model) => model.fullModel),
          ]);
          const hardcodedIds = new Set(models.map((m) => m.id));
          const notAdded = suggestedModels.filter(
            (m) => !addedFullModels.has(`${providerStorageAlias}/${m.id}`) && !hardcodedIds.has(m.id)
          );
          if (notAdded.length === 0) return null;
          return (
            <div className="w-full mt-2">
              <p className="text-xs text-text-muted mb-2">Suggested free models (≥200k context):</p>
              <div className="flex flex-wrap gap-2">
                {notAdded.map((m) => (
                  <button
                    key={m.id}
                    onClick={async () => {
                      await handleAddCustomModel(m.id, "llm", providerStorageAlias);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-xs text-text-muted hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    title={`${m.name} · ${(m.contextLength / 1000).toFixed(0)}k ctx`}
                  >
                    <span className="material-symbols-outlined text-[13px]">add</span>
                    {m.id.split("/").pop()}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Disabled models — restorable */}
        {disabledDisplayModels.length > 0 && (
          <div className="w-full mt-2">
            <p className="text-xs text-text-muted mb-2">Disabled models ({disabledDisplayModels.length}):</p>
            <div className="flex flex-wrap gap-2">
              {disabledDisplayModels.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleEnableModel(m.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-black/10 dark:border-white/10 text-xs text-text-muted hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  title="Restore model"
                >
                  <span className="material-symbols-outlined text-[13px]">add</span>
                  {m.id}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">
            {"Available Models"}
          </h2>
          {providerThinkingLevels && (
            <select
              value={thinkingMode}
              onChange={(e) => handleThinkingModeChange(e.target.value)}
              title="Appends (level) suffix to copied model names"
              className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none"
            >
              {providerThinkingLevels.map((opt) => (
                <option key={opt} value={opt}>{`Thinking: ${opt.charAt(0).toUpperCase() + opt.slice(1)}`}</option>
              ))}
            </select>
          )}
        </div>
        {!isCompatible && (() => {
          const allIds = [
            ...models,
            ...kiloFreeModels.filter((fm) => !models.some((m) => m.id === fm.id)),
          ].filter((m) => { const k = getModelKind(m); return !k || k === "llm"; }).map((m) => m.id);
          const activeIds = allIds.filter((id) => !disabledModelIds.includes(id));
          return (
            <div className="flex gap-2">
              {disabledModelIds.length > 0 && (
                <Button size="sm" variant="secondary" icon="restart_alt" onClick={handleEnableAll}>
                  Active All
                </Button>
              )}
              {activeIds.length > 0 && (
                <Button size="sm" variant="secondary" icon="block" onClick={() => handleDisableAll(activeIds)}>
                  Disable All
                </Button>
              )}
            </div>
          );
        })()}
      </div>
      {!!modelsTestError && (
        <div className="mb-3">
          <p className="text-xs text-red-500 break-words">{modelsTestError}</p>
          {/RegionError|hosted in China|regionNotAllowed/i.test(modelsTestError) && (() => {
            const str = typeof modelsTestError === "string" ? modelsTestError : JSON.stringify(modelsTestError);
            const linkMatch = str.match(/https:\/\/opencode\.ai\/workspace\/[^\s"')]+/);
            const wrkMatch = str.match(/wrk_[0-9A-Za-z]+/);
            const targetUrl = linkMatch
              ? (linkMatch[0].endsWith("/go") ? linkMatch[0] : `${linkMatch[0]}/go`)
              : wrkMatch
                ? `https://opencode.ai/workspace/${wrkMatch[0]}/go`
                : "https://opencode.ai";

            return (
              <div className="mt-1.5">
                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 hover:bg-amber-500/20 dark:text-amber-400 transition-colors"
                >
                  <span>Allow China-hosted models</span>
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                </a>
              </div>
            );
          })()}
        </div>
      )}
      {providerId === "zed" && !!liveModelsError && (
        <p className="text-xs text-red-500 mb-3 break-words">{liveModelsError}</p>
      )}
      {renderModels()}
    </Card>
  );
}
