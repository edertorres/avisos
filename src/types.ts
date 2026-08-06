export interface SizeOption {
  id: string;
  name: string;
  widthCm: number;
  heightCm: number;
  isCustom?: boolean;
}

export type FontFamily =
  | 'PT Sans, sans-serif'
  | 'Arimo, sans-serif'
  | 'Roboto Condensed, sans-serif'
  | 'Roboto, sans-serif'
  | 'Lato, sans-serif'
  | 'Tinos, serif'
  | 'Lora, serif'
  | 'Courier Prime, monospace'
  | string;

export type TextAlign = 'justify' | 'left' | 'center' | 'right';

export interface NoticeConfig {
  headerTitle: string;
  subheaderTitle: string;
  bodyText: string;
  logoUrl: string | null;
  logoWidthMm: number; // logo width in mm
  size: SizeOption;
  marginMm: number; // Margin in mm (default 3mm)
  fontFamily: FontFamily;
  headerFontSizePt: number;
  subheaderFontSizePt: number;
  bodyFontSizePt: number;
  lineHeight: number;
  letterSpacingMm: number;
  textAlign: TextAlign;
  borderWidthPx: number;
  grayscaleLogo: boolean;
  logoPosition?: 'left' | 'right' | 'top-center';
  contrastMode: 'normal' | 'high-contrast';
  showMarginGuides: boolean;
  headerAlign: 'center' | 'left' | 'right';
  boldKeywords: string[]; // keywords to auto-bold or detected from **text**
}

export interface OverflowStatus {
  isOverflowing: boolean;
  overflowHeightPx: number;
  overflowPercentage: number;
  recommendedHeightCm: number;
}
