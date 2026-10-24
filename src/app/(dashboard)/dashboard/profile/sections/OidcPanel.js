"use client";

import { Button, Input } from "@/shared/components";

export default function OidcPanel({
  oidcForm,
  updateOidcForm,
  oidcClientSecret,
  setOidcClientSecret,
  oidcRedirectUri,
  loading,
  oidcLoading,
  oidcTestLoading,
  oidcTestStatus,
  oidcStatus,
  saveOidcSettings,
  testOidcConnection,
}) {
  return (
    <div className="flex flex-col gap-4 pt-2 border-t border-border/50">
      <div className="grid grid-cols-1 gap-4">
        <div className="flex flex-col gap-2">
          <label className="font-medium text-sm sm:text-base">Issuer URL</label>
          <Input
            placeholder="https://auth.example.com/application/o/9router/"
            value={oidcForm.oidcIssuerUrl}
            onChange={(e) => updateOidcForm("oidcIssuerUrl", e.target.value)}
            disabled={loading || oidcLoading}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-medium text-sm sm:text-base">Client ID</label>
          <Input
            placeholder="9router-dashboard"
            value={oidcForm.oidcClientId}
            onChange={(e) => updateOidcForm("oidcClientId", e.target.value)}
            disabled={loading || oidcLoading}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-medium text-sm sm:text-base">Client Secret</label>
          <Input
            type="password"
            placeholder="Leave blank to keep existing secret"
            value={oidcClientSecret}
            onChange={(e) => setOidcClientSecret(e.target.value)}
            disabled={loading || oidcLoading}
          />
          <p className="text-xs sm:text-sm text-text-muted">This value is write-only after saving.</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-medium text-sm sm:text-base">Scopes</label>
          <Input
            placeholder="openid profile email"
            value={oidcForm.oidcScopes}
            onChange={(e) => updateOidcForm("oidcScopes", e.target.value)}
            disabled={loading || oidcLoading}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-medium text-sm sm:text-base">Login Button Label</label>
          <Input
            placeholder="Sign in with OIDC"
            value={oidcForm.oidcLoginLabel}
            onChange={(e) => updateOidcForm("oidcLoginLabel", e.target.value)}
            disabled={loading || oidcLoading}
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-bg p-3 text-xs sm:text-sm text-text-muted">
        <p className="font-medium text-text-main mb-1">Redirect URI</p>
        <code className="block break-all font-mono">{oidcRedirectUri}</code>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/50">
        <Button type="button" variant="primary" loading={oidcLoading} onClick={() => saveOidcSettings()} className="w-full sm:w-auto">
          Save OIDC settings
        </Button>
        <Button type="button" variant="outline" loading={oidcTestLoading} onClick={testOidcConnection} className="w-full sm:w-auto">
          Test connection
        </Button>
      </div>

      {oidcTestStatus.message && (
        <p className={`text-xs sm:text-sm ${oidcTestStatus.type === "error" ? "text-red-500" : "text-green-500"}`}>
          {oidcTestStatus.message}
        </p>
      )}

      {oidcStatus.message && (
        <p className={`text-xs sm:text-sm ${oidcStatus.type === "error" ? "text-red-500" : "text-green-500"}`}>
          {oidcStatus.message}
        </p>
      )}
    </div>
  );
}
