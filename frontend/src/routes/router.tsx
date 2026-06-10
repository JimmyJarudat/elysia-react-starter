import { createBrowserRouter, Navigate } from "react-router-dom";
import PrivateLayout from "@/layouts/PrivateLayout";
import PublicLayout from "@/layouts/PublicLayout";
import { createProtectedRoute, createPermissionRoute } from "./protected";

import App from "@/App";
import Forbidden from "@/common/Forbidden";
import LoginPage from "@/pages/auth/login";
import RegisterPage from "@/pages/auth/register";
import ForgotPasswordPage from "@/pages/auth/forgot-password";
import ResetPasswordPage from "@/pages/auth/reset-password";
import DebugPage from "@/pages/debug/debug1";

import DashboardPage from "@/pages/dashboard";
import RolesPermissionsPage from "@/pages/administration/roles-permission";
import MenusManagementPage from "@/pages/administration/menus";
import UserManagementPage from "@/pages/administration/users";
import AdminSessionsPage from "@/pages/administration/sessions";
import AccessTokensPage from "@/pages/navbar/access-tokens";
import MyAuthHistoryPage from "@/pages/navbar/my-auth-history";
import NotificationsPage from "@/pages/navbar/notifications";
import MyProfilePage from "@/pages/navbar/my-profile";
import MySecurityPage from "@/pages/navbar/my-security";
import ApiRouteRequirementsPage from "@/pages/administration/api_route_requirements";

import HomeSystemSettingPage from "@/pages/system-setting";
import GeneralSettingPage from "@/pages/system-setting/general";
import IntegrationsSettingPage from "@/pages/system-setting/integrations";
import SecuritySettingPage from "@/pages/system-setting/security";

import LogsPage from "@/pages/logs";
import RequestLogsPage from "@/pages/logs/request-logs";
import AuthLogsPage from "@/pages/logs/auth-logs";
import ActivityLogsPage from "@/pages/logs/activity-logs";
import AuditLogsPage from "@/pages/logs/audit-logs";
import ErrorLogsPage from "@/pages/logs/error-logs";
import SystemEventsPage from "@/pages/logs/system-events";
import LiveConsolePage from "@/pages/logs/live-console";


const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <App /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "forgot-password", element: <ForgotPasswordPage /> },
      { path: "reset-password", element: <ResetPasswordPage /> },
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
      { path: "administration", ...createProtectedRoute("/administration", <DebugPage title="Administration" />) },
      { path: "administration/users", ...createProtectedRoute("/administration/users", <UserManagementPage />) },
      { path: "administration/roles-permissions", ...createProtectedRoute("/administration/roles-permissions", <RolesPermissionsPage />) },
      { path: "administration/menus", ...createProtectedRoute("/administration/menus", <MenusManagementPage />) },
      { path: "administration/api-route-requirements", ...createProtectedRoute("/administration/api-route-requirements", <ApiRouteRequirementsPage />) },
      { path: "administration/sessions", ...createProtectedRoute("/administration/sessions", <AdminSessionsPage />) },
      { path: "logs",                    ...createProtectedRoute("/logs",                    <LogsPage />) },
      { path: "logs/request",            ...createProtectedRoute("/logs/request",            <RequestLogsPage />) },
      { path: "logs/auth",               ...createProtectedRoute("/logs/auth",               <AuthLogsPage />) },
      { path: "logs/activity",           ...createProtectedRoute("/logs/activity",           <ActivityLogsPage />) },
      { path: "logs/audit",              ...createProtectedRoute("/logs/audit",              <AuditLogsPage />) },
      { path: "logs/error",              ...createProtectedRoute("/logs/error",              <ErrorLogsPage />) },
      { path: "logs/system-events",      ...createProtectedRoute("/logs/system-events",      <SystemEventsPage />) },
      { path: "logs/live-console",       ...createProtectedRoute("/logs/live-console",       <LiveConsolePage />) },
      { path: "settings", ...createProtectedRoute("/settings", <HomeSystemSettingPage />) },
      { path: "settings/general", ...createProtectedRoute("/settings/general", <GeneralSettingPage />) },
      { path: "settings/security", ...createProtectedRoute("/settings/security", <SecuritySettingPage />) },
      { path: "settings/integrations", ...createProtectedRoute("/settings/integrations", <IntegrationsSettingPage />) },

      // ── Dropdown routes (เช็คจาก session permission ไม่ต้องอยู่ใน DB menu) ──
      { path: "notifications",         ...createPermissionRoute(null, <NotificationsPage />) },
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
