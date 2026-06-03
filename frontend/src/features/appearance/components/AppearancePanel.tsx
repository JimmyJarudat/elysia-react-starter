import { Check, Languages, MonitorCog, Palette, RotateCcw, Type, X } from "lucide-react";
import { type AppColorTheme, useColor } from "@/contexts/ColorContext";
import { type AppFont, useFont } from "@/contexts/FontContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { type ThemeMode, useTheme } from "@/contexts/ThemeContext";

interface AppearancePanelProps {
  open: boolean;
  onClose: () => void;
}

const fieldClass =
  "w-full rounded-lg border border-theme bg-light-background-soft px-3 py-2.5 text-sm font-medium text-light-text outline-none transition-colors focus:border-light-primary focus:ring-2 focus:ring-light-primary/20 dark:bg-dark-background-soft dark:text-dark-text dark:focus:border-dark-primary dark:focus:ring-dark-primary/20";

const AppearancePanel = ({ open, onClose }: AppearancePanelProps) => {
  const { themeMode, setThemeMode } = useTheme();
  const { colorTheme, colorPalettes, activePalette, setColorTheme } = useColor();
  const { appFont, fontOptions, activeFont, setAppFont } = useFont();
  const { currentLanguage, languageOptions, activeLanguage, changeLanguage } = useLanguage();

  if (!open) {
    return null;
  }

  const themeOptions: Array<{ label: string; value: ThemeMode }> = [
    { label: "Light", value: "light" },
    { label: "Dark", value: "dark" },
    { label: "System", value: "system" },
  ];

  const resetAppearance = () => {
    setThemeMode("light");
    setColorTheme("ocean");
    setAppFont("system");
    changeLanguage("th");
  };

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
            <p className="text-xs font-semibold uppercase tracking-wider text-light-primary dark:text-dark-primary">Preferences</p>
            <h2 className="text-lg font-semibold text-light-text dark:text-dark-text">Appearance</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              className="grid h-9 w-9 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
              type="button"
              onClick={resetAppearance}
              aria-label="Reset appearance settings"
              title="Reset"
            >
              <RotateCcw size={18} />
            </button>
            <button
              className="grid h-9 w-9 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
              type="button"
              onClick={onClose}
              aria-label="Close appearance settings"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <section className="rounded-lg border border-theme bg-light-background-soft/40 p-4 dark:bg-dark-background-soft/30">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                <Languages size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">Language</h3>
                    <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                      State พร้อมใช้ ยังไม่ผูกแปลข้อความจริง
                    </p>
                  </div>
                  <span className="rounded-md bg-light-primary/10 px-2 py-1 text-xs font-bold text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                    {activeLanguage.flag}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {languageOptions.map((language) => {
                    const isActive = currentLanguage === language.id;

                    return (
                      <button
                        className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                          isActive
                            ? "border-light-primary bg-light-primary/10 text-light-primary dark:border-dark-primary dark:bg-dark-primary/10 dark:text-dark-primary"
                            : "border-theme hover:bg-light-primary/10 dark:hover:bg-dark-primary/10"
                        }`}
                        type="button"
                        key={language.id}
                        onClick={() => changeLanguage(language.id)}
                        aria-pressed={isActive}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span>
                            <span className="block font-semibold">{language.nativeLabel}</span>
                            <span className="block text-xs text-light-text-muted dark:text-dark-text-muted">{language.label}</span>
                          </span>
                          {isActive && <Check size={16} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-theme p-4">
            <div className="mb-3 flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                <MonitorCog size={19} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">Theme mode</h3>
                <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">เลือกโหมดแสงของแอป</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((item) => {
                const isActive = themeMode === item.value;

                return (
                  <button
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                      isActive
                        ? "border-light-primary bg-light-primary/10 text-light-primary dark:border-dark-primary dark:bg-dark-primary/10 dark:text-dark-primary"
                        : "border-theme hover:bg-light-primary/10 dark:hover:bg-dark-primary/10"
                    }`}
                    type="button"
                    key={item.value}
                    onClick={() => setThemeMode(item.value)}
                    aria-pressed={isActive}
                  >
                    <span className="flex items-center justify-between">
                      {item.label}
                      {isActive && <Check size={16} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-theme p-4">
            <div className="mb-3 flex items-start gap-3">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white shadow-sm"
                style={{ backgroundColor: activePalette.swatch }}
              >
                <Palette size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">Theme color</h3>
                <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
                  {activePalette.label} controls navbar, sidebar, active states, and app background
                </p>
              </div>
            </div>

            <label className="sr-only" htmlFor="appearance-color-theme">
              Theme color
            </label>
            <select
              className={fieldClass}
              id="appearance-color-theme"
              value={colorTheme}
              onChange={(event) => setColorTheme(event.target.value as AppColorTheme)}
            >
              {colorPalettes.map((palette) => (
                <option key={palette.id} value={palette.id}>
                  {palette.label}
                </option>
              ))}
            </select>

            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {colorPalettes.map((palette) => (
                <button
                  className={`h-7 rounded-md border transition-transform hover:scale-105 ${
                    colorTheme === palette.id ? "border-light-text ring-2 ring-light-primary dark:border-dark-text dark:ring-dark-primary" : "border-transparent"
                  }`}
                  style={{ backgroundColor: palette.swatch }}
                  type="button"
                  key={palette.id}
                  onClick={() => setColorTheme(palette.id)}
                  aria-label={`Select ${palette.label} theme color`}
                />
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-theme p-4">
            <div className="mb-3 flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
                <Type size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">Font family</h3>
                <p className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">Current: {activeFont.label}</p>
              </div>
            </div>

            <label className="sr-only" htmlFor="appearance-font-family">
              Font family
            </label>
            <select
              className={fieldClass}
              id="appearance-font-family"
              value={appFont}
              onChange={(event) => setAppFont(event.target.value as AppFont)}
              style={{ fontFamily: activeFont.family }}
            >
              {fontOptions.map((font) => (
                <option key={font.id} value={font.id}>
                  {font.label}
                </option>
              ))}
            </select>

            <div
              className="mt-3 rounded-lg border border-theme bg-light-background-soft px-3 py-2 text-sm dark:bg-dark-background-soft"
              style={{ fontFamily: activeFont.family }}
            >
              <span className="block font-semibold text-light-text dark:text-dark-text">Font preview สวัสดี</span>
              <span className="mt-0.5 block text-xs text-light-text-muted dark:text-dark-text-muted">Admin console typography preview</span>
            </div>
          </section>

        </div>

        <div className="flex justify-end gap-2 border-t border-theme p-5">
          <button
            className="inline-flex items-center gap-2 rounded-md border border-theme px-4 py-2 text-sm font-medium transition-colors hover:bg-light-primary/10 dark:hover:bg-dark-primary/10"
            type="button"
            onClick={resetAppearance}
          >
            <RotateCcw size={16} />
            Reset
          </button>
          <button
            className="rounded-md border border-theme px-4 py-2 text-sm font-medium transition-colors hover:bg-light-primary/10 dark:hover:bg-dark-primary/10"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-light-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-light-primary-hover dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
            type="button"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </aside>
    </div>
  );
};

export default AppearancePanel;
