/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Preflight is disabled so Tailwind utilities compose with the existing
  // hand-written design system instead of resetting it. New pages use
  // utilities; the editor keeps its bespoke CSS. Tokens are shared via vars.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--primary)',
          weak: 'var(--primary-weak)',
        },
        ink: 'var(--text)',
        muted: 'var(--muted)',
        panel: 'var(--panel)',
        line: 'var(--border)',
        ok: 'var(--success)',
        danger: 'var(--danger)',
      },
      borderRadius: {
        xl: 'var(--radius)',
      },
      boxShadow: {
        panel: 'var(--shadow)',
      },
    },
  },
  plugins: [],
};
