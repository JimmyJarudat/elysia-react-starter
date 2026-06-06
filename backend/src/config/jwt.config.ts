import { getSecretSettingValue, getSettingValue } from "@/utils/get-setting-value";

export interface JwtConfig {
  secret: string;
  jit?: string;
  issuer: string;
  audience: string;
}

export async function getJwtConfig(): Promise<JwtConfig> {
  const [secret, jit, issuer, audience] = await Promise.all([
    getSecretSettingValue("jwt_secret"),
    getSettingValue("jwt_jit", ""),
    getSettingValue("jwt_issuer", "genesenn-it-utils"),
    getSettingValue("jwt_audience", "genesenn-it-utils-users"),
  ]);

  return {
    secret: secret || "change-this-jwt-secret",
    jit: String(jit || "").trim() || undefined,
    issuer: String(issuer || "genesenn-it-utils"),
    audience: String(audience || "genesenn-it-utils-users"),
  };
}
