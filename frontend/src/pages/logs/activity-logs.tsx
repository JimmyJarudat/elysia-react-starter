import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Globe2,
  RefreshCw,
  Search,
  ShieldX,
  Upload,
  UserRound,
  XCircle,
  Zap,
} from "lucide-react";
import GuardedInput from "@/common/GuardedInput";
import StatCard from "@/common/StatCard";
import Pagination from "@/common/Pagination";
import { useApi } from "@/hooks/useApi";
import { useRegional } from "@/contexts/RegionalContext";
import { useSession } from "@/contexts/SessionContext";

interface ActivityLogRecord {
  id: string;
  timestamp: string;
  userId: number | null;
  username: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  description: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  status: string;
  metadata: string | null;
}

interface ActivityLogsResponse {
  success: boolean;
  data: {
    logs: ActivityLogRecord[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
    stats: {
      total: number;
      success: number;
      failed: number;
      export: number;
    };
  };
}

interface ActivityResourceOption {
  resourceType: string;
  count: number;
}

interface ActivityResourcesResponse {
  success: boolean;
  data: ActivityResourceOption[];
}

type StatusFilter = "all" | "success" | "failed";

const ACTION_OPTIONS = [
  "all",
  "CREATE",
  "UPDATE",
  "DELETE",
  "VIEW",
  "EXPORT",
  "IMPORT",
  "ENABLE",
  "DISABLE",
  "APPROVE",
  "REJECT",
  "RESTORE",
  "LOCK",
  "UNLOCK",
  "REVOKE",
  "CLONE",
  "RESET_PASSWORD",
  "CHANGE_PASSWORD",
  "FORCE_LOGOUT",
  "IMPERSONATE",
] as const;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
];

const inputClass =
  "rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:focus:ring-dark-primary";

