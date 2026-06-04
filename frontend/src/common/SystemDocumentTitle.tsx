import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSystemIdentity } from "@/contexts/SystemIdentityContext";

const getSectionTitle = (pathname: string) => {
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  return firstSegment
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const SystemDocumentTitle = () => {
  const { pathname } = useLocation();
  const { identity } = useSystemIdentity();

  useEffect(() => {
    const baseTitle = identity.appTitle?.trim() || identity.systemName?.trim() || "IT Utils";
    const sectionTitle = getSectionTitle(pathname);

    document.title = identity.titleMode === "title_section" && sectionTitle
      ? `${baseTitle} - ${sectionTitle}`
      : baseTitle;
  }, [identity.appTitle, identity.systemName, identity.titleMode, pathname]);

  return null;
};

export default SystemDocumentTitle;
