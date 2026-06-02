// contexts/ViewModeContext.tsx
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type ViewMode = 'web' | 'desktop'

interface ViewModeContextType {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined)

interface ViewModeProviderProps {
  children: ReactNode
}

// ฟังก์ชันอ่านค่าจาก environment variable
const getDefaultViewMode = (): ViewMode => {
  const envViewMode = import.meta.env.VITE_VIEW_MODE
  
  // ถ้ามีค่าใน .env และเป็นค่าที่ถูกต้อง
  if (envViewMode === 'desktop' || envViewMode === 'web') {
    return envViewMode as ViewMode
  }
  
  // ถ้าไม่มีหรือค่าไม่ถูกต้อง ให้ default เป็น web
  return 'web'
}

export const ViewModeProvider: React.FC<ViewModeProviderProps> = ({ children }) => {
  // ตั้งค่า initial state จาก environment variable
  const [viewMode, setViewModeState] = useState<ViewMode>(getDefaultViewMode())

  // โหลดจาก localStorage เมื่อ component mount
  useEffect(() => {
    const savedViewMode = localStorage.getItem('viewMode') as ViewMode
    
    if (savedViewMode && (savedViewMode === 'web' || savedViewMode === 'desktop')) {
      // ถ้ามีค่าใน localStorage ให้ใช้ค่านั้น (มีความสำคัญสูงสุด)
      setViewModeState(savedViewMode)
    } else {
      // ถ้าไม่มีใน localStorage ให้ใช้ค่าจาก env และบันทึกลง localStorage
      const defaultMode = getDefaultViewMode()
      setViewModeState(defaultMode)
      localStorage.setItem('viewMode', defaultMode)
    }
  }, [])

  // ฟังก์ชันเซ็ต viewMode และเก็บใน localStorage
  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode)
    localStorage.setItem('viewMode', mode)
  }

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  )
}

export const useViewMode = (): ViewModeContextType => {
  const context = useContext(ViewModeContext)
  if (!context) {
    throw new Error('useViewMode must be used within a ViewModeProvider')
  }
  return context
}
