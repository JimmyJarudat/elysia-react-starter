import type { ReactNode } from "react";
import { createElement, Fragment } from "react";
import { Navigate } from "react-router-dom";
import { useMenu } from "@/contexts/MenuContext";
import { useSession } from "@/contexts/SessionContext";

// ─── Menu-based (ใช้กับ sidebar routes ที่อยู่ใน DB) ─────────────────────────

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

// ─── Permission-based (ใช้กับ dropdown routes ที่ไม่อยู่ใน DB menu) ────────────
// permission = null  → แค่ login อยู่ก็เข้าได้เลย
// permission = "x.y" → ต้องมี permission นั้น (SUPERADMIN ผ่านเสมอ)

export const PermissionRoute = ({ children, permission }: { children?: ReactNode; permission: string | null }) => {
  const { user, isLoading } = useSession();

  if (isLoading) return null;

  if (!user) return createElement(Navigate, { to: "/login", replace: true });

  if (permission !== null) {
    const isSuperAdmin = user.roles?.includes("SUPERADMIN");
    const hasPermission = isSuperAdmin || user.permissions?.includes(permission);
    if (!hasPermission) return createElement(Navigate, { to: "/403", replace: true });
  }

  return createElement(Fragment, null, children);
};

export const createPermissionRoute = (permission: string | null, component: ReactNode) => ({
  element: createElement(PermissionRoute, { permission }, component),
});
