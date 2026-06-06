import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Mail, Send } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type { AxiosError } from "axios";
import AuthPageHeader from "@/pages/auth/components/AuthPageHeader";

type Step = "input" | "choose" | "sent";

interface EmailChoiceData {
  mainEmail: string;
  recoveryEmail: string;
}

const ForgotPasswordPage = () => {
  const { post } = useApi();
  const [step, setStep] = useState<Step>("input");
  const [identifier, setIdentifier] = useState("");
  const [emailOptions, setEmailOptions] = useState<EmailChoiceData | null>(null);
  const [selectedEmailType, setSelectedEmailType] = useState<"main" | "recovery">("main");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState("");

  const handleLookup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!identifier.trim()) {
      setError("กรุณากรอกอีเมลหรือชื่อผู้ใช้");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await post<{ success: boolean; needChoice?: boolean; data?: EmailChoiceData; message?: string }>(
        "/auth/forgot-password",
        { identifier: identifier.trim() },
        { skipAuthRefresh: true },
      );
      if (result.data.needChoice && result.data.data) {
        setEmailOptions(result.data.data);
        setStep("choose");
      } else {
        setSentMessage(result.data.message ?? "ส่งอีเมลสำเร็จ");
        setStep("sent");
      }
    } catch (err) {
      const apiError = err as AxiosError<{ message?: string }>;
      setError(apiError.response?.data?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await post<{ success: boolean; message?: string }>(
        "/auth/forgot-password",
        { identifier: identifier.trim(), emailType: selectedEmailType },
        { skipAuthRefresh: true },
      );
      setSentMessage(result.data.message ?? "ส่งอีเมลสำเร็จ");
      setStep("sent");
    } catch (err) {
      const apiError = err as AxiosError<{ message?: string }>;
      setError(apiError.response?.data?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  const descriptionMap: Record<Step, string> = {
    input: "กรอกอีเมลหรือชื่อผู้ใช้ที่ลงทะเบียนไว้ ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณ",
    choose: "เลือกที่อยู่อีเมลที่ต้องการรับลิงก์รีเซ็ตรหัสผ่าน",
    sent: "ตรวจสอบอีเมลของคุณ",
  };

  return (
    <main className="grid min-h-screen place-items-center bg-app px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card sm:p-8">
        <AuthPageHeader title="ลืมรหัสผ่าน" description={descriptionMap[step]} />

        {step === "sent" ? (
          <div className="space-y-5">
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300">
              <p className="font-semibold">ส่งอีเมลเรียบร้อยแล้ว</p>
              <p className="mt-1 text-xs leading-relaxed">{sentMessage}</p>
              <p className="mt-1 text-xs leading-relaxed">กรุณาตรวจสอบกล่องสแปมด้วย และเปิดลิงก์ภายในเวลาที่ระบุในอีเมล</p>
            </div>
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-theme px-4 py-2.5 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              กลับหน้าเข้าสู่ระบบ
            </Link>
          </div>
        ) : step === "choose" ? (
          <form className="space-y-4" onSubmit={handleSend}>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-theme bg-light-background p-3 transition-colors hover:bg-light-primary/5 has-[:checked]:border-light-primary has-[:checked]:bg-light-primary/5 dark:bg-dark-background dark:hover:bg-dark-primary/5 dark:has-[:checked]:border-dark-primary dark:has-[:checked]:bg-dark-primary/5">
                <input
                  type="radio"
                  name="emailType"
                  value="main"
                  checked={selectedEmailType === "main"}
                  onChange={() => setSelectedEmailType("main")}
                  className="mt-0.5 accent-light-primary dark:accent-dark-primary"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">อีเมลหลัก</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{emailOptions?.mainEmail}</p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-theme bg-light-background p-3 transition-colors hover:bg-light-primary/5 has-[:checked]:border-light-primary has-[:checked]:bg-light-primary/5 dark:bg-dark-background dark:hover:bg-dark-primary/5 dark:has-[:checked]:border-dark-primary dark:has-[:checked]:bg-dark-primary/5">
                <input
                  type="radio"
                  name="emailType"
                  value="recovery"
                  checked={selectedEmailType === "recovery"}
                  onChange={() => setSelectedEmailType("recovery")}
                  className="mt-0.5 accent-light-primary dark:accent-dark-primary"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    อีเมลสำรอง
                    <span className="ml-2 text-xs font-normal text-slate-400">(สำหรับกู้คืนบัญชี)</span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{emailOptions?.recoveryEmail}</p>
                </div>
              </label>
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-light-primary px-4 text-sm font-bold text-white transition-colors hover:bg-light-primary/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-dark-primary dark:hover:bg-dark-primary/90"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSubmitting ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
            </button>

            <button
              type="button"
              onClick={() => { setStep("input"); setError(null); }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-theme px-4 py-2.5 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              ย้อนกลับ
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleLookup}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                อีเมล หรือ Username
              </span>
              <span className="flex items-center gap-2 rounded-md border border-theme bg-light-background px-3 py-2.5 text-slate-900 focus-within:border-light-primary dark:bg-dark-background dark:text-slate-50 dark:focus-within:border-dark-primary">
                <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                  type="text"
                  autoComplete="email"
                  disabled={isSubmitting}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin@example.com"
                />
              </span>
            </label>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-light-primary px-4 text-sm font-bold text-white transition-colors hover:bg-light-primary/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-dark-primary dark:hover:bg-dark-primary/90"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSubmitting ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
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

export default ForgotPasswordPage;
