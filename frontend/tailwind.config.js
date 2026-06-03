/** @type {import('tailwindcss').Config} */
import plugin from 'tailwindcss/plugin'
import typography from '@tailwindcss/typography'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  safelist: [],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-app)', 'sans-serif'],
        anakotmai: ['Anakotmai', 'sans-serif'],
        sarabun: ['Sarabun', 'sans-serif'],
        prompt: ['Prompt', 'sans-serif'],
        kanit: ['Kanit', 'sans-serif'],
        ibmplex: ['IBM Plex Sans Thai', 'sans-serif'],
        notosans: ['Noto Sans Thai', 'sans-serif'],
        notosanslooped: ['Noto Sans Thai Looped', 'sans-serif'],
        notosansui: ['Noto Sans Thai UI', 'sans-serif'],
        notoserif: ['Noto Serif Thai', 'serif'],
        chakrapetch: ['Chakra Petch', 'sans-serif'],
        mitr: ['Mitr', 'sans-serif'],
        k2d: ['K2D', 'sans-serif'],
        niramit: ['Niramit', 'sans-serif'],
        pridi: ['Pridi', 'serif'],
        baijamjuree: ['Bai Jamjuree', 'sans-serif'],
        athiti: ['Athiti', 'sans-serif'],
        chonburi: ['Chonburi', 'sans-serif'],
        krub: ['Krub', 'sans-serif'],
        taviraj: ['Taviraj', 'serif'],
        maitree: ['Maitree', 'serif'],
        trirong: ['Trirong', 'serif'],
        kodchasan: ['Kodchasan', 'sans-serif'],
        fahkwang: ['Fahkwang', 'sans-serif'],
      },
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
          primary: 'rgb(var(--color-primary) / <alpha-value>)',
          'primary-hover': 'rgb(var(--color-primary-hover) / <alpha-value>)',
          secondary: '#64748b',     // Slate blue
          'secondary-hover': '#475569',
          accent: 'rgb(var(--color-accent) / <alpha-value>)',

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
          primary: 'rgb(var(--color-dark-primary) / <alpha-value>)',
          'primary-hover': 'rgb(var(--color-dark-primary-hover) / <alpha-value>)',
          secondary: '#64748b',     // Same slate
          'secondary-hover': '#94a3b8',
          accent: 'rgb(var(--color-dark-accent) / <alpha-value>)',

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
          background:
            'linear-gradient(135deg, rgb(var(--color-app-from)) 0%, rgb(var(--color-app-via)) 48%, rgb(var(--color-app-to)) 100%)',
        },

        '.dark .bg-app': {
          background:
            'linear-gradient(135deg, #0f172a 0%, #1e293b 52%, rgb(var(--color-dark-primary) / 0.18) 100%)',
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
          '@apply bg-light-primary/10 text-light-text font-semibold dark:bg-dark-primary/10 dark:text-dark-text': {},
        },

        '.table-row': {
          '@apply border-b border-light-border-light hover:bg-light-primary/10 transition-colors duration-150 dark:border-dark-border-light dark:hover:bg-dark-primary/10': {},
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
          boxShadow: '0 12px 30px rgb(var(--color-primary) / 0.1)',
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
