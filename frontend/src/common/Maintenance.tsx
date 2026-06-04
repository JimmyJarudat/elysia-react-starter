import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";

interface MaintenanceProps {
  message?: string;
}

const Maintenance = ({ message }: MaintenanceProps) => {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 600);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-app px-6 py-12">
      {/* Subtle background pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      {/* Glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/10 blur-3xl dark:bg-amber-500/10" />

      <div className="relative z-10 w-full max-w-lg text-center">

        {/* Icon */}
        <div className="relative mx-auto mb-8 w-fit">
          <div className="grid h-28 w-28 place-items-center rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 shadow-lg shadow-amber-200/50 dark:border-amber-800 dark:from-amber-900/30 dark:to-amber-800/20 dark:shadow-amber-900/30">
            <Wrench size={52} className="text-amber-500 dark:text-amber-400" strokeWidth={1.5} />
          </div>
          {/* Pulse ring */}
          <span className="absolute inset-0 animate-ping rounded-3xl border border-amber-400/30 dark:border-amber-500/20" />
        </div>

        {/* Badge */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 dark:border-amber-800 dark:bg-amber-900/30">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          <span className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Maintenance Mode
          </span>
        </div>

        {/* Title */}
        <h1 className="mb-4 text-3xl font-bold tracking-tight text-light-text dark:text-dark-text sm:text-4xl">
          ระบบอยู่ระหว่างการปรับปรุง
        </h1>

        {/* Message */}
        <p className="mx-auto mb-8 max-w-sm text-base leading-relaxed text-light-text-muted dark:text-dark-text-muted">
          {message?.trim()
            ? message
            : "ขออภัยในความไม่สะดวก ระบบจะกลับมาให้บริการในเร็ว ๆ นี้"}
        </p>

        {/* Loading indicator */}
        <div className="inline-flex items-center gap-3 rounded-xl border border-theme bg-light-background-card px-5 py-3 shadow-soft dark:bg-dark-background-card">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 rounded-full bg-amber-400 dark:bg-amber-500"
                style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
          <span className="text-sm font-medium text-light-text-muted dark:text-dark-text-muted">
            กำลังดำเนินการ{dots}
          </span>
        </div>

      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scaleY(0.6); opacity: 0.5; }
          40% { transform: scaleY(1.2); opacity: 1; }
        }
      `}</style>
    </main>
  );
};

export default Maintenance;
