import { useEffect, useState } from "react";
import { ArrowRightLeft, CheckCircle2, Cloud, FolderOpen, HardDrive, RefreshCw, Save, ShieldAlert, Wifi } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import GuardedInput from "@/common/GuardedInput";
import { useApi } from "@/hooks/useApi";
import {
  btnPri,
  btnSec,
  defaultStorage,
  input,
  lbl,
  statusCls,
} from "../constants";
import type { ActionResponse, ConnectionStatus, IntegrationStatusTone, S3Provider, StorageMigrationStatusResponse, StorageResponse, StorageSettings, StorageType } from "../types";
import IntegrationRow from "./IntegrationRow";
import StorageMigrationModal from "./StorageMigrationModal";
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
  loading: boolean,
) => {
  if (loading) return { label: "กำลังตรวจสอบการเชื่อมต่อ", tone: "loading" as IntegrationStatusTone, connected: false };
  if (!isStorageReady(settings)) return { label: "ตั้งค่าไม่ครบ", tone: "error" as IntegrationStatusTone, connected: false };
  if (status === "ok") return { label: "เชื่อมต่อแล้ว", tone: "connected" as IntegrationStatusTone, connected: true };
  if (status === "error") return { label: "เชื่อมต่อล้มเหลว", tone: "error" as IntegrationStatusTone, connected: false };
  return { label: "เปิดใช้งานแล้ว", tone: "enabled" as IntegrationStatusTone, connected: false };
};

const mapStorageResponse = (response: StorageResponse["data"]): StorageSettings => ({
  ...defaultStorage,
  enabled: true,
  type: response.provider,
  host: response.provider === "sftp" ? response.sftp.host : response.smb.host,
  port: response.provider === "sftp" ? response.sftp.port : defaultStorage.port,
  shareName: response.smb.shareName,
  domain: response.smb.domain,
  username: response.provider === "sftp" ? response.sftp.username : response.smb.username,
  password: "",
  hasPassword: response.provider === "sftp" ? response.sftp.hasPassword : response.smb.hasPassword,
  basePath: response.provider === "sftp" ? response.sftp.basePath : response.smb.basePath,
});

