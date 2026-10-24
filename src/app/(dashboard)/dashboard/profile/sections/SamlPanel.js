"use client";

import { Button, Input } from "@/shared/components";

export default function SamlPanel({
  samlForm,
  updateSamlForm,
  loading,
  samlLoading,
  samlTestLoading,
  samlTestStatus,
  samlStatus,
  setSamlStatus,
  showSamlGuide,
  setShowSamlGuide,
  samlAcsUrl,
  samlMetadataUrl,
  idpMetadataFileRef,
  handleIdpMetadataUpload,
  certFileRef,
  handleCertFileUpload,
  authMode,
  saveSamlSettings,
  testSamlConnection,
}) {
  return (
    <div className="flex flex-col gap-4 pt-2 border-t border-border/50">
      {/* IdP Setup Guidelines Banner & Collapsible Drawer */}
      <div className="rounded-lg border border-border bg-bg/80 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSamlGuide((prev) => !prev)}
          className="w-full p-3 flex items-center justify-between gap-2 text-left hover:bg-surface/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">menu_book</span>
            <div>
              <p className="font-semibold text-xs sm:text-sm text-text-main">
                IdP Setup Guidelines & Provider Configuration Instructions
              </p>
              <p className="text-[11px] text-text-muted">
                Click to view setup steps for AWS IAM Identity Center, Okta, Entra ID, Keycloak, & Authentik
              </p>
            </div>
          </div>
          <span
            className="material-symbols-outlined text-text-muted transition-transform text-lg"
            style={{ transform: showSamlGuide ? "rotate(180deg)" : "none" }}
          >
            expand_more
          </span>
        </button>

        {showSamlGuide && (
          <div className="p-4 border-t border-border bg-surface/30 text-xs text-text-main flex flex-col gap-3">
            <div className="p-2.5 rounded border border-primary/20 bg-primary/5 text-primary text-xs">
              <p className="font-semibold mb-1">🔑 Required Service Provider (SP) Values for your IdP Setup:</p>
              <ul className="list-disc pl-4 space-y-1 font-mono text-[11px]">
                <li>
                  <b>Assertion Consumer Service (ACS) URL:</b>{" "}
                  <code className="bg-bg px-1 py-0.5 rounded break-all">{samlAcsUrl}</code>
                </li>
                <li>
                  <b>SP Entity ID / Audience URI:</b>{" "}
                  <code className="bg-bg px-1 py-0.5 rounded break-all">{samlForm.samlIssuer || "urn:9router:sp"}</code>
                </li>
                <li>
                  <b>NameID Format:</b>{" "}
                  <code className="bg-bg px-1 py-0.5 rounded">EmailAddress</code> or <code className="bg-bg px-1 py-0.5 rounded">Unspecified</code>
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded border border-border bg-bg/50 flex flex-col gap-1.5">
                <p className="font-semibold text-text-main flex items-center gap-1.5">
                  <span>☁️</span> AWS IAM Identity Center
                </p>
                <ol className="list-decimal pl-4 text-text-muted space-y-1">
                  <li>Applications → <b>Add application</b> → Select <b>Add custom SAML 2.0 application</b>.</li>
                  <li>Set <b>Application ACS URL</b> to <code className="text-text-main font-mono">{samlAcsUrl}</code>.</li>
                  <li>Set <b>Application SAML audience</b> to <code className="text-text-main font-mono">{samlForm.samlIssuer || "urn:9router:sp"}</code>.</li>
                  <li>Under <i>Attribute mappings</i>, map <code className="text-text-main font-mono">Subject</code> or <code className="text-text-main font-mono">email</code> to <code className="text-text-main font-mono">${`{user:email}`}</code>.</li>
                  <li>Download <b>IAM Identity Center SAML metadata XML</b> file and use 1-Click Import below!</li>
                </ol>
              </div>

              <div className="p-3 rounded border border-border bg-bg/50 flex flex-col gap-1.5">
                <p className="font-semibold text-text-main flex items-center gap-1.5">
                  <span>🔷</span> Microsoft Entra ID (Azure AD)
                </p>
                <ol className="list-decimal pl-4 text-text-muted space-y-1">
                  <li>Enterprise Applications → <b>New application</b> → <b>Create your own application</b>.</li>
                  <li>Select <b>Single sign-on</b> → <b>SAML</b>.</li>
                  <li><b>Identifier (Entity ID):</b> <code className="text-text-main font-mono">{samlForm.samlIssuer || "urn:9router:sp"}</code></li>
                  <li><b>Reply URL (ACS):</b> <code className="text-text-main font-mono">{samlAcsUrl}</code></li>
                  <li>Download <b>Federation Metadata XML</b> and import or copy X.509 Certificate.</li>
                </ol>
              </div>

              <div className="p-3 rounded border border-border bg-bg/50 flex flex-col gap-1.5">
                <p className="font-semibold text-text-main flex items-center gap-1.5">
                  <span>🟢</span> Okta / Auth0
                </p>
                <ol className="list-decimal pl-4 text-text-muted space-y-1">
                  <li>Applications → <b>Create App Integration</b> → Select <b>SAML 2.0</b>.</li>
                  <li><b>Single Sign-On URL:</b> <code className="text-text-main font-mono">{samlAcsUrl}</code></li>
                  <li><b>Audience URI (SP Entity ID):</b> <code className="text-text-main font-mono">{samlForm.samlIssuer || "urn:9router:sp"}</code></li>
                  <li>Name ID format: <i>EmailAddress</i>.</li>
                  <li>Download Identity Provider metadata XML or copy the X.509 cert.</li>
                </ol>
              </div>

              <div className="p-3 rounded border border-border bg-bg/50 flex flex-col gap-1.5">
                <p className="font-semibold text-text-main flex items-center gap-1.5">
                  <span>🛡️</span> Keycloak / Authentik
                </p>
                <ol className="list-decimal pl-4 text-text-muted space-y-1">
                  <li>Clients → <b>Create client</b> → Select <b>SAML</b>.</li>
                  <li><b>Client ID:</b> <code className="text-text-main font-mono">{samlForm.samlIssuer || "urn:9router:sp"}</code></li>
                  <li><b>Master SAML Processing URL:</b> <code className="text-text-main font-mono">{samlAcsUrl}</code></li>
                  <li>Export SAML Descriptor XML or copy IDP Certificate PEM.</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Import Card */}
      <div className="p-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-medium text-sm text-text-main">1-Click IdP Metadata XML Import</p>
          <p className="text-xs text-text-muted">Auto-fill SSO URL, Issuer & Cert from XML metadata</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon="upload_file"
          onClick={() => idpMetadataFileRef.current?.click()}
        >
          Upload Metadata XML
        </Button>
        <input
          ref={idpMetadataFileRef}
          type="file"
          accept=".xml,application/xml,text/xml"
          className="hidden"
          onChange={handleIdpMetadataUpload}
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="flex flex-col gap-2">
          <label className="font-medium text-sm sm:text-base">Single Sign-On Service URL (samlEntryPoint)</label>
          <Input
            placeholder="https://idp.example.com/app/saml/sso/..."
            value={samlForm.samlEntryPoint}
            onChange={(e) => updateSamlForm("samlEntryPoint", e.target.value)}
            disabled={loading || samlLoading}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-medium text-sm sm:text-base">SP Entity ID / Audience (samlIssuer)</label>
          <Input
            placeholder="urn:9router:sp"
            value={samlForm.samlIssuer}
            onChange={(e) => updateSamlForm("samlIssuer", e.target.value)}
            disabled={loading || samlLoading}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="font-medium text-sm sm:text-base">IdP X.509 Certificate (samlCert)</label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon="file_upload"
              onClick={() => certFileRef.current?.click()}
            >
              Upload Certificate
            </Button>
            <input
              ref={certFileRef}
              type="file"
              accept=".crt,.pem,.cer,text/plain"
              className="hidden"
              onChange={handleCertFileUpload}
            />
          </div>
          <textarea
            rows={4}
            placeholder="-----BEGIN CERTIFICATE-----&#10;MIIC...&#10;-----END CERTIFICATE-----"
            value={samlForm.samlCert}
            onChange={(e) => updateSamlForm("samlCert", e.target.value)}
            className="w-full p-2.5 rounded-lg border border-border bg-bg text-xs font-mono text-text-main focus:outline-none focus:border-primary"
            disabled={loading || samlLoading}
          />
          <p className="text-xs text-text-muted">Paste raw Base64 certificate or PEM block.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-2">
            <label className="font-medium text-sm sm:text-base">Login Button Label</label>
            <Input
              placeholder="Sign in with SAML SSO"
              value={samlForm.samlLoginLabel}
              onChange={(e) => updateSamlForm("samlLoginLabel", e.target.value)}
              disabled={loading || samlLoading}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-medium text-sm sm:text-base">Email Claim Attribute</label>
            <Input
              placeholder="email"
              value={samlForm.samlAttributeEmail}
              onChange={(e) => updateSamlForm("samlAttributeEmail", e.target.value)}
              disabled={loading || samlLoading}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-medium text-sm sm:text-base">Display Name Claim</label>
            <Input
              placeholder="name"
              value={samlForm.samlAttributeName}
              onChange={(e) => updateSamlForm("samlAttributeName", e.target.value)}
              disabled={loading || samlLoading}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-bg text-xs sm:text-sm text-text-muted">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-medium text-text-main">ACS Callback URL</p>
            <code className="block break-all font-mono text-xs">{samlAcsUrl}</code>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon="content_copy"
            onClick={() => {
              navigator.clipboard.writeText(samlAcsUrl);
              setSamlStatus({ type: "success", message: "ACS URL copied to clipboard!" });
            }}
          >
            Copy
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
          <div>
            <p className="font-medium text-text-main">SP XML Metadata</p>
            <code className="block break-all font-mono text-xs">{samlMetadataUrl}</code>
          </div>
          <a
            href={samlMetadataUrl}
            target="_blank"
            rel="noopener noreferrer"
            download="9router-sp-metadata.xml"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Download XML
          </a>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/50">
        <Button
          type="button"
          variant="primary"
          loading={samlLoading}
          onClick={() => saveSamlSettings(authMode)}
          className="w-full sm:w-auto"
        >
          Save SAML settings
        </Button>
        <Button
          type="button"
          variant="outline"
          loading={samlTestLoading}
          onClick={testSamlConnection}
          className="w-full sm:w-auto"
        >
          Test SAML settings
        </Button>
      </div>

      {samlTestStatus.message && (
        <p className={`text-xs sm:text-sm ${samlTestStatus.type === "error" ? "text-red-500" : "text-green-500"}`}>
          {samlTestStatus.message}
        </p>
      )}

      {samlStatus.message && (
        <p className={`text-xs sm:text-sm ${samlStatus.type === "error" ? "text-red-500" : "text-green-500"}`}>
          {samlStatus.message}
        </p>
      )}
    </div>
  );
}
