import { createContext, useContext, useState, type ReactNode } from "react";

export interface User {
  id: number;
  username: string;
  email: string;
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

interface LoginResult {
  success: boolean;
  error?: string;
}

interface RefreshResult {
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

const mockUser: User = {
  id: 1,
  username: "admin",
  email: "admin@example.com",
  roles: ["SUPERADMIN"],
  permissions: ["*"],
  profile: {
    firstName: "Admin",
    lastName: "Demo",
    displayName: "Admin Demo",
    avatarUrl: "",
    phoneNumber: "",
  },
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(mockUser);
  const [accessToken, setAccessToken] = useState<string | null>("mock-token");
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  const login = async () => {
    setUser(mockUser);
    setAccessToken("mock-token");
    setIsAuthenticated(true);
    return { success: true };
  };

  const logout = async () => {
    setUser(null);
    setAccessToken(null);
    setIsAuthenticated(false);
  };

  const refreshAccessToken = async () => ({ success: true, token: accessToken, user });

  return (
    <SessionContext.Provider
      value={{
        user,
        isLoading: false,
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
