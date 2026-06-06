import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Camera, CheckCircle2, Clock3, Contact, History, ImageOff, Loader2, MailWarning, MapPin, RotateCcw, Save, UserRound } from "lucide-react";
import { toast } from "react-toastify";
import { useSession } from "@/contexts/SessionContext";
import { useApi } from "@/hooks/useApi";
import { useRegional } from "@/contexts/RegionalContext";
import { resolveBackendAssetUrl } from "@/utils/assetUrl";

type ProfileForm = {
  firstName: string;
  lastName: string;
  displayName: string;
  phoneNumber: string;
  department: string;
  address: string;
  subDistrict: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  dateOfBirth: string;
  gender: string;
  bio: string;
  website: string;
};

type MyProfile = {
  id: number;
  username: string;
  email: string;
  createdAt: string;
  passwordChangedAt: string | null;
  temporaryAccount: boolean;
  accountExpiry: string | null;
  profile: ProfileForm & { avatarUrl: string };
};

type ProfileResponse = {
  success: boolean;
  message?: string;
  data: MyProfile;
};

const emptyForm: ProfileForm = {
  firstName: "",
  lastName: "",
  displayName: "",
  phoneNumber: "",
  department: "",
  address: "",
  subDistrict: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  dateOfBirth: "",
  gender: "",
  bio: "",
  website: "",
};

const inputClass =
  "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text outline-none transition focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:focus:ring-dark-primary";
const labelClass = "mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted";
const cardClass = "rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card";

