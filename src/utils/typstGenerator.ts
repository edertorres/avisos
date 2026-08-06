import { NoticeConfig } from '../types';

/**
 * Escapes special characters for Typst markup
 */
export function escapeTypstString(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/#/g, '\\#')
    .replace(/\$/g, '\\$')
    .replace(/@/g, '\\@')
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>');
}

function preserveLegalNoBreaks(escapedText: string): string {
  return escapedText
    .replace(/\b(C[eé]dula)\s+de\s+(Ciudadan[ií]a)\s+(No\.)/gi, (_match, label: string, citizenship: string, numberLabel: string) => `${label}~de~${citizenship}~${numberLabel}`)
    .replace(
      /\b(identificad[oa])\s+con\s+(C[eé]dula(?:\s+de\s+Ciudadan[ií]a)?(?:\s+No\.)?)/gi,
      (_match, qualifier: string, documentLabel: string) => `${qualifier}~con~${documentLabel.replace(/\s+/g, '~')}`
    )
    .replace(
      /\b(con)\s+(C[eé]dula(?:\s+de\s+Ciudadan[ií]a)?(?:\s+No\.)?)/gi,
      (_match, connector: string, documentLabel: string) => `${connector}~${documentLabel.replace(/\s+/g, '~')}`
    )
    .replace(/\b(identificad[oa])\s+con\s*$/gi, (_match, qualifier: string) => `${qualifier}~con~`)
    .replace(/\b(con)\s*$/gi, (_match, connector: string) => `${connector}~`)
    .replace(/\b(NIT)\s+([\d. -]{5,})/gi, (_match, label: string, value: string) => `${label}~${value.trim()}`);
}

function formatTypstTextSegment(str: string): string {
  return preserveLegalNoBreaks(escapeTypstString(str));
}

/**
 * Formats body text with bold markdown and bold keywords support
 */
function formatTypstInlineText(text: string, boldKeywords: string[] = [], boldFontList: string = '("Myriad Pro", "Roboto", "Noto Sans")'): string {
  if (!text) return '';

  // 1. Mark markdown **bold**
  let formatted = text.replace(/\*\*(.*?)\*\*/g, '___BOLD___$1___ENDBOLD___');

  // 2. Mark bold keywords
  if (boldKeywords && boldKeywords.length > 0) {
    const uniqueKeywords = [...new Set(boldKeywords.map((kw) => kw.trim()).filter(Boolean))]
      .sort((a, b) => b.length - a.length);

    uniqueKeywords.forEach((kw) => {
      const trimmed = kw.trim();
      if (!trimmed) return;
      try {
        const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
        const regex = new RegExp(`(^|[^\\p{L}\\p{N}_])(${escaped})(?=$|[^\\p{L}\\p{N}_])`, 'giu');
        formatted = formatted
          .split(/(___BOLD___.*?___ENDBOLD___)/g)
          .map((part) => {
            if (part.startsWith('___BOLD___') && part.endsWith('___ENDBOLD___')) return part;
            return part.replace(regex, '$1___BOLD___$2___ENDBOLD___');
          })
          .join('');
      } catch (e) {
        // Fallback for regex special characters
      }
    });
  }

  // 3. Split and process text parts
  const parts = formatted.split(/(___BOLD___.*?___ENDBOLD___)/g);
  const typstParts = parts.map((part) => {
    if (part.startsWith('___BOLD___') && part.endsWith('___ENDBOLD___')) {
      const inner = part.slice(10, part.length - 13);
      return `#text(font: ${boldFontList}, weight: 700)[${formatTypstTextSegment(inner)}]`;
    } else {
      // Preserve newlines as Typst \par or line breaks
      const escaped = formatTypstTextSegment(part);
      return escaped.replace(/\n\n+/g, ' \n\n ').replace(/\n/g, ' \\ ');
    }
  });

  return typstParts.join('');
}

