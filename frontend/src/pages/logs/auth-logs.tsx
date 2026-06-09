import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Globe2,
  KeyRound,
  LogIn,
  LogOut,
  Monitor,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldX,
  UserPlus,
  XCircle,
} from "lucide-react";
import GuardedInput from "@/common/GuardedInput";
import SortableTableHeader from "@/common/SortableTableHeader";
import StatCard from "@/common/StatCard";
import Pagination from "@/common/Pagination";
import { useApi } from "@/hooks/useApi";
import { useRegional } from "@/contexts/RegionalContext";
import { useSession } from "@/contexts/SessionContext";
import { getSortByFromParams, getSortOrderFromParams, nextSortParams } from "@/utils/sortParams";

interface AuthLogRecord {
  id: number;
  createdAt: string;
  userId: number | null;
  username: string;
  authType: string;
  authStatus: string;
  failureReason: string | null;
  ipAddress: string | null;
  browser: string | null;
  os: string | null;
  deviceInfo: string | null;
  authSource: string | null;
  twoFactorUsed: boolean;
  rememberMe: boolean;
  sessionDuration: number | null;
  logoutTime: string | null;
}

interface AuthLogsResponse {
  success: boolean;
  data: {
    logs: AuthLogRecord[];
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
    };
  };
}

type AuthTypeFilter = "all" | "LOGIN" | "LOGOUT" | "REGISTER" | "PASSWORD_RESET";
type AuthStatusFilter = "all" | "SUCCESS" | "FAILED";
type AuthLogSortField = "createdAt" | "username" | "authType" | "authStatus" | "ipAddress" | "sessionDuration";

const AUTH_LOG_SORT_FIELDS = ["createdAt", "username", "authType", "authStatus", "ipAddress", "sessionDuration"] as const;

const inputClass =
  "rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:focus:ring-dark-primary";

const AUTH_TYPE_OPTIONS: { value: AuthTypeFilter; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "LOGIN", label: "Login" },
  { value: "LOGOUT", label: "Logout" },
  { value: "REGISTER", label: "Register" },
  { value: "PASSWORD_RESET", label: "Password Reset" },
];

const AUTH_STATUS_OPTIONS: { value: AuthStatusFilter; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "SUCCESS", label: "Success" },
  { value: "FAILED", label: "Failed" },
];

const authTypeIcon = (type: string) => {
  switch (type) {
    case "LOGIN": return <LogIn className="h-3.5 w-3.5" />;
    case "LOGOUT": return <LogOut className="h-3.5 w-3.5" />;
    case "REGISTER": return <UserPlus className="h-3.5 w-3.5" />;
    case "PASSWORD_RESET":
    case "PASSWORD_CHANGE": return <KeyRound className="h-3.5 w-3.5" />;
    default: return <ShieldAlert className="h-3.5 w-3.5" />;
  }
};

const authTypeClass = (type: string) => {
  switch (type) {
    case "LOGIN": return "bg-sky-500/10 text-sky-700 dark:text-sky-400";
    case "LOGOUT": return "bg-slate-500/10 text-slate-600 dark:text-slate-400";
    case "REGISTER": return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "PASSWORD_RESET":
    case "PASSWORD_CHANGE": return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    default: return "bg-light-text-muted/10 text-light-text-muted dark:text-dark-text-muted";
  }
};

const authTypeLabel = (type: string) => {
  switch (type) {
    case "PASSWORD_RESET": return "Pwd Reset";
    case "PASSWORD_CHANGE": return "Pwd Change";
    default: return type.charAt(0) + type.slice(1).toLowerCase();
  }
};

const authStatusClass = (status: string) => {
  switch (status) {
    case "SUCCESS": return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "FAILED": return "bg-red-500/10 text-red-600 dark:text-red-400";
    default: return "bg-light-text-muted/10 text-light-text-muted dark:text-dark-text-muted";
  }
};

const authStatusIcon = (status: string) => {
  switch (status) {
    case "SUCCESS": return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "FAILED": return <XCircle className="h-3.5 w-3.5" />;
    default: return <AlertCircle className="h-3.5 w-3.5" />;
  }
};

const formatDuration = (seconds: number | null) => {
  if (seconds === null) return null;
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
};

