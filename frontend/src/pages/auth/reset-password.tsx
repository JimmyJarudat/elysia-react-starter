import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type { AxiosError } from "axios";
import AuthPageHeader from "@/pages/auth/components/AuthPageHeader";

const ResetPasswordPage = () => {
  const { get, post } = useApi();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policy, setPolicy] = useState({
    minLength: 8,
    requireLowercase: true,
    requireUppercase: true,
    requireNumber: true,
    requireSpecial: true,
    historyCount: 0,
  });

  useEffect(() => {
    if (!token) {
      setError("ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง");
    }
  }, [token]);

  useEffect(() => {
    void get<{ success: boolean; data: typeof policy }>("/auth/password-policy", { skipAuthRefresh: true })
      .then((response) => setPolicy(response.data.data))
      .catch(() => {});
  }, []);

  const passwordRules = [
    { label: `อย่างน้อย ${policy.minLength} ตัวอักษร`, enabled: true, valid: newPassword.length >= policy.minLength },
    { label: "มีตัวอักษรพิมพ์เล็ก", enabled: policy.requireLowercase, valid: /[a-z]/.test(newPassword) },
    { label: "มีตัวอักษรพิมพ์ใหญ่", enabled: policy.requireUppercase, valid: /[A-Z]/.test(newPassword) },
    { label: "มีตัวเลข", enabled: policy.requireNumber, valid: /\d/.test(newPassword) },
    { label: "มีอักขระพิเศษ", enabled: policy.requireSpecial, valid: /[^A-Za-z0-9]/.test(newPassword) },
    { label: "รหัสผ่านทั้งสองช่องตรงกัน", enabled: true, valid: Boolean(newPassword) && newPassword === confirmPassword },
  ].filter((rule) => rule.enabled);
  const passwordValid = passwordRules.every((rule) => rule.valid);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!passwordValid) {
      setError("รหัสผ่านยังไม่ครบตามเงื่อนไขของระบบ");
      return;
    }

    setIsSubmitting(true);
    try {
      await post("/auth/reset-password", { token, newPassword }, { skipAuthRefresh: true });
      setSuccess(true);
      setTimeout(() => navigate("/login", { replace: true }), 3000);
    } catch (err) {
      const apiError = err as AxiosError<{ message?: string }>;
      setError(apiError.response?.data?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-app px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card sm:p-8">
        <AuthPageHeader
          title="ตั้งรหัสผ่านใหม่"
          description="กรอกรหัสผ่านใหม่ให้ครบตามเงื่อนไขความปลอดภัยของระบบ"
        />

        {success ? (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-6 text-center dark:border-green-500/30 dark:bg-green-500/10">
              <CheckCircle2 className="h-10 w-10 text-green-500 dark:text-green-400" />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-300">เปลี่ยนรหัสผ่านสำเร็จ</p>
                <p className="mt-1 text-xs text-green-700 dark:text-green-400">
                  กำลังนำคุณไปยังหน้าเข้าสู่ระบบ...
                </p>
              </div>
            </div>
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-light-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-light-primary/90 dark:bg-dark-primary dark:hover:bg-dark-primary/90"
            >
              เข้าสู่ระบบเลย
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {!token && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง กรุณาขอใหม่
              </div>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                รหัสผ่านใหม่
              </span>
              <span className="flex items-center gap-2 rounded-md border border-theme bg-light-background px-3 py-2.5 text-slate-900 focus-within:border-light-primary dark:bg-dark-background dark:text-slate-50 dark:focus-within:border-dark-primary">
                <KeyRound className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  disabled={isSubmitting || !token}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={`อย่างน้อย ${policy.minLength} ตัวอักษร`}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                ยืนยันรหัสผ่านใหม่
              </span>
              <span className="flex items-center gap-2 rounded-md border border-theme bg-light-background px-3 py-2.5 text-slate-900 focus-within:border-light-primary dark:bg-dark-background dark:text-slate-50 dark:focus-within:border-dark-primary">
                <KeyRound className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  disabled={isSubmitting || !token}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            <div className="grid gap-2 rounded-md border border-theme bg-light-background p-3 dark:bg-dark-background">
              {passwordRules.map((rule) => (
                <div
                  key={rule.label}
                  className={`flex items-center gap-2 text-xs font-medium ${
                    rule.valid
                      ? "text-green-600 dark:text-green-400"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{rule.label}</span>
                </div>
              ))}
              {policy.historyCount > 0 && (
                <p className="border-t border-theme pt-2 text-xs text-slate-500 dark:text-slate-400">
                  ห้ามซ้ำกับ {policy.historyCount} รหัสผ่านล่าสุด ระบบจะตรวจสอบเมื่อบันทึก
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !token || !passwordValid}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-light-primary px-4 text-sm font-bold text-white transition-colors hover:bg-light-primary/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-dark-primary dark:hover:bg-dark-primary/90"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {isSubmitting ? "กำลังบันทึก..." : "ตั้งรหัสผ่านใหม่"}
            </button>

            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-theme px-4 py-2.5 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              กลับหน้าเข้าสู่ระบบ
            </Link>
          </form>
        )}
      </section>
    </main>
  );
};

export default ResetPasswordPage;
