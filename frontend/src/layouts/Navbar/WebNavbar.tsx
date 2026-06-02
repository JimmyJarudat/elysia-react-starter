import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, ChevronRight, Home, Menu, Moon, Search, Sun, UserRound } from "lucide-react";
import { useSidebar } from "@/contexts/SidebarContext";
import { useTheme } from "@/contexts/ThemeContext";
import UserDropdown from "./UserDropdown";

interface WebNavbarProps {
  className?: string;
}

const toTitle = (value: string) =>
  value
    .split("-")
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");

const WebNavbar = ({ className = "" }: WebNavbarProps) => {
  const { pathname } = useLocation();
  const { toggleSidebar } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const [userOpen, setUserOpen] = useState(false);

  const breadcrumbs = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    return [
      { label: "Home", path: "/dashboard" },
      ...segments.map((segment, index) => ({
        label: toTitle(segment),
        path: `/${segments.slice(0, index + 1).join("/")}`,
      })),
    ];
  }, [pathname]);

  return (
    <header className={`navbar ${className}`}>
      <div className="navbar-left">
        <button className="icon-button icon-button-invert" type="button" onClick={toggleSidebar} aria-label="Toggle sidebar">
          <Menu size={22} />
        </button>

        <nav className="breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((item, index) => (
            <span className="breadcrumb-item" key={`${item.path}-${index}`}>
              {index > 0 && <ChevronRight size={15} className="breadcrumb-separator" />}
              <Link className={index === breadcrumbs.length - 1 ? "breadcrumb-current" : ""} to={item.path}>
                {index === 0 ? <Home size={16} /> : item.label}
              </Link>
            </span>
          ))}
        </nav>
      </div>

      <div className="navbar-right">
        <label className="navbar-search">
          <Search size={16} />
          <input placeholder="Search" />
        </label>

        <button className="icon-button icon-button-invert" type="button" aria-label="Notifications">
          <Bell size={20} />
          <span className="notification-dot" />
        </button>

        <button className="icon-button icon-button-invert" type="button" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="user-menu-wrap">
          <button className="user-trigger" type="button" onClick={() => setUserOpen((value) => !value)}>
            <span className="avatar">
              <UserRound size={19} />
            </span>
            <span className="user-meta">
              <strong>Admin Demo</strong>
              <small>Mock session</small>
            </span>
          </button>
          {userOpen && <UserDropdown onClose={() => setUserOpen(false)} />}
        </div>
      </div>
    </header>
  );
};

export default WebNavbar;