const getPositiveIntParam = (params: URLSearchParams, key: string, fallback: number) => {
  const value = Number(params.get(key));
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const getAuthTypeFromParams = (params: URLSearchParams): AuthTypeFilter => {
  const value = params.get("authType");
  return value === "LOGIN" || value === "LOGOUT" || value === "REGISTER" || value === "PASSWORD_RESET"
    ? value
    : "all";
};

const getAuthStatusFromParams = (params: URLSearchParams): AuthStatusFilter => {
  const value = params.get("authStatus");
  return value === "SUCCESS" || value === "FAILED" ? value : "all";
};

const AuthLogsPage = () => {
  const { api, get } = useApi();
  const { user } = useSession();
  const { formatDateTime } = useRegional();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const authType = getAuthTypeFromParams(searchParams);
  const authStatus = getAuthStatusFromParams(searchParams);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const page = getPositiveIntParam(searchParams, "page", 1);
  const pageSize = getPositiveIntParam(searchParams, "pageSize", 20);
  const sortBy = getSortByFromParams(searchParams, AUTH_LOG_SORT_FIELDS, "createdAt");
  const sortOrder = getSortOrderFromParams(searchParams);
  const isExportModalOpen = searchParams.get("modal") === "export-excel";

  const [logs, setLogs] = useState<AuthLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];
  const isSuperAdmin = roles.includes("SUPERADMIN");
  const hasPermission = (permission: string) => isSuperAdmin || permissions.includes(permission);
  const canRead = hasPermission("auth_logs.read");

  const prevFiltersRef = useRef({ search, authType, authStatus, from, to });

  const loadLogs = async () => {
    if (!canRead) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await get<AuthLogsResponse>("/logs/auth", {
        params: {
          search: search.trim() || undefined,
          authType,
          authStatus,
          startDate: from || undefined,
          endDate: to || undefined,
          page,
          pageSize,
          sortBy,
          sortOrder,
        },
      });
      const payload = response.data.data;
      setLogs(payload.logs ?? []);
      setTotalItems(payload.pagination.totalItems);
      setTotalPages(payload.pagination.totalPages);
      setStats(payload.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load auth logs");
      setLogs([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const prev = prevFiltersRef.current;
    const filtersChanged =
      prev.search !== search ||
      prev.authType !== authType ||
      prev.authStatus !== authStatus ||
      prev.from !== from ||
      prev.to !== to;
    if (filtersChanged && page !== 1) {
      prevFiltersRef.current = { search, authType, authStatus, from, to };
      setSearchParams((params) => {
        const next = new URLSearchParams(params);
        next.delete("page");
        return next;
      });
      return;
    }
    prevFiltersRef.current = { search, authType, authStatus, from, to };
    void loadLogs();
  }, [canRead, page, pageSize, search, authType, authStatus, from, to, sortBy, sortOrder]);

  const changeSort = (field: AuthLogSortField) => {
    setSearchParams((params) => nextSortParams(params, field, sortBy, sortOrder, "createdAt"));
  };

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

  const changeAuthType = (value: AuthTypeFilter) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      if (value !== "all") next.set("authType", value);
      else next.delete("authType");
      next.delete("page");
      return next;
    });
  };

  const changeAuthStatus = (value: AuthStatusFilter) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      if (value !== "all") next.set("authStatus", value);
      else next.delete("authStatus");
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
      const response = await api.get<Blob>("/logs/auth/export", {
        params: {
          startDate: from || undefined,
          endDate: to || undefined,
          search: search.trim() || undefined,
          authType,
          authStatus,
        },
        responseType: "blob",
      });

      const blob = response.data;
      const contentDisposition = response.headers["content-disposition"];
      const filenameMatch = typeof contentDisposition === "string"
        ? /filename="?([^"]+)"?/.exec(contentDisposition)
        : null;
      const filename = filenameMatch?.[1] ?? `auth-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
            <p className="mt-2 text-sm">คุณไม่มีสิทธิ์ดู Authentication Logs</p>
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
              <ShieldAlert className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                Logs
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">Authentication Logs</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                บันทึก Login, Logout, Register, Password Reset/Change และเหตุการณ์ด้านความปลอดภัย
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
              onClick={() => void loadLogs()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Total" value={stats.total} icon={<ShieldAlert className="h-5 w-5" />} />
        <StatCard label="Success" value={stats.success} tone="success" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Failed" value={stats.failed} tone="danger" icon={<XCircle className="h-5 w-5" />} />
      </div>

      <article className="rounded-lg border border-theme bg-light-background-card p-4 shadow-soft dark:bg-dark-background-card">
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
            <GuardedInput
              leadingIcon={<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-text-muted dark:text-dark-text-muted" />}
              className={`${inputClass} w-full pl-9`}
              placeholder="ค้นหา username, IP, browser, OS..."
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
            />
            <select
              className={inputClass}
              value={authType}
              onChange={(event) => changeAuthType(event.target.value as AuthTypeFilter)}
            >
              {AUTH_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              className={inputClass}
              value={authStatus}
              onChange={(event) => changeAuthStatus(event.target.value as AuthStatusFilter)}
            >
              {AUTH_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
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
            Loading auth logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="grid min-h-48 place-items-center text-sm text-light-text-muted dark:text-dark-text-muted">
            ไม่พบ auth log ตามตัวกรอง
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
              <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <SortableTableHeader field="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={changeSort}>Time</SortableTableHeader>
                  <SortableTableHeader field="authType" sortBy={sortBy} sortOrder={sortOrder} onSort={changeSort}>Type</SortableTableHeader>
                  <SortableTableHeader field="authStatus" sortBy={sortBy} sortOrder={sortOrder} onSort={changeSort}>Status</SortableTableHeader>
                  <SortableTableHeader field="username" sortBy={sortBy} sortOrder={sortOrder} onSort={changeSort}>User</SortableTableHeader>
                  <SortableTableHeader field="ipAddress" sortBy={sortBy} sortOrder={sortOrder} onSort={changeSort}>IP Address</SortableTableHeader>
                  <th className="px-4 py-3 font-semibold">Browser / OS</th>
                  <th className="px-4 py-3 font-semibold">2FA</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
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
                        {formatDateTime(log.createdAt)}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${authTypeClass(log.authType)}`}>
                        {authTypeIcon(log.authType)}
                        {authTypeLabel(log.authType)}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div>
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${authStatusClass(log.authStatus)}`}>
                          {authStatusIcon(log.authStatus)}
                          {log.authStatus.charAt(0) + log.authStatus.slice(1).toLowerCase()}
                        </span>
                        {log.failureReason && (
                          <p className="mt-1 max-w-40 truncate text-xs text-red-500 dark:text-red-400" title={log.failureReason}>
                            {log.failureReason}
                          </p>
                        )}
                        {log.sessionDuration !== null && log.authType === "LOGOUT" && (
                          <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">
                            {formatDuration(log.sessionDuration)}
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="min-w-28">
                        <p className="font-medium text-light-text dark:text-dark-text">{log.username}</p>
                        {log.userId !== null && (
                          <p className="text-xs text-light-text-muted dark:text-dark-text-muted">#{log.userId}</p>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <Globe2 className="h-3.5 w-3.5" />
                        {log.ipAddress || "-"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {log.browser || log.os ? (
                        <div>
                          {log.browser && (
                            <p className="font-medium text-light-text dark:text-dark-text">{log.browser}</p>
                          )}
                          {log.os && (
                            <p className="flex items-center gap-1 text-xs text-light-text-muted dark:text-dark-text-muted">
                              <Monitor className="h-3 w-3" />
                              {log.os}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-light-text-muted dark:text-dark-text-muted">-</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {log.twoFactorUsed ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Yes
                        </span>
                      ) : (
                        <span className="text-xs text-light-text-muted dark:text-dark-text-muted">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs text-light-text-muted dark:text-dark-text-muted">
                      {log.authSource || "-"}
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
                  <h2 className="text-base font-semibold text-light-text dark:text-dark-text">Export Auth Logs</h2>
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
                  <dt className="font-semibold text-light-text dark:text-dark-text">Type</dt>
                  <dd className="text-light-text-muted dark:text-dark-text-muted">{authType === "all" ? "ทั้งหมด" : authType}</dd>
                  <dt className="font-semibold text-light-text dark:text-dark-text">Status</dt>
                  <dd className="text-light-text-muted dark:text-dark-text-muted">{authStatus === "all" ? "ทั้งหมด" : authStatus}</dd>
                  <dt className="font-semibold text-light-text dark:text-dark-text">จาก</dt>
                  <dd className="text-light-text-muted dark:text-dark-text-muted">{from || "ทั้งหมด"}</dd>
                  <dt className="font-semibold text-light-text dark:text-dark-text">ถึง</dt>
                  <dd className="text-light-text-muted dark:text-dark-text-muted">{to || "ทั้งหมด"}</dd>
                </dl>
              </div>

              <div className="rounded-lg border border-theme bg-light-primary/5 p-3 text-xs text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                ไฟล์มี 3 sheet: Auth Logs, Summary และ Breakdown ตาม Type
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

export default AuthLogsPage;
