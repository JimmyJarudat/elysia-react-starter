import { useEffect, useMemo, useState } from "react";
import {
  Globe,
  KeyRound,
  LockKeyhole,
  Network,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  TimerReset,
  Trash2,
} from "lucide-react";
import { toast } from "react-toastify";
import { useSession } from "@/contexts/SessionContext";
import { useApi } from "@/hooks/useApi";
import { useRegional } from "@/contexts/RegionalContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type JwtForm = {
  jwtSecret: string;
  jwtJit: string;
  jwtIssuer: string;
  jwtAudience: string;
  hasJwtSecret: boolean;
};

type TokenForm = {
  accessTokenExpiryMinutes: number;
  refreshTokenExpiryMinutes: number;
  sessionExpiryMinutes: number;
  maxActiveSessions: number;
};

type LockoutForm = {
  maxLoginAttempts: number;
  accountLockMinutes: number;
  passwordResetExpiryMinutes: number;
};

type PasswordForm = {
  passwordMinLength: number;
  passwordExpiryDays: number;
  passwordRequireLowercase: boolean;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
  passwordHistoryCount: number;
};

type SessionSecurityForm = {
  idleTimeoutMinutes: number;
  forceSingleSession: boolean;
  accountInactivityDays: number;
};

type AllSecurityData = {
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
  jwtJit: string;
  jwtIssuer: string;
  jwtAudience: string;
  hasJwtSecret: boolean;
  idleTimeoutMinutes: number;
  accountInactivityDays: number;
  passwordHistoryCount: number;
  forceSingleSession: boolean;
};

type SecuritySettingsResponse = { success: boolean; data: AllSecurityData };

type IpEntry = { id: number; ipAddress: string; reason: string; createdAt: string };
type IpBlocklistResponse = { success: boolean; data: IpEntry[] };

type CorsForm = { origins: string[] };
type CorsResponse = { success: boolean; data: { origins: string[] } };

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultJwt: JwtForm = {
  jwtSecret: "", jwtJit: "", jwtIssuer: "genesenn-it-utils",
  jwtAudience: "genesenn-it-utils-users", hasJwtSecret: false,
};
const defaultToken: TokenForm = {
  accessTokenExpiryMinutes: 60, refreshTokenExpiryMinutes: 10080,
  sessionExpiryMinutes: 2880, maxActiveSessions: 2,
};
const defaultLockout: LockoutForm = {
  maxLoginAttempts: 5, accountLockMinutes: 5, passwordResetExpiryMinutes: 60,
};
const defaultPassword: PasswordForm = {
  passwordMinLength: 8, passwordExpiryDays: 90,
  passwordRequireLowercase: true, passwordRequireUppercase: true,
  passwordRequireNumber: true, passwordRequireSpecial: true,
  passwordHistoryCount: 0,
};
const defaultSessionSecurity: SessionSecurityForm = {
  idleTimeoutMinutes: 0, forceSingleSession: false, accountInactivityDays: 0,
};
const defaultCors: CorsForm = { origins: [] };

// ─── Styles ───────────────────────────────────────────────────────────────────

const card = "rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card";
const input = "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary disabled:cursor-not-allowed disabled:opacity-70 dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";
const label = "mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted";
const sectionTitle = "text-base font-semibold text-light-text dark:text-dark-text";
const hint = "text-sm text-light-text-muted dark:text-dark-text-muted";
const btnSecondary = "inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-dark-text dark:hover:bg-dark-primary/10";
const btnPrimary = "inline-flex items-center gap-2 rounded-md bg-light-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:cursor-not-allowed disabled:opacity-50 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover";
const btnDanger = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20";

// ─── Sub-components ───────────────────────────────────────────────────────────

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

