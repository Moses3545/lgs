/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#F7F2E6',
        paper: '#FFFDF8',
        ink: '#2A2A24',
        muted: '#8B8577',
        brandRed: '#C0392B',
        brandGreen: '#2F6F4F',
        brandGold: '#B8902E',
        dangerBg: '#FBEAE7',
        successBg: '#EAF3EC',
      },
      fontFamily: {
        serif: ['Fraunces', 'serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        notebook: '0 1px 2px rgba(42,42,36,0.06), 0 4px 14px rgba(42,42,36,0.08)',
        subtle: '0 1px 3px rgba(42,42,36,0.05)',
      }
    },
  },
  plugins: [],
}
