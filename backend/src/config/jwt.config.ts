import { getSecretSettingValue, getSettingValue } from "@/utils/get-setting-value";

export interface JwtConfig {
  secret: string;
  jit?: string;
  issuer: string;
  audience: string;
}

export async function getJwtConfig(): Promise<JwtConfig> {
  const secret = await getSecretSettingValue("jwt_secret");
  const jit = await getSettingValue("jwt_jit", "");
  const issuer = await getSettingValue("jwt_issuer", "genesenn-it-utils");
  const audience = await getSettingValue("jwt_audience", "genesenn-it-utils-users");

  return {
    secret: secret || "change-this-jwt-secret",
    jit: String(jit || "").trim() || undefined,
    issuer: String(issuer || "genesenn-it-utils"),
    audience: String(audience || "genesenn-it-utils-users"),
  };
}
