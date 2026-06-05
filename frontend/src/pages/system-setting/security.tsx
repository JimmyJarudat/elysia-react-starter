import { useEffect, useMemo, useState } from "react";
import { KeyRound, LockKeyhole, RefreshCw, RotateCcw, Save, ShieldCheck, TimerReset } from "lucide-react";
import { toast } from "react-toastify";
import { useSession } from "@/contexts/SessionContext";
import { useApi } from "@/hooks/useApi";

type SecuritySettings = {
  accessTokenExpiryMinutes: number;
  refreshTokenExpiryMinutes: number;
  sessionExpiryMinutes: number;
  maxActiveSessions: number;
  maxLoginAttempts: number;
  accountLockMinutes: number;
  passwordExpiryDays: number;
  passwordMinLength: number;
  passwordRequireLowercase: boolean;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
  passwordResetExpiryMinutes: number;
  jwtSecret?: string;
  jwtJit: string;
  jwtIssuer: string;
  jwtAudience: string;
  hasJwtSecret: boolean;
};

type SecuritySettingsResponse = {
  success: boolean;
  data: SecuritySettings;
};

const defaultSecurity: SecuritySettings = {
  accessTokenExpiryMinutes: 60,
  refreshTokenExpiryMinutes: 10080,
  sessionExpiryMinutes: 2880,
  maxActiveSessions: 2,
  maxLoginAttempts: 5,
  accountLockMinutes: 5,
  passwordExpiryDays: 90,
  passwordMinLength: 8,
  passwordRequireLowercase: true,
  passwordRequireUppercase: true,
  passwordRequireNumber: true,
  passwordRequireSpecial: true,
  passwordResetExpiryMinutes: 60,
  jwtSecret: "",
  jwtJit: "",
  jwtIssuer: "genesenn-it-utils",
  jwtAudience: "genesenn-it-utils-users",
  hasJwtSecret: false,
};

const card = "rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card";
const input = "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary disabled:cursor-not-allowed disabled:opacity-70 dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";
const label = "mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted";
const sectionTitle = "text-base font-semibold text-light-text dark:text-dark-text";
const hint = "text-sm text-light-text-muted dark:text-dark-text-muted";
const btnSecondary = "inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-dark-text dark:hover:bg-dark-primary/10";
const btnPrimary = "inline-flex items-center gap-2 rounded-md bg-light-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:cursor-not-allowed disabled:opacity-50 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover";

