import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  FileSpreadsheet,
  Globe2,
  RefreshCw,
  Search,
  ShieldX,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import GuardedInput from "@/common/GuardedInput";
import StatCard from "@/common/StatCard";
import Pagination from "@/common/Pagination";
import { useApi } from "@/hooks/useApi";
import { useRegional } from "@/contexts/RegionalContext";
import { useSession } from "@/contexts/SessionContext";

interface ErrorLogRecord {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  source: string | null;
  code: string | null;
  userId: number | null;
  username: string | null;
  requestPath: string | null;
  requestMethod: string | null;
  ipAddress: string | null;
  resolved: boolean;
  resolvedAt: string | null;
}

interface ErrorLogsResponse {
  success: boolean;
  data: {
    logs: ErrorLogRecord[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
    stats: {
      total: number;
      error: number;
      warn: number;
      fatal: number;
      unresolved: number;
    };
  };
}

type LevelFilter = "all" | "error" | "warn" | "fatal";
type ResolvedFilter = "all" | "resolved" | "unresolved";

const inputClass =
  "rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:focus:ring-dark-primary";

const LEVEL_OPTIONS: { value: LevelFilter; label: string }[] = [
  { value: "all", label: "All Levels" },
  { value: "error", label: "Error" },
  { value: "warn", label: "Warn" },
  { value: "fatal", label: "Fatal" },
];

const RESOLVED_OPTIONS: { value: ResolvedFilter; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "unresolved", label: "Unresolved" },
  { value: "resolved", label: "Resolved" },
];

const levelClass = (level: string) => {
  switch (level) {
    case "error": return "bg-red-500/10 text-red-600 dark:text-red-400";
    case "warn":  return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    case "fatal": return "bg-purple-500/10 text-purple-700 dark:text-purple-400";
    default:      return "bg-light-text-muted/10 text-light-text-muted dark:text-dark-text-muted";
  }
};

const levelIcon = (level: string) => {
  switch (level) {
    case "error": return <AlertCircle className="h-3.5 w-3.5" />;
    case "warn":  return <AlertTriangle className="h-3.5 w-3.5" />;
    case "fatal": return <TriangleAlert className="h-3.5 w-3.5" />;
    default:      return <Bug className="h-3.5 w-3.5" />;
  }
};

