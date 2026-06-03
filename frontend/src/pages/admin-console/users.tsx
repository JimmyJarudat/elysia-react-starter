import { useEffect, useMemo, useState } from "react";
import { AlertCircle, RefreshCw, UserCheck, UserX, UsersRound } from "lucide-react";
import { useApi } from "@/hooks/useApi";

interface UserListItem {
  id: number;
  username: string;
  email: string;
  groupName: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  isApproved: boolean;
  lastLogin: string | null;
  createdAt: string;
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

interface UsersResponse {
  success: boolean;
  data: UserListItem[];
  message?: string;
}

const formatDate = (value: string | null) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const getDisplayName = (user: UserListItem) => {
  const fullName = [user.profile.firstName, user.profile.lastName].filter(Boolean).join(" ");
  return user.profile.displayName || fullName || user.username;
};

const UserManagementPage = () => {
  const { get } = useApi();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeCount = useMemo(() => users.filter((user) => user.isActive).length, [users]);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await get<UsersResponse>("/users");
      setUsers(response.data.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  return (
    <section className="grid gap-5">
      <div className="rounded-xl border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-light-primary to-light-primary-hover text-white shadow-sm dark:from-dark-primary dark:to-dark-primary-hover dark:text-dark-background">
              <UsersRound size={26} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                Admin Console
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">Users</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                จัดการผู้ใช้งานในระบบ
              </p>
            </div>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
            type="button"
            onClick={() => void loadUsers()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-sm text-light-text-muted dark:text-dark-text-muted">Total users</span>
              <strong className="mt-2 block text-3xl text-light-text dark:text-dark-text">{users.length}</strong>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
              <UsersRound className="h-5 w-5" />
            </div>
          </div>
        </article>
        <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-sm text-light-text-muted dark:text-dark-text-muted">Active</span>
              <strong className="mt-2 block text-3xl text-light-text dark:text-dark-text">{activeCount}</strong>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>
        </article>
        <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-sm text-light-text-muted dark:text-dark-text-muted">Inactive</span>
              <strong className="mt-2 block text-3xl text-light-text dark:text-dark-text">{users.length - activeCount}</strong>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-light-text-muted/10 text-light-text-muted dark:bg-dark-text-muted/10 dark:text-dark-text-muted">
              <UserX className="h-5 w-5" />
            </div>
          </div>
        </article>
      </div>

      <article className="overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-soft dark:bg-dark-background-card">
        {error ? (
          <div className="flex items-center gap-3 p-5 text-sm text-red-600 dark:text-red-300">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid min-h-48 place-items-center text-light-text-muted dark:text-dark-text-muted">
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="grid min-h-48 place-items-center gap-2 text-center text-light-text-muted dark:text-dark-text-muted">
            <UsersRound className="mx-auto h-8 w-8 text-light-primary dark:text-dark-primary" />
            <span>No users found</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
              <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Last login</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                {users.map((user) => (
                  <tr className="transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10" key={user.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {user.profile.avatarUrl ? (
                          <img
                            className="h-10 w-10 rounded-full object-cover"
                            src={user.profile.avatarUrl}
                            alt={getDisplayName(user)}
                          />
                        ) : (
                          <span className="grid h-10 w-10 place-items-center rounded-full bg-light-primary text-sm font-bold text-white dark:bg-dark-primary dark:text-dark-background">
                            {getDisplayName(user).charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-light-text dark:text-dark-text">
                            {getDisplayName(user)}
                          </span>
                          <span className="block truncate text-xs text-light-text-muted dark:text-dark-text-muted">
                            {user.email}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                      {user.roles.length ? user.roles.join(", ") : "-"}
                    </td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                      {user.profile.department || user.groupName || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${
                          user.isActive
                            ? "bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary"
                            : "bg-light-text-muted/10 text-light-text-muted dark:bg-dark-text-muted/10 dark:text-dark-text-muted"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                      {formatDate(user.lastLogin)}
                    </td>
                    <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">
                      {formatDate(user.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
};

export default UserManagementPage;
