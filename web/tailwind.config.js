/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FDFCFB',
          100: '#FBF9F6',
          200: '#F5EFEB',
          300: '#EDE3DC',
        },
        terracotta: {
          DEFAULT: '#D9531E',
          hover: '#C24614',
          light: '#FDEEE8',
          dark: '#9E320A',
        },
        charcoal: {
          DEFAULT: '#1C1917',
          muted: '#57534E',
          light: '#78716C',
        },
        sage: {
          DEFAULT: '#2D5A27',
          light: '#EBF4EA',
          border: '#A8D5A3',
        },
        surface: {
          border: '#E7E5E4',
          card: '#FFFFFF',
        }
      },
      fontFamily: {
        serif: ['Fraunces', 'Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
