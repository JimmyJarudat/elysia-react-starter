import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Bug,
  Circle,
  Cpu,
  Eraser,
  Eye,
  EyeOff,
  Network,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import StatCard from "@/common/StatCard";
import { apiConfig } from "@/config";
import { useRegional } from "@/contexts/RegionalContext";

type ConsoleLevel = "all" | "info" | "warn" | "error" | "debug";
type ConsoleSource = "all" | "request" | "auth" | "activity" | "audit" | "error" | "system";
type ViewMode = "compact" | "detailed";

interface ConsoleEvent {
  id: string;
  timestamp: string;
  level: Exclude<ConsoleLevel, "all">;
  source: Exclude<ConsoleSource, "all">;
  title: string;
  message: string;
  context: Record<string, unknown>;
}

const levelOptions: { label: string; value: ConsoleLevel }[] = [
  { label: "All levels", value: "all" },
  { label: "Info", value: "info" },
  { label: "Warn", value: "warn" },
  { label: "Error", value: "error" },
  { label: "Debug", value: "debug" },
];

const sourceOptions: { label: string; value: ConsoleSource }[] = [
  { label: "All sources", value: "all" },
  { label: "Request", value: "request" },
  { label: "Auth", value: "auth" },
  { label: "Activity", value: "activity" },
  { label: "Audit", value: "audit" },
  { label: "Error", value: "error" },
  { label: "System", value: "system" },
];

const levelClass: Record<ConsoleEvent["level"], string> = {
  info: "text-sky-700 dark:text-sky-300",
  warn: "text-amber-700 dark:text-amber-300",
  error: "text-red-700 dark:text-red-300",
  debug: "text-violet-700 dark:text-violet-300",
};

