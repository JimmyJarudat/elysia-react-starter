import { useEffect, useState } from "react";
import {
  CheckCircle2, Database, Mail, RefreshCw,
  Save, Send, Server, ShieldAlert, Trash2, Wifi,
} from "lucide-react";
import { toast } from "react-toastify";
import { useSession } from "@/contexts/SessionContext";
import { useApi } from "@/hooks/useApi";

// ─── Types ────────────────────────────────────────────────────────────────────

type RedisSettings = {
  enabled: boolean; host: string; port: number; db: number;
  password?: string; hasPassword: boolean; prefix: string;
};
type SmtpSettings = {
  enabled: boolean; host: string; port: number;
  encryption: "starttls" | "ssl" | "none";
  user: string; password?: string; hasPassword: boolean;
  fromName: string; fromEmail: string; appName: string; appUrl: string;
};
type RedisResponse  = { success: boolean; data: RedisSettings };
type SmtpResponse   = { success: boolean; data: SmtpSettings };
type ActionResponse = { success: boolean; message: string };

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultRedis: RedisSettings = {
  enabled: false, host: "127.0.0.1", port: 6379, db: 0,
  password: "", hasPassword: false, prefix: "it-utils:",
};
const defaultSmtp: SmtpSettings = {
  enabled: false, host: "", port: 587, encryption: "starttls",
  user: "", password: "", hasPassword: false,
  fromName: "IT Utilities", fromEmail: "",
  appName: "IT Utilities", appUrl: "http://localhost:5173",
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const card   = "rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card";
const input  = "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary disabled:cursor-not-allowed disabled:opacity-70 dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";
const lbl    = "mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted";
const btnSec = "inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-dark-text dark:hover:bg-dark-primary/10";
const btnPri = "inline-flex items-center gap-2 rounded-md bg-light-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:cursor-not-allowed disabled:opacity-50 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover";
const btnDgr = "inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50";

const statusCls = (s: "idle"|"ok"|"error") =>
  s === "ok"    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
  : s === "error" ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
  :                 "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200";

const Toggle = ({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) => (
  <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={onChange}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-light-primary dark:bg-dark-primary" : "bg-light-text-muted/30 dark:bg-dark-text-muted/30"}`}>
    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
  </button>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

const IntegrationsPage = () => {
  const { user } = useSession();
  const { get, put, post } = useApi();
  const isSuperAdmin = user?.roles?.includes("SUPERADMIN") ?? false;
  const can = isSuperAdmin || Boolean(user?.permissions?.includes("settings.update"));

  // Redis
  const [rf,  setRf]  = useState<RedisSettings>(defaultRedis);
  const [srf, setSrf] = useState<RedisSettings>(defaultRedis);
  const [rl,  setRl]  = useState(true);
  const [rs,  setRs]  = useState(false);
  const [rt,  setRt]  = useState(false);
  const [fc,  setFc]  = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [rStatus, setRStatus] = useState<"idle"|"ok"|"error">("idle");
  const [rMsg,    setRMsg]    = useState("ยังไม่ได้ทดสอบการเชื่อมต่อ");
  const [rSig,    setRSig]    = useState("");

  // SMTP
  const [sf,  setSf]  = useState<SmtpSettings>(defaultSmtp);
  const [ssf, setSsf] = useState<SmtpSettings>(defaultSmtp);
  const [sl,  setSl]  = useState(true);
  const [ss,  setSs]  = useState(false);
  const [st,  setSt]  = useState(false);
  const [se,  setSe]  = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sStatus, setSStatus] = useState<"idle"|"ok"|"error">("idle");
  const [sMsg,    setSMsg]    = useState("ยังไม่ได้ทดสอบการเชื่อมต่อ");
  const [sSig,    setSSig]    = useState("");

  const rDirty = JSON.stringify(rf) !== JSON.stringify(srf);
  const curRSig = JSON.stringify({ enabled: rf.enabled, host: rf.host, port: Number(rf.port), db: Number(rf.db), prefix: rf.prefix, password: rf.password ?? "" });
  const canSaveR = !rf.enabled || rSig === curRSig;

  const sDirty = JSON.stringify(sf) !== JSON.stringify(ssf);
  const curSSig = JSON.stringify({ enabled: sf.enabled, host: sf.host, port: Number(sf.port), encryption: sf.encryption, user: sf.user, password: sf.password ?? "", fromName: sf.fromName, fromEmail: sf.fromEmail, appName: sf.appName, appUrl: sf.appUrl });
  const canSaveS = !sf.enabled || sSig === curSSig;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [rr, sr] = await Promise.all([get<RedisResponse>("/system-setting/redis"), get<SmtpResponse>("/system-setting/smtp")]);
        if (!active) return;
        const nr = { ...defaultRedis, ...rr.data.data, password: "" };
        setRf(nr); setSrf(nr); setRStatus(nr.enabled ? "idle" : "error"); setRMsg(nr.enabled ? "โหลด config แล้ว ยังไม่ได้ทดสอบ" : "Redis ถูกปิดอยู่");
        const ns = { ...defaultSmtp, ...sr.data.data, password: "" };
        setSf(ns); setSsf(ns); setSStatus(ns.enabled ? "idle" : "error"); setSMsg(ns.enabled ? "โหลด config แล้ว ยังไม่ได้ทดสอบ" : "SMTP ถูกปิดอยู่");
      } catch (e) { if (active) toast.error(e instanceof Error ? e.message : "Failed to load"); }
      finally { if (active) { setRl(false); setSl(false); } }
    })();
    return () => { active = false; };
  }, []);

  const setR = <K extends keyof RedisSettings>(k: K, v: RedisSettings[K]) => {
    setRf(p => ({ ...p, [k]: v })); setRSig(""); setRStatus("idle"); setRMsg("มีการแก้ไข config กรุณา Test ให้ผ่านก่อน Save");
  };
  const setS = <K extends keyof SmtpSettings>(k: K, v: SmtpSettings[K]) => {
    setSf(p => ({ ...p, [k]: v })); setSSig(""); setSStatus("idle"); setSMsg("มีการแก้ไข config กรุณา Test ให้ผ่านก่อน Save");
  };

  const testRedis = async () => {
    setRt(true);
    try {
      const r = await post<ActionResponse>("/system-setting/redis/test", { ...rf, password: rf.password?.trim() || undefined, port: Number(rf.port), db: Number(rf.db) });
      setRStatus(r.data.success ? "ok" : "error"); setRMsg(r.data.message);
      if (r.data.success) { setRSig(curRSig); toast.success(r.data.message); } else { setRSig(""); toast.error(r.data.message); }
    } catch (e) { setRStatus("error"); setRSig(""); const m = e instanceof Error ? e.message : "Redis test failed"; setRMsg(m); toast.error(m); }
    finally { setRt(false); }
  };

  const saveRedis = async () => {
    setRs(true);
    try {
      const r = await put<RedisResponse>("/system-setting/redis", { ...rf, password: rf.password?.trim() || undefined, port: Number(rf.port), db: Number(rf.db) });
      const n = { ...defaultRedis, ...r.data.data, password: "" };
      setRf(n); setSrf(n); setRStatus(n.enabled ? "idle" : "error"); setRMsg(n.enabled ? "บันทึกแล้ว Redis reconnect แล้ว" : "Redis ถูกปิดอยู่");
      toast.success("บันทึก Redis settings แล้ว");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save Redis"); }
    finally { setRs(false); }
  };

  const forceClear = async () => {
    setConfirmClear(false);
    setFc(true);
    try {
      const r = await post<ActionResponse>("/system-setting/redis/clear", {});
      toast.success(r.data.message || "ล้าง Redis cache ทั้งหมดแล้ว");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to clear Redis"); }
    finally { setFc(false); }
  };

  const testSmtp = async () => {
    setSt(true);
    try {
      const r = await post<ActionResponse>("/system-setting/smtp/test", { ...sf, password: sf.password?.trim() || undefined, port: Number(sf.port) });
      setSStatus(r.data.success ? "ok" : "error"); setSMsg(r.data.message);
      if (r.data.success) { setSSig(curSSig); toast.success(r.data.message); } else { setSSig(""); toast.error(r.data.message); }
    } catch (e) { setSStatus("error"); setSSig(""); const m = e instanceof Error ? e.message : "SMTP test failed"; setSMsg(m); toast.error(m); }
    finally { setSt(false); }
  };

  const saveSmtp = async () => {
    setSs(true);
    try {
      const r = await put<SmtpResponse>("/system-setting/smtp", { ...sf, password: sf.password?.trim() || undefined, port: Number(sf.port) });
      const n = { ...defaultSmtp, ...r.data.data, password: "" };
      setSf(n); setSsf(n); setSStatus(n.enabled ? "idle" : "error"); setSMsg(n.enabled ? "บันทึกแล้ว ยังไม่ได้ทดสอบ" : "SMTP ถูกปิดอยู่");
      toast.success("บันทึก SMTP settings แล้ว");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save SMTP"); }
    finally { setSs(false); }
  };

  const sendTest = async () => {
    if (!testEmail.trim()) { toast.error("กรุณากรอกอีเมลผู้รับ"); return; }
    setSe(true);
    try {
      const r = await post<ActionResponse>("/system-setting/smtp/send-test", { to: testEmail.trim() });
      r.data.success ? toast.success(r.data.message) : toast.error(r.data.message);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to send test email"); }
    finally { setSe(false); }
  };

  return (
    <section className="grid gap-5">
      {/* Header */}
      <div className={card}>
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-light-primary to-light-primary-hover text-white shadow-sm dark:from-dark-primary dark:to-dark-primary-hover dark:text-dark-background">
            <Server className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">System Setting</p>
            <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">Integrations</h1>
            <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">ตั้งค่า Redis cache และ SMTP email พร้อมทดสอบการเชื่อมต่อ</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* ── Redis ── */}
        <article className={card}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-300"><Database className="h-5 w-5" /></div>
              <div>
                <h2 className="text-base font-semibold text-light-text dark:text-dark-text">Redis</h2>
                <p className="text-sm text-light-text-muted dark:text-dark-text-muted">Cache, presence และ route/menu cache</p>
              </div>
            </div>
            <div className="flex gap-2">
              {rf.enabled && <button type="button" onClick={() => void testRedis()} disabled={rt || rs} className={btnSec}>{rt ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}Test</button>}
              <button type="button" onClick={() => void saveRedis()} disabled={!can || rs || rl || !rDirty || !canSaveR} className={btnPri}>{rs ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save</button>
            </div>
          </div>

          {rl ? (
            <div className="grid min-h-32 place-items-center rounded-lg border border-theme bg-light-background dark:bg-dark-background"><RefreshCw className="h-5 w-5 animate-spin text-light-text-muted dark:text-dark-text-muted" /></div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-md border border-theme bg-light-background px-3 py-2.5 dark:bg-dark-background">
                <div><p className="text-sm font-medium text-light-text dark:text-dark-text">Enable Redis</p><p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">ใช้ Redis สำหรับ cache และ online presence</p></div>
                <Toggle checked={rf.enabled} onChange={() => setR("enabled", !rf.enabled)} disabled={!can} />
              </div>
              {rf.enabled && (<>
                <div><label className={lbl}>Key prefix</label><input className={input} value={rf.prefix} onChange={e => setR("prefix", e.target.value)} disabled={!can} placeholder="it-utils:" /></div>
                <div><label className={lbl}>Host</label><input className={input} value={rf.host} onChange={e => setR("host", e.target.value)} disabled={!can} /></div>
                <div><label className={lbl}>Port</label><input className={input} type="number" min={1} value={rf.port} onChange={e => setR("port", Number(e.target.value) || 0)} disabled={!can} /></div>
                <div><label className={lbl}>Database</label><input className={input} type="number" min={0} value={rf.db} onChange={e => setR("db", Number(e.target.value) || 0)} disabled={!can} /></div>
                <div><label className={lbl}>Password</label><input className={input} type="password" value={rf.password ?? ""} onChange={e => setR("password", e.target.value)} placeholder={rf.hasPassword ? "ใช้รหัสผ่านเดิม ถ้าไม่กรอก" : "••••••••"} disabled={!can} /></div>
              </>)}
            </div>
          )}

          {rf.enabled ? (<>
            <div className={`mt-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${statusCls(rStatus)}`}>
              {rStatus === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <ShieldAlert className="h-4 w-4 shrink-0" />}
              <span>{rMsg}</span>
            </div>
            {rDirty && !canSaveR && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">ต้อง Test config ชุดนี้ให้ผ่านก่อน จึงจะบันทึกได้</p>}
            <div className="mt-4 flex items-center justify-between border-t border-theme pt-4">
              <div>
                <p className="text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">Force clear cache</p>
                <p className="text-xs text-light-text-muted dark:text-dark-text-muted">ล้าง key ทั้งหมดที่มี prefix ปัจจุบัน</p>
              </div>
              <button type="button" onClick={() => setConfirmClear(true)} disabled={!can || fc} className={btnDgr}>
                {fc ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Force clear
              </button>
            </div>
          </>) : (
            <div className="mt-4 rounded-lg border border-theme bg-light-background px-4 py-3 text-sm text-light-text-muted dark:bg-dark-background dark:text-dark-text-muted">
              Redis ถูกปิดอยู่ จึงไม่แสดง connection fields, test และ cache control
            </div>
          )}
        </article>

        {/* ── SMTP ── */}
        <article className={card}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300"><Mail className="h-5 w-5" /></div>
              <div>
                <h2 className="text-base font-semibold text-light-text dark:text-dark-text">SMTP</h2>
                <p className="text-sm text-light-text-muted dark:text-dark-text-muted">Email delivery และ test mail</p>
              </div>
            </div>
            <div className="flex gap-2">
              {sf.enabled && <button type="button" onClick={() => void testSmtp()} disabled={st || ss} className={btnSec}>{st ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}Test</button>}
              <button type="button" onClick={() => void saveSmtp()} disabled={!can || ss || sl || !sDirty || !canSaveS} className={btnPri}>{ss ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save</button>
            </div>
          </div>

          {sl ? (
            <div className="grid min-h-32 place-items-center rounded-lg border border-theme bg-light-background dark:bg-dark-background"><RefreshCw className="h-5 w-5 animate-spin text-light-text-muted dark:text-dark-text-muted" /></div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-md border border-theme bg-light-background px-3 py-2.5 dark:bg-dark-background">
                <div><p className="text-sm font-medium text-light-text dark:text-dark-text">Enable SMTP</p><p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">เปิดการส่งอีเมลของระบบ</p></div>
                <Toggle checked={sf.enabled} onChange={() => setS("enabled", !sf.enabled)} disabled={!can} />
              </div>
              {sf.enabled && (<>
                <div><label className={lbl}>Encryption</label><select className={input} value={sf.encryption} onChange={e => setS("encryption", e.target.value as SmtpSettings["encryption"])} disabled={!can}><option value="starttls">STARTTLS</option><option value="ssl">SSL/TLS</option><option value="none">None</option></select></div>
                <div><label className={lbl}>Host</label><input className={input} value={sf.host} onChange={e => setS("host", e.target.value)} disabled={!can} /></div>
                <div><label className={lbl}>Port</label><input className={input} type="number" min={1} value={sf.port} onChange={e => setS("port", Number(e.target.value) || 0)} disabled={!can} /></div>
                <div><label className={lbl}>Username</label><input className={input} value={sf.user} onChange={e => setS("user", e.target.value)} placeholder="smtp user" disabled={!can} /></div>
                <div><label className={lbl}>Password</label><input className={input} type="password" value={sf.password ?? ""} onChange={e => setS("password", e.target.value)} placeholder={sf.hasPassword ? "ใช้รหัสผ่านเดิม ถ้าไม่กรอก" : "••••••••"} disabled={!can} /></div>
                <div><label className={lbl}>From name</label><input className={input} value={sf.fromName} onChange={e => setS("fromName", e.target.value)} disabled={!can} /></div>
                <div><label className={lbl}>From email</label><input className={input} value={sf.fromEmail} onChange={e => setS("fromEmail", e.target.value)} disabled={!can} /></div>
                <div><label className={lbl}>Email app name</label><input className={input} value={sf.appName} onChange={e => setS("appName", e.target.value)} disabled={!can} /></div>
                <div><label className={lbl}>Email app URL</label><input className={input} value={sf.appUrl} onChange={e => setS("appUrl", e.target.value)} placeholder="https://example.com" disabled={!can} /></div>
              </>)}
            </div>
          )}

          {sf.enabled ? (
            <div className="mt-5 border-t border-theme pt-4">
              <div className={`mb-4 rounded-lg border px-4 py-3 text-sm font-medium ${statusCls(sStatus)}`}>
                {sMsg}
                {sDirty && !canSaveS && <span className="mt-1 block text-xs opacity-80">ต้อง Test config ชุดนี้ให้ผ่านก่อน จึงจะบันทึกได้</span>}
              </div>
              <label className={lbl}>Send test email to</label>
              <div className="flex gap-2">
                <input className={input} value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="admin@example.com" disabled={!can || se} />
                <button type="button" onClick={() => void sendTest()} disabled={!can || se} className={btnPri}>{se ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send</button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-theme bg-light-background px-4 py-3 text-sm text-light-text-muted dark:bg-dark-background dark:text-dark-text-muted">
              SMTP ถูกปิดอยู่ จึงไม่แสดง connection fields, test และ test email
            </div>
          )}
        </article>
      </div>
      {/* Confirm clear modal */}
      {confirmClear && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">
            <div className="flex items-center gap-4 p-6 pb-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-light-text dark:text-dark-text">Force Clear Cache</h3>
                <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">
                  ลบเฉพาะ key ที่มี prefix <code className="rounded bg-light-primary/10 px-1 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">{rf.prefix}</code>
                </p>
              </div>
            </div>
            <div className="mx-6 mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-300">
                จะลบ cache ทั้งหมดของแอปนี้ทันที — แอปจะ rebuild cache ใหม่เอง แต่อาจช้าลงชั่วคราว
              </p>
            </div>
            <div className="flex gap-3 border-t border-theme px-6 py-4">
              <button type="button" onClick={() => setConfirmClear(false)}
                className="flex-1 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10">
                ยกเลิก
              </button>
              <button type="button" onClick={() => void forceClear()}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                <Trash2 className="h-4 w-4" />
                ยืนยัน ลบ cache
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default IntegrationsPage;
