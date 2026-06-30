import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ─── Callr Design Tokens ─────────────────────────────────────────────
        canvas: '#121824',       // main background
        surface: '#1B2333',      // cards, containers
        border: '#2A354A',       // dividers
        'text-primary': '#FFFFFF',
        'text-muted': '#94A3B8',
        accent: '#1800AD',       // brand blue — interactive elements only

        // Semantic aliases
        background: '#121824',
        foreground: '#FFFFFF',
        card: {
          DEFAULT: '#1B2333',
          foreground: '#FFFFFF',
        },
        popover: {
          DEFAULT: '#1B2333',
          foreground: '#FFFFFF',
        },
        primary: {
          DEFAULT: '#1800AD',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#2A354A',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#2A354A',
          foreground: '#94A3B8',
        },
        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#FFFFFF',
        },
        input: '#2A354A',
        ring: '#1800AD',

        // Status colors
        win: '#22C55E',
        loss: '#EF4444',
        pending: '#F59E0B',
        live: '#EF4444',
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },

      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },

      lineHeight: {
        relaxed: '1.625',
        body: '1.75',
      },

      letterSpacing: {
        label: '0.05em',
        heading: '0.03em',
      },

      spacing: {
        // 8-point grid extensions
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
        '34': '8.5rem',
        '38': '9.5rem',
        '42': '10.5rem',
      },

      borderRadius: {
        lg: '0.625rem',
        xl: '0.875rem',
        '2xl': '1.125rem',
      },

      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)',
        elevated: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.4)',
        glow: '0 0 20px rgba(24, 0, 173, 0.25)',
        'glow-sm': '0 0 10px rgba(24, 0, 173, 0.15)',
      },

      backdropBlur: {
        xs: '2px',
      },

      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-up': 'fadeUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'number-change': 'numberChange 0.3s ease-out',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        numberChange: {
          '0%': { transform: 'translateY(-4px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },

      transitionTimingFunction: {
        spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
    },
  },
  plugins: [],
};

export default config;
