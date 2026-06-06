import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Eye, EyeOff, RefreshCw, Route, Save, Search, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import StatCard from "@/common/StatCard";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/contexts/SessionContext";
import { useRegional } from "@/contexts/RegionalContext";

interface PermissionOption {
  id: string;
  name: string;
  resource: string;
  action: string;
}

interface RoleOption {
  id: string;
  name: string;
  priority: number;
}

interface ApiRouteRequirement {
  id: number;
  method: string;
  path: string;
  role_id: string | null;
  permission_id: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  role: RoleOption | null;
  permission: PermissionOption | null;
}

interface ApiRoutesResponse {
  success: boolean;
  data: {
    routes: ApiRouteRequirement[];
    permissions: PermissionOption[];
    roles: RoleOption[];
  };
}

type DraftState = Record<number, { permission_id: string; role_id: string; is_active: boolean }>;

const inputClass =
  "rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";

const actionButtonClass =
  "grid h-8 w-8 place-items-center rounded-md border border-theme text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary disabled:cursor-not-allowed disabled:opacity-40 dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary";

const methodClass = (method: string) => {
  const color = {
    GET: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    POST: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    PUT: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    PATCH: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
    DELETE: "bg-red-500/10 text-red-700 dark:text-red-300",
  }[method] ?? "bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary";

  return `inline-flex min-w-16 justify-center rounded-md px-2 py-1 text-xs font-bold ${color}`;
};

