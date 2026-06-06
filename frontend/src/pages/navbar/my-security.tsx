import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BellRing,
  CheckCircle2,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  Save,
  ShieldCheck,
  Smartphone,
  XCircle,
} from "lucide-react";
import type { AxiosError } from "axios";
import { toast } from "react-toastify";
import { useSession } from "@/contexts/SessionContext";
import { useApi } from "@/hooks/useApi";

const cardClass = "rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card";
const inputClass =
  "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text outline-none transition placeholder:text-light-text-muted focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder:text-dark-text-muted dark:focus:ring-dark-primary";
const labelClass = "mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted";
const primaryButtonClass =
  "inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:cursor-not-allowed disabled:opacity-50 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover";
const secondaryButtonClass =
  "inline-flex items-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary";

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
      checked ? "bg-light-primary dark:bg-dark-primary" : "bg-light-text-muted/30 dark:bg-dark-text-muted/30"
    }`}
  >
    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
  </button>
);

type SecurityTab = "password" | "two-factor" | "recovery" | "notifications" | "sessions";

const securityTabs: Array<{ id: SecurityTab; label: string; icon: typeof LockKeyhole }> = [
  { id: "password", label: "รหัสผ่าน", icon: LockKeyhole },
  { id: "two-factor", label: "2FA", icon: Smartphone },
  { id: "recovery", label: "กู้คืนบัญชี", icon: Mail },
  { id: "notifications", label: "การแจ้งเตือน", icon: BellRing },
  { id: "sessions", label: "อุปกรณ์และ Session", icon: History },
];

type PasswordPolicy = {
  minLength: number;
  requireLowercase: boolean;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
  historyCount: number;
};

type PasswordPolicyResponse = { success: boolean; data: PasswordPolicy };
type ChangePasswordResponse = { success: boolean; message?: string };
type PasswordField = "currentPassword" | "newPassword" | "confirmPassword";

const MySecurityPage = () => {
  const { user } = useSession();
  const { get, put } = useApi();
  const [searchParams, setSearchParams] = useSearchParams();
  const [visiblePasswords, setVisiblePasswords] = useState<Record<PasswordField, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [isPolicyLoading, setIsPolicyLoading] = useState(true);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy>({
    minLength: 8,
    requireLowercase: true,
    requireUppercase: true,
    requireNumber: true,
    requireSpecial: true,
    historyCount: 0,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [notifications, setNotifications] = useState({
    newLogin: true,
    passwordChanged: true,
    securityChanged: true,
  });
  const requestedTab = searchParams.get("tab");
  const activeTab = securityTabs.some((tab) => tab.id === requestedTab)
    ? (requestedTab as SecurityTab)
    : "password";

  const selectTab = (tab: SecurityTab) => {
    setSearchParams((params) => {
      params.set("tab", tab);
      return params;
    });
  };

  useEffect(() => {
    let active = true;
    const loadPolicy = async () => {
      try {
        const response = await get<PasswordPolicyResponse>("/account-security/password-policy");
        if (active) setPasswordPolicy(response.data.data);
      } catch {
        if (active) toast.error("ไม่สามารถโหลด Password Policy ได้");
      } finally {
        if (active) setIsPolicyLoading(false);
      }
    };
    void loadPolicy();
    return () => {
      active = false;
    };
  }, []);

  const passwordRules = useMemo(() => {
    const password = passwordForm.newPassword;
    return [
      { label: `มีอย่างน้อย ${passwordPolicy.minLength} ตัวอักษร`, required: true, valid: password.length >= passwordPolicy.minLength },
      { label: "มีตัวอักษรพิมพ์เล็ก", required: passwordPolicy.requireLowercase, valid: /[a-z]/.test(password) },
      { label: "มีตัวอักษรพิมพ์ใหญ่", required: passwordPolicy.requireUppercase, valid: /[A-Z]/.test(password) },
      { label: "มีตัวเลข", required: passwordPolicy.requireNumber, valid: /\d/.test(password) },
      { label: "มีอักขระพิเศษ", required: passwordPolicy.requireSpecial, valid: /[^A-Za-z0-9]/.test(password) },
      { label: "รหัสผ่านใหม่และยืนยันรหัสผ่านตรงกัน", required: true, valid: Boolean(password) && password === passwordForm.confirmPassword },
    ].filter((rule) => rule.required);
  }, [passwordForm.confirmPassword, passwordForm.newPassword, passwordPolicy]);

  const passwordMeetsPolicy = passwordRules.every((rule) => rule.valid);
  const passedRuleCount = passwordRules.filter((rule) => rule.valid).length;

  const togglePasswordVisibility = (field: PasswordField) => {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }));
  };

  const updatePasswordField = (field: keyof typeof passwordForm, value: string) => {
    setPasswordForm((current) => ({ ...current, [field]: value }));
  };

  const handleMockAction = (message: string) => {
    toast.info(`${message} ยังไม่เชื่อม API`);
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!passwordMeetsPolicy || !passwordForm.currentPassword || isChangingPassword) return;

    setIsChangingPassword(true);
    try {
      const response = await put<ChangePasswordResponse>("/account-security/password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success(response.data.message ?? "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว");
    } catch (error) {
      const apiError = error as AxiosError<{ message?: string }>;
      toast.error(apiError.response?.data?.message ?? "ไม่สามารถเปลี่ยนรหัสผ่านได้");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-5">
      <header className="rounded-lg border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-light-primary text-white dark:bg-dark-primary dark:text-dark-background">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-light-text-muted dark:text-dark-text-muted">บัญชีของฉัน</p>
              <h1 className="mt-0.5 text-2xl font-semibold text-light-text dark:text-dark-text">ตั้งค่าบัญชี</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                จัดการรหัสผ่าน การยืนยันตัวตน และการแจ้งเตือนความปลอดภัย
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            บัญชีปกติ
          </span>
        </div>
      </header>

      <nav className="overflow-x-auto rounded-lg border border-theme bg-light-background-card p-1 shadow-soft dark:bg-dark-background-card" aria-label="Account settings">
        <div className="flex min-w-max gap-1">
          {securityTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => selectTab(id)}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === id
                  ? "bg-light-primary text-white dark:bg-dark-primary dark:text-dark-background"
                  : "text-light-text-muted hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {activeTab === "password" && (
        <form className={cardClass} onSubmit={handlePasswordSubmit}>
          <div className="mb-6 flex items-center gap-3 border-b border-theme pb-5">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-light-text dark:text-dark-text">เปลี่ยนรหัสผ่าน</h2>
              <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                รหัสผ่านใหม่ต้องผ่าน Password Policy ของระบบ
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="grid content-start gap-5">
              <div>
                <label className={labelClass}>รหัสผ่านปัจจุบัน</label>
                <div className="relative">
                  <input
                    type={visiblePasswords.currentPassword ? "text" : "password"}
                    className={`${inputClass} pr-11`}
                    value={passwordForm.currentPassword}
                    onChange={(event) => updatePasswordField("currentPassword", event.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    title={visiblePasswords.currentPassword ? "ซ่อนรหัสผ่านปัจจุบัน" : "แสดงรหัสผ่านปัจจุบัน"}
                    onClick={() => togglePasswordVisibility("currentPassword")}
                    className="absolute inset-y-0 right-0 grid w-11 place-items-center text-light-text-muted transition-colors hover:text-light-primary dark:text-dark-text-muted dark:hover:text-dark-primary"
                  >
                    {visiblePasswords.currentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 rounded-md border border-theme bg-light-background p-4 dark:bg-dark-background sm:grid-cols-2">
                <div>
                  <label className={labelClass}>รหัสผ่านใหม่</label>
                  <div className="relative">
                    <input
                      type={visiblePasswords.newPassword ? "text" : "password"}
                      className={`${inputClass} pr-11`}
                      value={passwordForm.newPassword}
                      onChange={(event) => updatePasswordField("newPassword", event.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      title={visiblePasswords.newPassword ? "ซ่อนรหัสผ่านใหม่" : "แสดงรหัสผ่านใหม่"}
                      onClick={() => togglePasswordVisibility("newPassword")}
                      className="absolute inset-y-0 right-0 grid w-11 place-items-center text-light-text-muted transition-colors hover:text-light-primary dark:text-dark-text-muted dark:hover:text-dark-primary"
                    >
                      {visiblePasswords.newPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>ยืนยันรหัสผ่านใหม่</label>
                  <div className="relative">
                    <input
                      type={visiblePasswords.confirmPassword ? "text" : "password"}
                      className={`${inputClass} pr-11`}
                      value={passwordForm.confirmPassword}
                      onChange={(event) => updatePasswordField("confirmPassword", event.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      title={visiblePasswords.confirmPassword ? "ซ่อนรหัสผ่านยืนยัน" : "แสดงรหัสผ่านยืนยัน"}
                      onClick={() => togglePasswordVisibility("confirmPassword")}
                      className="absolute inset-y-0 right-0 grid w-11 place-items-center text-light-text-muted transition-colors hover:text-light-primary dark:text-dark-text-muted dark:hover:text-dark-primary"
                    >
                      {visiblePasswords.confirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-theme pt-4">
                <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                  ระบบจะตรวจรหัสปัจจุบันและประวัติรหัสผ่านอีกครั้งเมื่อบันทึก
                </p>
                <button type="submit" className={primaryButtonClass}
                  disabled={!passwordForm.currentPassword || !passwordMeetsPolicy || isChangingPassword || isPolicyLoading}>
                  {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  {isChangingPassword ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}
                </button>
              </div>
            </div>

            <aside className="h-fit rounded-lg border border-theme bg-light-primary/5 p-4 dark:bg-dark-primary/10">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-light-text dark:text-dark-text">ความพร้อมของรหัสผ่าน</p>
                  <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">
                    ผ่านแล้ว {passedRuleCount} จาก {passwordRules.length} เงื่อนไข
                  </p>
                </div>
                {isPolicyLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-light-text-muted dark:text-dark-text-muted" />
                ) : (
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${
                    passwordMeetsPolicy
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-light-text-muted/10 text-light-text-muted dark:text-dark-text-muted"
                  }`}>
                    {passwordMeetsPolicy ? "พร้อมใช้งาน" : "ยังไม่ครบ"}
                  </span>
                )}
              </div>

              <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-light-text-muted/15 dark:bg-dark-text-muted/15">
                <div
                  className={`h-full transition-all ${passwordMeetsPolicy ? "bg-emerald-500" : "bg-light-primary dark:bg-dark-primary"}`}
                  style={{ width: `${passwordRules.length ? (passedRuleCount / passwordRules.length) * 100 : 0}%` }}
                />
              </div>

              <div className="grid gap-2.5">
                {passwordRules.map((rule) => {
                  const Icon = rule.valid ? CheckCircle2 : XCircle;
                  const hasStarted = Boolean(passwordForm.newPassword || passwordForm.confirmPassword);
                  return (
                    <div key={rule.label} className={`flex items-center gap-2 text-xs font-medium ${
                      rule.valid
                        ? "text-emerald-600 dark:text-emerald-400"
                        : hasStarted
                          ? "text-red-600 dark:text-red-400"
                          : "text-light-text-muted dark:text-dark-text-muted"
                    }`}>
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{rule.label}</span>
                    </div>
                  );
                })}
                {passwordPolicy.historyCount > 0 && (
                  <div className="mt-1 flex items-start gap-2 border-t border-theme pt-3 text-xs font-medium text-light-text-muted dark:text-dark-text-muted">
                    <History className="h-4 w-4 shrink-0" />
                    <span>ห้ามซ้ำกับ {passwordPolicy.historyCount} รหัสผ่านล่าสุด โดยตรวจเมื่อบันทึก</span>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </form>
      )}

      {activeTab === "two-factor" && (
        <article className={cardClass}>
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-light-text dark:text-dark-text">Two-factor authentication</h2>
              <p className="text-xs text-light-text-muted dark:text-dark-text-muted">เพิ่มการยืนยันตัวตนอีกหนึ่งขั้น</p>
            </div>
          </div>
          <div className="rounded-md border border-theme bg-light-background p-4 dark:bg-dark-background">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-light-text dark:text-dark-text">Authenticator app</p>
                <p className="mt-1 text-xs text-light-text-muted dark:text-dark-text-muted">
                  ใช้รหัส OTP จากแอปยืนยันตัวตนเมื่อเข้าสู่ระบบ
                </p>
              </div>
              <span className="rounded-md bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">ยังไม่เปิด</span>
            </div>
          </div>
          <button type="button" onClick={() => handleMockAction("Two-factor authentication")} className={`${primaryButtonClass} mt-4`}>
            <Smartphone className="h-4 w-4" />
            ตั้งค่า 2FA
          </button>
        </article>
      )}

      {activeTab === "recovery" && (
        <article className={cardClass}>
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-light-text dark:text-dark-text">ช่องทางกู้คืนบัญชี</h2>
              <p className="text-xs text-light-text-muted dark:text-dark-text-muted">ใช้สำหรับกู้คืนบัญชีเมื่อเข้าใช้งานไม่ได้</p>
            </div>
          </div>
          <div className="grid gap-4">
            <div>
              <label className={labelClass}>อีเมลหลัก</label>
              <input className={inputClass} value={user?.email ?? ""} disabled />
            </div>
            <div>
              <label className={labelClass}>Recovery email</label>
              <input type="email" className={inputClass} value={recoveryEmail} placeholder="recovery@example.com"
                onChange={(event) => setRecoveryEmail(event.target.value)} />
            </div>
          </div>
          <div className="mt-5 flex justify-end border-t border-theme pt-4">
            <button type="button" className={primaryButtonClass} disabled={!recoveryEmail.trim()} onClick={() => handleMockAction("การบันทึก Recovery email")}>
              <Save className="h-4 w-4" />
              บันทึก
            </button>
          </div>
        </article>
      )}

      {activeTab === "notifications" && (
        <article className={cardClass}>
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-light-text dark:text-dark-text">การแจ้งเตือนความปลอดภัย</h2>
              <p className="text-xs text-light-text-muted dark:text-dark-text-muted">เลือกเหตุการณ์ที่ต้องการรับแจ้งเตือน</p>
            </div>
          </div>
          <div className="divide-y divide-theme">
            {([
              ["newLogin", "มีการเข้าสู่ระบบจากอุปกรณ์ใหม่"],
              ["passwordChanged", "รหัสผ่านถูกเปลี่ยน"],
              ["securityChanged", "การตั้งค่าความปลอดภัยถูกเปลี่ยน"],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <span className="text-sm font-medium text-light-text dark:text-dark-text">{label}</span>
                <Toggle checked={notifications[key]} onChange={() => setNotifications((current) => ({ ...current, [key]: !current[key] }))} />
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end border-t border-theme pt-4">
            <button type="button" className={primaryButtonClass} onClick={() => handleMockAction("การบันทึกการแจ้งเตือน")}>
              <Save className="h-4 w-4" />
              บันทึก
            </button>
          </div>
        </article>
      )}

      {activeTab === "sessions" && (
      <article className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-light-text dark:text-dark-text">อุปกรณ์และประวัติการเข้าสู่ระบบ</h2>
            <p className="text-xs text-light-text-muted dark:text-dark-text-muted">ตรวจสอบ session และปิดอุปกรณ์ที่ไม่รู้จัก</p>
          </div>
        </div>
        <Link to="/my-auth-history" className={secondaryButtonClass}>
          <History className="h-4 w-4" />
          ดูประวัติการเข้าสู่ระบบ
        </Link>
      </article>
      )}
    </section>
  );
};

export default MySecurityPage;
