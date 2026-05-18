/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,html}'],
  theme: {
    extend: {
      colors: {
        paper: { 50: '#FAF6E9', 100: '#F1ECDC', 200: '#E5DDC4', 300: '#D1C9B6' },
        ink: { 900: '#0E1B2C', 800: '#1F2D44', 700: '#3A4863', 500: '#4E5D75', 400: '#8895A8' },
        gopher: {
          100: '#D6F1F8', 200: '#B7E4EF', 400: '#1BC1DD',
          500: '#00ADD8', 600: '#0089AD', 700: '#016883',
        },
        amber: { 500: '#C97921', 600: '#A55F15' },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
