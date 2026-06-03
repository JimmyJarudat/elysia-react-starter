import { createContext, useState, useContext, useEffect, type ReactNode } from 'react';

type SidebarContextType = {
  collapsed: boolean;
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  mobileOpen: boolean;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  expandedMenus: string[];
  toggleSubmenu: (label: string) => void;
  isExpanded: (label: string) => boolean;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider = ({ children }: { children: ReactNode }) => {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  const [expandedMenus, setExpandedMenus] = useState<string[]>(() => {
    const saved = localStorage.getItem('expandedMenus');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(collapsed));
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem('expandedMenus', JSON.stringify(expandedMenus));
  }, [expandedMenus]);

  // ปิด sidebar mobile เมื่อ resize ขึ้นไป desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 720) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggleSidebar = () => setCollapsed((prev: boolean) => !prev);
  const openSidebar = () => setCollapsed(false);
  const closeSidebar = () => setCollapsed(true);

  const toggleMobileSidebar = () => setMobileOpen((prev) => !prev);
  const closeMobileSidebar = () => setMobileOpen(false);

  const toggleSubmenu = (label: string) => {
    setExpandedMenus((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label],
    );
  };

  const isExpanded = (label: string) => expandedMenus.includes(label);

  return (
    <SidebarContext.Provider value={{
      collapsed,
      toggleSidebar, openSidebar, closeSidebar,
      mobileOpen, toggleMobileSidebar, closeMobileSidebar,
      expandedMenus, toggleSubmenu, isExpanded,
    }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('useSidebar must be used within a SidebarProvider');
  return context;
};
