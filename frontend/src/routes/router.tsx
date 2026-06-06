import { createBrowserRouter, Navigate } from "react-router-dom";
import PrivateLayout from "@/layouts/PrivateLayout";
import PublicLayout from "@/layouts/PublicLayout";
import { createProtectedRoute, createPermissionRoute } from "./protected";

import App from "@/App";
import Forbidden from "@/common/Forbidden";
import LoginPage from "@/pages/auth/login";
import RegisterPage from "@/pages/auth/register";
import DebugPage from "@/pages/debug/debug1";

import DashboardPage from "@/pages/dashboard";
import RolesPermissionsPage from "@/pages/admin-console/roles-permission";
import MenusManagementPage from "@/pages/admin-console/menus";
import UserManagementPage from "@/pages/admin-console/users";
import AdminSessionsPage from "@/pages/admin-console/sessions";
import AccessTokensPage from "@/pages/navbar/access-tokens";
import MyAuthHistoryPage from "@/pages/navbar/my-auth-history";
import MyProfilePage from "@/pages/navbar/my-profile";
import MySecurityPage from "@/pages/navbar/my-security";
import ApiRouteRequirementsPage from "@/pages/admin-console/api_route_requirements";

import HomeSystemSettingPage from "@/pages/system-setting";
import GeneralSettingPage from "@/pages/system-setting/general";
import IntegrationsSettingPage from "@/pages/system-setting/integrations";
import SecuritySettingPage from "@/pages/system-setting/security";


const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <App /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
    ],
  },
  {
    element: <PrivateLayout />,
    children: [
      // ── Sidebar routes (ต้องอยู่ใน DB menu_items) ──────────────────────────
      { path: "dashboard", ...createProtectedRoute("/dashboard", <DashboardPage />) },
      { path: "dashboard/overview", ...createProtectedRoute("/dashboard/overview", <DashboardPage />) },
      { path: "dashboard/analytics", ...createProtectedRoute("/dashboard/analytics", <DashboardPage />) },
      { path: "reports", ...createProtectedRoute("/reports", <DebugPage title="Reports" />) },
      { path: "admin-console", ...createProtectedRoute("/admin-console", <DebugPage title="Admin Console" />) },
      { path: "admin-console/users", ...createProtectedRoute("/admin-console/users", <UserManagementPage />) },
      { path: "admin-console/roles-permissions", ...createProtectedRoute("/admin-console/roles-permissions", <RolesPermissionsPage />) },
      { path: "admin-console/menus", ...createProtectedRoute("/admin-console/menus", <MenusManagementPage />) },
      { path: "admin-console/api-route-requirements", ...createProtectedRoute("/admin-console/api-route-requirements", <ApiRouteRequirementsPage />) },
      { path: "admin-console/sessions", ...createProtectedRoute("/admin-console/sessions", <AdminSessionsPage />) },
      { path: "settings", ...createProtectedRoute("/settings", <HomeSystemSettingPage />) },
      { path: "settings/general", ...createProtectedRoute("/settings/general", <GeneralSettingPage />) },
      { path: "settings/security", ...createProtectedRoute("/settings/security", <SecuritySettingPage />) },
      { path: "settings/integrations", ...createProtectedRoute("/settings/integrations", <IntegrationsSettingPage />) },

      // ── Dropdown routes (เช็คจาก session permission ไม่ต้องอยู่ใน DB menu) ──
      { path: "my-profile",          ...createPermissionRoute(null, <MyProfilePage />) },
      { path: "my-security",         ...createPermissionRoute(null, <MySecurityPage />) },
      { path: "my-auth-history",     ...createPermissionRoute(null, <MyAuthHistoryPage />) },
      { path: "my-access-token",     ...createPermissionRoute("access-tokens.read", <AccessTokensPage />) },
      { path: "system-setings/configuration", ...createPermissionRoute(null, <DebugPage title="System Configuration" />) },
    ],
  },
  { path: "403", element: <Forbidden /> },
  { path: "*", element: <Navigate to="/dashboard" replace /> },
]);

export default router;
