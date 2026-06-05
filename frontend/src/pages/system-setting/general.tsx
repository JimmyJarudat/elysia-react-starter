import { useEffect, useMemo, useState } from "react";
import { Building2, Clock3, Image, RefreshCw, Save, Settings, ShieldCheck, UploadCloud, UserPlus, X } from "lucide-react";
import { toast } from "react-toastify";
import { useSystemIdentity, type SystemIdentity } from "@/contexts/SystemIdentityContext";
import { useSession } from "@/contexts/SessionContext";
import { useApi } from "@/hooks/useApi";
import { useRegional } from "@/contexts/RegionalContext";

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

type RegistrationApprovalForm = {
  enabled: boolean;
  requireApproval: boolean;
  defaultRole: string;
};

type RegistrationApprovalResponse = {
  success: boolean;
  data: RegistrationApprovalForm;
};

type RoleOption = {
  id: string;
  name: string;
  priority: number;
  description?: string | null;
};

type RolesPermissionsResponse = {
  success: boolean;
  data: {
    roles: RoleOption[];
  };
};

type RegionalForm = {
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  yearEra: "CE" | "BE";
};

type MaintenanceForm = {
  enabled: boolean;
  message: string;
};

type RegionalResponse = {
  success: boolean;
  data: RegionalForm;
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
  const [registrationForm, setRegistrationForm] = useState<RegistrationApprovalForm>({
    enabled: false,
    requireApproval: true,
    defaultRole: "USER",
  });
  const [savedRegistrationForm, setSavedRegistrationForm] = useState<RegistrationApprovalForm>(registrationForm);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [isRegistrationLoading, setIsRegistrationLoading] = useState(true);
  const [isRegistrationSaving, setIsRegistrationSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isSuperAdmin = user?.roles?.includes("SUPERADMIN") ?? false;
  const perms = user?.permissions ?? [];
  // broad fallback: settings.read / settings.update ยังคงใช้ได้ครบทุก section
  const r = (p: string) => isSuperAdmin || perms.includes("settings.read")   || perms.includes(p);
  const w = (p: string) => isSuperAdmin || perms.includes("settings.update") || perms.includes(p);

  const canReadIdentity      = r("settings.general.identity.read");
  const canUpdateIdentity    = w("settings.general.identity.update");
  const canReadOrganization  = r("settings.general.organization.read");
  const canUpdateOrganization= w("settings.general.organization.update");
  const canReadRegistration  = r("settings.general.registration.read");
  const canUpdateRegistration= w("settings.general.registration.update");
  const canReadRegional      = r("settings.general.regional.read");
  const canUpdateRegional    = w("settings.general.regional.update");
  const canReadMaintenance   = r("settings.general.maintenance.read");
  const canUpdateMaintenance = w("settings.general.maintenance.update");

  const regionalDefaults: RegionalForm = { timezone: "Asia/Bangkok", dateFormat: "DD/MM/YYYY", timeFormat: "24h", yearEra: "CE" };
  const [regionalForm, setRegionalForm] = useState<RegionalForm>(regionalDefaults);
  const [savedRegionalForm, setSavedRegionalForm] = useState<RegionalForm>(regionalDefaults);
  const [isRegionalLoading, setIsRegionalLoading] = useState(true);
  const [isRegionalSaving, setIsRegionalSaving] = useState(false);

  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceForm>({ enabled: false, message: "" });
  const [savedMaintenanceForm, setSavedMaintenanceForm] = useState<MaintenanceForm>({ enabled: false, message: "" });
  const [isMaintenanceLoading, setIsMaintenanceLoading] = useState(true);
  const [isMaintenanceSaving, setIsMaintenanceSaving] = useState(false);

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

  useEffect(() => {
    let active = true;

    const loadRegistrationApproval = async () => {
      setIsRegistrationLoading(true);
      try {
        const [response, rolesResponse] = await Promise.all([
          get<RegistrationApprovalResponse>("/system-setting/registration"),
          get<RolesPermissionsResponse>("/access-control/roles-permissions"),
        ]);
        if (!active) return;
        const next = response.data.data;
        const roles = rolesResponse.data.data.roles ?? [];
        setRegistrationForm(next);
        setSavedRegistrationForm(next);
        setRoleOptions(roles);
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "Failed to load registration settings");
        }
      } finally {
        if (active) {
          setIsRegistrationLoading(false);
        }
      }
    };

    void loadRegistrationApproval();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsRegionalLoading(true);
      try {
        const res = await get<RegionalResponse>("/system-setting/regional");
        if (!active) return;
        setRegionalForm(res.data.data);
        setSavedRegionalForm(res.data.data);
      } catch {
        if (active) toast.error("Failed to load regional settings");
      } finally {
        if (active) setIsRegionalLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  // ── Maintenance load + save ───────────────────────────────────────────────

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsMaintenanceLoading(true);
      try {
        const res = await get<{ success: boolean; data: MaintenanceForm }>("/system-setting/maintenance");
        if (!active) return;
        setMaintenanceForm(res.data.data);
        setSavedMaintenanceForm(res.data.data);
      } catch {
        if (active) toast.error("Failed to load maintenance settings");
      } finally {
        if (active) setIsMaintenanceLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const handleMaintenanceSave = async () => {
    setIsMaintenanceSaving(true);
    try {
      const res = await put<{ success: boolean; data: MaintenanceForm }>("/system-setting/maintenance", maintenanceForm);
      setSavedMaintenanceForm(res.data.data);
      toast.success("บันทึก Maintenance settings แล้ว");
    } catch {
      toast.error("Failed to save maintenance settings");
    } finally {
      setIsMaintenanceSaving(false);
    }
  };

  const isMaintenanceDirty = JSON.stringify(maintenanceForm) !== JSON.stringify(savedMaintenanceForm);

  // ── Regional save ─────────────────────────────────────────────────────────

  const handleRegionalSave = async () => {
    setIsRegionalSaving(true);
    try {
      const res = await put<RegionalResponse>("/system-setting/regional", regionalForm);
      setSavedRegionalForm(res.data.data);
      toast.success("บันทึก Regional settings แล้ว");
    } catch {
      toast.error("Failed to save regional settings");
    } finally {
      setIsRegionalSaving(false);
    }
  };

  const isRegionalDirty = JSON.stringify(regionalForm) !== JSON.stringify(savedRegionalForm);

  const { formatDateTime: currentFormatDateTime } = useRegional();
  const previewNow = useMemo(() => {
    const now = new Date();
    const { timezone, dateFormat, timeFormat, yearEra } = regionalForm;
    const BE_OFFSET = 543;
    const parts = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: timezone }).formatToParts(now);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
    const rawYear = parseInt(new Intl.DateTimeFormat("en-CA", { year: "numeric", timeZone: timezone }).format(now), 10);
    const year = String(yearEra === "BE" ? rawYear + BE_OFFSET : rawYear);
    let date: string;
    switch (dateFormat) {
      case "YYYY-MM-DD":   date = `${year}-${get("month")}-${get("day")}`; break;
      case "DD-MM-YYYY":   date = `${get("day")}-${get("month")}-${year}`; break;
      case "MM/DD/YYYY":   date = `${get("month")}/${get("day")}/${year}`; break;
      case "YYYY/MM/DD":   date = `${year}/${get("month")}/${get("day")}`; break;
      case "D MMM YYYY":   { const m = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: timezone }).format(now); date = `${parseInt(get("day"), 10)} ${m} ${year}`; break; }
      case "D MMMM YYYY":  { const m = new Intl.DateTimeFormat("th-TH", { month: "long", timeZone: timezone }).format(now); date = `${parseInt(get("day"), 10)} ${m} ${year}`; break; }
      default:             date = `${get("day")}/${get("month")}/${year}`;
    }
    const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: timeFormat === "12h", timeZone: timezone }).format(now);
    return `${date} ${time}`;
  }, [regionalForm]);

  const logoPreview = useMemo(
    () => logoFile ? URL.createObjectURL(logoFile) : resolveAssetUrl(form.logoUrl),
    [form.logoUrl, logoFile, resolveAssetUrl],
  );

  const faviconPreview = useMemo(
    () => faviconFile ? URL.createObjectURL(faviconFile) : resolveAssetUrl(form.faviconUrl),
    [faviconFile, form.faviconUrl, resolveAssetUrl],
  );

  const documentTitlePreview = useMemo(() => {
    const baseTitle = form.appTitle?.trim() || form.systemName?.trim() || "IT Utils";
    return form.titleMode === "title_section" ? `${baseTitle} - System Settings` : baseTitle;
  }, [form.appTitle, form.systemName, form.titleMode]);

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
  const isRegistrationDirty = JSON.stringify(registrationForm) !== JSON.stringify(savedRegistrationForm);
  const isSelectedDefaultRoleMissing = Boolean(
    registrationForm.defaultRole &&
    roleOptions.length > 0 &&
    !roleOptions.some((role) => role.id === registrationForm.defaultRole),
  );
  const selectedDefaultRole = roleOptions.find((role) => role.id === registrationForm.defaultRole);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setOrganizationField = <K extends keyof OrganizationSupportForm>(key: K, value: OrganizationSupportForm[K]) => {
    setOrganizationForm((current) => ({ ...current, [key]: value }));
  };

  const setRegistrationField = <K extends keyof RegistrationApprovalForm>(key: K, value: RegistrationApprovalForm[K]) => {
    setRegistrationForm((current) => ({ ...current, [key]: value }));
  };

  const handleReset = () => {
    setForm(identity);
    setLogoFile(null);
    setFaviconFile(null);
  };

  const handleSave = async () => {
    if (!canUpdateIdentity) {
      toast.error("คุณไม่มีสิทธิ์แก้ไข System Identity");
      return;
    }

    if (!form.systemName.trim()) {
      toast.error("System name is required");
      return;
    }

    const formData = new FormData();
    formData.append("systemName", form.systemName.trim());
    formData.append("systemSubtitle", form.systemSubtitle.trim());
    formData.append("appTitle", form.appTitle.trim());
    formData.append("titleMode", form.titleMode);
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
    if (!canUpdateOrganization) {
      toast.error("คุณไม่มีสิทธิ์แก้ไข Organization & Support");
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

  const handleRegistrationReset = () => {
    setRegistrationForm(savedRegistrationForm);
  };

  const handleRegistrationSave = async () => {
    if (!canUpdateRegistration) {
      toast.error("คุณไม่มีสิทธิ์แก้ไข Registration & Approval");
      return;
    }

    setIsRegistrationSaving(true);
    try {
      const response = await put<RegistrationApprovalResponse>("/system-setting/registration", {
        ...registrationForm,
        defaultRole: registrationForm.defaultRole.trim().toUpperCase(),
      });
      const next = response.data.data;
      setRegistrationForm(next);
      setSavedRegistrationForm(next);
      toast.success("Registration settings updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update registration settings");
    } finally {
      setIsRegistrationSaving(false);
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
                จัดการข้อมูลพื้นฐานของระบบ การสมัครสมาชิก รูปแบบเวลา และโหมดปิดปรับปรุง
              </p>
              {!canUpdateIdentity && !canUpdateOrganization && !canUpdateRegistration && !canUpdateRegional && !canUpdateMaintenance && (
                <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-300">
                  คุณมีสิทธิ์ดูเท่านั้น ไม่มี permission แก้ไขส่วนใด
                </p>
              )}
            </div>
          </div>

        </div>
      </div>

      {canReadIdentity && (
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
          {canUpdateIdentity && (
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
                disabled={!canUpdateIdentity}
              />
            </div>
            <div>
              <label className={labelClass}>Subtitle</label>
              <input
                className={inputClass}
                value={form.systemSubtitle}
                onChange={(event) => setField("systemSubtitle", event.target.value)}
                placeholder="Internal tools and admin workspace"
                disabled={!canUpdateIdentity}
              />
            </div>
            <div>
              <label className={labelClass}>Browser title</label>
              <input
                className={inputClass}
                value={form.appTitle}
                onChange={(event) => setField("appTitle", event.target.value)}
                placeholder="IT Utils"
                disabled={!canUpdateIdentity}
              />
            </div>
            <div>
              <label className={labelClass}>Title display</label>
              <select
                className={inputClass}
                value={form.titleMode}
                onChange={(event) => setField("titleMode", event.target.value as FormState["titleMode"])}
                disabled={!canUpdateIdentity}
              >
                <option value="title_only">Title only</option>
                <option value="title_section">Title - first page</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Logo URL</label>
              <input
                className={inputClass}
                value={form.logoUrl}
                onChange={(event) => setField("logoUrl", event.target.value)}
                placeholder="/uploads/system/logo.png"
                disabled={!canUpdateIdentity}
              />
            </div>
            <div>
              <label className={labelClass}>Favicon URL</label>
              <input
                className={inputClass}
                value={form.faviconUrl}
                onChange={(event) => setField("faviconUrl", event.target.value)}
                placeholder="/uploads/system/favicon.ico"
                disabled={!canUpdateIdentity}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <label className={`${fileButtonClass} ${!canUpdateIdentity ? "cursor-not-allowed opacity-50" : ""}`}>
                <UploadCloud className="h-4 w-4" />
                Upload logo
                <input
                  className="hidden"
                  type="file"
                  accept="image/*,.ico,.svg"
                  disabled={!canUpdateIdentity}
                  onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <label className={`${fileButtonClass} ${!canUpdateIdentity ? "cursor-not-allowed opacity-50" : ""}`}>
                <UploadCloud className="h-4 w-4" />
                Upload favicon
                <input
                  className="hidden"
                  type="file"
                  accept="image/*,.ico,.svg"
                  disabled={!canUpdateIdentity}
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

            <div className="mt-4 rounded-lg border border-theme bg-light-background-card p-3 dark:bg-dark-background-card">
              <p className="text-sm font-semibold text-light-text dark:text-dark-text">Browser title</p>
              <p className="mt-1 truncate font-mono text-xs text-light-primary dark:text-dark-primary">
                {documentTitlePreview}
              </p>
              <p className="mt-1 text-xs text-light-text-muted dark:text-dark-text-muted">
                {form.titleMode === "title_section"
                  ? "แสดงชื่อระบบพร้อมชื่อหน้าแรกที่เปิด"
                  : "แสดงเฉพาะ title ของระบบ"}
              </p>
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
      )}

      {canReadOrganization && (
      <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-light-text dark:text-dark-text">Organization & Support</h2>
            <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
              ข้อมูลหน่วยงานและช่องทางติดต่อ ใช้ในอีเมล หน้า help และ error pages
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { key: "organizationName" as const, label: "Organization name",  placeholder: "บริษัท ตัวอย่าง จำกัด",   desc: "ชื่อแสดงในอีเมลและหน้าระบบ" },
            { key: "supportEmail"     as const, label: "Support email",       placeholder: "support@example.com",     desc: "ที่อยู่สำหรับรับแจ้งปัญหา" },
            { key: "websiteUrl"       as const, label: "Website URL",         placeholder: "https://example.com",     desc: "เว็บไซต์หลักของหน่วยงาน" },
            { key: "helpCenterUrl"    as const, label: "Help center URL",     placeholder: "/help",                   desc: "ลิงก์ศูนย์ช่วยเหลือ" },
          ].map(({ key, label, placeholder, desc }) => (
            <div key={key} className="rounded-lg border border-theme bg-light-background p-4 dark:bg-dark-background">
              <label className="mb-0.5 block text-sm font-semibold text-light-text dark:text-dark-text">{label}</label>
              <p className="mb-2 text-xs text-light-text-muted dark:text-dark-text-muted">{desc}</p>
              <input
                className={inputClass}
                value={organizationForm[key]}
                onChange={(e) => setOrganizationField(key, e.target.value)}
                disabled={!canUpdateOrganization || isOrganizationLoading}
                placeholder={placeholder}
              />
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-theme pt-4">
          <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
            {isOrganizationDirty ? "มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก" : "ข้อมูลเป็นปัจจุบัน"}
          </p>
          {canUpdateOrganization && (
            <div className="flex gap-2">
              {isOrganizationDirty && (
                <button type="button" onClick={handleOrganizationReset} disabled={isOrganizationSaving}
                  className="inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10">
                  <X className="h-4 w-4" />ยกเลิก
                </button>
              )}
              <button type="button" onClick={() => void handleOrganizationSave()}
                disabled={!isOrganizationDirty || isOrganizationLoading || isOrganizationSaving}
                className="inline-flex items-center gap-2 rounded-md bg-light-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover">
                {isOrganizationSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                บันทึก
              </button>
            </div>
          )}
        </div>
      </article>
      )}

      {canReadRegistration && (
      <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-300">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-light-text dark:text-dark-text">Registration & Approval</h2>
              <p className="text-sm text-light-text-muted dark:text-dark-text-muted">ควบคุมปุ่มสมัครในหน้า login และสถานะ approval ของบัญชีใหม่</p>
            </div>
          </div>
        </div>

        {isRegistrationLoading ? (
          <div className="grid min-h-24 place-items-center">
            <RefreshCw className="h-5 w-5 animate-spin text-light-text-muted dark:text-dark-text-muted" />
          </div>
        ) : (
          <>
            <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-md border border-theme bg-light-background px-3 py-2.5 dark:bg-dark-background">
                  <div>
                    <p className="text-sm font-medium text-light-text dark:text-dark-text">Self registration</p>
                    <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">เปิดปุ่มสมัครในหน้า login และเปิด API สมัครสมาชิก</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={registrationForm.enabled}
                    disabled={!canUpdateRegistration}
                    onClick={() => setRegistrationField("enabled", !registrationForm.enabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      registrationForm.enabled ? "bg-light-primary dark:bg-dark-primary" : "bg-light-text-muted/30 dark:bg-dark-text-muted/30"
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${registrationForm.enabled ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-theme bg-light-background px-3 py-2.5 dark:bg-dark-background">
                  <div>
                    <p className="text-sm font-medium text-light-text dark:text-dark-text">Require approval</p>
                    <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">บัญชีสมัครใหม่ต้องรอ admin อนุมัติก่อน login</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={registrationForm.requireApproval}
                    disabled={!canUpdateRegistration}
                    onClick={() => setRegistrationField("requireApproval", !registrationForm.requireApproval)}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      registrationForm.requireApproval ? "bg-emerald-500" : "bg-light-text-muted/30 dark:bg-dark-text-muted/30"
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${registrationForm.requireApproval ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
                  </button>
                </div>
                <div>
                  <label className={labelClass}>Default role</label>
                  <select
                    className={inputClass}
                    value={registrationForm.defaultRole}
                    onChange={(event) => setRegistrationField("defaultRole", event.target.value)}
                    disabled={!canUpdateRegistration || roleOptions.length === 0}
                  >
                    {roleOptions.length === 0 && (
                      <option value={registrationForm.defaultRole}>{registrationForm.defaultRole || "USER"}</option>
                    )}
                    {isSelectedDefaultRoleMissing && (
                      <option value={registrationForm.defaultRole}>
                        {registrationForm.defaultRole} (missing)
                      </option>
                    )}
                    {roleOptions.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name} ({role.id})
                        </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Creation type</label>
                  <input className={inputClass} value="SELF_REGISTER" disabled />
                </div>
              </div>

              <div className="rounded-lg border border-theme bg-light-background p-4 dark:bg-dark-background">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                  Current behavior
                </p>
                <div className="space-y-3 text-sm text-light-text-muted dark:text-dark-text-muted">
                  <div className="flex items-start gap-2">
                    <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-light-primary dark:text-dark-primary" />
                    <span>{registrationForm.enabled ? "หน้า login จะแสดงปุ่มสมัครสมาชิก" : "หน้า login จะซ่อนปุ่มสมัครสมาชิก"}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-light-primary dark:text-dark-primary" />
                    <span>{registrationForm.requireApproval ? "บัญชีใหม่จะอยู่สถานะ pending approval" : "บัญชีใหม่ login ได้ทันทีหลังสมัคร"}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Settings className="mt-0.5 h-4 w-4 shrink-0 text-light-primary dark:text-dark-primary" />
                    <span>
                      Role เริ่มต้น: {selectedDefaultRole ? `${selectedDefaultRole.name} (${selectedDefaultRole.id})` : registrationForm.defaultRole || "USER"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-theme pt-4">
              <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                {isRegistrationDirty ? "มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก" : "ข้อมูลเป็นปัจจุบัน"}
              </p>
              {canUpdateRegistration && (
                <div className="flex gap-2">
                  {isRegistrationDirty && (
                    <button type="button" onClick={handleRegistrationReset} disabled={isRegistrationSaving}
                      className="inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10">
                      <X className="h-4 w-4" />ยกเลิก
                    </button>
                  )}
                  <button type="button" onClick={() => void handleRegistrationSave()}
                    disabled={!isRegistrationDirty || isRegistrationSaving}
                    className="inline-flex items-center gap-2 rounded-md bg-light-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover">
                    {isRegistrationSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    บันทึก
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </article>
      )}

      {canReadRegional && (
      <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-300">
            <Clock3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-light-text dark:text-dark-text">Regional & System Mode</h2>
            <p className="text-sm text-light-text-muted dark:text-dark-text-muted">Timezone รูปแบบวันเวลา และโหมดปิดปรับปรุงระบบ</p>
          </div>
        </div>

        {isRegionalLoading ? (
          <div className="grid min-h-24 place-items-center">
            <RefreshCw className="h-5 w-5 animate-spin text-light-text-muted dark:text-dark-text-muted" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Timezone — ครบทุก IANA timezone */}
              <div className="md:col-span-2">
                <label className={labelClass}>Timezone</label>
                <select className={inputClass} value={regionalForm.timezone}
                  onChange={(e) => setRegionalForm((p) => ({ ...p, timezone: e.target.value }))}
                  disabled={!canUpdateRegional}>
                  {(Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
                    .supportedValuesOf?.("timeZone")
                    .map((tz) => <option key={tz} value={tz}>{tz}</option>) ?? (
                    /* fallback สำหรับ browser เก่า */
                    <>
                      <option value="UTC">UTC</option>
                      <option value="Asia/Bangkok">Asia/Bangkok</option>
                      <option value="Asia/Singapore">Asia/Singapore</option>
                      <option value="Asia/Tokyo">Asia/Tokyo</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="America/New_York">America/New_York</option>
                    </>
                  )}
                </select>
              </div>

              {/* Date format */}
              <div>
                <label className={labelClass}>Date format</label>
                <select className={inputClass} value={regionalForm.dateFormat}
                  onChange={(e) => setRegionalForm((p) => ({ ...p, dateFormat: e.target.value }))}
                  disabled={!canUpdateRegional}>
                  <option value="DD/MM/YYYY">DD/MM/YYYY — 15/01/2024</option>
                  <option value="DD-MM-YYYY">DD-MM-YYYY — 15-01-2024</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY — 01/15/2024</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD — 2024-01-15</option>
                  <option value="YYYY/MM/DD">YYYY/MM/DD — 2024/01/15</option>
                  <option value="D MMM YYYY">D MMM YYYY — 15 Jan 2024</option>
                  <option value="D MMMM YYYY">D MMMM YYYY — 15 มกราคม 2024</option>
                </select>
              </div>

              {/* Year era */}
              <div>
                <label className={labelClass}>ปีที่แสดง</label>
                <div className="flex gap-2">
                  {(["CE", "BE"] as const).map((era) => (
                    <button
                      key={era}
                      type="button"
                      disabled={!canUpdateRegional}
                      onClick={() => setRegionalForm((p) => ({ ...p, yearEra: era }))}
                      className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        regionalForm.yearEra === era
                          ? "border-light-primary bg-light-primary/10 text-light-primary dark:border-dark-primary dark:bg-dark-primary/10 dark:text-dark-primary"
                          : "border-theme text-light-text-muted hover:border-light-primary hover:text-light-primary dark:text-dark-text-muted dark:hover:border-dark-primary dark:hover:text-dark-primary"
                      }`}
                    >
                      {era === "CE" ? "ค.ศ." : "พ.ศ."}
                      <span className="ml-1 text-xs font-normal opacity-60">
                        {era === "CE" ? "(2024)" : "(2567)"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time format */}
              <div>
                <label className={labelClass}>Time format</label>
                <select className={inputClass} value={regionalForm.timeFormat}
                  onChange={(e) => setRegionalForm((p) => ({ ...p, timeFormat: e.target.value }))}
                  disabled={!canUpdateRegional}>
                  <option value="24h">24 ชั่วโมง — 14:30</option>
                  <option value="12h">12 ชั่วโมง — 2:30 PM</option>
                </select>
              </div>

            </div>

            <div className="mt-4 rounded-lg border border-theme bg-light-background px-4 py-3 dark:bg-dark-background">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">ตัวอย่างวันเวลา</p>
              <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
                <span className="text-light-text-muted dark:text-dark-text-muted">
                  ที่ใช้อยู่:{" "}
                  <code className="font-mono text-light-text dark:text-dark-text">{currentFormatDateTime(new Date())}</code>
                </span>
                {isRegionalDirty && (
                  <span className="text-light-text-muted dark:text-dark-text-muted">
                    หลัง save:{" "}
                    <code className="font-mono text-light-primary dark:text-dark-primary">{previewNow}</code>
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-theme pt-4">
              <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                {isRegionalDirty ? "มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก" : "ข้อมูลเป็นปัจจุบัน"}
              </p>
              <div className="flex gap-2">
                {isRegionalDirty && (
                  <button type="button" onClick={() => setRegionalForm(savedRegionalForm)}
                    className="inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10">
                    <X className="h-4 w-4" />ยกเลิก
                  </button>
                )}
                <button type="button" onClick={() => void handleRegionalSave()}
                  disabled={!isRegionalDirty || isRegionalSaving || !canUpdateRegional}
                  className="inline-flex items-center gap-2 rounded-md bg-light-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-50 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover">
                  {isRegionalSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  บันทึก
                </button>
              </div>
            </div>
          </>
        )}
      </article>
      )}

      {/* ── Maintenance Mode ─────────────────────────────────────────────── */}
      {canReadMaintenance && (
      <article className="rounded-lg border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-light-text dark:text-dark-text">Maintenance Mode</h2>
            <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
              เมื่อเปิด — เฉพาะ SUPERADMIN เข้าใช้งานได้ ผู้ใช้อื่นจะเห็นหน้า Maintenance
            </p>
          </div>
        </div>

        {isMaintenanceLoading ? (
          <div className="grid min-h-24 place-items-center">
            <RefreshCw className="h-5 w-5 animate-spin text-light-text-muted dark:text-dark-text-muted" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-theme bg-light-background px-4 py-3 dark:bg-dark-background">
              <div>
                <p className="text-sm font-semibold text-light-text dark:text-dark-text">เปิด Maintenance Mode</p>
                <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">
                  ผู้ใช้ทั่วไปจะถูกบล็อก เฉพาะ SUPERADMIN เข้าได้
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={maintenanceForm.enabled}
                disabled={!canUpdateMaintenance}
                onClick={() => setMaintenanceForm((p) => ({ ...p, enabled: !p.enabled }))}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                  maintenanceForm.enabled ? "bg-amber-500" : "bg-light-text-muted/30 dark:bg-dark-text-muted/30"
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${maintenanceForm.enabled ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
              </button>
            </div>

            {/* Message */}
            <div>
              <label className={labelClass}>
                ข้อความที่แสดงให้ผู้ใช้เห็น
                <span className="ml-1 font-normal">(ไม่กรอก = ใช้ข้อความ default)</span>
              </label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={3}
                placeholder="เช่น ระบบปิดปรับปรุง คาดว่าจะแล้วเสร็จภายใน 30 นาที"
                value={maintenanceForm.message}
                disabled={!canUpdateMaintenance}
                onChange={(e) => setMaintenanceForm((p) => ({ ...p, message: e.target.value }))}
              />
            </div>

            {/* Warning when enabled */}
            {maintenanceForm.enabled && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
                <Settings className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Maintenance Mode กำลังเปิดอยู่ — ผู้ใช้ทั่วไปจะเห็นหน้า Maintenance ทันทีหลัง save
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-theme pt-4">
              <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                {isMaintenanceDirty ? "มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก" : "ข้อมูลเป็นปัจจุบัน"}
              </p>
              <div className="flex gap-2">
                {isMaintenanceDirty && (
                  <button type="button" onClick={() => setMaintenanceForm(savedMaintenanceForm)}
                    className="inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10">
                    <X className="h-4 w-4" />ยกเลิก
                  </button>
                )}
                <button type="button" onClick={() => void handleMaintenanceSave()}
                  disabled={!isMaintenanceDirty || isMaintenanceSaving || !canUpdateMaintenance}
                  className="inline-flex items-center gap-2 rounded-md bg-light-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-50 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover">
                  {isMaintenanceSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        )}
      </article>
      )}
    </section>
  );
};

export default GeneralSettingsPage;