export function formatTypstBodyText(text: string, boldKeywords: string[] = [], boldFontList?: string): string {
  if (!text) return '';

  const alignmentRe = /\[(left|center|right|justify)\]([\s\S]*?)\[\/\1\]/gi;
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = alignmentRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(formatTypstInlineText(text.slice(lastIndex, match.index), boldKeywords, boldFontList));
    }

    const align = match[1].toLowerCase();
    const content = formatTypstInlineText(match[2], boldKeywords, boldFontList);
    if (align === 'justify') {
      parts.push(`#block[#set par(justify: true)\n${content}]`);
    } else {
      parts.push(`#align(${align})[${content}]`);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(formatTypstInlineText(text.slice(lastIndex), boldKeywords, boldFontList));
  }

  return parts.join('');
}

/**
 * Maps input font family string to Typst font tuple
 */
function getTypstFontList(fontFamily: string): string {
  if (fontFamily.includes('PT Sans')) return '("Arimo", "Roboto", "Noto Sans", "PT Sans")';
  if (fontFamily.includes('Arimo') || fontFamily.includes('Myriad')) return '("Arimo", "Roboto", "PT Sans", "Noto Sans")';
  if (fontFamily.includes('Roboto Condensed') || fontFamily.includes('Narrow') || fontFamily.includes('Arial Narrow')) return '("Roboto Condensed", "Roboto", "Arimo", "Noto Sans")';
  if (fontFamily.includes('Lato') || fontFamily.includes('Helvetica')) return '("Lato", "Arimo", "Roboto", "Noto Sans")';
  if (fontFamily.includes('Roboto')) return '("Roboto", "Arimo", "PT Sans", "Noto Sans")';
  if (fontFamily.includes('Tinos') || fontFamily.includes('Times')) return '("Tinos", "Liberation Serif", "Noto Serif")';
  if (fontFamily.includes('Lora') || fontFamily.includes('Georgia')) return '("Noto Serif", "Liberation Serif", "Tinos")';
  if (fontFamily.includes('Courier')) return '("Liberation Mono", "Courier Prime", "Noto Sans Mono")';
  return '("Arimo", "Roboto", "Noto Sans", "PT Sans")';
}

function getTypstBoldFontList(fontFamily: string): string {
  if (fontFamily.includes('Roboto Condensed') || fontFamily.includes('Narrow') || fontFamily.includes('Arial Narrow')) {
    return '("Roboto Condensed", "Roboto", "Arimo", "Noto Sans")';
  }
  if (fontFamily.includes('Tinos') || fontFamily.includes('Times')) return '("Tinos", "Liberation Serif", "Noto Serif")';
  if (fontFamily.includes('Lora') || fontFamily.includes('Georgia')) return '("Noto Serif", "Liberation Serif", "Tinos")';
  if (fontFamily.includes('Courier')) return '("Liberation Mono", "Noto Sans Mono", "Roboto")';
  return '("Roboto", "Arimo", "Noto Sans")';
}

function typstLogoImage(logoPath: string, logoWidthMm: string): string {
  if (logoPath.toLowerCase().endsWith('.svg')) {
    return `image-grayscale(read("${logoPath}", encoding: none), format: "svg", width: ${logoWidthMm})`;
  }
  return `image-grayscale(path("${logoPath}"), width: ${logoWidthMm})`;
}

/**
 * Generates Typst code for a single notice component
 */
