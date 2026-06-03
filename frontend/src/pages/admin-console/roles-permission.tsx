import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, Copy, KeyRound, Layers, Pencil, Plus, RefreshCw,
  Search, ShieldCheck, SlidersHorizontal, Trash2, X,
} from "lucide-react";
import { toast } from "react-toastify";
import { useApi } from "@/hooks/useApi";

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

type Tab = "roles" | "permissions";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

const inputClass =
  "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";
const labelClass = "mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted";
const actionBtn =
  "grid h-8 w-8 place-items-center rounded-md border border-theme text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary";

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
    for (const p of filtered) map.set(p.resource, [...(map.get(p.resource) ?? []), p]);
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

// ─── Main Page ────────────────────────────────────────────────────────────────

const RolesPermissionsPage = () => {
  const { get, del } = useApi();
  const [activeTab, setActiveTab] = useState<Tab>("roles");
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [roleForm, setRoleForm] = useState<{ open: boolean; item?: RoleItem }>({ open: false });
  const [permForm, setPermForm] = useState<{ open: boolean; item?: PermissionItem }>({ open: false });
  const [managingRole, setManagingRole] = useState<RoleItem | null>(null);
  const [cloningRole, setCloningRole] = useState<RoleItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ label: string; onConfirm: () => Promise<void> } | null>(null);

  // Bulk selection
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const allRoleIds = useMemo(() => roles.map((r) => r.id), [roles]);
  const allSelected = allRoleIds.length > 0 && allRoleIds.every((id) => selectedRoles.has(id));
  const someSelected = selectedRoles.size > 0 && !allSelected;

  const toggleRole = (id: string) =>
    setSelectedRoles((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const toggleAllRoles = () =>
    setSelectedRoles(allSelected ? new Set() : new Set(allRoleIds));

  const resourceCount = useMemo(() => new Set(permissions.map((p) => p.resource)).size, [permissions]);

  const load = async () => {
    setIsLoading(true); setError(null);
    try {
      const res = await get<RolesPermissionsResponse>("/access-control/roles-permissions");
      setRoles(res.data.data.roles ?? []);
      setPermissions(res.data.data.permissions ?? []);
      setSelectedRoles(new Set());
    } catch { setError("Unable to load roles and permissions"); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const handleBulkDeleteRoles = () => {
    const ids = [...selectedRoles];
    const names = roles.filter((r) => ids.includes(r.id)).map((r) => r.name).join(", ");
    setDeleteTarget({
      label: `${ids.length} roles (${names})`,
      onConfirm: async () => {
        await del("/access-control/roles", { data: { ids } });
        toast.success(`ลบ ${ids.length} roles แล้ว`);
        setDeleteTarget(null);
        await load();
      },
    });
  };

  const handleDeleteRole = (role: RoleItem) => {
    setDeleteTarget({
      label: role.name,
      onConfirm: async () => {
        await del(`/access-control/roles/${role.id}`);
        toast.success(`ลบ role "${role.name}" แล้ว`);
        setDeleteTarget(null);
        await load();
      },
    });
  };

  const handleDeletePermission = (p: PermissionItem) => {
    setDeleteTarget({
      label: p.name,
      onConfirm: async () => {
        await del(`/access-control/permissions/${p.id}`);
        toast.success(`ลบ permission "${p.name}" แล้ว`);
        setDeleteTarget(null);
        await load();
      },
    });
  };

  return (
    <section className="grid gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-light-primary dark:text-dark-primary">
            Admin Console
          </p>
          <h1 className="text-3xl font-semibold tracking-normal text-light-text dark:text-dark-text">Roles & Permissions</h1>
          <p className="mt-2 text-sm text-light-text-muted dark:text-dark-text-muted">จัดการบทบาทและสิทธิ์ของระบบ</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setRoleForm({ open: true })}
            className="inline-flex items-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary">
            <Plus className="h-4 w-4" />New role
          </button>
          <button type="button" onClick={() => setPermForm({ open: true })}
            className="inline-flex items-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary">
            <KeyRound className="h-4 w-4" />New permission
          </button>
          <button type="button" onClick={() => void load()} disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: "Roles", value: roles.length },
          { label: "Permissions", value: permissions.length },
          { label: "Resources", value: resourceCount },
        ].map(({ label, value }) => (
          <article key={label} className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
            <span className="text-sm text-light-text-muted dark:text-dark-text-muted">{label}</span>
            <strong className="mt-2 block text-3xl text-light-text dark:text-dark-text">{value}</strong>
          </article>
        ))}
      </div>

      {/* Table */}
      <article className="overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-soft dark:bg-dark-background-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-theme p-3">
          <div className="inline-flex rounded-lg border border-theme p-1">
            {(["roles", "permissions"] as Tab[]).map((tab) => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize transition-colors ${
                  activeTab === tab
                    ? "bg-light-primary text-white dark:bg-dark-primary dark:text-dark-background"
                    : "text-light-text-muted hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
                }`}>
                {tab}
              </button>
            ))}
          </div>
        </div>

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
            {/* Bulk action bar */}
            {selectedRoles.size > 0 && (
              <div className="flex items-center gap-3 border-b border-theme bg-light-primary/5 px-4 py-2.5 dark:bg-dark-primary/5">
                <Layers className="h-4 w-4 text-light-primary dark:text-dark-primary" />
                <span className="text-sm font-semibold text-light-text dark:text-dark-text">
                  เลือกแล้ว {selectedRoles.size} รายการ
                </span>
                <button type="button" onClick={handleBulkDeleteRoles}
                  className="ml-2 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700">
                  <Trash2 className="h-3.5 w-3.5" />
                  ลบที่เลือก
                </button>
                <button type="button" onClick={() => setSelectedRoles(new Set())}
                  className="ml-auto text-xs text-light-text-muted hover:text-light-text dark:text-dark-text-muted dark:hover:text-dark-text">
                  ยกเลิกการเลือก
                </button>
              </div>
            )}
            <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
              <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                <tr>
                  <th className="px-4 py-3">
                    <input type="checkbox" checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleAllRoles}
                      className="h-4 w-4 rounded accent-light-primary dark:accent-dark-primary" />
                  </th>
                  {["Role", "Users", "Permissions", "Priority", "Updated", ""].map((h) => (
                    <th key={h} className={`px-4 py-3 font-semibold ${!h ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                {roles.map((role) => (
                  <tr key={role.id}
                    className={`transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10 ${selectedRoles.has(role.id) ? "bg-light-primary/5 dark:bg-dark-primary/5" : ""}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedRoles.has(role.id)}
                        onChange={() => toggleRole(role.id)}
                        className={`h-4 w-4 rounded accent-light-primary dark:accent-dark-primary ${role.id === "SUPERADMIN" ? "invisible" : ""}`} />
                    </td>
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
                      <div className="flex justify-end gap-2">
                        <button className={actionBtn} type="button" title="Manage permissions" onClick={() => setManagingRole(role)}>
                          <SlidersHorizontal className="h-4 w-4" />
                        </button>
                        <button className={actionBtn} type="button" title="Clone role" onClick={() => setCloningRole(role)}>
                          <Copy className="h-4 w-4" />
                        </button>
                        <button className={actionBtn} type="button" title="Edit" onClick={() => setRoleForm({ open: true, item: role })}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className={`${actionBtn} hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 ${role.id === "SUPERADMIN" ? "invisible" : ""}`}
                          type="button" title="Delete" onClick={() => handleDeleteRole(role)}>
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
                  {["Permission", "Resource", "Action", "Roles", "Updated", ""].map((h) => (
                    <th key={h} className={`px-4 py-3 font-semibold ${!h ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                {permissions.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10">
                    <td className="px-4 py-3">
                      <span className="block font-semibold text-light-text dark:text-dark-text">{p.name}</span>
                      <span className="block text-xs text-light-text-muted dark:text-dark-text-muted">{p.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md bg-light-primary/10 px-2 py-1 text-xs font-semibold text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                        {p.resource}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{p.action}</td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{p.roleCount}</td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{formatDate(p.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button className={actionBtn} type="button" title="Edit" onClick={() => setPermForm({ open: true, item: p })}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className={`${actionBtn} hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400`}
                          type="button" title="Delete" onClick={() => handleDeletePermission(p)}>
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

      {/* Modals */}
      {roleForm.open && (
        <RoleForm initial={roleForm.item} onClose={() => setRoleForm({ open: false })} onSaved={() => void load()} />
      )}
      {permForm.open && (
        <PermissionForm initial={permForm.item} onClose={() => setPermForm({ open: false })} onSaved={() => void load()} />
      )}
      {managingRole && (
        <PermissionManager role={managingRole} allPermissions={permissions}
          onClose={() => setManagingRole(null)} onSaved={() => void load()} />
      )}
      {cloningRole && (
        <CloneRoleForm source={cloningRole}
          onClose={() => setCloningRole(null)} onSaved={() => void load()} />
      )}
      {deleteTarget && (
        <DeleteConfirm label={deleteTarget.label} onConfirm={deleteTarget.onConfirm}
          onClose={() => setDeleteTarget(null)} />
      )}
    </section>
  );
};

export default RolesPermissionsPage;
