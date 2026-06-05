import { useEffect, useMemo, useState } from "react";
import type { AxiosError } from "axios";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import * as LucideIcons from "lucide-react";
import { AlertCircle, Eye, EyeOff, Menu, Pencil, Plus, RefreshCw, Search, Trash2, X, type LucideIcon } from "lucide-react";
import { toast } from "react-toastify";
import StatCard from "@/common/StatCard";
import { useApi } from "@/hooks/useApi";
import { useMenu } from "@/contexts/MenuContext";
import { useSession } from "@/contexts/SessionContext";

const REACT_FORWARD_REF = Symbol.for("react.forward_ref");

const ALL_ICON_NAMES: string[] = Object.keys(LucideIcons).filter((key) => {
  if (!/^[A-Z]/.test(key)) return false;
  const val = LucideIcons[key as keyof typeof LucideIcons] as { $$typeof?: symbol; displayName?: string } | null;
  return val?.$$typeof === REACT_FORWARD_REF && val.displayName !== undefined;
}).sort();

const DynamicIcon = ({ name, size = 20 }: { name: string; size?: number }) => {
  const Icon = (LucideIcons[name as keyof typeof LucideIcons] as LucideIcon | undefined) ?? LucideIcons.Home;
  return <Icon size={size} />;
};

interface IconPickerModalProps {
  current: string;
  onSelect: (name: string) => void;
  onClose: () => void;
}

