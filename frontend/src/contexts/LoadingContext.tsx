"use client";
import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";

// กำหนดประเภทของ Context
interface LoadingContextType {
  loading: boolean;
  showLoading: () => void;
  hideLoading: () => void;
}

// สร้าง Context พร้อมค่าเริ่มต้น
const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

// สร้าง Provider
interface LoadingProviderProps {
  children: ReactNode;
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [loading, setLoading] = useState<boolean>(false);

  const showLoading = () => setLoading(true);
  const hideLoading = () => setLoading(false);

  const message = 'กำลังโหลด...'
  const [currentIcon, setCurrentIcon] = useState(0);

  const icons = [
    { icon: '⚡', color: 'from-yellow-400 to-orange-500', shadow: 'shadow-yellow-500/50' },
    { icon: '🚀', color: 'from-blue-400 to-purple-500', shadow: 'shadow-blue-500/50' },
    { icon: '✨', color: 'from-pink-400 to-purple-500', shadow: 'shadow-pink-500/50' },
    { icon: '🌟', color: 'from-yellow-300 to-pink-400', shadow: 'shadow-yellow-400/50' },
    { icon: '💫', color: 'from-purple-400 to-blue-500', shadow: 'shadow-purple-500/50' },
    { icon: '🔥', color: 'from-red-400 to-orange-500', shadow: 'shadow-red-500/50' }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIcon((prev) => (prev + 1) % icons.length);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <LoadingContext.Provider value={{ loading, showLoading, hideLoading }}>
      {children}

      {/* Modern Spinner Overlay */}
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-blue/100 dark:bg-black/70 backdrop-blur-sm z-50 animate-in fade-in duration-500">

          {/* Main Icon Container - No Background */}
          <div className="relative flex flex-col items-center">

            {/* Magical Icon Animation */}
            <div className="relative mb-6">
              {/* Outer Magic Aura */}
              <div className="absolute -inset-8 rounded-full bg-gradient-to-r from-purple-500/8 via-pink-500/8 to-blue-500/8 animate-spin [animation-duration:6s] blur-xl"></div>

              {/* Secondary Aura */}
              <div className="absolute -inset-6 rounded-full bg-gradient-to-r from-blue-500/12 via-purple-500/12 to-pink-500/12 animate-spin [animation-duration:4s] [animation-direction:reverse] blur-lg"></div>

              {/* Magic Particles Orbit */}
              <div className="absolute -inset-5 rounded-full animate-spin [animation-duration:3s]">
                <div className="absolute top-0 left-1/2 w-2 h-2 bg-yellow-400 rounded-full animate-pulse blur-sm opacity-60"></div>
                <div className="absolute bottom-0 left-1/2 w-1.5 h-1.5 bg-pink-400 rounded-full animate-pulse [animation-delay:0.5s] blur-sm opacity-60"></div>
                <div className="absolute left-0 top-1/2 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse [animation-delay:1s] blur-sm opacity-60"></div>
                <div className="absolute right-0 top-1/2 w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse [animation-delay:1.5s] blur-sm opacity-60"></div>
              </div>

              {/* Inner Magic Circle */}
              <div className="absolute -inset-3 rounded-full border border-dashed border-white/15 dark:border-gray-300/15 animate-spin [animation-duration:2s] [animation-direction:reverse]"></div>

              {/* Main Icon */}
              <div className="relative w-20 h-20 flex items-center justify-center">
                {/* Icon Glow */}
                <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${icons[currentIcon].color} opacity-25 animate-pulse [animation-duration:2s] blur-md`}></div>

                {/* The Icon */}
                <div className="relative z-10 text-4xl animate-bounce [animation-duration:2.5s] transform transition-all duration-500 drop-shadow-lg">
                  {icons[currentIcon].icon}
                </div>

                {/* Sparkle Ring */}
                <div className="absolute inset-0 animate-spin [animation-duration:3s]">
                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
                    <div className="w-2 h-2 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full animate-ping opacity-60"></div>
                  </div>
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                    <div className="w-1.5 h-1.5 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full animate-ping [animation-delay:0.5s] opacity-60"></div>
                  </div>
                  <div className="absolute -left-1 top-1/2 transform -translate-y-1/2">
                    <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full animate-ping [animation-delay:1s] opacity-60"></div>
                  </div>
                  <div className="absolute -right-1 top-1/2 transform -translate-y-1/2">
                    <div className="w-1.5 h-1.5 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full animate-ping [animation-delay:1.5s] opacity-60"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Text */}
            <div className="text-center space-y-4">
              <div className="relative">
                <h3 className="text-lg font-semibold bg-blue-600  dark:from-gray-100 dark:via-white dark:to-gray-100 bg-clip-text text-transparent animate-pulse drop-shadow-md">
                  {message}
                </h3>
                <div className="absolute -bottom-1 left-1/2 w-16 h-0.5 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 rounded-full transform -translate-x-1/2 animate-pulse opacity-70"></div>
              </div>

              {/* Floating Magic Dots */}
              <div className="flex justify-center space-x-3">
                <div className="w-2.5 h-2.5 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full animate-bounce [animation-delay:-0.6s] [animation-duration:1.8s] opacity-80"></div>
                <div className="w-2.5 h-2.5 bg-gradient-to-r from-pink-400 to-blue-400 rounded-full animate-bounce [animation-delay:-0.3s] [animation-duration:1.8s] opacity-80"></div>
                <div className="w-2.5 h-2.5 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full animate-bounce [animation-duration:1.8s] opacity-80"></div>
              </div>
            </div>

            {/* Floating Progress Indicator */}
            <div className="mt-6 w-48 h-1.5 bg-white/15 dark:bg-gray-700/30 rounded-full overflow-hidden backdrop-blur-sm">
              <div className="h-full bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 rounded-full animate-pulse shadow-md relative opacity-70">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse [animation-duration:2.5s]"></div>
              </div>
            </div>

            {/* Magical Floating Elements */}
            <div className="absolute inset-0 w-screen h-screen pointer-events-none">
              {/* Large Floating Icons */}
              <div className="absolute top-1/4 left-1/4 text-xl text-yellow-400/40 animate-bounce [animation-delay:0s] [animation-duration:4s] blur-sm">⭐</div>
              <div className="absolute top-1/3 right-1/4 text-lg text-pink-400/40 animate-bounce [animation-delay:1s] [animation-duration:3.5s] blur-sm">✨</div>
              <div className="absolute bottom-1/4 left-1/3 text-lg text-blue-400/40 animate-bounce [animation-delay:2s] [animation-duration:4.5s] blur-sm">💫</div>
              <div className="absolute bottom-1/3 right-1/3 text-xl text-purple-400/40 animate-bounce [animation-delay:1.5s] [animation-duration:3.8s] blur-sm">🌟</div>

              {/* Small Floating Particles */}
              <div className="absolute top-20 left-20 w-2 h-2 bg-gradient-to-r from-yellow-400/30 to-orange-400/30 rounded-full animate-ping [animation-delay:0.5s] [animation-duration:3s] blur-sm"></div>
              <div className="absolute top-32 right-24 w-1.5 h-1.5 bg-gradient-to-r from-pink-400/30 to-purple-400/30 rounded-full animate-ping [animation-delay:1.2s] [animation-duration:2.5s] blur-sm"></div>
              <div className="absolute bottom-20 left-24 w-2.5 h-2.5 bg-gradient-to-r from-blue-400/30 to-cyan-400/30 rounded-full animate-ping [animation-delay:0.8s] [animation-duration:3.5s] blur-sm"></div>
              <div className="absolute bottom-32 right-20 w-2 h-2 bg-gradient-to-r from-purple-400/30 to-pink-400/30 rounded-full animate-ping [animation-delay:1.8s] [animation-duration:2.8s] blur-sm"></div>

              {/* Corner Sparkles */}
              <div className="absolute top-12 left-12 w-1 h-1 bg-white/40 rounded-full animate-pulse [animation-delay:0.3s] [animation-duration:2s] blur-sm"></div>
              <div className="absolute top-16 right-16 w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse [animation-delay:0.8s] [animation-duration:2.5s] blur-sm"></div>
              <div className="absolute bottom-12 left-16 w-1 h-1 bg-white/40 rounded-full animate-pulse [animation-delay:1.3s] [animation-duration:2.2s] blur-sm"></div>
              <div className="absolute bottom-16 right-12 w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse [animation-delay:1.8s] [animation-duration:2.8s] blur-sm"></div>
            </div>

          </div>
        </div>
      )}
    </LoadingContext.Provider>
  );
};

// สร้าง Hook สำหรับเรียกใช้ Context
export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
};
