import { Link, useNavigate } from "react-router-dom";
import {
  Clock,
  Database,
  HelpCircle,
  KeyRound,
  List,
  LogOut,
  Settings,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useSession } from "@/contexts/SessionContext";

interface UserDropdownProps {
  onClose?: () => void;
}

type MenuLink = {
  label: string;
  path: string;
  icon: typeof UserRound;
  visible?: boolean;
};

const UserDropdown = ({ onClose }: UserDropdownProps) => {
  const navigate = useNavigate();
  const { logout, user } = useSession();
  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];
  const isSuperAdmin = roles.includes("SUPERADMIN");
  const fullName = [user?.profile?.firstName, user?.profile?.lastName].filter(Boolean).join(" ");
  const displayName = fullName || user?.profile?.displayName || user?.username || "ผู้ใช้";
  const email = user?.email || "";
  const primaryRole = roles[0] || "ผู้ใช้ทั่วไป";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((item) => item.charAt(0).toUpperCase())
      .join("") || "U";

  const accountLinks: MenuLink[] = [
    { label: "โปรไฟล์ของฉัน", path: "/my-profile", icon: UserRound },
    { label: "ตั้งค่าบัญชี", path: "/my-security", icon: Settings },
    { label: "Access Tokens", path: "/my-access-token", icon: KeyRound, visible: isSuperAdmin },
    {
      label: "เวลาทำงานของฉัน",
      path: "/my-time-attendance",
      icon: Clock,
      visible: permissions.includes("attendance.view"),
    },
    { label: "ประวัติการเข้าสู่ระบบ", path: "/my-auth-history", icon: List },
  ];

  const organizationLinks: MenuLink[] = [
    { label: "ผู้ใช้ในระบบ", path: "/admin-console/users-list", icon: UsersRound },
    { label: "ตั้งค่าระบบ", path: "/system-setings/configuration", icon: Database },
  ];

  const visibleAccountLinks = accountLinks.filter((item) => item.visible !== false);

  const handleLogout = async () => {
    await logout();
    onClose?.();
    navigate("/login", { replace: true });
  };

  const renderLink = ({ label, path, icon: Icon }: MenuLink, first = false) => (
    <Link
      key={path}
      to={path}
      onClick={onClose}
      className={`flex items-center px-4 py-2 text-sm text-light-text transition-colors hover:bg-theme-primary/10 hover:text-theme-primary dark:text-dark-text dark:hover:bg-theme-dark-primary/15 dark:hover:text-theme-dark-primary ${
        first ? "mt-1" : ""
      }`}
    >
      <Icon className="mr-3 h-4 w-4 text-theme-primary dark:text-theme-dark-primary" />
      <span className="truncate">{label}</span>
    </Link>
  );

  const renderSection = (title: string, links: MenuLink[], withTopBorder = true) => {
    if (links.length === 0) {
      return null;
    }

    return (
      <div className={withTopBorder ? "mt-1 border-t border-theme pt-2" : "pt-2"}>
        <div className="px-4">
          <p className="text-xs font-medium uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
            {title}
          </p>
        </div>
        {links.map((link, index) => renderLink(link, index === 0))}
      </div>
    );
  };

  return (
    <div className="absolute right-0 top-[calc(100%+0.625rem)] z-50 w-80 overflow-hidden rounded-lg border border-theme bg-light-background-card text-light-text shadow-soft dark:bg-dark-background-card dark:text-dark-text">
      <div className="border-b border-theme bg-theme-primary/5 p-4 dark:bg-theme-dark-primary/10">
        <div className="flex items-center">
          <div className="relative h-12 w-12">
            {user?.profile?.avatarUrl ? (
              <img
                src={user.profile.avatarUrl}
                alt="รูปโปรไฟล์"
                className="h-12 w-12 rounded-full border-2 border-theme object-cover"
                onError={(event) => {
                  const img = event.currentTarget;
                  img.style.display = "none";
                  if (img.nextElementSibling) {
                    (img.nextElementSibling as HTMLElement).style.display = "flex";
                  }
                }}
              />
            ) : null}

            <div
              className="flex h-12 w-12 items-center justify-center rounded-full bg-theme-primary text-xl font-semibold text-white shadow-md dark:bg-theme-dark-primary dark:text-dark-background"
              style={{ display: user?.profile?.avatarUrl ? "none" : "flex" }}
            >
              {initials}
            </div>
          </div>

          <div className="ml-3 min-w-0">
            <p className="truncate font-medium text-light-text dark:text-dark-text">{displayName}</p>
            <p className="truncate text-sm text-light-text-muted dark:text-dark-text-muted">{email}</p>
            <div className="mt-1 flex items-center">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500" />
              <span className="truncate text-xs text-light-text-muted dark:text-dark-text-muted">{primaryRole}</span>
            </div>
          </div>
        </div>
      </div>

      {renderSection("บัญชีผู้ใช้", visibleAccountLinks, false)}
      {isSuperAdmin && renderSection("จัดการองค์กร", organizationLinks)}
      {renderSection("ช่วยเหลือ", [{ label: "ศูนย์ช่วยเหลือ", path: "/help", icon: HelpCircle }])}

      <div className="mt-1 border-t border-theme pt-2">
        <button
          onClick={handleLogout}
          className="flex w-full items-center px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          type="button"
        >
          <LogOut className="mr-3 h-4 w-4" />
          <span>ออกจากระบบ</span>
        </button>
      </div>
    </div>
  );
};

export default UserDropdown;
