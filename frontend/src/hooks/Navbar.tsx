import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, Check, ChevronRight, Home, Menu, Moon, Palette, Search, Sun, UserRound, X } from "lucide-react";
import { useSidebar } from "@/contexts/SidebarContext";
import { useTheme } from "@/contexts/ThemeContext";
import UserDropdown from "./Navbar/UserDropdown";

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

        <button className="relative grid h-10 w-10 place-items-center rounded-md border-0 bg-transparent text-inherit transition-colors hover:bg-white/10" type="button" aria-label="Notifications">
          <Bell size={20} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-light-primary bg-yellow-300 dark:border-slate-blue-800" />
        </button>

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

      {appearanceOpen && (
        <div className="fixed inset-0 z-[70]">
          <button
            className="absolute inset-0 cursor-default bg-slate-950/35 backdrop-blur-[2px]"
            type="button"
            aria-label="Close appearance settings"
            onClick={() => setAppearanceOpen(false)}
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md animate-[slideInRight_180ms_ease-out] flex-col border-l border-theme bg-light-background-card text-light-text shadow-2xl dark:bg-dark-background-card dark:text-dark-text">
            <div className="flex h-16 items-center justify-between border-b border-theme px-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-light-primary dark:text-dark-primary">Mock panel</p>
                <h2 className="text-lg font-semibold text-light-text dark:text-dark-text">Appearance</h2>
              </div>
              <button
                className="grid h-9 w-9 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-ocean-50 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-slate-blue-800/50 dark:hover:text-dark-primary"
                type="button"
                onClick={() => setAppearanceOpen(false)}
                aria-label="Close appearance settings"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">Theme mode</h3>
                  <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">ตัวอย่างตัวเลือก mock สำหรับหน้าตาแอป</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["Light", "Dark", "System"].map((item) => (
                    <button
                      className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors ${
                        item === "Light"
                          ? "border-light-primary bg-ocean-50 text-light-primary dark:border-dark-primary dark:bg-slate-blue-800/40 dark:text-dark-primary"
                          : "border-theme hover:bg-ocean-50/50 dark:hover:bg-slate-blue-800/30"
                      }`}
                      type="button"
                      key={item}
                    >
                      <span className="flex items-center justify-between">
                        {item}
                        {item === "Light" && <Check size={16} />}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">Accent color</h3>
                <div className="flex gap-2">
                  {[
                    "bg-ocean-500",
                    "bg-emerald-500",
                    "bg-violet-500",
                    "bg-rose-500",
                    "bg-amber-500",
                  ].map((color, index) => (
                    <button
                      className={`h-9 w-9 rounded-full ${color} ring-offset-2 ring-offset-light-background-card transition-transform hover:scale-105 dark:ring-offset-dark-background-card ${
                        index === 0 ? "ring-2 ring-light-primary dark:ring-dark-primary" : ""
                      }`}
                      type="button"
                      key={color}
                      aria-label={`Select accent color ${index + 1}`}
                    />
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">Density</h3>
                <div className="rounded-lg border border-theme p-2">
                  {["Comfortable", "Compact", "Spacious"].map((item, index) => (
                    <button
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                        index === 0
                          ? "bg-ocean-50 text-light-primary dark:bg-slate-blue-800/40 dark:text-dark-primary"
                          : "hover:bg-ocean-50/50 dark:hover:bg-slate-blue-800/30"
                      }`}
                      type="button"
                      key={item}
                    >
                      {item}
                      {index === 0 && <Check size={16} />}
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-2 border-t border-theme p-5">
              <button
                className="rounded-md border border-theme px-4 py-2 text-sm font-medium transition-colors hover:bg-ocean-50/50 dark:hover:bg-slate-blue-800/30"
                type="button"
                onClick={() => setAppearanceOpen(false)}
              >
                Cancel
              </button>
              <button className="rounded-md bg-light-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-light-primary-hover dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover" type="button">
                Apply mock
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};

export default WebNavbar;
