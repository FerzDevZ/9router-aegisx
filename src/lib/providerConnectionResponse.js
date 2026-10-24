import { AI_PROVIDERS } from "@/shared/constants/providers";

export function usesAwsCredentialForm(provider) {
  return AI_PROVIDERS[provider]?.credentialForm === "aws";
}

// Secret-bearing providerSpecificData keys that must never reach the dashboard
// client. Suffix match so expiry/metadata companions (copilotTokenExpiresAt,
// mimoUserId, deviceId, …) survive; `/cookie/i` catches cookie jars stored
// under composite names. Server-side routes read the raw values from the DB —
// this redaction only applies to serialized API responses.
const PSD_SECRET_SUFFIX = /(token|secret|password|credential)$/i;

function stripPsdSecrets(providerSpecificData) {
  if (!providerSpecificData || typeof providerSpecificData !== "object") return providerSpecificData;
  const out = {};
  for (const [key, value] of Object.entries(providerSpecificData)) {
    if (PSD_SECRET_SUFFIX.test(key)) continue;
    if (/cookie/i.test(key)) continue;
    out[key] = value;
  }
  return out;
}

export function toProviderConnectionResponse(connection) {
  const { apiKey, accessToken, refreshToken, idToken, ...safe } = connection;

  if (!connection.providerSpecificData) {
    return safe;
  }

  return { ...safe, providerSpecificData: stripPsdSecrets(connection.providerSpecificData) };
}
