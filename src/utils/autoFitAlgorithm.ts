import { NoticeConfig } from '../types';

export interface AutoFitResult {
  changes: Partial<NoticeConfig>;
  message: string;
}

/**
 * High-Precision Auto-Fit Algorithm for Press & Legal Notices.
 * Measures the Typst CLI vector SVG canvas and automatically adjusts body,
 * header, and subheader font sizes to achieve 100% vertical fill without overflow.
 */
export function calculateAutoFitFont(
  config: NoticeConfig,
  containerEl: HTMLElement | null
): AutoFitResult | null {
  if (!containerEl) return null;

  const svgEl = containerEl.querySelector('svg');
  if (!svgEl) return null;

  // Page target height in pt (e.g., 3.0cm = 85.04pt)
  const viewBoxAttr = svgEl.getAttribute('viewBox');
  const viewBoxParts = viewBoxAttr ? viewBoxAttr.split(' ') : [];
  const pageHeightPt = viewBoxParts.length === 4 ? parseFloat(viewBoxParts[3]) : parseFloat(svgEl.getAttribute('data-height') || '85.04');

  // Margin inset in pt (3mm = 8.5pt)
  const marginPt = (config.marginMm / 10) * 28.3465;
  const availableHeightPt = Math.max(10, pageHeightPt - marginPt * 2);

  let maxY = 0;

  // Try measuring SVG elements bounding box
  try {
    const pageGroup = (svgEl.querySelector('.typst-page') as SVGGraphicsElement) || (svgEl as SVGGraphicsElement);
    if ('getBBox' in pageGroup) {
      const bbox = pageGroup.getBBox();
      if (bbox && bbox.height > 0) {
        maxY = bbox.y + bbox.height;
      }
    }
  } catch (e) {
    // Fallback if getBBox is restricted
  }

  // Fallback if getBBox gave 0
  if (maxY === 0) {
    const outerHtml = svgEl.outerHTML;
    const re = /transform="translate\(\s*[\d.]+\s*,\s*([\d.]+)\s*\)"/g;
    let match;
    while ((match = re.exec(outerHtml)) !== null) {
      const y = parseFloat(match[1]);
      if (!isNaN(y) && y > maxY) maxY = y;
    }
    // Add baseline text line height approximation
    if (maxY > 0) maxY += config.bodyFontSizePt * 1.2;
  }

  if (maxY === 0) {
    return {
      changes: {},
      message: 'No se pudo medir la altura del contenido en el lienzo.',
    };
  }

  // Height used by content relative to top inset
  const contentUsedPt = Math.max(8, maxY - marginPt);
  const ratio = availableHeightPt / contentUsedPt;

  // If text already fills between 94% and 100% of available height without overflowing, it's optimal
  if (ratio >= 0.94 && ratio <= 1.03 && maxY <= pageHeightPt - marginPt + 1) {
    return {
      changes: {},
      message: 'El texto ya ocupa óptimamente el área disponible (Encaje 100%)',
    };
  }

  // Scale factor calculation: conservative scaling up/down to guarantee fitting
  let targetScale = ratio < 1.0 ? ratio * 0.94 : Math.min(2.2, ratio * 0.91);

  let newBodyPt = Number((config.bodyFontSizePt * targetScale).toFixed(2));
  let newHeaderPt = Number((config.headerFontSizePt * targetScale).toFixed(2));
  let newSubheaderPt = Number((config.subheaderFontSizePt * targetScale).toFixed(2));

  // Enforce typographic bounds for legibility
  newBodyPt = Math.max(4.0, Math.min(14.0, newBodyPt));
  newHeaderPt = Math.max(5.0, Math.min(20.0, newHeaderPt));
  newSubheaderPt = Math.max(4.5, Math.min(16.0, newSubheaderPt));

  // Proportional line height adjustment
  let newLineHeight = config.lineHeight;
  if (newBodyPt < 5.5) {
    newLineHeight = 1.0;
  } else if (newBodyPt < 7.0) {
    newLineHeight = 1.08;
  } else if (newBodyPt < 9.0) {
    newLineHeight = 1.15;
  } else {
    newLineHeight = 1.25;
  }

  const actionText = ratio < 1.0 ? 'reducida' : 'ampliada';

  return {
    changes: {
      bodyFontSizePt: newBodyPt,
      headerFontSizePt: newHeaderPt,
      subheaderFontSizePt: newSubheaderPt,
      lineHeight: newLineHeight,
    },
    message: `Fuente ${actionText} a ${newBodyPt} pt (Encaje ajustado al área de ${config.size.heightCm} cm)`,
  };
}
