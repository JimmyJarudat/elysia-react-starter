import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";

interface PermissionItem {
  id: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  roleCount: number;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

interface RoleItem {
  id: string;
  name: string;
  priority: number;
  description: string | null;
  userCount: number;
  permissionCount: number;
  permissions: Array<{
    id: string;
    name: string;
    resource: string;
    action: string;
    description: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface RolesPermissionsResponse {
  success: boolean;
  data: {
    roles: RoleItem[];
    permissions: PermissionItem[];
  };
  message?: string;
}

type Tab = "roles" | "permissions";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const actionButtonClass =
  "grid h-8 w-8 place-items-center rounded-md border border-theme text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary";

const RolesPermissionsPage = () => {
  const { get } = useApi();
  const [activeTab, setActiveTab] = useState<Tab>("roles");
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resourceCount = useMemo(
    () => new Set(permissions.map((permission) => permission.resource)).size,
    [permissions],
  );

  const loadAccessControl = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await get<RolesPermissionsResponse>("/access-control/roles-permissions");
      setRoles(response.data.data.roles ?? []);
      setPermissions(response.data.data.permissions ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load roles and permissions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAccessControl();
  }, []);

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-light-primary dark:text-dark-primary">
            Admin Console
          </p>
          <h1 className="text-3xl font-semibold tracking-normal text-light-text dark:text-dark-text">
            Roles & Permissions
          </h1>
          <p className="mt-2 text-sm text-light-text-muted dark:text-dark-text-muted">
            จัดการบทบาทและสิทธิ์ของระบบ ตอนนี้ดึงข้อมูลมาแสดงและเตรียมปุ่ม action ไว้ก่อน
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
            type="button"
          >
            <Plus className="h-4 w-4" />
            New role
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
            type="button"
          >
            <KeyRound className="h-4 w-4" />
            New permission
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
            type="button"
            onClick={() => void loadAccessControl()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
          <span className="text-sm text-light-text-muted dark:text-dark-text-muted">Roles</span>
          <strong className="mt-2 block text-3xl text-light-text dark:text-dark-text">{roles.length}</strong>
        </article>
        <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
          <span className="text-sm text-light-text-muted dark:text-dark-text-muted">Permissions</span>
          <strong className="mt-2 block text-3xl text-light-text dark:text-dark-text">{permissions.length}</strong>
        </article>
        <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
          <span className="text-sm text-light-text-muted dark:text-dark-text-muted">Resources</span>
          <strong className="mt-2 block text-3xl text-light-text dark:text-dark-text">{resourceCount}</strong>
        </article>
      </div>

      <article className="overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-soft dark:bg-dark-background-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-theme p-3">
          <div className="inline-flex rounded-lg border border-theme p-1">
            {(["roles", "permissions"] as Tab[]).map((tab) => (
              <button
                className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize transition-colors ${
                  activeTab === tab
                    ? "bg-light-primary text-white dark:bg-dark-primary dark:text-dark-background"
                    : "text-light-text-muted hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
                }`}
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="flex items-center gap-3 p-5 text-sm text-red-600 dark:text-red-300">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid min-h-48 place-items-center text-light-text-muted dark:text-dark-text-muted">
            Loading access control...
          </div>
        ) : activeTab === "roles" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
              <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Users</th>
                  <th className="px-4 py-3 font-semibold">Permissions</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                {roles.map((role) => (
                  <tr className="transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10" key={role.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-full bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                          <ShieldCheck className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-light-text dark:text-dark-text">{role.name}</span>
                          <span className="block truncate text-xs text-light-text-muted dark:text-dark-text-muted">
                            {role.description || role.id}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{role.userCount}</td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{role.permissionCount}</td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{role.priority}</td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{formatDate(role.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button className={actionButtonClass} type="button" title="Manage permissions">
                          <SlidersHorizontal className="h-4 w-4" />
                        </button>
                        <button className={actionButtonClass} type="button" title="Edit role">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className={actionButtonClass} type="button" title="Delete role">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
              <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Permission</th>
                  <th className="px-4 py-3 font-semibold">Resource</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Roles</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                {permissions.map((permission) => (
                  <tr className="transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10" key={permission.id}>
                    <td className="px-4 py-3">
                      <span className="block truncate font-semibold text-light-text dark:text-dark-text">{permission.name}</span>
                      <span className="block truncate text-xs text-light-text-muted dark:text-dark-text-muted">
                        {permission.description || permission.id}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md bg-light-primary/10 px-2 py-1 text-xs font-semibold text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                        {permission.resource}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{permission.action}</td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{permission.roleCount}</td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{formatDate(permission.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button className={actionButtonClass} type="button" title="Assign to roles">
                          <SlidersHorizontal className="h-4 w-4" />
                        </button>
                        <button className={actionButtonClass} type="button" title="Edit permission">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className={actionButtonClass} type="button" title="Delete permission">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
};

export default RolesPermissionsPage;
