import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Globe2,
  History,
  Laptop,
  RefreshCw,
  ShieldOff,
  Smartphone,
  XCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import Pagination from "@/common/Pagination";
import { useApi } from "@/hooks/useApi";
import { useRegional } from "@/contexts/RegionalContext";

interface SessionItem {
  id: number;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  location: string | null;
  login_source: string | null;
  session_type: string | null;
  is_active: boolean | null;
  revocation_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
  expires_at: string;
  last_used_at: string | null;
  isCurrent: boolean;
  canRevoke: boolean;
}

interface AuthHistoryItem {
  id: number;
  auth_type: string;
  auth_status: string;
  failure_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  browser: string | null;
  os: string | null;
  location: string | null;
  auth_source: string | null;
  session_id: number | null;
  logout_time: string | null;
  session_duration: number | null;
  created_at: string;
  isCurrentSession: boolean;
}

interface MyAuthHistoryResponse {
  success: boolean;
  data: {
    sessions: SessionItem[];
    authHistory: AuthHistoryItem[];
  };
}

const statusClass = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  current: "bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary",
  inactive: "bg-light-text-muted/10 text-light-text-muted dark:text-dark-text-muted",
  failed: "bg-red-500/10 text-red-600 dark:text-red-400",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

const isExpired = (session: SessionItem) => new Date(session.expires_at) < new Date();

const sessionStatus = (session: SessionItem) => {
  if (session.isCurrent) return { label: "Current", cls: statusClass.current };
  if (!session.is_active) return { label: "Revoked", cls: statusClass.inactive };
  if (isExpired(session)) return { label: "Expired", cls: statusClass.warning };
  return { label: "Active", cls: statusClass.active };
};

const authStatus = (item: AuthHistoryItem) => {
  if (item.auth_status === "SUCCESS") {
    return {
      label: "Success",
      cls: statusClass.active,
      Icon: CheckCircle2,
    };
  }
  if (item.auth_status === "FAILED") {
    return {
      label: "Failed",
      cls: statusClass.failed,
      Icon: XCircle,
    };
  }
  return {
    label: item.auth_status,
    cls: statusClass.warning,
    Icon: AlertCircle,
  };
};

const sourceIcon = (source: string | null) => {
  if (source === "MOBILE" || source === "MOBILE_APP") return Smartphone;
  return Laptop;
};

const authTypeLabel = (type: string) => {
  if (type === "LOGOUT") return "ออกจากระบบ";
  if (type === "LOGIN") return "เข้าสู่ระบบ";
  return type.split("_").join(" ");
};

type AuthHistoryView = "sessions" | "history";

const getViewFromParams = (params: URLSearchParams): AuthHistoryView => (
  params.get("tab") === "history" ? "history" : "sessions"
);

const getPageFromParams = (params: URLSearchParams) => {
  const fromUrl = Number(params.get("page"));
  return Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : 1;
};

