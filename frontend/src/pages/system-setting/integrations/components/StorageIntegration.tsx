import { useState } from "react";
import { CheckCircle2, Cloud, FolderOpen, HardDrive, RefreshCw, Save, ShieldAlert, Wifi } from "lucide-react";
import { toast } from "react-toastify";
import GuardedInput from "@/common/GuardedInput";
import {
  btnPri,
  btnSec,
  defaultStorage,
  input,
  lbl,
  statusCls,
} from "../constants";
import type { ConnectionStatus, IntegrationStatusTone, S3Provider, StorageSettings, StorageType } from "../types";
import IntegrationRow from "./IntegrationRow";
import Toggle from "./Toggle";

type StorageIntegrationProps = {
  canUpdate: boolean;
  expanded: boolean;
  onToggle: () => void;
};

const storageTypeLabels: Record<StorageType, string> = {
  local: "Local Storage",
  smb: "SMB / Network Share",
  sftp: "SFTP",
  ftp: "FTP",
  s3: "S3 Compatible",
};

const s3ProviderLabels: Record<S3Provider, string> = {
  "amazon-s3": "Amazon S3",
  minio: "MinIO",
  "cloudflare-r2": "Cloudflare R2",
};

const getRequiredFields = (settings: StorageSettings): Array<keyof StorageSettings> => {
  if (!settings.enabled) return [];
  if (settings.type === "local") return [];
  if (settings.type === "smb") return ["host", "shareName", "username", "basePath"];
  if (settings.type === "sftp" || settings.type === "ftp") return ["host", "port", "username", "basePath"];
  return ["endpoint", "region", "bucket", "accessKey", "secretKey"];
};

const isStorageReady = (settings: StorageSettings) =>
  getRequiredFields(settings).every((field) => String(settings[field] ?? "").trim().length > 0);

const getStorageRowStatus = (
  settings: StorageSettings,
  status: ConnectionStatus,
  testing: boolean,
) => {
  if (testing) return { label: "กำลังตรวจสอบการตั้งค่า", tone: "loading" as IntegrationStatusTone, connected: false };
  if (!settings.enabled) return { label: "ปิดใช้งาน", tone: "disabled" as IntegrationStatusTone, connected: false };
  if (!isStorageReady(settings)) return { label: "ตั้งค่าไม่ครบ", tone: "error" as IntegrationStatusTone, connected: false };
  if (status === "ok") return { label: "พร้อมใช้งาน", tone: "connected" as IntegrationStatusTone, connected: true };
  if (status === "error") return { label: "Mock test ไม่ผ่าน", tone: "error" as IntegrationStatusTone, connected: false };
  return { label: "เปิดใช้งานแล้ว", tone: "enabled" as IntegrationStatusTone, connected: false };
};

