import { apiConfig } from "@/config";

export const resolveBackendAssetUrl = (value?: string | null) => {
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;

  const origin = new URL(apiConfig.backendBaseUrl, window.location.origin).origin;
  return `${origin}${value.startsWith("/") ? value : `/${value}`}`;
};
