import { type FormEvent, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { checkInjection } from "@/utils/injectionGuard";
import { CheckCircle2, Loader2, Lock, Mail, UserPlus, UserRound } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/contexts/SessionContext";
import AuthPageHeader from "@/pages/auth/components/AuthPageHeader";

type RegistrationStatus = {
  enabled: boolean;
  requireApproval: boolean;
  defaultRole: string;
};

type RegistrationStatusResponse = {
  success: boolean;
  data: RegistrationStatus;
};

type RegisterResponse = {
  success: boolean;
  message: string;
  data?: {
    requiresApproval: boolean;
  };
};

const inputWrapClass =
  "flex items-center gap-2 rounded-md border border-theme bg-light-background px-3 py-2.5 text-slate-900 focus-within:border-light-primary dark:bg-dark-background dark:text-slate-50 dark:focus-within:border-dark-primary";

const inputClass = "min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400";

const RegisterPage = () => {
  const { isAuthenticated } = useSession();
  const { get, post } = useApi();
  const [status, setStatus] = useState<RegistrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    get<RegistrationStatusResponse>("/system-setting/general/registration/status", { skipAuthRefresh: true })
      .then((response) => {
        if (active) {
          setStatus(response.data.data);
        }
      })
      .catch(() => {
        if (active) {
          setStatus({ enabled: false, requireApproval: true, defaultRole: "USER" });
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!username.trim() || !email.trim() || !password) {
      setError("กรุณากรอก username, email และ password");
      return;
    }

    const usernameGuard = checkInjection(username);
    if (!usernameGuard.safe) {
      setError(usernameGuard.message);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await post<RegisterResponse>("/auth/register", {
        username,
        email,
        password,
        firstName,
        lastName,
      }, { skipAuthRefresh: true });

      setSuccessMessage(response.data.message || "สมัครสมาชิกสำเร็จ");
      setUsername("");
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
    } catch (err) {
      const message = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(message || "สมัครสมาชิกไม่สำเร็จ");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-app px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card sm:p-8">
        <AuthPageHeader
          title="สมัครสมาชิก"
          description={status?.requireApproval
            ? "กรอกข้อมูลเพื่อสร้างบัญชีใหม่ บัญชีต้องรอผู้ดูแลอนุมัติก่อนใช้งาน"
            : "กรอกข้อมูลเพื่อสร้างบัญชีใหม่และเข้าใช้งานระบบ"}
        />

        {isLoading ? (
          <div className="grid min-h-36 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-light-text-muted dark:text-dark-text-muted" />
          </div>
        ) : !status?.enabled ? (
          <div className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              ระบบยังไม่ได้เปิดรับสมัครสมาชิก
            </div>
            <Link
              className="inline-flex h-11 w-full items-center justify-center rounded-md border border-theme px-4 text-sm font-bold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
              to="/login"
            >
              กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        ) : successMessage ? (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            </div>
            <Link
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-light-primary px-4 text-sm font-bold text-white transition-colors hover:bg-light-primary/90 dark:bg-dark-primary dark:hover:bg-dark-primary/90"
              to="/login"
            >
              ไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">First name</span>
                <input className={`${inputClass} w-full rounded-md border border-theme bg-light-background px-3 py-2.5 dark:bg-dark-background`} value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={isSubmitting} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Last name</span>
                <input className={`${inputClass} w-full rounded-md border border-theme bg-light-background px-3 py-2.5 dark:bg-dark-background`} value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={isSubmitting} />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Username</span>
              <span className={inputWrapClass}>
                <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
                <input className={inputClass} value={username} onChange={(event) => setUsername(event.target.value)} disabled={isSubmitting} autoComplete="username" />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email</span>
              <span className={inputWrapClass}>
                <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                <input className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} disabled={isSubmitting} autoComplete="email" type="email" />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Password</span>
              <span className={inputWrapClass}>
                <Lock className="h-4 w-4 shrink-0 text-slate-400" />
                <input className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} disabled={isSubmitting} autoComplete="new-password" type="password" />
              </span>
            </label>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                {error}
              </div>
            )}

            <button
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-light-primary px-4 text-sm font-bold text-white transition-colors hover:bg-light-primary/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-dark-primary dark:hover:bg-dark-primary/90"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {isSubmitting ? "กำลังสมัคร..." : "สมัครสมาชิก"}
            </button>

            <Link
              className="inline-flex h-11 w-full items-center justify-center rounded-md border border-theme px-4 text-sm font-bold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
              to="/login"
            >
              กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </form>
        )}
      </section>
    </main>
  );
};

export default RegisterPage;
