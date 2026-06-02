import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface MenuItem {
  id: number;
  path: string;
  label: string;
  icon_name: string;
  icon_library: "lucide-react";
  parent_id: number | null;
  sort_order: number;
  is_active: boolean;
  subItems?: MenuItem[];
}

interface MenuContextType {
  navItems: MenuItem[];
  menuLoading: boolean;
  fetchMenu: () => Promise<void>;
  hasAccess: (path: string) => boolean;
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

const mockMenu: MenuItem[] = [
  {
    id: 1,
    path: "/dashboard",
    label: "Dashboard",
    icon_name: "LayoutDashboard",
    icon_library: "lucide-react",
    parent_id: null,
    sort_order: 1,
    is_active: true,
    subItems: [
      {
        id: 11,
        path: "/dashboard/overview",
        label: "Overview",
        icon_name: "Activity",
        icon_library: "lucide-react",
        parent_id: 1,
        sort_order: 1,
        is_active: true,
      },
      {
        id: 12,
        path: "/dashboard/analytics",
        label: "Analytics",
        icon_name: "BarChart3",
        icon_library: "lucide-react",
        parent_id: 1,
        sort_order: 2,
        is_active: true,
      },
    ],
  },
  {
    id: 2,
    path: "/reports",
    label: "Reports",
    icon_name: "FileText",
    icon_library: "lucide-react",
    parent_id: null,
    sort_order: 2,
    is_active: true,
  },
  {
    id: 3,
    path: "/settings",
    label: "Settings",
    icon_name: "Settings",
    icon_library: "lucide-react",
    parent_id: null,
    sort_order: 3,
    is_active: true,
    subItems: [
      {
        id: 31,
        path: "/settings/profile",
        label: "Profile",
        icon_name: "User",
        icon_library: "lucide-react",
        parent_id: 3,
        sort_order: 1,
        is_active: true,
      },
    ],
  },
];

const collectPaths = (items: MenuItem[]): string[] =>
  items.flatMap((item) => [item.path, ...collectPaths(item.subItems ?? [])]);

export const MenuProvider = ({ children }: { children: ReactNode }) => {
  const [menuLoading, setMenuLoading] = useState(false);

  const paths = useMemo(() => collectPaths(mockMenu), []);

  const fetchMenu = async () => {
    setMenuLoading(true);
    await Promise.resolve();
    setMenuLoading(false);
  };

  const hasAccess = (path: string) => paths.some((itemPath) => path === itemPath || path.startsWith(`${itemPath}/`));

  return (
    <MenuContext.Provider value={{ navItems: mockMenu, menuLoading, fetchMenu, hasAccess }}>
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
