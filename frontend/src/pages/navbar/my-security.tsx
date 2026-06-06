import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
  BellRing,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  QrCode,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  X,
  XCircle,
} from "lucide-react";
import type { AxiosError } from "axios";
import { toast } from "react-toastify";
import { useSession } from "@/contexts/SessionContext";
import { useApi } from "@/hooks/useApi";
import { useRegional } from "@/contexts/RegionalContext";
import NotificationSettingsPanel from "@/pages/navbar/components/NotificationSettingsPanel";

const cardClass = "rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card";
const inputClass =
  "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text outline-none transition placeholder:text-light-text-muted focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder:text-dark-text-muted dark:focus:ring-dark-primary";
const labelClass = "mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted";
const primaryButtonClass =
  "inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:cursor-not-allowed disabled:opacity-50 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover";
const secondaryButtonClass =
  "inline-flex items-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary";

type SecurityTab = "password" | "two-factor" | "email" | "notifications";

const securityTabs: Array<{ id: SecurityTab; label: string; icon: typeof LockKeyhole }> = [
  { id: "password", label: "รหัสผ่าน", icon: LockKeyhole },
  { id: "two-factor", label: "2FA", icon: Smartphone },
  { id: "email", label: "อีเมล", icon: Mail },
  { id: "notifications", label: "การแจ้งเตือน", icon: BellRing },
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
type PasswordHistoryItem = {
  id: number;
  changedAt: string;
  reason: string | null;
  ipAddress: string | null;
  changedByUserId: number | null;
  changedByUsername: string | null;
};
type PasswordHistoryResponse = {
  success: boolean;
  data: {
    lastChangedAt: string | null;
    items: PasswordHistoryItem[];
  };
};
type PasswordField = "currentPassword" | "newPassword" | "confirmPassword";
type EmailChallengeType = "PRIMARY_VERIFY" | "PRIMARY_CHANGE" | "RECOVERY_VERIFY" | "RECOVERY_CHANGE";
type EmailSettings = {
  primaryEmail: string;
  primaryVerified: boolean;
  primaryVerifiedAt: string | null;
  recoveryEmail: string;
  recoveryVerified: boolean;
  recoveryVerifiedAt: string | null;
};
type EmailSettingsResponse = { success: boolean; message?: string; data: EmailSettings };
type TfaStatus = {
  isEnabled: boolean;
  method: string | null;
  lastVerifiedAt: string | null;
  backupCodesRemaining: number;
};
type TfaSetupInfo = {
  qrCodeDataUrl: string;
  manualKey: string;
  issuer: string;
  label: string;
};

const MySecurityPage = () => {
  const { user, updateUser } = useSession();
  const { get, post, put } = useApi();
  const { formatDateTime } = useRegional();
  const [searchParams, setSearchParams] = useSearchParams();
  const [visiblePasswords, setVisiblePasswords] = useState<Record<PasswordField, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [isPolicyLoading, setIsPolicyLoading] = useState(true);
  const [isPasswordHistoryLoading, setIsPasswordHistoryLoading] = useState(true);
  const [passwordHistory, setPasswordHistory] = useState<PasswordHistoryResponse["data"]>({
    lastChangedAt: null,
    items: [],
  });
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
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    primaryEmail: user?.email ?? "",
    primaryVerified: false,
    primaryVerifiedAt: null,
    recoveryEmail: "",
    recoveryVerified: false,
    recoveryVerifiedAt: null,
  });
  const [modalEmail, setModalEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [pendingEmailType, setPendingEmailType] = useState<EmailChallengeType | null>(null);
  const [emailBusyType, setEmailBusyType] = useState<EmailChallengeType | null>(null);
  const [isEmailLoading, setIsEmailLoading] = useState(true);
  const [tfaStatus, setTfaStatus] = useState<TfaStatus | null>(null);
  const [isTfaLoading, setIsTfaLoading] = useState(true);
  const [tfaSetupInfo, setTfaSetupInfo] = useState<TfaSetupInfo | null>(null);
  const [tfaBackupCodes, setTfaBackupCodes] = useState<string[] | null>(null);
  const [tfaOtpInput, setTfaOtpInput] = useState("");
  const [tfaShowCodes, setTfaShowCodes] = useState(false);
  const [tfaCodesAcknowledged, setTfaCodesAcknowledged] = useState(false);
  const [tfaCopied, setTfaCopied] = useState(false);
  const [isTfaBusy, setIsTfaBusy] = useState(false);
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
        const response = await get<PasswordPolicyResponse>("/auth/password-policy", { skipAuthRefresh: true });
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

  const loadPasswordHistory = async () => {
    setIsPasswordHistoryLoading(true);
    try {
      const response = await get<PasswordHistoryResponse>("/account-security/password-history");
      setPasswordHistory(response.data.data);
    } catch {
      toast.error("ไม่สามารถโหลดประวัติการเปลี่ยนรหัสผ่านได้");
    } finally {
      setIsPasswordHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadPasswordHistory();
  }, []);

  useEffect(() => {
    let active = true;
    const loadEmails = async () => {
      try {
        const response = await get<EmailSettingsResponse>("/account-security/emails");
        if (!active) return;
        setEmailSettings(response.data.data);
      } catch {
        if (active) toast.error("ไม่สามารถโหลดข้อมูลอีเมลได้");
      } finally {
        if (active) setIsEmailLoading(false);
      }
    };
    void loadEmails();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    get<{ success: boolean; data: TfaStatus }>("/account-security/tfa")
      .then((r) => { if (active) setTfaStatus(r.data.data); })
      .catch(() => { if (active) toast.error("ไม่สามารถโหลดสถานะ 2FA ได้"); })
      .finally(() => { if (active) setIsTfaLoading(false); });
    return () => { active = false; };
  }, []);

  const tfaModal = searchParams.get("modal") as "tfa-setup" | "tfa-disable" | "tfa-regen" | null;
  const isTfaModalOpen = tfaModal === "tfa-setup" || tfaModal === "tfa-disable" || tfaModal === "tfa-regen";

  const resetTfaModalState = useCallback(() => {
    setTfaOtpInput("");
    setTfaSetupInfo(null);
    setTfaBackupCodes(null);
    setTfaShowCodes(false);
    setTfaCodesAcknowledged(false);
    setTfaCopied(false);
  }, []);

  const closeTfaModal = useCallback(() => {
    resetTfaModalState();
    setSearchParams((p) => { p.delete("modal"); return p; });
  }, [resetTfaModalState, setSearchParams]);

  const handleOpenSetup = async () => {
    resetTfaModalState();
    setSearchParams((p) => { p.set("modal", "tfa-setup"); return p; });
    setIsTfaBusy(true);
    try {
      const r = await post<{ success: boolean; data: TfaSetupInfo }>("/account-security/tfa/setup", {});
      setTfaSetupInfo(r.data.data);
    } catch (err) {
      const e = err as import("axios").AxiosError<{ message?: string }>;
      toast.error(e.response?.data?.message ?? "ไม่สามารถเริ่มต้นตั้งค่า 2FA ได้");
      setSearchParams((p) => { p.delete("modal"); return p; });
    } finally {
      setIsTfaBusy(false);
    }
  };

  const handleEnableTfa = async () => {
    if (tfaOtpInput.length !== 6 || isTfaBusy) return;
    setIsTfaBusy(true);
    try {
      const r = await post<{ success: boolean; data: { backupCodes: string[] } }>("/account-security/tfa/enable", { code: tfaOtpInput });
      setTfaBackupCodes(r.data.data.backupCodes);
      setTfaShowCodes(true);
      setTfaOtpInput("");
      setTfaStatus({ isEnabled: true, method: "TOTP", lastVerifiedAt: new Date().toISOString(), backupCodesRemaining: 8 });
      toast.success("เปิดใช้งาน 2FA เรียบร้อยแล้ว");
    } catch (err) {
      const e = err as import("axios").AxiosError<{ message?: string }>;
      toast.error(e.response?.data?.message ?? "รหัส OTP ไม่ถูกต้อง");
    } finally {
      setIsTfaBusy(false);
    }
  };

  const handleDisableTfa = async () => {
    if (tfaOtpInput.length !== 6 || isTfaBusy) return;
    setIsTfaBusy(true);
    try {
      await post("/account-security/tfa/disable", { code: tfaOtpInput });
      setTfaStatus({ isEnabled: false, method: null, lastVerifiedAt: null, backupCodesRemaining: 0 });
      toast.success("ปิดใช้งาน 2FA เรียบร้อยแล้ว");
      closeTfaModal();
    } catch (err) {
      const e = err as import("axios").AxiosError<{ message?: string }>;
      toast.error(e.response?.data?.message ?? "รหัส OTP ไม่ถูกต้อง");
    } finally {
      setIsTfaBusy(false);
    }
  };

  const handleRegenBackupCodes = async () => {
    if (tfaOtpInput.length !== 6 || isTfaBusy) return;
    setIsTfaBusy(true);
    try {
      const r = await post<{ success: boolean; data: { backupCodes: string[] } }>("/account-security/tfa/backup-codes/regenerate", { code: tfaOtpInput });
      setTfaBackupCodes(r.data.data.backupCodes);
      setTfaShowCodes(true);
      setTfaOtpInput("");
      if (tfaStatus) setTfaStatus({ ...tfaStatus, backupCodesRemaining: 8 });
      toast.success("สร้าง Backup Codes ใหม่เรียบร้อยแล้ว");
    } catch (err) {
      const e = err as import("axios").AxiosError<{ message?: string }>;
      toast.error(e.response?.data?.message ?? "รหัส OTP ไม่ถูกต้อง");
    } finally {
      setIsTfaBusy(false);
    }
  };

  const copyBackupCodes = async () => {
    if (!tfaBackupCodes) return;
    await navigator.clipboard.writeText(tfaBackupCodes.join("\n"));
    setTfaCopied(true);
    setTimeout(() => setTfaCopied(false), 2000);
  };

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
      if (user) {
        updateUser({
          ...user,
          security: {
            ...user.security,
            mustChangePassword: false,
            passwordExpiry: false,
          },
        });
      }
      await loadPasswordHistory();
      toast.success(response.data.message ?? "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว");
    } catch (error) {
      const apiError = error as AxiosError<{ message?: string }>;
      toast.error(apiError.response?.data?.message ?? "ไม่สามารถเปลี่ยนรหัสผ่านได้");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const apiErrorMessage = (error: unknown, fallback: string) => {
    const apiError = error as AxiosError<{ message?: string }>;
    return apiError.response?.data?.message ?? fallback;
  };

  const emailModalType = searchParams.get("emailAction") as EmailChallengeType | null;
  const emailModalOpen = searchParams.get("modal") === "email-verification"
    && ["PRIMARY_VERIFY", "PRIMARY_CHANGE", "RECOVERY_VERIFY", "RECOVERY_CHANGE"].includes(emailModalType ?? "");
  const modalNeedsNewEmail = emailModalType === "PRIMARY_CHANGE" || emailModalType === "RECOVERY_CHANGE";
  const modalTitle = emailModalType === "PRIMARY_VERIFY"
    ? "ยืนยันอีเมลหลัก"
    : emailModalType === "PRIMARY_CHANGE"
      ? "เปลี่ยนอีเมลหลัก"
      : emailModalType === "RECOVERY_VERIFY"
        ? "ยืนยันอีเมลสำรอง"
        : "เพิ่มหรือเปลี่ยนอีเมลสำรอง";
  const modalTargetEmail = modalNeedsNewEmail
    ? modalEmail
    : emailModalType === "PRIMARY_VERIFY"
      ? emailSettings.primaryEmail
      : emailSettings.recoveryEmail;

  const openEmailModal = (type: EmailChallengeType) => {
    setPendingEmailType(null);
    setOtpDigits(["", "", "", "", "", ""]);
    setModalEmail("");
    setSearchParams((params) => {
      params.set("tab", "email");
      params.set("modal", "email-verification");
      params.set("emailAction", type);
      return params;
    });
  };

  const closeEmailModal = () => {
    setPendingEmailType(null);
    setOtpDigits(["", "", "", "", "", ""]);
    setModalEmail("");
    setSearchParams((params) => {
      params.delete("modal");
      params.delete("emailAction");
      return params;
    });
  };

  const sendEmailCode = async (type: EmailChallengeType) => {
    const email = type === "PRIMARY_CHANGE" || type === "RECOVERY_CHANGE" ? modalEmail : undefined;
    setEmailBusyType(type);
    try {
      const response = await post<{ success: boolean; message?: string }>("/account-security/emails/send-code", { type, email });
      setPendingEmailType(type);
      setOtpDigits(["", "", "", "", "", ""]);
      toast.success(response.data.message ?? "ส่งรหัสยืนยันแล้ว");
    } catch (error) {
      toast.error(apiErrorMessage(error, "ไม่สามารถส่งรหัสยืนยันได้"));
    } finally {
      setEmailBusyType(null);
    }
  };

  const verifyEmailCode = async (type: EmailChallengeType) => {
    setEmailBusyType(type);
    try {
      const response = await post<EmailSettingsResponse>("/account-security/emails/verify-code", {
        type,
        code: otpDigits.join(""),
      });
      setEmailSettings(response.data.data);
      if ((type === "PRIMARY_VERIFY" || type === "PRIMARY_CHANGE") && user) {
        updateUser({
          ...user,
          email: response.data.data.primaryEmail,
          isEmailVerified: response.data.data.primaryVerified,
        });
      }
      toast.success(response.data.message ?? "ยืนยันอีเมลเรียบร้อยแล้ว");
      closeEmailModal();
    } catch (error) {
      toast.error(apiErrorMessage(error, "รหัสยืนยันไม่ถูกต้อง"));
    } finally {
      setEmailBusyType(null);
    }
  };

  const setOtpDigit = (index: number, value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) {
      setOtpDigits((current) => current.map((digit, position) => position === index ? "" : digit));
      return;
    }
    setOtpDigits((current) => {
      const next = [...current];
      digits.slice(0, 6 - index).split("").forEach((digit, offset) => {
        next[index + offset] = digit;
      });
      return next;
    });
    otpRefs.current[Math.min(index + digits.length, 5)]?.focus();
  };

  const handleOtpKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
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
        <div className="grid gap-5">
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

        <article className={cardClass}>
          <div className="mb-5 flex items-center gap-3 border-b border-theme pb-4">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-light-text dark:text-dark-text">ประวัติการเปลี่ยนรหัสผ่าน</h2>
              <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                เปลี่ยนล่าสุด {passwordHistory.lastChangedAt ? formatDateTime(passwordHistory.lastChangedAt) : "ยังไม่มีข้อมูล"}
              </p>
            </div>
          </div>

          {isPasswordHistoryLoading ? (
            <div className="grid min-h-24 place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-light-text-muted dark:text-dark-text-muted" />
            </div>
          ) : passwordHistory.items.length === 0 ? (
            <div className="rounded-md border border-dashed border-theme px-4 py-8 text-center text-sm text-light-text-muted dark:text-dark-text-muted">
              ยังไม่มีประวัติการเปลี่ยนรหัสผ่าน
            </div>
          ) : (
            <div className="divide-y divide-theme">
              {passwordHistory.items.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-semibold text-light-text dark:text-dark-text">
                      {item.reason === "SELF_CHANGE" ? "เปลี่ยนรหัสผ่านด้วยตัวเอง" : item.reason || "เปลี่ยนรหัสผ่าน"}
                    </p>
                    <p className="mt-1 text-xs text-light-text-muted dark:text-dark-text-muted">
                      {item.changedByUsername ? `ดำเนินการโดย ${item.changedByUsername}` : "ดำเนินการโดยระบบ"}
                      {item.ipAddress ? ` · IP ${item.ipAddress}` : ""}
                    </p>
                  </div>
                  <time className="text-xs font-medium text-light-text-muted dark:text-dark-text-muted">
                    {formatDateTime(item.changedAt)}
                  </time>
                </div>
              ))}
            </div>
          )}
        </article>
        </div>
      )}

      {activeTab === "two-factor" && (
        <article className={cardClass}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`grid h-10 w-10 place-items-center rounded-lg ${tfaStatus?.isEnabled ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}>
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-light-text dark:text-dark-text">Two-Factor Authentication (2FA)</h2>
                <p className="text-xs text-light-text-muted dark:text-dark-text-muted">เพิ่มความปลอดภัยด้วยการยืนยันตัวตนสองชั้น</p>
              </div>
            </div>
            {!isTfaLoading && (
              <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                tfaStatus?.isEnabled
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              }`}>
                {tfaStatus?.isEnabled ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {tfaStatus?.isEnabled ? "เปิดใช้งานแล้ว" : "ยังไม่เปิดใช้งาน"}
              </span>
            )}
          </div>

          {isTfaLoading ? (
            <div className="grid min-h-24 place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-light-text-muted dark:text-dark-text-muted" />
            </div>
          ) : tfaStatus?.isEnabled ? (
            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-md border border-theme bg-light-background p-4 dark:bg-dark-background">
                <div className="flex items-center gap-3">
                  <QrCode className="h-5 w-5 shrink-0 text-emerald-500" />
                  <div>
                    <p className="text-sm font-semibold text-light-text dark:text-dark-text">Authenticator App (TOTP)</p>
                    <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">
                      {tfaStatus.lastVerifiedAt ? `ยืนยันล่าสุด ${formatDateTime(tfaStatus.lastVerifiedAt)}` : "ใช้งานอยู่"}
                    </p>
                  </div>
                </div>
                <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">เปิดใช้งาน</span>
              </div>

              <div className="flex items-center justify-between rounded-md border border-theme bg-light-background p-4 dark:bg-dark-background">
                <div>
                  <p className="text-sm font-semibold text-light-text dark:text-dark-text">Backup Codes</p>
                  <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">
                    เหลือ {tfaStatus.backupCodesRemaining} จาก 8 รหัสสำรอง
                  </p>
                </div>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => {
                    resetTfaModalState();
                    setSearchParams((p) => { p.set("modal", "tfa-regen"); return p; });
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  สร้างใหม่
                </button>
              </div>

              <div className="mt-1 flex items-center gap-2 border-t border-theme pt-4">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
                  onClick={() => {
                    resetTfaModalState();
                    setSearchParams((p) => { p.set("modal", "tfa-disable"); return p; });
                  }}
                >
                  <ShieldOff className="h-4 w-4" />
                  ปิดใช้งาน 2FA
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <p className="text-sm leading-relaxed text-light-text-muted dark:text-dark-text-muted">
                ทุกครั้งที่เข้าสู่ระบบ คุณจะต้องกรอกรหัส 6 หลักจาก Authenticator App ควบคู่กับรหัสผ่าน ทำให้บัญชีปลอดภัยมากขึ้นแม้รหัสผ่านจะถูกขโมย
              </p>
              <ol className="grid gap-1.5 rounded-md border border-theme bg-light-background p-4 dark:bg-dark-background">
                {[
                  "ดาวน์โหลด Google Authenticator, Authy หรือแอปที่รองรับ TOTP",
                  "กด \"ตั้งค่า 2FA\" แล้วสแกน QR Code ด้วยแอป",
                  "กรอกรหัส 6 หลักเพื่อยืนยันการตั้งค่า",
                  "บันทึก Backup Codes ไว้ในที่ปลอดภัยสำหรับกรณีฉุกเฉิน",
                ].map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-light-text-muted dark:text-dark-text-muted">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-light-primary/10 text-xs font-bold text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              <div>
                <button type="button" className={primaryButtonClass} onClick={() => void handleOpenSetup()}>
                  <Smartphone className="h-4 w-4" />
                  ตั้งค่า 2FA
                </button>
              </div>
            </div>
          )}
        </article>
      )}

      {activeTab === "email" && (
        <div className="grid gap-5">
          <article className={cardClass}>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-light-text dark:text-dark-text">อีเมลหลัก</h2>
                  <p className="text-xs text-light-text-muted dark:text-dark-text-muted">ใช้เข้าสู่ระบบและรับการแจ้งเตือนสำคัญ</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                emailSettings.primaryVerified
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              }`}>
                {emailSettings.primaryVerified ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {emailSettings.primaryVerified ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน"}
              </span>
            </div>

            {isEmailLoading ? (
              <div className="grid min-h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-light-text-muted dark:text-dark-text-muted" /></div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-theme bg-light-background p-4 dark:bg-dark-background">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-light-text dark:text-dark-text">{emailSettings.primaryEmail}</p>
                    <p className="mt-1 text-xs text-light-text-muted dark:text-dark-text-muted">
                      {emailSettings.primaryVerifiedAt ? `ยืนยันเมื่อ ${formatDateTime(emailSettings.primaryVerifiedAt)}` : "ยังไม่มีวันที่ยืนยัน"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!emailSettings.primaryVerified ? (
                      <button type="button" className={secondaryButtonClass} disabled={emailBusyType === "PRIMARY_VERIFY"}
                        onClick={() => openEmailModal("PRIMARY_VERIFY")}>
                        <CheckCircle2 className="h-4 w-4" />
                        ยืนยันอีเมล
                      </button>
                    ) : (
                      <button type="button" className={primaryButtonClass} onClick={() => openEmailModal("PRIMARY_CHANGE")}>
                        <Mail className="h-4 w-4" />
                        เปลี่ยนอีเมล
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </article>

          <article className={cardClass}>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-light-text dark:text-dark-text">อีเมลสำรอง</h2>
                  <p className="text-xs text-light-text-muted dark:text-dark-text-muted">ใช้กู้คืนบัญชีเมื่อไม่สามารถเข้าถึงอีเมลหลักได้</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                emailSettings.recoveryVerified
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-light-text-muted/10 text-light-text-muted dark:text-dark-text-muted"
              }`}>
                {emailSettings.recoveryVerified ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {emailSettings.recoveryVerified ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน"}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-theme bg-light-background p-4 dark:bg-dark-background">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-light-text dark:text-dark-text">
                  {emailSettings.recoveryEmail || "ยังไม่ได้เพิ่มอีเมลสำรอง"}
                </p>
                <p className="mt-1 text-xs text-light-text-muted dark:text-dark-text-muted">
                  {emailSettings.recoveryVerifiedAt ? `ยืนยันเมื่อ ${formatDateTime(emailSettings.recoveryVerifiedAt)}` : "ยังไม่มีวันที่ยืนยัน"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {emailSettings.recoveryEmail && !emailSettings.recoveryVerified ? (
                  <button type="button" className={secondaryButtonClass} onClick={() => openEmailModal("RECOVERY_VERIFY")}>
                    <CheckCircle2 className="h-4 w-4" />
                    ยืนยันอีเมล
                  </button>
                ) : (
                  <button type="button" className={primaryButtonClass} onClick={() => openEmailModal("RECOVERY_CHANGE")}>
                    <Mail className="h-4 w-4" />
                    {emailSettings.recoveryEmail ? "เปลี่ยนอีเมล" : "เพิ่มอีเมลสำรอง"}
                  </button>
                )}
              </div>
            </div>
          </article>
        </div>
      )}

      {activeTab === "notifications" && (
        <NotificationSettingsPanel />
      )}


      {isTfaModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4" onMouseDown={closeTfaModal}>
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-lg border border-theme bg-light-background-card shadow-2xl dark:bg-dark-background-card"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-theme p-5">
              <div className="flex items-center gap-3">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                  tfaModal === "tfa-disable"
                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                    : "bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary"
                }`}>
                  {tfaModal === "tfa-disable" ? <ShieldOff className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                </div>
                <div>
                  <h2 className="font-semibold text-light-text dark:text-dark-text">
                    {tfaModal === "tfa-setup" ? "ตั้งค่า Two-Factor Authentication"
                      : tfaModal === "tfa-disable" ? "ปิดใช้งาน 2FA"
                      : "สร้าง Backup Codes ใหม่"}
                  </h2>
                  <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">
                    {tfaModal === "tfa-setup" && !tfaShowCodes && "สแกน QR Code ด้วยแอป Authenticator แล้วกรอกรหัสยืนยัน"}
                    {tfaModal === "tfa-setup" && tfaShowCodes && "บันทึก Backup Codes เหล่านี้ไว้ในที่ปลอดภัย"}
                    {tfaModal === "tfa-disable" && "กรอกรหัส OTP จาก Authenticator App เพื่อยืนยัน"}
                    {tfaModal === "tfa-regen" && !tfaShowCodes && "กรอกรหัส OTP เพื่อสร้าง Backup Codes ชุดใหม่"}
                    {tfaModal === "tfa-regen" && tfaShowCodes && "Backup Codes ชุดใหม่ — รหัสเก่าทั้งหมดถูกยกเลิกแล้ว"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                title="ปิด"
                onClick={closeTfaModal}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              {/* Setup modal — QR + OTP step */}
              {tfaModal === "tfa-setup" && !tfaShowCodes && (
                <div className="grid gap-5">
                  {isTfaBusy && !tfaSetupInfo ? (
                    <div className="grid min-h-40 place-items-center">
                      <Loader2 className="h-6 w-6 animate-spin text-light-text-muted dark:text-dark-text-muted" />
                    </div>
                  ) : tfaSetupInfo ? (
                    <>
                      <div className="flex flex-col items-center gap-3">
                        <img
                          src={tfaSetupInfo.qrCodeDataUrl}
                          alt="QR Code สำหรับ 2FA"
                          className="rounded-lg border border-theme bg-white p-2"
                          width={200}
                          height={200}
                        />
                        <div className="w-full rounded-md border border-theme bg-light-background p-3 dark:bg-dark-background">
                          <p className="mb-1 text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">หรือกรอกรหัสด้วยตนเอง</p>
                          <p className="break-all font-mono text-xs font-semibold tracking-wider text-light-text dark:text-dark-text">{tfaSetupInfo.manualKey}</p>
                        </div>
                      </div>

                      <div>
                        <label className={labelClass}>รหัส OTP 6 หลักจากแอป</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          autoComplete="one-time-code"
                          autoFocus
                          value={tfaOtpInput}
                          onChange={(e) => setTfaOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          onKeyDown={(e) => { if (e.key === "Enter") void handleEnableTfa(); }}
                          placeholder="000000"
                          className="w-full rounded-md border border-theme bg-light-background px-3 py-3 text-center font-mono text-2xl font-semibold tracking-widest text-light-text outline-none transition focus:border-light-primary focus:ring-2 focus:ring-light-primary/30 dark:bg-dark-background dark:text-dark-text dark:focus:border-dark-primary dark:focus:ring-dark-primary/30"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={tfaOtpInput.length !== 6 || isTfaBusy}
                        onClick={() => void handleEnableTfa()}
                        className={`${primaryButtonClass} justify-center`}
                      >
                        {isTfaBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        {isTfaBusy ? "กำลังยืนยัน..." : "ยืนยันและเปิดใช้งาน"}
                      </button>
                    </>
                  ) : null}
                </div>
              )}

              {/* Backup codes display (shared: setup after enable, regen after success) */}
              {tfaShowCodes && tfaBackupCodes && (
                <div className="grid gap-4">
                  <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                    บันทึกรหัสเหล่านี้ไว้ในที่ปลอดภัย จะแสดงเพียงครั้งเดียว ใช้แทนรหัส OTP ได้เมื่อไม่มีอุปกรณ์ Authenticator
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {tfaBackupCodes.map((code) => (
                      <div key={code} className="rounded-md border border-theme bg-light-background px-3 py-2 text-center font-mono text-sm font-semibold tracking-widest text-light-text dark:bg-dark-background dark:text-dark-text">
                        {code}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => void copyBackupCodes()}
                    className={`${secondaryButtonClass} justify-center`}
                  >
                    <Copy className="h-4 w-4" />
                    {tfaCopied ? "คัดลอกแล้ว!" : "คัดลอกทั้งหมด"}
                  </button>

                  {tfaModal === "tfa-setup" && (
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-light-text dark:text-dark-text">
                      <input
                        type="checkbox"
                        checked={tfaCodesAcknowledged}
                        onChange={(e) => setTfaCodesAcknowledged(e.target.checked)}
                        className="accent-light-primary dark:accent-dark-primary"
                      />
                      ฉันบันทึก Backup Codes ไว้ในที่ปลอดภัยแล้ว
                    </label>
                  )}

                  <button
                    type="button"
                    disabled={tfaModal === "tfa-setup" && !tfaCodesAcknowledged}
                    onClick={closeTfaModal}
                    className={`${primaryButtonClass} justify-center`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    เสร็จสิ้น
                  </button>
                </div>
              )}

              {/* Disable modal */}
              {tfaModal === "tfa-disable" && (
                <div className="grid gap-4">
                  <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
                    การปิด 2FA จะทำให้บัญชีปลอดภัยน้อยลง กรุณากรอกรหัส OTP เพื่อยืนยัน
                  </p>
                  <div>
                    <label className={labelClass}>รหัส OTP จาก Authenticator App</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoComplete="one-time-code"
                      autoFocus
                      value={tfaOtpInput}
                      onChange={(e) => setTfaOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleDisableTfa(); }}
                      placeholder="000000"
                      className="w-full rounded-md border border-theme bg-light-background px-3 py-3 text-center font-mono text-2xl font-semibold tracking-widest text-light-text outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-400/30 dark:bg-dark-background dark:text-dark-text"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={tfaOtpInput.length !== 6 || isTfaBusy}
                    onClick={() => void handleDisableTfa()}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isTfaBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                    {isTfaBusy ? "กำลังปิดใช้งาน..." : "ยืนยันปิดใช้งาน 2FA"}
                  </button>
                </div>
              )}

              {/* Regen OTP verify step */}
              {tfaModal === "tfa-regen" && !tfaShowCodes && (
                <div className="grid gap-4">
                  <div>
                    <label className={labelClass}>รหัส OTP จาก Authenticator App</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoComplete="one-time-code"
                      autoFocus
                      value={tfaOtpInput}
                      onChange={(e) => setTfaOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleRegenBackupCodes(); }}
                      placeholder="000000"
                      className="w-full rounded-md border border-theme bg-light-background px-3 py-3 text-center font-mono text-2xl font-semibold tracking-widest text-light-text outline-none transition focus:border-light-primary focus:ring-2 focus:ring-light-primary/30 dark:bg-dark-background dark:text-dark-text dark:focus:border-dark-primary dark:focus:ring-dark-primary/30"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={tfaOtpInput.length !== 6 || isTfaBusy}
                    onClick={() => void handleRegenBackupCodes()}
                    className={`${primaryButtonClass} justify-center`}
                  >
                    {isTfaBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {isTfaBusy ? "กำลังสร้าง..." : "สร้าง Backup Codes ใหม่"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {emailModalOpen && emailModalType && createPortal(
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4" onMouseDown={closeEmailModal}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-verification-title"
            className="w-full max-w-lg rounded-lg border border-theme bg-light-background-card shadow-2xl dark:bg-dark-background-card"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-theme p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="email-verification-title" className="font-semibold text-light-text dark:text-dark-text">{modalTitle}</h2>
                  <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">
                    {pendingEmailType ? `กรอกรหัสที่ส่งไปยัง ${modalTargetEmail}` : "ระบบจะส่งรหัสยืนยันอายุ 10 นาทีไปยังอีเมลปลายทาง"}
                  </p>
                </div>
              </div>
              <button type="button" title="ปิด" onClick={closeEmailModal}
                className="grid h-9 w-9 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              {!pendingEmailType ? (
                <div className="grid gap-4">
                  {modalNeedsNewEmail ? (
                    <div>
                      <label className={labelClass}>อีเมลใหม่</label>
                      <input
                        autoFocus
                        type="email"
                        className={inputClass}
                        value={modalEmail}
                        placeholder="name@example.com"
                        onChange={(event) => setModalEmail(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && modalEmail.trim()) void sendEmailCode(emailModalType);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="rounded-md border border-theme bg-light-background p-4 dark:bg-dark-background">
                      <p className="text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">อีเมลที่จะยืนยัน</p>
                      <p className="mt-1 truncate text-sm font-semibold text-light-text dark:text-dark-text">{modalTargetEmail}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    className={`${primaryButtonClass} justify-center`}
                    disabled={(modalNeedsNewEmail && !modalEmail.trim()) || emailBusyType === emailModalType}
                    onClick={() => void sendEmailCode(emailModalType)}
                  >
                    {emailBusyType === emailModalType ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    ส่งรหัสยืนยัน
                  </button>
                </div>
              ) : (
                <div className="grid gap-5">
                  <div>
                    <p className="mb-3 text-center text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">
                      กรอกรหัสยืนยัน 6 หลัก
                    </p>
                    <div className="grid grid-cols-6 gap-2" onPaste={(event) => {
                      event.preventDefault();
                      setOtpDigit(0, event.clipboardData.getData("text"));
                    }}>
                      {otpDigits.map((digit, index) => (
                        <input
                          key={index}
                          ref={(element) => { otpRefs.current[index] = element; }}
                          autoFocus={index === 0}
                          inputMode="numeric"
                          autoComplete={index === 0 ? "one-time-code" : "off"}
                          maxLength={1}
                          value={digit}
                          onChange={(event) => setOtpDigit(index, event.target.value)}
                          onKeyDown={(event) => handleOtpKeyDown(index, event)}
                          onFocus={(event) => event.currentTarget.select()}
                          className="aspect-square min-w-0 rounded-md border border-theme bg-light-background text-center font-mono text-xl font-semibold text-light-text outline-none transition focus:border-light-primary focus:ring-2 focus:ring-light-primary/30 dark:bg-dark-background dark:text-dark-text dark:focus:border-dark-primary dark:focus:ring-dark-primary/30"
                          aria-label={`Verification digit ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>

                  <button type="button" className={`${primaryButtonClass} justify-center`}
                    disabled={otpDigits.some((digit) => !digit) || emailBusyType === emailModalType}
                    onClick={() => void verifyEmailCode(emailModalType)}>
                    {emailBusyType === emailModalType ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    ยืนยันรหัส
                  </button>

                  <button type="button" className="text-sm font-semibold text-light-primary hover:underline disabled:opacity-50 dark:text-dark-primary"
                    disabled={emailBusyType === emailModalType} onClick={() => void sendEmailCode(emailModalType)}>
                    ไม่ได้รับรหัส? ส่งอีกครั้ง
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
};

export default MySecurityPage;
