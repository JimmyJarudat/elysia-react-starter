import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home, Menu, Moon, Palette, Search, Sun, UserRound } from "lucide-react";
import { useSidebar } from "@/contexts/SidebarContext";
import { useTheme } from "@/contexts/ThemeContext";
import AppearancePanel from "@/features/appearance/components/AppearancePanel";
import NotificationCenter from "@/features/notifications/components/NotificationCenter";
import UserDropdown from "@/features/user/components/UserDropdown";

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
  const [appearanceOpen, setAppearanceOpen] = useState(false);

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
    <>
    <header
      className={`sticky top-0 z-50 flex min-h-16 items-center justify-between gap-4 bg-light-primary px-4 text-white shadow-soft dark:bg-gradient-to-r dark:from-dark-background dark:via-dark-background-soft dark:to-slate-blue-800 ${className}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          className="relative grid h-10 w-10 place-items-center rounded-md border-0 bg-transparent text-inherit transition-colors hover:bg-white/10"
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu size={22} />
        </button>

        <nav className="flex min-w-0 items-center gap-1 text-sm max-[720px]:hidden" aria-label="Breadcrumb">
          {breadcrumbs.map((item, index) => (
            <span className="flex items-center" key={`${item.path}-${index}`}>
              {index > 0 && <ChevronRight size={15} className="text-white/60" />}
              <Link
                className={`inline-flex max-w-44 items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-white/75 transition-colors hover:bg-white/10 hover:text-white ${
                  index === breadcrumbs.length - 1 ? "bg-white/10 text-white" : ""
                }`}
                to={item.path}
              >
                {index === 0 ? <Home size={16} /> : item.label}
              </Link>
            </span>
          ))}
        </nav>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <label className="flex w-64 max-w-[28vw] min-w-44 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 max-[900px]:hidden">
          <Search size={16} />
          <input className="min-w-0 flex-1 border-0 bg-transparent text-sm text-white outline-none placeholder:text-white/65" placeholder="Search" />
        </label>

        <NotificationCenter />

        <button
          className="grid h-10 w-10 place-items-center rounded-md border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/15"
          type="button"
          onClick={() => setAppearanceOpen(true)}
          aria-label="Open appearance settings"
          title="Appearance"
        >
          <Palette size={18} />
        </button>

        <button className="relative grid h-10 w-10 place-items-center rounded-md border-0 bg-transparent text-inherit transition-colors hover:bg-white/10" type="button" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="relative">
          <button className="flex items-center gap-2 rounded-lg border-0 bg-transparent p-1 text-white transition-colors hover:bg-white/10" type="button" onClick={() => setUserOpen((value) => !value)}>
            <span className="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-white/15">
              <UserRound size={19} />
            </span>
            <span className="grid justify-items-start leading-tight max-[900px]:hidden">
              <strong className="text-sm font-semibold">Admin Demo</strong>
              <small className="text-xs text-white/70">Mock session</small>
            </span>
          </button>
          {userOpen && <UserDropdown onClose={() => setUserOpen(false)} />}
        </div>
      </div>
    </header>

      <AppearancePanel open={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
    </>
  );
};

export default WebNavbar;
