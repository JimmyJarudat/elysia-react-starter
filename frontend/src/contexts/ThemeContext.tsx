import React, { createContext, useState, useContext, useEffect } from 'react';

type Theme = 'light' | 'dark';
export type ThemeMode = Theme | 'system';

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_STORAGE_KEY = 'theme-mode';

const getSystemTheme = (): Theme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const getInitialThemeMode = (): ThemeMode => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
    return savedTheme;
  }

  return 'light';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getInitialThemeMode);
  const [theme, setTheme] = useState<Theme>(() => {
    const initialThemeMode = getInitialThemeMode();

    return initialThemeMode === 'system' ? getSystemTheme() : initialThemeMode;
  });
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const resolveTheme = () => {
      setTheme(themeMode === 'system' ? getSystemTheme() : themeMode);
    };

    resolveTheme();

    if (themeMode !== 'system') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', resolveTheme);

    return () => {
      mediaQuery.removeEventListener('change', resolveTheme);
    };
  }, [themeMode]);

  const setThemeMode = (mode: ThemeMode) => {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
    setThemeModeState(mode);
  };

  const toggleTheme = () => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    
    // เพิ่มเวลาให้แอนิเมชันช้าลง
    setTimeout(() => {
      setThemeMode(theme === 'light' ? 'dark' : 'light');
      setTimeout(() => {
        setIsAnimating(false);
      }, 600);
    }, 1800); // เพิ่มจาก 1000ms เป็น 1800ms
  };

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, toggleTheme }}>
      {children}
      {isAnimating && <NovaTransitionOverlay theme={theme} />}
    </ThemeContext.Provider>
  );
};

const NovaTransitionOverlay: React.FC<{ theme: Theme }> = ({ theme }) => {
  const keyframes = `
    @keyframes novaSlide {
      0% {
        left: -120px;
        transform: translateY(-50%) scale(0.6);
        filter: blur(6px);
        opacity: 0;
      }
      10% {
        opacity: 1;
        filter: blur(2px);
      }
      20% {
        transform: translateY(-50%) scale(1);
        filter: blur(0px);
      }
      80% {
        transform: translateY(-50%) scale(1);
        filter: blur(0px);
      }
      90% {
        filter: blur(2px);
      }
      100% {
        left: calc(100% + 120px);
        transform: translateY(-50%) scale(0.6);
        filter: blur(6px);
        opacity: 0;
      }
    }
    
    @keyframes novaWave {
      0% { 
        opacity: 0; 
        background: linear-gradient(90deg, 
          transparent 0%,
          rgba(99, 102, 241, 0.05) 20%,
          rgba(139, 92, 246, 0.1) 50%,
          rgba(99, 102, 241, 0.05) 80%,
          transparent 100%
        );
      }
      30% { 
        opacity: 0.8;
      }
      70% { 
        opacity: 0.8;
        background: linear-gradient(90deg, 
          transparent 0%,
          rgba(99, 102, 241, 0.2) 20%,
          rgba(139, 92, 246, 0.4) 50%,
          rgba(99, 102, 241, 0.2) 80%,
          transparent 100%
        );
      }
      100% { 
        opacity: 0;
      }
    }
    
    @keyframes novaGlow {
      0% { 
        opacity: 0; 
        transform: scale(0.3) rotate(0deg);
        filter: blur(10px);
      }
      20% { 
        opacity: 0.6; 
        filter: blur(4px);
      }
      50% { 
        opacity: 1; 
        transform: scale(1) rotate(180deg);
        filter: blur(1px);
      }
      80% { 
        opacity: 0.6; 
        transform: scale(1.1) rotate(300deg);
        filter: blur(4px);
      }
      100% { 
        opacity: 0; 
        transform: scale(0.3) rotate(360deg);
        filter: blur(10px);
      }
    }
    
    @keyframes novaRipple {
      0% {
        transform: scale(0);
        opacity: 0.8;
      }
      50% {
        opacity: 0.4;
      }
      100% {
        transform: scale(6);
        opacity: 0;
      }
    }
    
    @keyframes novaPulse {
      0%, 100% { 
        opacity: 0.3;
        transform: scale(0.9);
      }
      50% { 
        opacity: 0.8;
        transform: scale(1.2);
      }
    }
  `;

  React.useEffect(() => {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = keyframes;
    document.head.appendChild(styleSheet);
    
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {/* Gradient Wave Background */}
      <div 
        className="absolute inset-0"
        style={{
          animation: 'novaWave 2.4s ease-in-out' // เพิ่มจาก 1.4s เป็น 2.4s
        }}
      />
      
      {/* Ripple Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div 
          className="w-32 h-32 rounded-full border-2 border-purple-400/20"
          style={{
            animation: 'novaRipple 2s ease-out' // เพิ่มจาก 1.2s เป็น 2s
          }}
        />
        <div 
          className="absolute top-0 left-0 w-32 h-32 rounded-full border-2 border-indigo-400/15"
          style={{
            animation: 'novaRipple 2s ease-out 0.4s' // เพิ่ม delay
          }}
        />
        <div 
          className="absolute top-0 left-0 w-32 h-32 rounded-full border border-purple-300/10"
          style={{
            animation: 'novaRipple 2s ease-out 0.8s' // เพิ่ม ripple ที่ 3
          }}
        />
      </div>
      
      {/* Main Character */}
      <div 
        className="absolute top-1/2 -translate-y-1/2 flex items-center"
        style={{
          animation: 'novaSlide 1.8s ease-in-out' // เพิ่มจาก 1s เป็น 1.8s
        }}
      >
        <div className="relative">
          {/* Character Glow */}
          <div 
            className="absolute -inset-4 rounded-full"
            style={{
              background: theme === 'light' 
                ? 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.1) 40%, transparent 70%)'
                : 'radial-gradient(circle, rgba(251, 191, 36, 0.3) 0%, rgba(251, 191, 36, 0.1) 40%, transparent 70%)',
              animation: 'novaPulse 3s ease-in-out infinite' // เพิ่มจาก 2s เป็น 3s
            }}
          />
          
          {/* Main Character */}
          <div className="relative text-8xl font-bold drop-shadow-2xl">
            {theme === 'light' ? '🌙' : '☀️'}
          </div>
          
          {/* Trailing Effect */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 -left-12 w-24 h-2 rounded-full"
            style={{
              background: theme === 'light' 
                ? 'linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.4), rgba(139, 92, 246, 0.8), rgba(139, 92, 246, 0.4), transparent)'
                : 'linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.4), rgba(251, 191, 36, 0.8), rgba(251, 191, 36, 0.4), transparent)'
            }}
          />
        </div>
      </div>
      
      {/* Floating Particles */}
      <div className="absolute inset-0">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{
              left: `${10 + i * 6}%`,
              top: `${20 + (i % 5) * 12}%`,
              background: i % 3 === 0 
                ? 'linear-gradient(45deg, #8b5cf6, #06b6d4)' 
                : i % 3 === 1
                ? 'linear-gradient(45deg, #f59e0b, #ef4444)'
                : 'linear-gradient(45deg, #10b981, #8b5cf6)',
              boxShadow: '0 0 12px currentColor',
              animationDelay: `${i * 0.12}s`, // เพิ่ม delay
              animation: 'novaGlow 2s ease-in-out' // เพิ่มจาก 1.2s เป็น 2s
            }}
          />
        ))}
      </div>
    </div>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};




