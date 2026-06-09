import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle, ArrowRight, ChevronDown, Copy, KeyRound, Pencil, Plus, RefreshCw,
  Search, ShieldCheck, SlidersHorizontal, Trash2, X,
} from "lucide-react";
import { toast } from "react-toastify";
import StatCard from "@/common/StatCard";
import { useApi } from "@/hooks/useApi";
import { useRegional } from "@/contexts/RegionalContext";
import { useSession } from "@/contexts/SessionContext";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  permissions: Array<{ id: string; name: string; resource: string; action: string; description: string | null }>;
  createdAt: string;
  updatedAt: string;
}

interface RolesPermissionsResponse {
  success: boolean;
  data: { roles: RoleItem[]; permissions: PermissionItem[] };
}

interface HierarchyItem {
  parentRoleId: string;
  parentRoleName: string;
  parentPriority: number;
  childRoleId: string;
  childRoleName: string;
  childPriority: number;
  createdAt: string;
}

interface HierarchyResponse {
  success: boolean;
  data: HierarchyItem[];
}

type Tab = "roles" | "permissions" | "hierarchy";
const TAB_VALUES: Tab[] = ["roles", "permissions", "hierarchy"];
const isTab = (value: string | null): value is Tab => TAB_VALUES.includes(value as Tab);

// ─── Helpers ──────────────────────────────────────────────────────────────────

// formatDate ใช้จาก useRegional — ดู RolesPermissionsPage

// permission resource ที่เป็นหมวดย่อย เช่น settings.security.jwt ให้รวมเป็นหมวดหลัก settings ตอนกรอง/จัดกลุ่มในหน้านี้
// (ค่า resource จริงใน DB ยังแยกย่อยตามเดิม — แก้ไม่ได้เพราะชนกับ unique constraint resource+action)
const resourceGroupOf = (resource: string) => resource.split(".")[0];

const inputClass =
  "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";
const labelClass = "mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted";
const actionBtn =
  "grid h-8 w-8 place-items-center rounded-md border border-theme text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary";
const isSystemRole = (roleId: string) => roleId === "SUPERADMIN";

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

