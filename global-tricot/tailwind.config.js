/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Magenta medido no avatar oficial do Instagram da loja (#B82182).
        brand: { DEFAULT: '#B82182', dark: '#8F1866', deep: '#6E1250', soft: '#F8E6F1', tint: '#FCF3F8' },
        ink: { DEFAULT: '#2B2429', soft: '#5D545A', mute: '#81777D' },
        paper: { DEFAULT: '#FBF8F6', warm: '#F4EEEA' },
        line: { DEFAULT: '#E8DEE3', strong: '#D4C6CD' },
      },
      fontFamily: {
        display: ['Gloock', 'Georgia', 'serif'],
        sans: ['"Figtree Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      maxWidth: { shell: '78rem' },
    },
  },
  plugins: [],
}
