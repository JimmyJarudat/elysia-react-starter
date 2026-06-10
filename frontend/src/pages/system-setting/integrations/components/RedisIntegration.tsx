import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Database, RefreshCw, Save, ShieldAlert, Trash2, Wifi } from "lucide-react";
import { toast } from "react-toastify";
import { useApi } from "@/hooks/useApi";
import {
  btnDgr,
  btnPri,
  btnSec,
  defaultRedis,
  getIntegrationStatus,
  input,
  lbl,
  statusCls,
} from "../constants";
import type { ActionResponse, ConnectionStatus, RedisResponse, RedisSettings, RedisStatusResponse } from "../types";
import IntegrationRow from "./IntegrationRow";
import RedisClearCacheModal from "./RedisClearCacheModal";
import Toggle from "./Toggle";

type RedisIntegrationProps = {
  canUpdate: boolean;
  expanded: boolean;
  onToggle: () => void;
};

const RedisIntegration = ({ canUpdate, expanded, onToggle }: RedisIntegrationProps) => {
  const { get, put, post } = useApi();
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState<RedisSettings>(defaultRedis);
  const [savedForm, setSavedForm] = useState<RedisSettings>(defaultRedis);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [healthChecking, setHealthChecking] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [message, setMessage] = useState("ยังไม่ได้ทดสอบการเชื่อมต่อ");
  const [testedSignature, setTestedSignature] = useState("");

  const confirmClear = searchParams.get("modal") === "redis-clear";
  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  const currentSignature = JSON.stringify({
    enabled: form.enabled,
    host: form.host,
    port: Number(form.port),
    db: Number(form.db),
    prefix: form.prefix,
    password: form.password ?? "",
  });
  const canSave = !form.enabled || testedSignature === currentSignature;
  const rowStatus = getIntegrationStatus(form.enabled, status, loading || healthChecking);

  const closeClearModal = () => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.delete("modal");
      return next;
    });
  };

  const openClearModal = () => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.set("modal", "redis-clear");
      return next;
    });
  };

  const checkCurrentRedis = async (isActive: () => boolean = () => true) => {
    if (!isActive()) return;
    setHealthChecking(true);
    setStatus("idle");
    setMessage("กำลังตรวจสอบการเชื่อมต่อ Redis ปัจจุบัน");
    try {
      const health = await get<RedisStatusResponse>("/system-setting/integrations/redis/status");
      if (!isActive()) return;
      const connected = Boolean(health.data.data?.connected);
      const latencyText = connected && typeof health.data.data?.latencyMs === "number"
        ? ` (${health.data.data.latencyMs} ms)`
        : "";
      setStatus(connected ? "ok" : "error");
      setMessage(health.data.message || (connected ? `Redis connected${latencyText}` : "Redis unavailable"));
    } catch (error) {
      if (!isActive()) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Redis health check failed");
    } finally {
      if (isActive()) setHealthChecking(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await get<RedisResponse>("/system-setting/integrations/redis");
        if (!active) return;
        const next = { ...defaultRedis, ...response.data.data, password: "" };
        setForm(next);
        setSavedForm(next);
        setStatus(next.enabled ? "idle" : "error");
        setMessage(next.enabled ? "กำลังตรวจสอบการเชื่อมต่อ Redis ปัจจุบัน" : "Redis ถูกปิดอยู่");
        if (next.enabled) {
          void checkCurrentRedis(() => active);
        }
      } catch (error) {
        if (active) toast.error(error instanceof Error ? error.message : "Failed to load Redis");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const setField = <K extends keyof RedisSettings>(key: K, value: RedisSettings[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setTestedSignature("");
    setStatus("idle");
    setMessage("มีการแก้ไข config กรุณา Test ให้ผ่านก่อน Save");
  };

  const testRedis = async () => {
    setTesting(true);
    try {
      const response = await post<ActionResponse>("/system-setting/integrations/redis/test", {
        ...form,
        password: form.password?.trim() || undefined,
        port: Number(form.port),
        db: Number(form.db),
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
      const nextMessage = error instanceof Error ? error.message : "Redis test failed";
      setStatus("error");
      setTestedSignature("");
      setMessage(nextMessage);
      toast.error(nextMessage);
    } finally {
      setTesting(false);
    }
  };

  const saveRedis = async () => {
    setSaving(true);
    try {
      const response = await put<RedisResponse>("/system-setting/integrations/redis", {
        ...form,
        password: form.password?.trim() || undefined,
        port: Number(form.port),
        db: Number(form.db),
      });
      const next = { ...defaultRedis, ...response.data.data, password: "" };
      setForm(next);
      setSavedForm(next);
      setStatus(next.enabled ? "idle" : "error");
      setMessage(next.enabled ? "บันทึกแล้ว Redis reconnect แล้ว" : "Redis ถูกปิดอยู่");
      if (next.enabled) void checkCurrentRedis();
      toast.success("บันทึก Redis settings แล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save Redis");
    } finally {
      setSaving(false);
    }
  };

  const forceClear = async () => {
    closeClearModal();
    setClearing(true);
    try {
      const response = await post<ActionResponse>("/system-setting/integrations/redis/clear", {});
      toast.success(response.data.message || "ล้าง Redis cache ทั้งหมดแล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear Redis");
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      <IntegrationRow
        title="Redis"
        description="Cache, presence และ route/menu cache"
        icon={<Database className="h-5 w-5" />}
        statusLabel={rowStatus.label}
        statusTone={rowStatus.tone}
        connected={rowStatus.connected}
        expanded={expanded}
        onToggle={onToggle}
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">Redis settings</h3>
              <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">ต้อง Test config ที่เปิดใช้งานให้ผ่านก่อนบันทึก</p>
            </div>
            <div className="flex gap-2">
              {form.enabled && (
                <button type="button" onClick={() => void testRedis()} disabled={testing || saving} className={btnSec}>
                  {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                  Test
                </button>
              )}
              {canUpdate && (
                <button type="button" onClick={() => void saveRedis()} disabled={saving || loading || !dirty || !canSave} className={btnPri}>
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
                  <p className="text-sm font-medium text-light-text dark:text-dark-text">Enable Redis</p>
                  <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">ใช้ Redis สำหรับ cache และ online presence</p>
                </div>
                <Toggle checked={form.enabled} onChange={() => setField("enabled", !form.enabled)} disabled={!canUpdate} />
              </div>
              {form.enabled && (
                <>
                  <div>
                    <label className={lbl}>Key prefix</label>
                    <input className={input} value={form.prefix} onChange={(event) => setField("prefix", event.target.value)} disabled={!canUpdate} placeholder="it-utils:" />
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
                    <label className={lbl}>Database</label>
                    <input className={input} type="number" min={0} value={form.db} onChange={(event) => setField("db", Number(event.target.value) || 0)} disabled={!canUpdate} />
                  </div>
                  <div>
                    <label className={lbl}>Password</label>
                    <input className={input} type="password" value={form.password ?? ""} onChange={(event) => setField("password", event.target.value)} placeholder={form.hasPassword ? "ใช้รหัสผ่านเดิม ถ้าไม่กรอก" : "••••••••"} disabled={!canUpdate} />
                  </div>
                </>
              )}
            </div>
          )}

          {form.enabled ? (
            <>
              <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${statusCls(status)}`}>
                {status === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <ShieldAlert className="h-4 w-4 shrink-0" />}
                <span>{message}</span>
              </div>
              {dirty && !canSave && <p className="text-xs text-amber-600 dark:text-amber-400">ต้อง Test config ชุดนี้ให้ผ่านก่อน จึงจะบันทึกได้</p>}
              {canUpdate && (
                <div className="flex items-center justify-between border-t border-theme pt-4">
                  <div>
                    <p className="text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">Force clear cache</p>
                    <p className="text-xs text-light-text-muted dark:text-dark-text-muted">ล้าง key ทั้งหมดที่มี prefix ปัจจุบัน</p>
                  </div>
                  <button type="button" onClick={openClearModal} disabled={clearing} className={btnDgr}>
                    {clearing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Force clear
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-theme bg-light-background px-4 py-3 text-sm text-light-text-muted dark:bg-dark-background dark:text-dark-text-muted">
              Redis ถูกปิดอยู่ จึงไม่แสดง connection fields, test และ cache control
            </div>
          )}
        </div>
      </IntegrationRow>

      {confirmClear && (
        <RedisClearCacheModal
          prefix={form.prefix}
          onCancel={closeClearModal}
          onConfirm={() => void forceClear()}
        />
      )}
    </>
  );
};

export default RedisIntegration;
