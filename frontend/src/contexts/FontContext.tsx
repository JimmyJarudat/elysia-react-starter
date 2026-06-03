import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppFont =
  | "system"
  | "anakotmai"
  | "sarabun"
  | "prompt"
  | "kanit"
  | "ibmplex"
  | "notosans"
  | "notosanslooped"
  | "notosansui"
  | "notoserif"
  | "chakrapetch"
  | "mitr"
  | "k2d"
  | "niramit"
  | "pridi"
  | "baijamjuree"
  | "athiti"
  | "chonburi"
  | "krub"
  | "taviraj"
  | "maitree"
  | "trirong"
  | "kodchasan"
  | "fahkwang";

interface FontOption {
  id: AppFont;
  label: string;
  family: string;
  category: "sans" | "serif" | "display";
}

interface FontContextType {
  appFont: AppFont;
  fontOptions: FontOption[];
  activeFont: FontOption;
  setAppFont: (font: AppFont) => void;
}

const FONT_STORAGE_KEY = "app-font-family";

export const fontOptions: FontOption[] = [
  {
    id: "system",
    label: "System Default",
    family: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    category: "sans",
  },
  { id: "anakotmai", label: "Anakotmai", family: "'Anakotmai', sans-serif", category: "sans" },
  { id: "sarabun", label: "Sarabun", family: "'Sarabun', sans-serif", category: "sans" },
  { id: "prompt", label: "Prompt", family: "'Prompt', sans-serif", category: "sans" },
  { id: "kanit", label: "Kanit", family: "'Kanit', sans-serif", category: "sans" },
  { id: "ibmplex", label: "IBM Plex Sans Thai", family: "'IBM Plex Sans Thai', sans-serif", category: "sans" },
  { id: "notosans", label: "Noto Sans Thai", family: "'Noto Sans Thai', sans-serif", category: "sans" },
  { id: "notosanslooped", label: "Noto Sans Thai Looped", family: "'Noto Sans Thai Looped', sans-serif", category: "sans" },
  { id: "notosansui", label: "Noto Sans Thai UI", family: "'Noto Sans Thai UI', sans-serif", category: "sans" },
  { id: "notoserif", label: "Noto Serif Thai", family: "'Noto Serif Thai', serif", category: "serif" },
  { id: "chakrapetch", label: "Chakra Petch", family: "'Chakra Petch', sans-serif", category: "display" },
  { id: "mitr", label: "Mitr", family: "'Mitr', sans-serif", category: "sans" },
  { id: "k2d", label: "K2D", family: "'K2D', sans-serif", category: "sans" },
  { id: "niramit", label: "Niramit", family: "'Niramit', sans-serif", category: "sans" },
  { id: "pridi", label: "Pridi", family: "'Pridi', serif", category: "serif" },
  { id: "baijamjuree", label: "Bai Jamjuree", family: "'Bai Jamjuree', sans-serif", category: "sans" },
  { id: "athiti", label: "Athiti", family: "'Athiti', sans-serif", category: "sans" },
  { id: "chonburi", label: "Chonburi", family: "'Chonburi', sans-serif", category: "display" },
  { id: "krub", label: "Krub", family: "'Krub', sans-serif", category: "sans" },
  { id: "taviraj", label: "Taviraj", family: "'Taviraj', serif", category: "serif" },
  { id: "maitree", label: "Maitree", family: "'Maitree', serif", category: "serif" },
  { id: "trirong", label: "Trirong", family: "'Trirong', serif", category: "serif" },
  { id: "kodchasan", label: "Kodchasan", family: "'Kodchasan', sans-serif", category: "sans" },
  { id: "fahkwang", label: "Fahkwang", family: "'Fahkwang', sans-serif", category: "sans" },
];

const getInitialFont = (): AppFont => {
  const savedFont = localStorage.getItem(FONT_STORAGE_KEY);

  return fontOptions.some((font) => font.id === savedFont) ? (savedFont as AppFont) : "system";
};

const FontContext = createContext<FontContextType | undefined>(undefined);

export const FontProvider = ({ children }: { children: ReactNode }) => {
  const [appFont, setAppFontState] = useState<AppFont>(getInitialFont);

  const activeFont = useMemo(() => fontOptions.find((font) => font.id === appFont) ?? fontOptions[0], [appFont]);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-app", activeFont.family);
  }, [activeFont]);

  const setAppFont = (font: AppFont) => {
    localStorage.setItem(FONT_STORAGE_KEY, font);
    setAppFontState(font);
  };

  return (
    <FontContext.Provider value={{ appFont, fontOptions, activeFont, setAppFont }}>
      {children}
    </FontContext.Provider>
  );
};

export const useFont = () => {
  const context = useContext(FontContext);

  if (!context) {
    throw new Error("useFont must be used within a FontProvider");
  }

  return context;
};
