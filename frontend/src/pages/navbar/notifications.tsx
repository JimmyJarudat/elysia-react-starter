import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  Info,
  LogIn,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  SortAsc,
  SortDesc,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import StatCard from "@/common/StatCard";
import Pagination from "@/common/Pagination";
import { useNotifications } from "@/features/notifications/hooks/useNotifications";
import { useRegional } from "@/contexts/RegionalContext";
import { formatTimeDistance } from "@/utils/dateUtils";

type TypeConfig = { Icon: LucideIcon; bg: string; text: string; label: string };

const TYPE_CONFIG: Record<string, TypeConfig> = {
  LOGIN:    { Icon: LogIn,         bg: "bg-sky-100 dark:bg-sky-900/40",       text: "text-sky-600 dark:text-sky-400",       label: "เข้าสู่ระบบ"  },
  SECURITY: { Icon: ShieldAlert,   bg: "bg-rose-100 dark:bg-rose-900/40",     text: "text-rose-600 dark:text-rose-400",     label: "ความปลอดภัย" },
  SYSTEM:   { Icon: Settings2,     bg: "bg-violet-100 dark:bg-violet-900/40", text: "text-violet-600 dark:text-violet-400", label: "ระบบ"         },
  INFO:     { Icon: Info,          bg: "bg-slate-100 dark:bg-slate-800",      text: "text-slate-500 dark:text-slate-400",   label: "ข้อมูล"       },
  WARNING:  { Icon: AlertTriangle, bg: "bg-amber-100 dark:bg-amber-900/40",   text: "text-amber-600 dark:text-amber-400",   label: "คำเตือน"      },
};

const FALLBACK_CFG: TypeConfig = TYPE_CONFIG.INFO;