const StorageIntegration = ({ canUpdate, expanded, onToggle }: StorageIntegrationProps) => {
  const [form, setForm] = useState<StorageSettings>(defaultStorage);
  const [savedForm, setSavedForm] = useState<StorageSettings>(defaultStorage);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("ok");
  const [message, setMessage] = useState("Local Storage เป็น backend storage ปัจจุบัน และถูกใช้เป็นค่าเริ่มต้น");

  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  const ready = isStorageReady(form);
  const rowStatus = getStorageRowStatus(form, status, testing);

  const setField = <K extends keyof StorageSettings>(key: K, value: StorageSettings[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setStatus("idle");
    setMessage("มีการแก้ไข storage config แต่ยังเป็น mock UI เท่านั้น");
  };

  const setStorageType = (type: StorageType) => {
    setForm((previous) => ({
      ...previous,
      enabled: true,
      type,
      port: type === "ftp" ? 21 : type === "sftp" ? 22 : previous.port,
      forcePathStyle: type === "s3" ? previous.forcePathStyle : false,
    }));
    setStatus(type === "local" ? "ok" : "idle");
    setMessage(type === "local"
      ? "Local Storage เป็น backend storage ปัจจุบัน และไม่ต้องตั้งค่าเพิ่ม"
      : "เลือก external storage แล้ว กรุณากรอกค่าที่จำเป็น");
  };

  const testStorage = async () => {
    setTesting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    if (ready) {
      setStatus("ok");
      setMessage(form.type === "local"
        ? "Local Storage พร้อมใช้งาน เป็น backend default ปัจจุบัน"
        : `Mock test ผ่าน: ${storageTypeLabels[form.type]} พร้อมใช้งาน`);
      toast.success("Mock storage test ผ่าน");
    } else {
      setStatus("error");
      setMessage("กรุณากรอกค่าที่จำเป็นให้ครบก่อนทดสอบ");
      toast.error("Storage settings ยังไม่ครบ");
    }
    setTesting(false);
  };

  const saveStorage = async () => {
    setSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    setSavedForm(form);
    setStatus(form.enabled && ready ? "ok" : form.enabled ? "error" : "idle");
    setMessage(form.type === "local"
      ? "บันทึก mock storage settings แล้ว ระบบยังใช้ Local Storage เป็นค่าเริ่มต้น"
      : "บันทึก mock storage settings แล้ว ยังไม่ได้เชื่อม API");
    toast.success("บันทึก mock storage settings แล้ว");
    setSaving(false);
  };

  return (
    <IntegrationRow
      title="Storage"
      description="Local, network share, file transfer และ object storage"
      icon={<HardDrive className="h-5 w-5" />}
      statusLabel={rowStatus.label}
      statusTone={rowStatus.tone}
      connected={rowStatus.connected}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">Storage settings</h3>
            <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">Mock UI สำหรับเตรียมรูปแบบ storage provider ในอนาคต</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void testStorage()} disabled={testing || saving} className={btnSec}>
              {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
              Test
            </button>
            {canUpdate && (
              <button type="button" onClick={() => void saveStorage()} disabled={saving || !dirty} className={btnPri}>
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border border-theme bg-light-background px-3 py-2.5 dark:bg-dark-background">
            <div>
              <p className="text-sm font-medium text-light-text dark:text-dark-text">Backend fallback</p>
              <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">ถ้าไม่ได้เลือก external provider ระบบจะใช้ Local Storage ที่ backend มีอยู่แล้ว</p>
            </div>
          </div>

          <div>
            <label className={lbl}>Storage type</label>
            <select className={input} value={form.type} onChange={(event) => setStorageType(event.target.value as StorageType)} disabled={!canUpdate}>
              <option value="local">Local Storage</option>
              <option value="smb">SMB / Network Share</option>
              <option value="sftp">SFTP</option>
              <option value="ftp">FTP</option>
              <option value="s3">S3 Compatible</option>
            </select>
          </div>
        </div>

        <>
            <div className="rounded-lg border border-theme bg-light-background p-4 dark:bg-dark-background">
              <div className="mb-4 flex items-center gap-2">
                {form.type === "s3" ? <Cloud className="h-4 w-4 text-light-primary dark:text-dark-primary" /> : <FolderOpen className="h-4 w-4 text-light-primary dark:text-dark-primary" />}
                <h4 className="text-sm font-semibold text-light-text dark:text-dark-text">{storageTypeLabels[form.type]}</h4>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {form.type === "local" && (
                  <div className="md:col-span-2 rounded-md border border-theme bg-light-background-card px-4 py-3 text-sm text-light-text-muted dark:bg-dark-background-card dark:text-dark-text-muted">
                    Local Storage ถูกล็อคเป็นค่า default ของ backend ปัจจุบัน ไม่ต้องกรอก path เพิ่มในหน้านี้
                  </div>
                )}

                {form.type === "smb" && (
                  <>
                    <TextField label="Host" value={form.host} onChange={(value) => setField("host", value)} disabled={!canUpdate} placeholder="fileserver.local" />
                    <TextField label="Share name" value={form.shareName} onChange={(value) => setField("shareName", value)} disabled={!canUpdate} placeholder="shared" />
                    <TextField label="Domain (optional)" value={form.domain} onChange={(value) => setField("domain", value)} disabled={!canUpdate} placeholder="เว้นว่างได้ ถ้าไม่ได้ใช้ AD domain" />
                    <TextField label="Username" value={form.username} onChange={(value) => setField("username", value)} disabled={!canUpdate} />
                    <PasswordField label="Password" value={form.password} onChange={(value) => setField("password", value)} disabled={!canUpdate} />
                    <TextField label="Base path" value={form.basePath} onChange={(value) => setField("basePath", value)} disabled={!canUpdate} placeholder="/documents" />
                  </>
                )}

                {(form.type === "sftp" || form.type === "ftp") && (
                  <>
                    <TextField label="Host" value={form.host} onChange={(value) => setField("host", value)} disabled={!canUpdate} placeholder="storage.example.com" />
                    <NumberField label="Port" value={form.port} onChange={(value) => setField("port", value)} disabled={!canUpdate} />
                    <TextField label="Username" value={form.username} onChange={(value) => setField("username", value)} disabled={!canUpdate} />
                    <PasswordField label="Password" value={form.password} onChange={(value) => setField("password", value)} disabled={!canUpdate} />
                    <TextField label="Base path" value={form.basePath} onChange={(value) => setField("basePath", value)} disabled={!canUpdate} placeholder="/uploads" />
                  </>
                )}

                {form.type === "s3" && (
                  <>
                    <div>
                      <label className={lbl}>S3 provider</label>
                      <select className={input} value={form.s3Provider} onChange={(event) => setField("s3Provider", event.target.value as S3Provider)} disabled={!canUpdate}>
                        <option value="amazon-s3">Amazon S3</option>
                        <option value="minio">MinIO</option>
                        <option value="cloudflare-r2">Cloudflare R2</option>
                      </select>
                    </div>
                    <UrlField label="Endpoint" value={form.endpoint} onChange={(value) => setField("endpoint", value)} disabled={!canUpdate} placeholder={form.s3Provider === "amazon-s3" ? "https://s3.amazonaws.com" : "https://storage.example.com"} />
                    <TextField label="Region" value={form.region} onChange={(value) => setField("region", value)} disabled={!canUpdate} placeholder="ap-southeast-1" />
                    <TextField label="Bucket" value={form.bucket} onChange={(value) => setField("bucket", value)} disabled={!canUpdate} />
                    <TextField label="Access key" value={form.accessKey} onChange={(value) => setField("accessKey", value)} disabled={!canUpdate} />
                    <PasswordField label="Secret key" value={form.secretKey} onChange={(value) => setField("secretKey", value)} disabled={!canUpdate} />
                    <TextField label="Path prefix" value={form.pathPrefix} onChange={(value) => setField("pathPrefix", value)} disabled={!canUpdate} placeholder="uploads/" />
                    <div className="flex items-center justify-between gap-3 rounded-md border border-theme bg-light-background-card px-3 py-2.5 dark:bg-dark-background-card">
                      <div>
                        <p className="text-sm font-medium text-light-text dark:text-dark-text">Force path style</p>
                        <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">เหมาะกับ MinIO และ S3-compatible บางตัว</p>
                      </div>
                      <Toggle checked={form.forcePathStyle} onChange={() => setField("forcePathStyle", !form.forcePathStyle)} disabled={!canUpdate} />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${statusCls(status)}`}>
              {status === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <ShieldAlert className="h-4 w-4 shrink-0" />}
              <span>
                {message}
                {form.type === "s3" && <span className="mt-1 block text-xs opacity-80">Provider: {s3ProviderLabels[form.s3Provider]}</span>}
              </span>
            </div>
        </>
      </div>
    </IntegrationRow>
  );
};

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

const TextField = ({ label, value, onChange, disabled, placeholder }: TextFieldProps) => (
  <div>
    <label className={lbl}>{label}</label>
    <GuardedInput className={input} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} placeholder={placeholder} />
  </div>
);

const PasswordField = ({ label, value, onChange, disabled, placeholder }: TextFieldProps) => (
  <div>
    <label className={lbl}>{label}</label>
    <input className={input} type="password" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} placeholder={placeholder ?? "••••••••"} />
  </div>
);

type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

const NumberField = ({ label, value, onChange, disabled }: NumberFieldProps) => (
  <div>
    <label className={lbl}>{label}</label>
    <input className={input} type="number" min={1} value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} disabled={disabled} />
  </div>
);

type UrlFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

const UrlField = ({ label, value, onChange, disabled, placeholder }: UrlFieldProps) => (
  <div>
    <label className={lbl}>{label}</label>
    <input className={input} type="url" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} placeholder={placeholder} />
  </div>
);

export default StorageIntegration;
