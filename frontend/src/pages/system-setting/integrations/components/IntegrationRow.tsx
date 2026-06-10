import type { ReactNode } from "react";
import { CheckCircle2, ChevronDown, Settings, ShieldAlert } from "lucide-react";
import { rowStatusCls } from "../constants";
import type { IntegrationStatusTone } from "../types";

type IntegrationRowProps = {
  title: string;
  description: string;
  icon: ReactNode;
  statusLabel: string;
  statusTone: IntegrationStatusTone;
  connected: boolean;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
};

const IntegrationRow = ({
  title,
  description,
  icon,
  statusLabel,
  statusTone,
  connected,
  expanded,
  onToggle,
  children,
}: IntegrationRowProps) => (
  <article className="overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-soft dark:bg-dark-background-card">
    <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-light-text dark:text-dark-text">{title}</h2>
          <p className="mt-0.5 text-sm text-light-text-muted dark:text-dark-text-muted">{description}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${rowStatusCls(statusTone)}`}>
          {connected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          {statusLabel}
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10"
        >
          <Settings className="h-4 w-4" />
          {expanded ? "ปิดการตั้งค่า" : "เปิดการตั้งค่า"}
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>
    </div>

    {expanded && (
      <div className="border-t border-theme bg-light-background/60 p-4 dark:bg-dark-background/40">
        {children}
      </div>
    )}
  </article>
);

export default IntegrationRow;