const PRIORITY_CONFIG: Record<string, { label: string; cls: string }> = {
  CRITICAL: { label: "วิกฤต", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  HIGH:     { label: "สูง",   cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  NORMAL:   { label: "ปกติ",  cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  LOW:      { label: "ต่ำ",   cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500" },
};

const PRIORITY_RING: Record<string, string> = {
  CRITICAL: "ring-2 ring-rose-400 dark:ring-rose-500",
  HIGH:     "ring-2 ring-orange-400 dark:ring-orange-500",
};

const inputClass =
  "rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:focus:ring-dark-primary";

const NotificationsPage = () => {
  const { formatDateTime } = useRegional();
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialPage] = useState(() => {
    const fromUrl = Number(searchParams.get("page"));
    return Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : 1;
  });

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "read" | "unread">("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const {
    items,
    stats,
    page,
    pageSize,
    totalItems,
    totalPages,
    loading,
    markRead,
    markAllRead,
    changePage,
    changePageSize,
    refresh,
  } = useNotifications({
    pageSize: 20,
    initialPage,
    search: debouncedSearch,
    type: typeFilter,
    status: statusFilter,
    sort,
    prependOnSSE: false,
  });

  // เก็บเลขหน้าปัจจุบันไว้ใน URL (?page=) เพื่อให้รีเฟรชแล้วยังอยู่หน้าเดิม
  useEffect(() => {
    setSearchParams((params) => {
      if (page > 1) params.set("page", String(page));
      else params.delete("page");
      return params;
    });
  }, [page, setSearchParams]);

  const startIndex = (page - 1) * pageSize;

  return (
    <section className="grid gap-5">
      {/* ── Header ── */}
      <div className="rounded-xl border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-light-primary text-white shadow-sm dark:bg-dark-primary dark:text-dark-background">
              <Bell className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                บัญชีของฉัน
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">การแจ้งเตือน</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                ติดตามเหตุการณ์สำคัญและการเปลี่ยนแปลงในบัญชีของคุณ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {stats.unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-2 rounded-md border border-theme bg-light-background-card px-4 py-2 text-sm font-medium text-light-text-muted transition-colors hover:border-light-primary hover:text-light-primary dark:bg-dark-background-card dark:text-dark-text-muted dark:hover:border-dark-primary dark:hover:text-dark-primary"
              >
                <CheckCheck className="h-4 w-4" />
                อ่านทั้งหมด
              </button>
            )}
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary/90 disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary/90"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              รีเฟรช
            </button>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="ทั้งหมด"
          value={stats.total}
          icon={<Bell className="h-5 w-5" />}
          tone="primary"
        />
        <StatCard
          label="ยังไม่อ่าน"
          value={stats.unread}
          icon={<ShieldAlert className="h-5 w-5" />}
          tone="danger"
        />
        <StatCard
          label="อ่านแล้ว"
          value={stats.read}
          icon={<Check className="h-5 w-5" />}
          tone="success"
        />
      </div>

      {/* ── Filter / Search bar ── */}
      <article className="rounded-lg border border-theme bg-light-background-card p-4 shadow-soft dark:bg-dark-background-card">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-text-muted dark:text-dark-text-muted" />
            <input
              className={`${inputClass} w-full pl-9`}
              placeholder="ค้นหาหัวข้อหรือรายละเอียด…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Type */}
          <select
            className={inputClass}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">ทุกประเภท</option>
            <option value="LOGIN">เข้าสู่ระบบ</option>
            <option value="SECURITY">ความปลอดภัย</option>
            <option value="SYSTEM">ระบบ</option>
            <option value="WARNING">คำเตือน</option>
            <option value="INFO">ข้อมูล</option>
          </select>

          {/* Status */}
          <select
            className={inputClass}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "read" | "unread")}
          >
            <option value="all">ทุกสถานะ</option>
            <option value="unread">ยังไม่อ่าน</option>
            <option value="read">อ่านแล้ว</option>
          </select>

          {/* Sort */}
          <select
            className={inputClass}
            value={sort}
            onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
          >
            <option value="newest">ใหม่สุดก่อน</option>
            <option value="oldest">เก่าสุดก่อน</option>
          </select>
        </div>
      </article>

      {/* ── Table ── */}
      <article className="overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-soft dark:bg-dark-background-card">
        {loading && items.length === 0 ? (
          <div className="grid min-h-48 place-items-center text-sm text-light-text-muted dark:text-dark-text-muted">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              กำลังโหลด…
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-light-text-muted dark:text-dark-text-muted">
            <Bell className="h-10 w-10 opacity-20" />
            <p className="text-sm">ไม่พบการแจ้งเตือนตามเงื่อนไขที่เลือก</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
              <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                <tr>
                  <th className="w-12 px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">ประเภท</th>
                  <th className="px-4 py-3 font-semibold">การแจ้งเตือน</th>
                  <th className="px-4 py-3 font-semibold">ความสำคัญ</th>
                  <th className="px-4 py-3 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      วันที่
                      {sort === "newest" ? (
                        <SortDesc className="h-3.5 w-3.5" />
                      ) : (
                        <SortAsc className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </th>
                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                {items.map((n, idx) => {
                  const cfg = TYPE_CONFIG[n.type] ?? FALLBACK_CFG;
                  const { Icon } = cfg;
                  const priorityCfg = PRIORITY_CONFIG[n.priority] ?? PRIORITY_CONFIG.NORMAL;
                  const priorityRing = PRIORITY_RING[n.priority] ?? "";

                  return (
                    <tr
                      key={n.id}
                      className={`group transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10 ${
                        !n.isRead ? "bg-light-primary/[0.025] dark:bg-dark-primary/[0.04]" : ""
                      }`}
                    >
                      {/* # */}
                      <td className="px-4 py-3.5 font-medium text-light-text-muted dark:text-dark-text-muted">
                        <span className={`flex items-center gap-2`}>
                          {!n.isRead && (
                            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-light-primary dark:bg-dark-primary" />
                          )}
                          {startIndex + idx + 1}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${cfg.bg} ${priorityRing}`}
                          >
                            <Icon size={14} className={cfg.text} />
                          </div>
                          <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
                        </div>
                      </td>

                      {/* Notification content */}
                      <td className="px-4 py-3.5">
                        <p
                          className={`leading-snug ${
                            !n.isRead
                              ? "font-semibold text-light-text dark:text-dark-text"
                              : "font-medium text-light-text/85 dark:text-dark-text/85"
                          }`}
                        >
                          {n.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 max-w-sm text-xs leading-relaxed text-light-text-muted dark:text-dark-text-muted">
                          {n.message}
                        </p>
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${priorityCfg.cls}`}
                        >
                          {priorityCfg.label}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 text-light-text-muted dark:text-dark-text-muted">
                        <span
                          className="block text-xs"
                          title={formatDateTime(n.createdAt)}
                        >
                          {formatTimeDistance(n.createdAt, new Date(), { addSuffix: true })}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-light-text-muted/60 dark:text-dark-text-muted/60">
                          {formatDateTime(n.createdAt)}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5">
                        {!n.isRead && (
                          <button
                            type="button"
                            title="ทำเครื่องหมายว่าอ่านแล้ว"
                            onClick={() => markRead(n.id)}
                            className="grid h-8 w-8 place-items-center rounded-md border border-theme text-light-text-muted opacity-0 transition-all hover:border-light-primary hover:bg-light-primary/10 hover:text-light-primary group-hover:opacity-100 dark:text-dark-text-muted dark:hover:border-dark-primary dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {/* ── Pagination ── */}
      {totalItems > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={changePage}
          onPageSizeChange={(size) => changePageSize(size)}
          pageSizeOptions={[10, 20, 50]}
        />
      )}
    </section>
  );
};

export default NotificationsPage;
