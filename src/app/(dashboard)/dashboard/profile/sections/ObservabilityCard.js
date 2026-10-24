"use client";

import { Card, Toggle } from "@/shared/components";

export default function ObservabilityCard({ settings, loading, onSettingsChange }) {
  const observabilityEnabled = settings.enableObservability === true;

  const updateObservabilityEnabled = async (enabled) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enableObservability: enabled }),
      });
      if (res.ok) {
        onSettingsChange(prev => ({ ...prev, enableObservability: enabled }));
      }
    } catch (err) {
      console.error("Failed to update enableObservability:", err);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500 shrink-0">
          <span className="material-symbols-outlined text-[20px]">monitoring</span>
        </div>
        <h3 className="text-base sm:text-lg font-semibold">Observability</h3>
      </div>
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm sm:text-base">Enable Observability</p>
          <p className="text-xs sm:text-sm text-text-muted">
            Record request details for inspection in the logs view
          </p>
        </div>
        <Toggle
          aria-label="Observability"
          checked={observabilityEnabled}
          onChange={updateObservabilityEnabled}
          disabled={loading}
        />
      </div>
    </Card>
  );
}
