import typography from '@tailwindcss/typography';
import containerQueries from '@tailwindcss/container-queries';
import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['index.html', 'src/**/*.{js,ts,jsx,tsx,html,css}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      fontFamily: {
        bangers: ['Bangers', 'cursive'],
        oswald: ['Oswald', 'sans-serif'],
      },
      colors: {
        sand: 'oklch(var(--sand))',
        'burnt-orange': 'oklch(var(--burnt-orange))',
        'blood-red': 'oklch(var(--blood-red))',
        'dark-outline': 'oklch(var(--dark-outline))',
        'off-white': 'oklch(var(--off-white))',
        'acid-yellow': 'oklch(var(--acid-yellow))',
        'toxic-green': 'oklch(var(--toxic-green))',
        border: 'oklch(var(--border))',
        input: 'oklch(var(--input))',
        ring: 'oklch(var(--ring) / <alpha-value>)',
        background: 'oklch(var(--background))',
        foreground: 'oklch(var(--foreground))',
        primary: {
          DEFAULT: 'oklch(var(--primary) / <alpha-value>)',
          foreground: 'oklch(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'oklch(var(--secondary) / <alpha-value>)',
          foreground: 'oklch(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'oklch(var(--destructive) / <alpha-value>)',
          foreground: 'oklch(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'oklch(var(--muted) / <alpha-value>)',
          foreground: 'oklch(var(--muted-foreground) / <alpha-value>)'
        },
        accent: {
          DEFAULT: 'oklch(var(--accent) / <alpha-value>)',
          foreground: 'oklch(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'oklch(var(--popover))',
          foreground: 'oklch(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'oklch(var(--card))',
          foreground: 'oklch(var(--card-foreground))'
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      boxShadow: {
        toon: '4px 4px 0 oklch(0.12 0.02 30)',
        'toon-lg': '6px 6px 0 oklch(0.12 0.02 30)',
        xs: '0 1px 2px 0 rgba(0,0,0,0.05)'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        'hit-flash': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.2', filter: 'brightness(3) saturate(0)' }
        },
        'wave-in': {
          from: { transform: 'scale(0.5)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' }
        },
        'damage-flash': {
          '0%': { opacity: '0.8' },
          '100%': { opacity: '0' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'hit-flash': 'hit-flash 0.15s ease-in-out',
        'wave-in': 'wave-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'damage-flash': 'damage-flash 0.5s ease-out forwards'
      }
    }
  },
  plugins: [typography, containerQueries, animate]
};
