import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Search,
  ShieldX,
  SkipForward,
  Timer,
  XCircle,
  Zap,
} from "lucide-react";
import GuardedInput from "@/common/GuardedInput";
import SortableTableHeader from "@/common/SortableTableHeader";
import StatCard from "@/common/StatCard";
import Pagination from "@/common/Pagination";
import { useApi } from "@/hooks/useApi";
import { useRegional } from "@/contexts/RegionalContext";
import { useSession } from "@/contexts/SessionContext";
import { getSortByFromParams, getSortOrderFromParams, nextSortParams } from "@/utils/sortParams";

interface SystemEventRecord {
  id: string;
  timestamp: string;
  eventType: string;
  eventName: string;
  status: string;
  durationMs: number | null;
  message: string | null;
  triggeredBy: string | null;
}

interface SystemEventsResponse {
  success: boolean;
  data: {
    events: SystemEventRecord[];
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
      running: number;
    };
    eventTypes: string[];
  };
}

type StatusFilter = "all" | "success" | "failed" | "running" | "skipped";
type SystemEventSortField = "timestamp" | "eventType" | "eventName" | "status" | "durationMs" | "triggeredBy";

const SYSTEM_EVENT_SORT_FIELDS = ["timestamp", "eventType", "eventName", "status", "durationMs", "triggeredBy"] as const;

const inputClass =
  "rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:focus:ring-dark-primary";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all",     label: "All Status" },
  { value: "success", label: "Success" },
  { value: "failed",  label: "Failed" },
  { value: "running", label: "Running" },
  { value: "skipped", label: "Skipped" },
];

const statusClass = (status: string) => {
  switch (status) {
    case "success": return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "failed":  return "bg-red-500/10 text-red-600 dark:text-red-400";
    case "running": return "bg-sky-500/10 text-sky-700 dark:text-sky-400";
    case "skipped": return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    default:        return "bg-light-text-muted/10 text-light-text-muted dark:text-dark-text-muted";
  }
};

const statusIcon = (status: string) => {
  switch (status) {
    case "success": return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "failed":  return <XCircle className="h-3.5 w-3.5" />;
    case "running": return <RefreshCw className="h-3.5 w-3.5 animate-spin" />;
    case "skipped": return <SkipForward className="h-3.5 w-3.5" />;
    default:        return <Zap className="h-3.5 w-3.5" />;
  }
};

