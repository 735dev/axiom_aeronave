import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans Variable"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        info: 'hsl(var(--info))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        // Paleta literal de la marca, para casos donde el token semántico no aplica.
        navy: {
          50: '#eef2f8',
          100: '#d6e0ef',
          500: '#2f4a82',
          700: '#162c54',
          900: '#1f273f',
          950: '#060e1f',
        },
        brick: {
          50: '#f9ebea',
          100: '#efc9c6',
          400: '#bd5750',
          500: '#a83731',
          600: '#8f2b26',
          700: '#71211d',
        },
        gold: {
          100: '#faedc8',
          300: '#ecc352',
          400: '#e3ad2c',
          500: '#c8901c',
          700: '#7c5414',
        },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 4px)', sm: 'calc(var(--radius) - 6px)' },
      letterSpacing: { strip: '0.2em' },
      boxShadow: {
        soft: '0 10px 40px -12px rgba(6, 14, 31, 0.25)',
      },
    },
  },
  plugins: [],
} satisfies Config;
