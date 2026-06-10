import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, Loader2, XCircle } from "lucide-react";
import { toast } from "react-toastify";
import { apiConfig } from "@/config";
import { useApi } from "@/hooks/useApi";
import { btnDgr, btnPri, btnSec } from "../constants";
import type {
  StorageMigrationCleanupResponse,
  StorageMigrationScanResponse,
} from "../types";

type StorageMigrationModalProps = {
  from: "local" | "smb";
  to: "local" | "smb";
  completed?: boolean;
  onClose: () => void;
};

type Phase = "scanning" | "scan-error" | "ready" | "migrating" | "success" | "error" | "cleanup-done";

const providerLabel = (provider: "local" | "smb") => (provider === "smb" ? "SMB / Network Share" : "Local Storage");

const formatBytes = (bytes: number) => {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
};

const StorageMigrationModal = ({ from, to, completed = false, onClose }: StorageMigrationModalProps) => {
  const { get, post } = useApi();
  const getRef = useRef(get);
  const postRef = useRef(post);
  const [phase, setPhase] = useState<Phase>(() => completed ? "success" : "scanning");
  const [scan, setScan] = useState<StorageMigrationScanResponse["data"] | null>(null);
  const [scanError, setScanError] = useState("");
  const [total, setTotal] = useState(0);
  const [totalSize, setTotalSize] = useState(0);
  const [migrated, setMigrated] = useState(0);
  const [migratedSize, setMigratedSize] = useState(0);
  const [currentPath, setCurrentPath] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deletedCount, setDeletedCount] = useState(0);
  const sourceRef = useRef<EventSource | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    getRef.current = get;
    postRef.current = post;
  }, [get, post]);

  useEffect(() => {
    if (completed) return;

    let active = true;
    (async () => {
      try {
        const response = await getRef.current<StorageMigrationScanResponse>("/system-setting/storage/migration/scan");
        if (!active) return;
        if (!response.data.success || !response.data.data) {
          setScanError(response.data.message || "ไม่สามารถสแกนข้อมูลต้นทางได้");
          setPhase("scan-error");
          return;
        }
        setScan(response.data.data);
        setTotal(response.data.data.totalFiles);
        setTotalSize(response.data.data.totalSize);
        setPhase("ready");
      } catch (error) {
        if (!active) return;
        setScanError(error instanceof Error ? error.message : "ไม่สามารถสแกนข้อมูลต้นทางได้");
        setPhase("scan-error");
      }
    })();
    return () => {
      active = false;
    };
  }, [completed]);

  useEffect(() => {
    if (phase !== "migrating") return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  useEffect(() => () => sourceRef.current?.close(), []);

  const startMigration = () => {
    setPhase("migrating");
    setMigrated(0);
    setMigratedSize(0);
    setCurrentPath("");
    doneRef.current = false;

    const url = `${apiConfig.backendBaseUrl}/system-setting/storage/migration/stream`;
    const source = new EventSource(url, { withCredentials: true });
    sourceRef.current = source;

    source.addEventListener("start", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { total: number; totalSize: number };
      setTotal(data.total);
      setTotalSize(data.totalSize);
    });

    source.addEventListener("progress", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as {
        path: string;
        migrated: number;
        total: number;
        migratedSize: number;
        totalSize: number;
      };
      setMigrated(data.migrated);
      setMigratedSize(data.migratedSize);
      setCurrentPath(data.path);
      setTotal(data.total);
      setTotalSize(data.totalSize);
    });

    source.addEventListener("file-error", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { path: string; message: string };
      setErrorMessage(`${data.path}: ${data.message}`);
    });

    source.addEventListener("done", (event) => {
      doneRef.current = true;
      const data = JSON.parse((event as MessageEvent).data) as {
        success: boolean;
        migrated: number;
        total: number;
        message?: string;
        path?: string;
      };
      setMigrated(data.migrated);
      if (data.success) {
        setPhase("success");
      } else {
        setErrorMessage(data.message ? `${data.path ? `${data.path}: ` : ""}${data.message}` : "Migration failed");
        setPhase("error");
      }
      source.close();
    });

    source.addEventListener("stream-error", (event) => {
      doneRef.current = true;
      const data = JSON.parse((event as MessageEvent).data) as { message: string };
      setErrorMessage(data.message);
      setPhase("error");
      source.close();
    });

    source.onerror = () => {
      if (!doneRef.current) {
        doneRef.current = true;
        setErrorMessage("การเชื่อมต่อ SSE ขาดหาย กรุณาตรวจสอบสถานะ migration อีกครั้ง");
        setPhase("error");
      }
      source.close();
    };
  };

  const finishCleanup = async (deleteSource: boolean) => {
    setDeleting(true);
    try {
      const response = await postRef.current<StorageMigrationCleanupResponse>("/system-setting/storage/migration/cleanup", { deleteSource });
      if (response.data.success) {
        setDeletedCount(response.data.data?.deleted ?? 0);
        setPhase("cleanup-done");
        toast.success(deleteSource ? "ลบข้อมูลต้นทางเรียบร้อยแล้ว" : "เก็บข้อมูลต้นทางไว้ตามเดิม");
      } else {
        toast.error(response.data.message || "Cleanup failed");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cleanup failed");
    } finally {
      setDeleting(false);
    }
  };

  const progressPercent = total > 0 ? Math.round((migrated / total) * 100) : phase === "success" ? 100 : 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">
        <div className="flex items-center gap-4 p-6 pb-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-light-text dark:text-dark-text">Storage Migration</h3>
            <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">
              ย้ายข้อมูลจาก {providerLabel(from)} ไปยัง {providerLabel(to)}
            </p>
          </div>
        </div>

        <div className="px-6 pb-6">
          {phase === "scanning" && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-theme bg-light-background px-4 py-8 text-sm text-light-text-muted dark:bg-dark-background dark:text-dark-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> กำลังสแกนข้อมูลต้นทาง...
            </div>
          )}

          {phase === "scan-error" && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{scanError}</span>
              </div>
              <button type="button" onClick={onClose} className={`${btnSec} w-full justify-center`}>
                ปิด
              </button>
            </div>
          )}

          {phase === "ready" && scan && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-lg border border-theme">
                <table className="w-full text-sm">
                  <thead className="bg-light-background text-xs uppercase text-light-text-muted dark:bg-dark-background dark:text-dark-text-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">Path</th>
                      <th className="px-3 py-2 text-right">ไฟล์</th>
                      <th className="px-3 py-2 text-right">ขนาด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme">
                    {scan.paths.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-3 text-center text-light-text-muted dark:text-dark-text-muted">
                          ไม่มีไฟล์
                        </td>
                      </tr>
                    )}
                    {scan.paths.map((p) => (
                      <tr key={p.path}>
                        <td className="px-3 py-2 font-mono text-xs text-light-text dark:text-dark-text">{p.path}</td>
                        <td className="px-3 py-2 text-right text-light-text dark:text-dark-text">{p.fileCount}</td>
                        <td className="px-3 py-2 text-right text-light-text dark:text-dark-text">{formatBytes(p.totalSize)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-theme bg-light-background font-semibold dark:bg-dark-background">
                    <tr>
                      <td className="px-3 py-2 text-light-text dark:text-dark-text">รวม</td>
                      <td className="px-3 py-2 text-right text-light-text dark:text-dark-text">{scan.totalFiles}</td>
                      <td className="px-3 py-2 text-right text-light-text dark:text-dark-text">{formatBytes(scan.totalSize)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={onClose} className={`${btnSec} flex-1 justify-center`}>
                  ยกเลิก
                </button>
                {scan.totalFiles > 0 && (
                  <button type="button" onClick={startMigration} className={`${btnPri} flex-1 justify-center`}>
                    เริ่ม Migration
                  </button>
                )}
              </div>
            </div>
          )}

          {(phase === "migrating" || phase === "success" || phase === "error") && (
            <div className="space-y-4">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-light-background dark:bg-dark-background">
                <div
                  className={`h-full rounded-full transition-all ${phase === "error" ? "bg-red-500" : "bg-light-primary dark:bg-dark-primary"}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-light-text-muted dark:text-dark-text-muted">
                <span>{migrated} / {total} ไฟล์</span>
                <span>{formatBytes(migratedSize)} / {formatBytes(totalSize)}</span>
              </div>

              {phase === "migrating" && (
                <>
                  <div className="flex items-center gap-2 rounded-lg border border-theme bg-light-background px-3 py-2 text-xs text-light-text-muted dark:bg-dark-background dark:text-dark-text-muted">
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    <span className="truncate font-mono">{currentPath || "กำลังเตรียมไฟล์..."}</span>
                  </div>
                  <p className="text-center text-xs text-light-text-muted dark:text-dark-text-muted">
                    กรุณาอย่าปิดหรือรีเฟรชหน้านี้ จนกว่า migration จะเสร็จสิ้น
                  </p>
                </>
              )}

              {phase === "success" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{completed ? "Migration สำเร็จแล้ว" : `Migration สำเร็จ ${migrated} ไฟล์`}</span>
                  </div>
                  <p className="text-sm text-light-text dark:text-dark-text">ต้องการลบข้อมูลเดิมที่ {providerLabel(from)} หรือไม่?</p>
                  <div className="flex gap-3">
                    <button type="button" disabled={deleting} onClick={() => void finishCleanup(false)} className={`${btnSec} flex-1 justify-center`}>
                      {deleting && <Loader2 className="h-4 w-4 animate-spin" />} เก็บไว้
                    </button>
                    <button type="button" disabled={deleting} onClick={() => void finishCleanup(true)} className={`${btnDgr} flex-1 justify-center`}>
                      {deleting && <Loader2 className="h-4 w-4 animate-spin" />} ลบข้อมูลเดิม
                    </button>
                  </div>
                </div>
              )}

              {phase === "error" && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{errorMessage || "Migration ล้มเหลว"}</span>
                  </div>
                  <button type="button" onClick={onClose} className={`${btnSec} w-full justify-center`}>
                    ปิด
                  </button>
                </div>
              )}
            </div>
          )}

          {phase === "cleanup-done" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Migration เสร็จสมบูรณ์ ({migrated} ไฟล์)
                  {deletedCount > 0 ? ` และลบข้อมูลเดิม ${deletedCount} ไฟล์แล้ว` : ""}
                </span>
              </div>
              <button type="button" onClick={onClose} className={`${btnPri} w-full justify-center`}>
                เสร็จสิ้น
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StorageMigrationModal;