const formatDuration = (ms: number | null) => {
  if (ms === null) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const getPositiveIntParam = (params: URLSearchParams, key: string, fallback: number) => {
  const value = Number(params.get(key));
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const getStatusFromParams = (params: URLSearchParams): StatusFilter => {
  const value = params.get("status");
  return value === "success" || value === "failed" || value === "running" || value === "skipped"
    ? value : "all";
};

const SystemEventsPage = () => {
  const { api, get } = useApi();
  const { user } = useSession();
  const { formatDateTime } = useRegional();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const eventType = searchParams.get("eventType") ?? "";
  const status = getStatusFromParams(searchParams);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const page = getPositiveIntParam(searchParams, "page", 1);
  const pageSize = getPositiveIntParam(searchParams, "pageSize", 20);
  const sortBy = getSortByFromParams(searchParams, SYSTEM_EVENT_SORT_FIELDS, "timestamp");
  const sortOrder = getSortOrderFromParams(searchParams);
  const isExportModalOpen = searchParams.get("modal") === "export-excel";

  const [events, setEvents] = useState<SystemEventRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, running: 0 });
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];
  const isSuperAdmin = roles.includes("SUPERADMIN");
  const hasPermission = (permission: string) => isSuperAdmin || permissions.includes(permission);
  const canRead = hasPermission("system_events.read");

  const prevFiltersRef = useRef({ search, eventType, status, from, to });

  const loadEvents = async () => {
    if (!canRead) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await get<SystemEventsResponse>("/logs/system-events", {
        params: {
          search: search.trim() || undefined,
          eventType: eventType.trim() || undefined,
          status,
          startDate: from || undefined,
          endDate: to || undefined,
          page,
          pageSize,
          sortBy,
          sortOrder,
        },
      });
      const payload = response.data.data;
      setEvents(payload.events ?? []);
      setTotalItems(payload.pagination.totalItems);
      setTotalPages(payload.pagination.totalPages);
      setStats(payload.stats);
      if (payload.eventTypes.length > 0) setEventTypes(payload.eventTypes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load system events");
      setEvents([]);
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
      prev.eventType !== eventType ||
      prev.status !== status ||
      prev.from !== from ||
      prev.to !== to;
    if (filtersChanged && page !== 1) {
      prevFiltersRef.current = { search, eventType, status, from, to };
      setSearchParams((params) => {
        const next = new URLSearchParams(params);
        next.delete("page");
        return next;
      });
      return;
    }
    prevFiltersRef.current = { search, eventType, status, from, to };
    void loadEvents();
  }, [canRead, page, pageSize, search, eventType, status, from, to, sortBy, sortOrder]);

  const changeSort = (field: SystemEventSortField) => {
    setSearchParams((params) => nextSortParams(params, field, sortBy, sortOrder, "timestamp"));
  };

  const changePage = (next: number) => {
    setSearchParams((params) => {
      const p = new URLSearchParams(params);
      if (next > 1) p.set("page", String(next)); else p.delete("page");
      return p;
    });
  };

  const changePageSize = (next: number) => {
    setSearchParams((params) => {
      const p = new URLSearchParams(params);
      if (next !== 20) p.set("pageSize", String(next)); else p.delete("pageSize");
      p.delete("page");
      return p;
    });
  };

  const changeSearch = (value: string) => {
    setSearchParams((params) => {
      const p = new URLSearchParams(params);
      if (value.trim()) p.set("search", value.trim()); else p.delete("search");
      p.delete("page");
      return p;
    });
  };

  const changeEventType = (value: string) => {
    setSearchParams((params) => {
      const p = new URLSearchParams(params);
      if (value) p.set("eventType", value); else p.delete("eventType");
      p.delete("page");
      return p;
    });
  };

  const changeStatus = (value: StatusFilter) => {
    setSearchParams((params) => {
      const p = new URLSearchParams(params);
      if (value !== "all") p.set("status", value); else p.delete("status");
      p.delete("page");
      return p;
    });
  };

  const changeFrom = (value: string) => {
    setSearchParams((params) => {
      const p = new URLSearchParams(params);
      if (value) p.set("from", value); else p.delete("from");
      p.delete("page");
      return p;
    });
  };

  const changeTo = (value: string) => {
    setSearchParams((params) => {
      const p = new URLSearchParams(params);
      if (value) p.set("to", value); else p.delete("to");
      p.delete("page");
      return p;
    });
  };

  const openExportModal = () => {
    setExportError(null);
    setSearchParams((params) => {
      const p = new URLSearchParams(params);
      p.set("modal", "export-excel");
      return p;
    });
  };

  const closeExportModal = () => {
    if (isExporting) return;
    setExportError(null);
    setSearchParams((params) => {
      const p = new URLSearchParams(params);
      p.delete("modal");
      return p;
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
      const response = await api.get<Blob>("/logs/system-events/export", {
        params: {
          startDate: from || undefined,
          endDate: to || undefined,
          search: search.trim() || undefined,
          eventType: eventType.trim() || undefined,
          status,
        },
        responseType: "blob",
      });
      const blob = response.data;
      const contentDisposition = response.headers["content-disposition"];
      const filenameMatch = typeof contentDisposition === "string"
        ? /filename="?([^"]+)"?/.exec(contentDisposition) : null;
      const fname = filenameMatch?.[1] ?? `system-events-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fname;
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
            <p className="mt-2 text-sm">คุณไม่มีสิทธิ์ดู System Events</p>
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
              <Cpu className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                Logs
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">System Events</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                บันทึกเหตุการณ์ระดับระบบ เช่น Cron, Cache, Email, Queue, Startup/Shutdown
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
              onClick={() => void loadEvents()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={<Cpu className="h-5 w-5" />} />
        <StatCard label="Success" value={stats.success} tone="success" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Failed" value={stats.failed} tone="danger" icon={<XCircle className="h-5 w-5" />} />
        <StatCard label="Running" value={stats.running} tone="muted" icon={<RefreshCw className="h-5 w-5" />} />
      </div>

      <article className="rounded-lg border border-theme bg-light-background-card p-4 shadow-soft dark:bg-dark-background-card">
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
            <GuardedInput
              leadingIcon={<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-text-muted dark:text-dark-text-muted" />}
              className={`${inputClass} w-full pl-9`}
              placeholder="ค้นหา event name, message, triggered by..."
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
            />
            <select
              className={inputClass}
              value={eventType}
              onChange={(e) => changeEventType(e.target.value)}
            >
              <option value="">All Types</option>
              {eventTypes.map((et) => (
                <option key={et} value={et}>{et}</option>
              ))}
            </select>
            <select
              className={inputClass}
              value={status}
              onChange={(e) => changeStatus(e.target.value as StatusFilter)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">ช่วงวันที่:</span>
            <input className={`${inputClass} w-40`} type="date" value={from} max={to || undefined}
              onChange={(e) => changeFrom(e.target.value)} />
            <span className="text-xs text-light-text-muted dark:text-dark-text-muted">ถึง</span>
            <input className={`${inputClass} w-40`} type="date" value={to} min={from || undefined}
              onChange={(e) => changeTo(e.target.value)} />
            {(from || to) && (
              <button type="button"
                className="text-xs text-light-text-muted underline hover:text-light-primary dark:text-dark-text-muted dark:hover:text-dark-primary"
                onClick={() => {
                  setSearchParams((params) => {
                    const p = new URLSearchParams(params);
                    p.delete("from"); p.delete("to"); p.delete("page");
                    return p;
                  });
                }}
              >ล้าง</button>
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
            Loading system events...
          </div>
        ) : events.length === 0 ? (
          <div className="grid min-h-48 place-items-center text-sm text-light-text-muted dark:text-dark-text-muted">
            ไม่พบ system event ตามตัวกรอง
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
              <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <SortableTableHeader field="timestamp" sortBy={sortBy} sortOrder={sortOrder} onSort={changeSort}>Time</SortableTableHeader>
                  <SortableTableHeader field="eventType" sortBy={sortBy} sortOrder={sortOrder} onSort={changeSort}>Type</SortableTableHeader>
                  <SortableTableHeader field="eventName" sortBy={sortBy} sortOrder={sortOrder} onSort={changeSort}>Event Name</SortableTableHeader>
                  <SortableTableHeader field="status" sortBy={sortBy} sortOrder={sortOrder} onSort={changeSort}>Status</SortableTableHeader>
                  <SortableTableHeader field="durationMs" sortBy={sortBy} sortOrder={sortOrder} onSort={changeSort}>Duration</SortableTableHeader>
                  <th className="px-4 py-3 font-semibold">Message</th>
                  <SortableTableHeader field="triggeredBy" sortBy={sortBy} sortOrder={sortOrder} onSort={changeSort}>Triggered By</SortableTableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                {events.map((event, index) => (
                  <tr key={event.id} className="transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10">
                    <td className="w-14 px-4 py-3 font-medium text-light-text-muted dark:text-dark-text-muted">
                      {startIndex + index + 1}
                    </td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                      <span className="inline-flex min-w-40 items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDateTime(event.timestamp)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-slate-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {event.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-light-text dark:text-dark-text">
                      {event.eventName}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${statusClass(event.status)}`}>
                        {statusIcon(event.status)}
                        {event.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {event.durationMs !== null ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-light-text-muted dark:text-dark-text-muted">
                          <Timer className="h-3.5 w-3.5" />
                          {formatDuration(event.durationMs)}
                        </span>
                      ) : (
                        <span className="text-light-text-muted dark:text-dark-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {event.message ? (
                        <p className="max-w-64 truncate text-sm text-light-text dark:text-dark-text" title={event.message}>
                          {event.message}
                        </p>
                      ) : (
                        <span className="text-light-text-muted dark:text-dark-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-light-text-muted dark:text-dark-text-muted">
                      {event.triggeredBy || "—"}
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
          onClick={(e) => e.target === e.currentTarget && closeExportModal()}
        >
          <div className="w-full max-w-md rounded-lg border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">
            <div className="flex items-center justify-between border-b border-theme px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-light-text dark:text-dark-text">Export System Events</h2>
                  <p className="text-xs text-light-text-muted dark:text-dark-text-muted">Export ตาม filter ที่ตั้งไว้ตอนนี้</p>
                </div>
              </div>
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary disabled:opacity-50 dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
                type="button" onClick={closeExportModal} disabled={isExporting}
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 p-5">
              <div className="rounded-lg border border-theme bg-light-background p-4 dark:bg-dark-background">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                  Filter ที่จะ export
                </p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="font-semibold text-light-text dark:text-dark-text">Search</dt>
                  <dd className="text-light-text-muted dark:text-dark-text-muted">{search || "—"}</dd>
                  <dt className="font-semibold text-light-text dark:text-dark-text">Type</dt>
                  <dd className="text-light-text-muted dark:text-dark-text-muted">{eventType || "ทั้งหมด"}</dd>
                  <dt className="font-semibold text-light-text dark:text-dark-text">Status</dt>
                  <dd className="text-light-text-muted dark:text-dark-text-muted">{status === "all" ? "ทั้งหมด" : status}</dd>
                  <dt className="font-semibold text-light-text dark:text-dark-text">จาก</dt>
                  <dd className="text-light-text-muted dark:text-dark-text-muted">{from || "ทั้งหมด"}</dd>
                  <dt className="font-semibold text-light-text dark:text-dark-text">ถึง</dt>
                  <dd className="text-light-text-muted dark:text-dark-text-muted">{to || "ทั้งหมด"}</dd>
                </dl>
              </div>
              <div className="rounded-lg border border-theme bg-light-primary/5 p-3 text-xs text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                ไฟล์มี 3 sheet: Summary, System Events (มี details) และ By Event Type
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
                type="button" onClick={closeExportModal} disabled={isExporting}
              >Cancel</button>
              <button
                className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
                type="button" onClick={() => void downloadExport()} disabled={isExporting}
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

export default SystemEventsPage;
