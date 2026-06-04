import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
import { ChevronDown, ChevronRight, Home, type LucideIcon } from "lucide-react";
import { useMenu, type MenuItem } from "@/contexts/MenuContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { useSystemIdentity } from "@/contexts/SystemIdentityContext";

const SidebarIcon = ({ name }: { name: string }) => {
  const Icon = (LucideIcons[name as keyof typeof LucideIcons] as LucideIcon | undefined) ?? Home;
  return <Icon size={20} />;
};

const Sidebar = () => {
  const { navItems, menuError, menuLoading } = useMenu();
  const { collapsed, toggleSubmenu, isExpanded, mobileOpen, closeMobileSidebar } = useSidebar();
  const { identity, resolveAssetUrl } = useSystemIdentity();
  const { pathname } = useLocation();
  const [hoveredMenuId, setHoveredMenuId] = useState<number | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 720);
  const appInitials = identity.systemName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "IT";

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 720);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const effectiveCollapsed = isMobile ? false : collapsed;

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
    const showFlyout = effectiveCollapsed && hoveredMenuId === item.id;
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
            className={`${navLinkBase} ${effectiveCollapsed ? "justify-center px-0" : ""}`}
            to={item.path}
            end={!hasChildren}
            onClick={closeMobileSidebar}
          >
            <SidebarIcon name={item.icon_name} />
            {!effectiveCollapsed && <span>{item.label}</span>}
          </NavLink>
          {hasChildren && !effectiveCollapsed && (
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

        {hasChildren && expanded && !effectiveCollapsed && (
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
    <>
      {/* Backdrop — mobile only */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          style={{ display: window.innerWidth <= 720 ? 'block' : 'none' }}
          onClick={closeMobileSidebar}
        />
      )}

    <aside
      className={`sticky top-0 z-50 flex h-screen shrink-0 flex-col border-r border-light-border bg-gradient-to-b from-light-primary/10 via-light-background-soft/80 to-light-accent/10 shadow-soft transition-all duration-300 dark:border-dark-border dark:from-dark-background dark:via-dark-background-soft dark:to-dark-primary/10 max-[720px]:fixed max-[720px]:top-0 max-[720px]:h-screen max-[720px]:w-80 max-[720px]:bg-light-background-card max-[720px]:dark:bg-dark-background-card ${
        collapsed ? "w-16" : "w-64"
      } ${
        mobileOpen ? "max-[720px]:translate-x-0" : "max-[720px]:-translate-x-full"
      }`}
    >
      <div className="flex h-16 items-center gap-3 border-b border-light-border bg-white/35 px-3 backdrop-blur dark:border-dark-border dark:bg-white/[0.03]">
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-xl bg-light-primary/25 blur-md dark:bg-dark-primary/25" />
          {identity.logoUrl ? (
            <img
              src={resolveAssetUrl(identity.logoUrl)}
              alt={identity.systemName}
              className="relative h-11 w-11 rounded-xl border border-white/60 bg-white object-cover p-0.5 shadow-sm dark:border-white/10 dark:bg-dark-background-soft"
            />
          ) : (
            <div className="relative grid h-11 w-11 place-items-center rounded-xl border border-white/60 bg-gradient-to-br from-light-primary to-light-primary-hover text-sm font-extrabold tracking-wide text-white shadow-sm dark:border-white/10 dark:from-dark-primary dark:to-dark-primary-hover dark:text-dark-background">
              {appInitials}
            </div>
          )}
        </div>
        {!effectiveCollapsed && (
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-[15px] font-bold leading-tight tracking-normal text-light-text dark:text-dark-text">
              {identity.systemName}
            </strong>
            <small className="mt-1 block truncate text-[11px] font-medium leading-tight text-light-text-muted dark:text-dark-text-muted">
              {identity.systemSubtitle || "Admin Workspace"}
            </small>
          </div>
        )}
      </div>
      <div className={`flex-1 space-y-1 px-2 py-3 scrollbar-ultra-thin ${effectiveCollapsed ? "overflow-visible" : "overflow-y-auto"}`}>
        {menuLoading ? (
          <div className="space-y-1">
            {[72, 56, 64, 48, 80, 56].map((w, i) => (
              <div key={i} className="flex min-h-11 items-center gap-3 rounded-md px-3">
                <div className="h-5 w-5 shrink-0 animate-pulse rounded-md bg-light-primary/15 dark:bg-dark-primary/15" />
                {!effectiveCollapsed && (
                  <div
                    className="h-3 animate-pulse rounded-full bg-light-primary/10 dark:bg-dark-primary/10"
                    style={{ width: w }}
                  />
                )}
              </div>
            ))}
          </div>
        ) : menuError ? (
          <div className="px-3 py-2 text-sm text-red-600 dark:text-red-300">
            {!collapsed && "Unable to load menu"}
          </div>
        ) : navItems.length === 0 ? (
          <div className="px-3 py-2 text-sm text-light-text-muted dark:text-dark-text-muted">
            {!collapsed && "No menu access"}
          </div>
        ) : (
          navItems.map(renderItem)
        )}
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
