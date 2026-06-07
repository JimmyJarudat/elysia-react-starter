import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/contexts/SessionContext";

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

  return languageOptions.some((language) => language.id === savedLanguage) ? (savedLanguage as Language) : "en";
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const toClientLanguage = (language?: string | null): Language => {
  return language?.trim().toUpperCase() === "TH" ? "th" : "en";
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const { patch } = useApi();
  const { user, updateUser } = useSession();
  const [currentLanguage, setCurrentLanguage] = useState<Language>(getInitialLanguage);
  const activeLanguage = useMemo(
    () => languageOptions.find((language) => language.id === currentLanguage) ?? languageOptions[0],
    [currentLanguage],
  );

  useEffect(() => {
    document.documentElement.lang = currentLanguage;
  }, [currentLanguage]);

  useEffect(() => {
    if (!user?.language) return;

    const backendLanguage = toClientLanguage(user.language);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, backendLanguage);
    setCurrentLanguage(backendLanguage);
  }, [user?.language]);

  const changeLanguage = (language: Language) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    setCurrentLanguage(language);
    updateUser(user ? { ...user, language: language.toUpperCase() as "EN" | "TH" } : user);
    void patch("/profile/language", { language: language.toUpperCase() }, { skipAuthRefresh: true }).catch(() => {
      /* Keep local preference when backend is unavailable or the user is not signed in. */
    });
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