const StorageIntegration = ({ canUpdate, expanded, onToggle }: StorageIntegrationProps) => {
  const { get, put, post } = useApi();
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState<StorageSettings>(defaultStorage);
  const [savedForm, setSavedForm] = useState<StorageSettings>(defaultStorage);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [healthChecking, setHealthChecking] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [message, setMessage] = useState("ยังไม่ได้ทดสอบการเชื่อมต่อ");
  const [testedSignature, setTestedSignature] = useState("");
  const [migrationStatus, setMigrationStatus] = useState<StorageMigrationStatusResponse["data"] | null>(null);
  const showMigrationModal = searchParams.get("storageModal") === "migration";

  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  const ready = isStorageReady(form);
  const currentSignature = JSON.stringify({
    type: form.type,
    host: form.host,
    shareName: form.shareName,
    domain: form.domain,
    username: form.username,
    password: form.password ?? "",
    port: form.port,
    basePath: form.basePath,
  });
  const canSave = form.type === "local" || testedSignature === currentSignature;
  const rowStatus = getStorageRowStatus(form, status, loading || testing || healthChecking);

  const openMigrationModal = () => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      const opened = next.getAll("integration");
      next.delete("integration");
      [...new Set([...opened, "storage"])].forEach((item) => next.append("integration", item));
      next.set("storageModal", "migration");
      return next;
    });
  };

  const closeMigrationModal = () => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.delete("storageModal");
      return next;
    });
    void fetchMigrationStatus();
  };

  const fetchMigrationStatus = async () => {
    try {
      const response = await get<StorageMigrationStatusResponse>("/system-setting/integrations/storage/migration/status");
      const nextStatus = response.data.data;
      setMigrationStatus(nextStatus);
      if (!nextStatus.available && searchParams.get("storageModal") === "migration") {
        setSearchParams((params) => {
          const next = new URLSearchParams(params);
          next.delete("storageModal");
          return next;
        });
      }
    } catch {
      /* ignore - migration status is best-effort */
    }
  };

  const checkCurrentStorage = async (
    settings: StorageSettings,
    isActive: () => boolean = () => true,
  ) => {
    if (!isActive()) return;
    setHealthChecking(true);
    setStatus("idle");
    setMessage(`กำลังตรวจสอบการเชื่อมต่อ ${storageTypeLabels[settings.type]} ปัจจุบัน`);
    try {
      const response = await post<ActionResponse>("/system-setting/integrations/storage/test", {
        provider: settings.type,
        smbHost: settings.host,
        smbShareName: settings.shareName,
        smbDomain: settings.domain,
        smbUsername: settings.username,
        smbBasePath: settings.basePath,
        sftpHost: settings.host,
        sftpPort: settings.port,
        sftpUsername: settings.username,
        sftpBasePath: settings.basePath,
      });
      if (!isActive()) return;
      setStatus(response.data.success ? "ok" : "error");
      setMessage(response.data.message);
    } catch (error) {
      if (!isActive()) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Storage health check failed");
    } finally {
      if (isActive()) setHealthChecking(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await get<StorageResponse>("/system-setting/integrations/storage");
        if (!active) return;
        const next = mapStorageResponse(response.data.data);
        setForm(next);
        setSavedForm(next);
        void checkCurrentStorage(next, () => active);
      } catch (error) {
        if (active) toast.error(error instanceof Error ? error.message : "Failed to load storage settings");
      } finally {
        if (active) setLoading(false);
      }
    })();

    void fetchMigrationStatus();

    return () => {
      active = false;
    };
  }, []);

  const setField = <K extends keyof StorageSettings>(key: K, value: StorageSettings[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setTestedSignature("");
    setStatus("idle");
    setMessage("มีการแก้ไข storage config กรุณา Test ให้ผ่านก่อน Save");
  };

  const setStorageType = (type: StorageType) => {
    setForm((previous) => ({
      ...previous,
      enabled: true,
      type,
      port: type === "ftp" ? 21 : type === "sftp" ? 22 : previous.port,
      forcePathStyle: type === "s3" ? previous.forcePathStyle : false,
    }));
    setTestedSignature("");
    setStatus("idle");
    setMessage(type === "local"
      ? "Local Storage ไม่ต้องตั้งค่าเพิ่ม กด Save เพื่อเปลี่ยนมาใช้งาน"
      : "เลือก external storage แล้ว กรุณากรอกค่าที่จำเป็น แล้ว Test ให้ผ่านก่อน Save");
  };

  const testStorage = async () => {
    if (form.type !== "local" && form.type !== "smb" && form.type !== "sftp") {
      toast.error("Provider นี้ยังไม่พร้อมใช้งาน");
      return;
    }
    setTesting(true);
    if (!ready) {
      setStatus("error");
      setMessage("กรุณากรอกค่าที่จำเป็นให้ครบก่อนทดสอบ");
      toast.error("Storage settings ยังไม่ครบ");
      setTesting(false);
      return;
    }

    try {
      const response = await post<ActionResponse>("/system-setting/integrations/storage/test", {
        provider: form.type,
        smbHost: form.host,
        smbShareName: form.shareName,
        smbDomain: form.domain,
        smbUsername: form.username,
        smbPassword: form.password?.trim() || undefined,
        smbBasePath: form.basePath,
        sftpHost: form.host,
        sftpPort: form.port,
        sftpUsername: form.username,
        sftpPassword: form.password?.trim() || undefined,
        sftpBasePath: form.basePath,
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
      const nextMessage = error instanceof Error ? error.message : "Storage test failed";
      setStatus("error");
      setTestedSignature("");
      setMessage(nextMessage);
      toast.error(nextMessage);
    } finally {
      setTesting(false);
    }
  };

  const saveStorage = async () => {
    if (form.type !== "local" && form.type !== "smb" && form.type !== "sftp") {
      toast.error("Provider นี้ยังไม่พร้อมใช้งาน");
      return;
    }
    setSaving(true);
    try {
      const response = await put<StorageResponse>("/system-setting/integrations/storage", {
        provider: form.type,
        smbHost: form.host,
        smbShareName: form.shareName,
        smbDomain: form.domain,
        smbUsername: form.username,
        smbPassword: form.password?.trim() || undefined,
        smbBasePath: form.basePath,
        sftpHost: form.host,
        sftpPort: form.port,
        sftpUsername: form.username,
        sftpPassword: form.password?.trim() || undefined,
        sftpBasePath: form.basePath,
      });
      const next = mapStorageResponse(response.data.data);
      setForm(next);
      setSavedForm(next);
      setTestedSignature("");
      void checkCurrentStorage(next);
      toast.success("บันทึก storage settings แล้ว");
      if (response.data.migrationAvailable) {
        void fetchMigrationStatus();
        openMigrationModal();
      } else {
        setMigrationStatus(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save storage settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <IntegrationRow
        title="Storage"
        description={`Provider ปัจจุบัน: ${storageTypeLabels[savedForm.type]}`}
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
            <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">ทดสอบ connection ก่อน save และ migration ข้อมูลได้หลังเปลี่ยน provider</p>
          </div>
          <div className="flex gap-2">
              <button type="button" onClick={() => void testStorage()} disabled={testing || saving || loading} className={btnSec}>
              {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
              Test
            </button>
            {canUpdate && (
              <button type="button" onClick={() => void saveStorage()} disabled={saving || loading || !dirty || !canSave} className={btnPri}>
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            )}
            {canUpdate && migrationStatus?.available && !migrationStatus.completed && (
              <button type="button" onClick={openMigrationModal} className={btnPri}>
                <ArrowRightLeft className="h-4 w-4" />
                Migrate
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
              <option value="ftp" disabled>FTP (ยังไม่พร้อมใช้งาน)</option>
              <option value="s3" disabled>S3 Compatible (ยังไม่พร้อมใช้งาน)</option>
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
                    <TextField label="Domain (optional)" value={form.domain} onChange={(value) => setField("domain", value)} disabled={!canUpdate} placeholder="เว้นว่าง = ใช้ Host เช่น SARAN" />
                    <TextField label="Username" value={form.username} onChange={(value) => setField("username", value)} disabled={!canUpdate} />
                    <PasswordField label="Password" value={form.password} onChange={(value) => setField("password", value)} disabled={!canUpdate} placeholder={form.hasPassword ? "ใช้รหัสผ่านเดิม ถ้าไม่กรอก" : "••••••••"} />
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
            {dirty && !canSave && <p className="text-xs text-amber-600 dark:text-amber-400">ต้อง Test config ชุดนี้ให้ผ่านก่อน จึงจะบันทึกได้</p>}
        </>
        </div>
      </IntegrationRow>

      {showMigrationModal && migrationStatus?.from && migrationStatus?.to && (
        <StorageMigrationModal
          from={migrationStatus.from}
          to={migrationStatus.to}
          completed={migrationStatus.completed}
          onClose={closeMigrationModal}
        />
      )}
    </>
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
