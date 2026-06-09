import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Bug,
  Circle,
  Cpu,
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
import { apiConfig } from "@/config";
import { useRegional } from "@/contexts/RegionalContext";
import { checkInjection } from "@/utils/injectionGuard";

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
  { label: "all levels", value: "all" },
  { label: "info", value: "info" },
  { label: "warn", value: "warn" },
  { label: "error", value: "error" },
  { label: "debug", value: "debug" },
];

const sourceOptions: { label: string; value: ConsoleSource }[] = [
  { label: "all sources", value: "all" },
  { label: "request", value: "request" },
  { label: "auth", value: "auth" },
  { label: "activity", value: "activity" },
  { label: "audit", value: "audit" },
  { label: "error", value: "error" },
  { label: "system", value: "system" },
];

const levelColor: Record<ConsoleEvent["level"], string> = {
  info: "text-sky-400",
  warn: "text-amber-400",
  error: "text-red-400",
  debug: "text-violet-400",
};

const levelRowHover: Record<ConsoleEvent["level"], string> = {
  info: "hover:bg-sky-500/5",
  warn: "hover:bg-amber-500/5",
  error: "hover:bg-red-500/[0.07]",
  debug: "hover:bg-violet-500/5",
};

const sourceIcon: Record<ConsoleEvent["source"], ReactNode> = {
  request: <Network className="h-3 w-3" />,
  auth: <ShieldAlert className="h-3 w-3" />,
  activity: <Circle className="h-3 w-3" />,
  audit: <Eye className="h-3 w-3" />,
  error: <Bug className="h-3 w-3" />,
  system: <Cpu className="h-3 w-3" />,
};

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
  const [consoleSearchError, setConsoleSearchError] = useState<string | null>(null);
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
    info: events.filter((e) => e.level === "info").length,
    warn: events.filter((e) => e.level === "warn").length,
    error: events.filter((e) => e.level === "error").length,
    debug: events.filter((e) => e.level === "debug").length,
  }), [events]);

  useEffect(() => {
    if (isPaused) {
      setConnectionState("paused");
      return;
    }

    setConnectionState("connecting");
    const source = new EventSource(streamUrl, { withCredentials: true });

    source.addEventListener("ready", () => setConnectionState("connected"));

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
          if (current.some((e) => e.id === payload.id)) return current;
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

    source.addEventListener("stream-error", () => setConnectionState("error"));
    source.onerror = () => setConnectionState("error");

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

  const connDot =
    connectionState === "connected" ? "bg-emerald-400 shadow-[0_0_6px_2px_rgb(52_211_153/0.5)]"
    : connectionState === "paused" ? "bg-amber-400"
    : connectionState === "connecting" ? "bg-amber-400 animate-pulse"
    : "bg-red-400 animate-pulse";

  const connText =
    connectionState === "connected" ? "text-emerald-400"
    : connectionState === "paused" ? "text-amber-400"
    : connectionState === "connecting" ? "text-amber-400"
    : "text-red-400";

  const connLabel =
    connectionState === "connected" ? "connected"
    : connectionState === "paused" ? "paused"
    : connectionState === "connecting" ? "connecting…"
    : "reconnecting…";

  return (
    <section className="font-mono">
      <article className="overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl">

        {/* ── Title bar ── */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#161b22] px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-amber-500/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Terminal className="h-3.5 w-3.5 text-slate-500" />
              <span>live-console</span>
              <span className="text-slate-600">—</span>
              <span className="text-slate-500">Backend SSE Stream</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className={`flex items-center gap-1.5 ${connText}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${connDot}`} />
              {connLabel}
            </span>
            <span className="text-slate-600">
              hb: <span className="text-slate-500">{lastHeartbeat ? formatDateTime(lastHeartbeat) : "—"}</span>
            </span>
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-white/5 bg-black/30 px-4 py-1.5 text-xs">
          <span className="text-slate-500">buf: <span className="text-slate-300">{stats.total}</span></span>
          <span className="flex items-center gap-1 text-slate-500">
            <Circle className="h-2.5 w-2.5 text-sky-400" />
            info: <span className="text-sky-400">{stats.info}</span>
          </span>
          <span className="flex items-center gap-1 text-slate-500">
            <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />
            warn: <span className="text-amber-400">{stats.warn}</span>
          </span>
          <span className="flex items-center gap-1 text-slate-500">
            <Bug className="h-2.5 w-2.5 text-red-400" />
            error: <span className="text-red-400">{stats.error}</span>
          </span>
          <span className="flex items-center gap-1 text-slate-500">
            debug: <span className="text-violet-400">{stats.debug}</span>
          </span>
        </div>

        {/* ── Filter / command bar ── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-[#0a0e14] px-4 py-2">
          <span className="select-none text-emerald-400">$</span>
          <div className="flex min-w-[200px] flex-1 flex-col">
            <div className="flex items-center gap-2">
              <Search className="pointer-events-none h-3.5 w-3.5 shrink-0 text-slate-600" />
              <input
                className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-600 outline-none"
                onChange={(e) => {
                  const r = checkInjection(e.target.value);
                  setConsoleSearchError(r.message);
                  setParam("search", e.target.value);
                }}
                placeholder="search logs…"
                value={search}
              />
            </div>
            {consoleSearchError && (
              <p className="mt-0.5 text-[10px] text-red-400">{consoleSearchError}</p>
            )}
          </div>
          <span className="text-slate-700">|</span>
          <select
            className="cursor-pointer bg-transparent text-xs text-slate-400 outline-none"
            onChange={(e) => setParam("level", e.target.value)}
            value={level}
          >
            {levelOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <span className="text-slate-700">|</span>
          <select
            className="cursor-pointer bg-transparent text-xs text-slate-400 outline-none"
            onChange={(e) => setParam("source", e.target.value)}
            value={source}
          >
            {sourceOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <span className="text-slate-700">|</span>
          <select
            className="cursor-pointer bg-transparent text-xs text-slate-400 outline-none"
            onChange={(e) => setParam("mode", e.target.value)}
            value={mode}
          >
            <option value="compact">compact</option>
            <option value="detailed">detailed</option>
          </select>
        </div>

        {/* ── Console output ── */}
        <div
          ref={consoleRef}
          className="h-[62vh] overflow-y-auto bg-[#0d1117] text-[12px] leading-[1.6] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
        >
          {events.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div className="text-slate-600">
                <Terminal className="mx-auto h-8 w-8 opacity-30" />
                <p className="mt-3 text-xs">waiting for events…</p>
                <p className="mt-1 text-[11px] text-slate-700">$ tail -f /var/log/backend.log</p>
              </div>
            </div>
          ) : (
            <div>
              {events.map((event) => (
                <div
                  className={`group flex gap-0 px-4 py-px transition-colors ${levelRowHover[event.level]}`}
                  key={event.id}
                >
                  {/* timestamp */}
                  <span className="w-[82px] shrink-0 text-slate-600">{formatTime(event.timestamp)}</span>

                  {/* level badge */}
                  <span className={`w-[52px] shrink-0 font-bold ${levelColor[event.level]}`}>
                    [{event.level.toUpperCase().padEnd(5)}]
                  </span>

                  {/* source */}
                  <span className="flex w-[96px] shrink-0 items-center gap-1 text-slate-500">
                    {sourceIcon[event.source]}
                    {event.source}
                  </span>

                  {/* message + context */}
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-100">{event.message}</span>
                    {event.title && (
                      <span className={`ml-2 text-[11px] ${levelColor[event.level]} opacity-70`}>
                        [{event.title}]
                      </span>
                    )}
                    {mode === "detailed" && Object.entries(event.context).filter(([, v]) => v !== null && v !== undefined && v !== "").length > 0 && (
                      <div className="ml-0 mt-0.5 flex flex-wrap gap-x-3 gap-y-0 pl-0 text-[11px]">
                        {Object.entries(event.context)
                          .filter(([, v]) => v !== null && v !== undefined && v !== "")
                          .map(([k, v]) => (
                            <span key={k}>
                              <span className="text-slate-600">{k}=</span>
                              <span className="text-slate-400">{String(v)}</span>
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {/* blinking cursor at end */}
              <div className="flex items-center gap-2 px-4 py-1 text-slate-600">
                <span className="select-none">▋</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Action bar ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 bg-[#161b22] px-4 py-2">
          <div className="flex items-center gap-1">
            <button
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200"
              onClick={() => setIsPaused((v) => !v)}
              type="button"
            >
              {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              {isPaused ? "resume" : "pause"}
            </button>
            <span className="text-slate-700">·</span>
            <button
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200"
              onClick={() => setEvents([])}
              type="button"
            >
              clear
            </button>
            <span className="text-slate-700">·</span>
            <button
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200"
              onClick={() => { setEvents([]); setIsPaused(false); }}
              type="button"
            >
              <RefreshCw className="h-3 w-3" />
              reconnect
            </button>
          </div>

          <button
            className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors hover:bg-white/5 ${autoScroll ? "text-emerald-400" : "text-slate-500"}`}
            onClick={() => setAutoScroll((v) => !v)}
            type="button"
          >
            {autoScroll ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            auto-scroll: {autoScroll ? "on" : "off"}
          </button>
        </div>

      </article>
    </section>
  );
};

export default LiveConsolePage;
