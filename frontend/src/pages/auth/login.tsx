import { type FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { checkInjection } from "@/utils/injectionGuard";
import { Loader2, Lock, LogIn, Shield, UserPlus, UserRound } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";
import type { User, SessionSecurity } from "@/contexts/SessionContext";
import { useApi } from "@/hooks/useApi";
import AuthPageHeader from "@/pages/auth/components/AuthPageHeader";

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

type TfaVerifyResponse = {
  success: boolean;
  message?: string;
  accessToken?: string;
  user?: User | null;
  security?: SessionSecurity;
};

const OTP_LENGTH = 6;

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, login, updateUser, updateAccessToken, updateAuthenticated } = useSession();
  const { get, post } = useApi();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const state = location.state as LoginLocationState | null;
  const redirectPath = state?.from ?? "/dashboard";

  const [tfaToken, setTfaToken] = useState<string | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isTfaSubmitting, setIsTfaSubmitting] = useState(false);
  const [tfaError, setTfaError] = useState<string | null>(null);

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

    const usernameGuard = checkInjection(username);
    if (!usernameGuard.safe) {
      setError(usernameGuard.message);
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
      if (result.tfaSessionToken) {
        setTfaToken(result.tfaSessionToken);
        setOtpDigits(Array(OTP_LENGTH).fill(""));
        setTfaError(null);
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
      }
      return;
    }

    navigate(redirectPath, { replace: true });
  };

  const setOtpDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setOtpDigits(next);
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    setTimeout(() => otpRefs.current[focusIdx]?.focus(), 0);
  };

  const handleTfaVerify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tfaToken) return;
    const code = otpDigits.join("");
    if (code.length !== OTP_LENGTH) {
      setTfaError("กรุณากรอกรหัส 6 หลักให้ครบถ้วน");
      return;
    }
    setTfaError(null);
    setIsTfaSubmitting(true);

    try {
      const response = await post<TfaVerifyResponse>(
        "/auth/tfa-verify",
        { tfaToken, code },
        { skipAuthRefresh: true },
      );
      const payload = response.data;

      if (!payload.success) {
        setTfaError(payload.message ?? "รหัส OTP ไม่ถูกต้อง");
        setOtpDigits(Array(OTP_LENGTH).fill(""));
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
        return;
      }

      if (payload.user) {
        const nextSecurity = payload.user.security ?? payload.security;
        updateUser({ ...payload.user, isEmailVerified: nextSecurity?.isEmailVerified ?? false, security: nextSecurity ?? payload.user.security } as User);
      }
      updateAccessToken(payload.accessToken ?? null);
      updateAuthenticated(true);
      navigate(redirectPath, { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่";
      setTfaError(msg);
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } finally {
      setIsTfaSubmitting(false);
    }
  };

  const closeTfaModal = () => {
    setTfaToken(null);
    setOtpDigits(Array(OTP_LENGTH).fill(""));
    setTfaError(null);
  };

  return (
    <>
      <main className="grid min-h-screen place-items-center bg-app px-4 py-10">
        <section className="w-full max-w-md rounded-lg border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card sm:p-8">
          <AuthPageHeader
            title="เข้าสู่ระบบ"
            description="กรอกชื่อผู้ใช้หรืออีเมล และรหัสผ่านเพื่อเข้าใช้งานระบบ"
          />

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

      {tfaToken &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-lg border border-theme bg-light-background-card p-6 shadow-xl dark:bg-dark-background-card">
              <div className="mb-5 flex flex-col items-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-light-primary/10 dark:bg-dark-primary/10">
                  <Shield className="h-6 w-6 text-light-primary dark:text-dark-primary" />
                </div>
                <h2 className="text-lg font-bold text-light-text dark:text-dark-text">ยืนยันตัวตนสองขั้นตอน</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  กรอกรหัส 6 หลักจาก Authenticator App
                </p>
              </div>

              <form onSubmit={handleTfaVerify} className="space-y-4">
                <div className="flex justify-center gap-2">
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => setOtpDigit(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      onPaste={handleOtpPaste}
                      disabled={isTfaSubmitting}
                      className="h-12 w-10 rounded-md border border-theme bg-light-background text-center text-lg font-mono font-semibold text-light-text outline-none focus:border-light-primary dark:bg-dark-background dark:text-dark-text dark:focus:border-dark-primary disabled:opacity-50"
                      autoComplete="off"
                      aria-label={`หลักที่ ${i + 1}`}
                    />
                  ))}
                </div>

                {tfaError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-center text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                    {tfaError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isTfaSubmitting || otpDigits.join("").length !== OTP_LENGTH}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-light-primary px-4 text-sm font-bold text-white transition-colors hover:bg-light-primary/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-dark-primary dark:hover:bg-dark-primary/90"
                >
                  {isTfaSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {isTfaSubmitting ? "กำลังยืนยัน..." : "ยืนยัน"}
                </button>

                <button
                  type="button"
                  onClick={closeTfaModal}
                  disabled={isTfaSubmitting}
                  className="w-full text-center text-sm text-slate-500 hover:text-slate-700 disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  ยกเลิก / ลองใหม่
                </button>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default LoginPage;
