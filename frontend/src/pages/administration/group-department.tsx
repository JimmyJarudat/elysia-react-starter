import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, Building2, Layers3, Pencil, Plus, RefreshCw, Save, Search, Trash2, UsersRound, X } from "lucide-react";
import { toast } from "react-toastify";
import GuardedInput from "@/common/GuardedInput";
import { useApi } from "@/hooks/useApi";
import { useRegional } from "@/contexts/RegionalContext";

type ResourceType = "GROUPNAME" | "DEPARTMENT";

type ResourceItem = {
  id: string;
  name: string;
  label: string;
  description: string;
  updatedAt: string | null;
};

type ResourcesResponse = {
  success: boolean;
  data: {
    groups: ResourceItem[];
    departments: ResourceItem[];
  };
};

type ResourceForm = {
  mode: "create" | "edit";
  type: ResourceType;
  item?: ResourceItem;
  name: string;
  description: string;
};

const emptyData = { groups: [] as ResourceItem[], departments: [] as ResourceItem[] };
const inputClass = "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";

const GroupDepartmentPage = () => {
  const { get, post, put, del } = useApi();
  const { formatDateTime } = useRegional();
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<ResourceForm | null>(null);

  const loadResources = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await get<ResourcesResponse>("/system-setting/resources/manage");
      setData(response.data.data ?? emptyData);
    } catch (err) {
      setData(emptyData);
      setError(err instanceof Error ? err.message : "Cannot load group and department resources");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadResources();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;

    const matches = (item: ResourceItem) => [
      item.id,
      item.name,
      item.label,
      item.description,
    ].some((value) => value?.toLowerCase().includes(q));

    return {
      groups: data.groups.filter(matches),
      departments: data.departments.filter(matches),
    };
  }, [data, search]);

  const openCreate = (type: ResourceType) => {
    setForm({ mode: "create", type, name: "", description: "" });
  };

  const openEdit = (type: ResourceType, item: ResourceItem) => {
    setForm({ mode: "edit", type, item, name: item.name, description: item.description });
  };

  const saveResource = async () => {
    if (!form || !form.name.trim()) return;

    setSaving(true);
    try {
      const payload = {
        type: form.type,
        name: form.name.trim(),
        description: form.description.trim() || null,
      };

      if (form.mode === "create") {
        await post("/system-setting/resources", payload);
      } else if (form.item) {
        await put(`/system-setting/resources/${encodeURIComponent(form.item.id)}`, payload);
      }

      setForm(null);
      await loadResources();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cannot save resource");
    } finally {
      setSaving(false);
    }
  };

  const deleteResource = async (item: ResourceItem) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;

    setDeletingId(item.id);
    try {
      await del(`/system-setting/resources/${encodeURIComponent(item.id)}`);
      await loadResources();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cannot delete resource");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-theme bg-light-background-card shadow-soft dark:bg-dark-background-card">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-md bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
              <Layers3 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                Administration
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">Group & Department</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                จัดการ group name และแผนกที่ใช้กับบัญชีผู้ใช้
              </p>
            </div>
          </div>

          <button
            className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
            type="button"
            onClick={() => void loadResources()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <article className="rounded-lg border border-theme bg-light-background-card p-4 shadow-soft dark:bg-dark-background-card">
        <GuardedInput
          leadingIcon={<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-text-muted dark:text-dark-text-muted" />}
          className="w-full rounded-md border border-theme bg-light-background py-2 pl-9 pr-3 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary"
          placeholder="ค้นหา group หรือแผนก..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </article>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <ResourceSection
          title="Group names"
          subtitle="มาจาก domain ของอีเมล เช่น profile.co.th -> profile"
          icon={<UsersRound className="h-5 w-5" />}
          items={filtered.groups}
          loading={loading}
          deletingId={deletingId}
          formatDateTime={formatDateTime}
          onAdd={() => openCreate("GROUPNAME")}
          onEdit={(item) => openEdit("GROUPNAME", item)}
          onDelete={(item) => void deleteResource(item)}
        />
        <ResourceSection
          title="Departments"
          subtitle="มาจาก OU หรือ attribute department ใน LDAP"
          icon={<Building2 className="h-5 w-5" />}
          items={filtered.departments}
          loading={loading}
          deletingId={deletingId}
          formatDateTime={formatDateTime}
          onAdd={() => openCreate("DEPARTMENT")}
          onEdit={(item) => openEdit("DEPARTMENT", item)}
          onDelete={(item) => void deleteResource(item)}
        />
      </div>

      {form && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">
            <div className="flex items-center justify-between border-b border-theme px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-light-text dark:text-dark-text">
                  {form.mode === "create" ? "Add" : "Edit"} {form.type === "GROUPNAME" ? "Group name" : "Department"}
                </h2>
              </div>
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
                onClick={() => setForm(null)}
                disabled={saving}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">Name</label>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(event) => setForm((current) => current ? { ...current, name: event.target.value } : current)}
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">Description</label>
                <input
                  className={inputClass}
                  value={form.description}
                  onChange={(event) => setForm((current) => current ? { ...current, description: event.target.value } : current)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-theme px-5 py-4">
              <button
                type="button"
                className="rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 disabled:opacity-60 dark:text-dark-text dark:hover:bg-dark-primary/10"
                onClick={() => setForm(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
                onClick={() => void saveResource()}
                disabled={saving || !form.name.trim()}
              >
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const iconButtonClass = "grid h-8 w-8 place-items-center rounded-md border border-theme text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary disabled:cursor-not-allowed disabled:opacity-50 dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary";

const ResourceSection = ({
  title,
  subtitle,
  icon,
  items,
  loading,
  deletingId,
  formatDateTime,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  items: ResourceItem[];
  loading: boolean;
  deletingId: string;
  formatDateTime: (value?: string | null) => string;
  onAdd: () => void;
  onEdit: (item: ResourceItem) => void;
  onDelete: (item: ResourceItem) => void;
}) => (
  <article className="overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-soft dark:bg-dark-background-card">
    <div className="flex items-center justify-between gap-3 border-b border-theme px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-light-text dark:text-dark-text">{title}</h2>
          <p className="truncate text-xs text-light-text-muted dark:text-dark-text-muted">{subtitle}</p>
        </div>
      </div>
      <button type="button" className={iconButtonClass} onClick={onAdd}>
        <Plus className="h-4 w-4" />
      </button>
    </div>

    {loading ? (
      <div className="grid min-h-48 place-items-center text-light-text-muted dark:text-dark-text-muted">
        <RefreshCw className="h-5 w-5 animate-spin" />
      </div>
    ) : items.length === 0 ? (
      <div className="grid min-h-48 place-items-center text-center text-sm text-light-text-muted dark:text-dark-text-muted">
        ยังไม่มีข้อมูล
      </div>
    ) : (
      <div className="divide-y divide-light-border-light dark:divide-dark-border-light">
        {items.map((item) => (
          <div key={item.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <p className="truncate font-semibold text-light-text dark:text-dark-text">{item.name}</p>
              <p className="truncate text-xs text-light-text-muted dark:text-dark-text-muted">{item.id}</p>
              {item.description && (
                <p className="mt-1 truncate text-xs text-light-text-muted dark:text-dark-text-muted">{item.description}</p>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 md:justify-end">
              <span className="text-xs text-light-text-muted dark:text-dark-text-muted">{formatDateTime(item.updatedAt)}</span>
              <div className="flex gap-2">
                <button type="button" className={iconButtonClass} onClick={() => onEdit(item)}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={`${iconButtonClass} hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400`}
                  onClick={() => onDelete(item)}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </article>
);

export default GroupDepartmentPage;
