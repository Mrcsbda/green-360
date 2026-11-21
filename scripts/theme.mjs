// Fuente única de la paleta. Genera global.css (variables claro/oscuro) y src/core/theme/palette.ts (para íconos y gráficas).
// Uso: node scripts/theme.mjs
import fs from 'node:fs';

// [claro, oscuro]
const T = {
  white: ['#FFFFFF', '#121A16'],
  'gray-50': ['#F5F8F6', '#0A100D'], 'gray-100': ['#EDF2EF', '#18221D'], 'gray-200': ['#DFE7E2', '#25312B'],
  'gray-300': ['#C9D4CE', '#33423A'], 'gray-400': ['#93A49A', '#56685E'], 'gray-500': ['#64756B', '#8C9C93'],
  'gray-600': ['#4B5A52', '#A9B6AF'], 'gray-700': ['#36433C', '#C4CEC8'], 'gray-800': ['#212B26', '#DCE4E0'],
  'gray-900': ['#0F1813', '#F1F5F3'],
  primary: ['#0F5132', '#34D399'], 'primary-50': ['#E6F4EC', '#12382A'], 'on-primary': ['#FFFFFF', '#052E1B'],
  accent: ['#047857', '#6EE7B7'],
  positive: ['#15803D', '#4ADE80'], warning: ['#B45309', '#FBBF24'], danger: ['#B91C1C', '#F87171'],
  'green-50': ['#F0FDF4', '#0F2A1C'], 'green-100': ['#DCFCE7', '#14432A'], 'green-200': ['#BBF7D0', '#1B5E3A'], 'green-800': ['#166534', '#86EFAC'], 'green-900': ['#14532D', '#BBF7D0'],
  'teal-50': ['#F0FDFA', '#0C2826'], 'teal-100': ['#CCFBF1', '#134440'], 'teal-200': ['#99F6E4', '#175C56'], 'teal-800': ['#115E59', '#5EEAD4'], 'teal-900': ['#134E4A', '#99F6E4'],
  'lime-100': ['#ECFCCB', '#2B3A12'], 'lime-800': ['#3F6212', '#BEF264'],
  'red-50': ['#FEF2F2', '#2A1212'], 'red-100': ['#FEE2E2', '#451A1A'], 'red-200': ['#FECACA', '#6B2121'], 'red-400': ['#F87171', '#F87171'], 'red-800': ['#991B1B', '#FCA5A5'],
  'amber-50': ['#FFFBEB', '#2A2110'], 'amber-100': ['#FEF3C7', '#43350F'], 'amber-200': ['#FDE68A', '#6B5216'], 'amber-800': ['#92400E', '#FCD34D'], 'amber-900': ['#78350F', '#FDE68A'],
  'seg-frecuente': ['#16A34A', '#4ADE80'], 'seg-frio': ['#0E7490', '#22D3EE'], 'seg-sin': ['#7C8A82', '#94A39B'],
  'chart-1': ['#0F5132', '#34D399'], 'chart-2': ['#16A34A', '#86EFAC'], 'chart-3': ['#65A30D', '#BEF264'], 'chart-4': ['#0F766E', '#5EEAD4'],
  'chart-5': ['#D97706', '#FBBF24'], 'chart-6': ['#4D7C0F', '#A3E635'], 'chart-7': ['#7C8A82', '#94A39B'],
};

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');
const block = (i) => Object.entries(T).map(([k, v]) => `    --c-${k}: ${rgb(v[i])};`).join('\n');
fs.writeFileSync('global.css', `/* Generado por scripts/theme.mjs: no editar a mano */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
${block(0)}
  }
  .dark:root {
${block(1)}
  }
}
`);
const pal = (i) => JSON.stringify(Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v[i]])), null, 2);
fs.writeFileSync('src/core/theme/palette.ts', `// Generado por scripts/theme.mjs: no editar a mano
export const PALETTE = {
  light: ${pal(0)},
  dark: ${pal(1)},
} as const;
export type PaletteKey = keyof typeof PALETTE.light;
export const TAILWIND_KEYS = ${JSON.stringify(Object.keys(T))} as const;
`);
console.log('theme ok');
