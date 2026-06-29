import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, ChevronDown, RefreshCw, Search, UserPlus, Users, XCircle } from "lucide-react";
import { toast } from "react-toastify";
import { useApi } from "@/hooks/useApi";

type LdapDepartmentUser = {
  username: string;
  displayName: string;
  email: string;
  department: string;
  dn: string;
  externalId: string;
  imported: boolean;
  importedUserId: number | null;
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
  onImported?: () => void | Promise<void>;
};

type LdapImportResponse = {
  success: boolean;
  message: string;
  data?: {
    id: number;
    username: string;
    email: string;
    imported: boolean;
    alreadyImported: boolean;
  };
};

const DEFAULT_DEPARTMENT_BASE_DN = "OU=ProDept,OU=ProFile,DC=profile,DC=co,DC=th";

const inputClass = "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";
const iconButtonClass = "grid h-8 w-8 place-items-center rounded-md border border-theme text-light-text-muted hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary";

const ModalLdapDepartments = ({ onClose, onImported }: ModalLdapDepartmentsProps) => {
  const { post } = useApi();
  const [departments, setDepartments] = useState<LdapDepartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [keyword, setKeyword] = useState("");
  const [expandedDepartments, setExpandedDepartments] = useState<string[]>([]);
  const [importingDn, setImportingDn] = useState("");

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
      const response = await post<LdapDepartmentsResponse>("/users/ldap/departments", { baseDn: DEFAULT_DEPARTMENT_BASE_DN });
      setDepartments(response.data.data?.departments ?? []);
      setExpandedDepartments([]);
      setMessage(response.data.message);
      if (!response.data.success) toast.error(response.data.message);
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

  const toggleDepartment = (dn: string) => {
    setExpandedDepartments((previous) =>
      previous.includes(dn)
        ? previous.filter((item) => item !== dn)
        : [...previous, dn],
    );
  };

  const importUser = async (user: LdapDepartmentUser) => {
    if (user.imported || importingDn) return;

    setImportingDn(user.dn);
    try {
      const response = await post<LdapImportResponse>("/users/ldap/import", {
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        department: user.department,
        dn: user.dn,
        externalId: user.externalId,
      });

      if (!response.data.success) {
        toast.error(response.data.message);
        return;
      }

      setDepartments((previous) => previous.map((department) => ({
        ...department,
        users: department.users.map((item) =>
          item.dn === user.dn
            ? { ...item, imported: true, importedUserId: response.data.data?.id ?? item.importedUserId }
          : item,
        ),
      })));
      await onImported?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cannot import LDAP user");
    } finally {
      setImportingDn("");
    }
  };

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

        <div className="grid gap-3 border-b border-theme p-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <label className="mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-text-muted dark:text-dark-text-muted" />
              <input className={`${inputClass} pl-9`} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="ค้นหาแผนก, username, email..." />
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
              {filteredDepartments.map((department) => {
                const expanded = expandedDepartments.includes(department.dn);

                return (
                  <section key={department.dn} className="overflow-hidden rounded-lg border border-theme bg-light-background dark:bg-dark-background">
                    <button
                      type="button"
                      onClick={() => toggleDepartment(department.dn)}
                      className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <h3 className="truncate text-sm font-semibold text-light-text dark:text-dark-text">{department.name}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-light-primary/10 px-2.5 py-1 text-xs font-semibold text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                          <Users className="h-3.5 w-3.5" />
                          {department.users.length} users
                        </span>
                        <ChevronDown className={`h-4 w-4 text-light-text-muted transition-transform dark:text-dark-text-muted ${expanded ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    {expanded && (
                      department.users.length === 0 ? (
                        <div className="border-t border-theme px-4 py-5 text-sm text-light-text-muted dark:text-dark-text-muted">ไม่มี user ในแผนกนี้</div>
                      ) : (
                        <div className="divide-y divide-light-border-light border-t border-theme dark:divide-dark-border-light">
                          {department.users.map((user) => {
                            const imported = user.imported;
                            const importing = importingDn === user.dn;

                            return (
                            <div key={user.dn} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1fr_1fr_auto] md:items-center">
                              <div>
                                <p className="font-semibold text-light-text dark:text-dark-text">{user.username || "-"}</p>
                                <p className="text-xs text-light-text-muted dark:text-dark-text-muted">{user.displayName || "-"}</p>
                              </div>
                              <div className="text-light-text-muted dark:text-dark-text-muted">{user.email || "-"}</div>
                              <button
                                type="button"
                                onClick={() => void importUser(user)}
                                disabled={imported || Boolean(importingDn)}
                                className="inline-flex items-center justify-center gap-2 rounded-md border border-theme px-3 py-2 text-xs font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary disabled:cursor-default disabled:border-emerald-200 disabled:bg-emerald-50 disabled:text-emerald-700 dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary dark:disabled:border-emerald-500/30 dark:disabled:bg-emerald-500/10 dark:disabled:text-emerald-300"
                              >
                                {imported ? <CheckCircle2 className="h-4 w-4" /> : importing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                {imported ? "นำเข้าแล้ว" : importing ? "กำลังนำเข้า" : "นำเข้าระบบ"}
                              </button>
                            </div>
                            );
                          })}
                        </div>
                      )
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalLdapDepartments;
