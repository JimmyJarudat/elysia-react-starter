import { Bell } from "lucide-react";

interface NotificationCenterProps {
  className?: string;
}

const NotificationCenter = ({ className = "" }: NotificationCenterProps) => {
  return (
    <button
      className={`relative grid h-10 w-10 place-items-center rounded-md border-0 bg-transparent text-inherit transition-colors hover:bg-white/10 ${className}`}
      type="button"
      aria-label="Notifications"
    >
      <Bell size={20} />
      <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-light-primary bg-yellow-300 dark:border-slate-blue-800" />
    </button>
  );
};

export default NotificationCenter;
