// SidebarContext.tsx - เพิ่มฟังก์ชันใหม่
import { createContext, useState, useContext, useEffect, type ReactNode } from 'react';

type SidebarContextType = {
  collapsed: boolean;
  toggleSidebar: () => void;
  openSidebar: () => void;  // เพิ่มฟังก์ชันนี้
  closeSidebar: () => void; // เพิ่มฟังก์ชันนี้
  expandedMenus: string[];
  toggleSubmenu: (label: string) => void;
  isExpanded: (label: string) => boolean;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider = ({ children }: { children: ReactNode }) => {
  const [collapsed, setCollapsed] = useState(() => {
    const savedState = localStorage.getItem('sidebarCollapsed');
    return savedState ? JSON.parse(savedState) : false;
  });

  const [expandedMenus, setExpandedMenus] = useState<string[]>(() => {
    const savedState = localStorage.getItem('expandedMenus');
    return savedState ? JSON.parse(savedState) : [];
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(collapsed));
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem('expandedMenus', JSON.stringify(expandedMenus));
  }, [expandedMenus]);

  const toggleSidebar = () => {
    setCollapsed((prev: boolean) => !prev);
  };

  // ฟังก์ชันเปิด sidebar (ไม่ toggle)
  const openSidebar = () => {
    setCollapsed(false);
  };

  // ฟังก์ชันปิด sidebar (ไม่ toggle)
  const closeSidebar = () => {
    setCollapsed(true);
  };

  const toggleSubmenu = (label: string) => {
    setExpandedMenus(prev =>
      prev.includes(label)
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  const isExpanded = (label: string) => {
    return expandedMenus.includes(label);
  };

  return (
    <SidebarContext.Provider value={{ 
      collapsed, 
      toggleSidebar,
      openSidebar,   // เพิ่มใน Provider
      closeSidebar,  // เพิ่มใน Provider
      expandedMenus,
      toggleSubmenu,
      isExpanded
    }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};
