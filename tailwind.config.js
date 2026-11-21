// Colores = variables CSS (global.css), con valores para modo claro y oscuro. Ver scripts/theme.mjs.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;
const scale = (base, steps) => Object.fromEntries(steps.map((s) => [s, v(`${base}-${s}`)]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        white: v('white'),
        gray: scale('gray', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        primary: { DEFAULT: v('primary'), 50: v('primary-50') },
        'on-primary': v('on-primary'),
        accent: v('accent'),
        positive: v('positive'),
        warning: v('warning'),
        danger: v('danger'),
        green: scale('green', [50, 100, 200, 800, 900]),
        teal: scale('teal', [50, 100, 200, 800, 900]),
        lime: scale('lime', [100, 800]),
        red: scale('red', [50, 100, 200, 400, 800]),
        amber: scale('amber', [50, 100, 200, 800, 900]),
      },
    },
  },
  plugins: [],
};
