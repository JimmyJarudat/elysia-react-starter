import { useEffect, useState } from "react";
import { CheckCircle2, Network, RefreshCw, Save, Search, ShieldAlert } from "lucide-react";
import { toast } from "react-toastify";
import { useApi } from "@/hooks/useApi";
import {
  btnPri,
  btnSec,
  defaultLdap,
  getIntegrationStatus,
  input,
  lbl,
  statusCls,
} from "../constants";
import type { ConnectionStatus, LdapEncryption, LdapFetchUserResponse, LdapResponse, LdapSettings, LdapUser } from "../types";
import IntegrationRow from "./IntegrationRow";
import Toggle from "./Toggle";

type LdapIntegrationProps = {
  canUpdate: boolean;
  expanded: boolean;
  onToggle: () => void;
};

const LdapIntegration = ({ canUpdate, expanded, onToggle }: LdapIntegrationProps) => {
  const { get, put, post } = useApi();
  const [form, setForm] = useState<LdapSettings>(defaultLdap);
  const [savedForm, setSavedForm] = useState<LdapSettings>(defaultLdap);
  const [username, setUsername] = useState("j.smith");
  const [user, setUser] = useState<LdapUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [message, setMessage] = useState("กรอก username แล้วลองดึง user จาก LDAP");

  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  const rowStatus = getIntegrationStatus(form.enabled, status, loading || fetching);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await get<LdapResponse>("/system-setting/integrations/ldap");
        if (!active) return;
        const next = { ...defaultLdap, ...response.data.data, bindPassword: "" };
        setForm(next);
        setSavedForm(next);
        setStatus(next.enabled ? "idle" : "error");
        setMessage(next.enabled ? "กรอก username แล้วลองดึง user จาก LDAP" : "LDAP ถูกปิดอยู่");
      } catch (error) {
        if (active) toast.error(error instanceof Error ? error.message : "Failed to load LDAP settings");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const setField = <K extends keyof LdapSettings>(key: K, value: LdapSettings[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setUser(null);
    setStatus("idle");
    setMessage("มีการแก้ไข config LDAP กรุณาลอง Fetch user อีกครั้ง");
  };

  const fetchUser = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      toast.error("กรุณากรอก username");
      return;
    }

    setFetching(true);
    setStatus("idle");
    setUser(null);
    setMessage("กำลังดึง user จาก backend LDAP endpoint");
    try {
      const response = await post<LdapFetchUserResponse>("/system-setting/integrations/ldap/fetch-user", {
        username: trimmedUsername,
        settings: {
          ...form,
          bindPassword: form.bindPassword?.trim() || undefined,
        },
      });
      setStatus(response.data.success ? "ok" : "error");
      setMessage(response.data.message);
      setUser(response.data.data ?? null);
      response.data.success ? toast.success(response.data.message) : toast.error(response.data.message);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Failed to fetch LDAP user";
      setStatus("error");
      setMessage(nextMessage);
      toast.error(nextMessage);
    } finally {
      setFetching(false);
    }
  };

  const saveLdap = async () => {
    setSaving(true);
    try {
      const response = await put<LdapResponse>("/system-setting/integrations/ldap", {
        ...form,
        bindPassword: form.bindPassword?.trim() || undefined,
      });
      const next = { ...defaultLdap, ...response.data.data, bindPassword: "" };
      setForm(next);
      setSavedForm(next);
      setStatus(next.enabled ? "idle" : "error");
      setMessage(next.enabled ? "บันทึก LDAP settings แล้ว ลอง Fetch user ได้เลย" : "LDAP ถูกปิดอยู่");
      toast.success("บันทึก LDAP settings แล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save LDAP settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <IntegrationRow
      title="LDAP"
      description="ค้นหาและดึงข้อมูล user จาก directory"
      icon={<Network className="h-5 w-5" />}
      statusLabel={rowStatus.label}
      statusTone={rowStatus.tone}
      connected={rowStatus.connected}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">LDAP user lookup</h3>
            <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">ค้นหา user จาก LDAP server ด้วยค่าที่ตั้งไว้</p>
          </div>
          {canUpdate && (
            <button type="button" onClick={() => void saveLdap()} disabled={saving || loading || !dirty} className={btnPri}>
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid min-h-32 place-items-center rounded-lg border border-theme bg-light-background dark:bg-dark-background">
            <RefreshCw className="h-5 w-5 animate-spin text-light-text-muted dark:text-dark-text-muted" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-md border border-theme bg-light-background px-3 py-2.5 dark:bg-dark-background">
              <div>
                <p className="text-sm font-medium text-light-text dark:text-dark-text">Enable LDAP</p>
                <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">เปิดการค้นหา user จาก directory</p>
              </div>
              <Toggle checked={form.enabled} onChange={() => setField("enabled", !form.enabled)} disabled={!canUpdate} />
            </div>

            {form.enabled && (
              <>
                <div>
                  <label className={lbl}>LDAP URL</label>
                  <input className={input} value={form.url} onChange={(event) => setField("url", event.target.value)} placeholder="ldap://ldap.example.com:389" disabled={!canUpdate} />
                </div>
                <div>
                  <label className={lbl}>Encryption</label>
                  <select className={input} value={form.encryption} onChange={(event) => setField("encryption", event.target.value as LdapEncryption)} disabled={!canUpdate}>
                    <option value="starttls">STARTTLS</option>
                    <option value="ldaps">LDAPS</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Bind DN</label>
                  <input className={input} value={form.bindDn} onChange={(event) => setField("bindDn", event.target.value)} placeholder="cn=admin,dc=example,dc=com" disabled={!canUpdate} />
                </div>
                <div>
                  <label className={lbl}>Bind password</label>
                  <input className={input} type="password" value={form.bindPassword} onChange={(event) => setField("bindPassword", event.target.value)} placeholder={form.hasBindPassword ? "ใช้รหัสผ่านเดิม ถ้าไม่กรอก" : "••••••••"} disabled={!canUpdate} />
                </div>
                <div>
                  <label className={lbl}>Base DN</label>
                  <input className={input} value={form.baseDn} onChange={(event) => setField("baseDn", event.target.value)} placeholder="dc=example,dc=com" disabled={!canUpdate} />
                </div>
                <div>
                  <label className={lbl}>User filter</label>
                  <input className={input} value={form.userFilter} onChange={(event) => setField("userFilter", event.target.value)} disabled={!canUpdate} />
                </div>
              </>
            )}
          </div>
        )}

        {form.enabled ? (
          <>
            <div className="border-t border-theme pt-4">
              <label className={lbl}>Fetch LDAP user</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input className={input} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username" disabled={fetching} />
                <button type="button" onClick={() => void fetchUser()} disabled={fetching} className={btnSec}>
                  {fetching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Fetch user
                </button>
              </div>
            </div>

            <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${statusCls(status)}`}>
              {status === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <ShieldAlert className="h-4 w-4 shrink-0" />}
              <span>{message}</span>
            </div>

            {user && (
              <div className="grid gap-3 rounded-lg border border-theme bg-light-background p-4 dark:bg-dark-background md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">Username</p>
                  <p className="mt-1 text-sm font-medium text-light-text dark:text-dark-text">{user.username}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">Display name</p>
                  <p className="mt-1 text-sm font-medium text-light-text dark:text-dark-text">{user.displayName}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">Email</p>
                  <p className="mt-1 text-sm font-medium text-light-text dark:text-dark-text">{user.email}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">DN</p>
                  <p className="mt-1 break-all text-sm font-medium text-light-text dark:text-dark-text">{user.dn}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">Filter</p>
                  <p className="mt-1 break-all text-sm font-medium text-light-text dark:text-dark-text">{user.filter}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-theme bg-light-background px-4 py-3 text-sm text-light-text-muted dark:bg-dark-background dark:text-dark-text-muted">
            LDAP ถูกปิดอยู่ จึงยังไม่แสดงช่อง fetch user
          </div>
        )}
      </div>
    </IntegrationRow>
  );
};

export default LdapIntegration;
