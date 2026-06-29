import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import api from "@/hooks/useApi";

export type FeatureFlags = {
  navbarSearch: boolean;
  notifications: boolean;
  appearancePanel: boolean;
  themeToggle: boolean;
};

type FeatureFlagsResponse = {
  success: boolean;
  data: FeatureFlags;
};

type FeatureFlagsContextValue = {
  flags: FeatureFlags;
  isLoading: boolean;
  refreshFlags: () => Promise<void>;
};

const disabledFlags: FeatureFlags = {
  navbarSearch: false,
  notifications: false,
  appearancePanel: false,
  themeToggle: false,
};

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined);

export const FeatureFlagsProvider = ({ children }: { children: ReactNode }) => {
  const [flags, setFlags] = useState<FeatureFlags>(disabledFlags);
  const [isLoading, setIsLoading] = useState(true);

  const refreshFlags = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get<FeatureFlagsResponse>("/system-setting/feature-flags");
      if (response.data.success) {
        setFlags({ ...disabledFlags, ...response.data.data });
      }
    } catch {
      setFlags(disabledFlags);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshFlags();
  }, [refreshFlags]);

  const value = useMemo(() => ({ flags, isLoading, refreshFlags }), [flags, isLoading, refreshFlags]);

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

export const useFeatureFlags = () => {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error("useFeatureFlags must be used within FeatureFlagsProvider");
  }
  return context;
};
