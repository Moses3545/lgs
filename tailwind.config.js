/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#F2F2F7', // iOS System Grouped Background
        paper: '#FFFFFF', // iOS Card Background
        ink: '#1C1C1E', // Apple Primary Label
        muted: '#8E8E93', // Apple Secondary Label
        brandRed: '#FF3B30', // Apple System Red
        brandGreen: '#34C759', // Apple System Green
        brandGold: '#FF9500', // Apple System Orange / Gold
        brandBlue: '#007AFF', // Apple System Blue
        dangerBg: '#FFECEB',
        successBg: '#EBF9EE',
      },
      fontFamily: {
        serif: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', 'Inter', 'sans-serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'Inter', 'sans-serif'],
        mono: ['"SF Mono"', '"SF Pro Rounded"', 'Menlo', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        ios: '0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03)',
        'ios-hover': '0 8px 24px -4px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)',
        'ios-active': '0 1px 2px rgba(0, 0, 0, 0.1)',
        notebook: '0 1px 3px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.03)',
        subtle: '0 1px 2px rgba(0,0,0,0.04)',
      }
    },
  },
  plugins: [],
}