const MyProfilePage = () => {
  const { get, put } = useApi();
  const { formatDateTime } = useRegional();
  const { user, updateUser } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [savedForm, setSavedForm] = useState<ProfileForm>(emptyForm);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await get<ProfileResponse>("/profile/me");
        if (!active) return;
        const next = response.data.data;
        const nextForm = { ...emptyForm, ...next.profile };
        setProfile(next);
        setForm(nextForm);
        setSavedForm(nextForm);
      } catch {
        if (active) toast.error("ไม่สามารถโหลดข้อมูลโปรไฟล์ได้");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const avatarPreview = useMemo(() => {
    if (removeAvatar) return "";
    if (avatarFile) return URL.createObjectURL(avatarFile);
    return resolveBackendAssetUrl(profile?.profile.avatarUrl);
  }, [avatarFile, profile?.profile.avatarUrl, removeAvatar]);

  useEffect(() => {
    return () => {
      if (avatarFile && avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarFile, avatarPreview]);

  const isDirty =
    JSON.stringify(form) !== JSON.stringify(savedForm) || Boolean(avatarFile) || removeAvatar;
  const displayName =
    form.displayName || [form.firstName, form.lastName].filter(Boolean).join(" ") || profile?.username || "ผู้ใช้";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";
  const accountExpired = Boolean(
    profile?.temporaryAccount &&
    profile.accountExpiry &&
    new Date(profile.accountExpiry).getTime() <= Date.now(),
  );

  const setField = (field: keyof ProfileForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("รองรับเฉพาะไฟล์ PNG, JPG และ WEBP");
      event.target.value = "";
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("รูปโปรไฟล์ต้องมีขนาดไม่เกิน 3MB");
      event.target.value = "";
      return;
    }
    setAvatarFile(file);
    setRemoveAvatar(false);
  };

  const handleReset = () => {
    setForm(savedForm);
    setAvatarFile(null);
    setRemoveAvatar(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isDirty || isSaving) return;

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => payload.append(key, value));
    if (avatarFile) payload.append("avatar", avatarFile);
    if (removeAvatar) payload.append("removeAvatar", "true");

    setIsSaving(true);
    try {
      const response = await put<ProfileResponse>("/profile/me", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const next = response.data.data;
      const nextForm = { ...emptyForm, ...next.profile };
      setProfile(next);
      setForm(nextForm);
      setSavedForm(nextForm);
      setAvatarFile(null);
      setRemoveAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";

      if (user) {
        updateUser({
          ...user,
          profile: {
            ...user.profile,
            firstName: next.profile.firstName,
            lastName: next.profile.lastName,
            displayName: next.profile.displayName,
            avatarUrl: next.profile.avatarUrl,
            phoneNumber: next.profile.phoneNumber,
          },
        });
      }
      toast.success("บันทึกโปรไฟล์เรียบร้อยแล้ว");
    } catch {
      toast.error("ไม่สามารถบันทึกโปรไฟล์ได้");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid min-h-72 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-light-primary dark:text-dark-primary" />
      </div>
    );
  }

  return (
    <form className="mx-auto w-full max-w-6xl space-y-5" onSubmit={handleSubmit}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-light-text dark:text-dark-text">โปรไฟล์ของฉัน</h1>
          <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
            จัดการข้อมูลส่วนตัว ข้อมูลติดต่อ และรูปโปรไฟล์ของคุณ
          </p>
        </div>
        <div className="flex gap-2">
          {isDirty && (
            <button type="button" onClick={handleReset} disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10">
              <RotateCcw className="h-4 w-4" />ยกเลิก
            </button>
          )}
          <button type="submit" disabled={!isDirty || isSaving}
            className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:cursor-not-allowed disabled:opacity-50 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
          </button>
        </div>
      </header>

      {profile?.temporaryAccount && (
        <section className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4 ${accountExpired
            ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
            : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
          }`}>
          <div className="flex items-start gap-3">
            <Clock3 className={`mt-0.5 h-5 w-5 shrink-0 ${accountExpired ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`} />
            <div>
              <p className={`text-sm font-semibold ${accountExpired ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}`}>
                {accountExpired ? "บัญชีชั่วคราวหมดอายุแล้ว" : "บัญชีชั่วคราว"}
              </p>
              <p className={`mt-1 text-xs ${accountExpired ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
                {profile.accountExpiry
                  ? `บัญชีนี้${accountExpired ? "หมดอายุเมื่อ" : "จะหมดอายุวันที่"} ${formatDateTime(profile.accountExpiry)}`
                  : "บัญชีนี้ยังไม่ได้กำหนดวันหมดอายุ กรุณาติดต่อผู้ดูแลระบบ"}
              </p>
            </div>
          </div>
          <span className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${accountExpired
              ? "bg-red-500/10 text-red-700 dark:text-red-300"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
            }`}>
            {accountExpired ? "หมดอายุ" : "ใช้งานชั่วคราว"}
          </span>
        </section>
      )}

      <section className={cardClass}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-theme bg-light-primary text-2xl font-semibold text-white dark:bg-dark-primary dark:text-dark-background">
            {avatarPreview ? <img src={avatarPreview} alt="รูปโปรไฟล์" className="h-full w-full object-cover" /> : initials}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-light-text dark:text-dark-text">{displayName}</h2>
            <p className="truncate text-sm text-light-text-muted dark:text-dark-text-muted">@{profile?.username}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarChange} />
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10">
                <Camera className="h-4 w-4" />เปลี่ยนรูป
              </button>
              {(avatarPreview || profile?.profile.avatarUrl) && (
                <button type="button" onClick={() => { setAvatarFile(null); setRemoveAvatar(true); }}
                  className="inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-500/10">
                  <ImageOff className="h-4 w-4" />ลบรูป
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-light-text-muted dark:text-dark-text-muted">PNG, JPG หรือ WEBP ขนาดไม่เกิน 3MB</p>
          </div>
          <div className="grid min-w-64 grid-cols-3 gap-x-6 gap-y-4 rounded-md border border-theme bg-light-background p-4 dark:bg-dark-background">
            {profile?.temporaryAccount && (
              <div>
                <span className={labelClass}>ประเภทบัญชี</span>
                <p
                  className={`inline-flex items-center gap-1.5 text-sm font-semibold ${accountExpired
                      ? "text-red-600 dark:text-red-400"
                      : "text-amber-700 dark:text-amber-400"
                    }`}
                >
                  <Clock3 className="h-4 w-4" />
                  บัญชีชั่วคราว
                </p>
              </div>
            )}

            <div>
              <span className={labelClass}>ชื่อผู้ใช้</span>
              <p className="truncate text-sm font-semibold text-light-text dark:text-dark-text">
                {profile?.username}
              </p>
            </div>

            <div>
              <span className={labelClass}>อีเมลบัญชี</span>
              <p className="truncate text-sm font-semibold text-light-text dark:text-dark-text">
                {profile?.email}
              </p>

              <div className="mt-2">
                {user?.isEmailVerified ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    ยืนยันอีเมลแล้ว
                  </span>
                ) : (
                  <Link
                    to="/my-security?tab=recovery&modal=email-verification&emailAction=PRIMARY_VERIFY"
                    className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
                  >
                    <MailWarning className="h-3 w-3" />
                    ยังไม่ยืนยันอีเมล
                  </Link>
                )}
              </div>
            </div>

            <div>
              <span className={labelClass}>เปลี่ยนรหัสผ่านล่าสุด</span>
              <p className="text-sm font-semibold text-light-text dark:text-dark-text">
                {profile?.passwordChangedAt
                  ? formatDateTime(profile.passwordChangedAt)
                  : "ยังไม่มีข้อมูล"}
              </p>

              <Link
                to="/my-security?tab=password"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-light-primary hover:underline dark:text-dark-primary"
              >
                <History className="h-3.5 w-3" />
                ดูประวัติและเปลี่ยนรหัสผ่าน
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className={cardClass}>
          <div className="mb-4 flex items-center gap-3">
            <UserRound className="h-5 w-5 text-light-primary dark:text-dark-primary" />
            <div>
              <h2 className="font-semibold text-light-text dark:text-dark-text">ข้อมูลส่วนตัว</h2>
              <p className="text-xs text-light-text-muted dark:text-dark-text-muted">ชื่อและข้อมูลที่ใช้แสดงในระบบ</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelClass}>ชื่อ</label><input className={inputClass} value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} /></div>
            <div><label className={labelClass}>นามสกุล</label><input className={inputClass} value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={labelClass}>ชื่อที่แสดง</label><input className={inputClass} value={form.displayName} onChange={(e) => setField("displayName", e.target.value)} /></div>
            <div><label className={labelClass}>วันเกิด</label><input type="date" className={inputClass} value={form.dateOfBirth} onChange={(e) => setField("dateOfBirth", e.target.value)} /></div>
            <div><label className={labelClass}>เพศ</label><select className={inputClass} value={form.gender} onChange={(e) => setField("gender", e.target.value)}><option value="">ไม่ระบุ</option><option value="M">ชาย</option><option value="F">หญิง</option><option value="O">อื่น ๆ</option></select></div>
          </div>
        </section>

        <section className={cardClass}>
          <div className="mb-4 flex items-center gap-3">
            <Contact className="h-5 w-5 text-light-primary dark:text-dark-primary" />
            <div>
              <h2 className="font-semibold text-light-text dark:text-dark-text">ข้อมูลติดต่อ</h2>
              <p className="text-xs text-light-text-muted dark:text-dark-text-muted">ช่องทางติดต่อและข้อมูลการทำงาน</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelClass}>เบอร์โทรศัพท์</label><input className={inputClass} value={form.phoneNumber} onChange={(e) => setField("phoneNumber", e.target.value)} /></div>
            <div><label className={labelClass}>แผนก</label><input className={inputClass} value={form.department} onChange={(e) => setField("department", e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={labelClass}>เว็บไซต์</label><input type="url" className={inputClass} placeholder="https://example.com" value={form.website} onChange={(e) => setField("website", e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={labelClass}>เกี่ยวกับฉัน</label><textarea rows={4} className={`${inputClass} resize-y`} value={form.bio} onChange={(e) => setField("bio", e.target.value)} /></div>
          </div>
        </section>
      </div>

      <section className={cardClass}>
        <div className="mb-4 flex items-center gap-3">
          <MapPin className="h-5 w-5 text-light-primary dark:text-dark-primary" />
          <div>
            <h2 className="font-semibold text-light-text dark:text-dark-text">ที่อยู่</h2>
            <p className="text-xs text-light-text-muted dark:text-dark-text-muted">ข้อมูลสถานที่ติดต่อของคุณ</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="md:col-span-3 lg:col-span-4"><label className={labelClass}>ที่อยู่</label><input className={inputClass} value={form.address} onChange={(e) => setField("address", e.target.value)} /></div>
          <div><label className={labelClass}>ตำบล / แขวง</label><input className={inputClass} value={form.subDistrict} onChange={(e) => setField("subDistrict", e.target.value)} /></div>
          <div><label className={labelClass}>อำเภอ / เขต</label><input className={inputClass} value={form.city} onChange={(e) => setField("city", e.target.value)} /></div>
          <div><label className={labelClass}>จังหวัด</label><input className={inputClass} value={form.state} onChange={(e) => setField("state", e.target.value)} /></div>
          <div><label className={labelClass}>รหัสไปรษณีย์</label><input className={inputClass} value={form.postalCode} onChange={(e) => setField("postalCode", e.target.value)} /></div>
        </div>
      </section>
    </form>
  );
};

export default MyProfilePage;
