import { NavLink, useLocation } from "react-router-dom";
import { useRef, useState } from "react";
import { Activity, BarChart3, ChevronDown, ChevronRight, FileText, Home, LayoutDashboard, Settings, User } from "lucide-react";
import { useMenu, type MenuItem } from "@/contexts/MenuContext";
import { useSidebar } from "@/contexts/SidebarContext";

const iconMap = {
  Activity,
  BarChart3,
  FileText,
  Home,
  LayoutDashboard,
  Settings,
  User,
};

const SidebarIcon = ({ name }: { name: string }) => {
  const Icon = iconMap[name as keyof typeof iconMap] ?? Home;
  return <Icon size={20} />;
};

const Sidebar = () => {
  const { navItems } = useMenu();
  const { collapsed, toggleSubmenu, isExpanded } = useSidebar();
  const { pathname } = useLocation();
  const [hoveredMenuId, setHoveredMenuId] = useState<number | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFlyoutEnter = (id: number) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredMenuId(id);
  };

  const handleFlyoutLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredMenuId(null);
    }, 180);
  };

  const renderItem = (item: MenuItem) => {
    const hasChildren = Boolean(item.subItems?.length);
    const expanded = isExpanded(item.label);
    const showFlyout = collapsed && hoveredMenuId === item.id;
    const isRowActive = pathname === item.path || (!hasChildren && pathname.startsWith(`${item.path}/`));
    const navLinkBase =
      "flex min-h-11 flex-1 items-center gap-3 px-3 font-medium text-inherit transition-colors duration-200";
    const navLinkActive =
      "bg-gradient-to-r from-light-primary/20 to-light-accent/15 text-light-primary shadow-sm ring-1 ring-light-primary/30 dark:from-dark-primary/20 dark:to-dark-accent/15 dark:text-dark-primary dark:ring-dark-primary/30";
    const rowBase =
      "flex items-center rounded-md transition-colors duration-200 hover:bg-light-primary/10 hover:text-light-primary dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary";
    const submenuLinkBase =
      "flex min-h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-primary transition-colors duration-200 hover:bg-light-primary/10 hover:text-light-primary dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary";

    return (
      <div className="relative mb-1" key={item.id} onMouseEnter={() => handleFlyoutEnter(item.id)} onMouseLeave={handleFlyoutLeave}>
        <div className={`${rowBase} ${isRowActive ? navLinkActive : "text-primary"}`}>
          <NavLink
            className={`${navLinkBase} ${collapsed ? "justify-center px-0" : ""}`}
            to={item.path}
            end={!hasChildren}
          >
            <SidebarIcon name={item.icon_name} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
          {hasChildren && !collapsed && (
            <button
              className={`grid h-9 w-9 place-items-center rounded-md border-0 bg-transparent transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary ${
                isRowActive ? "text-light-primary dark:text-dark-primary" : "text-light-text-muted dark:text-dark-text-muted"
              }`}
              type="button"
              onClick={() => toggleSubmenu(item.label)}
              aria-label={`Toggle ${item.label}`}
            >
              {expanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
            </button>
          )}
        </div>

        {showFlyout && (
          <>
            <div className="absolute left-full top-0 h-full w-3" />
            <div
              className="absolute left-[calc(100%+0.75rem)] top-0 z-50 w-60 rounded-lg border border-theme bg-light-background-card p-2 text-light-text opacity-100 shadow-soft transition-all duration-150 dark:bg-dark-background-card dark:text-dark-text"
              onMouseEnter={() => handleFlyoutEnter(item.id)}
              onMouseLeave={handleFlyoutLeave}
            >
            <NavLink
              className={({ isActive }) =>
                `flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary ${
                  isActive ? navLinkActive : ""
                }`
              }
              to={item.path}
              end={!hasChildren}
            >
              <SidebarIcon name={item.icon_name} />
              <span>{item.label}</span>
            </NavLink>

            {hasChildren && (
              <div className="mt-2 border-t border-theme pt-2">
                {item.subItems?.map((subItem) => (
                  <NavLink
                    className={({ isActive }) =>
                      `flex min-h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-primary transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary ${
                        isActive ? navLinkActive : ""
                      }`
                    }
                    to={subItem.path}
                    key={subItem.id}
                  >
                    <SidebarIcon name={subItem.icon_name} />
                    <span>{subItem.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
            </div>
          </>
        )}

        {hasChildren && expanded && !collapsed && (
          <div className="mb-2 ml-6 mt-1 space-y-1 border-l-2 border-light-primary/30 pl-2 dark:border-dark-primary/30">
            {item.subItems?.map((subItem) => (
              <NavLink className={({ isActive }) => `${submenuLinkBase} ${isActive ? navLinkActive : ""}`} to={subItem.path} key={subItem.id}>
                <SidebarIcon name={subItem.icon_name} />
                <span>{subItem.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`sticky top-0 z-40 flex h-screen shrink-0 flex-col border-r border-light-border bg-gradient-to-b from-light-primary/10 via-light-background-soft/80 to-light-accent/10 shadow-soft transition-all duration-300 dark:border-dark-border dark:from-dark-background dark:via-dark-background-soft dark:to-dark-primary/10 max-[720px]:fixed ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex h-16 items-center gap-3 border-b border-light-border px-3 dark:border-dark-border">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-light-primary to-light-primary-hover text-sm font-extrabold tracking-normal text-white shadow-sm dark:from-dark-primary dark:to-dark-primary-hover dark:text-dark-background">
          ES
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <strong className="block truncate text-sm font-semibold text-light-text dark:text-dark-text">Elysia Starter</strong>
            <small className="mt-0.5 block truncate text-xs text-light-text-muted dark:text-dark-text-muted">Admin Console</small>
          </div>
        )}
      </div>
      <div className={`flex-1 space-y-1 px-2 py-3 scrollbar-ultra-thin ${collapsed ? "overflow-visible" : "overflow-y-auto"}`}>
        {navItems.map(renderItem)}
      </div>
    </aside>
  );
};

export default Sidebar;
