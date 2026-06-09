import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { AlertCircle, Eye, EyeOff, RefreshCw, X } from "lucide-react";
import { toast } from "react-toastify";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/contexts/SessionContext";
import { checkInjectionFields } from "@/utils/injectionGuard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoleOption {
  id: string;
  name: string;
  priority: number;
}

export interface ModalCreateUserProps {
  onClose: () => void;
  onCreated: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";

const inputErrorClass =
  "w-full rounded-md border border-red-400 bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-red-400 dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted";

const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">
    {children}
    {required && <span className="ml-1 text-red-500">*</span>}
  </label>
);

const FieldError = ({ msg }: { msg?: string }) =>
  msg ? (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {msg}
    </p>
  ) : null;

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-light-primary dark:text-dark-primary">
    {children}
  </p>
);

// ─── Modal ────────────────────────────────────────────────────────────────────

const ModalCreateUser = ({ onClose, onCreated }: ModalCreateUserProps) => {
  const { post, get } = useApi();
  const { user: currentUser } = useSession();
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [roles, setRoles] = useState<RoleOption[]>([]);

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    displayName: "",
    phoneNumber: "",
    department: "",
    groupName: "",
    roleId: "",
    isActive: true,
    isApproved: true,
    isEmailVerified: true,
    mustChangePassword: false,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof typeof form | "general", string>>>({});

  // โหลด roles แล้ว filter เฉพาะที่ priority <= ของ current user
  useEffect(() => {
    get<{ success: boolean; data: { roles: RoleOption[] } }>("/access-control/roles-permissions")
      .then((res) => {
        const allRoles = res.data.data.roles ?? [];
        const myRoleIds = new Set(currentUser?.roles ?? []);
        const myMaxPriority = allRoles
          .filter((r) => myRoleIds.has(r.id))
          .reduce((max, r) => Math.max(max, r.priority), 0);

        // แสดงเฉพาะ role ที่ไม่สูงกว่าตัวเอง
        setRoles(allRoles.filter((r) => r.priority <= myMaxPriority));
      })
      .catch(() => {});
  }, []);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => { const next = { ...p }; delete next[k]; return next; });
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!form.username.trim()) e.username = "จำเป็นต้องกรอก";
    else if (form.username.trim().length < 4) e.username = "อย่างน้อย 4 ตัวอักษร";
    if (!form.email.trim()) e.email = "จำเป็นต้องกรอก";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "รูปแบบ email ไม่ถูกต้อง";
    if (!form.password) e.password = "จำเป็นต้องกรอก";
    else if (form.password.length < 8) e.password = "อย่างน้อย 8 ตัวอักษร";
    if (!form.confirmPassword) e.confirmPassword = "กรุณายืนยัน password";
    else if (form.password !== form.confirmPassword) e.confirmPassword = "Password ไม่ตรงกัน";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const injected = checkInjectionFields({
      username: form.username,
      firstName: form.firstName,
      lastName: form.lastName,
      displayName: form.displayName,
      phoneNumber: form.phoneNumber,
      department: form.department,
      groupName: form.groupName,
    });
    if (injected) {
      setErrors((prev) => ({ ...prev, [injected.field]: injected.result.message ?? "พบรูปแบบที่ไม่ปลอดภัย" }));
      return;
    }

    setBusy(true);
    try {
      await post("/users", {
        username: form.username.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        firstName: form.firstName.trim() || null,
        lastName: form.lastName.trim() || null,
        displayName: form.displayName.trim() || null,
        phoneNumber: form.phoneNumber.trim() || null,
        department: form.department.trim() || null,
        groupName: form.groupName.trim() || null,
        roleIds: form.roleId ? [form.roleId] : [],
        isActive: form.isActive,
        isApproved: form.isApproved,
        isEmailVerified: form.isEmailVerified,
        mustChangePassword: form.mustChangePassword,
      });
      toast.success(`สร้างผู้ใช้ "${form.username}" สำเร็จ`);
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create user";
      setErrors({ general: msg });
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex w-full max-w-2xl flex-col rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-theme px-5 py-4">
          <h2 className="text-base font-semibold text-light-text dark:text-dark-text">เพิ่มผู้ใช้ใหม่</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5">
          {errors.general && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errors.general}
            </div>
          )}

          <div className="grid gap-6">
            {/* ── บัญชี ── */}
            <div>
              <SectionTitle>ข้อมูลบัญชี</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label required>Username</Label>
                  <input
                    className={errors.username ? inputErrorClass : inputClass}
                    placeholder="john_doe"
                    value={form.username}
                    onChange={(e) => set("username", e.target.value)}
                  />
                  <FieldError msg={errors.username} />
                </div>

                <div>
                  <Label required>Email</Label>
                  <input
                    className={errors.email ? inputErrorClass : inputClass}
                    type="email"
                    placeholder="john@example.com"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                  <FieldError msg={errors.email} />
                </div>

                <div>
                  <Label required>Password</Label>
                  <div className="relative">
                    <input
                      className={`${errors.password ? inputErrorClass : inputClass} pr-10`}
                      type={showPassword ? "text" : "password"}
                      placeholder="อย่างน้อย 8 ตัวอักษร"
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-muted hover:text-light-text dark:text-dark-text-muted dark:hover:text-dark-text"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <FieldError msg={errors.password} />
                </div>

                <div>
                  <Label required>ยืนยัน Password</Label>
                  <div className="relative">
                    <input
                      className={`${errors.confirmPassword ? inputErrorClass : inputClass} pr-10`}
                      type={showConfirm ? "text" : "password"}
                      placeholder="พิมพ์ password อีกครั้ง"
                      value={form.confirmPassword}
                      onChange={(e) => set("confirmPassword", e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-muted hover:text-light-text dark:text-dark-text-muted dark:hover:text-dark-text"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <FieldError msg={errors.confirmPassword} />
                </div>
              </div>
            </div>

            {/* ── โปรไฟล์ ── */}
            <div>
              <SectionTitle>โปรไฟล์</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>ชื่อ</Label>
                  <input className={inputClass} placeholder="สมชาย" value={form.firstName}
                    onChange={(e) => set("firstName", e.target.value)} />
                </div>
                <div>
                  <Label>นามสกุล</Label>
                  <input className={inputClass} placeholder="ใจดี" value={form.lastName}
                    onChange={(e) => set("lastName", e.target.value)} />
                </div>
                <div>
                  <Label>Display name</Label>
                  <input className={inputClass} placeholder="ชื่อที่แสดงผล" value={form.displayName}
                    onChange={(e) => set("displayName", e.target.value)} />
                </div>
                <div>
                  <Label>เบอร์โทร</Label>
                  <input className={inputClass} placeholder="08x-xxx-xxxx" value={form.phoneNumber}
                    onChange={(e) => set("phoneNumber", e.target.value)} />
                </div>
                <div>
                  <Label>แผนก</Label>
                  <input className={inputClass} placeholder="IT" value={form.department}
                    onChange={(e) => set("department", e.target.value)} />
                </div>
                <div>
                  <Label>กลุ่ม</Label>
                  <input className={inputClass} placeholder="Group A" value={form.groupName}
                    onChange={(e) => set("groupName", e.target.value)} />
                </div>
              </div>
            </div>

            {/* ── บทบาท ── */}
            <div>
              <SectionTitle>บทบาท</SectionTitle>
              <select
                className={inputClass}
                value={form.roleId}
                onChange={(e) => set("roleId", e.target.value)}
              >
                <option value="">— ไม่กำหนด role —</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>

            {/* ── สถานะ ── */}
            <div>
              <SectionTitle>สถานะเริ่มต้น</SectionTitle>
              <div className="flex flex-wrap gap-5">
                {([
                  { key: "isActive", label: "Active" },
                  { key: "isApproved", label: "Approved" },
                  { key: "isEmailVerified", label: "Email verified" },
                  { key: "mustChangePassword", label: "บังคับเปลี่ยน password ตอน login ครั้งแรก" },
                ] as const).map(({ key, label }) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={(e) => set(key, e.target.checked)}
                      className="h-4 w-4 rounded accent-light-primary dark:accent-dark-primary"
                    />
                    <span className="text-sm text-light-text dark:text-dark-text">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-theme px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
          >
            {busy && <RefreshCw className="h-4 w-4 animate-spin" />}
            สร้างผู้ใช้
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ModalCreateUser;
