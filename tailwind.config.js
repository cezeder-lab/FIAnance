/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: 'var(--page)',
        surface: 'var(--surface)',
        sunken: 'var(--sunken)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        grid: 'var(--grid)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        positive: 'var(--positive)',
        negative: 'var(--negative)',
        good: 'var(--status-good)',
        warning: 'var(--status-warning)',
        critical: 'var(--status-critical)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
