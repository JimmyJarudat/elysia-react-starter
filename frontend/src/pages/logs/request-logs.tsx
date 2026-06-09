import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import GuardedInput from "@/common/GuardedInput";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Globe2,
  ListOrdered,
  Network,
  RefreshCw,
  Search,
  ServerCrash,
  Timer,
  TrendingUp,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import StatCard from "@/common/StatCard";
import Pagination from "@/common/Pagination";
import { useApi } from "@/hooks/useApi";
import { useRegional } from "@/contexts/RegionalContext";
import { useSession } from "@/contexts/SessionContext";
import { useTheme } from "@/contexts/ThemeContext";

interface RequestLogRecord {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  queryParams: string | null;
  userId: number | null;
  username: string | null;
  ipAddress: string;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  statusCode: number | null;
  responseTime: number | null;
  errorMessage: string | null;
}

interface RequestLogsResponse {
  success: boolean;
  data: {
    logs: RequestLogRecord[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
    stats: {
      total: number;
      success: number;
      clientError: number;
      serverError: number;
    };
  };
}

type MethodFilter = "all" | "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type StatusFilter = "all" | "2xx" | "3xx" | "4xx" | "5xx";
type ViewTab = "table" | "analytics";
type AnalyticsRange = "24h" | "7d";
type ExportPreset = "today" | "1m" | "3m" | "custom";

interface AnalyticsTrendPoint {
  bucket: string;
  total: number;
  errors: number;
}

interface AnalyticsTopPath {
  path: string;
  count: number;
  errorCount: number;
  avgResponseTime: number | null;
}

interface AnalyticsStatusBreakdown {
  statusCode: number;
  count: number;
}

interface AnalyticsMethodBreakdown {
  method: string;
  count: number;
}

interface RequestLogsAnalytics {
  range: AnalyticsRange;
  since: string;
  recordCount: number;
  trend: AnalyticsTrendPoint[];
  topPaths: AnalyticsTopPath[];
  statusBreakdown: AnalyticsStatusBreakdown[];
  methodBreakdown: AnalyticsMethodBreakdown[];
  responseTime: { p50: number | null; p95: number | null; p99: number | null; avg: number | null; max: number | null };
}

interface RequestLogsAnalyticsResponse {
  success: boolean;
  data: RequestLogsAnalytics;
}

const inputClass =
  "rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:focus:ring-dark-primary";

const methodClass = (method: string) => {
  switch (method) {
    case "GET": return "bg-sky-500/10 text-sky-700 dark:text-sky-400";
    case "POST": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "PUT":
    case "PATCH": return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    case "DELETE": return "bg-red-500/10 text-red-600 dark:text-red-400";
    default: return "bg-light-text-muted/10 text-light-text-muted dark:text-dark-text-muted";
  }
};

const statusOf = (statusCode: number | null) => {
  if (statusCode === null) {
    return { label: "-", cls: "bg-light-text-muted/10 text-light-text-muted dark:text-dark-text-muted", Icon: AlertCircle };
  }
  if (statusCode >= 500) return { label: String(statusCode), cls: "bg-red-500/10 text-red-600 dark:text-red-400", Icon: XCircle };
  if (statusCode >= 400) return { label: String(statusCode), cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400", Icon: AlertCircle };
  return { label: String(statusCode), cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", Icon: CheckCircle2 };
};

const CHART_PALETTES = {
  light: { primary: "#0ea5e9", success: "#059669", warning: "#d97706", danger: "#dc2626", grid: "#e2e8f0", text: "#64748b", tooltipBg: "#ffffff" },
  dark: { primary: "#38bdf8", success: "#34d399", warning: "#fbbf24", danger: "#f87171", grid: "#1e293b", text: "#94a3b8", tooltipBg: "#0f172a" },
} as const;

const statusChartColor = (statusCode: number, palette: (typeof CHART_PALETTES)[keyof typeof CHART_PALETTES]) => {
  if (statusCode >= 500) return palette.danger;
  if (statusCode >= 400) return palette.warning;
  return palette.success;
};

const RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: "24h", label: "24 ชั่วโมง" },
  { value: "7d", label: "7 วัน" },
];

const EXPORT_OPTIONS: { value: ExportPreset; label: string; description: string }[] = [
  { value: "today", label: "วันนี้", description: "ข้อมูลตั้งแต่ 00:00 ถึงสิ้นวัน" },
  { value: "1m", label: "1 เดือน", description: "ย้อนหลัง 1 เดือนจนถึงวันนี้" },
  { value: "3m", label: "3 เดือน", description: "ย้อนหลัง 3 เดือนจนถึงวันนี้" },
  { value: "custom", label: "ช่วงวันที่", description: "กำหนดวันเริ่มต้นและวันสิ้นสุดเอง" },
];

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);

