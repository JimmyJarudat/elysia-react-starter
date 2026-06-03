import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/contexts/SessionContext";

export interface MenuItem {
  id: number;
  path: string;
  label: string;
  icon_name: string;
  icon_library: string;
  code: string | null;
  permission_id: string | null;
  parent_id: number | null;
  sort_order: number;
  is_active: boolean;
  subItems?: MenuItem[];
}

interface MenuResponse {
  success: boolean;
  data: MenuItem[];
  message?: string;
}

interface MenuContextType {
  navItems: MenuItem[];
  menuLoading: boolean;
  menuError: string | null;
  fetchMenu: () => Promise<void>;
  hasAccess: (path: string) => boolean;
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

const collectPaths = (items: MenuItem[]): string[] =>
  items.flatMap((item) => [item.path, ...collectPaths(item.subItems ?? [])]);

export const MenuProvider = ({ children }: { children: ReactNode }) => {
  const { get } = useApi();
  const { isAuthenticated, isLoading } = useSession();
  const [navItems, setNavItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);

  const paths = useMemo(() => collectPaths(navItems), [navItems]);

  const fetchMenu = useCallback(async () => {
    if (!isAuthenticated) {
      setNavItems([]);
      setMenuError(null);
      return;
    }

    setMenuLoading(true);
    setMenuError(null);

    try {
      const response = await get<MenuResponse>("/menus/me");
      setNavItems(response.data.data ?? []);
    } catch (error) {
      setNavItems([]);
      setMenuError(error instanceof Error ? error.message : "Unable to load menu");
    } finally {
      setMenuLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    void fetchMenu();
  }, [fetchMenu, isLoading]);

  const hasAccess = (path: string) =>
    paths.some((itemPath) => path === itemPath || path.startsWith(`${itemPath}/`));

  return (
    <MenuContext.Provider value={{ navItems, menuLoading, menuError, fetchMenu, hasAccess }}>
      {children}
    </MenuContext.Provider>
  );
};

export const useMenu = () => {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error("useMenu must be used within a MenuProvider");
  }
  return context;
};
