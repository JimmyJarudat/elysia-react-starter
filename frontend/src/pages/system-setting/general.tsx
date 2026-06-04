import { useMemo, useState } from "react";
import {
  Bell,
  Building2,
  Globe2,
  Image,
  Palette,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { toast } from "react-toastify";

type GeneralSettingsForm = {
  systemName: string;
  systemSubtitle: string;
  logoUrl: string;
  faviconUrl: string;
  organizationName: string;
  supportEmail: string;
  websiteUrl: string;
  country: string;
  defaultLanguage: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  defaultTheme: string;
  defaultMode: string;
  defaultFont: string;
  sidebarMode: string;
  defaultRole: string;
  allowSelfRegister: boolean;
  requireUserApproval: boolean;
  defaultDepartment: string;
  maintenanceMode: boolean;
  emailNotification: boolean;
  itemsPerPage: number;
  uploadLimitMb: number;
};

type FieldKey = keyof GeneralSettingsForm;

const initialForm: GeneralSettingsForm = {
  systemName: "IT Utils",
  systemSubtitle: "Internal tools and admin workspace",
  logoUrl: "/logo.png",
  faviconUrl: "/favicon.ico",
  organizationName: "Nova Technology",
  supportEmail: "support@example.com",
  websiteUrl: "https://example.com",
  country: "Thailand",
  defaultLanguage: "th",
  timezone: "Asia/Bangkok",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "24-hour",
  defaultTheme: "Sky Blue",
  defaultMode: "System",
  defaultFont: "System Default",
  sidebarMode: "Expanded",
  defaultRole: "USER",
  allowSelfRegister: false,
  requireUserApproval: true,
  defaultDepartment: "IT",
  maintenanceMode: false,
  emailNotification: true,
  itemsPerPage: 25,
  uploadLimitMb: 20,
};

const inputClass =
  "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";

const labelClass = "mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted";

const sectionClass = "rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card";

const Toggle = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
      checked ? "bg-light-primary dark:bg-dark-primary" : "bg-light-text-muted/30 dark:bg-dark-text-muted/30"
    }`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
        checked ? "translate-x-[18px]" : "translate-x-[3px]"
      }`}
    />
  </button>
);

const GeneralSettingsPage = () => {
  const [form, setForm] = useState<GeneralSettingsForm>(initialForm);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form],
  );

  const setField = <K extends FieldKey>(key: K, value: GeneralSettingsForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);
    window.setTimeout(() => {
      setIsSaving(false);
      toast.success("Mock settings saved");
      // TODO: Replace mock save with real system config API.
    }, 450);
  };

  const handleReset = () => {
    setForm(initialForm);
    toast.info("Reset to mock defaults");
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
                Mock หน้าตั้งค่าหลักของระบบ ก่อนต่อ API จริง
              </p>
            </div>
          </div>

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
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
            >
              {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save mock
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <article className={sectionClass}>
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
              <Image className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-light-text dark:text-dark-text">System Identity</h2>
              <p className="text-sm text-light-text-muted dark:text-dark-text-muted">ชื่อระบบ โลโก้ และข้อความแสดงผล</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>System name</label>
              <input className={inputClass} value={form.systemName} onChange={(e) => setField("systemName", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Subtitle</label>
              <input className={inputClass} value={form.systemSubtitle} onChange={(e) => setField("systemSubtitle", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Logo URL</label>
              <input className={inputClass} value={form.logoUrl} onChange={(e) => setField("logoUrl", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Favicon URL</label>
              <input className={inputClass} value={form.faviconUrl} onChange={(e) => setField("faviconUrl", e.target.value)} />
            </div>
          </div>
        </article>

       
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <article className={sectionClass}>
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-300">
              <Globe2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-light-text dark:text-dark-text">Localization</h2>
              <p className="text-sm text-light-text-muted dark:text-dark-text-muted">ภาษา เวลา และรูปแบบวันที่</p>
            </div>
          </div>

          <div className="grid gap-4">
            <div>
              <label className={labelClass}>Default language</label>
              <select className={inputClass} value={form.defaultLanguage} onChange={(e) => setField("defaultLanguage", e.target.value)}>
                <option value="th">Thai</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Timezone</label>
              <select className={inputClass} value={form.timezone} onChange={(e) => setField("timezone", e.target.value)}>
                <option value="Asia/Bangkok">Asia/Bangkok</option>
                <option value="UTC">UTC</option>
                <option value="Asia/Singapore">Asia/Singapore</option>
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Date format</label>
                <select className={inputClass} value={form.dateFormat} onChange={(e) => setField("dateFormat", e.target.value)}>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Time format</label>
                <select className={inputClass} value={form.timeFormat} onChange={(e) => setField("timeFormat", e.target.value)}>
                  <option value="24-hour">24-hour</option>
                  <option value="12-hour">12-hour</option>
                </select>
              </div>
            </div>
          </div>
        </article>

       
        <article className={sectionClass}>
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-300">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-light-text dark:text-dark-text">ส่วนนี้เป็นเปิด regis หรือไม่</h2>
              <p className="text-sm text-light-text-muted dark:text-dark-text-muted">ค่าเริ่มต้นของบัญชีผู้ใช้</p>
            </div>
          </div>

          <div className="grid gap-4">
            <div>
              <label className={labelClass}>Default role</label>
              <select className={inputClass} value={form.defaultRole} onChange={(e) => setField("defaultRole", e.target.value)}>
                <option>USER</option>
                <option>ADMIN</option>
                <option>MANAGER</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Default department</label>
              <input className={inputClass} value={form.defaultDepartment} onChange={(e) => setField("defaultDepartment", e.target.value)} />
            </div>
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-light-text dark:text-dark-text">Self registration</span>
                <Toggle checked={form.allowSelfRegister} onChange={(checked) => setField("allowSelfRegister", checked)} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-light-text dark:text-dark-text">Require approval</span>
                <Toggle checked={form.requireUserApproval} onChange={(checked) => setField("requireUserApproval", checked)} />
              </div>
            </div>
          </div>
        </article>
      </div>

      <article className={sectionClass}>
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-300">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-light-text dark:text-dark-text">System Behavior</h2>
            <p className="text-sm text-light-text-muted dark:text-dark-text-muted">ค่าพฤติกรรมทั่วไปของระบบ</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className={labelClass}>Items per page</label>
            <input
              className={inputClass}
              min={10}
              max={100}
              type="number"
              value={form.itemsPerPage}
              onChange={(e) => setField("itemsPerPage", Number(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass}>Upload limit (MB)</label>
            <input
              className={inputClass}
              min={1}
              max={200}
              type="number"
              value={form.uploadLimitMb}
              onChange={(e) => setField("uploadLimitMb", Number(e.target.value))}
            />
          </div>
        
        </div>
      </article>
    </section>
  );
};

export default GeneralSettingsPage;
