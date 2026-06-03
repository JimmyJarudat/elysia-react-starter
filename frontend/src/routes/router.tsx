import { createBrowserRouter, Navigate } from "react-router-dom";
import PrivateLayout from "@/layouts/PrivateLayout";
import PublicLayout from "@/layouts/PublicLayout";
import App from "@/App";
import DashboardPage from "@/pages/dashboard";
import DebugPage from "@/pages/debug/debug1";
import LoginPage from "@/pages/auth/login";
import RolesPermissionsPage from "@/pages/admin-console/roles-permission";
import UserManagementPage from "@/pages/admin-console/users";
import { createProtectedRoute } from "./protected";

const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <App /> },
      { path: "login", element: <LoginPage /> },
    ],
  },
  {
    element: <PrivateLayout />,
    children: [
      { path: "dashboard", ...createProtectedRoute("/dashboard", <DashboardPage />) },
      { path: "dashboard/overview", ...createProtectedRoute("/dashboard/overview", <DashboardPage />) },
      { path: "dashboard/analytics", ...createProtectedRoute("/dashboard/analytics", <DashboardPage />) },
      { path: "reports", ...createProtectedRoute("/reports", <DebugPage title="Reports" />) },
      { path: "admin-console", ...createProtectedRoute("/admin-console", <DebugPage title="Admin Console" />) },
      { path: "admin-console/users", ...createProtectedRoute("/admin-console/users", <UserManagementPage />) },
      { path: "admin-console/roles-permissions", ...createProtectedRoute("/admin-console/roles-permissions", <RolesPermissionsPage />) },
      { path: "settings", ...createProtectedRoute("/settings", <DebugPage title="Settings" />) },
      { path: "settings/profile", ...createProtectedRoute("/settings/profile", <DebugPage title="Profile" />) },
    ],
  },
  { path: "*", element: <Navigate to="/dashboard" replace /> },
]);

export default router;
