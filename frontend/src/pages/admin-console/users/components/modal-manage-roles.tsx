import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Check, Plus, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/contexts/SessionContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoleOption {
  id: string;
  name: string;
  priority: number;
  description: string | null;
}

interface UserRoleItem {
  roleId: string;
  roleName: string;
  priority: number;
  description: string | null;
  assignedAt: string;
}

export interface ModalManageRolesProps {
  userId: number;
  username: string;
  onClose: () => void;
  onSaved: () => void;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const ModalManageRoles = ({ userId, username, onClose, onSaved }: ModalManageRolesProps) => {
  const { get, put } = useApi();
  const { user: currentUser } = useSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const [userRoles, setUserRoles] = useState<UserRoleItem[]>([]);
  const [allRoles, setAllRoles] = useState<RoleOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── โหลดข้อมูล ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [userRolesRes, allRolesRes] = await Promise.all([
          get<{ success: boolean; data: UserRoleItem[] }>(`/users/${userId}/roles`),
          get<{ success: boolean; data: { roles: RoleOption[] } }>("/access-control/roles-permissions"),
        ]);

        const current = userRolesRes.data.data ?? [];
        setUserRoles(current);
        setSelectedIds(new Set(current.map((r) => r.roleId)));

        const fetchedRoles = allRolesRes.data.data.roles ?? [];
        const myRoleIds = new Set(currentUser?.roles ?? []);
        const myMaxPriority = fetchedRoles
          .filter((r) => myRoleIds.has(r.id))
          .reduce((max, r) => Math.max(max, r.priority), 0);

        setAllRoles(fetchedRoles.filter((r) => r.priority <= myMaxPriority));
      } catch {
        toast.error("ไม่สามารถโหลดข้อมูล roles ได้");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [userId]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const addRole = (id: string) => {
    setSelectedIds((prev) => new Set([...prev, id]));
    setShowAdd(false);
  };

  const removeRole = (id: string) => {
    if (selectedIds.size <= 1) {
      toast.warning("ผู้ใช้ต้องมีอย่างน้อย 1 role");
      return;
    }
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await put(`/users/${userId}/roles`, { roleIds: [...selectedIds] });
      toast.success(`อัพเดท roles ของ "${username}" สำเร็จ`);
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update roles");
    } finally {
      setSaving(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const getRoleById = (id: string) => allRoles.find((r) => r.id === id);
  const availableToAdd = allRoles.filter((r) => !selectedIds.has(r.id));

  const priorityBadge = (priority: number) => {
    if (priority >= 100) return "bg-red-500/10 text-red-600 dark:text-red-400";
    if (priority >= 50) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    return "bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary";
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => !saving && e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex w-full max-w-lg flex-col rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card"
        style={{ maxHeight: "85vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-theme px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-light-text dark:text-dark-text">จัดการ Roles</h2>
              <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                ผู้ใช้: <span className="font-semibold">{username}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="grid min-h-32 place-items-center">
              <RefreshCw className="h-6 w-6 animate-spin text-light-text-muted dark:text-dark-text-muted" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Current roles */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-light-primary dark:text-dark-primary">
                    Roles ปัจจุบัน ({selectedIds.size})
                  </p>
                  {availableToAdd.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAdd((p) => !p)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-theme px-2.5 py-1 text-xs font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      เพิ่ม Role
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {[...selectedIds].map((roleId) => {
                    const role = getRoleById(roleId) ?? userRoles.find((r) => r.roleId === roleId);
                    const name = (role as RoleOption)?.name ?? (role as UserRoleItem)?.roleName ?? roleId;
                    const desc = (role as RoleOption)?.description ?? (role as UserRoleItem)?.description;
                    const priority = (role as RoleOption)?.priority ?? (role as UserRoleItem)?.priority ?? 0;
                    const isNew = !userRoles.find((r) => r.roleId === roleId);

                    return (
                      <div
                        key={roleId}
                        className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                          isNew
                            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                            : "border-theme bg-light-background dark:bg-dark-background"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`inline-flex shrink-0 rounded-md px-2.5 py-1 text-xs font-bold ${priorityBadge(priority)}`}>
                            {name}
                          </span>
                          {isNew && (
                            <span className="shrink-0 rounded-md bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              ใหม่
                            </span>
                          )}
                          {desc && (
                            <span className="truncate text-xs text-light-text-muted dark:text-dark-text-muted">{desc}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRole(roleId)}
                          disabled={selectedIds.size <= 1}
                          className="ml-3 shrink-0 grid h-7 w-7 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-dark-text-muted dark:hover:bg-red-900/20 dark:hover:text-red-400"
                          title={selectedIds.size <= 1 ? "ต้องมีอย่างน้อย 1 role" : "ลบ role"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add role section */}
              {showAdd && (
                <div className="border-t border-theme pt-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-light-primary dark:text-dark-primary">
                    เพิ่ม Role
                  </p>
                  {availableToAdd.length === 0 ? (
                    <p className="text-center text-sm text-light-text-muted dark:text-dark-text-muted">
                      ผู้ใช้มี Role ครบทุกตัวแล้ว
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {availableToAdd.map((role) => (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => addRole(role.id)}
                          className="flex w-full items-center justify-between rounded-lg border border-theme bg-light-background px-4 py-3 text-left transition-colors hover:border-light-primary hover:bg-light-primary/5 dark:bg-dark-background dark:hover:border-dark-primary dark:hover:bg-dark-primary/5"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`inline-flex shrink-0 rounded-md px-2.5 py-1 text-xs font-bold ${priorityBadge(role.priority)}`}>
                              {role.name}
                            </span>
                            {role.description && (
                              <span className="truncate text-xs text-light-text-muted dark:text-dark-text-muted">
                                {role.description}
                              </span>
                            )}
                          </div>
                          <Plus className="ml-3 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-theme px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 disabled:opacity-50 dark:text-dark-text dark:hover:bg-dark-primary/10"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loading}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            บันทึกการเปลี่ยนแปลง
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ModalManageRoles;