const getPositiveIntParam = (params: URLSearchParams, key: string, fallback: number) => {
  const value = Number(params.get(key));
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const getLevelFromParams = (params: URLSearchParams): LevelFilter => {
  const value = params.get("level");
  return value === "error" || value === "warn" || value === "fatal" ? value : "all";
};

const getResolvedFromParams = (params: URLSearchParams): ResolvedFilter => {
  const value = params.get("resolved");
  return value === "resolved" || value === "unresolved" ? value : "all";
};

const ErrorLogsPage = () => {
  const { api, get } = useApi();
  const { user } = useSession();
  const { formatDateTime } = useRegional();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const level = getLevelFromParams(searchParams);
  const resolved = getResolvedFromParams(searchParams);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const page = getPositiveIntParam(searchParams, "page", 1);
  const pageSize = getPositiveIntParam(searchParams, "pageSize", 20);
  const isExportModalOpen = searchParams.get("modal") === "export-excel";

  const [logs, setLogs] = useState<ErrorLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, error: 0, warn: 0, fatal: 0, unresolved: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];
  const isSuperAdmin = roles.includes("SUPERADMIN");
  const hasPermission = (permission: string) => isSuperAdmin || permissions.includes(permission);
  const canRead = hasPermission("error_logs.read");

  const prevFiltersRef = useRef({ search, level, resolved, from, to });

  const loadLogs = async () => {
    if (!canRead) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await get<ErrorLogsResponse>("/logs/error", {
        params: {
          search: search.trim() || undefined,
          level,
          resolved,
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
      setError(err instanceof Error ? err.message : "Unable to load error logs");
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
      prev.level !== level ||
      prev.resolved !== resolved ||
      prev.from !== from ||
      prev.to !== to;
    if (filtersChanged && page !== 1) {
      prevFiltersRef.current = { search, level, resolved, from, to };
      setSearchParams((params) => {
        const next = new URLSearchParams(params);
        next.delete("page");
        return next;
      });
      return;
    }
    prevFiltersRef.current = { search, level, resolved, from, to };
    void loadLogs();
  }, [canRead, page, pageSize, search, level, resolved, from, to]);

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

  const changeLevel = (value: LevelFilter) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      if (value !== "all") next.set("level", value);
      else next.delete("level");
      next.delete("page");
      return next;
    });
  };

  const changeResolved = (value: ResolvedFilter) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      if (value !== "all") next.set("resolved", value);
      else next.delete("resolved");
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

  const toggleResolve = async (log: ErrorLogRecord) => {
    setResolvingId(log.id);
    try {
      const response = await api.patch<{ success: boolean; data: { id: string; resolved: boolean; resolvedAt: string | null } }>(
        `/logs/error/${log.id}/resolve`,
        { resolved: !log.resolved },
      );
      const updated = response.data.data;
      setLogs((prev) => prev.map((l) =>
        l.id === updated.id ? { ...l, resolved: updated.resolved, resolvedAt: updated.resolvedAt } : l,
      ));
    } catch {
      // silently fail — log stays as-is
    } finally {
      setResolvingId(null);
    }
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
      const response = await api.get<Blob>("/logs/error/export", {
        params: {
          startDate: from || undefined,
          endDate: to || undefined,
          search: search.trim() || undefined,
          level,
          resolved,
        },
        responseType: "blob",
      });

      const blob = response.data;
      const contentDisposition = response.headers["content-disposition"];
      const filenameMatch = typeof contentDisposition === "string"
        ? /filename="?([^"]+)"?/.exec(contentDisposition)
        : null;
      const filename = filenameMatch?.[1] ?? `error-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
            <p className="mt-2 text-sm">คุณไม่มีสิทธิ์ดู Error Logs</p>
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
              <Bug className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                Logs
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">Error Logs</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                บันทึก Exception, Validation Error, Database Error และข้อผิดพลาดภายในระบบ
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

      <div className="grid gap-3 md:grid-cols-5">
        <StatCard label="Total" value={stats.total} icon={<Bug className="h-5 w-5" />} />
        <StatCard label="Error" value={stats.error} tone="danger" icon={<AlertCircle className="h-5 w-5" />} />
        <StatCard label="Warn" value={stats.warn} tone="warning" icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard label="Fatal" value={stats.fatal} tone="purple" icon={<TriangleAlert className="h-5 w-5" />} />
        <StatCard label="Unresolved" value={stats.unresolved} tone="danger" icon={<Circle className="h-5 w-5" />} />
      </div>

      <article className="rounded-lg border border-theme bg-light-background-card p-4 shadow-soft dark:bg-dark-background-card">
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
            <GuardedInput
              leadingIcon={<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-text-muted dark:text-dark-text-muted" />}
              className={`${inputClass} w-full pl-9`}
              placeholder="ค้นหา message, source, code, username, path..."
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
            />
            <select
              className={inputClass}
              value={level}
              onChange={(event) => changeLevel(event.target.value as LevelFilter)}
            >
              {LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              className={inputClass}
              value={resolved}
              onChange={(event) => changeResolved(event.target.value as ResolvedFilter)}
            >
              {RESOLVED_OPTIONS.map((option) => (
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
            Loading error logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="grid min-h-48 place-items-center text-sm text-light-text-muted dark:text-dark-text-muted">
            ไม่พบ error log ตามตัวกรอง
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
              <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                <tr>
                  {["#", "Time", "Level", "Message", "Source / Code", "User", "Request", "Status"].map((header) => (
                    <th key={header} className="px-4 py-3 font-semibold">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                {logs.map((log, index) => (
                  <tr
                    key={log.id}
                    className={`transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10 ${log.resolved ? "opacity-60" : ""}`}
                  >
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
                      <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold uppercase ${levelClass(log.level)}`}>
                        {levelIcon(log.level)}
                        {log.level}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <p className="max-w-72 truncate font-medium text-light-text dark:text-dark-text" title={log.message}>
                        {log.message}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      {log.source || log.code ? (
                        <div>
                          {log.source && (
                            <p className="font-mono text-xs text-light-text dark:text-dark-text">{log.source}</p>
                          )}
                          {log.code && (
                            <p className="font-mono text-xs text-light-text-muted dark:text-dark-text-muted">{log.code}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-light-text-muted dark:text-dark-text-muted">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {log.username ? (
                        <div className="min-w-24">
                          <p className="font-medium text-light-text dark:text-dark-text">{log.username}</p>
                          {log.userId !== null && (
                            <p className="text-xs text-light-text-muted dark:text-dark-text-muted">#{log.userId}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-light-text-muted dark:text-dark-text-muted">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {log.requestPath ? (
                        <div>
                          {log.requestMethod && (
                            <span className="mr-1.5 rounded bg-slate-500/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
                              {log.requestMethod}
                            </span>
                          )}
                          <span className="font-mono text-xs text-light-text-muted dark:text-dark-text-muted">
                            {log.requestPath}
                          </span>
                          {log.ipAddress && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-light-text-muted dark:text-dark-text-muted">
                              <Globe2 className="h-3 w-3" />
                              {log.ipAddress}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-light-text-muted dark:text-dark-text-muted">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={resolvingId === log.id}
                        onClick={() => void toggleResolve(log)}
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-50"
                        title={log.resolved ? "คลิกเพื่อ unresolve" : "คลิกเพื่อ mark resolved"}
                      >
                        {resolvingId === log.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : log.resolved ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Resolved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-red-500/10 px-2 py-1 text-red-600 dark:text-red-400">
                            <XCircle className="h-3.5 w-3.5" />
                            Open
                          </span>
                        )}
                      </button>
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
                  <h2 className="text-base font-semibold text-light-text dark:text-dark-text">Export Error Logs</h2>
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
                  <dt className="font-semibold text-light-text dark:text-dark-text">Level</dt>
                  <dd className="text-light-text-muted dark:text-dark-text-muted">{level === "all" ? "ทั้งหมด" : level.toUpperCase()}</dd>
                  <dt className="font-semibold text-light-text dark:text-dark-text">Status</dt>
                  <dd className="text-light-text-muted dark:text-dark-text-muted">{resolved === "all" ? "ทั้งหมด" : resolved}</dd>
                  <dt className="font-semibold text-light-text dark:text-dark-text">จาก</dt>
                  <dd className="text-light-text-muted dark:text-dark-text-muted">{from || "ทั้งหมด"}</dd>
                  <dt className="font-semibold text-light-text dark:text-dark-text">ถึง</dt>
                  <dd className="text-light-text-muted dark:text-dark-text-muted">{to || "ทั้งหมด"}</dd>
                </dl>
              </div>

              <div className="rounded-lg border border-theme bg-light-primary/5 p-3 text-xs text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                ไฟล์มี 3 sheet: Summary, Error Logs (มี stack trace) และ By Source
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

export default ErrorLogsPage;
