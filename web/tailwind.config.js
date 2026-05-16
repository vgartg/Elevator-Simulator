/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,html}'],
  theme: {
    extend: {
      colors: {
        gopher: {
          50: '#e6f9fd',
          100: '#b8eef7',
          200: '#82e1ef',
          300: '#46d2e7',
          400: '#1bc1dd',
          500: '#00ADD8',
          600: '#0089ad',
          700: '#016883',
          800: '#02485d',
          900: '#012a37',
        },
        ink: {
          900: '#0b1220',
          800: '#111a2e',
          700: '#1a2540',
          600: '#243156',
          500: '#33446e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(0,173,216,0.35), 0 10px 40px -10px rgba(0,173,216,0.55)',
        soft: '0 10px 30px -12px rgba(2,8,23,0.5)',
      },
      keyframes: {
        flash: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        flash: 'flash 0.9s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
