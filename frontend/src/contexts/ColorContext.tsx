import { createContext, useContext, type CSSProperties, type ReactNode } from "react";

interface ColorContextType {
  colorSettings: { isEnabled: boolean };
  bgDaily: () => string;
  iconDaily: () => string;
  borderDaily: () => string;
  getDailyColorScheme: () => { hex: string; bgStyle?: CSSProperties; iconStyle?: CSSProperties; borderStyle?: CSSProperties };
}

const ColorContext = createContext<ColorContextType | undefined>(undefined);

export const ColorProvider = ({ children }: { children: ReactNode }) => {
  const value: ColorContextType = {
    colorSettings: { isEnabled: false },
    bgDaily: () => "bg-blue-500",
    iconDaily: () => "text-blue-600",
    borderDaily: () => "border-blue-500",
    getDailyColorScheme: () => ({ hex: "#0f7ea8" }),
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
