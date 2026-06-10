import { useEffect, useState } from "react";
import { CheckCircle2, Mail, RefreshCw, Save, Send, ShieldAlert, Wifi } from "lucide-react";
import { toast } from "react-toastify";
import { useApi } from "@/hooks/useApi";
import {
  btnPri,
  btnSec,
  defaultSmtp,
  getIntegrationStatus,
  input,
  lbl,
  statusCls,
} from "../constants";
import type { ActionResponse, ConnectionStatus, SmtpResponse, SmtpSettings } from "../types";
import IntegrationRow from "./IntegrationRow";
import Toggle from "./Toggle";

type SmtpIntegrationProps = {
  canUpdate: boolean;
  expanded: boolean;
  onToggle: () => void;
};

const SmtpIntegration = ({ canUpdate, expanded, onToggle }: SmtpIntegrationProps) => {
  const { get, put, post } = useApi();
  const [form, setForm] = useState<SmtpSettings>(defaultSmtp);
  const [savedForm, setSavedForm] = useState<SmtpSettings>(defaultSmtp);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [healthChecking, setHealthChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [message, setMessage] = useState("ยังไม่ได้ทดสอบการเชื่อมต่อ");
  const [testedSignature, setTestedSignature] = useState("");

  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  const currentSignature = JSON.stringify({
    enabled: form.enabled,
    host: form.host,
    port: Number(form.port),
    encryption: form.encryption,
    user: form.user,
    password: form.password ?? "",
    fromName: form.fromName,
    fromEmail: form.fromEmail,
    appName: form.appName,
    appUrl: form.appUrl,
  });
  const canSave = !form.enabled || testedSignature === currentSignature;
  const rowStatus = getIntegrationStatus(form.enabled, status, loading || healthChecking);

  const checkCurrentSmtp = async (
    settings: SmtpSettings,
    isActive: () => boolean = () => true,
  ) => {
    if (!isActive()) return;
    setHealthChecking(true);
    setStatus("idle");
    setMessage("กำลังตรวจสอบการเชื่อมต่อ SMTP ปัจจุบัน");
    try {
      const health = await post<ActionResponse>("/system-setting/smtp/test", {
        ...settings,
        password: settings.password?.trim() || undefined,
        port: Number(settings.port),
      });
      if (!isActive()) return;
      setStatus(health.data.success ? "ok" : "error");
      setMessage(health.data.message);
    } catch (error) {
      if (!isActive()) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "SMTP health check failed");
    } finally {
      if (isActive()) setHealthChecking(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await get<SmtpResponse>("/system-setting/smtp");
        if (!active) return;
        const next = { ...defaultSmtp, ...response.data.data, password: "" };
        setForm(next);
        setSavedForm(next);
        setStatus(next.enabled ? "idle" : "error");
        setMessage(next.enabled ? "กำลังตรวจสอบการเชื่อมต่อ SMTP ปัจจุบัน" : "SMTP ถูกปิดอยู่");
        if (next.enabled) {
          void checkCurrentSmtp(next, () => active);
        }
      } catch (error) {
        if (active) toast.error(error instanceof Error ? error.message : "Failed to load SMTP");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const setField = <K extends keyof SmtpSettings>(key: K, value: SmtpSettings[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setTestedSignature("");
    setStatus("idle");
    setMessage("มีการแก้ไข config กรุณา Test ให้ผ่านก่อน Save");
  };

  const testSmtp = async () => {
    setTesting(true);
    try {
      const response = await post<ActionResponse>("/system-setting/smtp/test", {
        ...form,
        password: form.password?.trim() || undefined,
        port: Number(form.port),
      });
      setStatus(response.data.success ? "ok" : "error");
      setMessage(response.data.message);
      if (response.data.success) {
        setTestedSignature(currentSignature);
        toast.success(response.data.message);
      } else {
        setTestedSignature("");
        toast.error(response.data.message);
      }
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "SMTP test failed";
      setStatus("error");
      setTestedSignature("");
      setMessage(nextMessage);
      toast.error(nextMessage);
    } finally {
      setTesting(false);
    }
  };

  const saveSmtp = async () => {
    setSaving(true);
    try {
      const response = await put<SmtpResponse>("/system-setting/smtp", {
        ...form,
        password: form.password?.trim() || undefined,
        port: Number(form.port),
      });
      const next = { ...defaultSmtp, ...response.data.data, password: "" };
      setForm(next);
      setSavedForm(next);
      setStatus(next.enabled ? "idle" : "error");
      setMessage(next.enabled ? "บันทึกแล้ว ยังไม่ได้ทดสอบ" : "SMTP ถูกปิดอยู่");
      if (next.enabled) void checkCurrentSmtp(next);
      toast.success("บันทึก SMTP settings แล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save SMTP");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testEmail.trim()) {
      toast.error("กรุณากรอกอีเมลผู้รับ");
      return;
    }
    setSending(true);
    try {
      const response = await post<ActionResponse>("/system-setting/smtp/send-test", { to: testEmail.trim() });
      response.data.success ? toast.success(response.data.message) : toast.error(response.data.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send test email");
    } finally {
      setSending(false);
    }
  };

  return (
    <IntegrationRow
      title="SMTP"
      description="Email delivery และ test mail"
      icon={<Mail className="h-5 w-5" />}
      statusLabel={rowStatus.label}
      statusTone={rowStatus.tone}
      connected={rowStatus.connected}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">SMTP settings</h3>
            <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">ทดสอบ connection ก่อน save และส่ง test email ได้หลังเปิดใช้งาน</p>
          </div>
          <div className="flex gap-2">
            {form.enabled && (
              <button type="button" onClick={() => void testSmtp()} disabled={testing || saving} className={btnSec}>
                {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                Test
              </button>
            )}
            {canUpdate && (
              <button type="button" onClick={() => void saveSmtp()} disabled={saving || loading || !dirty || !canSave} className={btnPri}>
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            )}
          </div>
        </div>

        {loading ? (
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
              <Toggle checked={form.enabled} onChange={() => setField("enabled", !form.enabled)} disabled={!canUpdate} />
            </div>
            {form.enabled && (
              <>
                <div>
                  <label className={lbl}>Encryption</label>
                  <select className={input} value={form.encryption} onChange={(event) => setField("encryption", event.target.value as SmtpSettings["encryption"])} disabled={!canUpdate}>
                    <option value="starttls">STARTTLS</option>
                    <option value="ssl">SSL/TLS</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Host</label>
                  <input className={input} value={form.host} onChange={(event) => setField("host", event.target.value)} disabled={!canUpdate} />
                </div>
                <div>
                  <label className={lbl}>Port</label>
                  <input className={input} type="number" min={1} value={form.port} onChange={(event) => setField("port", Number(event.target.value) || 0)} disabled={!canUpdate} />
                </div>
                <div>
                  <label className={lbl}>Username</label>
                  <input className={input} value={form.user} onChange={(event) => setField("user", event.target.value)} placeholder="smtp user" disabled={!canUpdate} />
                </div>
                <div>
                  <label className={lbl}>Password</label>
                  <input className={input} type="password" value={form.password ?? ""} onChange={(event) => setField("password", event.target.value)} placeholder={form.hasPassword ? "ใช้รหัสผ่านเดิม ถ้าไม่กรอก" : "••••••••"} disabled={!canUpdate} />
                </div>
                <div>
                  <label className={lbl}>From name</label>
                  <input className={input} value={form.fromName} onChange={(event) => setField("fromName", event.target.value)} disabled={!canUpdate} />
                </div>
                <div>
                  <label className={lbl}>From email</label>
                  <input className={input} value={form.fromEmail} onChange={(event) => setField("fromEmail", event.target.value)} disabled={!canUpdate} />
                </div>
                <div>
                  <label className={lbl}>Email app name</label>
                  <input className={input} value={form.appName} onChange={(event) => setField("appName", event.target.value)} disabled={!canUpdate} />
                </div>
                <div>
                  <label className={lbl}>Email app URL</label>
                  <input className={input} value={form.appUrl} onChange={(event) => setField("appUrl", event.target.value)} placeholder="https://example.com" disabled={!canUpdate} />
                </div>
              </>
            )}
          </div>
        )}

        {form.enabled ? (
          <div className="border-t border-theme pt-4">
            <div className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${statusCls(status)}`}>
              {status === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <ShieldAlert className="h-4 w-4 shrink-0" />}
              <span>
                {message}
                {dirty && !canSave && <span className="mt-1 block text-xs opacity-80">ต้อง Test config ชุดนี้ให้ผ่านก่อน จึงจะบันทึกได้</span>}
              </span>
            </div>
            <label className={lbl}>Send test email to</label>
            <div className="flex gap-2">
              <input className={input} value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="admin@example.com" disabled={!canUpdate || sending} />
              <button type="button" onClick={() => void sendTest()} disabled={!canUpdate || sending} className={btnPri}>
                {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-theme bg-light-background px-4 py-3 text-sm text-light-text-muted dark:bg-dark-background dark:text-dark-text-muted">
            SMTP ถูกปิดอยู่ จึงไม่แสดง connection fields, test และ test email
          </div>
        )}
      </div>
    </IntegrationRow>
  );
};

export default SmtpIntegration;
