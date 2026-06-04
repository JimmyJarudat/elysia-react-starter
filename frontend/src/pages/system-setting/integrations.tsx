import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Database,
  Eye,
  Mail,
  RefreshCw,
  Save,
  Send,
  Server,
  ShieldAlert,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { useSession } from "@/contexts/SessionContext";
import { useApi } from "@/hooks/useApi";

type RedisKey = {
  key: string;
  type: string;
  ttl: string;
  ttlSeconds: number;
  size: string;
  group: string;
};

type RedisKeyDetail = RedisKey & {
  value: string;
};

type RedisSettings = {
  enabled: boolean;
  host: string;
  port: number;
  db: number;
  password?: string;
  hasPassword: boolean;
  prefix: string;
};

type RedisResponse = {
  success: boolean;
  data: RedisSettings;
};

type RedisKeysResponse = {
  success: boolean;
  data: RedisKey[];
};

type RedisKeyResponse = {
  success: boolean;
  data: RedisKeyDetail;
};

type SmtpSettings = {
  enabled: boolean;
  host: string;
  port: number;
  encryption: "starttls" | "ssl" | "none";
  user: string;
  password?: string;
  hasPassword: boolean;
  fromName: string;
  fromEmail: string;
  appName: string;
  appUrl: string;
};

type SmtpResponse = {
  success: boolean;
  data: SmtpSettings;
};

type ActionResponse = {
  success: boolean;
  message: string;
};

const defaultSmtpSettings: SmtpSettings = {
  enabled: false,
  host: "",
  port: 587,
  encryption: "starttls",
  user: "",
  password: "",
  hasPassword: false,
  fromName: "IT Utilities",
  fromEmail: "",
  appName: "IT Utilities",
  appUrl: "http://localhost:5173",
};

const defaultRedisSettings: RedisSettings = {
  enabled: false,
  host: "127.0.0.1",
  port: 6379,
  db: 0,
  password: "",
  hasPassword: false,
  prefix: "it-utils:",
};

const cardClass = "rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card";
const inputClass =
  "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary disabled:cursor-not-allowed disabled:opacity-70 dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";
const labelClass = "mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted";
const buttonSecondaryClass =
  "inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-dark-text dark:hover:bg-dark-primary/10";
const buttonPrimaryClass =
  "inline-flex items-center gap-2 rounded-md bg-light-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:cursor-not-allowed disabled:opacity-50 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover";