const getPositiveIntParam = (params: URLSearchParams, key: string, fallback: number) => {
  const value = Number(params.get(key));
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const getTabFromParams = (params: URLSearchParams): ViewTab => (
  params.get("tab") === "analytics" ? "analytics" : "table"
);

const getMethodFromParams = (params: URLSearchParams): MethodFilter => {
  const value = params.get("method");
  return value === "GET" || value === "POST" || value === "PUT" || value === "PATCH" || value === "DELETE"
    ? value
    : "all";
};

const getStatusFromParams = (params: URLSearchParams): StatusFilter => {
  const value = params.get("status");
  return value === "2xx" || value === "3xx" || value === "4xx" || value === "5xx" ? value : "all";
};

const getRangeFromParams = (params: URLSearchParams): AnalyticsRange => (
  params.get("range") === "7d" ? "7d" : "24h"
);

const getExportPresetFromParams = (params: URLSearchParams): ExportPreset => {
  const value = params.get("exportPreset");
  return value === "1m" || value === "3m" || value === "custom" ? value : "today";
};

const RequestLogsPage = () => {
  const { api, get } = useApi();
  const { user } = useSession();
  const { formatDate, formatDateTime, formatTime } = useRegional();
  const { theme } = useTheme();
  const palette = CHART_PALETTES[theme];
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = getTabFromParams(searchParams);
  const search = searchParams.get("search") ?? "";
  const methodFilter = getMethodFromParams(searchParams);
  const statusFilter = getStatusFromParams(searchParams);
  const page = getPositiveIntParam(searchParams, "page", 1);
  const pageSize = getPositiveIntParam(searchParams, "pageSize", 20);
  const analyticsRange = getRangeFromParams(searchParams);
  const isExportModalOpen = searchParams.get("modal") === "export-excel";
  const exportPreset = getExportPresetFromParams(searchParams);
  const exportStartDate = searchParams.get("exportStart") ?? toDateInputValue(new Date());
  const exportEndDate = searchParams.get("exportEnd") ?? toDateInputValue(new Date());
  const [logs, setLogs] = useState<RequestLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, success: 0, clientError: 0, serverError: 0 });

  const [analytics, setAnalytics] = useState<RequestLogsAnalytics | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];
  const isSuperAdmin = roles.includes("SUPERADMIN");
  const hasPermission = (permission: string) => isSuperAdmin || permissions.includes(permission);
  const canRead = hasPermission("request_logs.read");

  const loadLogs = async () => {
    if (!canRead) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await get<RequestLogsResponse>("/logs/request", {
        params: {
          search: search.trim() || undefined,
          method: methodFilter,
          status: statusFilter,
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
      setError(err instanceof Error ? err.message : "Unable to load request logs");
      setLogs([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, [canRead, page, pageSize, search, methodFilter, statusFilter]);

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

  const changeTab = (next: ViewTab) => {
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      if (next === "analytics") nextParams.set("tab", "analytics");
      else {
        nextParams.delete("tab");
        nextParams.delete("range");
      }
      return nextParams;
    });
  };

  const changeSearch = (next: string) => {
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      const value = next.trim();
      if (value) nextParams.set("search", value);
      else nextParams.delete("search");
      nextParams.delete("page");
      return nextParams;
    });
  };

  const changeMethod = (next: MethodFilter) => {
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      if (next !== "all") nextParams.set("method", next);
      else nextParams.delete("method");
      nextParams.delete("page");
      return nextParams;
    });
  };

  const changeStatus = (next: StatusFilter) => {
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      if (next !== "all") nextParams.set("status", next);
      else nextParams.delete("status");
      nextParams.delete("page");
      return nextParams;
    });
  };

  const changeAnalyticsRange = (next: AnalyticsRange) => {
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      if (next !== "24h") nextParams.set("range", next);
      else nextParams.delete("range");
      return nextParams;
    });
  };

  const loadAnalytics = async () => {
    if (!canRead) {
      setIsAnalyticsLoading(false);
      return;
    }

    setIsAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const response = await get<RequestLogsAnalyticsResponse>("/logs/request/analytics", {
        params: { range: analyticsRange },
      });
      setAnalytics(response.data.data);
    } catch (err) {
      setAnalyticsError(err instanceof Error ? err.message : "Unable to load analytics");
      setAnalytics(null);
    } finally {
      setIsAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "analytics") void loadAnalytics();
  }, [canRead, activeTab, analyticsRange]);

  const formatBucketLabel = (bucket: string) => (analyticsRange === "24h" ? formatTime(bucket) : formatDate(bucket));

  const openExportModal = () => {
    setExportError(null);
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      nextParams.set("modal", "export-excel");
      if (!nextParams.get("exportPreset")) nextParams.set("exportPreset", "today");
      return nextParams;
    });
  };

  const closeExportModal = () => {
    if (isExporting) return;
    setExportError(null);
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      nextParams.delete("modal");
      nextParams.delete("exportPreset");
      nextParams.delete("exportStart");
      nextParams.delete("exportEnd");
      return nextParams;
    });
  };

  const changeExportPreset = (next: ExportPreset) => {
    setExportError(null);
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      nextParams.set("modal", "export-excel");
      nextParams.set("exportPreset", next);
      if (next !== "custom") {
        nextParams.delete("exportStart");
        nextParams.delete("exportEnd");
      } else {
        if (!nextParams.get("exportStart")) nextParams.set("exportStart", exportStartDate);
        if (!nextParams.get("exportEnd")) nextParams.set("exportEnd", exportEndDate);
      }
      return nextParams;
    });
  };

  const changeExportDate = (key: "exportStart" | "exportEnd", value: string) => {
    setExportError(null);
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      nextParams.set("modal", "export-excel");
      nextParams.set("exportPreset", "custom");
      if (value) nextParams.set(key, value);
      else nextParams.delete(key);
      return nextParams;
    });
  };

  const downloadExport = async () => {
    if (exportPreset === "custom" && (!exportStartDate || !exportEndDate)) {
      setExportError("กรุณาเลือกวันเริ่มต้นและวันสิ้นสุด");
      return;
    }

    if (exportPreset === "custom" && exportStartDate > exportEndDate) {
      setExportError("วันเริ่มต้นต้องไม่เกินวันสิ้นสุด");
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      const response = await api.get<Blob>("/logs/request/export", {
        params: {
          preset: exportPreset,
          startDate: exportPreset === "custom" ? exportStartDate : undefined,
          endDate: exportPreset === "custom" ? exportEndDate : undefined,
          search: search.trim() || undefined,
          method: methodFilter,
          status: statusFilter,
        },
        responseType: "blob",
      });

      const blob = response.data;
      const contentDisposition = response.headers["content-disposition"];
      const filenameMatch = typeof contentDisposition === "string"
        ? /filename="?([^"]+)"?/.exec(contentDisposition)
        : null;
      const filename = filenameMatch?.[1] ?? `request-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
            <Network className="mx-auto h-8 w-8 opacity-30" />
            <p className="mt-2 text-sm">คุณไม่มีสิทธิ์ดู Request Logs</p>
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
              <Network className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                Logs
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">Request Logs</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                บันทึกการเรียกใช้งาน API ทั้งหมด พร้อม Status Code, Response Time และ IP Address
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

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Total", value: stats.total, icon: <Network className="h-5 w-5" />, tone: "primary" as const },
          { label: "Success (2xx-3xx)", value: stats.success, icon: <CheckCircle2 className="h-5 w-5" />, tone: "success" as const },
          { label: "Client Error (4xx)", value: stats.clientError, icon: <AlertCircle className="h-5 w-5" />, tone: "warning" as const },
          { label: "Server Error (5xx)", value: stats.serverError, icon: <ServerCrash className="h-5 w-5" />, tone: "danger" as const },
        ].map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <div className="inline-flex w-fit rounded-lg border border-theme p-1">
        {([
          { key: "table" as const, label: "ตาราง" },
          { key: "analytics" as const, label: "วิเคราะห์ข้อมูล" },
        ]).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => changeTab(tab.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? "bg-light-primary text-white dark:bg-dark-primary dark:text-dark-background"
                : "text-light-text-muted hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "table" && (
      <>
      <article className="rounded-lg border border-theme bg-light-background-card p-4 shadow-soft dark:bg-dark-background-card">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <GuardedInput
            leadingIcon={<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-text-muted dark:text-dark-text-muted" />}
            className={`${inputClass} w-full pl-9`}
            placeholder="ค้นหา path, username, IP, user agent..."
            value={search}
            onChange={(event) => changeSearch(event.target.value)}
          />
          <select
            className={inputClass}
            value={methodFilter}
            onChange={(event) => changeMethod(event.target.value as MethodFilter)}
          >
            <option value="all">All methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
          <select
            className={inputClass}
            value={statusFilter}
            onChange={(event) => changeStatus(event.target.value as StatusFilter)}
          >
            <option value="all">All status</option>
            <option value="2xx">2xx Success</option>
            <option value="3xx">3xx Redirect</option>
            <option value="4xx">4xx Client Error</option>
            <option value="5xx">5xx Server Error</option>
          </select>
        </div>
      </article>

      <article className="overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-soft dark:bg-dark-background-card">
        {error && (
          <div className="flex items-center gap-3 p-5 text-sm text-red-600 dark:text-red-300">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid min-h-48 place-items-center text-light-text-muted dark:text-dark-text-muted">
            Loading request logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="grid min-h-48 place-items-center text-sm text-light-text-muted dark:text-dark-text-muted">
            ไม่พบ request log ตามตัวกรอง
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
              <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                <tr>
                  {["#", "Time", "Method", "Path", "User", "IP", "Status", "Response Time"].map((header) => (
                    <th key={header} className="px-4 py-3 font-semibold">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                {logs.map((log, index) => {
                  const status = statusOf(log.statusCode);
                  const StatusIcon = status.Icon;

                  return (
                    <tr key={log.id} className="transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10">
                      <td className="w-14 px-4 py-3 font-medium text-light-text-muted dark:text-dark-text-muted">
                        {startIndex + index + 1}
                      </td>
                      <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                        <span className="inline-flex min-w-36 items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDateTime(log.timestamp)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${methodClass(log.method)}`}>
                          {log.method}
                        </span>
                      </td>
                      <td className="max-w-72 px-4 py-3">
                        <span className="block truncate font-medium text-light-text dark:text-dark-text" title={log.path}>{log.path}</span>
                        {log.errorMessage && (
                          <span className="block truncate text-xs text-red-600 dark:text-red-400" title={log.errorMessage}>{log.errorMessage}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-32">
                          <p className="font-medium text-light-text dark:text-dark-text">{log.username || "-"}</p>
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
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${status.cls}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                        {log.responseTime !== null ? `${log.responseTime} ms` : "-"}
                      </td>
                    </tr>
                  );
                })}
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
      </>
      )}

      {activeTab === "analytics" && (
        <>
          <article className="rounded-lg border border-theme bg-light-background-card p-4 shadow-soft dark:bg-dark-background-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
                {analytics
                  ? `วิเคราะห์จากข้อมูล ${analytics.recordCount.toLocaleString()} รายการ ตั้งแต่ ${formatDateTime(analytics.since)}`
                  : "ภาพรวมแนวโน้มและสถิติของ Request Logs"}
              </p>
              <div className="inline-flex rounded-lg border border-theme p-1">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => changeAnalyticsRange(option.value)}
                    className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                      analyticsRange === option.value
                        ? "bg-light-primary text-white dark:bg-dark-primary dark:text-dark-background"
                        : "text-light-text-muted hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </article>

          {analyticsError && (
            <article className="flex items-center gap-3 rounded-lg border border-theme bg-light-background-card p-5 text-sm text-red-600 shadow-soft dark:bg-dark-background-card dark:text-red-300">
              <AlertCircle className="h-5 w-5" />
              {analyticsError}
            </article>
          )}

          {isAnalyticsLoading ? (
            <article className="grid min-h-48 place-items-center rounded-lg border border-theme bg-light-background-card text-sm text-light-text-muted shadow-soft dark:bg-dark-background-card dark:text-dark-text-muted">
              Loading analytics...
            </article>
          ) : analytics && (
            <>
              <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-light-text dark:text-dark-text">
                  <TrendingUp className="h-4 w-4" />
                  แนวโน้มจำนวน Request และ Error ตามช่วงเวลา
                </h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.trend.map((point) => ({ ...point, label: formatBucketLabel(point.bucket) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                      <XAxis dataKey="label" stroke={palette.text} fontSize={12} tickLine={false} />
                      <YAxis stroke={palette.text} fontSize={12} allowDecimals={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: palette.tooltipBg, border: `1px solid ${palette.grid}`, borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="total" name="Requests" stroke={palette.primary} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="errors" name="Errors" stroke={palette.danger} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <div className="grid gap-3 md:grid-cols-5">
                {[
                  { label: "Avg", value: analytics.responseTime.avg },
                  { label: "p50", value: analytics.responseTime.p50 },
                  { label: "p95", value: analytics.responseTime.p95 },
                  { label: "p99", value: analytics.responseTime.p99 },
                  { label: "Max", value: analytics.responseTime.max },
                ].map((item) => (
                  <article key={item.label} className="rounded-lg border border-theme bg-light-background-card p-4 text-center shadow-soft dark:bg-dark-background-card">
                    <p className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                      <Timer className="h-3.5 w-3.5" />
                      {item.label}
                    </p>
                    <p className="mt-1 text-xl font-bold text-light-text dark:text-dark-text">
                      {item.value !== null ? `${item.value.toLocaleString()} ms` : "-"}
                    </p>
                  </article>
                ))}
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <article className="overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-soft dark:bg-dark-background-card">
                  <h2 className="flex items-center gap-2 border-b border-light-border px-5 py-4 text-sm font-semibold text-light-text dark:border-dark-border dark:text-dark-text">
                    <ListOrdered className="h-4 w-4" />
                    Top Paths
                  </h2>
                  {analytics.topPaths.length === 0 ? (
                    <p className="p-5 text-sm text-light-text-muted dark:text-dark-text-muted">ไม่พบข้อมูลในช่วงเวลานี้</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
                        <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                          <tr>
                            {["Path", "Requests", "Errors", "Avg Response"].map((header) => (
                              <th key={header} className="px-4 py-2.5 font-semibold">{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                          {analytics.topPaths.map((item) => (
                            <tr key={item.path} className="transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10">
                              <td className="max-w-60 truncate px-4 py-2.5 font-medium text-light-text dark:text-dark-text" title={item.path}>
                                {item.path}
                              </td>
                              <td className="px-4 py-2.5 text-light-text-muted dark:text-dark-text-muted">{item.count.toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-light-text-muted dark:text-dark-text-muted">{item.errorCount.toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-light-text-muted dark:text-dark-text-muted">
                                {item.avgResponseTime !== null ? `${item.avgResponseTime} ms` : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>

                <div className="grid gap-5">
                  <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-light-text dark:text-dark-text">
                      <BarChart3 className="h-4 w-4" />
                      Status Code Distribution
                    </h2>
                    {analytics.statusBreakdown.length === 0 ? (
                      <p className="text-sm text-light-text-muted dark:text-dark-text-muted">ไม่พบข้อมูลในช่วงเวลานี้</p>
                    ) : (
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.statusBreakdown.map((item) => ({ ...item, label: String(item.statusCode) }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                            <XAxis dataKey="label" stroke={palette.text} fontSize={12} tickLine={false} />
                            <YAxis stroke={palette.text} fontSize={12} allowDecimals={false} tickLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: palette.tooltipBg, border: `1px solid ${palette.grid}`, borderRadius: 8, fontSize: 12 }} />
                            <Bar dataKey="count" name="Requests" radius={[4, 4, 0, 0]}>
                              {analytics.statusBreakdown.map((item) => (
                                <Cell key={item.statusCode} fill={statusChartColor(item.statusCode, palette)} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </article>

                  <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-light-text dark:text-dark-text">
                      <Network className="h-4 w-4" />
                      Method Distribution
                    </h2>
                    {analytics.methodBreakdown.length === 0 ? (
                      <p className="text-sm text-light-text-muted dark:text-dark-text-muted">ไม่พบข้อมูลในช่วงเวลานี้</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {analytics.methodBreakdown.map((item) => (
                          <span key={item.method} className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold ${methodClass(item.method)}`}>
                            {item.method}
                            <span className="rounded bg-black/10 px-1.5 py-0.5 dark:bg-white/10">{item.count.toLocaleString()}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {isExportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => event.target === event.currentTarget && closeExportModal()}
        >
          <div className="w-full max-w-xl rounded-lg border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">
            <div className="flex items-center justify-between border-b border-theme px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-light-text dark:text-dark-text">Export Request Logs</h2>
                  <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                    ใช้ filter search, method และ status ที่เลือกอยู่ตอนนี้ร่วมกับไฟล์ Excel
                  </p>
                </div>
              </div>
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary disabled:opacity-50 dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
                type="button"
                onClick={closeExportModal}
                disabled={isExporting}
                title="Close"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 p-5">
              <div className="grid gap-2 sm:grid-cols-2">
                {EXPORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => changeExportPreset(option.value)}
                    className={`rounded-md border p-3 text-left transition-colors ${
                      exportPreset === option.value
                        ? "border-light-primary bg-light-primary/10 text-light-primary dark:border-dark-primary dark:bg-dark-primary/10 dark:text-dark-primary"
                        : "border-theme text-light-text hover:bg-light-primary/5 dark:text-dark-text dark:hover:bg-dark-primary/10"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <CalendarDays className="h-4 w-4" />
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs text-light-text-muted dark:text-dark-text-muted">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>

              {exportPreset === "custom" && (
                <div className="grid gap-3 rounded-lg border border-theme bg-light-background p-4 dark:bg-dark-background">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">
                      วันเริ่มต้น
                      <input
                        className={`${inputClass} w-full`}
                        type="date"
                        value={exportStartDate}
                        onChange={(event) => changeExportDate("exportStart", event.target.value)}
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">
                      วันสิ้นสุด
                      <input
                        className={`${inputClass} w-full`}
                        type="date"
                        value={exportEndDate}
                        onChange={(event) => changeExportDate("exportEnd", event.target.value)}
                      />
                    </label>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-theme bg-light-primary/5 p-3 text-xs text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                <p className="font-semibold text-light-text dark:text-dark-text">รายละเอียดในไฟล์</p>
                <p className="mt-1">
                  Summary, รายละเอียด request, URL, query, user, IP, browser, OS, device, response time, error message,
                  error stack, top paths และ breakdown ตาม method/status
                </p>
              </div>

              {exportError && (
                <div className="flex items-center gap-2 rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
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

export default RequestLogsPage;
