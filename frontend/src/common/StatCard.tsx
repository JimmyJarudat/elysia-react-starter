import type { ReactNode } from "react";

type StatCardTone = "primary" | "success" | "warning" | "muted" | "danger" | "purple";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone?: StatCardTone;
}

const toneClass: Record<StatCardTone, string> = {
  primary: "bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  muted: "bg-light-text-muted/10 text-light-text-muted dark:bg-dark-text-muted/10 dark:text-dark-text-muted",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

const formatValue = (value: number | string) => (
  typeof value === "number" ? value.toLocaleString() : value
);

const StatCard = ({ label, value, icon, tone = "primary" }: StatCardProps) => (
  <article className="rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <span className="text-sm text-light-text-muted dark:text-dark-text-muted">{label}</span>
        <strong className="mt-2 block text-3xl text-light-text dark:text-dark-text">{formatValue(value)}</strong>
      </div>
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${toneClass[tone]}`}>{icon}</div>
    </div>
  </article>
);

export default StatCard;
