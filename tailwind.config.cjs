/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        flow: {
          bg: '#08090A',
          'bg-elevated': '#0D0E10',
          surface: '#111214',
          elevated: '#111214',
          hover: '#15171A',
          active: '#1A1C1F',
          primary: '#FAFAFA',
          secondary: '#B8B8B8',
          tertiary: '#8A8D93',
          muted: '#686C72',
          border: '#1f2023',
          'border-strong': '#2a2b2f',
          accent: '#E8E8E8',
          danger: '#D94A4A',
        },
      },
      fontFamily: {
        sans: ['"Segoe UI Variable Text"', '"Segoe UI Variable"', '"Segoe UI"', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        flow: '0 4px 24px -4px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        'flow-modal': '0 12px 48px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.04)',
      },
    },
  },
  plugins: [],
}
