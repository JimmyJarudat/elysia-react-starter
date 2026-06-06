import { Bell, Check, CheckCheck, Filter } from "lucide-react";
import { useState } from "react";
import Pagination from "@/common/Pagination";
import { useNotifications } from "@/features/notifications/hooks/useNotifications";
import { formatTimeDistance, formatThaiDateTime } from "@/utils/dateUtils";

const TYPE_COLORS: Record<string, string> = {
  LOGIN: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  SECURITY: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  SYSTEM: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  INFO: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  WARNING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
};

const TYPE_LABELS: Record<string, string> = {
  LOGIN: "เข้าสู่ระบบ",
  SECURITY: "ความปลอดภัย",
  SYSTEM: "ระบบ",
  INFO: "ข้อมูล",
  WARNING: "คำเตือน",
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-600 text-white",
  HIGH: "bg-orange-500 text-white",
  NORMAL: "bg-gray-400 text-white dark:bg-gray-600",
  LOW: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: "วิกฤต",
  HIGH: "สูง",
  NORMAL: "ปกติ",
  LOW: "ต่ำ",
};

const NotificationsPage = () => {
  const [filterUnread, setFilterUnread] = useState(false);

  const {
    items,
    unreadCount,
    page,
    pageSize,
    totalItems,
    totalPages,
    loading,
    markRead,
    markAllRead,
    changePage,
    changePageSize,
  } = useNotifications(20);

  const displayed = filterUnread ? items.filter((n) => !n.isRead) : items;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
            <Bell size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-light-text dark:text-dark-text">การแจ้งเตือน</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
                ยังไม่ได้อ่าน {unreadCount} รายการ
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter toggle */}
          <button
            type="button"
            onClick={() => setFilterUnread((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
              filterUnread
                ? "border-light-primary bg-light-primary/10 text-light-primary dark:border-dark-primary dark:bg-dark-primary/10 dark:text-dark-primary"
                : "border-theme bg-light-background-card text-light-text-muted hover:bg-light-primary/5 dark:bg-dark-background-card dark:text-dark-text-muted"
            }`}
          >
            <Filter size={14} />
            {filterUnread ? "ยังไม่อ่าน" : "ทั้งหมด"}
          </button>

          {/* Mark all read */}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="flex items-center gap-1.5 rounded-lg border border-theme bg-light-background-card px-3 py-2 text-sm text-light-text-muted transition-colors hover:bg-light-primary/5 hover:text-light-primary dark:bg-dark-background-card dark:text-dark-text-muted dark:hover:text-dark-primary"
            >
              <CheckCheck size={14} />
              อ่านทั้งหมด
            </button>
          )}
        </div>
      </div>

      {/* Card */}
      <div className="overflow-hidden rounded-xl border border-theme bg-light-background-card shadow-sm dark:bg-dark-background-card">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-light-text-muted dark:text-dark-text-muted">
            กำลังโหลดข้อมูล…
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-light-text-muted dark:text-dark-text-muted">
            <Bell size={36} className="opacity-25" />
            <p className="text-sm">{filterUnread ? "ไม่มีการแจ้งเตือนที่ยังไม่ได้อ่าน" : "ยังไม่มีการแจ้งเตือน"}</p>
          </div>
        ) : (
          <ul className="divide-y divide-theme">
            {displayed.map((n) => (
              <li
                key={n.id}
                className={`group flex gap-4 px-5 py-4 transition-colors hover:bg-light-background dark:hover:bg-dark-background ${
                  !n.isRead ? "bg-blue-50/40 dark:bg-blue-950/15" : ""
                }`}
              >
                {/* Unread indicator */}
                <div className="mt-2 flex-shrink-0">
                  <span
                    className={`block h-2.5 w-2.5 rounded-full ${
                      !n.isRead ? "bg-blue-500" : "border border-theme bg-transparent"
                    }`}
                  />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-light-text dark:text-dark-text">{n.title}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        TYPE_COLORS[n.type] ?? TYPE_COLORS.INFO
                      }`}
                    >
                      {TYPE_LABELS[n.type] ?? n.type}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        PRIORITY_COLORS[n.priority] ?? PRIORITY_COLORS.NORMAL
                      }`}
                    >
                      {PRIORITY_LABELS[n.priority] ?? n.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">{n.message}</p>
                  <p
                    className="mt-1.5 text-xs text-light-text-muted/70 dark:text-dark-text-muted/70"
                    title={formatThaiDateTime(n.createdAt)}
                  >
                    {formatTimeDistance(n.createdAt, new Date(), { addSuffix: true })}
                  </p>
                </div>

                {/* Mark read button */}
                {!n.isRead && (
                  <button
                    type="button"
                    title="ทำเครื่องหมายว่าอ่านแล้ว"
                    onClick={() => markRead(n.id)}
                    className="mt-1 flex-shrink-0 self-start rounded-md p-1.5 text-light-text-muted opacity-0 transition-all hover:bg-light-primary/10 hover:text-light-primary group-hover:opacity-100 dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
                  >
                    <Check size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pagination — only when not filtering by unread */}
      {!filterUnread && totalItems > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={changePage}
          onPageSizeChange={changePageSize}
          pageSizeOptions={[10, 20, 50]}
        />
      )}
    </div>
  );
};

export default NotificationsPage;