const getPositiveIntParam = (params: URLSearchParams, key: string, fallback: number) => {
  const value = Number(params.get(key));
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const getActionFromParams = (params: URLSearchParams) => {
  const value = params.get("action");
  return ACTION_OPTIONS.includes(value as (typeof ACTION_OPTIONS)[number]) ? value ?? "all" : "all";
};

const getStatusFromParams = (params: URLSearchParams): StatusFilter => {
  const value = params.get("status");
  return value === "success" || value === "failed" ? value : "all";
};

const actionClass = (action: string) => {
  switch (action) {
    case "CREATE":
    case "ENABLE":
    case "APPROVE":
    case "RESTORE":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "UPDATE":
    case "RESET_PASSWORD":
    case "CHANGE_PASSWORD":
    case "CLONE":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    case "DELETE":
    case "DISABLE":
    case "REJECT":
    case "LOCK":
    case "REVOKE":
    case "FORCE_LOGOUT":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    case "EXPORT":
    case "IMPORT":
      return "bg-violet-500/10 text-violet-700 dark:text-violet-400";
    default:
      return "bg-light-text-muted/10 text-light-text-muted dark:text-dark-text-muted";
  }
};

const statusClass = (status: string) => (
  status === "failed"
    ? "bg-red-500/10 text-red-600 dark:text-red-400"
    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
);

const actionLabel = (action: string) => action
  .split("_")
  .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
  .join(" ");

const truncate = (value: string | null, length = 80) => {
  if (!value) return "";
  return value.length > length ? `${value.slice(0, length)}...` : value;
};

const ActivityLogsPage = () => {
  const { api, get } = useApi();
  const { user } = useSession();
  const { formatDateTime } = useRegional();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const action = getActionFromParams(searchParams);
  const resourceType = searchParams.get("resourceType") ?? "";
  const status = getStatusFromParams(searchParams);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const page = getPositiveIntParam(searchParams, "page", 1);
  const pageSize = getPositiveIntParam(searchParams, "pageSize", 20);
  const isExportModalOpen = searchParams.get("modal") === "export-excel";

  const [logs, setLogs] = useState<ActivityLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, export: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [resourceOptions, setResourceOptions] = useState<ActivityResourceOption[]>([]);
  const [isResourceLoading, setIsResourceLoading] = useState(true);

  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];
  const isSuperAdmin = roles.includes("SUPERADMIN");
  const hasPermission = (permission: string) => isSuperAdmin || permissions.includes(permission);
  const canRead = hasPermission("activity_logs.read");

  const prevFiltersRef = useRef({ search, action, resourceType, status, from, to });

  const loadResourceTypes = async () => {
    if (!canRead) {
      setIsResourceLoading(false);
      return;
    }

    setIsResourceLoading(true);
    try {
      const response = await get<ActivityResourcesResponse>("/logs/activity/resources");
      setResourceOptions(response.data.data ?? []);
    } catch {
      setResourceOptions([]);
    } finally {
      setIsResourceLoading(false);
    }
  };

  const loadLogs = async () => {
    if (!canRead) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await get<ActivityLogsResponse>("/logs/activity", {
        params: {
          search: search.trim() || undefined,
          action,
          resourceType: resourceType.trim() || undefined,
          status,
          startDate: from || undefined,
          endDate: to || undefined,
          page,
          pageSize,
        },
      });
      const payload = response.data.data;
      setLogs(payload.logs ?? []);
      setTotalItems(payload.pagination.totalItems);
      setTotalPages(payload.pagination.totalPages);
      setStats(payload.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load activity logs");
      setLogs([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadResourceTypes();
  }, [canRead]);

  useEffect(() => {
    const prev = prevFiltersRef.current;
    const filtersChanged =
      prev.search !== search ||
      prev.action !== action ||
      prev.resourceType !== resourceType ||
      prev.status !== status ||
      prev.from !== from ||
      prev.to !== to;
    if (filtersChanged && page !== 1) {
      prevFiltersRef.current = { search, action, resourceType, status, from, to };
      setSearchParams((params) => {
        const next = new URLSearchParams(params);
        next.delete("page");
        return next;
      });
      return;
    }
    prevFiltersRef.current = { search, action, resourceType, status, from, to };
    void loadLogs();
  }, [canRead, page, pageSize, search, action, resourceType, status, from, to]);

  const changePage = (next: number) => {
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      if (next > 1) nextParams.set("page", String(next));
      else nextParams.delete("page");
      return nextParams;
    });
  };

  const changePageSize = (next: number) => {
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      if (next !== 20) nextParams.set("pageSize", String(next));
      else nextParams.delete("pageSize");
      nextParams.delete("page");
      return nextParams;
    });
  };

  const changeSearch = (value: string) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      if (value.trim()) next.set("search", value.trim());
      else next.delete("search");
      next.delete("page");
      return next;
    });
  };

  const changeAction = (value: string) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      if (value !== "all") next.set("action", value);
      else next.delete("action");
      next.delete("page");
      return next;
    });
  };

  const changeResourceType = (value: string) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      if (value.trim()) next.set("resourceType", value.trim());
      else next.delete("resourceType");
      next.delete("page");
      return next;
    });
  };

  const changeStatus = (value: StatusFilter) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      if (value !== "all") next.set("status", value);
      else next.delete("status");
      next.delete("page");
      return next;
    });
  };

  const changeFrom = (value: string) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      if (value) next.set("from", value);
      else next.delete("from");
      next.delete("page");
      return next;
    });
  };

  const changeTo = (value: string) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      if (value) next.set("to", value);
      else next.delete("to");
      next.delete("page");
      return next;
    });
  };

  const openExportModal = () => {
    setExportError(null);
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.set("modal", "export-excel");
      return next;
    });
  };

  const closeExportModal = () => {
    if (isExporting) return;
    setExportError(null);
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.delete("modal");
      return next;
    });
  };

  const downloadExport = async () => {
    if (from && to && from > to) {
      setExportError("วันเริ่มต้นต้องไม่เกินวันสิ้นสุด");
      return;
    }

    setIsExporting(true);
    setExportError(null);
    try {
      const response = await api.get<Blob>("/logs/activity/export", {
        params: {
          startDate: from || undefined,
          endDate: to || undefined,
          search: search.trim() || undefined,
          action,
          resourceType: resourceType.trim() || undefined,
          status,
        },
        responseType: "blob",
      });

      const blob = response.data;
      const contentDisposition = response.headers["content-disposition"];
      const filenameMatch = typeof contentDisposition === "string"
        ? /filename="?([^"]+)"?/.exec(contentDisposition)
        : null;
      const filename = filenameMatch?.[1] ?? `activity-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      closeExportModal();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "ไม่สามารถ export Excel ได้");
    } finally {
      setIsExporting(false);
    }
  };

  const startIndex = (page - 1) * pageSize;

  if (!canRead) {
    return (
      <section className="grid gap-5">
        <article className="grid min-h-48 place-items-center rounded-lg border border-theme bg-light-background-card p-6 text-center text-light-text-muted shadow-soft dark:bg-dark-background-card dark:text-dark-text-muted">
          <div>
            <ShieldX className="mx-auto h-8 w-8 opacity-30" />
            <p className="mt-2 text-sm">คุณไม่มีสิทธิ์ดู Activity Logs</p>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-xl border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-light-primary text-white shadow-sm dark:bg-dark-primary dark:text-dark-background">
              <Activity className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                Logs
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">Activity Logs</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                บันทึกกิจกรรมที่ผู้ใช้งานดำเนินการ เช่น create, update, delete, export และ action สำคัญของระบบ
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
              type="button"
              onClick={openExportModal}
            >
              <Download className="h-4 w-4" />
              Export Excel
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
              type="button"
              onClick={() => {
                void loadLogs();
                void loadResourceTypes();
              }}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={<Activity className="h-5 w-5" />} />
        <StatCard label="Success" value={stats.success} tone="success" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Failed" value={stats.failed} tone="danger" icon={<XCircle className="h-5 w-5" />} />
        <StatCard label="Export" value={stats.export} tone="primary" icon={<Upload className="h-5 w-5" />} />
      </div>

      <article className="rounded-lg border border-theme bg-light-background-card p-4 shadow-soft dark:bg-dark-background-card">
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
            <GuardedInput
              leadingIcon={<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-text-muted dark:text-dark-text-muted" />}
              className={`${inputClass} w-full pl-9`}
              placeholder="ค้นหา username, action, resource, description, IP..."
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
            />
            <select
              className={inputClass}
              value={action}
              onChange={(event) => changeAction(event.target.value)}
            >
              {ACTION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All Actions" : actionLabel(option)}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={status}
              onChange={(event) => changeStatus(event.target.value as StatusFilter)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              className={`${inputClass} w-full`}
              value={resourceType}
              onChange={(event) => changeResourceType(event.target.value)}
              disabled={isResourceLoading}
            >
              <option value="">{isResourceLoading ? "Loading resources..." : "All Resources"}</option>
              {resourceType && !resourceOptions.some((option) => option.resourceType === resourceType) && (
                <option value={resourceType}>{resourceType}</option>
              )}
              {resourceOptions.map((option) => (
                <option key={option.resourceType} value={option.resourceType}>
                  {option.resourceType} ({option.count})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">ช่วงวันที่:</span>
            <input
              className={`${inputClass} w-40`}
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => changeFrom(event.target.value)}
            />
            <span className="text-xs text-light-text-muted dark:text-dark-text-muted">ถึง</span>
            <input
              className={`${inputClass} w-40`}
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => changeTo(event.target.value)}
            />
            {(from || to) && (
              <button
                type="button"
                className="text-xs text-light-text-muted underline hover:text-light-primary dark:text-dark-text-muted dark:hover:text-dark-primary"
                onClick={() => {
                  setSearchParams((params) => {
                    const next = new URLSearchParams(params);
                    next.delete("from");
                    next.delete("to");
                    next.delete("page");
                    return next;
                  });
                }}
              >
                ล้าง
              </button>
            )}
          </div>
        </div>
      </article>

      <article className="overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-soft dark:bg-dark-background-card">
        {error && (
          <div className="flex items-center gap-3 p-5 text-sm text-red-600 dark:text-red-300">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid min-h-48 place-items-center text-light-text-muted dark:text-dark-text-muted">
            Loading activity logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="grid min-h-48 place-items-center text-sm text-light-text-muted dark:text-dark-text-muted">
            ไม่พบ activity log ตามตัวกรอง
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
              <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                <tr>
                  {["#", "Time", "Action", "Status", "Resource", "User", "Description", "IP Address", "Metadata"].map((header) => (
                    <th key={header} className="px-4 py-3 font-semibold">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                {logs.map((log, index) => (
                  <tr key={log.id} className="transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10">
                    <td className="w-14 px-4 py-3 font-medium text-light-text-muted dark:text-dark-text-muted">
                      {startIndex + index + 1}
                    </td>

                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                      <span className="inline-flex min-w-40 items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDateTime(log.timestamp)}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${actionClass(log.action)}`}>
                        <Zap className="h-3.5 w-3.5" />
                        {actionLabel(log.action)}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${statusClass(log.status)}`}>
                        {log.status}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="min-w-36">
                        <p className="font-mono text-xs font-semibold text-light-text dark:text-dark-text">{log.resourceType}</p>
                        <p className="text-xs text-light-text-muted dark:text-dark-text-muted">{log.resourceId || "-"}</p>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="min-w-28">
                        <p className="inline-flex items-center gap-1.5 font-medium text-light-text dark:text-dark-text">
                          <UserRound className="h-3.5 w-3.5 text-light-text-muted dark:text-dark-text-muted" />
                          {log.username || "-"}
                        </p>
                        {log.userId !== null && (
                          <p className="text-xs text-light-text-muted dark:text-dark-text-muted">#{log.userId}</p>
                        )}
                      </div>
                    </td>

                    <td className="max-w-72 px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                      <span className="block truncate" title={log.description ?? undefined}>
                        {log.description || "-"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <Globe2 className="h-3.5 w-3.5" />
                        {log.ipAddress || "-"}
                      </span>
                    </td>

                    <td className="max-w-64 px-4 py-3">
                      {log.metadata ? (
                        <code className="block truncate rounded bg-light-primary/10 px-2 py-1 text-xs text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary" title={log.metadata}>
                          {truncate(log.metadata, 90)}
                        </code>
                      ) : (
                        <span className="text-light-text-muted dark:text-dark-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {totalItems > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={changePage}
          onPageSizeChange={changePageSize}
        />
      )}

      {isExportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => event.target === event.currentTarget && closeExportModal()}
        >
          <div className="w-full max-w-md rounded-lg border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">
            <div className="flex items-center justify-between border-b border-theme px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-light-text dark:text-dark-text">Export Activity Logs</h2>
                  <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                    Export ตาม filter ที่ตั้งไว้ตอนนี้
                  </p>
                </div>
              </div>
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary disabled:opacity-50 dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
                type="button"
                onClick={closeExportModal}
                disabled={isExporting}
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 p-5">
              <div className="rounded-lg border border-theme bg-light-background p-4 text-sm dark:bg-dark-background">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                  Filter ที่จะ export
                </p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="font-semibold text-light-text dark:text-dark-text">Search</dt>
                  <dd className="text-light-text-muted dark:text-dark-text-muted">{search || "—"}</dd>
                  <dt className="font-semibold text-light-text dark:text-dark-text">Action</dt>
                  <dd className="text-light-text-muted dark:text-dark-text-muted">{action === "all" ? "ทั้งหมด" : action}</dd>
                  <dt className="font-semibold text-light-text dark:text-dark-text">Status</dt>
                  <dd className="text-light-text-muted dark:text-dark-text-muted">{status === "all" ? "ทั้งหมด" : status}</dd>
                  <dt className="font-semibold text-light-text dark:text-dark-text">Resource</dt>
                  <dd className="text-light-text-muted dark:text-dark-text-muted">{resourceType || "ทั้งหมด"}</dd>
                  <dt className="font-semibold text-light-text dark:text-dark-text">จาก</dt>
                  <dd className="text-light-text-muted dark:text-dark-text-muted">{from || "ทั้งหมด"}</dd>
                  <dt className="font-semibold text-light-text dark:text-dark-text">ถึง</dt>
                  <dd className="text-light-text-muted dark:text-dark-text-muted">{to || "ทั้งหมด"}</dd>
                </dl>
              </div>

              <div className="rounded-lg border border-theme bg-light-primary/5 p-3 text-xs text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                ไฟล์มี 4 sheet: Summary, Activity Logs, By Action และ By Resource
              </div>

              {exportError && (
                <div className="flex items-center gap-2 rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {exportError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-theme px-5 py-4">
              <button
                className="rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 disabled:opacity-60 dark:text-dark-text dark:hover:bg-dark-primary/10"
                type="button"
                onClick={closeExportModal}
                disabled={isExporting}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
                type="button"
                onClick={() => void downloadExport()}
                disabled={isExporting}
              >
                {isExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isExporting ? "Exporting..." : "Download Excel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ActivityLogsPage;
