export interface JwtConfig {
  secret: string;
  jit?: string;
  issuer: string;
  audience: string;
}

export async function getJwtConfig(): Promise<JwtConfig> {
  return {
    secret: process.env["JWT_SECRET"] ?? "change-this-jwt-secret",
    jit: process.env["JWT_JIT"],
    issuer: process.env["JWT_ISSUER"] ?? "genesenn-it-utils",
    audience: process.env["JWT_AUDIENCE"] ?? "genesenn-it-utils-users",
  };
}
