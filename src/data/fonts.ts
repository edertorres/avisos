import { FontFamily } from '../types';

export interface FontOption {
  value: FontFamily;
  label: string;
  shortName: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    value: 'PT Sans, sans-serif',
    label: 'PT Sans (Google Fonts - Principal)',
    shortName: 'PT Sans',
  },
  {
    value: 'Arimo, sans-serif',
    label: 'Arimo / Myriad Pro (Sans)',
    shortName: 'Arimo',
  },
  {
    value: 'Roboto Condensed, sans-serif',
    label: 'Roboto Condensed (Condensada)',
    shortName: 'Roboto Condensed',
  },
  {
    value: 'Roboto, sans-serif',
    label: 'Roboto (Google Fonts)',
    shortName: 'Roboto',
  },
  {
    value: 'Lato, sans-serif',
    label: 'Lato / Helvetica (Sans Moderno)',
    shortName: 'Lato',
  },
  {
    value: 'Tinos, serif',
    label: 'Tinos / Times New Roman (Serif)',
    shortName: 'Tinos',
  },
  {
    value: 'Lora, serif',
    label: 'Lora / Georgia (Serif Editorial)',
    shortName: 'Lora',
  },
  {
    value: 'Courier Prime, monospace',
    label: 'Courier Prime (Monoespaciada)',
    shortName: 'Courier Prime',
  },
];
