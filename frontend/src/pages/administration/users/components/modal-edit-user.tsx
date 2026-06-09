import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle, Check, Clock, FileText, KeyRound,
  LogOut, LockOpen, Pencil, RefreshCw, Shield, X,
} from "lucide-react";
import { toast } from "react-toastify";
import { useApi } from "@/hooks/useApi";
import { useRegional } from "@/contexts/RegionalContext";
import { Toggle } from "./toggle";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserDetail {
  id: number; username: string; email: string; group_name: string | null;
  is_active: boolean; is_approved: boolean; is_email_verified: boolean;
  must_change_password: boolean; failed_login_attempts: number;
  locked_until: string | null; last_login: string | null; created_at: string;
  recovery_email: string | null; temporary_account: boolean; account_expiry: string | null;
  remarks: string | null;
  profile: { first_name: string | null; last_name: string | null; display_name: string | null; phone_number: string | null; department: string | null } | null;
}

export interface ModalEditUserProps {
  userId: number;
  username: string;
  onClose: () => void;
  onSaved: () => void;
}

type Tab = "general" | "security" | "temporary" | "notes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isTab = (value: string | null): value is Tab =>
  value === "general" || value === "security" || value === "temporary" || value === "notes";

const inputClass =
  "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";

const labelClass = "mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted";

