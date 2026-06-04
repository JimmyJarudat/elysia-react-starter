import { useEffect, useMemo, useState } from "react";
import { Building2, Clock3, Image, Link2, Mail, RefreshCw, Save, Settings, ShieldCheck, UploadCloud, UserPlus, Wrench, X } from "lucide-react";
import { toast } from "react-toastify";
import { useSystemIdentity, type SystemIdentity } from "@/contexts/SystemIdentityContext";
import { useSession } from "@/contexts/SessionContext";
import { useApi } from "@/hooks/useApi";

type FormState = SystemIdentity;
type OrganizationSupportForm = {
  organizationName: string;
  supportEmail: string;
  websiteUrl: string;
  helpCenterUrl: string;
};

type OrganizationSupportResponse = {
  success: boolean;
  data: OrganizationSupportForm;
};

const inputClass =
  "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";

const labelClass = "mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted";

const fileButtonClass =
  "inline-flex cursor-pointer items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary";

const GeneralSettingsPage = () => {
  const { identity, isLoading, updateIdentity, resolveAssetUrl } = useSystemIdentity();
  const { get, put } = useApi();
  const { user } = useSession();
  const [form, setForm] = useState<FormState>(identity);
  const [organizationForm, setOrganizationForm] = useState<OrganizationSupportForm>({
    organizationName: "",
    supportEmail: "",
    websiteUrl: "",
    helpCenterUrl: "/help",
  });
  const [savedOrganizationForm, setSavedOrganizationForm] = useState<OrganizationSupportForm>(organizationForm);
  const [isOrganizationLoading, setIsOrganizationLoading] = useState(true);
  const [isOrganizationSaving, setIsOrganizationSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isSuperAdmin = user?.roles?.includes("SUPERADMIN") ?? false;
  const canUpdateSettings = isSuperAdmin || Boolean(user?.permissions?.includes("settings.update"));

  useEffect(() => {
    setForm(identity);
  }, [identity]);

  useEffect(() => {
    let active = true;

    const loadOrganizationSupport = async () => {
      setIsOrganizationLoading(true);
      try {
        const response = await get<OrganizationSupportResponse>("/system-setting/organization-support");
        if (!active) return;
        const next = response.data.data;
        setOrganizationForm(next);
        setSavedOrganizationForm(next);
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "Failed to load organization settings");
        }
      } finally {
        if (active) {
          setIsOrganizationLoading(false);
        }
      }
    };

    void loadOrganizationSupport();

    return () => {
      active = false;
    };
  }, []);

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
  const isOrganizationDirty = JSON.stringify(organizationForm) !== JSON.stringify(savedOrganizationForm);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setOrganizationField = <K extends keyof OrganizationSupportForm>(key: K, value: OrganizationSupportForm[K]) => {
    setOrganizationForm((current) => ({ ...current, [key]: value }));
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

  const handleOrganizationReset = () => {
    setOrganizationForm(savedOrganizationForm);
  };

  const handleOrganizationSave = async () => {
    if (!canUpdateSettings) {
      toast.error("คุณไม่มีสิทธิ์แก้ไข System settings");
      return;
    }

    setIsOrganizationSaving(true);
    try {
      const response = await put<OrganizationSupportResponse>("/system-setting/organization-support", organizationForm);
      const next = response.data.data;
      setOrganizationForm(next);
      setSavedOrganizationForm(next);
      toast.success("Organization support updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update organization settings");
    } finally {
      setIsOrganizationSaving(false);
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

        </div>
      </div>

      <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
              <Image className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-light-text dark:text-dark-text">System Identity</h2>
              <p className="text-sm text-light-text-muted dark:text-dark-text-muted">ชื่อระบบ ข้อความรอง โลโก้ และ favicon</p>
            </div>
          </div>
          {canUpdateSettings && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={!isDirty || isSaving}
                className="inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary disabled:cursor-not-allowed disabled:opacity-50 dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isLoading || isSaving}
                className="inline-flex items-center gap-2 rounded-md bg-light-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
              >
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          )}
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

      <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-light-text dark:text-dark-text">Organization & Support</h2>
              <p className="text-sm text-light-text-muted dark:text-dark-text-muted">โครงสำหรับข้อมูลหน่วยงานและช่องทางช่วยเหลือ</p>
            </div>
          </div>
          {canUpdateSettings && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleOrganizationReset}
                disabled={!isOrganizationDirty || isOrganizationSaving}
                className="inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary disabled:cursor-not-allowed disabled:opacity-50 dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </button>
              <button
                type="button"
                onClick={() => void handleOrganizationSave()}
                disabled={isOrganizationLoading || isOrganizationSaving}
                className="inline-flex items-center gap-2 rounded-md bg-light-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
              >
                {isOrganizationSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Organization name</label>
              <input
                className={inputClass}
                value={organizationForm.organizationName}
                onChange={(event) => setOrganizationField("organizationName", event.target.value)}
                disabled={!canUpdateSettings || isOrganizationLoading}
                placeholder="Nova Technology"
              />
            </div>
            <div>
              <label className={labelClass}>Support email</label>
              <input
                className={inputClass}
                value={organizationForm.supportEmail}
                onChange={(event) => setOrganizationField("supportEmail", event.target.value)}
                disabled={!canUpdateSettings || isOrganizationLoading}
                placeholder="support@example.com"
              />
            </div>
            <div>
              <label className={labelClass}>Website URL</label>
              <input
                className={inputClass}
                value={organizationForm.websiteUrl}
                onChange={(event) => setOrganizationField("websiteUrl", event.target.value)}
                disabled={!canUpdateSettings || isOrganizationLoading}
                placeholder="https://example.com"
              />
            </div>
            <div>
              <label className={labelClass}>Help center URL</label>
              <input
                className={inputClass}
                value={organizationForm.helpCenterUrl}
                onChange={(event) => setOrganizationField("helpCenterUrl", event.target.value)}
                disabled={!canUpdateSettings || isOrganizationLoading}
                placeholder="/help"
              />
            </div>
          </div>

          <div className="rounded-lg border border-theme bg-light-background p-4 dark:bg-dark-background">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
              Planned keys
            </p>
            <div className="space-y-3 text-sm text-light-text-muted dark:text-dark-text-muted">
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-light-primary dark:text-dark-primary" />
                <span>ข้อมูลหน่วยงานควรอยู่ใน General เพราะเป็นข้อมูลระดับระบบ</span>
              </div>
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-light-primary dark:text-dark-primary" />
                <span>Support email ใช้แสดงในหน้า help, error หรือ email template ได้</span>
              </div>
              <div className="flex items-start gap-2">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-light-primary dark:text-dark-primary" />
                <span>URL ต่าง ๆ ใช้ค่าจริงจาก system_config แล้ว</span>
              </div>
            </div>
          </div>
        </div>
      </article>

      <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-300">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-light-text dark:text-dark-text">Registration & Approval</h2>
              <p className="text-sm text-light-text-muted dark:text-dark-text-muted">โครงสำหรับควบคุมการสมัครสมาชิกและการอนุมัติผู้ใช้ใหม่</p>
            </div>
          </div>
          <span className="rounded-md bg-light-primary/10 px-2.5 py-1 text-xs font-semibold text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
            Scaffold
          </span>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-md border border-theme bg-light-background px-3 py-2.5 dark:bg-dark-background">
              <div>
                <p className="text-sm font-medium text-light-text dark:text-dark-text">Self registration</p>
                <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">อนุญาตให้ผู้ใช้สมัครเองจากหน้า login</p>
              </div>
              <span className="rounded-md bg-light-text-muted/10 px-2 py-1 text-xs font-semibold text-light-text-muted dark:bg-dark-text-muted/10 dark:text-dark-text-muted">
                Off
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-theme bg-light-background px-3 py-2.5 dark:bg-dark-background">
              <div>
                <p className="text-sm font-medium text-light-text dark:text-dark-text">Require approval</p>
                <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">บัญชีใหม่ต้องรอ admin อนุมัติก่อนใช้งาน</p>
              </div>
              <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                On
              </span>
            </div>
            <div>
              <label className={labelClass}>Default role</label>
              <input className={inputClass} value="USER" disabled />
            </div>
            <div>
              <label className={labelClass}>Creation type</label>
              <input className={inputClass} value="SELF_REGISTER" disabled />
            </div>
          </div>

          <div className="rounded-lg border border-theme bg-light-background p-4 dark:bg-dark-background">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
              Planned behavior
            </p>
            <div className="space-y-3 text-sm text-light-text-muted dark:text-dark-text-muted">
              <div className="flex items-start gap-2">
                <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-light-primary dark:text-dark-primary" />
                <span>ถ้าเปิด register จะให้สมัครจาก public page ได้</span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-light-primary dark:text-dark-primary" />
                <span>ถ้าเปิด approval ผู้ใช้ใหม่จะยัง login ไม่ได้จนกว่าจะอนุมัติ</span>
              </div>
              <div className="flex items-start gap-2">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-light-primary dark:text-dark-primary" />
                <span>รอบถัดไปค่อยผูกกับ system_config และหน้า register จริง</span>
              </div>
            </div>
          </div>
        </div>
      </article>

      <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-300">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-light-text dark:text-dark-text">Regional & System Mode</h2>
              <p className="text-sm text-light-text-muted dark:text-dark-text-muted">โครงสำหรับ timezone รูปแบบเวลา และโหมดปิดปรับปรุงระบบ</p>
            </div>
          </div>
          <span className="rounded-md bg-light-primary/10 px-2.5 py-1 text-xs font-semibold text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
            Scaffold
          </span>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Timezone</label>
              <select className={inputClass} value="Asia/Bangkok" disabled>
                <option value="Asia/Bangkok">Asia/Bangkok</option>
                <option value="UTC">UTC</option>
                <option value="Asia/Singapore">Asia/Singapore</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Date format</label>
              <select className={inputClass} value="DD/MM/YYYY" disabled>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Time format</label>
              <select className={inputClass} value="24-hour" disabled>
                <option value="24-hour">24-hour</option>
                <option value="12-hour">12-hour</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-theme bg-light-background px-3 py-2.5 dark:bg-dark-background">
              <div>
                <p className="text-sm font-medium text-light-text dark:text-dark-text">Maintenance mode</p>
                <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">ปิดระบบชั่วคราวเพื่อปรับปรุง</p>
              </div>
              <span className="rounded-md bg-light-text-muted/10 px-2 py-1 text-xs font-semibold text-light-text-muted dark:bg-dark-text-muted/10 dark:text-dark-text-muted">
                Off
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-theme bg-light-background p-4 dark:bg-dark-background">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
              Planned keys
            </p>
            <div className="space-y-3 text-sm text-light-text-muted dark:text-dark-text-muted">
              <div className="flex items-start gap-2">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-light-primary dark:text-dark-primary" />
                <span>Timezone และ format จะใช้กับการแสดงวันที่ระดับระบบ</span>
              </div>
              <div className="flex items-start gap-2">
                <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-light-primary dark:text-dark-primary" />
                <span>Maintenance mode จะให้ backend/frontend บล็อกหน้าที่ไม่ควรเข้าในช่วงปิดปรับปรุง</span>
              </div>
              <div className="flex items-start gap-2">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-light-primary dark:text-dark-primary" />
                <span>รอบถัดไปค่อยเพิ่ม seed keys และต่อ API จริง</span>
              </div>
            </div>
          </div>
        </div>
      </article>
    </section>
  );
};

export default GeneralSettingsPage;
