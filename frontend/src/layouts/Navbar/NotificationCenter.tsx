import { Bell } from "lucide-react";

interface NotificationCenterProps {
  className?: string;
}

const NotificationCenter = ({ className = "" }: NotificationCenterProps) => {
  return (
    <button className={`icon-button icon-button-invert ${className}`} type="button" aria-label="Notifications">
      <Bell size={20} />
      <span className="notification-dot" />
    </button>
  );
};

export default NotificationCenter;