type SectionActionsProps = { isDirty: boolean; isSaving: boolean; onReset: () => void; onSave: () => void };
const SectionActions = ({ isDirty, isSaving, onReset, onSave }: SectionActionsProps) => (
  <div className="flex gap-2">
    <button type="button" onClick={onReset} disabled={!isDirty || isSaving} className={btnSecondary}>
      <RotateCcw className="h-4 w-4" />
      Reset
    </button>
    <button type="button" onClick={onSave} disabled={!isDirty || isSaving} className={btnPrimary}>
      {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      Save
    </button>
  </div>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const splitData = (data: AllSecurityData) => ({
  jwt: {
    jwtSecret: "", jwtJit: data.jwtJit, jwtIssuer: data.jwtIssuer,
    jwtAudience: data.jwtAudience, hasJwtSecret: data.hasJwtSecret,
  } satisfies JwtForm,
  token: {
    accessTokenExpiryMinutes: data.accessTokenExpiryMinutes,
    refreshTokenExpiryMinutes: data.refreshTokenExpiryMinutes,
    sessionExpiryMinutes: data.sessionExpiryMinutes,
    maxActiveSessions: data.maxActiveSessions,
  } satisfies TokenForm,
  lockout: {
    maxLoginAttempts: data.maxLoginAttempts,
    accountLockMinutes: data.accountLockMinutes,
    passwordResetExpiryMinutes: data.passwordResetExpiryMinutes,
  } satisfies LockoutForm,
  password: {
    passwordMinLength: data.passwordMinLength,
    passwordExpiryDays: data.passwordExpiryDays,
    passwordRequireLowercase: data.passwordRequireLowercase,
    passwordRequireUppercase: data.passwordRequireUppercase,
    passwordRequireNumber: data.passwordRequireNumber,
    passwordRequireSpecial: data.passwordRequireSpecial,
    passwordHistoryCount: data.passwordHistoryCount,
  } satisfies PasswordForm,
  sessionSecurity: {
    idleTimeoutMinutes: data.idleTimeoutMinutes,
    forceSingleSession: data.forceSingleSession,
    accountInactivityDays: data.accountInactivityDays,
  } satisfies SessionSecurityForm,
});

// ─── Page ─────────────────────────────────────────────────────────────────────

const SecuritySettingPage = () => {
  const { user } = useSession();
  const { get, put, post, del } = useApi();
  const { formatDateTime } = useRegional();
  const isSuperAdmin = user?.roles?.includes("SUPERADMIN") ?? false;
  const canUpdate = isSuperAdmin || Boolean(user?.permissions?.includes("settings.update"));

  const [isLoading, setIsLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<"jwt" | "token" | "lockout" | "password" | "session" | "cors" | null>(null);

  const [jwt, setJwt] = useState<JwtForm>(defaultJwt);
  const [savedJwt, setSavedJwt] = useState<JwtForm>(defaultJwt);
  const [token, setToken] = useState<TokenForm>(defaultToken);
  const [savedToken, setSavedToken] = useState<TokenForm>(defaultToken);
  const [lockout, setLockout] = useState<LockoutForm>(defaultLockout);
  const [savedLockout, setSavedLockout] = useState<LockoutForm>(defaultLockout);
  const [password, setPassword] = useState<PasswordForm>(defaultPassword);
  const [savedPassword, setSavedPassword] = useState<PasswordForm>(defaultPassword);
  const [sessionSec, setSessionSec] = useState<SessionSecurityForm>(defaultSessionSecurity);
  const [savedSessionSec, setSavedSessionSec] = useState<SessionSecurityForm>(defaultSessionSecurity);

  // IP Blocklist state
  const [ipList, setIpList] = useState<IpEntry[]>([]);
  const [ipLoading, setIpLoading] = useState(true);
  const [newIp, setNewIp] = useState("");
  const [newIpReason, setNewIpReason] = useState("");
  const [ipAdding, setIpAdding] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  // CORS state
  const [cors, setCors] = useState<CorsForm>(defaultCors);
  const [savedCors, setSavedCors] = useState<CorsForm>(defaultCors);
  const [corsLoading, setCorsLoading] = useState(true);
  const [newOrigin, setNewOrigin] = useState("");

  const jwtDirty = useMemo(() => JSON.stringify(jwt) !== JSON.stringify(savedJwt), [jwt, savedJwt]);
  const tokenDirty = useMemo(() => JSON.stringify(token) !== JSON.stringify(savedToken), [token, savedToken]);
  const lockoutDirty = useMemo(() => JSON.stringify(lockout) !== JSON.stringify(savedLockout), [lockout, savedLockout]);
  const passwordDirty = useMemo(() => JSON.stringify(password) !== JSON.stringify(savedPassword), [password, savedPassword]);
  const sessionDirty = useMemo(() => JSON.stringify(sessionSec) !== JSON.stringify(savedSessionSec), [sessionSec, savedSessionSec]);
  const corsDirty = useMemo(() => JSON.stringify(cors) !== JSON.stringify(savedCors), [cors, savedCors]);

  const passwordRulesCount = [
    password.passwordRequireLowercase, password.passwordRequireUppercase,
    password.passwordRequireNumber, password.passwordRequireSpecial,
  ].filter(Boolean).length;

  // Load security settings
  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await get<SecuritySettingsResponse>("/system-setting/security");
        if (!active) return;
        const sections = splitData(res.data.data);
        setJwt(sections.jwt); setSavedJwt(sections.jwt);
        setToken(sections.token); setSavedToken(sections.token);
        setLockout(sections.lockout); setSavedLockout(sections.lockout);
        setPassword(sections.password); setSavedPassword(sections.password);
        setSessionSec(sections.sessionSecurity); setSavedSessionSec(sections.sessionSecurity);
      } catch (error) {
        if (active) toast.error(error instanceof Error ? error.message : "Failed to load security settings");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  // Load IP blocklist
  useEffect(() => {
    let active = true;
    const load = async () => {
      setIpLoading(true);
      try {
        const res = await get<IpBlocklistResponse>("/system-setting/ip-blocklist");
        if (active) setIpList(res.data.data);
      } catch {
        // silent — IP blocklist is secondary
      } finally {
        if (active) setIpLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  // Load CORS settings
  useEffect(() => {
    let active = true;
    const load = async () => {
      setCorsLoading(true);
      try {
        const res = await get<CorsResponse>("/system-setting/cors");
        if (active) {
          const form: CorsForm = { origins: res.data.data.origins };
          setCors(form);
          setSavedCors(form);
        }
      } catch {
        // silent
      } finally {
        if (active) setCorsLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  // Field helpers
  const setJwtField = <K extends keyof JwtForm>(key: K, value: JwtForm[K]) =>
    setJwt((prev) => ({ ...prev, [key]: value }));

  const setTokenNumber = (key: keyof TokenForm, value: string) => {
    const parsed = Number(value);
    setToken((prev) => ({ ...prev, [key]: Number.isFinite(parsed) ? Math.max(1, parsed) : 1 }));
  };

  const setLockoutNumber = (key: keyof LockoutForm, value: string) => {
    const parsed = Number(value);
    setLockout((prev) => ({ ...prev, [key]: Number.isFinite(parsed) ? Math.max(1, parsed) : 1 }));
  };

  const setPasswordNumber = (key: keyof PasswordForm, value: string) => {
    const parsed = Number(value);
    setPassword((prev) => ({ ...prev, [key]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 }));
  };

  const setPasswordField = <K extends keyof PasswordForm>(key: K, value: PasswordForm[K]) =>
    setPassword((prev) => ({ ...prev, [key]: value }));

  const setSessionNumber = (key: keyof SessionSecurityForm, value: string) => {
    const parsed = Number(value);
    setSessionSec((prev) => ({ ...prev, [key]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 }));
  };

  const setSessionField = <K extends keyof SessionSecurityForm>(key: K, value: SessionSecurityForm[K]) =>
    setSessionSec((prev) => ({ ...prev, [key]: value }));

  // Save functions
  const saveJwt = async () => {
    if (!canUpdate) { toast.error("คุณไม่มีสิทธิ์แก้ไข System settings"); return; }
    if (!jwt.jwtIssuer.trim() || !jwt.jwtAudience.trim()) { toast.error("JWT issuer and audience are required"); return; }
    setSavingSection("jwt");
    try {
      const res = await put<SecuritySettingsResponse>("/system-setting/security", {
        jwtSecret: jwt.jwtSecret?.trim() || undefined,
        jwtJit: jwt.jwtJit.trim(),
        jwtIssuer: jwt.jwtIssuer.trim(),
        jwtAudience: jwt.jwtAudience.trim(),
      });
      const next = splitData(res.data.data).jwt;
      setJwt(next); setSavedJwt(next);
      toast.success("JWT settings updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update JWT settings");
    } finally { setSavingSection(null); }
  };

  const saveToken = async () => {
    if (!canUpdate) { toast.error("คุณไม่มีสิทธิ์แก้ไข System settings"); return; }
    setSavingSection("token");
    try {
      const res = await put<SecuritySettingsResponse>("/system-setting/security", token);
      const next = splitData(res.data.data).token;
      setToken(next); setSavedToken(next);
      toast.success("Token & Session settings updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update Token & Session settings");
    } finally { setSavingSection(null); }
  };

  const saveLockout = async () => {
    if (!canUpdate) { toast.error("คุณไม่มีสิทธิ์แก้ไข System settings"); return; }
    setSavingSection("lockout");
    try {
      const res = await put<SecuritySettingsResponse>("/system-setting/security", lockout);
      const next = splitData(res.data.data).lockout;
      setLockout(next); setSavedLockout(next);
      toast.success("Login Lockout settings updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update Login Lockout settings");
    } finally { setSavingSection(null); }
  };

  const savePassword = async () => {
    if (!canUpdate) { toast.error("คุณไม่มีสิทธิ์แก้ไข System settings"); return; }
    if (password.passwordMinLength < 6) { toast.error("Password minimum length should be at least 6"); return; }
    setSavingSection("password");
    try {
      const res = await put<SecuritySettingsResponse>("/system-setting/security", password);
      const next = splitData(res.data.data).password;
      setPassword(next); setSavedPassword(next);
      toast.success("Password Policy updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update Password Policy");
    } finally { setSavingSection(null); }
  };

  const saveSessionSec = async () => {
    if (!canUpdate) { toast.error("คุณไม่มีสิทธิ์แก้ไข System settings"); return; }
    setSavingSection("session");
    try {
      const res = await put<SecuritySettingsResponse>("/system-setting/security", sessionSec);
      const next = splitData(res.data.data).sessionSecurity;
      setSessionSec(next); setSavedSessionSec(next);
      toast.success("Session Security updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update Session Security settings");
    } finally { setSavingSection(null); }
  };

  const addIp = async () => {
    const ip = newIp.trim();
    if (!ip) { toast.error("กรุณากรอก IP address"); return; }
    setIpAdding(true);
    try {
      const res = await post<{ success: boolean; data: IpEntry }>("/system-setting/ip-blocklist", {
        ipAddress: ip,
        reason: newIpReason.trim() || undefined,
      });
      setIpList((prev) => [res.data.data, ...prev]);
      setNewIp("");
      setNewIpReason("");
      toast.success(`Blocked ${ip}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add IP");
    } finally { setIpAdding(false); }
  };

  const removeIp = async (id: number) => {
    setRemovingId(id);
    try {
      await del(`/system-setting/ip-blocklist/${id}`);
      setIpList((prev) => prev.filter((e) => e.id !== id));
      toast.success("Removed from blocklist");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove IP");
    } finally { setRemovingId(null); }
  };

  const addOrigin = () => {
    const origin = newOrigin.trim();
    if (!origin) return;
    if (cors.origins.includes(origin)) { toast.error("Origin นี้มีอยู่แล้ว"); return; }
    setCors((prev) => ({ origins: [...prev.origins, origin] }));
    setNewOrigin("");
  };

  const removeOrigin = (index: number) =>
    setCors((prev) => ({ origins: prev.origins.filter((_, i) => i !== index) }));

  const saveCors = async () => {
    if (!canUpdate) { toast.error("คุณไม่มีสิทธิ์แก้ไข System settings"); return; }
    setSavingSection("cors");
    try {
      const res = await put<CorsResponse>("/system-setting/cors", { origins: cors.origins });
      const form: CorsForm = { origins: res.data.data.origins };
      setCors(form);
      setSavedCors(form);
      toast.success("CORS allowed origins updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update CORS settings");
    } finally { setSavingSection(null); }
  };

  return (
    <section className="grid gap-5">
      {/* Header */}
      <div className={card}>
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-light-primary text-white shadow-sm dark:bg-dark-primary dark:text-dark-background">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">System Setting</p>
            <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">Security</h1>
            <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
              ตั้งค่า JWT, session, login policy, password policy และ IP blocklist
            </p>
            {!canUpdate && (
              <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-300">
                คุณมีสิทธิ์ดูเท่านั้น ต้องมี settings.update เพื่อแก้ไข
              </p>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid min-h-48 place-items-center rounded-lg border border-theme bg-light-background-card dark:bg-dark-background-card">
          <RefreshCw className="h-6 w-6 animate-spin text-light-text-muted dark:text-dark-text-muted" />
        </div>
      ) : (
        <>
          {/* JWT */}
          <article className={card}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-300">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className={sectionTitle}>JWT</h2>
                  <p className={hint}>ค่าลงนาม token อ่านจากฐานข้อมูลและเปลี่ยน runtime ได้</p>
                </div>
              </div>
              {canUpdate && (
                <SectionActions isDirty={jwtDirty} isSaving={savingSection === "jwt"}
                  onReset={() => setJwt(savedJwt)} onSave={() => void saveJwt()} />
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={label}>JWT secret</label>
                <input className={input} type="password" value={jwt.jwtSecret ?? ""}
                  onChange={(e) => setJwtField("jwtSecret", e.target.value)}
                  placeholder={jwt.hasJwtSecret ? "ใช้ secret เดิม ถ้าไม่กรอก" : "change-this-jwt-secret"}
                  disabled={!canUpdate} />
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">เปลี่ยน secret แล้ว token เก่าจะใช้ไม่ได้ทันที</p>
              </div>
              <div>
                <label className={label}>JWT JTI override</label>
                <input className={input} value={jwt.jwtJit} onChange={(e) => setJwtField("jwtJit", e.target.value)} disabled={!canUpdate} placeholder="ปล่อยว่างเพื่อสุ่มอัตโนมัติ" />
              </div>
              <div>
                <label className={label}>Issuer</label>
                <input className={input} value={jwt.jwtIssuer} onChange={(e) => setJwtField("jwtIssuer", e.target.value)} disabled={!canUpdate} />
              </div>
              <div>
                <label className={label}>Audience</label>
                <input className={input} value={jwt.jwtAudience} onChange={(e) => setJwtField("jwtAudience", e.target.value)} disabled={!canUpdate} />
              </div>
            </div>
          </article>

          {/* Token & Session */}
          <article className={card}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                  <TimerReset className="h-5 w-5" />
                </div>
                <div>
                  <h2 className={sectionTitle}>Token & Session</h2>
                  <p className={hint}>อายุ token และจำนวน session สูงสุดต่อ user</p>
                </div>
              </div>
              {canUpdate && (
                <SectionActions isDirty={tokenDirty} isSaving={savingSection === "token"}
                  onReset={() => setToken(savedToken)} onSave={() => void saveToken()} />
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className={label}>Access token (minutes)</label>
                <input className={input} type="number" min={1} value={token.accessTokenExpiryMinutes} onChange={(e) => setTokenNumber("accessTokenExpiryMinutes", e.target.value)} disabled={!canUpdate} />
              </div>
              <div>
                <label className={label}>Refresh token (minutes)</label>
                <input className={input} type="number" min={1} value={token.refreshTokenExpiryMinutes} onChange={(e) => setTokenNumber("refreshTokenExpiryMinutes", e.target.value)} disabled={!canUpdate} />
              </div>
              <div>
                <label className={label}>Session expiry (minutes)</label>
                <input className={input} type="number" min={1} value={token.sessionExpiryMinutes} onChange={(e) => setTokenNumber("sessionExpiryMinutes", e.target.value)} disabled={!canUpdate} />
              </div>
              <div>
                <label className={label}>Max active sessions</label>
                <input className={input} type="number" min={1} value={token.maxActiveSessions} onChange={(e) => setTokenNumber("maxActiveSessions", e.target.value)} disabled={!canUpdate} />
              </div>
            </div>
          </article>

          {/* Login Lockout */}
          <article className={card}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-300">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <div>
                  <h2 className={sectionTitle}>Login Lockout</h2>
                  <p className={hint}>ควบคุมการล็อกบัญชีเมื่อ login ผิดหลายครั้ง</p>
                </div>
              </div>
              {canUpdate && (
                <SectionActions isDirty={lockoutDirty} isSaving={savingSection === "lockout"}
                  onReset={() => setLockout(savedLockout)} onSave={() => void saveLockout()} />
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={label}>Max login attempts</label>
                <input className={input} type="number" min={1} value={lockout.maxLoginAttempts} onChange={(e) => setLockoutNumber("maxLoginAttempts", e.target.value)} disabled={!canUpdate} />
              </div>
              <div>
                <label className={label}>Account lock (minutes)</label>
                <input className={input} type="number" min={1} value={lockout.accountLockMinutes} onChange={(e) => setLockoutNumber("accountLockMinutes", e.target.value)} disabled={!canUpdate} />
              </div>
              <div>
                <label className={label}>Password reset link (minutes)</label>
                <input className={input} type="number" min={1} value={lockout.passwordResetExpiryMinutes} onChange={(e) => setLockoutNumber("passwordResetExpiryMinutes", e.target.value)} disabled={!canUpdate} />
              </div>
            </div>
          </article>

          {/* Session Security (new) */}
          <article className={card}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h2 className={sectionTitle}>Session Security</h2>
                  <p className={hint}>Idle timeout, single session และ account inactivity</p>
                </div>
              </div>
              {canUpdate && (
                <SectionActions isDirty={sessionDirty} isSaving={savingSection === "session"}
                  onReset={() => setSessionSec(savedSessionSec)} onSave={() => void saveSessionSec()} />
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={label}>Idle timeout (minutes) — 0 = ปิดใช้งาน</label>
                <input className={input} type="number" min={0} value={sessionSec.idleTimeoutMinutes}
                  onChange={(e) => setSessionNumber("idleTimeoutMinutes", e.target.value)} disabled={!canUpdate} />
                <p className="mt-1 text-xs text-light-text-muted dark:text-dark-text-muted">
                  Auto logout เมื่อ user ไม่มี activity ตามเวลาที่กำหนด
                </p>
              </div>
              <div>
                <label className={label}>Account inactivity (days) — 0 = ปิดใช้งาน</label>
                <input className={input} type="number" min={0} value={sessionSec.accountInactivityDays}
                  onChange={(e) => setSessionNumber("accountInactivityDays", e.target.value)} disabled={!canUpdate} />
                <p className="mt-1 text-xs text-light-text-muted dark:text-dark-text-muted">
                  Cron job disable account ที่ไม่ได้ login นาน X วัน (SUPERADMIN ไม่ถูกกระทบ)
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-md border border-theme bg-light-background px-3 py-2.5 dark:bg-dark-background">
              <div>
                <span className="text-sm font-medium text-light-text dark:text-dark-text">Force single session</span>
                <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                  Login ใหม่จะ logout ทุก session เก่าทันที (แทนที่จะเลือก session เก่าสุดออก)
                </p>
              </div>
              <Toggle
                checked={sessionSec.forceSingleSession}
                onChange={() => setSessionField("forceSingleSession", !sessionSec.forceSingleSession)}
                disabled={!canUpdate}
              />
            </div>
          </article>

          {/* Password Policy */}
          <article className={card}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className={sectionTitle}>Password Policy</h2>
                  <p className={hint}>กฎรหัสผ่านสำหรับ user ใหม่และการเปลี่ยนรหัสผ่าน</p>
                </div>
              </div>
              {canUpdate && (
                <SectionActions isDirty={passwordDirty} isSaving={savingSection === "password"}
                  onReset={() => setPassword(savedPassword)} onSave={() => void savePassword()} />
              )}
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={label}>Minimum length</label>
                  <input className={input} type="number" min={6} value={password.passwordMinLength} onChange={(e) => setPasswordNumber("passwordMinLength", e.target.value)} disabled={!canUpdate} />
                </div>
                <div>
                  <label className={label}>Password expiry (days)</label>
                  <input className={input} type="number" min={1} value={password.passwordExpiryDays} onChange={(e) => setPasswordNumber("passwordExpiryDays", e.target.value)} disabled={!canUpdate} />
                </div>
                <div className="md:col-span-2">
                  <label className={label}>Password history — 0 = ปิดใช้งาน</label>
                  <input className={input} type="number" min={0} value={password.passwordHistoryCount}
                    onChange={(e) => setPasswordNumber("passwordHistoryCount", e.target.value)} disabled={!canUpdate} />
                  <p className="mt-1 text-xs text-light-text-muted dark:text-dark-text-muted">
                    ห้ามใช้รหัสผ่านซ้ำกับ N รหัสล่าสุด
                  </p>
                </div>
              </div>
              <div className="grid gap-2">
                {([
                  ["passwordRequireLowercase", "Require lowercase letter"],
                  ["passwordRequireUppercase", "Require uppercase letter"],
                  ["passwordRequireNumber", "Require number"],
                  ["passwordRequireSpecial", "Require special character"],
                ] as const).map(([key, text]) => (
                  <div key={key} className="flex items-center justify-between rounded-md border border-theme bg-light-background px-3 py-2.5 dark:bg-dark-background">
                    <span className="text-sm font-medium text-light-text dark:text-dark-text">{text}</span>
                    <Toggle
                      checked={password[key]}
                      onChange={() => setPasswordField(key, !password[key])}
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

          {/* IP Blocklist */}
          <article className={card}>
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h2 className={sectionTitle}>IP Blocklist</h2>
                <p className={hint}>บล็อก IP ที่ไม่ต้องการให้เข้าถึง API ทั้งหมด (cache 60 วินาที)</p>
              </div>
            </div>

            {canUpdate && (
              <div className="mb-5 grid gap-3 rounded-md border border-theme bg-light-background p-4 dark:bg-dark-background md:grid-cols-[1fr_1fr_auto]">
                <div>
                  <label className={label}>IP Address</label>
                  <input
                    className={input}
                    value={newIp}
                    onChange={(e) => setNewIp(e.target.value)}
                    placeholder="192.168.1.100"
                    onKeyDown={(e) => e.key === "Enter" && void addIp()}
                  />
                </div>
                <div>
                  <label className={label}>Reason (optional)</label>
                  <input
                    className={input}
                    value={newIpReason}
                    onChange={(e) => setNewIpReason(e.target.value)}
                    placeholder="เช่น spam, brute-force"
                    onKeyDown={(e) => e.key === "Enter" && void addIp()}
                  />
                </div>
                <div className="flex items-end">
                  <button type="button" onClick={() => void addIp()} disabled={ipAdding || !newIp.trim()} className={btnPrimary}>
                    {ipAdding ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Block IP
                  </button>
                </div>
              </div>
            )}

            {ipLoading ? (
              <div className="grid min-h-20 place-items-center">
                <RefreshCw className="h-5 w-5 animate-spin text-light-text-muted dark:text-dark-text-muted" />
              </div>
            ) : ipList.length === 0 ? (
              <p className="py-4 text-center text-sm text-light-text-muted dark:text-dark-text-muted">
                ยังไม่มี IP ในรายการ
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-theme text-left text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">
                      <th className="pb-2 pr-4">IP Address</th>
                      <th className="pb-2 pr-4">Reason</th>
                      <th className="pb-2 pr-4">เพิ่มเมื่อ</th>
                      {canUpdate && <th className="pb-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {ipList.map((entry) => (
                      <tr key={entry.id} className="border-b border-theme/50 last:border-0">
                        <td className="py-2.5 pr-4 font-mono text-sm text-light-text dark:text-dark-text">{entry.ipAddress}</td>
                        <td className="py-2.5 pr-4 text-light-text-muted dark:text-dark-text-muted">{entry.reason || "—"}</td>
                        <td className="py-2.5 pr-4 text-light-text-muted dark:text-dark-text-muted">
                          {formatDateTime(entry.createdAt)}
                        </td>
                        {canUpdate && (
                          <td className="py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => void removeIp(entry.id)}
                              disabled={removingId === entry.id}
                              className={btnDanger}
                            >
                              {removingId === entry.id
                                ? <RefreshCw className="h-3 w-3 animate-spin" />
                                : <Trash2 className="h-3 w-3" />}
                              ลบ
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          {/* CORS Allowed Origins */}
          <article className={card}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-300">
                  <Network className="h-5 w-5" />
                </div>
                <div>
                  <h2 className={sectionTitle}>CORS Allowed Origins</h2>
                  <p className={hint}>Origin ที่อนุญาตให้เรียก API จาก browser (cache 60 วินาที)</p>
                </div>
              </div>
              {canUpdate && (
                <SectionActions isDirty={corsDirty} isSaving={savingSection === "cors"}
                  onReset={() => setCors(savedCors)} onSave={() => void saveCors()} />
              )}
            </div>

            {corsLoading ? (
              <div className="grid min-h-20 place-items-center">
                <RefreshCw className="h-5 w-5 animate-spin text-light-text-muted dark:text-dark-text-muted" />
              </div>
            ) : (
              <>
                {canUpdate && (
                  <div className="mb-4 flex gap-3">
                    <input
                      className={input}
                      value={newOrigin}
                      onChange={(e) => setNewOrigin(e.target.value)}
                      placeholder="https://example.com"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOrigin())}
                    />
                    <button
                      type="button"
                      onClick={addOrigin}
                      disabled={!newOrigin.trim()}
                      className={btnSecondary}
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  </div>
                )}

                {cors.origins.length === 0 ? (
                  <p className="py-4 text-center text-sm text-light-text-muted dark:text-dark-text-muted">
                    ยังไม่มี origin ที่อนุญาต
                  </p>
                ) : (
                  <ul className="divide-y divide-theme">
                    {cors.origins.map((origin, i) => (
                      <li key={i} className="flex items-center justify-between py-2.5">
                        <span className="font-mono text-sm text-light-text dark:text-dark-text">{origin}</span>
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => removeOrigin(i)}
                            className={btnDanger}
                          >
                            <Trash2 className="h-3 w-3" />
                            ลบ
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </article>
        </>
      )}
    </section>
  );
};

export default SecuritySettingPage;
