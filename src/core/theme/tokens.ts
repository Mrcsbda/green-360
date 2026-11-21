import { PALETTE } from './palette';

export type Scheme = 'light' | 'dark';
let current: Scheme = 'light';
/** Lo llama ThemeProvider al cambiar de modo (el árbol se vuelve a montar, así que los getters leen el valor nuevo). */
export const setPaletteScheme = (s: Scheme) => { current = s; };
const p = () => PALETTE[current];

// Colores para lo que no usa className (íconos, gráficas). Mismos valores que las variables CSS.
export const colors = {
  get primary() { return p().primary; },
  get onPrimary() { return p()['on-primary']; },
  get brand() { return p().accent; },
  get positive() { return p().positive; },
  get warning() { return p().warning; },
  get danger() { return p().danger; },
  get text() { return p()['gray-900']; },
  get muted() { return p()['gray-500']; },
  get border() { return p()['gray-200']; },
  get surface() { return p().white; },
  get chart() { return [p()['chart-1'], p()['chart-2'], p()['chart-3'], p()['chart-4'], p()['chart-5'], p()['chart-6'], p()['chart-7']]; },
};

export const segmentColors = {
  get frecuente() { return p()['seg-frecuente']; },
  get frio() { return p()['seg-frio']; },
  get sin_segmentar() { return p()['seg-sin']; },
};
