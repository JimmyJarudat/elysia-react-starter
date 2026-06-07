import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AxiosError } from "axios";
import { useApi } from "@/hooks/useApi";

export interface SessionSecurity {
  mustChangePassword: boolean;
  isEmailVerified: boolean;
  hasTwoFactor: boolean | null;
  passwordExpiry: boolean;
  accountExpiry: string | null;
  temporaryAccount: boolean;
}

export interface User {
  id: number;
  username: string;
  email: string;
  language: "EN" | "TH";
  isEmailVerified: boolean;
  security: SessionSecurity;
  roles: string[];
  permissions: string[];
  profile: {
    firstName: string;
    lastName: string;
    displayName: string;
    avatarUrl: string;
    phoneNumber: string;
  };
}

export interface LoginResult {
  success: boolean;
  error?: string;
  requiresTwoFactor?: boolean;
  tfaSessionToken?: string;
}

interface LoginResponse {
  success?: boolean;
  message?: string;
  accessToken?: string;
  requiresTwoFactor?: boolean;
  tfaSessionToken?: string;
  user?: User | null;
  security?: SessionSecurity;
}

interface MeResponse {
  success?: boolean;
  user?: User | null;
}

export interface RefreshResult {
  success: boolean;
  token: string | null;
  user?: User | null;
}

interface SessionContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<RefreshResult>;
  updateUser: (user: User | null) => void;
  updateAccessToken: (token: string | null) => void;
  updateAuthenticated: (auth: boolean) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

const getApiErrorMessage = (error: unknown) => {
  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? (error instanceof Error ? error.message : "Unable to log in");
};

const normalizeUser = (user?: User | null, security?: SessionSecurity) => {
  if (!user) return null;

  const nextSecurity = user.security ?? security ?? {
    mustChangePassword: false,
    isEmailVerified: user.isEmailVerified,
    hasTwoFactor: null,
    passwordExpiry: false,
    accountExpiry: null,
    temporaryAccount: false,
  };

  return {
    ...user,
    isEmailVerified: nextSecurity.isEmailVerified,
    security: nextSecurity,
  };
};

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const { get, post } = useApi();
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      try {
        const response = await get<MeResponse>("/auth/me", { skipAuthRefresh: true });
        const payload = response.data;

        if (!active) {
          return;
        }

        setUser(normalizeUser(payload.user));
        setIsAuthenticated(Boolean(payload.success && payload.user));
      } catch {
        if (!active) {
          return;
        }

        setUser(null);
        setAccessToken(null);
        setIsAuthenticated(false);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void restoreSession();

    return () => {
      active = false;
    };
  }, []);

  const login = async (username: string, password: string): Promise<LoginResult> => {
    try {
      const response = await post<LoginResponse>(
        "/auth/login",
        {
          username: username.trim(),
          password,
        },
        { skipAuthRefresh: true },
      );

      const payload = response.data;

      if (payload.requiresTwoFactor) {
        return { success: true, requiresTwoFactor: true, tfaSessionToken: payload.tfaSessionToken };
      }

      if (payload.success === false) {
        return { success: false, error: payload.message ?? "Unable to log in" };
      }

      setUser(normalizeUser(payload.user, payload.security));
      setAccessToken(payload.accessToken ?? null);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      setUser(null);
      setAccessToken(null);
      setIsAuthenticated(false);
      return { success: false, error: getApiErrorMessage(error) };
    }
  };

  const logout = async () => {
    try {
      await post("/auth/logout", undefined, { skipAuthRefresh: true });
    } finally {
      setUser(null);
      setAccessToken(null);
      setIsAuthenticated(false);
    }
  };

  const refreshAccessToken = async () => ({ success: true, token: accessToken, user });

  return (
    <SessionContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        accessToken,
        login,
        logout,
        refreshAccessToken,
        updateUser: setUser,
        updateAccessToken: setAccessToken,
        updateAuthenticated: setIsAuthenticated,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
};