const MyAuthHistoryPage = () => {
  const { get, del } = useApi();
  const { formatDateTime: fmt } = useRegional();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [history, setHistory] = useState<AuthHistoryItem[]>([]);
  const view = getViewFromParams(searchParams);
  const historyPage = getPageFromParams(searchParams);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [historyPageSize, setHistoryPageSize] = useState(10);

  const changeHistoryPage = (next: number) => {
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      if (next > 1) nextParams.set("page", String(next));
      else nextParams.delete("page");
      return nextParams;
    });
  };

  const changeView = (next: AuthHistoryView) => {
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);

      if (next === "history") {
        nextParams.set("tab", "history");
      } else {
        nextParams.delete("tab");
        nextParams.delete("page");
      }

      return nextParams;
    });
  };

  const activeCount = useMemo(
    () => sessions.filter((session) => session.is_active && !isExpired(session)).length,
    [sessions],
  );
  const historyTotalPages = Math.max(1, Math.ceil(history.length / historyPageSize));
  const historyStartIndex = (historyPage - 1) * historyPageSize;
  const pagedHistory = useMemo(
    () => history.slice(historyStartIndex, historyPage * historyPageSize),
    [history, historyPage, historyPageSize],
  );

  const load = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await get<MyAuthHistoryResponse>("/my-auth-history");
      setSessions(res.data.data.sessions ?? []);
      setHistory(res.data.data.authHistory ?? []);
    } catch {
      setError("Unable to load authentication history");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const revokeSession = async (session: SessionItem) => {
    if (session.isCurrent) {
      toast.error("ไม่สามารถจัดการ session ปัจจุบันได้");
      return;
    }

    setBusyId(session.id);
    try {
      await del(`/my-auth-history/sessions/${session.id}`);
      toast.success("ปิด session แล้ว");
      await load();
    } catch {
      toast.error("ไม่สามารถปิด session นี้ได้");
    } finally {
      setBusyId(null);
    }
  };

  const handleHistoryPageSizeChange = (nextPageSize: number) => {
    setHistoryPageSize(nextPageSize);
    changeHistoryPage(1);
  };

  return (
    <section className="grid gap-5">
      <div className="rounded-xl border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-light-primary text-white shadow-sm dark:bg-dark-primary dark:text-dark-background">
              <History size={26} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                บัญชีของฉัน
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">ประวัติการเข้าสู่ระบบ</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                ตรวจสอบการเข้าใช้งานและปิด session อื่นที่ไม่ต้องการ
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-theme bg-light-background-card p-4 dark:bg-dark-background-card">
          <p className="text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">Active Sessions</p>
          <p className="mt-2 text-2xl font-bold text-light-text dark:text-dark-text">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-theme bg-light-background-card p-4 dark:bg-dark-background-card">
          <p className="text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">Login Records</p>
          <p className="mt-2 text-2xl font-bold text-light-text dark:text-dark-text">{history.length}</p>
        </div>
        <div className="rounded-lg border border-theme bg-light-background-card p-4 dark:bg-dark-background-card">
          <p className="text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">Current Session</p>
          <p className="mt-2 text-sm font-semibold text-light-primary dark:text-dark-primary">
            Session #{sessions.find((session) => session.isCurrent)?.id ?? "-"}
          </p>
        </div>
      </div>

      <div className="flex w-fit rounded-lg border border-theme bg-light-background-card p-1 dark:bg-dark-background-card">
        {[
          { key: "sessions", label: "Sessions" },
          { key: "history", label: "Auth History" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => changeView(tab.key as AuthHistoryView)}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
              view === tab.key
                ? "bg-light-primary text-white dark:bg-dark-primary dark:text-dark-background"
                : "text-light-text-muted hover:text-light-text dark:text-dark-text-muted dark:hover:text-dark-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <article className="overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-soft dark:bg-dark-background-card">
        {error && (
          <div className="flex items-center gap-3 p-5 text-sm text-red-600 dark:text-red-300">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid min-h-48 place-items-center text-light-text-muted dark:text-dark-text-muted">
            Loading...
          </div>
        ) : view === "sessions" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
              <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                <tr>
                  {["#", "Device", "IP", "Location", "Login", "Last Used", "Expires", "Status", ""].map((header) => (
                    <th key={header} className={`px-4 py-3 font-semibold ${!header ? "text-right" : ""}`}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                {sessions.map((session, index) => {
                  const status = sessionStatus(session);
                  const Icon = sourceIcon(session.login_source);
                  const busy = busyId === session.id;

                  return (
                    <tr key={session.id} className="transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10">
                      <td className="w-14 px-4 py-3 font-medium text-light-text-muted dark:text-dark-text-muted">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 shrink-0 text-light-primary dark:text-dark-primary" />
                          <div className="min-w-44">
                            <p className="font-medium text-light-text dark:text-dark-text">{session.device_info || "Unknown device"}</p>
                            <p className="text-xs text-light-text-muted dark:text-dark-text-muted">#{session.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{session.ip_address || "-"}</td>
                      <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{session.location || "-"}</td>
                      <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{fmt(session.created_at)}</td>
                      <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{fmt(session.last_used_at)}</td>
                      <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{fmt(session.expires_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          {session.canRevoke ? (
                            <button
                              type="button"
                              title="Revoke session"
                              onClick={() => void revokeSession(session)}
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
        ) : (
          <div>
            {history.length === 0 ? (
              <div className="grid min-h-48 place-items-center text-light-text-muted dark:text-dark-text-muted">
                No authentication history
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-theme px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-light-text dark:text-dark-text">Auth History</h2>
                    <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">
                      รายการล่าสุดเรียงจากใหม่ไปเก่า
                    </p>
                  </div>
                  <span className="rounded-md bg-light-primary/10 px-2.5 py-1 text-xs font-semibold text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                    {history.length} records
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
                    <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                      <tr>
                        {["#", "Event", "Status", "Time", "IP", "Location", "Device", "Session"].map((header) => (
                          <th key={header} className="px-4 py-3 font-semibold">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                      {pagedHistory.map((item, index) => {
                        const status = authStatus(item);
                        const StatusIcon = status.Icon;
                        const deviceText = [item.browser, item.os].filter(Boolean).join(" on ") || item.device_info || "Unknown device";
                        const locationText = item.location || item.auth_source || "Unknown location";

                        return (
                          <tr key={item.id} className="transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10">
                            <td className="w-14 px-4 py-3 font-medium text-light-text-muted dark:text-dark-text-muted">
                              {historyStartIndex + index + 1}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex min-w-44 items-center gap-3">
                                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${status.cls}`}>
                                  <StatusIcon className="h-4 w-4" />
                                </span>
                                <div className="min-w-0">
                                  <p className="font-medium text-light-text dark:text-dark-text">{authTypeLabel(item.auth_type)}</p>
                                  {item.failure_reason && (
                                    <p className="mt-0.5 truncate text-xs text-red-600 dark:text-red-400">{item.failure_reason}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1.5">
                                <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${status.cls}`}>
                                  {status.label}
                                </span>
                                {item.isCurrentSession && (
                                  <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${statusClass.current}`}>
                                    Current
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                              <span className="inline-flex min-w-36 items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {fmt(item.created_at)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                              <span className="inline-flex items-center gap-1.5">
                                <Globe2 className="h-3.5 w-3.5" />
                                {item.ip_address || "-"}
                              </span>
                            </td>
                            <td className="max-w-48 px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                              <span className="block truncate">{locationText}</span>
                            </td>
                            <td className="max-w-64 px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                              <span className="block truncate">{deviceText}</span>
                            </td>
                            <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                              {item.session_id ? `#${item.session_id}` : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-theme px-4 py-3">
                  <Pagination
                    currentPage={historyPage}
                    totalPages={historyTotalPages}
                    pageSize={historyPageSize}
                    totalItems={history.length}
                    onPageChange={changeHistoryPage}
                    onPageSizeChange={handleHistoryPageSizeChange}
                    pageSizeOptions={[10, 20, 50]}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </article>
    </section>
  );
};

export default MyAuthHistoryPage;
