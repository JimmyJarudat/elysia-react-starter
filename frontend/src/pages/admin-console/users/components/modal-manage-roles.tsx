import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
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

// ─── Modal ──────────────────────────────────────────────────────────────────

const ModalManageRoles = ({ userId, username, onClose, onSaved }: ModalManageRolesProps) => {
  const { get, put } = useApi();
  const { user: currentUser } = useSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [allRoles, setAllRoles] = useState<RoleOption[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null); // ← single value
  const [inaccessibleCurrentRole, setInaccessibleCurrentRole] = useState<UserRoleItem | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [userRolesRes, allRolesRes] = await Promise.all([
          get<{ success: boolean; data: UserRoleItem[] }>(`/users/${userId}/roles`),
          get<{ success: boolean; data: { roles: RoleOption[] } }>("/access-control/roles-permissions"),
        ]);

        const current = userRolesRes.data.data ?? [];
        const fetchedRoles = allRolesRes.data.data.roles ?? [];
        const myRoleIds = new Set(currentUser?.roles ?? []);
        const myMaxPriority = fetchedRoles
          .filter((r) => myRoleIds.has(r.id))
          .reduce((max, r) => Math.max(max, r.priority), 0);
        const allowedRoles = fetchedRoles.filter((r) => r.priority <= myMaxPriority);
        const inaccessibleRole = current
          .filter((role) => role.priority > myMaxPriority)
          .sort((a, b) => b.priority - a.priority)[0] ?? null;
        const currentRole = current[0] ?? null;
        const canAccessCurrentRole = !inaccessibleRole;

        setAllRoles(allowedRoles);
        setInaccessibleCurrentRole(inaccessibleRole);
        setSelectedRoleId(canAccessCurrentRole ? currentRole?.roleId ?? null : null);
      } catch {
        toast.error("ไม่สามารถโหลดข้อมูล roles ได้");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [userId]);

  const isTargetRoleLocked = Boolean(inaccessibleCurrentRole);
  const canSave = Boolean(!isTargetRoleLocked && selectedRoleId && allRoles.some((role) => role.id === selectedRoleId));

  const handleSave = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    try {
      await put(`/users/${userId}/roles`, { roleIds: [selectedRoleId] });
      toast.success(`อัพเดท role ของ "${username}" สำเร็จ`);
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setSaving(false);
    }
  };

  const priorityBadge = (priority: number) => {
    if (priority >= 100) return "bg-red-500/10 text-red-600 dark:text-red-400";
    if (priority >= 50)  return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    return "bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary";
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => !saving && e.target === e.currentTarget && onClose()}
    >
      <div className="flex w-full max-w-lg flex-col rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card" style={{ maxHeight: "85vh" }}>

        {/* Header — เหมือนเดิม */}
        <div className="flex items-center justify-between border-b border-theme px-5 py-4">
          {/* ... */}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="grid min-h-32 place-items-center">
              <RefreshCw className="h-6 w-6 animate-spin text-light-text-muted dark:text-dark-text-muted" />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-light-primary dark:text-dark-primary">
                เลือก Role
              </p>
              {inaccessibleCurrentRole && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  ผู้ใช้นี้มี role {inaccessibleCurrentRole.roleName} ซึ่งมี priority สูงกว่าของคุณ จึงไม่สามารถแก้ไข role ของผู้ใช้นี้ได้
                </div>
              )}
              {allRoles.length === 0 && (
                <div className="rounded-lg border border-theme bg-light-background px-4 py-3 text-sm text-light-text-muted dark:bg-dark-background dark:text-dark-text-muted">
                  ไม่มี role ที่คุณสามารถจัดการได้
                </div>
              )}
              {allRoles.map((role) => {
                const isSelected = role.id === selectedRoleId;
                return (
                  <button
                    key={role.id}
                    type="button"
                    disabled={isTargetRoleLocked}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? "border-light-primary bg-light-primary/5 dark:border-dark-primary dark:bg-dark-primary/5"
                        : "border-theme bg-light-background hover:border-light-primary/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-dark-background"
                    }`}
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
                    {isSelected
                      ? <Check className="ml-3 h-4 w-4 shrink-0 text-light-primary dark:text-dark-primary" />
                      : <div className="ml-3 h-4 w-4 shrink-0 rounded-full border border-theme" />
                    }
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-theme px-5 py-4">
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 disabled:opacity-50 dark:text-dark-text dark:hover:bg-dark-primary/10">
            ยกเลิก
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={saving || loading || !canSave}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover">
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
