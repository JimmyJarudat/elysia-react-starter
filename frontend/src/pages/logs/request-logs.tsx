import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Globe2,
  Network,
  RefreshCw,
  Search,
  ServerCrash,
  XCircle,
} from "lucide-react";
import StatCard from "@/common/StatCard";
import Pagination from "@/common/Pagination";
import { useApi } from "@/hooks/useApi";
import { useRegional } from "@/contexts/RegionalContext";
import { useSession } from "@/contexts/SessionContext";

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

const RequestLogsPage = () => {
  const { get } = useApi();
  const { user } = useSession();
  const { formatDateTime } = useRegional();
  const [logs, setLogs] = useState<RequestLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, success: 0, clientError: 0, serverError: 0 });

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

  useEffect(() => {
    setPage(1);
  }, [search, methodFilter, statusFilter]);

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

      <article className="rounded-lg border border-theme bg-light-background-card p-4 shadow-soft dark:bg-dark-background-card">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-text-muted dark:text-dark-text-muted" />
            <input
              className={`${inputClass} w-full pl-9`}
              placeholder="ค้นหา path, username, IP, user agent..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className={inputClass}
            value={methodFilter}
            onChange={(event) => setMethodFilter(event.target.value as MethodFilter)}
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
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
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
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      )}
    </section>
  );
};

export default RequestLogsPage;
