import { useEffect, useState } from "react";
import {
  BellRing,
  Building2,
  LogIn,
  Loader2,
  Mail,
  ShieldAlert,
  Volume2,
} from "lucide-react";
import { toast } from "react-toastify";
import type { AxiosError } from "axios";
import { useApi } from "@/hooks/useApi";

type NotificationSettings = {
  loginNotifications: boolean;
  securityNotifications: boolean;
  systemNotifications: boolean;
  emailNotifications: boolean;
  soundNotifications: boolean;
};

type NotificationSettingsResponse = {
  success: boolean;
  message?: string;
  data: NotificationSettings;
};

const defaultSettings: NotificationSettings = {
  loginNotifications: true,
  securityNotifications: true,
  systemNotifications: false,
  emailNotifications: true,
  soundNotifications: true,
};

const Toggle = ({
  checked,
  onChange,
  label,
  isLoading = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  isLoading?: boolean;
}) => (
  <button
    type="button"
    role="switch"
    aria-label={label}
    aria-checked={checked}
    disabled={isLoading}
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-wait ${
      checked ? "bg-light-primary dark:bg-dark-primary" : "bg-light-text-muted/30 dark:bg-dark-text-muted/30"
    }`}
  >
    {isLoading ? (
      <Loader2 className="mx-auto h-4 w-4 animate-spin text-white" />
    ) : (
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    )}
  </button>
);

const NotificationSettingsPanel = () => {
  const { get, put } = useApi();
  const [settings, setSettings] = useState(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof NotificationSettings | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await get<NotificationSettingsResponse>("/account-security/notifications");
        if (!active) return;
        setSettings(response.data.data);
      } catch (error) {
        if (!active) return;
        const apiError = error as AxiosError<{ message?: string }>;
        toast.error(apiError.response?.data?.message ?? "ไม่สามารถโหลดการตั้งค่าการแจ้งเตือนได้");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const updateSetting = async (key: keyof NotificationSettings) => {
    if (savingKey) return;
    const previous = settings;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSavingKey(key);

    try {
      const response = await put<NotificationSettingsResponse>("/account-security/notifications", next);
      setSettings(response.data.data);
      toast.success(response.data.message ?? "บันทึกการตั้งค่าการแจ้งเตือนเรียบร้อยแล้ว");
      if (key === "soundNotifications") {
        window.dispatchEvent(new CustomEvent("notification-sound-settings-changed"));
      }
    } catch (error) {
      setSettings(previous);
      const apiError = error as AxiosError<{ message?: string }>;
      toast.error(apiError.response?.data?.message ?? "ไม่สามารถบันทึกการตั้งค่าการแจ้งเตือนได้");
    } finally {
      setSavingKey(null);
    }
  };

  const items = [
    {
      key: "loginNotifications",
      title: "การเข้าสู่ระบบ",
      description: "แจ้งเตือนเมื่อมีการเข้าสู่ระบบใหม่หรือพบอุปกรณ์ที่ไม่คุ้นเคย",
      icon: LogIn,
      tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    },
    {
      key: "securityNotifications",
      title: "ความปลอดภัยบัญชี",
      description: "แจ้งเตือนเมื่อรหัสผ่าน อีเมล หรือการตั้งค่าความปลอดภัยเปลี่ยนแปลง",
      icon: ShieldAlert,
      tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    },
    {
      key: "systemNotifications",
      title: "ประกาศจากระบบ",
      description: "รับข่าวสาร การปิดปรับปรุง และประกาศสำคัญจากผู้ดูแลระบบ",
      icon: Building2,
      tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
  ] as const;

  return (
    <div className="grid gap-5">
      {isLoading && (
        <div className="grid min-h-48 place-items-center rounded-lg border border-theme bg-light-background-card shadow-soft dark:bg-dark-background-card">
          <Loader2 className="h-6 w-6 animate-spin text-light-primary dark:text-dark-primary" />
        </div>
      )}

      {!isLoading && (
      <>
      <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
        <div className="mb-5 flex items-center gap-3 border-b border-theme pb-5">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
            <BellRing className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-light-text dark:text-dark-text">ประเภทการแจ้งเตือน</h2>
            <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
              เลือกเหตุการณ์ที่ต้องการติดตามภายในระบบ
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          {items.map(({ key, title, description, icon: Icon, tone }) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 rounded-md border border-theme bg-light-background p-4 dark:bg-dark-background"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-light-text dark:text-dark-text">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-light-text-muted dark:text-dark-text-muted">{description}</p>
                </div>
              </div>
              <Toggle
                checked={settings[key]}
                onChange={() => void updateSetting(key)}
                label={title}
                isLoading={savingKey === key}
              />
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
        <div className="mb-5">
          <h2 className="font-semibold text-light-text dark:text-dark-text">ช่องทางและเสียง</h2>
          <p className="mt-1 text-xs text-light-text-muted dark:text-dark-text-muted">
            กำหนดวิธีรับการแจ้งเตือนจากประเภทที่เปิดใช้งานไว้
          </p>
        </div>

        <div className="divide-y divide-theme rounded-md border border-theme bg-light-background px-4 dark:bg-dark-background">
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-light-primary dark:text-dark-primary" />
              <div>
                <p className="text-sm font-semibold text-light-text dark:text-dark-text">แจ้งเตือนทางอีเมล</p>
                <p className="mt-1 text-xs text-light-text-muted dark:text-dark-text-muted">
                  ส่งเหตุการณ์ที่เปิดใช้งานไปยังอีเมลหลักของบัญชี
                </p>
              </div>
            </div>
            <Toggle
              checked={settings.emailNotifications}
              onChange={() => void updateSetting("emailNotifications")}
              label="แจ้งเตือนทางอีเมล"
              isLoading={savingKey === "emailNotifications"}
            />
          </div>

          <div className="flex items-center justify-between gap-4 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <Volume2 className="mt-0.5 h-5 w-5 shrink-0 text-light-primary dark:text-dark-primary" />
              <div>
                <p className="text-sm font-semibold text-light-text dark:text-dark-text">เสียงแจ้งเตือน</p>
                <p className="mt-1 text-xs text-light-text-muted dark:text-dark-text-muted">
                  จัดการการแจ้งเตือนด้วยเสียงสำหรับเหตุการณ์สำคัญและการสื่อสารภายในระบบ
                </p>
              </div>
            </div>
            <Toggle
              checked={settings.soundNotifications}
              onChange={() => void updateSetting("soundNotifications")}
              label="เสียงแจ้งเตือน"
              isLoading={savingKey === "soundNotifications"}
            />
          </div>
        </div>
      </article>
      </>
      )}
    </div>
  );
};

export default NotificationSettingsPanel;
