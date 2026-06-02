import WebNavbar from "./WebNavbar";

interface NavbarProps {
  className?: string;
}

const Navbar = ({ className = "" }: NavbarProps) => {
  return <WebNavbar className={className} />;
};

export default Navbar;
