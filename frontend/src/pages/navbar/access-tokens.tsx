import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { AlertCircle, Check, Copy, KeyRound, Plus, RefreshCw, ShieldOff, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/contexts/SessionContext";
import { useRegional } from "@/contexts/RegionalContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TokenItem {
  id: number;
  name: string;
  token_prefix: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface TokensResponse { success: boolean; data: TokenItem[] }
interface CreateTokenResponse { success: boolean; data: TokenItem & { token: string } }

// ─── Helpers ──────────────────────────────────────────────────────────────────

// fmt ใช้จาก useRegional — ดู AccessTokensPage

const isExpired = (t: TokenItem) => Boolean(t.expires_at && new Date(t.expires_at) < new Date());

const statusOf = (t: TokenItem) => {
  if (t.revoked_at) return { label: "Revoked", cls: "bg-red-500/10 text-red-600 dark:text-red-400" };
  if (isExpired(t)) return { label: "Expired", cls: "bg-light-text-muted/10 text-light-text-muted dark:text-dark-text-muted" };
  return { label: "Active", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
};

const inputClass =
  "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";
const labelClass = "mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted";

// ─── Token Reveal (แสดงครั้งเดียว) ────────────────────────────────────────────

const TokenReveal = ({ token, onClose }: { token: string; onClose: () => void }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">
        <div className="flex items-start gap-3 p-6">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-light-text dark:text-dark-text">Token สร้างสำเร็จแล้ว</h2>
            <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
              คัดลอก token นี้ไว้ตอนนี้เลย — จะ<strong>ไม่แสดงอีกครั้ง</strong>
            </p>
          </div>
        </div>

        <div className="mx-6 mb-4 flex items-center gap-2 overflow-hidden rounded-lg border border-theme bg-light-background px-3 py-2.5 dark:bg-dark-background">
          <code className="flex-1 truncate font-mono text-xs text-light-text dark:text-dark-text">{token}</code>
          <button type="button" onClick={() => void copy()}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary">
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        <p className="mx-6 mb-4 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          ใช้ใน Header: <code className="font-mono">Authorization: Bearer {token.slice(0, 20)}...</code>
        </p>

        <div className="flex justify-end border-t border-theme px-6 py-4">
          <button type="button" onClick={onClose}
            className="rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white hover:bg-light-primary-hover dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover">
            รับทราบ — ฉันบันทึกแล้ว
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ─── Create Form ──────────────────────────────────────────────────────────────

const CreateForm = ({ onClose, onCreated }: { onClose: () => void; onCreated: (token: string) => void }) => {
  const { post } = useApi();
  const [form, setForm] = useState({ name: "", expiresAt: "" });
  const [busy, setBusy] = useState(false);

  const setExpiry = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setForm((p) => ({ ...p, expiresAt: d.toISOString().slice(0, 10) }));
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("กรุณาตั้งชื่อ token"); return; }
    setBusy(true);
    try {
      const res = await post<CreateTokenResponse>("/personal-access-tokens", {
        name: form.name.trim(),
        expiresAt: form.expiresAt || null,
      });
      onClose();
      onCreated(res.data.data.token);
    } catch { toast.error("Failed to create token"); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">
        <div className="flex items-center justify-between border-b border-theme px-5 py-4">
          <h2 className="text-base font-semibold text-light-text dark:text-dark-text">สร้าง Personal Access Token</h2>
          <button type="button" onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-light-text-muted hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-5">
          <div>
            <label className={labelClass}>ชื่อ Token *</label>
            <input className={inputClass} placeholder="เช่น CI/CD Pipeline, Postman" autoFocus
              value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>

          <div>
            <label className={labelClass}>
              วันหมดอายุ <span className="font-normal">(ไม่เลือก = ไม่หมดอายุ)</span>
            </label>
            <input className={inputClass} type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={form.expiresAt}
              onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))} />
            <div className="mt-2 flex gap-2">
              {[{ label: "30 วัน", days: 30 }, { label: "90 วัน", days: 90 }, { label: "1 ปี", days: 365 }].map(({ label, days }) => (
                <button key={label} type="button" onClick={() => setExpiry(days)}
                  className="rounded-md border border-theme px-2.5 py-1 text-xs font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary">
                  {label}
                </button>
              ))}
              {form.expiresAt && (
                <button type="button" onClick={() => setForm((p) => ({ ...p, expiresAt: "" }))}
                  className="ml-auto text-xs text-light-text-muted hover:text-red-500 dark:text-dark-text-muted dark:hover:text-red-400">
                  ล้าง
                </button>
              )}
            </div>
          </div>

          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            Token จะถูกแสดงครั้งเดียวหลังสร้าง — คัดลอกเก็บไว้ให้ดี
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-theme px-5 py-4">
          <button type="button" onClick={onClose}
            className="rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10">
            ยกเลิก
          </button>
          <button type="button" onClick={() => void handleCreate()} disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover">
            {busy && <RefreshCw className="h-4 w-4 animate-spin" />}
            สร้าง Token
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const AccessTokensPage = () => {
  const { get, post, del } = useApi();
  const { user } = useSession();
  const { formatDateTime: fmt } = useRegional();
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];
  const isSuperAdmin = roles.includes("SUPERADMIN");
  const hasPermission = (permission: string) => isSuperAdmin || permissions.includes(permission);
  const canCreateToken = hasPermission("access-tokens.create");
  const canRevokeToken = hasPermission("access-tokens.revoke");
  const canDeleteToken = hasPermission("access-tokens.delete");

  const load = async () => {
    setIsLoading(true); setError(null);
    try {
      const res = await get<TokensResponse>("/personal-access-tokens");
      setTokens(res.data.data ?? []);
    } catch { setError("Unable to load tokens"); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const handleRevoke = async (t: TokenItem) => {
    if (!canRevokeToken) {
      toast.error("คุณไม่มีสิทธิ์ revoke token");
      return;
    }

    setBusyId(t.id);
    try {
      await post(`/personal-access-tokens/${t.id}/revoke`, {});
      toast.success(`Revoke "${t.name}" แล้ว`);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke");
    } finally { setBusyId(null); }
  };

  const handleDelete = async (t: TokenItem) => {
    if (!canDeleteToken) {
      toast.error("คุณไม่มีสิทธิ์ลบ token");
      return;
    }

    setBusyId(t.id);
    try {
      await del(`/personal-access-tokens/${t.id}`);
      toast.success(`ลบ "${t.name}" แล้ว`);
      await load();
    } catch { toast.error("Failed to delete"); }
    finally { setBusyId(null); }
  };

  return (
    <section className="grid gap-5">
      {/* Header */}
      <div className="rounded-xl border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-light-primary to-light-primary-hover text-white shadow-sm dark:from-dark-primary dark:to-dark-primary-hover dark:text-dark-background">
              <KeyRound size={26} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                บัญชีของฉัน
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">Personal Access Tokens</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                ใช้ใน API Header:{" "}
                <code className="rounded bg-light-primary/10 px-1 text-xs text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                  Authorization: Bearer pat_...
                </code>
              </p>
            </div>
          </div>
          {canCreateToken && (
            <button type="button" onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover">
              <Plus className="h-4 w-4" />สร้าง Token
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <article className="overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-soft dark:bg-dark-background-card">
        {error && (
          <div className="flex items-center gap-3 p-5 text-sm text-red-600 dark:text-red-300">
            <AlertCircle className="h-5 w-5" />{error}
          </div>
        )}
        {isLoading ? (
          <div className="grid min-h-48 place-items-center text-light-text-muted dark:text-dark-text-muted">
            Loading...
          </div>
        ) : tokens.length === 0 ? (
          <div className="grid min-h-48 place-items-center gap-2 text-center text-light-text-muted dark:text-dark-text-muted">
            <KeyRound className="mx-auto h-8 w-8 opacity-30" />
            <p className="text-sm">
              {canCreateToken ? 'ยังไม่มี token — กด "สร้าง Token" เพื่อเริ่มต้น' : "ยังไม่มี token"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
              <thead className="bg-light-primary/10 text-left text-xs uppercase tracking-wider text-light-text-muted dark:bg-dark-primary/10 dark:text-dark-text-muted">
                <tr>
                  {["ชื่อ", "Token Prefix", "สร้างเมื่อ", "หมดอายุ", "ใช้ล่าสุด", "สถานะ", ""].map((h) => (
                    <th key={h} className={`px-4 py-3 font-semibold ${!h ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border-light text-sm dark:divide-dark-border-light">
                {tokens.map((t) => {
                  const status = statusOf(t);
                  const busy = busyId === t.id;
                  const active = !t.revoked_at && !isExpired(t);
                  const hasRowActions = (active && canRevokeToken) || canDeleteToken;
                  return (
                    <tr key={t.id} className="transition-colors hover:bg-light-primary/5 dark:hover:bg-dark-primary/10">
                      <td className="px-4 py-3 font-medium text-light-text dark:text-dark-text">{t.name}</td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-light-primary/10 px-2 py-0.5 font-mono text-xs text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                          {t.token_prefix}...
                        </code>
                      </td>
                      <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{fmt(t.created_at)}</td>
                      <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{fmt(t.expires_at)}</td>
                      <td className="px-4 py-3 text-light-text-muted dark:text-dark-text-muted">{fmt(t.last_used_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {!hasRowActions && (
                            <span className="text-sm text-light-text-muted dark:text-dark-text-muted">—</span>
                          )}
                          {active && canRevokeToken && (
                            <button type="button" title="Revoke" onClick={() => void handleRevoke(t)} disabled={busy}
                              className="grid h-8 w-8 place-items-center rounded-md border border-theme text-light-text-muted transition-colors hover:border-amber-400 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50 dark:text-dark-text-muted dark:hover:bg-amber-900/20 dark:hover:text-amber-400">
                              {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                            </button>
                          )}
                          {canDeleteToken && (
                            <button type="button" title="Delete" onClick={() => void handleDelete(t)} disabled={busy}
                              className="grid h-8 w-8 place-items-center rounded-md border border-theme text-light-text-muted transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-dark-text-muted dark:hover:bg-red-900/20 dark:hover:text-red-400">
                              {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
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

      {createOpen && (
        <CreateForm
          onClose={() => setCreateOpen(false)}
          onCreated={(token) => { setNewToken(token); void load(); }}
        />
      )}
      {newToken && <TokenReveal token={newToken} onClose={() => setNewToken(null)} />}
    </section>
  );
};

export default AccessTokensPage;