const IntegrationsPage = () => {
  const { user } = useSession();
  const { get, put, post, del } = useApi();
  const [redisFilter, setRedisFilter] = useState("all");
  const [isRedisModalOpen, setIsRedisModalOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<RedisKeyDetail | null>(null);
  const [redisKeys, setRedisKeys] = useState<RedisKey[]>([]);
  const [redisForm, setRedisForm] = useState<RedisSettings>(defaultRedisSettings);
  const [savedRedisForm, setSavedRedisForm] = useState<RedisSettings>(defaultRedisSettings);
  const [isRedisLoading, setIsRedisLoading] = useState(true);
  const [isRedisSaving, setIsRedisSaving] = useState(false);
  const [isRedisTesting, setIsRedisTesting] = useState(false);
  const [isRedisKeysLoading, setIsRedisKeysLoading] = useState(false);
  const [redisStatus, setRedisStatus] = useState<"idle" | "ok" | "error">("idle");
  const [redisStatusMessage, setRedisStatusMessage] = useState("ยังไม่ได้ทดสอบการเชื่อมต่อ");
  const [testedRedisSignature, setTestedRedisSignature] = useState("");
  const [smtpForm, setSmtpForm] = useState<SmtpSettings>(defaultSmtpSettings);
  const [savedSmtpForm, setSavedSmtpForm] = useState<SmtpSettings>(defaultSmtpSettings);
  const [testEmail, setTestEmail] = useState("");
  const [isSmtpLoading, setIsSmtpLoading] = useState(true);
  const [isSmtpSaving, setIsSmtpSaving] = useState(false);
  const [isSmtpTesting, setIsSmtpTesting] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<"idle" | "ok" | "error">("idle");
  const [smtpStatusMessage, setSmtpStatusMessage] = useState("ยังไม่ได้ทดสอบการเชื่อมต่อ");
  const [testedSmtpSignature, setTestedSmtpSignature] = useState("");
  const isSuperAdmin = user?.roles?.includes("SUPERADMIN") ?? false;
  const canUpdateSettings = isSuperAdmin || Boolean(user?.permissions?.includes("settings.update"));

  const redisGroups = useMemo(() => ["all", ...Array.from(new Set(redisKeys.map((item) => item.group))).sort()], [redisKeys]);
  const filteredKeys = useMemo(
    () => redisKeys.filter((item) => redisFilter === "all" || item.group === redisFilter),
    [redisFilter, redisKeys],
  );

  const isRedisDirty = JSON.stringify(redisForm) !== JSON.stringify(savedRedisForm);
  const currentRedisSignature = JSON.stringify({
    enabled: redisForm.enabled,
    host: redisForm.host,
    port: Number(redisForm.port),
    db: Number(redisForm.db),
    password: redisForm.password ?? "",
  });
  const canSaveRedis = !redisForm.enabled || testedRedisSignature === currentRedisSignature;
  const isSmtpDirty = JSON.stringify(smtpForm) !== JSON.stringify(savedSmtpForm);
  const currentSmtpSignature = JSON.stringify({
    enabled: smtpForm.enabled,
    host: smtpForm.host,
    port: Number(smtpForm.port),
    encryption: smtpForm.encryption,
    user: smtpForm.user,
    password: smtpForm.password ?? "",
    fromName: smtpForm.fromName,
    fromEmail: smtpForm.fromEmail,
    appName: smtpForm.appName,
    appUrl: smtpForm.appUrl,
  });
  const canSaveSmtp = !smtpForm.enabled || testedSmtpSignature === currentSmtpSignature;

  const setSmtpField = <K extends keyof SmtpSettings>(key: K, value: SmtpSettings[K]) => {
    setSmtpForm((current) => ({ ...current, [key]: value }));
    setTestedSmtpSignature("");
    setSmtpStatus("idle");
    setSmtpStatusMessage("มีการแก้ไข config กรุณา Test ให้ผ่านก่อน Save");
  };

  const setRedisField = <K extends keyof RedisSettings>(key: K, value: RedisSettings[K]) => {
    setRedisForm((current) => ({ ...current, [key]: value }));
    setTestedRedisSignature("");
    setRedisStatus("idle");
    setRedisStatusMessage("มีการแก้ไข config กรุณา Test ให้ผ่านก่อน Save");
  };

  useEffect(() => {
    let active = true;

    const loadRedis = async () => {
      setIsRedisLoading(true);
      try {
        const response = await get<RedisResponse>("/system-setting/redis");
        if (!active) return;
        const next = { ...defaultRedisSettings, ...response.data.data, password: "" };
        setRedisForm(next);
        setSavedRedisForm(next);
        setRedisStatus(response.data.data.enabled ? "idle" : "error");
        setRedisStatusMessage(response.data.data.enabled ? "โหลด Redis config แล้ว ยังไม่ได้ทดสอบ" : "Redis ถูกปิดอยู่");
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "Failed to load Redis settings");
        }
      } finally {
        if (active) {
          setIsRedisLoading(false);
        }
      }
    };

    const loadSmtp = async () => {
      setIsSmtpLoading(true);
      try {
        const response = await get<SmtpResponse>("/system-setting/smtp");
        if (!active) return;
        const next = { ...defaultSmtpSettings, ...response.data.data, password: "" };
        setSmtpForm(next);
        setSavedSmtpForm(next);
        setSmtpStatus(response.data.data.enabled ? "idle" : "error");
        setSmtpStatusMessage(response.data.data.enabled ? "โหลด SMTP config แล้ว ยังไม่ได้ทดสอบ" : "SMTP ถูกปิดอยู่");
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "Failed to load SMTP settings");
        }
      } finally {
        if (active) {
          setIsSmtpLoading(false);
        }
      }
    };

    void loadRedis();
    void loadSmtp();

    return () => {
      active = false;
    };
  }, []);

  const loadRedisKeys = async (group = redisFilter) => {
    setIsRedisKeysLoading(true);
    try {
      const response = await get<RedisKeysResponse>("/system-setting/redis/keys", {
        params: group !== "all" ? { group } : undefined,
      });
      setRedisKeys(response.data.data);
      setSelectedKey((current) => {
        if (!current) return null;
        return response.data.data.some((item) => item.key === current.key) ? current : null;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load Redis keys");
    } finally {
      setIsRedisKeysLoading(false);
    }
  };

  const openRedisModal = async () => {
    setIsRedisModalOpen(true);
    await loadRedisKeys();
  };

  const selectRedisKey = async (key: string) => {
    try {
      const response = await post<RedisKeyResponse>("/system-setting/redis/key", { key });
      setSelectedKey(response.data.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to read Redis key");
    }
  };

  const saveRedis = async () => {
    setIsRedisSaving(true);
    try {
      const payload = {
        ...redisForm,
        password: redisForm.password?.trim() ? redisForm.password : undefined,
        port: Number(redisForm.port),
        db: Number(redisForm.db),
      };
      const response = await put<RedisResponse>("/system-setting/redis", payload);
      const next = { ...defaultRedisSettings, ...response.data.data, password: "" };
      setRedisForm(next);
      setSavedRedisForm(next);
      setRedisStatus(next.enabled ? "idle" : "error");
      setRedisStatusMessage(next.enabled ? "บันทึกแล้ว Redis reconnect แล้ว" : "Redis ถูกปิดอยู่");
      setRedisKeys([]);
      setSelectedKey(null);
      toast.success("บันทึก Redis settings แล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save Redis settings");
    } finally {
      setIsRedisSaving(false);
    }
  };

  const testRedis = async () => {
    setIsRedisTesting(true);
    try {
      const response = await post<ActionResponse>("/system-setting/redis/test", {
        ...redisForm,
        password: redisForm.password?.trim() ? redisForm.password : undefined,
        port: Number(redisForm.port),
        db: Number(redisForm.db),
      });
      setRedisStatus(response.data.success ? "ok" : "error");
      setRedisStatusMessage(response.data.message);
      if (response.data.success) {
        setTestedRedisSignature(currentRedisSignature);
        toast.success(response.data.message);
      } else {
        setTestedRedisSignature("");
        toast.error(response.data.message);
      }
    } catch (error) {
      setRedisStatus("error");
      setTestedRedisSignature("");
      const message = error instanceof Error ? error.message : "Redis test failed";
      setRedisStatusMessage(message);
      toast.error(message);
    } finally {
      setIsRedisTesting(false);
    }
  };

  const deleteRedisKey = async (key: string) => {
    try {
      const response = await del<ActionResponse>("/system-setting/redis/key", { data: { key } });
      toast.success(response.data.message);
      if (selectedKey?.key === key) {
        setSelectedKey(null);
      }
      await loadRedisKeys();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete Redis key");
    }
  };

  const clearRedisKeys = async (group = redisFilter) => {
    try {
      const response = await post<ActionResponse>("/system-setting/redis/clear", {
        group: group === "all" ? undefined : group,
      });
      toast.success(response.data.message);
      setSelectedKey(null);
      await loadRedisKeys(group);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear Redis keys");
    }
  };

  const saveSmtp = async () => {
    setIsSmtpSaving(true);
    try {
      const payload = {
        ...smtpForm,
        password: smtpForm.password?.trim() ? smtpForm.password : undefined,
        port: Number(smtpForm.port),
      };
      const response = await put<SmtpResponse>("/system-setting/smtp", payload);
      const next = { ...defaultSmtpSettings, ...response.data.data, password: "" };
      setSmtpForm(next);
      setSavedSmtpForm(next);
      setSmtpStatus(next.enabled ? "idle" : "error");
      setSmtpStatusMessage(next.enabled ? "บันทึกแล้ว ยังไม่ได้ทดสอบ" : "SMTP ถูกปิดอยู่");
      toast.success("บันทึก SMTP settings แล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save SMTP settings");
    } finally {
      setIsSmtpSaving(false);
    }
  };

  const testSmtp = async () => {
    setIsSmtpTesting(true);
    try {
      const response = await post<ActionResponse>("/system-setting/smtp/test", {
        ...smtpForm,
        password: smtpForm.password?.trim() ? smtpForm.password : undefined,
        port: Number(smtpForm.port),
      });
      setSmtpStatus(response.data.success ? "ok" : "error");
      setSmtpStatusMessage(response.data.message);
      if (response.data.success) {
        setTestedSmtpSignature(currentSmtpSignature);
        toast.success(response.data.message);
      } else {
        setTestedSmtpSignature("");
        toast.error(response.data.message);
      }
    } catch (error) {
      setSmtpStatus("error");
      setTestedSmtpSignature("");
      const message = error instanceof Error ? error.message : "SMTP test failed";
      setSmtpStatusMessage(message);
      toast.error(message);
    } finally {
      setIsSmtpTesting(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error("กรุณากรอกอีเมลผู้รับ");
      return;
    }

    setIsSendingTestEmail(true);
    try {
      const response = await post<ActionResponse>("/system-setting/smtp/send-test", { to: testEmail.trim() });
      if (response.data.success) {
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send test email");
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  return (
    <section className="grid gap-5">
      <div className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-light-primary text-white shadow-sm dark:bg-dark-primary dark:text-dark-background">
              <Server className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                System Setting
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">Integrations</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                ตั้งค่า Redis และ SMTP พร้อมทดสอบการเชื่อมต่อและจัดการ cache
              </p>
            </div>
          </div>
          <span className="rounded-md bg-light-primary/10 px-2.5 py-1 text-xs font-semibold text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
            Live config
          </span>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <article className={cardClass}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-300">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-light-text dark:text-dark-text">Redis</h2>
                <p className="text-sm text-light-text-muted dark:text-dark-text-muted">Cache, session presence และ route/menu cache</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {redisForm.enabled && (
                <button type="button" onClick={() => void testRedis()} disabled={isRedisTesting || isRedisSaving} className={buttonSecondaryClass}>
                  {isRedisTesting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                  Test
                </button>
              )}
              <button type="button" onClick={() => void saveRedis()} disabled={!canUpdateSettings || isRedisSaving || isRedisLoading || !isRedisDirty || !canSaveRedis} className={buttonPrimaryClass}>
                {isRedisSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          </div>

          {isRedisLoading ? (
            <div className="grid min-h-32 place-items-center rounded-lg border border-theme bg-light-background dark:bg-dark-background">
              <RefreshCw className="h-5 w-5 animate-spin text-light-text-muted dark:text-dark-text-muted" />
            </div>
          ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-md border border-theme bg-light-background px-3 py-2.5 dark:bg-dark-background">
              <div>
                <p className="text-sm font-medium text-light-text dark:text-dark-text">Enable Redis</p>
                <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">ใช้ Redis สำหรับ cache และ online presence</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={redisForm.enabled}
                disabled={!canUpdateSettings}
                onClick={() => setRedisField("enabled", !redisForm.enabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  redisForm.enabled ? "bg-light-primary dark:bg-dark-primary" : "bg-light-text-muted/30 dark:bg-dark-text-muted/30"
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${redisForm.enabled ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
              </button>
            </div>
            {redisForm.enabled && (
              <>
                <div>
                  <label className={labelClass}>Key prefix</label>
                  <input className={inputClass} value={redisForm.prefix} disabled />
                </div>
                <div>
                  <label className={labelClass}>Host</label>
                  <input className={inputClass} value={redisForm.host} onChange={(event) => setRedisField("host", event.target.value)} disabled={!canUpdateSettings} />
                </div>
                <div>
                  <label className={labelClass}>Port</label>
                  <input className={inputClass} value={redisForm.port} onChange={(event) => setRedisField("port", Number(event.target.value) || 0)} disabled={!canUpdateSettings} type="number" min={1} />
                </div>
                <div>
                  <label className={labelClass}>Database</label>
                  <input className={inputClass} value={redisForm.db} onChange={(event) => setRedisField("db", Number(event.target.value) || 0)} disabled={!canUpdateSettings} type="number" min={0} />
                </div>
                <div>
                  <label className={labelClass}>Password</label>
                  <input
                    className={inputClass}
                    value={redisForm.password ?? ""}
                    onChange={(event) => setRedisField("password", event.target.value)}
                    placeholder={redisForm.hasPassword ? "ใช้รหัสผ่านเดิม ถ้าไม่กรอก" : "••••••••"}
                    type="password"
                    disabled={!canUpdateSettings}
                  />
                </div>
              </>
            )}
          </div>
          )}

          {redisForm.enabled ? (
            <>
              <div className={`mt-4 rounded-lg border px-4 py-3 text-sm font-medium ${
                redisStatus === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                  : redisStatus === "error"
                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
                    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
              }`}>
                <div className="flex items-center gap-2">
                  {redisStatus === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <ShieldAlert className="h-4 w-4 shrink-0" />}
                  <span>{redisStatusMessage}</span>
                </div>
                {isRedisDirty && !canSaveRedis && (
                  <span className="mt-1 block text-xs opacity-80">ต้อง Test config ชุดนี้ให้ผ่านก่อน จึงจะบันทึกได้</span>
                )}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-theme pt-4">
                <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                  ดูข้อมูล Redis หลังเชื่อมต่อสำเร็จ และล้าง cache ได้จาก modal
                </p>
                <button
                  type="button"
                  onClick={() => void openRedisModal()}
                  className={buttonSecondaryClass}
                >
                  <Eye className="h-4 w-4" />
                  View data
                </button>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-lg border border-theme bg-light-background px-4 py-3 text-sm text-light-text-muted dark:bg-dark-background dark:text-dark-text-muted">
              Redis ถูกปิดอยู่ จึงไม่แสดง connection fields, test และ cache viewer
            </div>
          )}
        </article>

        <article className={cardClass}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-light-text dark:text-dark-text">SMTP</h2>
                <p className="text-sm text-light-text-muted dark:text-dark-text-muted">Email delivery และ test mail</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {smtpForm.enabled && (
                <button type="button" onClick={() => void testSmtp()} disabled={isSmtpTesting || isSmtpSaving} className={buttonSecondaryClass}>
                  {isSmtpTesting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                  Test
                </button>
              )}
              <button type="button" onClick={() => void saveSmtp()} disabled={!canUpdateSettings || isSmtpSaving || isSmtpLoading || !isSmtpDirty || !canSaveSmtp} className={buttonPrimaryClass}>
                {isSmtpSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          </div>

          {isSmtpLoading ? (
            <div className="grid min-h-32 place-items-center rounded-lg border border-theme bg-light-background dark:bg-dark-background">
              <RefreshCw className="h-5 w-5 animate-spin text-light-text-muted dark:text-dark-text-muted" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-md border border-theme bg-light-background px-3 py-2.5 dark:bg-dark-background">
                <div>
                  <p className="text-sm font-medium text-light-text dark:text-dark-text">Enable SMTP</p>
                  <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">เปิดการส่งอีเมลของระบบ</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={smtpForm.enabled}
                  disabled={!canUpdateSettings}
                  onClick={() => setSmtpField("enabled", !smtpForm.enabled)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    smtpForm.enabled ? "bg-light-primary dark:bg-dark-primary" : "bg-light-text-muted/30 dark:bg-dark-text-muted/30"
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${smtpForm.enabled ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
                </button>
              </div>
              {smtpForm.enabled && (
                <>
                  <div>
                    <label className={labelClass}>Encryption</label>
                    <select
                      className={inputClass}
                      value={smtpForm.encryption}
                      onChange={(event) => setSmtpField("encryption", event.target.value as SmtpSettings["encryption"])}
                      disabled={!canUpdateSettings}
                    >
                      <option value="starttls">STARTTLS</option>
                      <option value="ssl">SSL/TLS</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Host</label>
                    <input className={inputClass} value={smtpForm.host} onChange={(event) => setSmtpField("host", event.target.value)} disabled={!canUpdateSettings} />
                  </div>
                  <div>
                    <label className={labelClass}>Port</label>
                    <input className={inputClass} value={smtpForm.port} onChange={(event) => setSmtpField("port", Number(event.target.value) || 0)} disabled={!canUpdateSettings} type="number" min={1} />
                  </div>
                  <div>
                    <label className={labelClass}>Username</label>
                    <input className={inputClass} value={smtpForm.user} onChange={(event) => setSmtpField("user", event.target.value)} placeholder="smtp user" disabled={!canUpdateSettings} />
                  </div>
                  <div>
                    <label className={labelClass}>Password</label>
                    <input
                      className={inputClass}
                      value={smtpForm.password ?? ""}
                      onChange={(event) => setSmtpField("password", event.target.value)}
                      placeholder={smtpForm.hasPassword ? "ใช้รหัสผ่านเดิม ถ้าไม่กรอก" : "••••••••"}
                      type="password"
                      disabled={!canUpdateSettings}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>From name</label>
                    <input className={inputClass} value={smtpForm.fromName} onChange={(event) => setSmtpField("fromName", event.target.value)} disabled={!canUpdateSettings} />
                  </div>
                  <div>
                    <label className={labelClass}>From email</label>
                    <input className={inputClass} value={smtpForm.fromEmail} onChange={(event) => setSmtpField("fromEmail", event.target.value)} disabled={!canUpdateSettings} />
                  </div>
                  <div>
                    <label className={labelClass}>Email app name</label>
                    <input className={inputClass} value={smtpForm.appName} onChange={(event) => setSmtpField("appName", event.target.value)} disabled={!canUpdateSettings} />
                  </div>
                  <div>
                    <label className={labelClass}>Email app URL</label>
                    <input className={inputClass} value={smtpForm.appUrl} onChange={(event) => setSmtpField("appUrl", event.target.value)} disabled={!canUpdateSettings} placeholder="https://example.com" />
                  </div>
                </>
              )}
            </div>
          )}

          {smtpForm.enabled ? (
            <div className="mt-5 border-t border-theme pt-4">
              <div className={`mb-4 rounded-lg border px-4 py-3 text-sm font-medium ${
                smtpStatus === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                  : smtpStatus === "error"
                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
                    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
              }`}>
                {smtpStatusMessage}
                {smtpForm.enabled && isSmtpDirty && !canSaveSmtp && (
                  <span className="mt-1 block text-xs opacity-80">ต้อง Test config ชุดนี้ให้ผ่านก่อน จึงจะบันทึกได้</span>
                )}
              </div>
              <label className={labelClass}>Send test email to</label>
              <div className="flex gap-2">
                <input className={inputClass} value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="admin@example.com" disabled={!canUpdateSettings || isSendingTestEmail} />
                <button type="button" onClick={() => void sendTestEmail()} disabled={!canUpdateSettings || isSendingTestEmail} className={buttonPrimaryClass}>
                  {isSendingTestEmail ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-theme bg-light-background px-4 py-3 text-sm text-light-text-muted dark:bg-dark-background dark:text-dark-text-muted">
              SMTP ถูกปิดอยู่ จึงไม่แสดง connection fields, test และ test email
            </div>
          )}
        </article>
      </div>

      {isRedisModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4 py-6">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-2xl dark:bg-dark-background-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-theme px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-light-text dark:text-dark-text">Redis Data</h2>
                <p className="text-sm text-light-text-muted dark:text-dark-text-muted">Key browser สำหรับดูข้อมูลและล้าง cache</p>
              </div>
              <button
                type="button"
                onClick={() => setIsRedisModalOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-text dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[1fr_360px]">
              <div className="min-h-0 overflow-auto p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {redisGroups.map((group) => (
                      <button
                        key={group}
                        type="button"
                        onClick={() => {
                          setRedisFilter(group);
                          setSelectedKey(null);
                        }}
                        className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          redisFilter === group
                            ? "border-light-primary bg-light-primary/10 text-light-primary dark:border-dark-primary dark:bg-dark-primary/10 dark:text-dark-primary"
                            : "border-theme text-light-text-muted hover:text-light-text dark:text-dark-text-muted dark:hover:text-dark-text"
                        }`}
                      >
                        {group}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void loadRedisKeys()} disabled={isRedisKeysLoading} className={buttonSecondaryClass}>
                      <RefreshCw className={`h-4 w-4 ${isRedisKeysLoading ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                    <button type="button" onClick={() => void clearRedisKeys(redisFilter)} disabled={!canUpdateSettings || filteredKeys.length === 0} className={buttonSecondaryClass}>
                      <Trash2 className="h-4 w-4" />
                      Clear filtered
                    </button>
                    <button type="button" onClick={() => void clearRedisKeys("all")} disabled={!canUpdateSettings || redisKeys.length === 0} className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                      <ShieldAlert className="h-4 w-4" />
                      Force clear all
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-theme">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="bg-light-background text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-background dark:text-dark-text-muted">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Key</th>
                        <th className="px-4 py-3 font-semibold">Type</th>
                        <th className="px-4 py-3 font-semibold">TTL</th>
                        <th className="px-4 py-3 font-semibold">Size</th>
                        <th className="px-4 py-3 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme bg-light-background-card dark:bg-dark-background-card">
                      {filteredKeys.map((item) => (
                        <tr
                          key={item.key}
                          className={selectedKey?.key === item.key ? "bg-light-primary/5 dark:bg-dark-primary/5" : undefined}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-light-text dark:text-dark-text">
                            <button type="button" onClick={() => void selectRedisKey(item.key)} className="text-left hover:text-light-primary dark:hover:text-dark-primary">
                              {item.key}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{item.type}</td>
                          <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{item.ttl}</td>
                          <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{item.size}</td>
                          <td className="px-4 py-3 text-right">
                            <button type="button" onClick={() => void deleteRedisKey(item.key)} disabled={!canUpdateSettings} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-500/10">
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <aside className="min-h-0 overflow-auto border-t border-theme bg-light-background p-5 dark:bg-dark-background lg:border-l lg:border-t-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">Selected key</p>
                {selectedKey ? (
                  <div className="mt-3 grid gap-3">
                    <div>
                      <p className="break-all font-mono text-sm font-semibold text-light-text dark:text-dark-text">{selectedKey.key}</p>
                      <p className="mt-1 text-xs text-light-text-muted dark:text-dark-text-muted">
                        {selectedKey.type} · {selectedKey.ttl} · {selectedKey.size}
                      </p>
                    </div>
                    <pre className="max-h-80 overflow-auto rounded-md border border-theme bg-light-background-card p-3 text-xs text-light-text dark:bg-dark-background-card dark:text-dark-text">
                      {selectedKey.value}
                    </pre>
                    <button type="button" onClick={() => void deleteRedisKey(selectedKey.key)} disabled={!canUpdateSettings} className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                      <Trash2 className="h-4 w-4" />
                      Delete this key
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-light-text-muted dark:text-dark-text-muted">เลือก key เพื่อดูข้อมูล</p>
                )}
              </aside>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default IntegrationsPage;
