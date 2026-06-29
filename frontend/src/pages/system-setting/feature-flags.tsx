import { useEffect, useState } from "react";
import { Bell, Palette, RefreshCw, Search, SunMoon, ToggleLeft } from "lucide-react";
import { toast } from "react-toastify";
import { useApi } from "@/hooks/useApi";
import { useFeatureFlags, type FeatureFlags } from "@/contexts/FeatureFlagsContext";
import { useSession } from "@/contexts/SessionContext";

type FeatureFlagsResponse = {
  success: boolean;
  data: FeatureFlags;
};

const flagItems: {
  key: keyof FeatureFlags;
  title: string;
  description: string;
  icon: typeof Search;
}[] = [
  {
    key: "navbarSearch",
    title: "Navbar search",
    description: "ช่องค้นหาบนแถบด้านบน",
    icon: Search,
  },
  {
    key: "notifications",
    title: "Notifications",
    description: "ปุ่มแจ้งเตือน รายการแจ้งเตือน toast และ realtime notification",
    icon: Bell,
  },
  {
    key: "appearancePanel",
    title: "Appearance",
    description: "ปุ่มตั้งค่าหน้าตา สี และรูปแบบการแสดงผล",
    icon: Palette,
  },
  {
    key: "themeToggle",
    title: "Dark / Light mode",
    description: "ปุ่มสลับโหมดมืดและสว่างบน navbar",
    icon: SunMoon,
  },
];

const emptyFlags: FeatureFlags = {
  navbarSearch: false,
  notifications: false,
  appearancePanel: false,
  themeToggle: false,
};

const FeatureFlagsPage = () => {
  const { get, put } = useApi();
  const { refreshFlags } = useFeatureFlags();
  const { user } = useSession();
  const [form, setForm] = useState<FeatureFlags>(emptyFlags);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof FeatureFlags | null>(null);
  const isSuperAdmin = user?.roles?.includes("SUPERADMIN") ?? false;
  const permissions = user?.permissions ?? [];
  const canUpdate = isSuperAdmin || permissions.includes("settings.update") || permissions.includes("settings.feature-flags.update");

  const load = async () => {
    setLoading(true);
    try {
      const response = await get<FeatureFlagsResponse>("/system-setting/feature-flags");
      const next = { ...emptyFlags, ...response.data.data };
      setForm(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cannot load feature flags");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleFlag = async (key: keyof FeatureFlags) => {
    if (!canUpdate || loading || savingKey) return;
    const previous = form;
    const nextValue = !previous[key];
    const optimistic = { ...previous, [key]: nextValue };
    setForm(optimistic);
    setSavingKey(key);
    try {
      const response = await put<FeatureFlagsResponse>("/system-setting/feature-flags", { [key]: nextValue });
      const next = { ...emptyFlags, ...response.data.data };
      setForm(next);
      await refreshFlags();
    } catch (error) {
      setForm(previous);
      toast.error(error instanceof Error ? error.message : "Cannot save feature flags");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-theme bg-light-background-card shadow-soft dark:bg-dark-background-card">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-md bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
              <ToggleLeft className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">Settings</p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">Feature Flags</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                เปิดหรือปิดฟีเจอร์ที่แสดงบน navbar
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 disabled:opacity-60 dark:text-dark-text dark:hover:bg-dark-primary/10"
              onClick={() => void load()}
              disabled={loading || Boolean(savingKey)}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {flagItems.map(({ key, title, description, icon: Icon }) => {
          const enabled = form[key];
          const isSaving = savingKey === key;
          return (
            <article key={key} className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${enabled ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-light-text-muted/10 text-light-text-muted dark:text-dark-text-muted"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-light-text dark:text-dark-text">{title}</h2>
                    <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">{description}</p>
                    <p className={`mt-3 text-xs font-semibold ${enabled ? "text-emerald-600 dark:text-emerald-400" : "text-light-text-muted dark:text-dark-text-muted"}`}>
                      {enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  disabled={!canUpdate || loading || Boolean(savingKey)}
                  onClick={() => void toggleFlag(key)}
                  className={`relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${enabled ? "bg-light-primary dark:bg-dark-primary" : "bg-light-text-muted/30 dark:bg-dark-text-muted/30"}`}
                >
                  {isSaving ? (
                    <span className="absolute inset-0 grid place-items-center">
                      <RefreshCw className="h-4 w-4 animate-spin text-white" />
                    </span>
                  ) : (
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] ${enabled ? "left-6" : "left-1"}`} />
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default FeatureFlagsPage;
