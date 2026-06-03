import { Check, X } from "lucide-react";

interface AppearancePanelProps {
  open: boolean;
  onClose: () => void;
}

const AppearancePanel = ({ open, onClose }: AppearancePanelProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        className="absolute inset-0 cursor-default bg-slate-950/35 backdrop-blur-[2px]"
        type="button"
        aria-label="Close appearance settings"
        onClick={onClose}
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md animate-[slideInRight_180ms_ease-out] flex-col border-l border-theme bg-light-background-card text-light-text shadow-2xl dark:bg-dark-background-card dark:text-dark-text">
        <div className="flex h-16 items-center justify-between border-b border-theme px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-light-primary dark:text-dark-primary">Mock panel</p>
            <h2 className="text-lg font-semibold text-light-text dark:text-dark-text">Appearance</h2>
          </div>
          <button
            className="grid h-9 w-9 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-ocean-50 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-slate-blue-800/50 dark:hover:text-dark-primary"
            type="button"
            onClick={onClose}
            aria-label="Close appearance settings"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">Theme mode</h3>
              <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">ตัวอย่างตัวเลือก mock สำหรับหน้าตาแอป</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["Light", "Dark", "System"].map((item) => (
                <button
                  className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors ${
                    item === "Light"
                      ? "border-light-primary bg-ocean-50 text-light-primary dark:border-dark-primary dark:bg-slate-blue-800/40 dark:text-dark-primary"
                      : "border-theme hover:bg-ocean-50/50 dark:hover:bg-slate-blue-800/30"
                  }`}
                  type="button"
                  key={item}
                >
                  <span className="flex items-center justify-between">
                    {item}
                    {item === "Light" && <Check size={16} />}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">Accent color</h3>
            <div className="flex gap-2">
              {["bg-ocean-500", "bg-emerald-500", "bg-violet-500", "bg-rose-500", "bg-amber-500"].map((color, index) => (
                <button
                  className={`h-9 w-9 rounded-full ${color} ring-offset-2 ring-offset-light-background-card transition-transform hover:scale-105 dark:ring-offset-dark-background-card ${
                    index === 0 ? "ring-2 ring-light-primary dark:ring-dark-primary" : ""
                  }`}
                  type="button"
                  key={color}
                  aria-label={`Select accent color ${index + 1}`}
                />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">Density</h3>
            <div className="rounded-lg border border-theme p-2">
              {["Comfortable", "Compact", "Spacious"].map((item, index) => (
                <button
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                    index === 0
                      ? "bg-ocean-50 text-light-primary dark:bg-slate-blue-800/40 dark:text-dark-primary"
                      : "hover:bg-ocean-50/50 dark:hover:bg-slate-blue-800/30"
                  }`}
                  type="button"
                  key={item}
                >
                  {item}
                  {index === 0 && <Check size={16} />}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-2 border-t border-theme p-5">
          <button
            className="rounded-md border border-theme px-4 py-2 text-sm font-medium transition-colors hover:bg-ocean-50/50 dark:hover:bg-slate-blue-800/30"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-light-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-light-primary-hover dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
            type="button"
          >
            Apply mock
          </button>
        </div>
      </aside>
    </div>
  );
};

export default AppearancePanel;