const Toggle = ({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={onChange}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
      checked ? "bg-light-primary dark:bg-dark-primary" : "bg-light-text-muted/30 dark:bg-dark-text-muted/30"
    }`}
  >
    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
  </button>
);

const SecuritySettingPage = () => {
  const { user } = useSession();
  const { get, put } = useApi();
  const isSuperAdmin = user?.roles?.includes("SUPERADMIN") ?? false;
  const canUpdate = isSuperAdmin || Boolean(user?.permissions?.includes("settings.update"));
  const [form, setForm] = useState<SecuritySettings>(defaultSecurity);
  const [saved, setSaved] = useState<SecuritySettings>(defaultSecurity);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);
  const passwordRulesCount = [
    form.passwordRequireLowercase,
    form.passwordRequireUppercase,
    form.passwordRequireNumber,
    form.passwordRequireSpecial,
  ].filter(Boolean).length;

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const response = await get<SecuritySettingsResponse>("/system-setting/security");
        if (!active) return;
        const next = { ...defaultSecurity, ...response.data.data, jwtSecret: "" };
        setForm(next);
        setSaved(next);
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "Failed to load security settings");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const setField = <K extends keyof SecuritySettings>(key: K, value: SecuritySettings[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setNumber = (key: keyof SecuritySettings, value: string) => {
    const parsed = Number(value);
    setForm((current) => ({ ...current, [key]: Number.isFinite(parsed) ? Math.max(1, parsed) : 1 }));
  };

  const reset = () => {
    setForm(saved);
  };

  const save = async () => {
    if (!canUpdate) {
      toast.error("คุณไม่มีสิทธิ์แก้ไข System settings");
      return;
    }

    if (form.passwordMinLength < 6) {
      toast.error("Password minimum length should be at least 6");
      return;
    }

    if (!form.jwtIssuer.trim() || !form.jwtAudience.trim()) {
      toast.error("JWT issuer and audience are required");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...form,
        jwtSecret: form.jwtSecret?.trim() || undefined,
        jwtJit: form.jwtJit.trim(),
        jwtIssuer: form.jwtIssuer.trim(),
        jwtAudience: form.jwtAudience.trim(),
      };
      const response = await put<SecuritySettingsResponse>("/system-setting/security", payload);
      const next = { ...defaultSecurity, ...response.data.data, jwtSecret: "" };
      setForm(next);
      setSaved(next);
      toast.success("Security settings updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update security settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="grid gap-5">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-light-primary text-white shadow-sm dark:bg-dark-primary dark:text-dark-background">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">System Setting</p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">Security</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                ตั้งค่า JWT, session, login policy และ password policy ที่ระบบใช้งานจริง
              </p>
              {!canUpdate && (
                <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-300">
                  คุณมีสิทธิ์ดูเท่านั้น ต้องมี settings.update เพื่อแก้ไข
                </p>
              )}
            </div>
          </div>
          {canUpdate && (
            <div className="flex gap-2">
              <button type="button" onClick={reset} disabled={!isDirty || isSaving} className={btnSecondary}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
              <button type="button" onClick={() => void save()} disabled={!isDirty || isLoading || isSaving} className={btnPrimary}>
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid min-h-48 place-items-center rounded-lg border border-theme bg-light-background-card dark:bg-dark-background-card">
          <RefreshCw className="h-6 w-6 animate-spin text-light-text-muted dark:text-dark-text-muted" />
        </div>
      ) : (
        <>
          <article className={card}>
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-300">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className={sectionTitle}>JWT</h2>
                <p className={hint}>ค่าลงนาม token อ่านจากฐานข้อมูลและเปลี่ยน runtime ได้</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={label}>JWT secret</label>
                <input
                  className={input}
                  type="password"
                  value={form.jwtSecret ?? ""}
                  onChange={(event) => setField("jwtSecret", event.target.value)}
                  placeholder={form.hasJwtSecret ? "ใช้ secret เดิม ถ้าไม่กรอก" : "change-this-jwt-secret"}
                  disabled={!canUpdate}
                />
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">
                  เปลี่ยน secret แล้ว token เก่าจะใช้ไม่ได้ทันที
                </p>
              </div>
              <div>
                <label className={label}>JWT JTI override</label>
                <input className={input} value={form.jwtJit} onChange={(event) => setField("jwtJit", event.target.value)} disabled={!canUpdate} placeholder="ปล่อยว่างเพื่อสุ่มอัตโนมัติ" />
              </div>
              <div>
                <label className={label}>Issuer</label>
                <input className={input} value={form.jwtIssuer} onChange={(event) => setField("jwtIssuer", event.target.value)} disabled={!canUpdate} />
              </div>
              <div>
                <label className={label}>Audience</label>
                <input className={input} value={form.jwtAudience} onChange={(event) => setField("jwtAudience", event.target.value)} disabled={!canUpdate} />
              </div>
            </div>
          </article>

          <article className={card}>
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                <TimerReset className="h-5 w-5" />
              </div>
              <div>
                <h2 className={sectionTitle}>Token & Session</h2>
                <p className={hint}>อายุ token และจำนวน session สูงสุดต่อ user</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className={label}>Access token (minutes)</label>
                <input className={input} type="number" min={1} value={form.accessTokenExpiryMinutes} onChange={(event) => setNumber("accessTokenExpiryMinutes", event.target.value)} disabled={!canUpdate} />
              </div>
              <div>
                <label className={label}>Refresh token (minutes)</label>
                <input className={input} type="number" min={1} value={form.refreshTokenExpiryMinutes} onChange={(event) => setNumber("refreshTokenExpiryMinutes", event.target.value)} disabled={!canUpdate} />
              </div>
              <div>
                <label className={label}>Session expiry (minutes)</label>
                <input className={input} type="number" min={1} value={form.sessionExpiryMinutes} onChange={(event) => setNumber("sessionExpiryMinutes", event.target.value)} disabled={!canUpdate} />
              </div>
              <div>
                <label className={label}>Max active sessions</label>
                <input className={input} type="number" min={1} value={form.maxActiveSessions} onChange={(event) => setNumber("maxActiveSessions", event.target.value)} disabled={!canUpdate} />
              </div>
            </div>
          </article>

          <article className={card}>
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-300">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <h2 className={sectionTitle}>Login Lockout</h2>
                <p className={hint}>ควบคุมการล็อกบัญชีเมื่อ login ผิดหลายครั้ง</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={label}>Max login attempts</label>
                <input className={input} type="number" min={1} value={form.maxLoginAttempts} onChange={(event) => setNumber("maxLoginAttempts", event.target.value)} disabled={!canUpdate} />
              </div>
              <div>
                <label className={label}>Account lock (minutes)</label>
                <input className={input} type="number" min={1} value={form.accountLockMinutes} onChange={(event) => setNumber("accountLockMinutes", event.target.value)} disabled={!canUpdate} />
              </div>
              <div>
                <label className={label}>Password reset link (minutes)</label>
                <input className={input} type="number" min={1} value={form.passwordResetExpiryMinutes} onChange={(event) => setNumber("passwordResetExpiryMinutes", event.target.value)} disabled={!canUpdate} />
              </div>
            </div>
          </article>

          <article className={card}>
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className={sectionTitle}>Password Policy</h2>
                <p className={hint}>กฎรหัสผ่านสำหรับ user ใหม่และการเปลี่ยนรหัสผ่าน</p>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={label}>Minimum length</label>
                  <input className={input} type="number" min={6} value={form.passwordMinLength} onChange={(event) => setNumber("passwordMinLength", event.target.value)} disabled={!canUpdate} />
                </div>
                <div>
                  <label className={label}>Password expiry (days)</label>
                  <input className={input} type="number" min={1} value={form.passwordExpiryDays} onChange={(event) => setNumber("passwordExpiryDays", event.target.value)} disabled={!canUpdate} />
                </div>
              </div>
              <div className="grid gap-2">
                {[
                  ["passwordRequireLowercase", "Require lowercase letter"],
                  ["passwordRequireUppercase", "Require uppercase letter"],
                  ["passwordRequireNumber", "Require number"],
                  ["passwordRequireSpecial", "Require special character"],
                ].map(([key, text]) => (
                  <div key={key} className="flex items-center justify-between rounded-md border border-theme bg-light-background px-3 py-2.5 dark:bg-dark-background">
                    <span className="text-sm font-medium text-light-text dark:text-dark-text">{text}</span>
                    <Toggle
                      checked={Boolean(form[key as keyof SecuritySettings])}
                      onChange={() => setField(key as keyof SecuritySettings, !form[key as keyof SecuritySettings] as never)}
                      disabled={!canUpdate}
                    />
                  </div>
                ))}
                <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                  เปิดใช้งานอยู่ {passwordRulesCount} จาก 4 rules
                </p>
              </div>
            </div>
          </article>
        </>
      )}
    </section>
  );
};

export default SecuritySettingPage;
