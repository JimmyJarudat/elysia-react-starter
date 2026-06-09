import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Globe2,
  Laptop,
  MonitorX,
  RefreshCw,
  Search,
  ShieldOff,
  Smartphone,
  XCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import StatCard from "@/common/StatCard";
import Pagination from "@/common/Pagination";
import { useApi } from "@/hooks/useApi";
import { useRegional } from "@/contexts/RegionalContext";
import { useSession } from "@/contexts/SessionContext";

interface SessionRecord {
  id: number;
  userId: number;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: string | null;
  location: string | null;
  loginSource: string | null;
  sessionType: string | null;
  isActive: boolean;
  revocationReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  expiresAt: string;
  lastUsedAt: string | null;
  isCurrent: boolean;
  canRevoke: boolean;
  user: {
    id: number;
    username: string;
    email: string;
    isActive: boolean;
    isDeleted: boolean;
    roles: string[];
    profile: {
      firstName: string | null;
      lastName: string | null;
      displayName: string | null;
      avatarUrl: string | null;
    };
  };
}

interface SessionsResponse {
  success: boolean;
  data: {
    sessions: SessionRecord[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
    stats: {
      total: number;
      active: number;
      expired: number;
      revoked: number;
    };
  };
}

type StatusFilter = "all" | "active" | "inactive" | "expired";

const inputClass =
  "rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:focus:ring-dark-primary";

const isExpired = (session: SessionRecord) => new Date(session.expiresAt) < new Date();

const statusOf = (session: SessionRecord) => {
  if (session.isCurrent) return { label: "Current", cls: "bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary", Icon: CheckCircle2 };
  if (!session.isActive) return { label: "Revoked", cls: "bg-light-text-muted/10 text-light-text-muted dark:text-dark-text-muted", Icon: XCircle };
  if (isExpired(session)) return { label: "Expired", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400", Icon: AlertCircle };
  return { label: "Active", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", Icon: CheckCircle2 };
};

const sourceIcon = (source: string | null) => {
  if (source === "MOBILE" || source === "MOBILE_APP") return Smartphone;
  return Laptop;
};

const getPositiveIntParam = (params: URLSearchParams, key: string, fallback: number) => {
  const value = Number(params.get(key));
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const getStatusFromParams = (params: URLSearchParams): StatusFilter => {
  const value = params.get("status");
  return value === "active" || value === "inactive" || value === "expired" ? value : "all";
};

const AdminSessionsPage = () => {
  const { get, del } = useApi();
  const { user } = useSession();
  const { formatDateTime } = useRegional();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const search = searchParams.get("search") ?? "";
  const statusFilter = getStatusFromParams(searchParams);
  const page = getPositiveIntParam(searchParams, "page", 1);
  const pageSize = getPositiveIntParam(searchParams, "pageSize", 20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, revoked: 0 });
  const [busyId, setBusyId] = useState<number | null>(null);

  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];
  const isSuperAdmin = roles.includes("SUPERADMIN");
  const hasPermission = (permission: string) => isSuperAdmin || permissions.includes(permission);
  const canRead = hasPermission("sessions.read");
  const canDelete = hasPermission("sessions.delete");

  const loadSessions = async () => {
    if (!canRead) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await get<SessionsResponse>("/sessions", {
        params: {
          search: search.trim() || undefined,
          status: statusFilter,
          page,
          pageSize,
        },
      });
      const payload = response.data.data;
      setSessions(payload.sessions ?? []);
      setTotalItems(payload.pagination.totalItems);
      setTotalPages(payload.pagination.totalPages);
      setStats(payload.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load sessions");
      setSessions([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, [canRead, page, pageSize, search, statusFilter]);

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

  const changeStatus = (next: StatusFilter) => {
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      if (next !== "all") nextParams.set("status", next);
      else nextParams.delete("status");
      nextParams.delete("page");
      return nextParams;
    });
  };

  const startIndex = (page - 1) * pageSize;

  const handleRevoke = async (session: SessionRecord) => {
    if (!canDelete) {
      toast.error("คุณไม่มีสิทธิ์ปิด session");
      return;
    }
    if (session.isCurrent) {
      toast.error("ไม่สามารถปิด session ปัจจุบันของตัวเองได้");
      return;
    }

    const confirmed = window.confirm(`บังคับออกจากระบบ "${session.user.username}" session #${session.id}?`);
    if (!confirmed) return;

    setBusyId(session.id);
    try {
      await del(`/sessions/${session.id}`);
      toast.success("ปิด session แล้ว");
      await loadSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ไม่สามารถปิด session ได้");
    } finally {
      setBusyId(null);
    }
  };

  if (!canRead) {
    return (
      <section className="grid gap-5">
        <article className="grid min-h-48 place-items-center rounded-lg border border-theme bg-light-background-card p-6 text-center text-light-text-muted shadow-soft dark:bg-dark-background-card dark:text-dark-text-muted">
          <div>
            <MonitorX className="mx-auto h-8 w-8 opacity-30" />
            <p className="mt-2 text-sm">คุณไม่มีสิทธิ์ดู sessions</p>
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
              <MonitorX className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                Administration
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">Sessions</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                ตรวจสอบ session ทั้งหมด และบังคับผู้ใช้ออกจากระบบเมื่อจำเป็น
              </p>
            </div>
          </div>

          <button
            className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
            type="button"
            onClick={() => void loadSessions()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Total", value: stats.total, icon: <MonitorX className="h-5 w-5" />, tone: "primary" as const },
          { label: "Active", value: stats.active, icon: <CheckCircle2 className="h-5 w-5" />, tone: "success" as const },
          { label: "Expired", value: stats.expired, icon: <AlertCircle className="h-5 w-5" />, tone: "warning" as const },
          { label: "Revoked", value: stats.revoked, icon: <XCircle className="h-5 w-5" />, tone: "muted" as const },
        ].map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <article className="rounded-lg border border-theme bg-light-background-card p-4 shadow-soft dark:bg-dark-background-card">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-text-muted dark:text-dark-text-muted" />
            <input
              className={`${inputClass} w-full pl-9`}
              placeholder="ค้นหา username, email, IP, device, location..."
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
            />
          </div>
          <select
            className={inputClass}
            value={statusFilter}
            onChange={(event) => changeStatus(event.target.value as StatusFilter)}
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="inactive">Revoked</option>
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
            Loading sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="grid min-h-48 place-items-center text-sm text-light-text-muted dark:text-dark-text-muted">
            ไม่พบ session ตามตัวกรอง
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
              <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                <tr>
                  {["#", "User", "Device", "IP", "Location", "Last Used", "Expires", "Status", ""].map((header) => (
                    <th key={header} className={`px-4 py-3 font-semibold ${!header ? "text-right" : ""}`}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                {sessions.map((session, index) => {
                  const status = statusOf(session);
                  const StatusIcon = status.Icon;
                  const SourceIcon = sourceIcon(session.loginSource);
                  const busy = busyId === session.id;

                  return (
                    <tr key={session.id} className="transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10">
                      <td className="w-14 px-4 py-3 font-medium text-light-text-muted dark:text-dark-text-muted">
                        {startIndex + index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-48">
                          <p className="font-semibold text-light-text dark:text-dark-text">{session.user.username}</p>
                          <p className="text-xs text-light-text-muted dark:text-dark-text-muted">{session.user.email}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {session.user.roles.map((role) => (
                              <span key={role} className="rounded-md bg-light-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                                {role}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-52 items-center gap-2 text-light-text-muted dark:text-dark-text-muted">
                          <SourceIcon className="h-4 w-4 shrink-0 text-light-primary dark:text-dark-primary" />
                          <span className="truncate">{session.deviceInfo || "Unknown device"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Globe2 className="h-3.5 w-3.5" />
                          {session.ipAddress || "-"}
                        </span>
                      </td>
                      <td className="max-w-48 px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                        <span className="block truncate">{session.location || "-"}</span>
                      </td>
                      <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                        <span className="inline-flex min-w-36 items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDateTime(session.lastUsedAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                        {formatDateTime(session.expiresAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${status.cls}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          {canDelete && session.canRevoke ? (
                            <button
                              type="button"
                              title="Revoke session"
                              onClick={() => void handleRevoke(session)}
                              disabled={busy}
                              className="grid h-8 w-8 place-items-center rounded-md border border-theme text-light-text-muted transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-dark-text-muted dark:hover:bg-red-900/20 dark:hover:text-red-400"
                            >
                              {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                            </button>
                          ) : (
                            <span className="text-sm text-light-text-muted dark:text-dark-text-muted">
                              {session.isCurrent ? "ปัจจุบัน" : "-"}
                            </span>
                          )}
                        </div>
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
    </section>
  );
};

export default AdminSessionsPage;