const IconPickerModal = ({ current, onSelect, onClose }: IconPickerModalProps) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? ALL_ICON_NAMES.filter((n) => n.toLowerCase().includes(q)) : ALL_ICON_NAMES;
  }, [search]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex w-full max-w-2xl flex-col rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card"
        style={{ maxHeight: "80vh" }}
      >
        <div className="flex items-center justify-between border-b border-theme px-5 py-4">
          <h2 className="text-base font-semibold text-light-text dark:text-dark-text">เลือก Icon</h2>
          <button
            className="grid h-8 w-8 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
            type="button"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-theme p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-text-muted dark:text-dark-text-muted" />
            <input
              className="w-full rounded-md border border-theme bg-light-background py-2 pl-9 pr-3 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary"
              placeholder="ค้นหา icon เช่น Home, Settings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <p className="mt-1.5 text-right text-xs text-light-text-muted dark:text-dark-text-muted">
            {filtered.length} icons
          </p>
        </div>

        <div className="overflow-y-auto p-3">
          <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
            {filtered.map((name) => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => { onSelect(name); onClose(); }}
                className={`flex flex-col items-center gap-1.5 rounded-lg p-2 text-center transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary ${
                  name === current
                    ? "bg-light-primary/15 text-light-primary ring-1 ring-light-primary/40 dark:bg-dark-primary/15 dark:text-dark-primary dark:ring-dark-primary/40"
                    : "text-light-text dark:text-dark-text"
                }`}
              >
                <DynamicIcon name={name} size={22} />
                <span className="w-full truncate text-[9px] leading-tight">{name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

interface MenuItemRecord {
  id: number;
  path: string;
  label: string;
  icon_name: string;
  icon_library: string | null;
  code: string | null;
  permission_id: string | null;
  parent_id: number | null;
  sort_order: number | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface MenusResponse {
  success: boolean;
  data: MenuItemRecord[];
}

interface PermissionItem {
  id: string;
  name: string;
}

interface AccessControlResponse {
  success: boolean;
  data: {
    permissions: PermissionItem[];
  };
}

interface BasicResponse {
  success: boolean;
  message?: string;
}

const emptyForm = {
  label: "",
  path: "",
  icon_name: "Home",
  code: "",
  permission_id: "",
  parent_id: null as number | null,
  sort_order: 0,
  is_active: true,
};

type FormState = typeof emptyForm;

const inputClass =
  "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";

const labelClass = "mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted";

const actionButtonClass =
  "grid h-8 w-8 place-items-center rounded-md border border-theme text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary";

const PROTECTED_MENU_PATHS = new Set(["/admin-console", "/admin-console/menus"]);

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? (error instanceof Error ? error.message : fallback);
};

const MenusManagementPage = () => {
  const { get, post, put, del } = useApi();
  const { fetchMenu } = useMenu();
  const { user } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [menus, setMenus] = useState<MenuItemRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const urlModal = searchParams.get("modal");
  const modal = urlModal === "create" || urlModal === "edit" ? urlModal : null;
  const modalId = Number(searchParams.get("id"));
  const iconPickerOpen = searchParams.get("picker") === "icon";
  const [editTarget, setEditTarget] = useState<MenuItemRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuItemRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const roles = user?.roles ?? [];
  const userPermissions = user?.permissions ?? [];
  const isSuperAdmin = roles.includes("SUPERADMIN");
  const hasPermission = (permission: string) => isSuperAdmin || userPermissions.includes(permission);
  const canReadMenu = hasPermission("menus.read");
  const canCreateMenu = hasPermission("menus.create");
  const canUpdateMenu = hasPermission("menus.update");
  const canDeleteMenu = hasPermission("menus.delete");

  const topLevelMenus = useMemo(() => menus.filter((m) => m.parent_id === null), [menus]);
  const activeCount = useMemo(() => menus.filter((m) => m.is_active).length, [menus]);

  const displayMenus = useMemo(() => {
    const parents = menus
      .filter((m) => m.parent_id === null)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const result: MenuItemRecord[] = [];
    for (const parent of parents) {
      result.push(parent);
      const children = menus
        .filter((m) => m.parent_id === parent.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      result.push(...children);
    }
    const placed = new Set(result.map((m) => m.id));
    menus.filter((m) => !placed.has(m.id)).forEach((m) => result.push(m));
    return result;
  }, [menus]);

  const parentLabel = (id: number | null) => {
    if (!id) return "-";
    return menus.find((m) => m.id === id)?.label ?? String(id);
  };

  const isProtectedMenu = (item: MenuItemRecord) => PROTECTED_MENU_PATHS.has(item.path);

  const loadMenus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [menusRes, aclRes] = await Promise.all([
        get<MenusResponse>("/menus"),
        get<AccessControlResponse>("/access-control/roles-permissions"),
      ]);
      setMenus(menusRes.data.data ?? []);
      setPermissions(aclRes.data.data.permissions ?? []);
    } catch {
      setError("Unable to load menus");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadMenus();
  }, []);

  const closeModal = () => {
    setSearchParams((params) => {
      params.delete("modal");
      params.delete("id");
      params.delete("picker");
      return params;
    });
    setEditTarget(null);
    setDeleteTarget(null);
  };

  useEffect(() => {
    if (modal === "create") {
      setForm(emptyForm);
      setEditTarget(null);
      return;
    }

    if (modal === "edit" && Number.isInteger(modalId)) {
      const item = menus.find((menu) => menu.id === modalId);
      if (!item) return;

      if (isProtectedMenu(item) || !canUpdateMenu) {
        closeModal();
        return;
      }

      setForm({
        label: item.label,
        path: item.path,
        icon_name: item.icon_name,
        code: item.code ?? "",
        permission_id: item.permission_id ?? "",
        parent_id: item.parent_id,
        sort_order: item.sort_order ?? 0,
        is_active: item.is_active ?? true,
      });
      setEditTarget(item);
      return;
    }

    setEditTarget(null);
  }, [modal, modalId, menus, canUpdateMenu]);

  useEffect(() => {
    if (urlModal === "delete" && Number.isInteger(modalId)) {
      const item = menus.find((menu) => menu.id === modalId);
      if (!item) return;

      if (isProtectedMenu(item) || !canDeleteMenu) {
        closeModal();
        return;
      }

      setDeleteTarget(item);
      return;
    }

    setDeleteTarget(null);
  }, [urlModal, modalId, menus, canDeleteMenu]);

  const openCreate = () => {
    if (!canCreateMenu) {
      toast.error("คุณไม่มีสิทธิ์สร้างเมนู");
      return;
    }

    setForm(emptyForm);
    setEditTarget(null);
    setSearchParams((params) => {
      params.set("modal", "create");
      params.delete("id");
      params.delete("picker");
      return params;
    });
  };

  const openEdit = (item: MenuItemRecord) => {
    if (isProtectedMenu(item)) {
      toast.error("เมนูนี้ถูกล็อกไว้เพื่อป้องกันการปิดหรือแก้ไขพลาด");
      return;
    }

    if (!canUpdateMenu) {
      toast.error("คุณไม่มีสิทธิ์แก้ไขเมนู");
      return;
    }

    setForm({
      label: item.label,
      path: item.path,
      icon_name: item.icon_name,
      code: item.code ?? "",
      permission_id: item.permission_id ?? "",
      parent_id: item.parent_id,
      sort_order: item.sort_order ?? 0,
      is_active: item.is_active ?? true,
    });
    setEditTarget(item);
    setSearchParams((params) => {
      params.set("modal", "edit");
      params.set("id", String(item.id));
      params.delete("picker");
      return params;
    });
  };

  const handleSave = async () => {
    if (modal === "edit" && !canUpdateMenu) {
      toast.error("คุณไม่มีสิทธิ์แก้ไขเมนู");
      return;
    }

    if (modal === "create" && !canCreateMenu) {
      toast.error("คุณไม่มีสิทธิ์สร้างเมนู");
      return;
    }

    if (!form.label.trim() || !form.path.trim() || !form.icon_name.trim()) {
      toast.error("Label, path and icon are required");
      return;
    }
    setIsSaving(true);
    const payload = {
      label: form.label.trim(),
      path: form.path.trim(),
      icon_name: form.icon_name,
      code: form.code.trim() || null,
      permission_id: form.permission_id.trim() || null,
      parent_id: form.parent_id,
      sort_order: form.sort_order,
      is_active: form.is_active,
    };
    try {
      if (modal === "edit" && editTarget) {
        await put(`/menus/${editTarget.id}`, payload);
        toast.success("Menu updated");
      } else {
        await post("/menus", payload);
        toast.success("Menu created");
      }
      closeModal();
      await loadMenus();
      await fetchMenu();
    } catch (error) {
      toast.error(getApiErrorMessage(error, modal === "edit" ? "Failed to update menu" : "Failed to create menu"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (!canDeleteMenu) {
      toast.error("คุณไม่มีสิทธิ์ลบเมนู");
      return;
    }

    setIsDeleting(true);
    try {
      await del<BasicResponse>(`/menus/${deleteTarget.id}`);
      toast.success(`"${deleteTarget.label}" deleted`);
      closeModal();
      await loadMenus();
      await fetchMenu();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete menu"));
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleActive = async (item: MenuItemRecord) => {
    if (isProtectedMenu(item)) {
      toast.error("เมนูนี้ถูกล็อกไว้เพื่อป้องกันการปิดพลาด");
      return;
    }

    if (!canUpdateMenu) {
      toast.error("คุณไม่มีสิทธิ์แก้ไขเมนู");
      return;
    }

    if (togglingId !== null) return;
    setTogglingId(item.id);
    try {
      await put(`/menus/${item.id}`, {
        label: item.label,
        path: item.path,
        icon_name: item.icon_name,
        code: item.code,
        permission_id: item.permission_id,
        parent_id: item.parent_id,
        sort_order: item.sort_order,
        is_active: !item.is_active,
      });
      setMenus((prev) =>
        prev.map((m) => (m.id === item.id ? { ...m, is_active: !item.is_active } : m)),
      );
      await fetchMenu();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update status"));
    } finally {
      setTogglingId(null);
    }
  };

  const toCode = (label: string) =>
    label.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "label" && typeof value === "string" ? { code: toCode(value) } : {}),
    }));

  if (!canReadMenu) {
    return (
      <section className="grid gap-5">
        <article className="grid min-h-48 place-items-center rounded-lg border border-theme bg-light-background-card p-6 text-center text-light-text-muted shadow-soft dark:bg-dark-background-card dark:text-dark-text-muted">
          <div>
            <Menu className="mx-auto h-8 w-8 opacity-30" />
            <p className="mt-2 text-sm">คุณไม่มีสิทธิ์ดูเมนู</p>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="grid gap-5">
      {/* Header */}
      <div className="rounded-xl border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-light-primary to-light-primary-hover text-white shadow-sm dark:from-dark-primary dark:to-dark-primary-hover dark:text-dark-background">
              <Menu size={26} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                Admin Console
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">Menus</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                จัดการเมนู Sidebar — เพิ่ม แก้ไข และลบรายการเมนู
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreateMenu && (
              <button
                className="inline-flex items-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
                type="button"
                onClick={openCreate}
              >
                <Plus className="h-4 w-4" />Add menu
              </button>
            )}
            <button
              className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
              type="button"
              onClick={() => void loadMenus()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total menus" value={menus.length} icon={<Menu className="h-5 w-5" />} />
        <StatCard label="Active" value={activeCount} icon={<Eye className="h-5 w-5" />} tone="success" />
        <StatCard label="Inactive" value={menus.length - activeCount} icon={<EyeOff className="h-5 w-5" />} tone="muted" />
      </div>

      {/* Table */}
      <article className="overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-soft dark:bg-dark-background-card">
        {error && (
          <div className="flex items-center gap-3 p-5 text-sm text-red-600 dark:text-red-300">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}
        {isLoading ? (
          <div className="grid min-h-48 place-items-center text-light-text-muted dark:text-dark-text-muted">
            Loading menus...
          </div>
        ) : menus.length === 0 ? (
          <div className="grid min-h-48 place-items-center gap-2 text-center text-light-text-muted dark:text-dark-text-muted">
            <Menu className="mx-auto h-8 w-8 text-light-primary dark:text-dark-primary" />
            <span>{canCreateMenu ? "No menus found — add a menu to start" : "No menus found"}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
              <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Label</th>
                  <th className="px-4 py-3 font-semibold">Path</th>
                  <th className="px-4 py-3 font-semibold">Icon</th>
                  <th className="px-4 py-3 font-semibold">Permission</th>
                  <th className="px-4 py-3 font-semibold">Parent</th>
                  <th className="px-4 py-3 font-semibold">Sort</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                {displayMenus.map((item) => (
                  <tr className="transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10" key={item.id}>
                    <td className="px-4 py-3 font-medium text-light-text dark:text-dark-text">
                      {item.parent_id ? (
                        <span className="ml-4 text-light-text-muted dark:text-dark-text-muted">↳ {item.label}</span>
                      ) : (
                        item.label
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-light-text-muted dark:text-dark-text-muted">
                      {item.path}
                    </td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{item.icon_name}</td>
                    <td className="px-4 py-3">
                      {item.permission_id ? (
                        <span className="inline-flex rounded-md bg-light-primary/10 px-2 py-1 text-xs font-semibold text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                          {item.permission_id}
                        </span>
                      ) : (
                        <span className="text-xs text-light-text-muted dark:text-dark-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                      {parentLabel(item.parent_id)}
                    </td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{item.sort_order}</td>
                    <td className="px-4 py-3">
                      {isProtectedMenu(item) ? (
                        <span className="inline-flex rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          Protected
                        </span>
                      ) : (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={item.is_active ?? false}
                          onClick={() => void toggleActive(item)}
                          disabled={togglingId !== null || !canUpdateMenu}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-light-primary focus:ring-offset-2 dark:focus:ring-dark-primary ${
                            togglingId === item.id
                              ? "cursor-wait opacity-60"
                              : !canUpdateMenu
                                ? "cursor-not-allowed opacity-60"
                              : "cursor-pointer"
                          } ${
                            item.is_active
                              ? "bg-light-primary dark:bg-dark-primary"
                              : "bg-light-text-muted/30 dark:bg-dark-text-muted/30"
                          }`}
                        >
                          {togglingId === item.id ? (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <RefreshCw className="h-3 w-3 animate-spin text-white" />
                            </span>
                          ) : (
                            <span
                              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
                                item.is_active ? "translate-x-[18px]" : "translate-x-[3px]"
                              }`}
                            />
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {isProtectedMenu(item) ? (
                          <span className="text-sm text-light-text-muted dark:text-dark-text-muted">Locked</span>
                        ) : !canUpdateMenu && !canDeleteMenu && (
                          <span className="text-sm text-light-text-muted dark:text-dark-text-muted">—</span>
                        )}
                        {!isProtectedMenu(item) && canUpdateMenu && (
                          <button
                            className={actionButtonClass}
                            type="button"
                            title="Edit"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {!isProtectedMenu(item) && canDeleteMenu && (
                          <button
                            className={`${actionButtonClass} hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400`}
                            type="button"
                            title="Delete"
                            onClick={() => setSearchParams((params) => {
                              params.set("modal", "delete");
                              params.set("id", String(item.id));
                              params.delete("picker");
                              return params;
                            })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {/* Create / Edit Modal */}
      {modal && (modal === "edit" ? canUpdateMenu : canCreateMenu) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="w-full max-w-lg rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">
            <div className="flex items-center justify-between border-b border-theme px-5 py-4">
              <h2 className="text-base font-semibold text-light-text dark:text-dark-text">
                {modal === "edit" ? "Edit menu" : "Add menu"}
              </h2>
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
                type="button"
                onClick={closeModal}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Label *</label>
                  <input
                    className={inputClass}
                    placeholder="Dashboard"
                    value={form.label}
                    onChange={(e) => setField("label", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Path *</label>
                  <input
                    className={inputClass}
                    placeholder="/dashboard"
                    value={form.path}
                    onChange={(e) => setField("path", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Icon *</label>
                  <div className="flex items-center gap-1">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-theme bg-light-background text-light-text dark:bg-dark-background dark:text-dark-text">
                      <DynamicIcon name={form.icon_name} size={16} />
                    </span>
                    <input
                      className={`${inputClass} flex-1`}
                      placeholder="Home"
                      value={form.icon_name}
                      onChange={(e) => setField("icon_name", e.target.value)}
                    />
                    <button
                      type="button"
                      title="เลือก icon"
                      onClick={() => setSearchParams((params) => {
                        params.set("picker", "icon");
                        return params;
                      })}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-theme bg-light-background text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:bg-dark-background dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
                    >
                      <Search className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>
                    Code
                    <span className="ml-1.5 font-normal text-light-primary/70 dark:text-dark-primary/70">auto</span>
                  </label>
                  <input
                    className={inputClass}
                    placeholder="dashboard"
                    value={form.code}
                    onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Permission ID</label>
                  <input
                    className={inputClass}
                    placeholder="พิมพ์เพื่อค้นหา..."
                    value={form.permission_id}
                    onChange={(e) => setField("permission_id", e.target.value)}
                    list="permissions-datalist"
                    autoComplete="off"
                  />
                  <datalist id="permissions-datalist">
                    {permissions.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className={labelClass}>Parent menu</label>
                  <select
                    className={inputClass}
                    value={form.parent_id ?? ""}
                    onChange={(e) =>
                      setField("parent_id", e.target.value === "" ? null : Number(e.target.value))
                    }
                  >
                    <option value="">— none (top level) —</option>
                    {topLevelMenus
                      .filter((m) => m.id !== editTarget?.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Sort order</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setField("sort_order", Number(e.target.value))}
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-light-primary dark:accent-dark-primary"
                      checked={form.is_active}
                      onChange={(e) => setField("is_active", e.target.checked)}
                    />
                    <span className="text-sm font-medium text-light-text dark:text-dark-text">Active</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-theme px-5 py-4">
              <button
                className="rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10"
                type="button"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                {isSaving && <RefreshCw className="h-4 w-4 animate-spin" />}
                {modal === "edit" ? "Save changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Icon Picker */}
      {iconPickerOpen && (modal === "edit" ? canUpdateMenu : canCreateMenu) && (
        <IconPickerModal
          current={form.icon_name}
          onSelect={(name) => setField("icon_name", name)}
          onClose={() => setSearchParams((params) => {
            params.delete("picker");
            return params;
          })}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && canDeleteMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">
            <div className="p-6">
              <h2 className="mb-2 text-base font-semibold text-light-text dark:text-dark-text">Delete menu</h2>
              <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
                ลบ <strong className="text-light-text dark:text-dark-text">"{deleteTarget.label}"</strong>?
                ถ้ามี sub-items อยู่จะลบไม่ได้
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-theme px-5 py-4">
              <button
                className="rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10"
                type="button"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                type="button"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
              >
                {isDeleting && <RefreshCw className="h-4 w-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default MenusManagementPage;
