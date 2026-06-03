import type { ReactNode } from "react";
import { createElement, Fragment } from "react";
import { Navigate } from "react-router-dom";
import { useMenu } from "@/contexts/MenuContext";

export const ProtectedRoute = ({ children, path }: { children?: ReactNode; path: string }) => {
  const { hasAccess, menuLoading } = useMenu();

  if (menuLoading) {
    return null;
  }

  return hasAccess(path) ? createElement(Fragment, null, children) : createElement(Navigate, { to: "/403", replace: true });
};

export const createProtectedRoute = (path: string, component: ReactNode) => ({
  element: createElement(ProtectedRoute, { path }, component),
});