const ToggleRow = ({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between rounded-lg border border-theme bg-light-background px-4 py-3 dark:bg-dark-background">
    <div>
      <p className="text-sm font-semibold text-light-text dark:text-dark-text">{label}</p>
      {desc && <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">{desc}</p>}
    </div>
    <Toggle checked={checked} onChange={onChange} />
  </div>
);

// ─── Modal ────────────────────────────────────────────────────────────────────

const ModalEditUser = ({ userId, username, onClose, onSaved }: ModalEditUserProps) => {
  const { get, put, post, del } = useApi();
  const { formatDateTime } = useRegional();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const editTab = searchParams.get("editTab");
  const activeTab: Tab = isTab(editTab) ? editTab : "general";
  const [user, setUser] = useState<UserDetail | null>(null);

  const [form, setForm] = useState({
    username: "", email: "", groupName: "",
    firstName: "", lastName: "", displayName: "", phoneNumber: "", department: "",
    isActive: true, isApproved: true, isEmailVerified: true, mustChangePassword: false,
    recoveryEmail: "", temporaryAccount: false, accountExpiry: "", remarks: "",
  });

  const [newPw, setNewPw] = useState("");
  const [pwMustChange, setPwMustChange] = useState(true);
  const showResetPw = searchParams.get("submodal") === "reset-password";

  const changeTab = (tab: Tab) => {
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      if (tab === "general") nextParams.delete("editTab");
      else nextParams.set("editTab", tab);
      nextParams.delete("submodal");
      return nextParams;
    });
  };

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const openResetPassword = () => {
    setSearchParams((params) => {
      params.set("submodal", "reset-password");
      return params;
    });
  };

  const closeResetPassword = () => {
    setSearchParams((params) => {
      params.delete("submodal");
      return params;
    });
    setNewPw("");
  };

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    try {
      const res = await get<{ success: boolean; data: UserDetail }>(`/users/${userId}`);
      const d = res.data.data;
      setUser(d);
      setForm({
        username: d.username,
        email: d.email,
        groupName: d.group_name ?? "",
        firstName: d.profile?.first_name ?? "",
        lastName: d.profile?.last_name ?? "",
        displayName: d.profile?.display_name ?? "",
        phoneNumber: d.profile?.phone_number ?? "",
        department: d.profile?.department ?? "",
        isActive: d.is_active,
        isApproved: d.is_approved,
        isEmailVerified: d.is_email_verified,
        mustChangePassword: d.must_change_password,
        recoveryEmail: d.recovery_email ?? "",
        temporaryAccount: d.temporary_account,
        accountExpiry: d.account_expiry ? new Date(d.account_expiry).toISOString().slice(0, 10) : "",
        remarks: d.remarks ?? "",
      });
    } catch { toast.error("ไม่สามารถโหลดข้อมูลผู้ใช้ได้"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [userId]);

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (activeTab === "temporary" && form.temporaryAccount && !form.accountExpiry) {
      toast.error("กรุณาระบุวันหมดอายุสำหรับบัญชีชั่วคราว"); return;
    }
    setSaving(true);
    try {
      await put(`/users/${userId}`, {
        ...(activeTab === "general" && {
          username: form.username.trim(), email: form.email.trim(),
          groupName: form.groupName.trim() || null,
          firstName: form.firstName.trim() || null, lastName: form.lastName.trim() || null,
          displayName: form.displayName.trim() || null, phoneNumber: form.phoneNumber.trim() || null,
          department: form.department.trim() || null,
          isActive: form.isActive, isApproved: form.isApproved,
          isEmailVerified: form.isEmailVerified, mustChangePassword: form.mustChangePassword,
        }),
        ...(activeTab === "security" && { recoveryEmail: form.recoveryEmail.trim() || null }),
        ...(activeTab === "temporary" && {
          temporaryAccount: form.temporaryAccount,
          accountExpiry: form.temporaryAccount ? form.accountExpiry || null : null,
        }),
        ...(activeTab === "notes" && { remarks: form.remarks.trim() || null }),
      });
      toast.success("บันทึกสำเร็จ");
      onSaved();
      if (activeTab !== "general") void load();
      else onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "ไม่สามารถบันทึกข้อมูลได้");
    } finally { setSaving(false); }
  };

  const handleUnlock = async () => {
    setSaving(true);
    try {
      await post(`/users/${userId}/unlock`, {});
      toast.success("ปลดล็อคบัญชีสำเร็จ");
      void load();
    } catch { toast.error("ไม่สามารถปลดล็อคได้"); }
    finally { setSaving(false); }
  };

  const handleForceLogout = async () => {
    setSaving(true);
    try {
      const res = await del<{ success: boolean; sessionsRevoked: number }>(`/users/${userId}/sessions`);
      toast.success(`บังคับออกจากระบบ ${res.data.sessionsRevoked} session`);
    } catch { toast.error("ไม่สามารถบังคับออกจากระบบได้"); }
    finally { setSaving(false); }
  };

  const handleResetPassword = async () => {
    if (!newPw || newPw.length < 8) { toast.error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"); return; }
    setSaving(true);
    try {
      await post(`/users/${userId}/reset-password`, { newPassword: newPw, mustChangePassword: pwMustChange });
      toast.success("รีเซ็ตรหัสผ่านสำเร็จ");
      closeResetPassword();
    } catch { toast.error("ไม่สามารถรีเซ็ตรหัสผ่านได้"); }
    finally { setSaving(false); }
  };

  const isLocked = Boolean(user?.locked_until && new Date(user.locked_until) > new Date());

  const tabs: { id: Tab; label: string; icon: typeof Pencil }[] = [
    { id: "general", label: "ข้อมูลทั่วไป", icon: Pencil },
    { id: "security", label: "ความปลอดภัย", icon: Shield },
    { id: "temporary", label: "บัญชีชั่วคราว", icon: Clock },
    { id: "notes", label: "หมายเหตุ", icon: FileText },
  ];

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
        onClick={(e) => !saving && e.target === e.currentTarget && onClose()}
      >
        <div
          className="flex w-full max-w-2xl flex-col rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card"
          style={{ maxHeight: "90vh" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-theme px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                <Pencil className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-light-text dark:text-dark-text">แก้ไขข้อมูลผู้ใช้</h2>
                <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                  ผู้ใช้: <span className="font-semibold">{username}</span>
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-theme px-4">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => changeTab(id)}
                className={`relative flex items-center gap-2 px-3 py-3 text-sm font-semibold transition-colors ${
                  activeTab === id
                    ? "text-light-primary dark:text-dark-primary"
                    : "text-light-text-muted hover:text-light-text dark:text-dark-text-muted dark:hover:text-dark-text"
                }`}>
                <Icon className="h-4 w-4" />
                {label}
                {activeTab === id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-light-primary dark:bg-dark-primary" />
                )}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="grid min-h-40 place-items-center">
                <RefreshCw className="h-6 w-6 animate-spin text-light-text-muted dark:text-dark-text-muted" />
              </div>
            ) : (
              <>
                {/* ── General ── */}
                {activeTab === "general" && (
                  <div className="space-y-5">
                    {isLocked && (
                      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
                        <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-red-700 dark:text-red-300">บัญชีถูกล็อค</p>
                          <p className="text-xs text-red-600 dark:text-red-400">ล้มเหลว {user?.failed_login_attempts} ครั้ง</p>
                        </div>
                        <button type="button" onClick={() => void handleUnlock()} disabled={saving}
                          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                          <LockOpen className="h-3.5 w-3.5" />ปลดล็อค
                        </button>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><label className={labelClass}>Username</label>
                        <input className={inputClass} value={form.username} onChange={(e) => set("username", e.target.value)} /></div>
                      <div><label className={labelClass}>Email</label>
                        <input className={inputClass} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
                      <div><label className={labelClass}>ชื่อ</label>
                        <input className={inputClass} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></div>
                      <div><label className={labelClass}>นามสกุล</label>
                        <input className={inputClass} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></div>
                      <div><label className={labelClass}>Display name</label>
                        <input className={inputClass} value={form.displayName} onChange={(e) => set("displayName", e.target.value)} /></div>
                      <div><label className={labelClass}>เบอร์โทร</label>
                        <input className={inputClass} value={form.phoneNumber} onChange={(e) => set("phoneNumber", e.target.value)} /></div>
                      <div><label className={labelClass}>แผนก</label>
                        <input className={inputClass} value={form.department} onChange={(e) => set("department", e.target.value)} /></div>
                      <div><label className={labelClass}>กลุ่ม</label>
                        <input className={inputClass} value={form.groupName} onChange={(e) => set("groupName", e.target.value)} /></div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <ToggleRow label="Active" desc="อนุญาตให้เข้าสู่ระบบ" checked={form.isActive} onChange={(v) => set("isActive", v)} />
                      <ToggleRow label="Approved" desc="ผ่านการอนุมัติแล้ว" checked={form.isApproved} onChange={(v) => set("isApproved", v)} />
                      <ToggleRow label="Email verified" checked={form.isEmailVerified} onChange={(v) => set("isEmailVerified", v)} />
                      <ToggleRow label="บังคับเปลี่ยน password" desc="ครั้งถัดไปที่ login" checked={form.mustChangePassword} onChange={(v) => set("mustChangePassword", v)} />
                    </div>

                    <div className="rounded-lg border border-theme bg-light-background px-4 py-3 text-xs text-light-text-muted dark:bg-dark-background dark:text-dark-text-muted space-y-1">
                      <p><span className="font-semibold">สร้างเมื่อ:</span> {formatDateTime(user?.created_at)}</p>
                      <p><span className="font-semibold">เข้าสู่ระบบล่าสุด:</span> {user?.last_login ? formatDateTime(user.last_login) : "ไม่เคย"}</p>
                    </div>
                  </div>
                )}

                {/* ── Security ── */}
                {activeTab === "security" && (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button type="button" onClick={openResetPassword}
                        className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30">
                        <KeyRound className="h-4 w-4" />รีเซ็ตรหัสผ่าน
                      </button>
                      <button type="button" onClick={() => void handleForceLogout()} disabled={saving}
                        className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30">
                        <LogOut className="h-4 w-4" />บังคับออกจากระบบ
                      </button>
                    </div>
                    <div><label className={labelClass}>อีเมลสำรอง (Recovery Email)</label>
                      <input className={inputClass} type="email" placeholder="recovery@example.com"
                        value={form.recoveryEmail} onChange={(e) => set("recoveryEmail", e.target.value)} /></div>
                  </div>
                )}

                {/* ── Temporary ── */}
                {activeTab === "temporary" && (
                  <div className="space-y-4">
                    <ToggleRow label="บัญชีชั่วคราว" desc="บัญชีจะหมดอายุตามวันที่กำหนด"
                      checked={form.temporaryAccount}
                      onChange={(v) => set("temporaryAccount", v)} />
                    {form.temporaryAccount ? (
                      <div>
                        <label className={labelClass}>วันหมดอายุ <span className="text-red-500">*</span></label>
                        <input className={inputClass} type="date"
                          min={new Date().toISOString().slice(0, 10)}
                          value={form.accountExpiry}
                          onChange={(e) => set("accountExpiry", e.target.value)} />
                        <p className="mt-1 text-xs text-light-text-muted dark:text-dark-text-muted">
                          บัญชีจะถูกปิดอัตโนมัติเมื่อถึงวันที่กำหนด
                        </p>
                      </div>
                    ) : (
                      <div className="grid min-h-24 place-items-center text-center text-sm text-light-text-muted dark:text-dark-text-muted">
                        <div>
                          <Clock className="mx-auto mb-2 h-8 w-8 opacity-30" />
                          <p>บัญชีนี้ไม่ใช่บัญชีชั่วคราว</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Notes ── */}
                {activeTab === "notes" && (
                  <div>
                    <label className={labelClass}>หมายเหตุ (Remarks)</label>
                    <textarea className={inputClass} rows={6}
                      placeholder="บันทึกหมายเหตุเกี่ยวกับผู้ใช้นี้..."
                      value={form.remarks}
                      onChange={(e) => set("remarks", e.target.value)} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-theme px-5 py-4">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 disabled:opacity-50 dark:text-dark-text dark:hover:bg-dark-primary/10">
              ยกเลิก
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={saving || loading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              บันทึกการเปลี่ยนแปลง
            </button>
          </div>
        </div>
      </div>

      {/* Reset Password sub-modal */}
      {showResetPw && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">
            <div className="flex items-center gap-3 border-b border-theme px-5 py-4">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">รีเซ็ตรหัสผ่าน</h3>
                <p className="text-xs text-light-text-muted dark:text-dark-text-muted">{username}</p>
              </div>
            </div>
            <div className="grid gap-4 p-5">
              <div>
                <label className={labelClass}>รหัสผ่านใหม่</label>
                <input className={inputClass} type="password" placeholder="อย่างน้อย 8 ตัวอักษร"
                  value={newPw} onChange={(e) => setNewPw(e.target.value)} autoFocus />
              </div>
              <ToggleRow label="บังคับเปลี่ยนรหัสผ่านครั้งถัดไป" checked={pwMustChange} onChange={setPwMustChange} />
            </div>
            <div className="flex gap-3 border-t border-theme px-5 py-4">
              <button type="button" onClick={closeResetPassword} disabled={saving}
                className="flex-1 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text hover:bg-light-primary/10 disabled:opacity-50 dark:text-dark-text dark:hover:bg-dark-primary/10">
                ยกเลิก
              </button>
              <button type="button" onClick={() => void handleResetPassword()} disabled={saving || !newPw || newPw.length < 8}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60">
                {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
                รีเซ็ตรหัสผ่าน
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>,
    document.body,
  );
};

export default ModalEditUser;
