import { FontFamily } from '../types';

interface FontLineMetrics {
  compactLineHeight: number;
  normalLineHeight: number;
  looseLineHeight: number;
  minLineHeight: number;
  naturalBaselineEm: number;
  paragraphSpacingFactor: number;
}

const DEFAULT_LINE_METRICS: FontLineMetrics = {
  compactLineHeight: 1.16,
  normalLineHeight: 1.22,
  looseLineHeight: 1.28,
  minLineHeight: 1.12,
  naturalBaselineEm: 0.66,
  paragraphSpacingFactor: 0.2,
};

function getFontLineMetrics(fontFamily: FontFamily | string): FontLineMetrics {
  if (fontFamily.includes('Roboto Condensed') || fontFamily.includes('Narrow') || fontFamily.includes('Arial Narrow')) {
    return {
      compactLineHeight: 1.13,
      normalLineHeight: 1.18,
      looseLineHeight: 1.24,
      minLineHeight: 1.1,
      naturalBaselineEm: 0.66,
      paragraphSpacingFactor: 0.18,
    };
  }

  if (fontFamily.includes('Tinos') || fontFamily.includes('Times')) {
    return {
      compactLineHeight: 1.14,
      normalLineHeight: 1.2,
      looseLineHeight: 1.26,
      minLineHeight: 1.1,
      naturalBaselineEm: 0.66,
      paragraphSpacingFactor: 0.18,
    };
  }

  if (fontFamily.includes('Lora') || fontFamily.includes('Georgia')) {
    return {
      compactLineHeight: 1.18,
      normalLineHeight: 1.24,
      looseLineHeight: 1.32,
      minLineHeight: 1.14,
      naturalBaselineEm: 0.71,
      paragraphSpacingFactor: 0.22,
    };
  }

  if (fontFamily.includes('Courier')) {
    return {
      compactLineHeight: 1.2,
      normalLineHeight: 1.28,
      looseLineHeight: 1.36,
      minLineHeight: 1.16,
      naturalBaselineEm: 0.66,
      paragraphSpacingFactor: 0.24,
    };
  }

  if (fontFamily.includes('Lato') || fontFamily.includes('Helvetica')) {
    return {
      compactLineHeight: 1.17,
      normalLineHeight: 1.23,
      looseLineHeight: 1.3,
      minLineHeight: 1.13,
      naturalBaselineEm: 0.66,
      paragraphSpacingFactor: 0.2,
    };
  }

  return DEFAULT_LINE_METRICS;
}

export function chooseAutoLineHeight(fontFamily: FontFamily | string, bodyPt: number): number {
  const metrics = getFontLineMetrics(fontFamily);

  if (bodyPt <= 6.5) return metrics.compactLineHeight;
  if (bodyPt < 9.0) return metrics.normalLineHeight;
  return metrics.looseLineHeight;
}

export function toTypstParagraphMetrics(fontFamily: FontFamily | string, lineHeight: number): {
  leadingEm: number;
  spacingEm: number;
} {
  const metrics = getFontLineMetrics(fontFamily);
  const normalizedLineHeight = Math.max(metrics.minLineHeight, lineHeight);
  const leadingEm = Math.max(0.4, normalizedLineHeight - metrics.naturalBaselineEm);
  const spacingEm = Math.max(0.02, (normalizedLineHeight - 1.0) * metrics.paragraphSpacingFactor);

  return {
    leadingEm: Number(leadingEm.toFixed(3)),
    spacingEm: Number(spacingEm.toFixed(3)),
  };
}
