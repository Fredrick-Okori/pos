/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans:  ['var(--font-sans)', 'Google Sans', 'sans-serif'],
        serif: ['var(--font-serif)', 'Fraunces', 'serif'],
        mono:  ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        navy: {
          950: '#070F1A',
          900: '#0C1A2E',
          850: '#0E1E35',
          800: '#112240',
          750: '#152848',
          700: '#1C325A',
          600: '#0C2340',
          500: '#112B4E',
          400: '#1A3A62',
          300: '#1E4A7A',
          200: '#2563A8',
        },
        gold: {
          300: '#F0D98A',
          400: '#E8C97A',
          500: '#C9A84C',
          600: '#A88A30',
        },
      },
    },
  },
  plugins: [],
}