const levelBgClass: Record<ConsoleEvent["level"], string> = {
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  error: "bg-red-500/10 text-red-700 dark:text-red-300",
  debug: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

const sourceIcon: Record<ConsoleEvent["source"], ReactNode> = {
  request: <Network className="h-4 w-4" />,
  auth: <ShieldAlert className="h-4 w-4" />,
  activity: <Circle className="h-4 w-4" />,
  audit: <Eye className="h-4 w-4" />,
  error: <Bug className="h-4 w-4" />,
  system: <Cpu className="h-4 w-4" />,
};

const inputClass =
  "rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";

const getLevelFromParams = (params: URLSearchParams): ConsoleLevel => {
  const value = params.get("level");
  return value === "info" || value === "warn" || value === "error" || value === "debug" ? value : "all";
};

const getSourceFromParams = (params: URLSearchParams): ConsoleSource => {
  const value = params.get("source");
  return value === "request" || value === "auth" || value === "activity" || value === "audit" || value === "error" || value === "system"
    ? value
    : "all";
};

const getModeFromParams = (params: URLSearchParams): ViewMode => (
  params.get("mode") === "detailed" ? "detailed" : "compact"
);

const LiveConsolePage = () => {
  const { formatTime, formatDateTime } = useRegional();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<ConsoleEvent[]>([]);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "paused" | "error">("connecting");
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const consoleRef = useRef<HTMLDivElement | null>(null);

  const level = getLevelFromParams(searchParams);
  const source = getSourceFromParams(searchParams);
  const mode = getModeFromParams(searchParams);
  const search = searchParams.get("search") ?? "";

  const streamUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (level !== "all") params.set("level", level);
    if (source !== "all") params.set("source", source);
    if (search.trim()) params.set("search", search.trim());
    params.set("limit", "160");
    return `${apiConfig.backendBaseUrl}/logs/live-console/stream?${params.toString()}`;
  }, [level, source, search]);

  const stats = useMemo(() => ({
    total: events.length,
    info: events.filter((event) => event.level === "info").length,
    warn: events.filter((event) => event.level === "warn").length,
    error: events.filter((event) => event.level === "error").length,
  }), [events]);

  useEffect(() => {
    if (isPaused) {
      setConnectionState("paused");
      return;
    }

    setConnectionState("connecting");
    const source = new EventSource(streamUrl, { withCredentials: true });

    source.addEventListener("ready", () => {
      setConnectionState("connected");
    });

    source.addEventListener("snapshot", (message) => {
      try {
        const payload = JSON.parse((message as MessageEvent).data) as ConsoleEvent[];
        setEvents(payload.slice(-500));
        setConnectionState("connected");
      } catch {
        setConnectionState("error");
      }
    });

    source.addEventListener("log", (message) => {
      try {
        const payload = JSON.parse((message as MessageEvent).data) as ConsoleEvent;
        setEvents((current) => {
          if (current.some((event) => event.id === payload.id)) return current;
          return [...current, payload].slice(-500);
        });
      } catch {
        setConnectionState("error");
      }
    });

    source.addEventListener("heartbeat", (message) => {
      try {
        const payload = JSON.parse((message as MessageEvent).data) as { timestamp: string };
        setLastHeartbeat(payload.timestamp);
        setConnectionState("connected");
      } catch {
        setLastHeartbeat(new Date().toISOString());
      }
    });

    source.addEventListener("stream-error", () => {
      setConnectionState("error");
    });

    source.onerror = () => {
      setConnectionState("error");
    };

    return () => source.close();
  }, [streamUrl, isPaused]);

  useEffect(() => {
    if (!autoScroll) return;
    const target = consoleRef.current;
    if (!target) return;
    target.scrollTop = target.scrollHeight;
  }, [events, autoScroll]);

  const setParam = (key: "level" | "source" | "mode" | "search", value: string) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      const defaultValue = key === "mode" ? "compact" : "all";
      if (!value || value === defaultValue) next.delete(key);
      else next.set(key, value);
      return next;
    });
  };

  const statusLabel = connectionState === "connected"
    ? "Connected"
    : connectionState === "paused"
      ? "Paused"
      : connectionState === "connecting"
        ? "Connecting"
        : "Reconnecting";

  return (
    <section className="grid gap-5">
      <div className="rounded-xl border border-theme bg-light-background-card p-6 shadow-soft dark:bg-dark-background-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-light-primary text-white shadow-sm dark:bg-dark-primary dark:text-dark-background">
              <Terminal className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted dark:text-dark-text-muted">
                Logs
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-light-text dark:text-dark-text">Live Console</h1>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                Backend log stream ผ่าน SSE แบบ real-time
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
              connectionState === "connected"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : connectionState === "paused"
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "bg-red-500/10 text-red-700 dark:text-red-300"
            }`}>
              <span className={`h-2 w-2 rounded-full ${connectionState === "connected" ? "bg-emerald-500" : connectionState === "paused" ? "bg-amber-500" : "bg-red-500"}`} />
              {statusLabel}
            </span>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
              onClick={() => setIsPaused((current) => !current)}
              type="button"
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {isPaused ? "Resume" : "Pause"}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
              onClick={() => setEvents([])}
              type="button"
            >
              <Eraser className="h-4 w-4" />
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Buffered" value={stats.total} icon={<Terminal className="h-5 w-5" />} />
        <StatCard label="Info" value={stats.info} tone="primary" icon={<Circle className="h-5 w-5" />} />
        <StatCard label="Warnings" value={stats.warn} tone="warning" icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard label="Errors" value={stats.error} tone="danger" icon={<Bug className="h-5 w-5" />} />
      </div>

      <article className="rounded-lg border border-theme bg-light-background-card p-4 shadow-soft dark:bg-dark-background-card">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_160px_170px_150px_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-text-muted dark:text-dark-text-muted" />
            <input
              className={`${inputClass} w-full py-2 pl-9`}
              onChange={(event) => setParam("search", event.target.value)}
              placeholder="ค้นหา log, source, user, path..."
              value={search}
            />
          </div>
          <select className={inputClass} onChange={(event) => setParam("level", event.target.value)} value={level}>
            {levelOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className={inputClass} onChange={(event) => setParam("source", event.target.value)} value={source}>
            {sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className={inputClass} onChange={(event) => setParam("mode", event.target.value)} value={mode}>
            <option value="compact">Compact</option>
            <option value="detailed">Detailed</option>
          </select>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
            onClick={() => setAutoScroll((current) => !current)}
            type="button"
          >
            {autoScroll ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            Auto-scroll
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
            onClick={() => {
              setEvents([]);
              setIsPaused(false);
            }}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            Reconnect
          </button>
        </div>
      </article>

      <article className="overflow-hidden rounded-lg border border-theme bg-[#101820] shadow-soft dark:border-dark-border">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/20 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Terminal className="h-4 w-4" />
            Console Stream
          </div>
          <div className="text-xs text-slate-400">
            Last heartbeat: {lastHeartbeat ? formatDateTime(lastHeartbeat) : "—"}
          </div>
        </div>

        <div ref={consoleRef} className="h-[62vh] overflow-y-auto bg-[#101820] font-mono text-[13px] leading-relaxed">
          {events.length === 0 ? (
            <div className="grid h-full place-items-center px-6 text-center text-slate-400">
              <div>
                <Terminal className="mx-auto h-10 w-10 opacity-40" />
                <p className="mt-3 text-sm">Waiting for live console events</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {events.map((event) => (
                <div className="grid gap-2 px-4 py-2.5 hover:bg-white/[0.03] md:grid-cols-[90px_82px_120px_minmax(0,1fr)]" key={event.id}>
                  <span className="text-slate-400">{formatTime(event.timestamp)}</span>
                  <span className={`font-bold uppercase ${levelClass[event.level]}`}>{event.level}</span>
                  <span className="flex items-center gap-2 text-slate-300">
                    {sourceIcon[event.source]}
                    {event.source}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-words text-slate-100">{event.message}</span>
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase ${levelBgClass[event.level]}`}>
                        {event.title}
                      </span>
                    </div>
                    {mode === "detailed" && (
                      <div className="mt-2 grid gap-1 rounded-md bg-black/20 p-2 text-xs text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
                        {Object.entries(event.context)
                          .filter(([, value]) => value !== null && value !== undefined && value !== "")
                          .map(([key, value]) => (
                            <span className="min-w-0 break-words" key={key}>
                              <span className="text-slate-500">{key}:</span> {String(value)}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </article>
    </section>
  );
};

export default LiveConsolePage;
