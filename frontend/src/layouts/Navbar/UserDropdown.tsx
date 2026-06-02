import { Link } from "react-router-dom";
import { LogOut, Settings, UserRound } from "lucide-react";

interface UserDropdownProps {
  onClose?: () => void;
}

const UserDropdown = ({ onClose }: UserDropdownProps) => {
  return (
    <div className="user-dropdown">
      <Link to="/settings/profile" onClick={onClose}>
        <UserRound size={17} />
        Profile
      </Link>
      <Link to="/settings" onClick={onClose}>
        <Settings size={17} />
        Settings
      </Link>
      <button type="button" onClick={onClose}>
        <LogOut size={17} />
        Sign out
      </button>
    </div>
  );
};

export default UserDropdown;
