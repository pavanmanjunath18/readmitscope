/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        // Deep midnight-indigo background shades
        clinical: {
          950: '#07070E',
          900: '#0B0C17',
          800: '#121327',
          700: '#1A1B33',
          600: '#2A2C4A',
        },
        // Aurora accent — violet / cyan / mint
        vital: {
          DEFAULT: '#5EEAD4',
          deep: '#2DD4BF',
          cyan: '#38BDF8',
          violet: '#A78BFA',
          mint: '#5EEAD4',
          emerald: '#34D399',
        },
        alert: {
          DEFAULT: '#FB7185',
          deep: '#F43F5E',
        },
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        'aurora-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        'pulse-soft': 'pulse-soft 3s ease-in-out infinite',
        'aurora-shift': 'aurora-shift 8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