interface DeleteConfirmProps {
  label: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

const DeleteConfirm = ({ label, onConfirm, onClose }: DeleteConfirmProps) => {
  const [busy, setBusy] = useState(false);
  const run = async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">
        <div className="p-6">
          <h2 className="mb-2 text-base font-semibold text-light-text dark:text-dark-text">ยืนยันการลบ</h2>
          <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
            ลบ <strong className="text-light-text dark:text-dark-text">"{label}"</strong>?
            การกระทำนี้ไม่สามารถย้อนกลับได้
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-theme px-5 py-4">
          <button type="button" onClick={onClose}
            className="rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10">
            ยกเลิก
          </button>
          <button type="button" onClick={() => void run()} disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60">
            {busy && <RefreshCw className="h-4 w-4 animate-spin" />}
            ลบ
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ─── Role Form Modal ──────────────────────────────────────────────────────────

interface RoleFormProps {
  initial?: RoleItem | null;
  onClose: () => void;
  onSaved: () => void;
}

const RoleForm = ({ initial, onClose, onSaved }: RoleFormProps) => {
  const { post, put } = useApi();
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    id: initial?.id ?? "",
    name: initial?.name ?? "",
    priority: initial?.priority ?? 0,
    description: initial?.description ?? "",
  });
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!isEdit && !form.id.trim()) { toast.error("Role ID is required"); return; }
    setBusy(true);
    try {
      if (isEdit) {
        await put(`/access-control/roles/${initial!.id}`, {
          name: form.name, priority: form.priority, description: form.description || null,
        });
        toast.success("Role updated");
      } else {
        await post("/access-control/roles", {
          id: form.id.trim().toUpperCase(),
          name: form.name, priority: form.priority, description: form.description || null,
        });
        toast.success("Role created");
      }
      onSaved(); onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save role");
    } finally { setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">
        <div className="flex items-center justify-between border-b border-theme px-5 py-4">
          <h2 className="text-base font-semibold text-light-text dark:text-dark-text">
            {isEdit ? "แก้ไข Role" : "เพิ่ม Role"}
          </h2>
          <button type="button" onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-light-text-muted hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4 p-5">
          {!isEdit && (
            <div>
              <label className={labelClass}>Role ID * <span className="font-normal">(จะถูกแปลงเป็น UPPERCASE)</span></label>
              <input className={inputClass} placeholder="MANAGER" value={form.id}
                onChange={(e) => setForm((p) => ({ ...p, id: e.target.value }))} />
            </div>
          )}
          {isEdit && (
            <div>
              <label className={labelClass}>Role ID</label>
              <input className={`${inputClass} cursor-not-allowed opacity-60`} value={form.id} readOnly />
            </div>
          )}
          <div>
            <label className={labelClass}>Name *</label>
            <input className={inputClass} placeholder="Manager" value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Priority</label>
            <input className={inputClass} type="number" value={form.priority}
              onChange={(e) => setForm((p) => ({ ...p, priority: Number(e.target.value) }))} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea className={inputClass} rows={2} placeholder="คำอธิบาย role นี้"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-theme px-5 py-4">
          <button type="button" onClick={onClose}
            className="rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10">
            ยกเลิก
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover">
            {busy && <RefreshCw className="h-4 w-4 animate-spin" />}
            {isEdit ? "บันทึก" : "สร้าง"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ─── Permission Form Modal ────────────────────────────────────────────────────

interface PermissionFormProps {
  initial?: PermissionItem | null;
  onClose: () => void;
  onSaved: () => void;
}

const PermissionForm = ({ initial, onClose, onSaved }: PermissionFormProps) => {
  const { post, put } = useApi();
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    id: initial?.id ?? "",
    name: initial?.name ?? "",
    resource: initial?.resource ?? "",
    action: initial?.action ?? "",
    description: initial?.description ?? "",
  });
  const [busy, setBusy] = useState(false);

  // Auto-generate id from resource + action when creating
  const autoId = `${form.resource.trim()}.${form.action.trim()}`;

  const handleSave = async () => {
    if (!form.name.trim() || !form.resource.trim() || !form.action.trim()) {
      toast.error("Name, resource and action are required"); return;
    }
    setBusy(true);
    const id = isEdit ? initial!.id : (form.id.trim() || autoId);
    try {
      if (isEdit) {
        await put(`/access-control/permissions/${initial!.id}`, {
          name: form.name, resource: form.resource, action: form.action,
          description: form.description || null,
        });
        toast.success("Permission updated");
      } else {
        await post("/access-control/permissions", {
          id, name: form.name, resource: form.resource, action: form.action,
          description: form.description || null,
        });
        toast.success("Permission created");
      }
      onSaved(); onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save permission");
    } finally { setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">
        <div className="flex items-center justify-between border-b border-theme px-5 py-4">
          <h2 className="text-base font-semibold text-light-text dark:text-dark-text">
            {isEdit ? "แก้ไข Permission" : "เพิ่ม Permission"}
          </h2>
          <button type="button" onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-light-text-muted hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Resource *</label>
              <input className={inputClass} placeholder="users" value={form.resource}
                onChange={(e) => setForm((p) => ({ ...p, resource: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Action *</label>
              <input className={inputClass} placeholder="read" value={form.action}
                onChange={(e) => setForm((p) => ({ ...p, action: e.target.value }))} />
            </div>
          </div>
          {!isEdit && (
            <div>
              <label className={labelClass}>
                Permission ID
                <span className="ml-1 font-normal text-light-primary/70 dark:text-dark-primary/70">auto</span>
              </label>
              <input className={inputClass} placeholder={autoId || "resource.action"}
                value={form.id}
                onChange={(e) => setForm((p) => ({ ...p, id: e.target.value }))} />
            </div>
          )}
          {isEdit && (
            <div>
              <label className={labelClass}>Permission ID</label>
              <input className={`${inputClass} cursor-not-allowed opacity-60`} value={form.id} readOnly />
            </div>
          )}
          <div>
            <label className={labelClass}>Name *</label>
            <input className={inputClass} placeholder="Users Read" value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea className={inputClass} rows={2} placeholder="คำอธิบาย permission นี้"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-theme px-5 py-4">
          <button type="button" onClick={onClose}
            className="rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10">
            ยกเลิก
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover">
            {busy && <RefreshCw className="h-4 w-4 animate-spin" />}
            {isEdit ? "บันทึก" : "สร้าง"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ─── Clone Role Modal ─────────────────────────────────────────────────────────

interface CloneRoleFormProps {
  source: RoleItem;
  onClose: () => void;
  onSaved: () => void;
}

const CloneRoleForm = ({ source, onClose, onSaved }: CloneRoleFormProps) => {
  const { post } = useApi();
  const [form, setForm] = useState({
    newId: `${source.id}_COPY`,
    newName: `${source.name} (Copy)`,
    newDescription: source.description ?? "",
  });
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    if (!form.newId.trim() || !form.newName.trim()) {
      toast.error("Role ID และ Name จำเป็นต้องกรอก"); return;
    }
    setBusy(true);
    try {
      await post(`/access-control/roles/${source.id}/clone`, {
        newId: form.newId.trim().toUpperCase(),
        newName: form.newName.trim(),
        newDescription: form.newDescription.trim() || null,
      });
      toast.success(`คัดลอก "${source.name}" → "${form.newName}" สำเร็จ`);
      onSaved(); onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to clone role");
    } finally { setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">
        <div className="flex items-center justify-between border-b border-theme px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-light-text dark:text-dark-text">คัดลอก Role</h2>
            <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">
              ต้นทาง: <span className="font-semibold text-light-primary dark:text-dark-primary">{source.name}</span>
              <span className="ml-1">· {source.permissionCount} permissions จะ copy มาด้วย</span>
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-light-text-muted hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-5">
          <div>
            <label className={labelClass}>Role ID ใหม่ * <span className="font-normal">(จะถูกแปลงเป็น UPPERCASE)</span></label>
            <input className={inputClass} value={form.newId}
              onChange={(e) => setForm((p) => ({ ...p, newId: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Name ใหม่ *</label>
            <input className={inputClass} value={form.newName}
              onChange={(e) => setForm((p) => ({ ...p, newName: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea className={inputClass} rows={2} value={form.newDescription}
              onChange={(e) => setForm((p) => ({ ...p, newDescription: e.target.value }))} />
          </div>

          <div className="rounded-lg bg-light-primary/5 p-3 text-xs text-light-text-muted dark:bg-dark-primary/5 dark:text-dark-text-muted">
            Permissions ทั้ง {source.permissionCount} รายการของ "{source.name}" จะถูก copy ไปยัง role ใหม่ด้วย
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-theme px-5 py-4">
          <button type="button" onClick={onClose}
            className="rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10">
            ยกเลิก
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover">
            {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            คัดลอก
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ─── Permission Manager Modal ─────────────────────────────────────────────────

interface PermissionManagerProps {
  role: RoleItem;
  allPermissions: PermissionItem[];
  onClose: () => void;
  onSaved: () => void;
}

const PermissionManager = ({ role, allPermissions, onClose, onSaved }: PermissionManagerProps) => {
  const { put } = useApi();
  const [selected, setSelected] = useState<Set<string>>(new Set(role.permissions.map((p) => p.id)));
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? allPermissions.filter((p) => p.resource.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      : allPermissions;
    const map = new Map<string, PermissionItem[]>();
    for (const p of filtered) {
      const group = resourceGroupOf(p.resource);
      map.set(group, [...(map.get(group) ?? []), p]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [allPermissions, search]);

  const toggleAll = (ids: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allChecked = ids.every((id) => next.has(id));
      ids.forEach((id) => (allChecked ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const toggle = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await put(`/access-control/roles/${role.id}/permissions`, { permissionIds: [...selected] });
      toast.success(`อัพเดท permissions ของ "${role.name}" แล้ว`);
      onSaved(); onClose();
    } catch { toast.error("Failed to update permissions"); } finally { setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex w-full max-w-2xl flex-col rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card"
        style={{ maxHeight: "85vh" }}>
        <div className="flex items-center justify-between border-b border-theme px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-light-text dark:text-dark-text">จัดการ Permissions</h2>
            <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">
              Role: <span className="font-semibold text-light-primary dark:text-dark-primary">{role.name}</span>
              <span className="ml-2">— เลือกแล้ว {selected.size} / {allPermissions.length}</span>
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-light-text-muted hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-theme p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-text-muted dark:text-dark-text-muted" />
            <input className="w-full rounded-md border border-theme bg-light-background py-2 pl-9 pr-3 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary"
              placeholder="ค้นหา resource หรือชื่อ..." value={search}
              onChange={(e) => setSearch(e.target.value)} autoFocus />
          </div>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {grouped.length === 0 ? (
            <p className="py-8 text-center text-sm text-light-text-muted dark:text-dark-text-muted">ไม่พบ permission</p>
          ) : grouped.map(([resource, perms]) => {
            const ids = perms.map((p) => p.id);
            const checked = ids.filter((id) => selected.has(id)).length;
            const allChecked = checked === ids.length;
            const some = checked > 0 && !allChecked;
            return (
              <div key={resource} className="overflow-hidden rounded-lg border border-theme">
                <button type="button" onClick={() => toggleAll(ids)}
                  className="flex w-full items-center gap-3 bg-light-primary/5 px-4 py-2.5 text-left hover:bg-light-primary/10 dark:bg-dark-primary/5 dark:hover:bg-dark-primary/10">
                  <input type="checkbox" readOnly checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = some; }}
                    className="h-4 w-4 rounded accent-light-primary dark:accent-dark-primary" />
                  <span className="text-sm font-semibold capitalize text-light-text dark:text-dark-text">{resource}</span>
                  <span className="ml-auto text-xs text-light-text-muted dark:text-dark-text-muted">{checked}/{perms.length}</span>
                </button>
                <div className="divide-y divide-light-border-light dark:divide-dark-border-light">
                  {perms.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-light-primary/5 dark:hover:bg-dark-primary/5">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)}
                        className="h-4 w-4 rounded accent-light-primary dark:accent-dark-primary" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-light-text dark:text-dark-text">{p.name}</span>
                        <span className="block truncate text-xs text-light-text-muted dark:text-dark-text-muted">{p.id}</span>
                      </span>
                      <span className="shrink-0 rounded-md bg-light-primary/10 px-2 py-0.5 text-xs font-semibold text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                        {p.action}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-theme px-5 py-4">
          <button type="button" onClick={() => setSelected(new Set())}
            className="text-sm text-light-text-muted hover:text-red-500 dark:text-dark-text-muted dark:hover:text-red-400">
            ยกเลิกทั้งหมด
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10">
              ยกเลิก
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover">
              {busy && <RefreshCw className="h-4 w-4 animate-spin" />}
              บันทึก
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ─── Add Hierarchy Modal ──────────────────────────────────────────────────────

interface AddHierarchyFormProps {
  roles: RoleItem[];
  existing: HierarchyItem[];
  onClose: () => void;
  onSaved: () => void;
}

const AddHierarchyForm = ({ roles, existing, onClose, onSaved }: AddHierarchyFormProps) => {
  const { post } = useApi();
  const [parentId, setParentId] = useState("");
  const [childId, setChildId] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    if (!parentId || !childId) { toast.error("กรุณาเลือก Parent และ Child role"); return; }
    if (parentId === childId) { toast.error("Parent และ Child ต้องเป็น role คนละตัว"); return; }
    const dup = existing.some((e) => e.parentRoleId === parentId && e.childRoleId === childId);
    if (dup) { toast.error("ความสัมพันธ์นี้มีอยู่แล้ว"); return; }
    setBusy(true);
    try {
      await post("/access-control/role-hierarchy", { parentRoleId: parentId, childRoleId: childId });
      toast.success("เพิ่มความสัมพันธ์สำเร็จ");
      onSaved(); onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add hierarchy");
    } finally { setBusy(false); }
  };

  const parentRole = roles.find((r) => r.id === parentId);
  const childRole = roles.find((r) => r.id === childId);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">
        <div className="flex items-center justify-between border-b border-theme px-5 py-4">
          <h2 className="text-base font-semibold text-light-text dark:text-dark-text">เพิ่มความสัมพันธ์</h2>
          <button type="button" onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-light-text-muted hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-5">
          <div>
            <label className={labelClass}>Parent Role <span className="font-normal">(มีสิทธิ์สูงกว่า)</span></label>
            <select className={inputClass} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">— เลือก Parent Role —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
              ))}
            </select>
          </div>

          {/* Arrow preview */}
          <div className="flex items-center justify-center gap-3 py-1">
            <span className={`rounded-md px-3 py-1.5 text-sm font-semibold ${parentId ? "bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary" : "text-light-text-muted dark:text-dark-text-muted"}`}>
              {parentRole?.name ?? "Parent"}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-light-text-muted dark:text-dark-text-muted" />
            <span className={`rounded-md px-3 py-1.5 text-sm font-semibold ${childId ? "bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary" : "text-light-text-muted dark:text-dark-text-muted"}`}>
              {childRole?.name ?? "Child"}
            </span>
          </div>

          <div>
            <label className={labelClass}>Child Role <span className="font-normal">(สืบทอดจาก Parent)</span></label>
            <select className={inputClass} value={childId} onChange={(e) => setChildId(e.target.value)}>
              <option value="">— เลือก Child Role —</option>
              {roles.filter((r) => r.id !== parentId).map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-theme px-5 py-4">
          <button type="button" onClick={onClose}
            className="rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10">
            ยกเลิก
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover">
            {busy && <RefreshCw className="h-4 w-4 animate-spin" />}
            เพิ่ม
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const RolesPermissionsPage = () => {
  const { get, del } = useApi();
  const { user } = useSession();
  const { formatDateTime: formatDate } = useRegional();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = isTab(searchParams.get("tab")) ? searchParams.get("tab") as Tab : "roles";
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [hierarchy, setHierarchy] = useState<HierarchyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [roleForm, setRoleForm] = useState<{ open: boolean; item?: RoleItem }>({ open: false });
  const [permForm, setPermForm] = useState<{ open: boolean; item?: PermissionItem }>({ open: false });
  const [managingRole, setManagingRole] = useState<RoleItem | null>(null);
  const [cloningRole, setCloningRole] = useState<RoleItem | null>(null);
  const [addHierarchyOpen, setAddHierarchyOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ label: string; onConfirm: () => Promise<void> } | null>(null);
  const permissionSearch = searchParams.get("permissionSearch") ?? "";
  const permissionResource = searchParams.get("permissionResource") ?? "all";
  const permissionAction = searchParams.get("permissionAction") ?? "all";
  const [collapsedResources, setCollapsedResources] = useState<Set<string>>(new Set());
  const [, setKnownResources] = useState<Set<string>>(new Set());
  const userRoles = user?.roles ?? [];
  const userPermissions = user?.permissions ?? [];
  const isSuperAdmin = userRoles.includes("SUPERADMIN");
  const urlModal = searchParams.get("modal");
  const urlId = searchParams.get("id") ?? "";
  const urlType = searchParams.get("type") ?? "";
  const urlParent = searchParams.get("parent") ?? "";
  const urlChild = searchParams.get("child") ?? "";
  const hasPermission = (permission: string) => isSuperAdmin || userPermissions.includes(permission);
  const canReadRoles = hasPermission("roles.read");
  const canCreateRole = hasPermission("roles.create");
  const canUpdateRole = hasPermission("roles.update");
  const canDeleteRole = hasPermission("roles.delete");
  const canReadPermissions = hasPermission("permissions.read");
  const canCreatePermission = hasPermission("permissions.create");
  const canUpdatePermission = hasPermission("permissions.update");
  const canDeletePermission = hasPermission("permissions.delete");
  const canReadRolePermissions = hasPermission("role-permissions.read");
  const canUpdateRolePermissions = hasPermission("role-permissions.update");
  const canReadRoleHierarchy = hasPermission("role-hierarchy.read");
  const canCreateRoleHierarchy = hasPermission("role-hierarchy.create");
  const canDeleteRoleHierarchy = hasPermission("role-hierarchy.delete");
  const availableTabs = useMemo<Tab[]>(() => {
    const tabs: Tab[] = [];

    if (canReadRolePermissions && canReadRoles) tabs.push("roles");
    if (canReadRolePermissions && canReadPermissions) tabs.push("permissions");
    if (canReadRoleHierarchy) tabs.push("hierarchy");

    return tabs;
  }, [canReadPermissions, canReadRoleHierarchy, canReadRolePermissions, canReadRoles]);

  const resourceCount = useMemo(() => new Set(permissions.map((p) => resourceGroupOf(p.resource))).size, [permissions]);
  const permissionResourceOptions = useMemo(
    () => Array.from(new Set(permissions.map((p) => resourceGroupOf(p.resource)))).sort((a, b) => a.localeCompare(b)),
    [permissions],
  );
  const permissionActionOptions = useMemo(
    () => Array.from(new Set(permissions.map((p) => p.action))).sort((a, b) => a.localeCompare(b)),
    [permissions],
  );
  const filteredPermissions = useMemo(() => {
    const query = permissionSearch.trim().toLowerCase();

    return permissions.filter((permission) => {
      const matchesSearch =
        !query ||
        permission.id.toLowerCase().includes(query) ||
        permission.name.toLowerCase().includes(query) ||
        permission.resource.toLowerCase().includes(query) ||
        permission.action.toLowerCase().includes(query) ||
        (permission.description?.toLowerCase().includes(query) ?? false);
      const matchesResource = permissionResource === "all" || resourceGroupOf(permission.resource) === permissionResource;
      const matchesAction = permissionAction === "all" || permission.action === permissionAction;

      return matchesSearch && matchesResource && matchesAction;
    });
  }, [permissionAction, permissionResource, permissionSearch, permissions]);
  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, PermissionItem[]>();

    for (const permission of filteredPermissions) {
      const group = resourceGroupOf(permission.resource);
      if (!groups.has(group)) {
        groups.set(group, []);
      }

      groups.get(group)!.push(permission);
    }

    return Array.from(groups.entries())
      .map(([resource, items]) => ({
        resource,
        items: items.sort((a, b) => a.resource.localeCompare(b.resource) || a.action.localeCompare(b.action) || a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.resource.localeCompare(b.resource));
  }, [filteredPermissions]);
  const hasPermissionFilters =
    permissionSearch.trim() !== "" || permissionResource !== "all" || permissionAction !== "all";
  const visibleResourceIds = useMemo(
    () => groupedPermissions.map((group) => group.resource),
    [groupedPermissions],
  );
  const allVisibleResourceCollapsed =
    visibleResourceIds.length > 0 && visibleResourceIds.every((resource) => collapsedResources.has(resource));

  useEffect(() => {
    setKnownResources((previousKnown) => {
      const nextKnown = new Set(previousKnown);
      const newResources = visibleResourceIds.filter((resource) => !nextKnown.has(resource));

      if (newResources.length > 0) {
        setCollapsedResources((previousCollapsed) => new Set([...previousCollapsed, ...newResources]));
      }

      for (const resource of visibleResourceIds) {
        nextKnown.add(resource);
      }

      return nextKnown;
    });
  }, [visibleResourceIds]);

  const changeTab = (tab: Tab) => {
    setSearchParams((next) => {
      const nextParams = new URLSearchParams(next);
      if (tab === "roles") nextParams.delete("tab");
      else nextParams.set("tab", tab);
      return nextParams;
    });
  };

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      changeTab(availableTabs[0]);
    }
  }, [activeTab, availableTabs]);

  const changePermissionSearch = (next: string) => {
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      const value = next.trim();
      if (value) nextParams.set("permissionSearch", value);
      else nextParams.delete("permissionSearch");
      return nextParams;
    });
  };

  const changePermissionFilter = (key: "permissionResource" | "permissionAction", value: string) => {
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      if (value !== "all") nextParams.set(key, value);
      else nextParams.delete(key);
      return nextParams;
    });
  };

  const clearPermissionFilters = () => {
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      nextParams.delete("permissionSearch");
      nextParams.delete("permissionResource");
      nextParams.delete("permissionAction");
      return nextParams;
    });
  };

  const load = async () => {
    setIsLoading(true); setError(null);
    try {
      const [aclRes, hierRes] = await Promise.all([
        get<RolesPermissionsResponse>("/access-control/roles-permissions"),
        get<HierarchyResponse>("/access-control/role-hierarchy"),
      ]);
      setRoles(aclRes.data.data.roles ?? []);
      setPermissions(aclRes.data.data.permissions ?? []);
      setHierarchy(hierRes.data.data ?? []);
    } catch { setError("Unable to load data"); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const openModal = (modal: string, params: Record<string, string> = {}) => {
    setSearchParams((next) => {
      next.set("modal", modal);
      next.delete("id");
      next.delete("type");
      next.delete("parent");
      next.delete("child");
      Object.entries(params).forEach(([key, value]) => next.set(key, value));
      return next;
    });
  };

  const closeModal = () => {
    setSearchParams((next) => {
      next.delete("modal");
      next.delete("id");
      next.delete("type");
      next.delete("parent");
      next.delete("child");
      return next;
    });
    setRoleForm({ open: false });
    setPermForm({ open: false });
    setManagingRole(null);
    setCloningRole(null);
    setAddHierarchyOpen(false);
    setDeleteTarget(null);
  };

  useEffect(() => {
    setRoleForm({ open: false });
    setPermForm({ open: false });
    setManagingRole(null);
    setCloningRole(null);
    setAddHierarchyOpen(false);
    setDeleteTarget(null);

    if (urlModal === "role-create") {
      setRoleForm({ open: true });
      return;
    }

    if (urlModal === "permission-create") {
      setPermForm({ open: true });
      return;
    }

    if (urlModal === "add-hierarchy") {
      setAddHierarchyOpen(true);
      return;
    }

    const role = roles.find((item) => item.id === urlId);
    const permission = permissions.find((item) => item.id === urlId);

    if (urlModal === "role-edit" && role) setRoleForm({ open: true, item: role });
    if (urlModal === "role-clone" && role) setCloningRole(role);
    if (urlModal === "role-permissions" && role) setManagingRole(role);
    if (urlModal === "permission-edit" && permission) setPermForm({ open: true, item: permission });
    if (urlModal === "delete" && urlType === "role" && role) {
      setDeleteTarget({
        label: role.name,
        onConfirm: async () => {
          await del(`/access-control/roles/${role.id}`);
          toast.success(`ลบ role "${role.name}" แล้ว`);
          closeModal();
          await load();
        },
      });
    }
    if (urlModal === "delete" && urlType === "permission" && permission) {
      setDeleteTarget({
        label: permission.name,
        onConfirm: async () => {
          await del(`/access-control/permissions/${permission.id}`);
          toast.success(`ลบ permission "${permission.name}" แล้ว`);
          closeModal();
          await load();
        },
      });
    }
    if (urlModal === "delete" && urlType === "hierarchy" && urlParent && urlChild) {
      const item = hierarchy.find((entry) => entry.parentRoleId === urlParent && entry.childRoleId === urlChild);
      if (!item) return;
      setDeleteTarget({
        label: `${item.parentRoleName} → ${item.childRoleName}`,
        onConfirm: async () => {
          await del(`/access-control/role-hierarchy/${item.parentRoleId}/${item.childRoleId}`);
          toast.success("ลบความสัมพันธ์แล้ว");
          closeModal();
          await load();
        },
      });
    }
  }, [urlModal, urlId, urlType, urlParent, urlChild, roles, permissions, hierarchy]);

  const handleDeleteRole = (role: RoleItem) => {
    if (!canDeleteRole) {
      toast.error("คุณไม่มีสิทธิ์ลบ role");
      return;
    }

    if (isSystemRole(role.id)) {
      toast.info("SUPERADMIN เป็น role หลักของระบบ ไม่สามารถจัดการจากหน้านี้ได้");
      return;
    }

    openModal("delete", { type: "role", id: role.id });
  };

  const handleDeleteHierarchy = (item: HierarchyItem) => {
    if (!canDeleteRoleHierarchy) {
      toast.error("คุณไม่มีสิทธิ์ลบ role hierarchy");
      return;
    }

    openModal("delete", { type: "hierarchy", parent: item.parentRoleId, child: item.childRoleId });
  };

  const handleDeletePermission = (p: PermissionItem) => {
    if (!canDeletePermission) {
      toast.error("คุณไม่มีสิทธิ์ลบ permission");
      return;
    }

    openModal("delete", { type: "permission", id: p.id });
  };

  return (
    <section className="grid gap-5">
      {/* Header */}
      <div className="rounded-xl border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-light-primary to-light-primary-hover text-white shadow-sm dark:from-dark-primary dark:to-dark-primary-hover dark:text-dark-background">
              <ShieldCheck size={26} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                Administration
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">Roles & Permissions</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                จัดการบทบาทและสิทธิ์ของระบบ
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreateRole && (
              <button type="button" onClick={() => openModal("role-create")}
                className="inline-flex items-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary">
                <Plus className="h-4 w-4" />New role
              </button>
            )}
            {canCreatePermission && (
              <button type="button" onClick={() => openModal("permission-create")}
                className="inline-flex items-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary">
                <KeyRound className="h-4 w-4" />New permission
              </button>
            )}
            <button type="button" onClick={() => void load()} disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: "Roles", value: roles.length, icon: <ShieldCheck className="h-5 w-5" />, tone: "primary" as const },
          { label: "Permissions", value: permissions.length, icon: <KeyRound className="h-5 w-5" />, tone: "warning" as const },
          { label: "Resources", value: resourceCount, icon: <SlidersHorizontal className="h-5 w-5" />, tone: "purple" as const },
        ].map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      {/* Tab bar — แยกออกมาอยู่นอก article */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-theme bg-light-background-card p-3 shadow-soft dark:bg-dark-background-card">
        <div className="inline-flex rounded-lg border border-theme p-1">
          {availableTabs.map((tab) => (
            <button key={tab} type="button" onClick={() => changeTab(tab)}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize transition-colors ${
                activeTab === tab
                  ? "bg-light-primary text-white dark:bg-dark-primary dark:text-dark-background"
                  : "text-light-text-muted hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
              }`}>
              {tab}
            </button>
          ))}
        </div>
        {activeTab === "hierarchy" && canCreateRoleHierarchy && (
          <button type="button" onClick={() => openModal("add-hierarchy")}
            className="ml-auto inline-flex items-center gap-2 rounded-md border border-theme px-3 py-1.5 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary">
            <Plus className="h-4 w-4" />เพิ่มความสัมพันธ์
          </button>
        )}
      </div>

      {availableTabs.length === 0 && (
        <article className="grid min-h-48 place-items-center rounded-lg border border-theme bg-light-background-card p-6 text-center text-light-text-muted shadow-soft dark:bg-dark-background-card dark:text-dark-text-muted">
          <div>
            <ShieldCheck className="mx-auto h-8 w-8 opacity-30" />
            <p className="mt-2 text-sm">คุณไม่มีสิทธิ์ดู Roles & Permissions</p>
          </div>
        </article>
      )}

      {/* Roles / Permissions table */}
      {availableTabs.length > 0 && activeTab !== "hierarchy" && <article className="overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-soft dark:bg-dark-background-card">
        {error && (
          <div className="flex items-center gap-3 p-5 text-sm text-red-600 dark:text-red-300">
            <AlertCircle className="h-5 w-5" />{error}
          </div>
        )}

        {isLoading ? (
          <div className="grid min-h-48 place-items-center text-light-text-muted dark:text-dark-text-muted">
            Loading...
          </div>
        ) : activeTab === "roles" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
              <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                <tr>
                  {["Role", "Users", "Permissions", "Priority", "Updated", ""].map((h) => (
                    <th key={h} className={`px-4 py-3 font-semibold ${!h ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                {roles.map((role) => (
                  <tr key={role.id} className="transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                          <ShieldCheck className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-light-text dark:text-dark-text">{role.name}</span>
                          <span className="block truncate text-xs text-light-text-muted dark:text-dark-text-muted">{role.description || role.id}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{role.userCount}</td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{role.permissionCount}</td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{role.priority}</td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{formatDate(role.updatedAt)}</td>
                    <td className="px-4 py-3">
                      {isSystemRole(role.id) ? (
                        <div className="flex justify-end">
                          <span className="rounded-md bg-light-primary/10 px-2 py-1 text-xs font-semibold text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                            System role
                          </span>
                        </div>
                      ) : !canUpdateRolePermissions && !canCreateRole && !canUpdateRole && !canDeleteRole ? (
                        <div className="flex justify-end">
                          <span className="text-sm text-light-text-muted dark:text-dark-text-muted">—</span>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          {canUpdateRolePermissions && (
                            <button className={actionBtn} type="button" title="Manage permissions" onClick={() => openModal("role-permissions", { id: role.id })}>
                              <SlidersHorizontal className="h-4 w-4" />
                            </button>
                          )}
                          {canCreateRole && (
                            <button className={actionBtn} type="button" title="Clone role" onClick={() => openModal("role-clone", { id: role.id })}>
                              <Copy className="h-4 w-4" />
                            </button>
                          )}
                          {canUpdateRole && (
                            <button className={actionBtn} type="button" title="Edit" onClick={() => openModal("role-edit", { id: role.id })}>
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canDeleteRole && (
                            <button
                              className={`${actionBtn} hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400`}
                              type="button" title="Delete" onClick={() => handleDeleteRole(role)}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === "permissions" ? (
          <div>
            <div className="grid gap-3 border-b border-theme p-4 lg:grid-cols-[minmax(220px,1fr)_180px_160px_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-text-muted dark:text-dark-text-muted" />
                <input
                  className={`${inputClass} pl-9`}
                  placeholder="ค้นหา permission, resource, action..."
                  value={permissionSearch}
                  onChange={(event) => changePermissionSearch(event.target.value)}
                />
              </div>
              <select
                className={inputClass}
                value={permissionResource}
                onChange={(event) => changePermissionFilter("permissionResource", event.target.value)}
              >
                <option value="all">ทุก Resource</option>
                {permissionResourceOptions.map((resource) => (
                  <option key={resource} value={resource}>{resource}</option>
                ))}
              </select>
              <select
                className={inputClass}
                value={permissionAction}
                onChange={(event) => changePermissionFilter("permissionAction", event.target.value)}
              >
                <option value="all">ทุก Action</option>
                {permissionActionOptions.map((action) => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={clearPermissionFilters}
                disabled={!hasPermissionFilters}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary disabled:cursor-not-allowed disabled:opacity-50 dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
              >
                <X className="h-4 w-4" />
                ล้าง
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-theme px-4 py-3 text-xs text-light-text-muted dark:text-dark-text-muted">
              <span>แสดง {filteredPermissions.length} จาก {permissions.length} permissions</span>
              <div className="flex items-center gap-2">
                <span>{groupedPermissions.length} resource groups</span>
                {groupedPermissions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCollapsedResources(
                        allVisibleResourceCollapsed ? new Set() : new Set(visibleResourceIds),
                      );
                    }}
                    className="rounded-md border border-theme px-2 py-1 font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
                  >
                    {allVisibleResourceCollapsed ? "ขยายทั้งหมด" : "ย่อทั้งหมด"}
                  </button>
                )}
              </div>
            </div>

            {groupedPermissions.length === 0 ? (
              <div className="grid min-h-48 place-items-center p-6 text-center text-light-text-muted dark:text-dark-text-muted">
                <div>
                  <KeyRound className="mx-auto h-8 w-8 opacity-30" />
                  <p className="mt-2 text-sm">ไม่พบ permission ตามตัวกรองที่เลือก</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-light-border dark:divide-dark-border">
                {groupedPermissions.map((group) => (
                  <section key={group.resource} className="bg-light-background-card dark:bg-dark-background-card">
                    <button
                      type="button"
                      onClick={() => {
                        setCollapsedResources((previous) => {
                          const next = new Set(previous);

                          if (next.has(group.resource)) {
                            next.delete(group.resource);
                          } else {
                            next.add(group.resource);
                          }

                          return next;
                        });
                      }}
                      className="sticky top-0 z-10 flex w-full flex-wrap items-center justify-between gap-3 border-b border-theme bg-light-background-card px-4 py-4 text-left shadow-sm transition-colors hover:bg-light-primary/5 dark:bg-dark-background-card dark:hover:bg-dark-primary/10"
                      aria-expanded={!collapsedResources.has(group.resource)}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                          <KeyRound className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-bold text-light-text dark:text-dark-text">
                            {group.resource}
                          </h3>
                          <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                            Resource group
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border border-theme bg-light-background px-3 py-1 text-sm font-semibold text-light-text-muted dark:bg-dark-background dark:text-dark-text-muted">
                          {group.items.length} permissions
                        </span>
                        <ChevronDown
                          className={`h-5 w-5 text-light-text-muted transition-transform dark:text-dark-text-muted ${
                            collapsedResources.has(group.resource) ? "-rotate-90" : ""
                          }`}
                        />
                      </div>
                    </button>
                    {!collapsedResources.has(group.resource) && <div className="grid gap-2 p-3">
                      {group.items.map((p) => (
                        <div
                          key={p.id}
                          className="grid gap-3 rounded-lg border border-light-border-light bg-light-background px-4 py-3 transition-colors hover:border-light-primary/30 hover:bg-light-primary/5 dark:border-dark-border-light dark:bg-dark-background dark:hover:border-dark-primary/30 dark:hover:bg-dark-primary/10 lg:grid-cols-[minmax(260px,1fr)_120px_110px_180px_auto] lg:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-light-text dark:text-dark-text">{p.name}</span>
                              <span className="rounded-md bg-light-background-card px-2 py-0.5 text-xs font-medium text-light-text-muted dark:bg-dark-background-card dark:text-dark-text-muted">
                                {p.id}
                              </span>
                            </div>
                            {p.description && (
                              <p className="mt-1 text-xs text-light-text-muted dark:text-dark-text-muted">
                                {p.description}
                              </p>
                            )}
                          </div>

                          <div>
                            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted lg:hidden">
                              Action
                            </span>
                            <span className="inline-flex rounded-md bg-light-primary/10 px-2 py-1 text-xs font-semibold text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                              {p.action}
                            </span>
                          </div>

                          <div>
                            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted lg:hidden">
                              Roles
                            </span>
                            <span className="text-sm text-light-text-muted dark:text-dark-text-muted">{p.roleCount} roles</span>
                          </div>

                          <div>
                            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted lg:hidden">
                              Updated
                            </span>
                            <span className="text-sm text-light-text-muted dark:text-dark-text-muted">{formatDate(p.updatedAt)}</span>
                          </div>

                          <div className="flex justify-end gap-2">
                            {!canUpdatePermission && !canDeletePermission && (
                              <span className="text-sm text-light-text-muted dark:text-dark-text-muted">—</span>
                            )}
                            {canUpdatePermission && (
                              <button className={actionBtn} type="button" title="Edit" onClick={() => openModal("permission-edit", { id: p.id })}>
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {canDeletePermission && (
                              <button
                                className={`${actionBtn} hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400`}
                                type="button" title="Delete" onClick={() => handleDeletePermission(p)}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>}
                  </section>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </article>}

      {activeTab === "hierarchy" && canReadRoleHierarchy && !isLoading && (
        hierarchy.length === 0 ? (
          <div className="grid min-h-48 place-items-center gap-2 text-center text-light-text-muted dark:text-dark-text-muted">
            <ArrowRight className="mx-auto h-8 w-8 opacity-30" />
            <p className="text-sm">
              {canCreateRoleHierarchy
                ? 'ยังไม่มีความสัมพันธ์ — กด "เพิ่มความสัมพันธ์" เพื่อเริ่มต้น'
                : "ยังไม่มีความสัมพันธ์"}
            </p>
          </div>
        ) : (
          <article className="overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-soft dark:bg-dark-background-card">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
                <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Parent Role</th>
                    <th className="px-4 py-3 font-semibold"></th>
                    <th className="px-4 py-3 font-semibold">Child Role</th>
                    <th className="px-4 py-3 font-semibold">สร้างเมื่อ</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                  {hierarchy.map((item) => (
                    <tr key={`${item.parentRoleId}-${item.childRoleId}`}
                      className="transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                            <ShieldCheck className="h-4 w-4" />
                          </span>
                          <span>
                            <span className="block font-semibold text-light-text dark:text-dark-text">{item.parentRoleName}</span>
                            <span className="text-xs text-light-text-muted dark:text-dark-text-muted">priority {item.parentPriority}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ArrowRight className="h-4 w-4 text-light-text-muted dark:text-dark-text-muted" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-light-primary/5 text-light-primary/60 dark:bg-dark-primary/5 dark:text-dark-primary/60">
                            <ShieldCheck className="h-4 w-4" />
                          </span>
                          <span>
                            <span className="block font-medium text-light-text dark:text-dark-text">{item.childRoleName}</span>
                            <span className="text-xs text-light-text-muted dark:text-dark-text-muted">priority {item.childPriority}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          {canDeleteRoleHierarchy ? (
                            <button
                              className={`${actionBtn} hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400`}
                              type="button" title="Remove" onClick={() => handleDeleteHierarchy(item)}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : (
                            <span className="text-sm text-light-text-muted dark:text-dark-text-muted">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        )
      )}

      {/* Modals */}
      {roleForm.open && (roleForm.item ? canUpdateRole : canCreateRole) && (
        <RoleForm initial={roleForm.item} onClose={closeModal} onSaved={() => void load()} />
      )}
      {permForm.open && (permForm.item ? canUpdatePermission : canCreatePermission) && (
        <PermissionForm initial={permForm.item} onClose={closeModal} onSaved={() => void load()} />
      )}
      {managingRole && canUpdateRolePermissions && (
        <PermissionManager role={managingRole} allPermissions={permissions}
          onClose={closeModal} onSaved={() => void load()} />
      )}
      {cloningRole && canCreateRole && (
        <CloneRoleForm source={cloningRole}
          onClose={closeModal} onSaved={() => void load()} />
      )}
      {addHierarchyOpen && canCreateRoleHierarchy && (
        <AddHierarchyForm roles={roles} existing={hierarchy}
          onClose={closeModal} onSaved={() => void load()} />
      )}
      {deleteTarget && (
        <DeleteConfirm label={deleteTarget.label} onConfirm={deleteTarget.onConfirm}
          onClose={closeModal} />
      )}
    </section>
  );
};

export default RolesPermissionsPage;