export function generateSingleNoticeBlock(config: NoticeConfig, hasLogoFile: boolean = false, logoPath: string = '/logo.png'): string {
  const fontList = getTypstFontList(config.fontFamily);
  const boldFontList = getTypstBoldFontList(config.fontFamily);
  const headerAlign = config.headerAlign || 'center';
  const textAlign = config.textAlign || 'justify';
  const leadingEm = Math.max(-0.2, config.lineHeight - 1.0); // leading in Typst
  const trackingMm = `${config.letterSpacingMm || 0}mm`;
  const borderWidth = `${Math.max(0.2, config.borderWidthPx || 0.5)}pt`;
  const marginMm = `${config.marginMm || 3}mm`;
  const logoWidthMm = `${config.logoWidthMm || 12}mm`;
  const logoPosition = config.logoPosition || 'left';

  const headerTitle = escapeTypstString(config.headerTitle);
  const subheaderTitle = escapeTypstString(config.subheaderTitle);
  const formattedBody = formatTypstBodyText(config.bodyText, config.boldKeywords, boldFontList);

  const titleParts: string[] = [];
  if (headerTitle) {
    titleParts.push(`#align(${headerAlign})[#text(font: ${boldFontList}, size: ${config.headerFontSizePt}pt, weight: 700)[${headerTitle}]]`);
  }
  if (subheaderTitle) {
    titleParts.push(`#align(${headerAlign})[#text(font: ${boldFontList}, size: ${config.subheaderFontSizePt}pt, weight: 700)[${subheaderTitle}]]`);
  }

  let titlesBlock = '';
  if (titleParts.length > 0) {
    titlesBlock = titleParts.join('\n#v(1.5pt)\n') + '\n#v(1.5pt)\n';
  }

  if (hasLogoFile && (logoPosition === 'left' || logoPosition === 'right')) {
    const wrapAlign = logoPosition === 'right' ? 'top + right' : 'top + left';
    const logoImage = typstLogoImage(logoPath, logoWidthMm);
    return `#import "@preview/wrap-it:0.1.1": wrap-content
#import "@preview/grayness:0.7.0": image-grayscale

#block(
  width: 100%,
  height: 100%,
  stroke: ${borderWidth} + rgb("#000000"),
  inset: ${marginMm},
  outset: 0pt,
)[
  #set text(
    font: ${fontList},
    size: ${config.bodyFontSizePt}pt,
    tracking: ${trackingMm},
    fill: rgb("#000000"),
    hyphenate: false,
  )
  #set par(
    justify: ${textAlign === 'justify' ? 'true' : 'false'},
    leading: ${leadingEm.toFixed(3)}em,
    spacing: ${leadingEm.toFixed(3)}em,
  )

  ${titlesBlock}#wrap-content(
    ${logoImage},
    [${formattedBody.trim()}],
    align: ${wrapAlign},
    column-gutter: 2.5mm,
    row-gutter: 0mm
  )
]`;
  }

  let topLogo = '';
  if (hasLogoFile && logoPosition === 'top-center') {
    topLogo = `#import "@preview/grayness:0.7.0": image-grayscale\n#align(center)[#${typstLogoImage(logoPath, logoWidthMm)}]\n#v(1.5pt)\n`;
  }

  return `#block(
  width: 100%,
  height: 100%,
  stroke: ${borderWidth} + rgb("#000000"),
  inset: ${marginMm},
  outset: 0pt,
)[
  #set text(
    font: ${fontList},
    size: ${config.bodyFontSizePt}pt,
    tracking: ${trackingMm},
    fill: rgb("#000000"),
    hyphenate: false,
  )
  #set par(
    justify: ${textAlign === 'justify' ? 'true' : 'false'},
    leading: ${leadingEm.toFixed(3)}em,
    spacing: ${leadingEm.toFixed(3)}em,
  )

  ${topLogo}${titlesBlock}${formattedBody.trim()}
]`;
}

/**
 * Generates full Typst markup file string
 */
export function generateTypstMarkup(
  config: NoticeConfig,
  exportType: 'single-exact' | 'a4-sheet' = 'single-exact',
  hasLogoFile: boolean = false,
  logoPath: string = '/logo.png'
): string {
  const widthCm = config.size.widthCm;
  const heightCm = config.size.heightCm;

  if (exportType === 'single-exact') {
    return `#set page(
  width: ${widthCm}cm,
  height: ${heightCm}cm,
  margin: 0mm,
  fill: rgb("#ffffff"),
)

${generateSingleNoticeBlock(config, hasLogoFile, logoPath)}
`;
  }

  // A4 Sheet Export - calculate grid layout
  const cols = Math.floor(19.0 / (widthCm + 0.4)); // 19cm printable width
  const rows = Math.floor(27.7 / (heightCm + 0.4)); // 27.7cm printable height
  const count = Math.max(1, cols * rows);

  const colWidths = Array(cols).fill(`${widthCm}cm`).join(', ');
  const singleNotice = generateSingleNoticeBlock(config, hasLogoFile, logoPath);
  const noticesList = Array(count).fill(singleNotice).join(',\n');

  return `
#set page(
  paper: "a4",
  margin: (x: 1cm, y: 1cm),
  fill: rgb("#ffffff"),
)

#grid(
  columns: (${colWidths}),
  gutter: 4mm,
  ${noticesList}
)
`;
}
