import { NavLink } from "react-router-dom";
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

  const renderItem = (item: MenuItem) => {
    const hasChildren = Boolean(item.subItems?.length);
    const expanded = isExpanded(item.label);

    return (
      <div className="sidebar-item-group" key={item.id}>
        <div className="sidebar-row">
          <NavLink className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`} to={item.path} end={!hasChildren}>
            <SidebarIcon name={item.icon_name} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
          {hasChildren && !collapsed && (
            <button className="submenu-toggle" type="button" onClick={() => toggleSubmenu(item.label)} aria-label={`Toggle ${item.label}`}>
              {expanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
            </button>
          )}
        </div>

        {hasChildren && expanded && !collapsed && (
          <div className="submenu">
            {item.subItems?.map((subItem) => (
              <NavLink className={({ isActive }) => `submenu-link ${isActive ? "active" : ""}`} to={subItem.path} key={subItem.id}>
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
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-brand">
        <div className="brand-mark">ES</div>
        {!collapsed && (
          <div className="brand-copy">
            <strong>Elysia Starter</strong>
            <small>Admin Console</small>
          </div>
        )}
      </div>
      <div className="sidebar-nav">{navItems.map(renderItem)}</div>
    </aside>
  );
};

export default Sidebar;
