import { useEffect, useMemo, useState } from "react";
import { Image, RefreshCw, Save, Settings, UploadCloud, X } from "lucide-react";
import { toast } from "react-toastify";
import { useSystemIdentity, type SystemIdentity } from "@/contexts/SystemIdentityContext";
import { useSession } from "@/contexts/SessionContext";

type FormState = SystemIdentity;

const inputClass =
  "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";

const labelClass = "mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted";

const fileButtonClass =
  "inline-flex cursor-pointer items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary";

const GeneralSettingsPage = () => {
  const { identity, isLoading, updateIdentity, resolveAssetUrl } = useSystemIdentity();
  const { user } = useSession();
  const [form, setForm] = useState<FormState>(identity);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isSuperAdmin = user?.roles?.includes("SUPERADMIN") ?? false;
  const canUpdateSettings = isSuperAdmin || Boolean(user?.permissions?.includes("settings.update"));

  useEffect(() => {
    setForm(identity);
  }, [identity]);

  const logoPreview = useMemo(
    () => logoFile ? URL.createObjectURL(logoFile) : resolveAssetUrl(form.logoUrl),
    [form.logoUrl, logoFile, resolveAssetUrl],
  );

  const faviconPreview = useMemo(
    () => faviconFile ? URL.createObjectURL(faviconFile) : resolveAssetUrl(form.faviconUrl),
    [faviconFile, form.faviconUrl, resolveAssetUrl],
  );

  useEffect(() => {
    return () => {
      if (logoFile && logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    };
  }, [logoFile, logoPreview]);

  useEffect(() => {
    return () => {
      if (faviconFile && faviconPreview.startsWith("blob:")) URL.revokeObjectURL(faviconPreview);
    };
  }, [faviconFile, faviconPreview]);

  const isDirty =
    JSON.stringify(form) !== JSON.stringify(identity) ||
    Boolean(logoFile) ||
    Boolean(faviconFile);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleReset = () => {
    setForm(identity);
    setLogoFile(null);
    setFaviconFile(null);
  };

  const handleSave = async () => {
    if (!canUpdateSettings) {
      toast.error("คุณไม่มีสิทธิ์แก้ไข System settings");
      return;
    }

    if (!form.systemName.trim()) {
      toast.error("System name is required");
      return;
    }

    const formData = new FormData();
    formData.append("systemName", form.systemName.trim());
    formData.append("systemSubtitle", form.systemSubtitle.trim());
    formData.append("logoUrl", form.logoUrl);
    formData.append("faviconUrl", form.faviconUrl);
    if (logoFile) formData.append("logo", logoFile);
    if (faviconFile) formData.append("favicon", faviconFile);

    setIsSaving(true);
    try {
      await updateIdentity(formData);
      setLogoFile(null);
      setFaviconFile(null);
      toast.success("System identity updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update system identity");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="grid gap-5">
      <div className="rounded-xl border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-light-primary text-white shadow-sm dark:bg-dark-primary dark:text-dark-background">
              <Settings className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                System Setting
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">General Settings</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                ตั้งค่าชื่อระบบ โลโก้ และ favicon ที่ใช้จริงในแอป
              </p>
              {!canUpdateSettings && (
                <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-300">
                  คุณมีสิทธิ์ดูเท่านั้น ต้องมี settings.update เพื่อแก้ไข
                </p>
              )}
            </div>
          </div>

          {canUpdateSettings && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={!isDirty || isSaving}
                className="inline-flex items-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary disabled:cursor-not-allowed disabled:opacity-50 dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isLoading || isSaving}
                className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
              >
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          )}
        </div>
      </div>

      <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
            <Image className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-light-text dark:text-dark-text">System Identity</h2>
            <p className="text-sm text-light-text-muted dark:text-dark-text-muted">ชื่อระบบ ข้อความรอง โลโก้ และ favicon</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="grid gap-4">
            <div>
              <label className={labelClass}>System name</label>
              <input
                className={inputClass}
                value={form.systemName}
                onChange={(event) => setField("systemName", event.target.value)}
                placeholder="IT Utils"
                disabled={!canUpdateSettings}
              />
            </div>
            <div>
              <label className={labelClass}>Subtitle</label>
              <input
                className={inputClass}
                value={form.systemSubtitle}
                onChange={(event) => setField("systemSubtitle", event.target.value)}
                placeholder="Internal tools and admin workspace"
                disabled={!canUpdateSettings}
              />
            </div>
            <div>
              <label className={labelClass}>Logo URL</label>
              <input
                className={inputClass}
                value={form.logoUrl}
                onChange={(event) => setField("logoUrl", event.target.value)}
                placeholder="/uploads/system/logo.png"
                disabled={!canUpdateSettings}
              />
            </div>
            <div>
              <label className={labelClass}>Favicon URL</label>
              <input
                className={inputClass}
                value={form.faviconUrl}
                onChange={(event) => setField("faviconUrl", event.target.value)}
                placeholder="/uploads/system/favicon.ico"
                disabled={!canUpdateSettings}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <label className={`${fileButtonClass} ${!canUpdateSettings ? "cursor-not-allowed opacity-50" : ""}`}>
                <UploadCloud className="h-4 w-4" />
                Upload logo
                <input
                  className="hidden"
                  type="file"
                  accept="image/*,.ico,.svg"
                  disabled={!canUpdateSettings}
                  onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <label className={`${fileButtonClass} ${!canUpdateSettings ? "cursor-not-allowed opacity-50" : ""}`}>
                <UploadCloud className="h-4 w-4" />
                Upload favicon
                <input
                  className="hidden"
                  type="file"
                  accept="image/*,.ico,.svg"
                  disabled={!canUpdateSettings}
                  onChange={(event) => setFaviconFile(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-theme bg-light-background p-4 dark:bg-dark-background">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
              Preview
            </p>
            <div className="flex items-center gap-3 rounded-lg border border-theme bg-light-background-card p-3 dark:bg-dark-background-card">
              {logoPreview ? (
                <img className="h-12 w-12 rounded-lg object-cover" src={logoPreview} alt={form.systemName} />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-light-primary text-sm font-bold text-white dark:bg-dark-primary dark:text-dark-background">
                  {form.systemName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <strong className="block truncate text-sm text-light-text dark:text-dark-text">{form.systemName || "System name"}</strong>
                <small className="mt-0.5 block truncate text-xs text-light-text-muted dark:text-dark-text-muted">
                  {form.systemSubtitle || "System subtitle"}
                </small>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-lg border border-theme bg-light-background-card p-3 dark:bg-dark-background-card">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-light-text dark:text-dark-text">Favicon</p>
                <p className="truncate text-xs text-light-text-muted dark:text-dark-text-muted">{form.faviconUrl || "No favicon selected"}</p>
              </div>
              {faviconPreview ? (
                <img className="h-8 w-8 rounded-md object-cover" src={faviconPreview} alt="Favicon" />
              ) : (
                <div className="grid h-8 w-8 place-items-center rounded-md bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                  <X className="h-4 w-4" />
                </div>
              )}
            </div>
          </div>
        </div>
      </article>
    </section>
  );
};

export default GeneralSettingsPage;
