import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "th" | "en";

interface LanguageOption {
  id: Language;
  label: string;
  nativeLabel: string;
  flag: string;
}

interface LanguageContextType {
  currentLanguage: Language;
  languageOptions: LanguageOption[];
  activeLanguage: LanguageOption;
  changeLanguage: (language: Language) => void;
  t: (key: string) => string;
}

const LANGUAGE_STORAGE_KEY = "app-language";

export const languageOptions: LanguageOption[] = [
  { id: "th", label: "Thai", nativeLabel: "ไทย", flag: "TH" },
  { id: "en", label: "English", nativeLabel: "English", flag: "EN" },
];

const getInitialLanguage = (): Language => {
  const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);

  return languageOptions.some((language) => language.id === savedLanguage) ? (savedLanguage as Language) : "th";
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [currentLanguage, setCurrentLanguage] = useState<Language>(getInitialLanguage);
  const activeLanguage = useMemo(
    () => languageOptions.find((language) => language.id === currentLanguage) ?? languageOptions[0],
    [currentLanguage],
  );

  useEffect(() => {
    document.documentElement.lang = currentLanguage;
  }, [currentLanguage]);

  const changeLanguage = (language: Language) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    setCurrentLanguage(language);
  };

  return (
    <LanguageContext.Provider value={{ currentLanguage, languageOptions, activeLanguage, changeLanguage, t: (key) => key }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
