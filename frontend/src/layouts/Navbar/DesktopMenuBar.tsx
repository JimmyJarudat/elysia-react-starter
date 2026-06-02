import WebNavbar from "./WebNavbar";

interface DesktopMenuBarProps {
  className?: string;
}

const DesktopMenuBar = ({ className = "" }: DesktopMenuBarProps) => {
  return <WebNavbar className={className} />;
};

export default DesktopMenuBar;
