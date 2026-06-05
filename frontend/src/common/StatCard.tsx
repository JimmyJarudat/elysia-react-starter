import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type StatCardTone = "primary" | "success" | "warning" | "muted" | "danger" | "purple";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone?: StatCardTone;
}

const toneClass: Record<StatCardTone, string> = {
  primary: "from-light-primary/35 via-light-primary/10 to-transparent text-light-primary shadow-light-primary/20 dark:from-dark-primary/35 dark:via-dark-primary/10 dark:text-dark-primary dark:shadow-dark-primary/20",
  success: "from-emerald-500/35 via-emerald-500/10 to-transparent text-emerald-600 shadow-emerald-500/20 dark:text-emerald-400",
  warning: "from-amber-500/35 via-amber-500/10 to-transparent text-amber-700 shadow-amber-500/20 dark:text-amber-300",
  muted: "from-light-text-muted/25 via-light-text-muted/10 to-transparent text-light-text-muted shadow-black/5 dark:from-dark-text-muted/25 dark:via-dark-text-muted/10 dark:text-dark-text-muted dark:shadow-white/5",
  danger: "from-red-500/35 via-red-500/10 to-transparent text-red-600 shadow-red-500/20 dark:text-red-400",
  purple: "from-purple-500/35 via-purple-500/10 to-transparent text-purple-600 shadow-purple-500/20 dark:text-purple-400",
};

const formatValue = (value: number | string) =>
  typeof value === "number" ? value.toLocaleString() : value;

const CountUpValue = ({ value }: { value: number | string }) => {
  const [displayValue, setDisplayValue] = useState(0);

  const targetValue = useMemo(() => {
    if (typeof value === "number") return value;

    const parsed = Number(value.toString().replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }, [value]);

  useEffect(() => {
    if (targetValue === null) return;

    let frameId = 0;
    const duration = 900;
    const startTime = performance.now();

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setDisplayValue(Math.round(targetValue * eased));

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, [targetValue]);

  if (targetValue === null) {
    return <>{formatValue(value)}</>;
  }

  return <>{displayValue.toLocaleString()}</>;
};

const StatCard = ({ label, value, icon, tone = "primary" }: StatCardProps) => (
  <article className="relative rounded-[1.4rem] p-px">
    <div className="absolute inset-0 rounded-[1.4rem] bg-gradient-to-br from-light-primary/40 via-border-theme to-border-theme dark:from-dark-primary/40" />

    <div className="relative rounded-[1.35rem] border border-white/60 bg-light-background-card p-5 shadow-soft dark:border-white/10 dark:bg-dark-background-card">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <span className="inline-flex rounded-full border border-theme bg-light-background px-2.5 py-1 text-xs font-medium text-light-text-muted dark:bg-dark-background dark:text-dark-text-muted">
            {label}
          </span>

          <strong className="mt-4 block truncate text-4xl font-semibold tracking-tight text-light-text dark:text-dark-text">
            <CountUpValue value={value} />
          </strong>

          <div className="mt-4 h-1.5 w-20 overflow-hidden rounded-full bg-light-background dark:bg-dark-background">
            <div className="h-full w-2/3 rounded-full bg-light-primary/35 dark:bg-dark-primary/35" />
          </div>
        </div>

        <div
          className={`relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl shadow-sm ring-1 ring-current/15 ${toneClass[tone]}`}
        >
          <div className="absolute inset-1 rounded-xl border border-white/40 dark:border-white/10" />
          {icon}
        </div>
      </div>
    </div>
  </article>
);

export default StatCard;