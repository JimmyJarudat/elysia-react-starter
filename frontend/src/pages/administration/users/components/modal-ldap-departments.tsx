import { useEffect, useMemo, useState } from "react";
import { Building2, RefreshCw, Search, Users, XCircle } from "lucide-react";
import { toast } from "react-toastify";
import { useApi } from "@/hooks/useApi";

type LdapDepartmentUser = {
  username: string;
  displayName: string;
  email: string;
  department: string;
  dn: string;
};

type LdapDepartment = {
  name: string;
  dn: string;
  description: string;
  users: LdapDepartmentUser[];
};

type LdapDepartmentsResponse = {
  success: boolean;
  message: string;
  data: {
    baseDn: string;
    departments: LdapDepartment[];
  };
};

type ModalLdapDepartmentsProps = {
  onClose: () => void;
};

const DEFAULT_DEPARTMENT_BASE_DN = "OU=ProDept,OU=ProFile,DC=profile,DC=co,DC=th";

const inputClass = "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";
const iconButtonClass = "grid h-8 w-8 place-items-center rounded-md border border-theme text-light-text-muted hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary";

const ModalLdapDepartments = ({ onClose }: ModalLdapDepartmentsProps) => {
  const { post } = useApi();
  const [baseDn, setBaseDn] = useState(DEFAULT_DEPARTMENT_BASE_DN);
  const [departments, setDepartments] = useState<LdapDepartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [keyword, setKeyword] = useState("");

  const totalUsers = useMemo(
    () => departments.reduce((total, department) => total + department.users.length, 0),
    [departments],
  );

  const filteredDepartments = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return departments;

    return departments
      .map((department) => ({
        ...department,
        users: department.users.filter((user) => [
          department.name,
          user.username,
          user.displayName,
          user.email,
          user.department,
          user.dn,
        ].some((value) => value?.toLowerCase().includes(q))),
      }))
      .filter((department) => department.name.toLowerCase().includes(q) || department.users.length > 0);
  }, [departments, keyword]);

  const loadDepartments = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await post<LdapDepartmentsResponse>("/users/ldap/departments", { baseDn: baseDn.trim() });
      setDepartments(response.data.data?.departments ?? []);
      setMessage(response.data.message);
      response.data.success ? toast.success(response.data.message) : toast.error(response.data.message);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Cannot load LDAP departments";
      setMessage(nextMessage);
      toast.error(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDepartments();
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="flex w-full max-w-5xl flex-col rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card" style={{ maxHeight: "86vh" }}>
        <div className="flex items-center justify-between border-b border-theme px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-light-text dark:text-dark-text">LDAP Departments</h2>
              <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">
                {departments.length} แผนก / {totalUsers} users
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void loadDepartments()} disabled={loading} className={iconButtonClass}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button type="button" onClick={onClose} className={iconButtonClass}>
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-3 border-b border-theme p-4 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)_auto]">
          <div>
            <label className="mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">Department Base DN</label>
            <input className={inputClass} value={baseDn} onChange={(event) => setBaseDn(event.target.value)} disabled={loading} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-text-muted dark:text-dark-text-muted" />
              <input className={`${inputClass} pl-9`} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="department, username, email..." />
            </div>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void loadDepartments()}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-light-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Load
            </button>
          </div>
        </div>

        {message && (
          <div className="border-b border-theme px-5 py-3 text-sm text-light-text-muted dark:text-dark-text-muted">
            {message}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="grid min-h-56 place-items-center text-light-text-muted dark:text-dark-text-muted">
              <RefreshCw className="h-5 w-5 animate-spin" />
            </div>
          ) : filteredDepartments.length === 0 ? (
            <div className="grid min-h-56 place-items-center text-center text-sm text-light-text-muted dark:text-dark-text-muted">
              <div>
                <Building2 className="mx-auto h-9 w-9 opacity-40" />
                <p className="mt-2">ไม่พบแผนกหรือ user จาก LDAP</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredDepartments.map((department) => (
                <section key={department.dn} className="overflow-hidden rounded-lg border border-theme bg-light-background dark:bg-dark-background">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-theme px-4 py-3">
                    <div>
                      <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">{department.name}</h3>
                      <p className="mt-0.5 break-all text-xs text-light-text-muted dark:text-dark-text-muted">{department.dn}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-light-primary/10 px-2.5 py-1 text-xs font-semibold text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                      <Users className="h-3.5 w-3.5" />
                      {department.users.length} users
                    </span>
                  </div>
                  {department.users.length === 0 ? (
                    <div className="px-4 py-5 text-sm text-light-text-muted dark:text-dark-text-muted">ไม่มี user ในแผนกนี้</div>
                  ) : (
                    <div className="divide-y divide-light-border-light dark:divide-dark-border-light">
                      {department.users.map((user) => (
                        <div key={user.dn} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_1fr_1.5fr]">
                          <div>
                            <p className="font-semibold text-light-text dark:text-dark-text">{user.username || "-"}</p>
                            <p className="text-xs text-light-text-muted dark:text-dark-text-muted">{user.displayName || "-"}</p>
                          </div>
                          <div className="text-light-text-muted dark:text-dark-text-muted">{user.email || "-"}</div>
                          <div className="break-all text-xs text-light-text-muted dark:text-dark-text-muted">{user.dn}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalLdapDepartments;
