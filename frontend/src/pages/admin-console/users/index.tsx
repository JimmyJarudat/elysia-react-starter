import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import StatCard from "@/common/StatCard";
import Pagination from "@/common/Pagination";
import ModalCreateUser from "./components/modal-create-user";
import ModalToggleStatus from "./components/modal-toggle-status";
import ModalDeleteUser from "./components/modal-delete-user";
import ModalManageRoles from "./components/modal-manage-roles";
import ModalEditUser from "./components/modal-edit-user";
import ModalImpersonate from "./components/modal-impersonate";
import {
  AlertCircle,
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  CheckCircle2,
  Edit2,
  Lock,
  LockOpen,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Trash2,
  Trash,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/contexts/SessionContext";
import { useRegional } from "@/contexts/RegionalContext";

interface UserRecord {
  id: number;
  username: string;
  email: string;
  groupName: string | null;
  isActive: boolean;
  isOnline: boolean;
  isEmailVerified: boolean;
  isApproved: boolean;
  lastLogin: string | null;
  createdAt: string | null;
  profile: {
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    phoneNumber: string | null;
    department: string | null;
  };
  roles: string[];
}

interface DeletedUserRecord {
  id: number;
  username: string;
  email: string;
  groupName: string | null;
  deletedAt: string | null;
  createdAt: string | null;
  profile: { firstName: string | null; lastName: string | null; displayName: string | null; avatarUrl: string | null; department: string | null };
  roles: string[];
}

interface DeletedUsersResponse { success: boolean; data: DeletedUserRecord[] }

interface UsersResponse {
  success: boolean;
  data: UserRecord[];
  message?: string;
}

interface RoleOption {
  id: string;
  name: string;
  priority: number;
}

interface RolesListResponse {
  success: boolean;
  data: RoleOption[];
}

type StatusFilter = "all" | "active" | "inactive" | "pending";
type OnlineFilter = "all" | "online" | "offline";
type ApprovalFilter = "all" | "approved" | "pending";
type VerificationFilter = "all" | "verified" | "unverified";
type SortField = "username" | "email" | "groupName" | "roles" | "status" | "lastLogin";
type SortOrder = "asc" | "desc";

const statusOptions: { label: string; value: StatusFilter }[] = [
  { label: "All users", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

const onlineOptions: { label: string; value: OnlineFilter }[] = [
  { label: "All online", value: "all" },
  { label: "Online", value: "online" },
  { label: "Offline", value: "offline" },
];

const approvalOptions: { label: string; value: ApprovalFilter }[] = [
  { label: "All approval", value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Pending", value: "pending" },
];

const verificationOptions: { label: string; value: VerificationFilter }[] = [
  { label: "All verification", value: "all" },
  { label: "Verified", value: "verified" },
  { label: "Unverified", value: "unverified" },
];

const actionButtonClass =
  "grid h-8 w-8 place-items-center rounded-md border border-theme text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary disabled:cursor-not-allowed disabled:opacity-40 dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary";

const filterClass =
  "rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:focus:ring-dark-primary";

const getDisplayName = (user: UserRecord) => {
  const profileName = [user.profile.firstName, user.profile.lastName].filter(Boolean).join(" ").trim();
  return user.profile.displayName || profileName || user.username;
};

const getInitials = (user: UserRecord) => {
  const displayName = getDisplayName(user);
  return displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

// formatDate ใช้จาก useRegional — ดู UserManagementPage

const UserManagementPage = () => {
  const { get, patch, del } = useApi();
  const { user: currentUser } = useSession();
  const { formatDateTime } = useRegional();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    status: "all" as StatusFilter,
    online: "all" as OnlineFilter,
    approval: "all" as ApprovalFilter,
    verification: "all" as VerificationFilter,
    role: "all",
  });
  const [sortBy, setSortBy] = useState<SortField>("username");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const urlModal = searchParams.get("modal");
  const modalUserId = Number(searchParams.get("id"));
  const createOpen = urlModal === "create";
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [statusTarget, setStatusTarget] = useState<UserRecord | null>(null);
  const [rolesTarget, setRolesTarget] = useState<UserRecord | null>(null);
  const [editTarget, setEditTarget] = useState<UserRecord | null>(null);
  const [impersonateTarget, setImpersonateTarget] = useState<UserRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Deleted users view
  const showDeleted = urlModal === "deleted-users" || urlModal === "permanent-delete";
  const [deletedUsers, setDeletedUsers] = useState<DeletedUserRecord[]>([]);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [permDeleteTarget, setPermDeleteTarget] = useState<DeletedUserRecord | null>(null);
  const [isPermDeleting, setIsPermDeleting] = useState(false);

  const roles = currentUser?.roles ?? [];
  const permissions = currentUser?.permissions ?? [];
  const isSuperAdmin = roles.includes("SUPERADMIN");
  const hasPermission = (permission: string) => isSuperAdmin || permissions.includes(permission);
  const canCreate = hasPermission("users.create");
  const canUpdate = hasPermission("users.update");
  const canDelete = hasPermission("users.delete");
  const canImpersonate = hasPermission("users.impersonate");

  const rolePriorityMap = useMemo(
    () => new Map(roleOptions.map((role) => [role.id, role.priority ?? 0])),
    [roleOptions],
  );
  const currentUserMaxPriority = useMemo(
    () => roles.reduce((max, roleId) => Math.max(max, rolePriorityMap.get(roleId) ?? 0), 0),
    [roles, rolePriorityMap],
  );
  const isRolePriorityReady = roleOptions.length > 0;
  const getMaxRolePriority = (roleIds: string[]) =>
    roleIds.reduce((max, roleId) => Math.max(max, rolePriorityMap.get(roleId) ?? 0), 0);
  const isUserActionLocked = (record: { roles: string[] }) =>
    !isRolePriorityReady || getMaxRolePriority(record.roles) > currentUserMaxPriority;

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await get<UsersResponse>("/users");
      setUsers(response.data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load users");
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await get<RolesListResponse>("/access-control/roles");
      setRoleOptions(response.data.data ?? []);
    } catch {
      setRoleOptions([]);
    }
  };

  useEffect(() => {
    void fetchUsers();
    void fetchRoles();
  }, []);

  const openModal = (modal: string, id?: number) => {
    setSearchParams((params) => {
      params.set("modal", modal);
      if (id) params.set("id", String(id));
      else params.delete("id");
      return params;
    });
  };

  const closeModal = () => {
    setSearchParams((params) => {
      params.delete("modal");
      params.delete("id");
      return params;
    });
    setStatusTarget(null);
    setRolesTarget(null);
    setEditTarget(null);
    setImpersonateTarget(null);
    setDeleteTarget(null);
    setPermDeleteTarget(null);
  };

  useEffect(() => {
    const item = Number.isInteger(modalUserId)
      ? users.find((user) => user.id === modalUserId)
      : undefined;

    setEditTarget(urlModal === "edit" && item ? item : null);
    setRolesTarget(urlModal === "roles" && item ? item : null);
    setImpersonateTarget(urlModal === "impersonate" && item ? item : null);
    setStatusTarget(urlModal === "status" && item ? item : null);
    setDeleteTarget(urlModal === "delete" && item ? item : null);
  }, [urlModal, modalUserId, users]);

  useEffect(() => {
    if (!showDeleted) return;
    void loadDeletedUsers();
  }, [showDeleted]);

  useEffect(() => {
    if (urlModal !== "permanent-delete" || !Number.isInteger(modalUserId)) {
      setPermDeleteTarget(null);
      return;
    }

    const item = deletedUsers.find((user) => user.id === modalUserId);
    if (item) setPermDeleteTarget(item);
  }, [urlModal, modalUserId, deletedUsers]);

  const availableRoles = useMemo(
    () => Array.from(new Set(users.flatMap((item) => item.roles))).sort(),
    [users],
  );

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return users.filter((item) => {
      const matchesKeyword = !keyword || [
        item.username,
        item.email,
        getDisplayName(item),
        item.groupName,
        item.profile.department,
        ...item.roles,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));

      const matchesStatus =
        filters.status === "all" ||
        (filters.status === "active" && item.isActive) ||
        (filters.status === "inactive" && !item.isActive) ||
        (filters.status === "pending" && !item.isApproved);

      const matchesOnline =
        filters.online === "all" ||
        (filters.online === "online" && item.isOnline) ||
        (filters.online === "offline" && !item.isOnline);

      const matchesApproval =
        filters.approval === "all" ||
        (filters.approval === "approved" && item.isApproved) ||
        (filters.approval === "pending" && !item.isApproved);

      const matchesVerification =
        filters.verification === "all" ||
        (filters.verification === "verified" && item.isEmailVerified) ||
        (filters.verification === "unverified" && !item.isEmailVerified);

      const matchesRole = filters.role === "all" || item.roles.includes(filters.role);

      return matchesKeyword && matchesStatus && matchesOnline && matchesApproval && matchesVerification && matchesRole;
    });
  }, [users, search, filters]);

  const sortedUsers = useMemo(() => {
    const getSortValue = (item: UserRecord) => {
      switch (sortBy) {
        case "email":
          return item.email;
        case "groupName":
          return item.groupName || item.profile.department || "";
        case "roles":
          return item.roles[0] || "";
        case "status":
          return `${item.isActive ? "1" : "0"}-${item.isOnline ? "1" : "0"}-${item.isApproved ? "1" : "0"}`;
        case "lastLogin":
          return item.lastLogin ? new Date(item.lastLogin).getTime() : 0;
        case "username":
        default:
          return item.username;
      }
    };

    return [...filteredUsers].sort((a, b) => {
      const left = getSortValue(a);
      const right = getSortValue(b);
      const result = typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right));

      return sortOrder === "asc" ? result : -result;
    });
  }, [filteredUsers, sortBy, sortOrder]);

  // Reset to page 1 when filter/search/sort changes
  useEffect(() => { setCurrentPage(1); }, [search, filters, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / pageSize));

  const paginatedUsers = useMemo(
    () => sortedUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sortedUsers, currentPage, pageSize],
  );

  const stats = useMemo(() => {
    const active = users.filter((item) => item.isActive).length;
    const pending = users.filter((item) => !item.isApproved).length;
    const online = users.filter((item) => item.isOnline).length;

    return { total: users.length, active, pending, online };
  }, [users]);

  const loadDeletedUsers = async () => {
    setDeletedLoading(true);
    try {
      const res = await get<DeletedUsersResponse>("/users/deleted");
      setDeletedUsers(res.data.data ?? []);
    } catch { toast.error("Cannot load deleted users"); }
    finally { setDeletedLoading(false); }
  };

  const handleShowDeleted = () => {
    openModal("deleted-users");
  };

  const handleRestoreUser = async (user: DeletedUserRecord) => {
    if (isUserActionLocked(user)) {
      toast.error("ไม่สามารถจัดการผู้ใช้ที่มี role สูงกว่าของคุณได้");
      return;
    }

    setRestoringId(user.id);
    try {
      await patch(`/users/${user.id}/restore`, {});
      setDeletedUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success(`กู้คืน "${user.username}" แล้ว`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to restore user");
    } finally { setRestoringId(null); }
  };

  const handlePermDelete = async () => {
    if (!permDeleteTarget) return;
    if (isUserActionLocked(permDeleteTarget)) {
      toast.error("ไม่สามารถจัดการผู้ใช้ที่มี role สูงกว่าของคุณได้");
      closeModal();
      return;
    }

    setIsPermDeleting(true);
    try {
      await del(`/users/${permDeleteTarget.id}/permanent`);
      setDeletedUsers((prev) => prev.filter((u) => u.id !== permDeleteTarget.id));
      closeModal();
      toast.success(`ลบถาวร "${permDeleteTarget.username}" แล้ว`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to permanently delete");
    } finally { setIsPermDeleting(false); }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    if (isUserActionLocked(deleteTarget)) {
      toast.error("ไม่สามารถจัดการผู้ใช้ที่มี role สูงกว่าของคุณได้");
      closeModal();
      return;
    }

    setIsDeleting(true);
    try {
      await del(`/users/${deleteTarget.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      closeModal();
      toast.success(`ลบ "${deleteTarget.username}" แล้ว`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (user: UserRecord) => {
    if (isUserActionLocked(user)) {
      toast.error("ไม่สามารถจัดการผู้ใช้ที่มี role สูงกว่าของคุณได้");
      closeModal();
      return;
    }

    if (togglingId !== null) return;
    setTogglingId(user.id);
    try {
      await patch(`/users/${user.id}/status`, {});
      setUsers((prev) =>
        prev.map((u) => u.id === user.id ? { ...u, isActive: !u.isActive } : u)
      );
      closeModal();
      toast.success(`${user.isActive ? "ระงับ" : "เปิดใช้งาน"} "${user.username}" แล้ว`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setTogglingId(null);
    }
  };

  const hasActiveFilters = Object.values(filters).some((value) => value !== "all") || Boolean(search.trim());

  const clearFilters = () => {
    setSearch("");
    setFilters({
      status: "all",
      online: "all",
      approval: "all",
      verification: "all",
      role: "all",
    });
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((current) => current === "asc" ? "desc" : "asc");
      return;
    }

    setSortBy(field);
    setSortOrder("asc");
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) {
      return (
        <span className="flex flex-col opacity-30">
          <ArrowUp className="-mb-0.5 h-2.5 w-2.5" />
          <ArrowDown className="h-2.5 w-2.5" />
        </span>
      );
    }

    return sortOrder === "asc"
      ? <ArrowUp className="h-3 w-3 text-light-primary dark:text-dark-primary" />
      : <ArrowDown className="h-3 w-3 text-light-primary dark:text-dark-primary" />;
  };

  return (
    <section className="grid gap-5">
      <div className="rounded-xl border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-light-primary text-white shadow-sm dark:bg-dark-primary dark:text-dark-background">
              <Users className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                Admin Console
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">Users</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                จัดการรายชื่อผู้ใช้งาน บทบาท และสถานะบัญชี
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">

            {canCreate && (
              <button
                className="inline-flex items-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
                type="button"
                onClick={() => openModal("create")}
              >
                <UserPlus className="h-4 w-4" />
                Add user
              </button>
            )}
            {(canUpdate || canDelete) && (
              <button
                className="inline-flex items-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-red-50 hover:text-red-600 dark:text-dark-text dark:hover:bg-red-900/20 dark:hover:text-red-400"
                type="button"
                onClick={handleShowDeleted}
              >
                <Trash className="h-4 w-4" />
                กู้คืนบัญชี
              </button>
            )}
            <button
              className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
              type="button"
              onClick={() => void fetchUsers()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Total users" value={stats.total} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Active" value={stats.active} tone="success" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Online" value={stats.online} tone="success" icon={<Shield className="h-5 w-5" />} />
        <StatCard label="Pending" value={stats.pending} tone="warning" icon={<AlertCircle className="h-5 w-5" />} />
      </div>

      <article className="rounded-lg border border-theme bg-light-background-card p-4 shadow-soft dark:bg-dark-background-card">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_repeat(5,1fr)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-text-muted dark:text-dark-text-muted" />
            <input
              className="w-full rounded-md border border-theme bg-light-background py-2 pl-9 pr-3 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary"
              placeholder="ค้นหา username, email, role, department..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <select
            className={filterClass}
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as StatusFilter }))}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <select
            className={filterClass}
            value={filters.online}
            onChange={(event) => setFilters((current) => ({ ...current, online: event.target.value as OnlineFilter }))}
          >
            {onlineOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <select
            className={filterClass}
            value={filters.approval}
            onChange={(event) => setFilters((current) => ({ ...current, approval: event.target.value as ApprovalFilter }))}
          >
            {approvalOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <select
            className={filterClass}
            value={filters.verification}
            onChange={(event) => setFilters((current) => ({ ...current, verification: event.target.value as VerificationFilter }))}
          >
            {verificationOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <select
            className={filterClass}
            value={filters.role}
            onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value }))}
          >
            <option value="all">All roles</option>
            {availableRoles.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex items-center justify-between border-t border-theme pt-3">
            <span className="text-xs text-light-text-muted dark:text-dark-text-muted">
              Showing {sortedUsers.length.toLocaleString()} of {users.length.toLocaleString()} users
            </span>
            <button
              className="rounded-md px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              type="button"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>
        )}
      </article>

      <article className="overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-soft dark:bg-dark-background-card">
        {error && (
          <div className="flex items-center gap-3 border-b border-theme p-5 text-sm text-red-600 dark:text-red-300">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid min-h-56 place-items-center text-light-text-muted dark:text-dark-text-muted">
            <div className="inline-flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading users...
            </div>
          </div>
        ) : sortedUsers.length === 0 ? (
          <div className="grid min-h-56 place-items-center text-center text-light-text-muted dark:text-dark-text-muted">
            <div>
              <Users className="mx-auto h-9 w-9 opacity-40" />
              <p className="mt-2 text-sm">No users found</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
              <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                <tr>
                  <SortableTh field="username" onSort={handleSort} sortIcon={<SortIcon field="username" />}>User</SortableTh>
                  <SortableTh field="email" onSort={handleSort} sortIcon={<SortIcon field="email" />}>Contact</SortableTh>
                  <SortableTh field="groupName" onSort={handleSort} sortIcon={<SortIcon field="groupName" />}>Group</SortableTh>
                  <SortableTh field="roles" onSort={handleSort} sortIcon={<SortIcon field="roles" />}>Roles</SortableTh>
                  <SortableTh field="status" onSort={handleSort} sortIcon={<SortIcon field="status" />}>Status</SortableTh>
                  <SortableTh field="lastLogin" onSort={handleSort} sortIcon={<SortIcon field="lastLogin" />}>Last login</SortableTh>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                {paginatedUsers.map((item) => {
                  const actionLocked = isUserActionLocked(item);
                  const actionLockedTitle = actionLocked
                    ? "ไม่สามารถจัดการผู้ใช้ที่มี role สูงกว่าของคุณได้"
                    : undefined;

                  return (
                  <tr className="transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10" key={item.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.profile.avatarUrl ? (
                          <img
                            alt={item.username}
                            className="h-10 w-10 rounded-full object-cover ring-1 ring-light-border dark:ring-dark-border"
                            src={item.profile.avatarUrl}
                          />
                        ) : (
                          <div className="grid h-10 w-10 place-items-center rounded-full bg-light-primary/15 text-sm font-bold text-light-primary dark:bg-dark-primary/15 dark:text-dark-primary">
                            {getInitials(item)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-light-text dark:text-dark-text">{item.username}</p>
                          <p className="truncate text-xs text-light-text-muted dark:text-dark-text-muted">{getDisplayName(item)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-64 truncate text-light-text dark:text-dark-text">{item.email}</p>
                      <p className="text-xs text-light-text-muted dark:text-dark-text-muted">{item.profile.phoneNumber || "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                      <p>{item.groupName || "-"}</p>
                      <p className="text-xs">{item.profile.department || ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-64 flex-wrap gap-1.5">
                        {item.roles.length > 0 ? item.roles.map((role) => (
                          <span
                            className="rounded-md bg-light-primary/10 px-2 py-1 text-xs font-semibold text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary"
                            key={role}
                          >
                            {role}
                          </span>
                        )) : (
                          <span className="text-xs text-light-text-muted dark:text-dark-text-muted">No role</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        <StatusBadge active={item.isActive} />
                        {item.isOnline && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Online
                          </span>
                        )}
                        {!item.isApproved && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                            <AlertCircle className="h-3 w-3" />
                            Pending
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                      {formatDateTime(item.lastLogin)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button className={actionButtonClass} disabled={!canUpdate || actionLocked} onClick={() => openModal("edit", item.id)} title={actionLockedTitle ?? "Edit"} type="button">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {canImpersonate && (
                          <button className={actionButtonClass} disabled={actionLocked} onClick={() => openModal("impersonate", item.id)} title={actionLockedTitle ?? "Impersonate"} type="button">
                            <ArrowRightLeft className="h-4 w-4" />
                          </button>
                        )}
                        <button className={actionButtonClass} disabled={!canUpdate || actionLocked} onClick={() => openModal("roles", item.id)} title={actionLockedTitle ?? "Manage roles"} type="button">
                          <Shield className="h-4 w-4" />
                        </button>
                        <button
                          className={`${actionButtonClass} ${item.isActive ? "hover:border-amber-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/20 dark:hover:text-amber-400" : "hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"}`}
                          disabled={!canUpdate || actionLocked || togglingId === item.id}
                          onClick={() => openModal("status", item.id)}
                          title={actionLockedTitle ?? (item.isActive ? "ระงับบัญชี" : "เปิดใช้งานบัญชี")}
                          type="button"
                        >
                          {togglingId === item.id
                            ? <RefreshCw className="h-4 w-4 animate-spin" />
                            : item.isActive
                              ? <Lock className="h-4 w-4" />
                              : <LockOpen className="h-4 w-4" />}
                        </button>
                        <button
                          className={`${actionButtonClass} hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400`}
                          disabled={!canDelete || actionLocked}
                          onClick={() => openModal("delete", item.id)}
                          title={actionLockedTitle ?? "Delete"}
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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

      {createOpen && (
        <ModalCreateUser
          onClose={closeModal}
          onCreated={() => void fetchUsers()}
        />
      )}

      {/* Deleted Users Panel */}
      {showDeleted && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="flex w-full max-w-3xl flex-col rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card" style={{ maxHeight: "80vh" }}>
            <div className="flex items-center justify-between border-b border-theme px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-light-text dark:text-dark-text">บัญชีที่ถูกลบ</h2>
                <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">{deletedUsers.length} รายการ — กู้คืนหรือลบถาวรได้</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => void loadDeletedUsers()} disabled={deletedLoading}
                  className="grid h-8 w-8 place-items-center rounded-md border border-theme text-light-text-muted hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary">
                  <RefreshCw className={`h-4 w-4 ${deletedLoading ? "animate-spin" : ""}`} />
                </button>
                <button type="button" onClick={closeModal}
                  className="grid h-8 w-8 place-items-center rounded-md border border-theme text-light-text-muted hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary">
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {deletedLoading ? (
                <div className="grid min-h-40 place-items-center text-light-text-muted dark:text-dark-text-muted">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                </div>
              ) : deletedUsers.length === 0 ? (
                <div className="grid min-h-40 place-items-center text-center text-sm text-light-text-muted dark:text-dark-text-muted">
                  ไม่มีบัญชีที่ถูกลบ
                </div>
              ) : (
                <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
                  <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">User</th>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold">ลบเมื่อ</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                    {deletedUsers.map((user) => {
                      const actionLocked = isUserActionLocked(user);
                      const actionLockedTitle = actionLocked
                        ? "ไม่สามารถจัดการผู้ใช้ที่มี role สูงกว่าของคุณได้"
                        : undefined;

                      return (
                      <tr key={user.id} className="hover:bg-light-primary/5 dark:hover:bg-dark-primary/10">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-light-text dark:text-dark-text">{user.username}</p>
                          <p className="text-xs text-light-text-muted dark:text-dark-text-muted">{user.email}</p>
                        </td>
                        <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                          {user.roles.join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                          {formatDateTime(user.deletedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            {canUpdate && (
                              <button type="button" title={actionLockedTitle ?? "กู้คืน"}
                                disabled={actionLocked || restoringId === user.id}
                                onClick={() => void handleRestoreUser(user)}
                                className="grid h-8 w-8 place-items-center rounded-md border border-theme text-light-text-muted transition-colors hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50 dark:text-dark-text-muted dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400">
                                {restoringId === user.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                              </button>
                            )}
                            {canDelete && (
                              <button type="button" title={actionLockedTitle ?? "ลบถาวร"}
                                disabled={actionLocked}
                                onClick={() => openModal("permanent-delete", user.id)}
                                className="grid h-8 w-8 place-items-center rounded-md border border-theme text-light-text-muted transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-dark-text-muted dark:hover:bg-red-900/20 dark:hover:text-red-400">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirm */}
      {permDeleteTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">
            <div className="flex items-center gap-4 p-6 pb-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-light-text dark:text-dark-text">ลบถาวร</h3>
                <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">ลบออกจากระบบถาวร ไม่สามารถกู้คืนได้</p>
              </div>
            </div>
            <div className="mx-6 mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-light-text-muted dark:text-dark-text-muted">ลบถาวร:</p>
              <p className="mt-1 text-base font-bold text-red-700 dark:text-red-400">{permDeleteTarget.username}</p>
            </div>
            <div className="flex gap-3 border-t border-theme px-6 py-4">
              <button type="button" onClick={closeModal} disabled={isPermDeleting}
                className="flex-1 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text hover:bg-light-primary/10 disabled:opacity-50 dark:text-dark-text dark:hover:bg-dark-primary/10">
                ยกเลิก
              </button>
              <button type="button" onClick={() => void handlePermDelete()} disabled={isPermDeleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {isPermDeleting && <RefreshCw className="h-4 w-4 animate-spin" />}
                ลบถาวร
              </button>
            </div>
          </div>
        </div>
      )}

      {impersonateTarget && !isUserActionLocked(impersonateTarget) && (
        <ModalImpersonate
          userId={impersonateTarget.id}
          username={impersonateTarget.username}
          avatarUrl={impersonateTarget.profile.avatarUrl}
          onClose={closeModal}
        />
      )}

      {editTarget && !isUserActionLocked(editTarget) && (
        <ModalEditUser
          userId={editTarget.id}
          username={editTarget.username}
          onClose={closeModal}
          onSaved={() => void fetchUsers()}
        />
      )}

      {rolesTarget && !isUserActionLocked(rolesTarget) && (
        <ModalManageRoles
          userId={rolesTarget.id}
          username={rolesTarget.username}
          onClose={closeModal}
          onSaved={() => void fetchUsers()}
        />
      )}

      {deleteTarget && !isUserActionLocked(deleteTarget) && (
        <ModalDeleteUser
          username={deleteTarget.username}
          loading={isDeleting}
          onClose={closeModal}
          onConfirm={() => void handleDeleteUser()}
        />
      )}

      {statusTarget && !isUserActionLocked(statusTarget) && (
        <ModalToggleStatus
          username={statusTarget.username}
          isActive={statusTarget.isActive}
          loading={togglingId === statusTarget.id}
          onClose={closeModal}
          onConfirm={() => void handleToggleStatus(statusTarget)}
        />
      )}

      {sortedUsers.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={sortedUsers.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
        />
      )}
    </section>
  );
};

const SortableTh = ({
  children,
  field,
  onSort,
  sortIcon,
}: {
  children: ReactNode;
  field: SortField;
  onSort: (field: SortField) => void;
  sortIcon: ReactNode;
}) => (
  <th
    className="px-4 py-3 font-semibold transition-colors hover:bg-light-primary/10 dark:hover:bg-dark-primary/10"
    onClick={() => onSort(field)}
  >
    <button className="flex items-center gap-2 uppercase" type="button">
      {children}
      {sortIcon}
    </button>
  </th>
);

const StatusBadge = ({ active }: { active: boolean }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${active
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : "bg-red-500/10 text-red-700 dark:text-red-300"
      }`}
  >
    {active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
    {active ? "Active" : "Inactive"}
  </span>
);

export default UserManagementPage;
