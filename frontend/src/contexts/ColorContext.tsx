import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

export type AppColorTheme =
  | "ocean"
  | "cyan"
  | "teal"
  | "emerald"
  | "lime"
  | "amber"
  | "orange"
  | "rose"
  | "pink"
  | "fuchsia"
  | "violet"
  | "purple"
  | "indigo"
  | "slate";

interface ColorPalette {
  id: AppColorTheme;
  label: string;
  primary: string;
  primaryHover: string;
  accent: string;
  darkPrimary: string;
  darkPrimaryHover: string;
  darkAccent: string;
  appFrom: string;
  appVia: string;
  appTo: string;
  swatch: string;
}

interface ColorContextType {
  colorTheme: AppColorTheme;
  colorPalettes: ColorPalette[];
  activePalette: ColorPalette;
  setColorTheme: (theme: AppColorTheme) => void;
  colorSettings: { isEnabled: boolean };
  bgDaily: () => string;
  iconDaily: () => string;
  borderDaily: () => string;
  getDailyColorScheme: () => { hex: string; bgStyle?: CSSProperties; iconStyle?: CSSProperties; borderStyle?: CSSProperties };
}

const COLOR_STORAGE_KEY = "app-color-theme";

export const colorPalettes: ColorPalette[] = [
  {
    id: "ocean",
    label: "Ocean",
    primary: "14 165 233",
    primaryHover: "2 132 199",
    accent: "56 189 248",
    darkPrimary: "56 189 248",
    darkPrimaryHover: "14 165 233",
    darkAccent: "125 211 252",
    appFrom: "248 250 252",
    appVia: "240 249 255",
    appTo: "236 254 255",
    swatch: "#0ea5e9",
  },
  {
    id: "emerald",
    label: "Emerald",
    primary: "16 185 129",
    primaryHover: "5 150 105",
    accent: "52 211 153",
    darkPrimary: "52 211 153",
    darkPrimaryHover: "16 185 129",
    darkAccent: "110 231 183",
    appFrom: "248 250 252",
    appVia: "236 253 245",
    appTo: "240 253 250",
    swatch: "#10b981",
  },
  {
    id: "cyan",
    label: "Cyan",
    primary: "6 182 212",
    primaryHover: "8 145 178",
    accent: "34 211 238",
    darkPrimary: "34 211 238",
    darkPrimaryHover: "6 182 212",
    darkAccent: "103 232 249",
    appFrom: "248 250 252",
    appVia: "236 254 255",
    appTo: "240 253 250",
    swatch: "#06b6d4",
  },
  {
    id: "teal",
    label: "Teal",
    primary: "20 184 166",
    primaryHover: "13 148 136",
    accent: "45 212 191",
    darkPrimary: "45 212 191",
    darkPrimaryHover: "20 184 166",
    darkAccent: "94 234 212",
    appFrom: "248 250 252",
    appVia: "240 253 250",
    appTo: "236 253 245",
    swatch: "#14b8a6",
  },
  {
    id: "lime",
    label: "Lime",
    primary: "101 163 13",
    primaryHover: "77 124 15",
    accent: "132 204 22",
    darkPrimary: "163 230 53",
    darkPrimaryHover: "132 204 22",
    darkAccent: "190 242 100",
    appFrom: "250 250 245",
    appVia: "247 254 231",
    appTo: "236 253 245",
    swatch: "#65a30d",
  },
  {
    id: "orange",
    label: "Orange",
    primary: "249 115 22",
    primaryHover: "234 88 12",
    accent: "251 146 60",
    darkPrimary: "251 146 60",
    darkPrimaryHover: "249 115 22",
    darkAccent: "253 186 116",
    appFrom: "255 251 247",
    appVia: "255 247 237",
    appTo: "255 241 242",
    swatch: "#f97316",
  },
  {
    id: "pink",
    label: "Pink",
    primary: "236 72 153",
    primaryHover: "219 39 119",
    accent: "244 114 182",
    darkPrimary: "244 114 182",
    darkPrimaryHover: "236 72 153",
    darkAccent: "249 168 212",
    appFrom: "255 251 253",
    appVia: "253 242 248",
    appTo: "250 245 255",
    swatch: "#ec4899",
  },
  {
    id: "fuchsia",
    label: "Fuchsia",
    primary: "217 70 239",
    primaryHover: "192 38 211",
    accent: "232 121 249",
    darkPrimary: "232 121 249",
    darkPrimaryHover: "217 70 239",
    darkAccent: "240 171 252",
    appFrom: "255 251 255",
    appVia: "253 244 255",
    appTo: "250 245 255",
    swatch: "#d946ef",
  },
  {
    id: "purple",
    label: "Purple",
    primary: "147 51 234",
    primaryHover: "126 34 206",
    accent: "168 85 247",
    darkPrimary: "192 132 252",
    darkPrimaryHover: "168 85 247",
    darkAccent: "216 180 254",
    appFrom: "250 250 255",
    appVia: "250 245 255",
    appTo: "245 243 255",
    swatch: "#9333ea",
  },
  {
    id: "indigo",
    label: "Indigo",
    primary: "99 102 241",
    primaryHover: "79 70 229",
    accent: "129 140 248",
    darkPrimary: "129 140 248",
    darkPrimaryHover: "99 102 241",
    darkAccent: "165 180 252",
    appFrom: "248 250 252",
    appVia: "238 242 255",
    appTo: "245 243 255",
    swatch: "#6366f1",
  },
  {
    id: "slate",
    label: "Slate",
    primary: "71 85 105",
    primaryHover: "51 65 85",
    accent: "100 116 139",
    darkPrimary: "148 163 184",
    darkPrimaryHover: "100 116 139",
    darkAccent: "203 213 225",
    appFrom: "248 250 252",
    appVia: "241 245 249",
    appTo: "226 232 240",
    swatch: "#475569",
  },
  {
    id: "violet",
    label: "Violet",
    primary: "139 92 246",
    primaryHover: "124 58 237",
    accent: "167 139 250",
    darkPrimary: "167 139 250",
    darkPrimaryHover: "139 92 246",
    darkAccent: "196 181 253",
    appFrom: "250 250 255",
    appVia: "245 243 255",
    appTo: "250 245 255",
    swatch: "#8b5cf6",
  },
  {
    id: "rose",
    label: "Rose",
    primary: "244 63 94",
    primaryHover: "225 29 72",
    accent: "251 113 133",
    darkPrimary: "251 113 133",
    darkPrimaryHover: "244 63 94",
    darkAccent: "253 164 175",
    appFrom: "255 251 252",
    appVia: "255 241 242",
    appTo: "253 242 248",
    swatch: "#f43f5e",
  },
  {
    id: "amber",
    label: "Amber",
    primary: "245 158 11",
    primaryHover: "217 119 6",
    accent: "251 191 36",
    darkPrimary: "251 191 36",
    darkPrimaryHover: "245 158 11",
    darkAccent: "252 211 77",
    appFrom: "255 251 235",
    appVia: "255 247 237",
    appTo: "254 252 232",
    swatch: "#f59e0b",
  },
];

