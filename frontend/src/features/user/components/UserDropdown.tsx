import { Link } from "react-router-dom";
import { LogOut, Settings, UserRound } from "lucide-react";

interface UserDropdownProps {
  onClose?: () => void;
}

const UserDropdown = ({ onClose }: UserDropdownProps) => {
  const itemClass =
    "flex items-center gap-2 rounded-md border-0 bg-transparent px-3 py-2 text-left text-sm text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary";

  return (
    <div className="absolute right-0 top-[calc(100%+0.625rem)] z-50 grid min-w-48 rounded-lg border border-theme bg-light-background-card p-2 text-light-text shadow-soft dark:bg-dark-background-card dark:text-dark-text">
      <Link className={itemClass} to="/settings/profile" onClick={onClose}>
        <UserRound size={17} />
        Profile
      </Link>
      <Link className={itemClass} to="/settings" onClick={onClose}>
        <Settings size={17} />
        Settings
      </Link>
      <button className={itemClass} type="button" onClick={onClose}>
        <LogOut size={17} />
        Sign out
      </button>
    </div>
  );
};

export default UserDropdown;
