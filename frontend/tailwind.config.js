/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0B1F3A',
          soft: '#3D4E66',
          mute: '#64748B',
        },
        brand: {
          50: '#EAF8FE',
          100: '#D0F0FD',
          200: '#A5E3FB',
          300: '#6ECDF7',
          400: '#33BCF4',
          500: '#00BAF2',
          600: '#009AD0',
          700: '#007CA9',
          800: '#046386',
          900: '#084F6B',
        },
        teal: {
          50: '#ECFBF9',
          100: '#D0F6F1',
          500: '#0EA5A4',
          600: '#0B8483',
          700: '#0A6B6A',
        },
        surface: '#F5F8FC',
        line: '#E4EAF2',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        num: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,31,58,0.04), 0 6px 20px -12px rgba(11,31,58,0.18)',
        pop: '0 12px 40px -12px rgba(11,31,58,0.28)',
      },
      borderRadius: {
        xl2: '1.125rem',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 0.28s ease-out both',
        popIn: 'popIn 0.18s ease-out both',
      },
    },
  },
  plugins: [],
}
