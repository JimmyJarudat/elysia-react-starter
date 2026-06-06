import { type FormEvent, useEffect, useState } from "react";
import { Loader2, Lock, LogIn, UserPlus, UserRound } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";
import { useApi } from "@/hooks/useApi";

type LoginLocationState = {
  from?: string;
};

type RegistrationStatusResponse = {
  success: boolean;
  data: {
    enabled: boolean;
    requireApproval: boolean;
    defaultRole: string;
  };
};

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, login } = useSession();
  const { get } = useApi();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const state = location.state as LoginLocationState | null;
  const redirectPath = state?.from ?? "/dashboard";

  useEffect(() => {
    let active = true;

    get<RegistrationStatusResponse>("/system-setting/registration/status", { skipAuthRefresh: true })
      .then((response) => {
        if (active) {
          setRegistrationEnabled(response.data.data.enabled);
        }
      })
      .catch(() => {
        if (active) {
          setRegistrationEnabled(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (isAuthenticated) {
    return <Navigate to={redirectPath} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }

    setIsSubmitting(true);

    const result = await login(username, password);

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "เข้าสู่ระบบไม่สำเร็จ");
      return;
    }

    if (result.requiresTwoFactor) {
      setError("บัญชีนี้เปิดใช้งาน 2FA แต่หน้ายืนยัน 2FA ยังไม่ได้เชื่อมต่อ");
      return;
    }

    navigate(redirectPath, { replace: true });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-app px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card sm:p-8">
        <div className="mb-8">
          <img src="/elysia.svg" alt="Elysia" className="mb-5 h-9 w-auto dark:brightness-0 dark:invert" />
          <p className="text-xs font-extrabold uppercase tracking-wider text-light-primary dark:text-dark-primary">
            Secure sign in
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-900 dark:text-slate-50">
            เข้าสู่ระบบ
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            ใช้บัญชีผู้ดูแลเพื่อเข้าใช้งานระบบ
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Username หรือ Email
            </span>
            <span className="flex items-center gap-2 rounded-md border border-theme bg-light-background px-3 py-2.5 text-slate-900 focus-within:border-light-primary dark:bg-dark-background dark:text-slate-50 dark:focus-within:border-dark-primary">
              <UserRound className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                autoComplete="username"
                disabled={isSubmitting}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="admin หรือ admin@example.com"
                type="text"
                value={username}
              />
            </span>
          </label>

          <label className="block">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Password</span>
              <Link
                to="/forgot-password"
                className="text-xs text-light-primary hover:underline dark:text-dark-primary"
                tabIndex={-1}
              >
                ลืมรหัสผ่าน?
              </Link>
            </div>
            <span className="flex items-center gap-2 rounded-md border border-theme bg-light-background px-3 py-2.5 text-slate-900 focus-within:border-light-primary dark:bg-dark-background dark:text-slate-50 dark:focus-within:border-dark-primary">
              <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                autoComplete="current-password"
                disabled={isSubmitting}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="รหัสผ่าน"
                type="password"
                value={password}
              />
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
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogIn className="h-4 w-4" aria-hidden="true" />
            )}
            {isSubmitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>

          {registrationEnabled && (
            <Link
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-theme px-4 text-sm font-bold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
              to="/register"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              สมัครสมาชิก
            </Link>
          )}
        </form>
      </section>
    </main>
  );
};

export default LoginPage;
