export interface Breadcrumb {
  name: string;
  path: string;
}

export interface NavbarProps {
  className?: string;
}

export interface UserDropdownProps {
  className?: string;
  onClose?: () => void;
}
