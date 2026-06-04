import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import api from "@/hooks/useApi";
import { apiConfig } from "@/config";

export type SystemIdentity = {
  systemName: string;
  systemSubtitle: string;
  appTitle: string;
  titleMode: "title_only" | "title_section";
  logoUrl: string;
  faviconUrl: string;
};

type SystemIdentityContextValue = {
  identity: SystemIdentity;
  isLoading: boolean;
  refreshIdentity: () => Promise<void>;
  updateIdentity: (formData: FormData) => Promise<SystemIdentity>;
  resolveAssetUrl: (value: string) => string;
};

type IdentityResponse = {
  success: boolean;
  data: SystemIdentity;
};

const defaultIdentity: SystemIdentity = {
  systemName: "IT Utils",
  systemSubtitle: "Internal tools and admin workspace",
  appTitle: "IT Utils",
  titleMode: "title_only",
  logoUrl: "",
  faviconUrl: "",
};

const backendOrigin = (() => {
  try {
    return new URL(apiConfig.backendBaseUrl, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
})();

const SystemIdentityContext = createContext<SystemIdentityContextValue | null>(null);

export const SystemIdentityProvider = ({ children }: { children: ReactNode }) => {
  const [identity, setIdentity] = useState<SystemIdentity>(defaultIdentity);
  const [isLoading, setIsLoading] = useState(true);

  const resolveAssetUrl = (value: string) => {
    if (!value) return "";
    if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
    return `${backendOrigin}${value.startsWith("/") ? value : `/${value}`}`;
  };

  const applyBrowserIdentity = (next: SystemIdentity) => {
    const faviconUrl = resolveAssetUrl(next.faviconUrl);
    if (!faviconUrl) return;

    let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    favicon.href = faviconUrl;
  };

  const refreshIdentity = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<IdentityResponse>("/system-setting/identity");
      const next = { ...defaultIdentity, ...(response.data.data ?? {}) };
      setIdentity(next);
      applyBrowserIdentity(next);
    } finally {
      setIsLoading(false);
    }
  };

  const updateIdentity = async (formData: FormData) => {
    const response = await api.put<IdentityResponse>("/system-setting/identity", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const next = { ...defaultIdentity, ...response.data.data };
    setIdentity(next);
    applyBrowserIdentity(next);
    return next;
  };

  useEffect(() => {
    void refreshIdentity();
  }, []);

  const value = useMemo(
    () => ({
      identity,
      isLoading,
      refreshIdentity,
      updateIdentity,
      resolveAssetUrl,
    }),
    [identity, isLoading],
  );

  return (
    <SystemIdentityContext.Provider value={value}>
      {children}
    </SystemIdentityContext.Provider>
  );
};

export const useSystemIdentity = () => {
  const context = useContext(SystemIdentityContext);
  if (!context) {
    throw new Error("useSystemIdentity must be used within SystemIdentityProvider");
  }
  return context;
};
