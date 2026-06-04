import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Mail,
  Play,
  RefreshCw,
  Send,
  Server,
  ShieldAlert,
  Trash2,
  Wifi,
  XCircle,
} from "lucide-react";
import { useSession } from "@/contexts/SessionContext";

type RedisKey = {
  key: string;
  type: "string" | "hash" | "set" | "json";
  ttl: string;
  size: string;
  group: "auth" | "menus" | "routes" | "system";
};

const mockRedisKeys: RedisKey[] = [
  { key: "it-utils:auth:user:1", type: "json", ttl: "54s", size: "2.4 KB", group: "auth" },
  { key: "it-utils:menus:user:1", type: "json", ttl: "4m 12s", size: "8.1 KB", group: "menus" },
  { key: "it-utils:routes:GET", type: "json", ttl: "4m 58s", size: "6.7 KB", group: "routes" },
  { key: "it-utils:system:identity", type: "hash", ttl: "persistent", size: "912 B", group: "system" },
];

const statusClass = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  offline: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
};

const cardClass = "rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card";
const inputClass =
  "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary disabled:opacity-70 dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";
const labelClass = "mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted";

const IntegrationsPage = () => {
  const { user } = useSession();
  const [redisFilter, setRedisFilter] = useState<RedisKey["group"] | "all">("all");
  const isSuperAdmin = user?.roles?.includes("SUPERADMIN") ?? false;
  const canUpdateSettings = isSuperAdmin || Boolean(user?.permissions?.includes("settings.update"));

  const filteredKeys = useMemo(
    () => mockRedisKeys.filter((item) => redisFilter === "all" || item.group === redisFilter),
    [redisFilter],
  );

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
                จัดการการเชื่อมต่อ Redis และ SMTP พร้อมเครื่องมือทดสอบและล้าง cache
              </p>
            </div>
          </div>
          <span className="rounded-md bg-light-primary/10 px-2.5 py-1 text-xs font-semibold text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
            Mock UI
          </span>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <article className={cardClass}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-300">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-light-text dark:text-dark-text">Redis</h2>
                <p className="text-sm text-light-text-muted dark:text-dark-text-muted">Connection, key browser และ cache cleanup</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10">
                <Wifi className="h-4 w-4" />
                Test connection
              </button>
              <button type="button" className="inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10">
                <RefreshCw className="h-4 w-4" />
                Refresh keys
              </button>
            </div>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-4">
            {[
              ["Host", "172.17.235.1"],
              ["Port", "1999"],
              ["Database", "0"],
              ["Prefix", "it-utils:"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-theme bg-light-background px-3 py-2.5 dark:bg-dark-background">
                <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">{label}</p>
                <p className="mt-1 truncate font-mono text-sm text-light-text dark:text-dark-text">{value}</p>
              </div>
            ))}
          </div>

          <div className={`mb-4 rounded-lg border px-4 py-3 text-sm font-medium ${statusClass.healthy}`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Mock status: Redis connected, latency 3ms</span>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(["all", "auth", "menus", "routes", "system"] as const).map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => setRedisFilter(group)}
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
              <button type="button" disabled={!canUpdateSettings} className="inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-dark-text dark:hover:bg-dark-primary/10">
                <Trash2 className="h-4 w-4" />
                Clear filtered
              </button>
              <button type="button" disabled={!canUpdateSettings} className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                <ShieldAlert className="h-4 w-4" />
                Force clear all
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-theme">
            <table className="w-full min-w-[720px] text-left text-sm">
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
                  <tr key={item.key}>
                    <td className="px-4 py-3 font-mono text-xs text-light-text dark:text-dark-text">{item.key}</td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{item.type}</td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{item.ttl}</td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{item.size}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" disabled={!canUpdateSettings} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-500/10">
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className={cardClass}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-light-text dark:text-dark-text">SMTP</h2>
                <p className="text-sm text-light-text-muted dark:text-dark-text-muted">Mail server และ test email</p>
              </div>
            </div>
            <button type="button" className="inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10">
              <Wifi className="h-4 w-4" />
              Test connection
            </button>
          </div>

          <div className={`mb-4 rounded-lg border px-4 py-3 text-sm font-medium ${statusClass.warning}`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Mock status: SMTP configured, test email not sent yet</span>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Host</label>
                <input className={inputClass} value="smtp.gmail.com" disabled />
              </div>
              <div>
                <label className={labelClass}>Port</label>
                <input className={inputClass} value="587" disabled />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Secure</label>
                <input className={inputClass} value="STARTTLS" disabled />
              </div>
              <div>
                <label className={labelClass}>From email</label>
                <input className={inputClass} value="noreply@example.com" disabled />
              </div>
            </div>
            <div>
              <label className={labelClass}>Send test email to</label>
              <div className="flex gap-2">
                <input className={inputClass} placeholder="admin@example.com" disabled={!canUpdateSettings} />
                <button type="button" disabled={!canUpdateSettings} className="inline-flex shrink-0 items-center gap-2 rounded-md bg-light-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:cursor-not-allowed disabled:opacity-50 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover">
                  <Send className="h-4 w-4" />
                  Send
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-theme bg-light-background p-4 dark:bg-dark-background">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
              Next API tasks
            </p>
            <div className="space-y-3 text-sm text-light-text-muted dark:text-dark-text-muted">
              <div className="flex items-start gap-2">
                <Play className="mt-0.5 h-4 w-4 shrink-0 text-light-primary dark:text-dark-primary" />
                <span>ต่อ endpoint สำหรับ test Redis/SMTP connection</span>
              </div>
              <div className="flex items-start gap-2">
                <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-light-primary dark:text-dark-primary" />
                <span>ต่อ endpoint สำหรับลบ Redis key ทีละตัว และ force clear ทั้งหมด</span>
              </div>
              <div className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-light-primary dark:text-dark-primary" />
                <span>เพิ่ม confirmation modal ก่อน clear all เพื่อกันลบ cache ผิด</span>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
};

export default IntegrationsPage;
