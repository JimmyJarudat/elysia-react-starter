/** @type {import('tailwindcss').Config} */
import plugin from 'tailwindcss/plugin'
import typography from '@tailwindcss/typography'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  // เพิ่ม safelist เพื่อให้ Tailwind รวม dynamic classes เข้ามาใน CSS bundle
  safelist: [
    // Pattern-based safelist สำหรับสีทั้งหมดที่อาจใช้แบบ dynamic
    {
      pattern: /^(bg|text|border|ring)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)$/,
      variants: ['hover', 'focus', 'active', 'dark', 'dark:hover']
    },
    
    // Gradient และ utility classes ที่อาจใช้
    {
      pattern: /^(from|to|via)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)$/
    },
    // Border และ ring utilities
    {
      pattern: /^border-(l|r|t|b)-2$/
    },
    {
      pattern: /^border-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)\/\d+$/
    },
    // สำหรับ opacity variants
    {
      pattern: /^(bg|text|border)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)\/\d+$/
    },
    
    // Classes ที่ใช้ใน ColorContext โดยเฉพาะ
    'text-blue-600', 'text-green-600', 'text-purple-600', 'text-orange-600', 
    'text-pink-600', 'text-red-600', 'text-yellow-600', 'text-slate-600', 'text-gray-600',
    'hover:bg-blue-600', 'hover:bg-green-600', 'hover:bg-purple-600', 'hover:bg-orange-600',
    'hover:bg-pink-600', 'hover:bg-red-600', 'hover:bg-yellow-600', 'hover:bg-slate-600', 'hover:bg-gray-600',
    'hover:text-blue-600', 'hover:text-green-600', 'hover:text-purple-600', 'hover:text-orange-600',
    'hover:text-pink-600', 'hover:text-red-600', 'hover:text-yellow-600', 'hover:text-slate-600', 'hover:text-gray-600',
    // Background variants
    'bg-blue-50', 'bg-green-50', 'bg-purple-50', 'bg-orange-50', 'bg-pink-50', 'bg-red-50', 'bg-yellow-50', 'bg-slate-50', 'bg-gray-50',
    'bg-blue-600', 'bg-green-600', 'bg-purple-600', 'bg-orange-600', 'bg-pink-600', 'bg-red-600', 'bg-yellow-600', 'bg-slate-600', 'bg-gray-600',
    'bg-blue-950', 'bg-green-950', 'bg-purple-950', 'bg-orange-950', 'bg-pink-950', 'bg-red-950', 'bg-yellow-950', 'bg-slate-950', 'bg-gray-950',
    // Border และ ring
    'border-blue-500', 'border-green-500', 'border-purple-500', 'border-orange-500', 'border-pink-500', 'border-red-500', 'border-yellow-500', 'border-slate-500', 'border-gray-500',
    'ring-blue-500', 'ring-green-500', 'ring-purple-500', 'ring-orange-500', 'ring-pink-500', 'ring-red-500', 'ring-yellow-500', 'ring-slate-500', 'ring-gray-500',
    // สำหรับ opacity variants ที่ใช้ใน Sidebar
    'from-blue-500/20', 'to-blue-500/15', 'border-blue-500/40',
    'from-green-500/20', 'to-green-500/15', 'border-green-500/40',
    'from-purple-500/20', 'to-purple-500/15', 'border-purple-500/40',
    'from-orange-500/20', 'to-orange-500/15', 'border-orange-500/40',
    'from-pink-500/20', 'to-pink-500/15', 'border-pink-500/40',
    'from-red-500/20', 'to-red-500/15', 'border-red-500/40',
    'from-yellow-500/20', 'to-yellow-500/15', 'border-yellow-500/40',
    'from-slate-500/20', 'to-slate-500/15', 'border-slate-500/40',
    'from-gray-500/20', 'to-gray-500/15', 'border-gray-500/40',
  ],
  theme: {
    extend: {
      colors: {
        // ========== Modern Blue Theme ==========
        // Primary Blue Palette - โทนน้ำเงินทันสมัย
        'ocean': {
          50: '#f0f9ff',   // Very light blue
          100: '#e0f2fe',  // Light blue
          200: '#bae6fd',  // Soft blue
          300: '#7dd3fc',  // Medium blue
          400: '#38bdf8',  // Bright blue
          500: '#0ea5e9',  // Main blue
          600: '#0284c7',  // Deep blue
          700: '#0369a1',  // Darker blue
          800: '#075985',  // Very dark blue
          900: '#0c4a6e',  // Navy blue
        },

        // Secondary Slate Palette - โทนเทาน้ำเงิน
        'slate-blue': {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },

        // ========== Light Theme Colors ==========
        light: {
          primary: '#0ea5e9',      // Main ocean blue
          'primary-hover': '#0284c7', // Deeper on hover
          secondary: '#64748b',     // Slate blue
          'secondary-hover': '#475569',
          accent: '#38bdf8',       // Bright blue accent

          background: '#ffffff',
          'background-soft': '#f8fafc',
          'background-card': '#ffffff',

          text: '#0f172a',         // Dark slate
          'text-muted': '#64748b', // Muted slate
          'text-light': '#94a3b8', // Light slate

          border: '#e2e8f0',       // Light slate border
          'border-light': '#f1f5f9',
        },

        // ========== Dark Theme Colors ==========
        dark: {
          primary: '#38bdf8',      // Brighter blue for dark
          'primary-hover': '#0ea5e9',
          secondary: '#64748b',     // Same slate
          'secondary-hover': '#94a3b8',
          accent: '#7dd3fc',       // Light blue accent

          background: '#0f172a',    // Very dark slate
          'background-soft': '#1e293b', // Dark slate
          'background-card': '#334155', // Medium slate

          text: '#f8fafc',         // Very light
          'text-muted': '#cbd5e1', // Light slate
          'text-light': '#94a3b8', // Medium slate

          border: '#334155',       // Medium slate border
          'border-light': '#1e293b',
        },

        // ========== Status Colors ==========
        success: '#22c55e',  // Green
        warning: '#f59e0b',  // Amber
        error: '#ef4444',    // Red
        info: '#0ea5e9',     // Blue (same as primary)
      },
    },
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities({
        // ========== Background Styles ==========
        '.bg-app': {
          '@apply bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700': {},
        },

        '.bg-card': {
          '@apply bg-light-background-card/80 backdrop-blur-sm border border-light-border dark:bg-dark-background-card/80 dark:border-dark-border': {},
        },

        '.bg-surface': {
          '@apply bg-light-background-soft dark:bg-dark-background-soft': {},
        },

        // ========== Text Styles ==========
        '.text-primary': {
          '@apply text-light-text dark:text-dark-text': {},
        },

        '.text-secondary': {
          '@apply text-light-text-muted dark:text-dark-text-muted': {},
        },

        '.text-subtle': {
          '@apply text-light-text-light dark:text-dark-text-light': {},
        },

        // ========== Button Styles ==========
        '.btn-primary': {
          '@apply bg-light-primary hover:bg-light-primary-hover text-white font-medium px-4 py-2 rounded-lg transition-colors duration-200 dark:bg-dark-primary dark:hover:bg-dark-primary-hover': {},
        },

        '.btn-secondary': {
          '@apply bg-light-secondary hover:bg-light-secondary-hover text-white font-medium px-4 py-2 rounded-lg transition-colors duration-200 dark:bg-dark-secondary dark:hover:bg-dark-secondary-hover': {},
        },

        '.btn-outline': {
          '@apply border border-light-primary text-light-primary hover:bg-light-primary hover:text-white font-medium px-4 py-2 rounded-lg transition-all duration-200 dark:border-dark-primary dark:text-dark-primary dark:hover:bg-dark-primary dark:hover:text-dark-background': {},
        },

        // ========== Table Styles ==========
        '.table-container': {
          '@apply bg-light-background-card/50 backdrop-blur-sm border border-light-border rounded-lg dark:bg-dark-background-card/50 dark:border-dark-border': {},
        },

        '.table-header': {
          '@apply bg-ocean-100/80 text-light-text font-semibold dark:bg-slate-blue-700/80 dark:text-dark-text': {},
        },

        '.table-row': {
          '@apply border-b border-light-border-light hover:bg-ocean-50/30 transition-colors duration-150 dark:border-dark-border-light dark:hover:bg-slate-blue-800/30': {},
        },

        '.table-cell': {
          '@apply text-light-text dark:text-dark-text': {},
        },

        // ========== Form Styles ==========
        '.input-field': {
          '@apply bg-light-background-soft border border-light-border rounded-lg px-3 py-2 text-light-text placeholder-light-text-light focus:outline-none focus:ring-2 focus:ring-light-primary focus:border-transparent dark:bg-dark-background-soft dark:border-dark-border dark:text-dark-text dark:placeholder-dark-text-light dark:focus:ring-dark-primary': {},
        },

        // ========== Utility Classes ==========
        '.shadow-soft': {
          '@apply shadow-lg shadow-ocean-500/10 dark:shadow-slate-blue-900/20': {},
        },

        '.border-theme': {
          '@apply border-light-border dark:border-dark-border': {},
        },

        '.divider': {
          '@apply h-px bg-gradient-to-r from-transparent via-light-border to-transparent dark:via-dark-border': {},
        },
      })
    }),
    typography,
  ]
}