const ApiRouteRequirementsPage = () => {
  const { get, put, del } = useApi();
  const { user } = useSession();
  const { formatDateTime } = useRegional();
  const [routes, setRoutes] = useState<ApiRouteRequirement[]>([]);
  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [drafts, setDrafts] = useState<DraftState>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rolesInSession = user?.roles ?? [];
  const sessionPermissions = user?.permissions ?? [];
  const isSuperAdmin = rolesInSession.includes("SUPERADMIN");
  const hasPermission = (permission: string) => isSuperAdmin || sessionPermissions.includes(permission);
  const canRead = hasPermission("api-route-requirements.read");
  const canUpdate = hasPermission("api-route-requirements.update");
  const canDelete = hasPermission("api-route-requirements.delete");

  const loadRoutes = async () => {
    if (!canRead) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await get<ApiRoutesResponse>("/api-route-requirements");
      const payload = response.data.data;
      setRoutes(payload.routes ?? []);
      setPermissions(payload.permissions ?? []);
      setRoles(payload.roles ?? []);
      setDrafts(Object.fromEntries((payload.routes ?? []).map((route) => [
        route.id,
        {
          permission_id: route.permission_id ?? "",
          role_id: route.role_id ?? "",
          is_active: route.is_active,
        },
      ])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load API routes");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRoutes();
  }, [canRead]);

  const methods = useMemo(
    () => Array.from(new Set(routes.map((route) => route.method))).sort(),
    [routes],
  );

  const resources = useMemo(
    () => Array.from(new Set(permissions.map((permission) => permission.resource))).sort(),
    [permissions],
  );

  const stats = useMemo(() => {
    const active = routes.filter((route) => route.is_active).length;
    return { total: routes.length, active, inactive: routes.length - active };
  }, [routes]);

  const filteredRoutes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return routes.filter((route) => {
      // ใช้ค่า saved (route) ไม่ใช่ draft เพื่อให้แก้ draft แล้ว row ไม่หายจากตัวกรอง
      const values = [
        route.method,
        route.path,
        route.permission_id,
        route.role_id,
        route.permission?.name,
        route.role?.name,
      ];
      const matchesSearch = !query || values.filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && route.is_active) ||
        (statusFilter === "inactive" && !route.is_active);
      const matchesMethod = methodFilter === "all" || route.method === methodFilter;
      const savedPermission = permissions.find((p) => p.id === route.permission_id);
      const matchesResource = resourceFilter === "all" || savedPermission?.resource === resourceFilter;

      return matchesSearch && matchesStatus && matchesMethod && matchesResource;
    });
  }, [methodFilter, permissions, resourceFilter, routes, search, statusFilter]);

  const isDirty = (route: ApiRouteRequirement) => {
    const draft = drafts[route.id];
    if (!draft) return false;

    return (
      draft.permission_id !== (route.permission_id ?? "") ||
      draft.role_id !== (route.role_id ?? "") ||
      draft.is_active !== route.is_active
    );
  };

  const setDraft = (id: number, patch: Partial<DraftState[number]>) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        permission_id: current[id]?.permission_id ?? "",
        role_id: current[id]?.role_id ?? "",
        is_active: current[id]?.is_active ?? false,
        ...patch,
      },
    }));
  };

  const saveRoute = async (route: ApiRouteRequirement) => {
    if (!canUpdate) {
      toast.error("คุณไม่มีสิทธิ์แก้ไข API routes");
      return;
    }

    const draft = drafts[route.id];
    if (!draft) return;

    setSavingId(route.id);
    try {
      const response = await put<{ success: boolean; data: ApiRouteRequirement }>(`/api-route-requirements/${route.id}`, {
        permission_id: draft.permission_id || null,
        role_id: draft.role_id || null,
        is_active: draft.is_active,
      });
      const updated = response.data.data;
      setRoutes((current) => current.map((item) => item.id === route.id ? { ...item, ...updated } : item));
      setDraft(route.id, {
        permission_id: updated.permission_id ?? "",
        role_id: updated.role_id ?? "",
        is_active: updated.is_active,
      });
      toast.success("บันทึก API route แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save API route");
    } finally {
      setSavingId(null);
    }
  };

  const deleteRoute = async (route: ApiRouteRequirement) => {
    if (!canDelete) {
      toast.error("คุณไม่มีสิทธิ์ลบ API routes");
      return;
    }

    const confirmed = window.confirm(`ลบ route ${route.method} ${route.path}?`);
    if (!confirmed) return;

    setDeletingId(route.id);
    try {
      await del(`/api-route-requirements/${route.id}`);
      setRoutes((current) => current.filter((item) => item.id !== route.id));
      setDrafts((current) => {
        const next = { ...current };
        delete next[route.id];
        return next;
      });
      toast.success("ลบ API route แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete API route");
    } finally {
      setDeletingId(null);
    }
  };

  if (!canRead) {
    return (
      <section className="grid gap-5">
        <article className="grid min-h-48 place-items-center rounded-lg border border-theme bg-light-background-card p-6 text-center text-light-text-muted shadow-soft dark:bg-dark-background-card dark:text-dark-text-muted">
          <div>
            <Route className="mx-auto h-8 w-8 opacity-30" />
            <p className="mt-2 text-sm">คุณไม่มีสิทธิ์ดู API route requirements</p>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-xl border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-light-primary text-white shadow-sm dark:bg-dark-primary dark:text-dark-background">
              <Route className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                Admin Console
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">API Route Requirements</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                จัดการ route guard ของ backend — เปิดปิด และผูก permission หรือ role
              </p>
            </div>
          </div>

          <button
            className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
            type="button"
            onClick={() => void loadRoutes()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: "Total routes", value: stats.total, icon: <Route className="h-5 w-5" />, tone: "primary" as const },
          { label: "Active", value: stats.active, icon: <Eye className="h-5 w-5" />, tone: "success" as const },
          { label: "Inactive", value: stats.inactive, icon: <EyeOff className="h-5 w-5" />, tone: "muted" as const },
        ].map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <article className="rounded-lg border border-theme bg-light-background-card p-4 shadow-soft dark:bg-dark-background-card">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-text-muted dark:text-dark-text-muted" />
            <input
              className={`${inputClass} w-full py-2 pl-9`}
              placeholder="ค้นหา method, path, permission, role..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select className={inputClass} value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}>
            <option value="all">All methods</option>
            {methods.map((method) => <option key={method} value={method}>{method}</option>)}
          </select>
          <select className={inputClass} value={resourceFilter} onChange={(event) => setResourceFilter(event.target.value)}>
            <option value="all">All resources</option>
            {resources.map((resource) => <option key={resource} value={resource}>{resource}</option>)}
          </select>
          <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </article>

      <article className="overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-soft dark:bg-dark-background-card">
        {error && (
          <div className="flex items-center gap-3 p-5 text-sm text-red-600 dark:text-red-300">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}
        {isLoading ? (
          <div className="grid min-h-48 place-items-center text-light-text-muted dark:text-dark-text-muted">
            Loading API routes...
          </div>
        ) : filteredRoutes.length === 0 ? (
          <div className="grid min-h-48 place-items-center text-center text-sm text-light-text-muted dark:text-dark-text-muted">
            ไม่พบ API route ตามตัวกรอง
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
              <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                <tr>
                  <th className="w-16 px-4 py-3 text-center font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Route</th>
                  <th className="px-4 py-3 font-semibold">Permission</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                {filteredRoutes.map((route, index) => {
                  const draft = drafts[route.id];
                  const dirty = isDirty(route);

                  return (
                    <tr className="transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10" key={route.id}>
                      <td className="px-4 py-3 text-center text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className={methodClass(route.method)}>{route.method}</span>
                          <span className="font-mono text-xs text-light-text dark:text-dark-text">{route.path}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className={`${inputClass} min-w-64`}
                          value={draft?.permission_id ?? ""}
                          onChange={(event) => setDraft(route.id, { permission_id: event.target.value })}
                          disabled={!canUpdate}
                        >
                          <option value="">— no permission —</option>
                          {permissions.map((permission) => (
                            <option key={permission.id} value={permission.id}>
                              {permission.id}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className={`${inputClass} min-w-44`}
                          value={draft?.role_id ?? ""}
                          onChange={(event) => setDraft(route.id, { role_id: event.target.value })}
                          disabled={!canUpdate}
                        >
                          <option value="">— no role —</option>
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name} ({role.id})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={draft?.is_active ?? false}
                          disabled={!canUpdate || savingId === route.id}
                          onClick={() => setDraft(route.id, { is_active: !(draft?.is_active ?? false) })}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
                            !canUpdate ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                          } ${(draft?.is_active ?? false) ? "bg-light-primary dark:bg-dark-primary" : "bg-light-text-muted/30 dark:bg-dark-text-muted/30"}`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
                              draft?.is_active ? "translate-x-[18px]" : "translate-x-[3px]"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-light-text-muted dark:text-dark-text-muted">
                        {formatDateTime(route.updated_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {canUpdate && (
                            <button
                              className={actionButtonClass}
                              type="button"
                              title="Save"
                              disabled={!dirty || savingId === route.id}
                              onClick={() => void saveRoute(route)}
                            >
                              {savingId === route.id
                                ? <RefreshCw className="h-4 w-4 animate-spin" />
                                : dirty
                                  ? <Save className="h-4 w-4" />
                                  : <Check className="h-4 w-4" />}
                            </button>
                          )}
                          {canDelete && (
                            <button
                              className={`${actionButtonClass} hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400`}
                              type="button"
                              title="Delete"
                              disabled={deletingId === route.id}
                              onClick={() => void deleteRoute(route)}
                            >
                              {deletingId === route.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
};

export default ApiRouteRequirementsPage;