const getInitialColorTheme = (): AppColorTheme => {
  const savedTheme = localStorage.getItem(COLOR_STORAGE_KEY);

  return colorPalettes.some((palette) => palette.id === savedTheme) ? (savedTheme as AppColorTheme) : "ocean";
};

const ColorContext = createContext<ColorContextType | undefined>(undefined);

export const ColorProvider = ({ children }: { children: ReactNode }) => {
  const [colorTheme, setColorThemeState] = useState<AppColorTheme>(getInitialColorTheme);

  const activePalette = useMemo(
    () => colorPalettes.find((palette) => palette.id === colorTheme) ?? colorPalettes[0],
    [colorTheme],
  );

  useEffect(() => {
    const root = document.documentElement;

    root.style.setProperty("--color-primary", activePalette.primary);
    root.style.setProperty("--color-primary-hover", activePalette.primaryHover);
    root.style.setProperty("--color-accent", activePalette.accent);
    root.style.setProperty("--color-dark-primary", activePalette.darkPrimary);
    root.style.setProperty("--color-dark-primary-hover", activePalette.darkPrimaryHover);
    root.style.setProperty("--color-dark-accent", activePalette.darkAccent);
    root.style.setProperty("--color-app-from", activePalette.appFrom);
    root.style.setProperty("--color-app-via", activePalette.appVia);
    root.style.setProperty("--color-app-to", activePalette.appTo);
  }, [activePalette]);

  const setColorTheme = (theme: AppColorTheme) => {
    localStorage.setItem(COLOR_STORAGE_KEY, theme);
    setColorThemeState(theme);
  };

  const value: ColorContextType = {
    colorTheme,
    colorPalettes,
    activePalette,
    setColorTheme,
    colorSettings: { isEnabled: true },
    bgDaily: () => "bg-light-primary",
    iconDaily: () => "text-light-primary dark:text-dark-primary",
    borderDaily: () => "border-light-primary dark:border-dark-primary",
    getDailyColorScheme: () => ({ hex: activePalette.swatch }),
  };

  return <ColorContext.Provider value={value}>{children}</ColorContext.Provider>;
};

export const useColor = () => {
  const context = useContext(ColorContext);

  if (!context) {
    throw new Error("useColor must be used within a ColorProvider");
  }

  return context;
};
