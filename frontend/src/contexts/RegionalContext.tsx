import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useApi } from "@/hooks/useApi";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegionalSettings {
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  maintenanceMode: boolean;
  yearEra: "CE" | "BE";
}

interface RegionalContextValue {
  settings: RegionalSettings;
  isLoading: boolean;
  formatDate: (value: string | Date | null | undefined) => string;
  formatDateTime: (value: string | Date | null | undefined) => string;
  formatTime: (value: string | Date | null | undefined) => string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultSettings: RegionalSettings = {
  timezone: "Asia/Bangkok",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "24h",
  maintenanceMode: false,
  yearEra: "CE",
};

// ─── Core formatter ───────────────────────────────────────────────────────────

export function buildFormatters(settings: RegionalSettings) {
  const { timezone, dateFormat, timeFormat, yearEra } = settings;
  const hour12 = timeFormat === "12h";
  const BE_OFFSET = 543;

  const toDate = (v: string | Date | null | undefined): Date | null => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  const getYear = (d: Date): number => {
    const utcYear = parseInt(
      new Intl.DateTimeFormat("en-CA", { year: "numeric", timeZone: timezone }).format(d),
      10,
    );
    return yearEra === "BE" ? utcYear + BE_OFFSET : utcYear;
  };

  const formatDatePart = (d: Date): string => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric", timeZone: timezone,
    }).formatToParts(d);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
    const year = String(getYear(d));
    const day = get("day");
    const month = get("month");

    switch (dateFormat) {
      case "YYYY-MM-DD":   return `${year}-${month}-${day}`;
      case "MM/DD/YYYY":   return `${month}/${day}/${year}`;
      case "DD-MM-YYYY":   return `${day}-${month}-${year}`;
      case "YYYY/MM/DD":   return `${year}/${month}/${day}`;
      case "D MMMM YYYY": {
        const monthLong = new Intl.DateTimeFormat("th-TH", { month: "long", timeZone: timezone }).format(d);
        const dayNum = parseInt(day, 10);
        return `${dayNum} ${monthLong} ${year}`;
      }
      case "D MMM YYYY": {
        const monthShort = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: timezone }).format(d);
        const dayNum = parseInt(day, 10);
        return `${dayNum} ${monthShort} ${year}`;
      }
      default: return `${day}/${month}/${year}`;  // DD/MM/YYYY
    }
  };

  const formatTimePart = (d: Date): string =>
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12, timeZone: timezone }).format(d);

  return {
    formatDate: (v: string | Date | null | undefined): string => {
      const d = toDate(v);
      return d ? formatDatePart(d) : "—";
    },
    formatTime: (v: string | Date | null | undefined): string => {
      const d = toDate(v);
      return d ? formatTimePart(d) : "—";
    },
    formatDateTime: (v: string | Date | null | undefined): string => {
      const d = toDate(v);
      return d ? `${formatDatePart(d)} ${formatTimePart(d)}` : "—";
    },
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const RegionalContext = createContext<RegionalContextValue>({
  settings: defaultSettings,
  isLoading: true,
  ...buildFormatters(defaultSettings),
});

export const RegionalProvider = ({ children }: { children: ReactNode }) => {
  const { get } = useApi();
  const [settings, setSettings] = useState<RegionalSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    get<{ success: boolean; data: RegionalSettings }>("/system-setting/regional/status", { skipAuthRefresh: true })
      .then((res) => { if (res.data.success) setSettings(res.data.data); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const formatters = buildFormatters(settings);

  return (
    <RegionalContext.Provider value={{ settings, isLoading, ...formatters }}>
      {children}
    </RegionalContext.Provider>
  );
};

export const useRegional = () => useContext(RegionalContext);
