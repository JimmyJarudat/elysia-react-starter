type AppEnv = "dev" | "production";

const resolveAppEnv = (value: unknown): AppEnv => {
  return value === "dev" ? "dev" : "production";
};

const appEnv = resolveAppEnv(import.meta.env.VITE_ENV);
const isDev = appEnv === "dev";

const BACKEND_DEV_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL ?? "https://localhost:3000/api";
const BACKEND_PRODUCTION_BASE_URL = "/api";

export const apiConfig = {
  appEnv,
  isDev,
  backendBaseUrl: isDev ? BACKEND_DEV_BASE_URL : BACKEND_PRODUCTION_BASE_URL,
} as const;

export type ApiConfig = typeof apiConfig;
