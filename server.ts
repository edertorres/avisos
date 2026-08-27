import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { NoticeConfig, SizeOption } from './src/types';
import { generateTypstMarkup } from './src/utils/typstGenerator';
import { chooseAutoLineHeight } from './src/utils/typographyMetrics';
import { WRAP_IT_TYP_SOURCE } from './src/utils/wrapItSource';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_GRAY_ICC_PROFILE = 'ISOnewspaper26v4_gr.icc';

interface CompileRequest {
  config: NoticeConfig;
  exportType?: 'single-exact' | 'a4-sheet';
  format?: 'svg' | 'pdf';
}

interface ImageAsset {
  bytes: Buffer;
  path: string;
  extension: string;
}

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const PT_PER_CM = 28.3465;

interface AutoFitResult {
  changes: Partial<NoticeConfig>;
  message: string;
  suggestedSize?: SizeOption;
}

interface FitProbe {
  config: NoticeConfig;
  bodyPt: number;
  headerPt: number;
  subheaderPt: number;
  lineHeight: number;
}

interface InkCoverage {
  c: number;
  m: number;
  y: number;
  k: number;
}

type GrayConversionMode = 'preserve' | 'flatten';

interface PrintRiskAnalysis {
  hasRisk: boolean;
  warnings: string[];
  recommendedMode: GrayConversionMode;
}

function decodeLogoDataUrl(url: string): ImageAsset | null {
  const match = url.match(/^data:([^;,]+)?((?:;[^,]*)*),(.*)$/s);
  if (!match) return null;

  const mimeType = (match[1] || '').toLowerCase();
  const extension = MIME_EXTENSION_MAP[mimeType];
  if (!extension) {
    throw new Error(`Formato de imagen no soportado por Typst: ${mimeType || 'desconocido'}. Usa PNG, JPG, SVG, GIF o WEBP.`);
  }

  const metadata = match[2] || '';
  const payload = match[3] || '';
  const bytes = metadata.includes(';base64')
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeDataPayload(payload), 'utf8');

  return { bytes, path: `/logo.${extension}`, extension };
}

async function resolveLogoAsset(url: string): Promise<ImageAsset | null> {
  if (url.startsWith('data:')) {
    return decodeLogoDataUrl(url);
  }

  const response = await fetch(url);
  if (!response.ok) return null;

  const contentType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  const extension = MIME_EXTENSION_MAP[contentType] || extensionFromUrl(url) || 'png';
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, path: `/logo.${extension}`, extension };
}

async function writeLogoAssetForTypst(tempDir: string, logo: ImageAsset): Promise<string> {
  const originalName = logo.path.slice(1);
  const originalPath = path.join(tempDir, originalName);
  await fs.writeFile(originalPath, logo.bytes);

  if (logo.extension === 'svg') {
    return logo.path;
  }

  const grayPath = path.join(tempDir, 'logo-gray.png');
  await execFileAsync('magick', [
    originalPath,
    '-colorspace',
    'Gray',
    '-alpha',
    'on',
    grayPath,
  ], {
    timeout: 20000,
    maxBuffer: 1024 * 1024 * 5,
  });

  return '/logo-gray.png';
}

function extensionFromUrl(url: string): string | null {
  const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
  if (cleanUrl.endsWith('.png')) return 'png';
  if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) return 'jpg';
  if (cleanUrl.endsWith('.svg')) return 'svg';
  if (cleanUrl.endsWith('.gif')) return 'gif';
  if (cleanUrl.endsWith('.webp')) return 'webp';
  return null;
}

function decodeDataPayload(payload: string): string {
  try {
    return decodeURIComponent(payload);
  } catch {
    return payload;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

async function resolveGrayIccProfile(): Promise<string | null> {
  const candidates = [
    process.env.GRAY_ICC_PROFILE,
    path.join(process.cwd(), DEFAULT_GRAY_ICC_PROFILE),
    path.join(__dirname, DEFAULT_GRAY_ICC_PROFILE),
    path.join(__dirname, '..', DEFAULT_GRAY_ICC_PROFILE),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }

  return null;
}

function postScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

async function writePdfx1aDefinition(tempDir: string, grayProfile: string): Promise<string> {
  const definitionPath = path.join(tempDir, 'PDFX-1a-gray.ps');
  const escapedProfilePath = postScriptString(grayProfile);
  const definition = `%!
[/GTS_PDFXVersion (PDF/X-1a:2001)
 /Title (Aviso en escala de grises)
 /Trapped /False
/DOCINFO pdfmark

[/_objdef {icc_PDFX} /type /stream /OBJ pdfmark
[{icc_PDFX} <</N 1>> /PUT pdfmark
[{icc_PDFX} (${escapedProfilePath}) (r) file /PUT pdfmark

[/_objdef {OutputIntent_PDFX} /type /dict /OBJ pdfmark
[{OutputIntent_PDFX} <<
 /Type /OutputIntent
 /S /GTS_PDFX
 /OutputCondition (Prensa en escala de grises)
 /Info (DeviceGray con perfil ICC para prensa)
 /OutputConditionIdentifier (ISOnewspaper26v4_gr)
 /RegistryName (http://www.color.org)
 /DestOutputProfile {icc_PDFX}
>> /PUT pdfmark
[{Catalog} <</OutputIntents [ {OutputIntent_PDFX} ]>> /PUT pdfmark
`;

  await fs.writeFile(definitionPath, definition, 'utf8');
  return definitionPath;
}

function parseInkCoverage(stdout: string): InkCoverage[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[0-9.]+\s+[0-9.]+\s+[0-9.]+\s+[0-9.]+/.test(line))
    .map((line) => {
      const [c, m, y, k] = line.split(/\s+/).map(Number);
      return { c, m, y, k };
    })
    .filter(({ c, m, y, k }) => [c, m, y, k].every(Number.isFinite));
}

function countPdfToken(pdfText: string, pattern: RegExp): number {
  return pdfText.match(pattern)?.length || 0;
}

function analyzePdfPrintRisk(pdfBytes: Buffer): PrintRiskAnalysis {
  const pdfText = pdfBytes.toString('latin1');
  const warnings: string[] = [];
  const transparencyHits =
    countPdfToken(pdfText, /\/Transparency\b/g) +
    countPdfToken(pdfText, /\/SMask\b/g) +
    countPdfToken(pdfText, /\/BM\s*\/(?!Normal\b)[A-Za-z]+/g) +
    countPdfToken(pdfText, /\/(?:CA|ca)\s+(?:0?\.\d+|0\b)/g);

  if (transparencyHits > 0) {
    warnings.push(`Se detectaron ${transparencyHits} señales de transparencias, máscaras u opacidades.`);
  }

  const transparencyGroupHits = countPdfToken(pdfText, /\/Group\s*<<[^>]*\/S\s*\/Transparency/gs);
  if (transparencyGroupHits > 0) {
    warnings.push(`Se detectaron ${transparencyGroupHits} grupos de transparencia.`);
  }

  const blendModeHits = countPdfToken(pdfText, /\/BM\b/g);
  if (blendModeHits > 0) {
    warnings.push(`Se detectaron ${blendModeHits} referencias a modos de fusión.`);
  }

  const patternOrShadingHits =
    countPdfToken(pdfText, /\/Pattern\b/g) +
    countPdfToken(pdfText, /\/Shading\b/g) +
    countPdfToken(pdfText, /\/ShadingType\b/g);
  if (patternOrShadingHits > 0) {
    warnings.push(`Se detectaron ${patternOrShadingHits} patrones o degradados que conviene revisar en RIP antiguo.`);
  }

  const formXObjectHits = countPdfToken(pdfText, /\/Subtype\s*\/Form\b/g);
  if (formXObjectHits > 0) {
    warnings.push(`Se detectaron ${formXObjectHits} formularios XObject; pueden contener capas, efectos o transparencias.`);
  }

  return {
    hasRisk: warnings.length > 0,
    warnings,
    recommendedMode: warnings.length > 0 ? 'flatten' : 'preserve',
  };
}

async function verifyGrayPdfWithInkcov(outputPath: string): Promise<void> {
  const { stdout } = await execFileAsync('gs', ['-o', '-', '-sDEVICE=inkcov', outputPath], {
    timeout: 20000,
    maxBuffer: 1024 * 1024 * 10,
  });

  const coverage = parseInkCoverage(stdout);
  const hasColor = coverage.some(({ c, m, y }) => c > 0 || m > 0 || y > 0);

  if (hasColor) {
    console.warn(`Ghostscript inkcov detectó tinta C, M o Y en ${outputPath}.`);
  }
}

async function convertPdfToDeviceGrayWithGhostscript(
  inputPath: string,
  outputPath: string,
  mode: GrayConversionMode = 'flatten'
): Promise<void> {
  const grayProfile = await resolveGrayIccProfile();
  const compatibilityLevel = mode === 'flatten' ? '1.3' : '1.7';
  const renderResolution = mode === 'flatten' ? '1200' : '300';
  const pdfxDefinitionPath = mode === 'flatten' && grayProfile
    ? await writePdfx1aDefinition(path.dirname(outputPath), grayProfile)
    : null;
  const gsArgs = [
    '-sDEVICE=pdfwrite',
    `-dCompatibilityLevel=${compatibilityLevel}`,
    `-r${renderResolution}`,
    ...(pdfxDefinitionPath ? ['-dPDFX=1'] : []),
    ...(pdfxDefinitionPath ? [`--permit-file-read=${grayProfile}`] : []),
    '-dPDFSETTINGS=/prepress',
    '-sColorConversionStrategy=Gray',
    '-dProcessColorModel=/DeviceGray',
    '-dOverrideICC=true',
    '-dDownsampleColorImages=false',
    '-dDownsampleGrayImages=false',
    '-dDownsampleMonoImages=false',
    '-dDetectDuplicateImages=true',
    '-dCompressFonts=true',
    '-dSubsetFonts=true',
    '-dEmbedAllFonts=true',
    '-dAutoRotatePages=/None',
    '-dNOPAUSE',
    '-dBATCH',
    ...(grayProfile ? [`-sDefaultGrayProfile=${grayProfile}`] : []),
    `-sOutputFile=${outputPath}`,
    ...(pdfxDefinitionPath ? [pdfxDefinitionPath] : []),
    inputPath,
  ];

  await execFileAsync('gs', gsArgs, {
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 10,
  });

  await verifyGrayPdfWithInkcov(outputPath);
}

function fixSvgDimensions(svgString: string): string {
  if (!svgString) return '';

  let result = svgString;
  const widthMatch = svgString.match(/\bwidth="([\d.]+)(pt|px|mm|cm)?"/);
  const heightMatch = svgString.match(/\bheight="([\d.]+)(pt|px|mm|cm)?"/);

  if (!svgString.includes('viewBox') && widthMatch && heightMatch) {
    const w = parseFloat(widthMatch[1]);
    const h = parseFloat(heightMatch[1]);
    if (w > 0 && h > 0) {
      result = result.replace('<svg', `<svg viewBox="0 0 ${w} ${h}"`);
    }
  }

  result = result.replace(/width="[\d.]+(pt|px|mm|cm)?"/, 'width="100%"');
  result = result.replace(/height="[\d.]+(pt|px|mm|cm)?"/, 'height="100%"');

  return result;
}

function parsePageHeightPt(svg: string, fallbackHeightCm: number): number {
  const viewBoxMatch = svg.match(/viewBox="0 0 ([\d.]+)\s+([\d.]+)"/);
  const dataHeightMatch = svg.match(/data-height="([\d.]+)"/);

  if (viewBoxMatch) return parseFloat(viewBoxMatch[2]);
  if (dataHeightMatch) return parseFloat(dataHeightMatch[1]);
  return fallbackHeightCm * PT_PER_CM;
}

function detectOverflowFromTypstSvg(svg: string, config: NoticeConfig): boolean {
  const pageMatches = svg.match(/class="typst-page"/g);
  const pageCount = pageMatches ? pageMatches.length : 1;
  if (pageCount > 1) return true;

  const pageHeightPt = parsePageHeightPt(svg, config.size.heightCm);
  let maxBaselineY = 0;

  const matrixRe = /transform="matrix\(1 0 0 -1\s+(-?[\d.]+)\s+(-?[\d.]+)\)"/g;
  let matrixMatch: RegExpExecArray | null;
  while ((matrixMatch = matrixRe.exec(svg)) !== null) {
    const y = parseFloat(matrixMatch[2]);
    if (!Number.isNaN(y) && y > maxBaselineY) {
      maxBaselineY = y;
    }
  }

  const translateRe = /transform="translate\(\s*-?[\d.]+\s*,\s*(-?[\d.]+)\s*\)"/g;
  let translateMatch: RegExpExecArray | null;
  while ((translateMatch = translateRe.exec(svg)) !== null) {
    const y = parseFloat(translateMatch[1]);
    if (!Number.isNaN(y) && y > maxBaselineY) {
      maxBaselineY = y;
    }
  }

  if (maxBaselineY === 0) return false;

  const estimatedTextBottomPt = maxBaselineY + Math.max(1.5, config.bodyFontSizePt * 0.35);
  return estimatedTextBottomPt > pageHeightPt - 0.5;
}

function buildProbeConfig(probe: FitProbe): NoticeConfig {
  return {
    ...probe.config,
    bodyFontSizePt: probe.bodyPt,
    headerFontSizePt: probe.headerPt,
    subheaderFontSizePt: probe.subheaderPt,
    lineHeight: probe.lineHeight,
  };
}

function getScaledProbe(config: NoticeConfig, bodyPt: number): FitProbe {
  const safeCurrentBody = Math.max(0.1, config.bodyFontSizePt);
  const headerRatio = config.headerFontSizePt / safeCurrentBody;
  const subheaderRatio = config.subheaderFontSizePt / safeCurrentBody;

  return {
    config,
    bodyPt: Number(bodyPt.toFixed(2)),
    headerPt: Number(Math.max(6.0, Math.min(20.0, bodyPt * headerRatio)).toFixed(2)),
    subheaderPt: Number(Math.max(6.0, Math.min(16.0, bodyPt * subheaderRatio)).toFixed(2)),
    lineHeight: chooseAutoLineHeight(config.fontFamily, bodyPt),
  };
}

async function fitsInTypst(probe: FitProbe): Promise<boolean> {
  const probeConfig = buildProbeConfig(probe);
  const svg = await compileWithTypstCli({
    config: probeConfig,
    exportType: 'single-exact',
    format: 'svg',
  });
  return !detectOverflowFromTypstSvg(String(svg), probeConfig);
}

function normalizeSizeOptions(value: unknown): SizeOption[] {
  if (!Array.isArray(value)) return [];

  return value.filter((size): size is SizeOption => (
    size &&
    typeof size === 'object' &&
    typeof size.id === 'string' &&
    typeof size.name === 'string' &&
    typeof size.widthCm === 'number' &&
    typeof size.heightCm === 'number' &&
    size.widthCm > 0 &&
    size.heightCm > 0
  ));
}

function sortSuggestedSizes(config: NoticeConfig, availableSizes: SizeOption[]): SizeOption[] {
  const currentArea = config.size.widthCm * config.size.heightCm;

  return availableSizes
    .filter((size) => {
      const area = size.widthCm * size.heightCm;
      const isSameSize = size.widthCm === config.size.widthCm && size.heightCm === config.size.heightCm;
      return !isSameSize && area > currentArea;
    })
    .sort((a, b) => {
      const aSameWidth = a.widthCm === config.size.widthCm ? 0 : 1;
      const bSameWidth = b.widthCm === config.size.widthCm ? 0 : 1;
      if (aSameWidth !== bSameWidth) return aSameWidth - bSameWidth;
      return (a.widthCm * a.heightCm) - (b.widthCm * b.heightCm);
    });
}

async function findSuggestedNoticeSize(config: NoticeConfig, minProbe: FitProbe, availableSizes: SizeOption[]): Promise<SizeOption | undefined> {
  const candidates = sortSuggestedSizes(config, availableSizes);

  for (const size of candidates) {
    const probe = { ...minProbe, config: { ...config, size } };
    if (await fitsInTypst(probe)) return size;
  }

  const maxExtraHeightCm = 12;
  for (let heightCm = config.size.heightCm + 0.5; heightCm <= config.size.heightCm + maxExtraHeightCm; heightCm += 0.5) {
    const roundedHeight = Number(heightCm.toFixed(1));
    const customSize: SizeOption = {
      id: `${config.size.widthCm}x${roundedHeight}-autofit`,
      name: `${config.size.widthCm} x ${roundedHeight} cm (Sugerido)`,
      widthCm: config.size.widthCm,
      heightCm: roundedHeight,
      isCustom: true,
    };
    const probe = { ...minProbe, config: { ...config, size: customSize } };
    if (await fitsInTypst(probe)) return customSize;
  }

  return undefined;
}

async function calculateAutoFitWithTypst(config: NoticeConfig, availableSizes: SizeOption[] = []): Promise<AutoFitResult> {
  const minBodyPt = 6.0;
  const maxBodyPt = 14.0;
  const currentBodyPt = Math.max(minBodyPt, Math.min(maxBodyPt, config.bodyFontSizePt));

  const minProbe = getScaledProbe(config, minBodyPt);
  const minFits = await fitsInTypst(minProbe);

  if (!minFits) {
    const suggestedSize = await findSuggestedNoticeSize(config, minProbe, availableSizes);
    const sizeMessage = suggestedSize
      ? ` Usa un aviso mayor: ${suggestedSize.widthCm} x ${suggestedSize.heightCm} cm.`
      : ' Crea un aviso de mayor alto o reduce contenido.';

    return {
      changes: {
        bodyFontSizePt: minProbe.bodyPt,
        headerFontSizePt: minProbe.headerPt,
        subheaderFontSizePt: minProbe.subheaderPt,
        lineHeight: minProbe.lineHeight,
      },
      suggestedSize,
      message: `El texto no cabe con el mínimo legible de ${minBodyPt} pt e interlineado ${minProbe.lineHeight.toFixed(2)}.${sizeMessage}`,
    };
  }

  let low = minBodyPt;
  let high = maxBodyPt;
  let bestProbe = minProbe;

  for (let i = 0; i < 8; i += 1) {
    const mid = Number(((low + high) / 2).toFixed(2));
    const probe = getScaledProbe(config, mid);
    const fits = await fitsInTypst(probe);

    if (fits) {
      bestProbe = probe;
      low = mid;
    } else {
      high = mid;
    }
  }

  const bodyDelta = Math.abs(bestProbe.bodyPt - currentBodyPt);

  if (bodyDelta < 0.05 && bestProbe.lineHeight === config.lineHeight) {
    return {
      changes: {},
      message: 'El aviso ya está encajado con el tamaño actual.',
    };
  }

  const actionText = bestProbe.bodyPt < currentBodyPt ? 'reducida' : 'ampliada';

  return {
    changes: {
      bodyFontSizePt: bestProbe.bodyPt,
      headerFontSizePt: bestProbe.headerPt,
      subheaderFontSizePt: bestProbe.subheaderPt,
      lineHeight: bestProbe.lineHeight,
    },
    message: `Fuente ${actionText} a ${bestProbe.bodyPt} pt según compilación real de Typst.`,
  };
}

async function compileWithTypstCli({ config, exportType = 'single-exact', format = 'pdf' }: CompileRequest): Promise<Buffer | string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'avisos-typst-'));

  try {
    let logoPath: string | undefined;
    if (config.logoUrl) {
      const logo = await resolveLogoAsset(config.logoUrl);
      if (logo) {
        logoPath = await writeLogoAssetForTypst(tempDir, logo);
      }
    }

    await fs.writeFile(path.join(tempDir, 'wrap-it.typ'), WRAP_IT_TYP_SOURCE, 'utf8');

    const typstCode = generateTypstMarkup(config, exportType, !!logoPath, logoPath);
    const codeToCompile = typstCode.replace(
      /#import\s+["']@preview\/wrap-it:[^"']+["']:\s*wrap-content/g,
      '#import "/wrap-it.typ": wrap-content'
    );

    const inputPath = path.join(tempDir, 'main.typ');
    const outputPath = path.join(tempDir, `notice.${format}`);
    await fs.writeFile(inputPath, codeToCompile, 'utf8');

    await execFileAsync('typst', ['compile', '--root', tempDir, inputPath, outputPath], {
      timeout: 20000,
      maxBuffer: 1024 * 1024 * 5,
    });

    if (format === 'pdf') {
      const grayPdfPath = path.join(tempDir, 'notice-gray.pdf');
      await convertPdfToDeviceGrayWithGhostscript(outputPath, grayPdfPath);
      return fs.readFile(grayPdfPath);
    }

    const output = await fs.readFile(outputPath);
    return fixSvgDimensions(output.toString('utf8'));
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';

  app.use(express.json({ limit: '25mb' }));

  app.post('/api/pdf/analyze-print-risk', express.raw({ type: ['application/pdf', 'application/octet-stream'], limit: '100mb' }), (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: 'Debes cargar un PDF para analizar.' });
        return;
      }

      res.json(analyzePdfPrintRisk(req.body));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido analizando el PDF.';
      console.error('PDF print-risk analysis error:', error);
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/pdf/convert-gray', express.raw({ type: ['application/pdf', 'application/octet-stream'], limit: '100mb' }), async (req, res) => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'avisos-pdf-gray-'));

    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: 'Debes cargar un PDF para convertir.' });
        return;
      }

      const inputPath = path.join(tempDir, 'input.pdf');
      const outputPath = path.join(tempDir, 'output-gray.pdf');
      const requestedMode = String(req.header('x-gray-conversion-mode') || '');
      const conversionMode: GrayConversionMode = requestedMode === 'preserve' ? 'preserve' : 'flatten';
      await fs.writeFile(inputPath, req.body);
      await convertPdfToDeviceGrayWithGhostscript(inputPath, outputPath, conversionMode);

      const originalName = decodeURIComponent(String(req.header('x-filename') || 'documento.pdf'));
      const baseName = path.basename(originalName, path.extname(originalName)) || 'documento';
      const outputName = `${baseName}_K.pdf`;
      const output = await fs.readFile(outputPath);

      res
        .type('application/pdf')
        .setHeader('Content-Disposition', `attachment; filename="${outputName.replace(/"/g, '')}"`)
        .send(output);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido convirtiendo el PDF a grises.';
      console.error('Ghostscript gray conversion error:', error);
      res.status(500).json({ error: message });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  app.post('/api/typst/compile', async (req, res) => {
    try {
      const { config, exportType, format }: CompileRequest = req.body;
      if (!config) {
        res.status(400).json({ error: 'Falta config para compilar el aviso.' });
        return;
      }

      const outputFormat = format === 'svg' ? 'svg' : 'pdf';
      const result = await compileWithTypstCli({ config, exportType, format: outputFormat });

      if (outputFormat === 'svg') {
        res.type('image/svg+xml').send(result);
      } else {
        res.type('application/pdf').send(result);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido compilando con Typst CLI.';
      console.error('Typst CLI compile error:', error);
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/typst/autofit', async (req, res) => {
    try {
      const { config, availableSizes }: { config?: NoticeConfig; availableSizes?: unknown } = req.body;
      if (!config) {
        res.status(400).json({ error: 'Falta config para calcular el auto-ajuste.' });
        return;
      }

      const result = await calculateAutoFitWithTypst(config, normalizeSizeOptions(availableSizes));
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido calculando el auto-ajuste.';
      console.error('Typst CLI auto-fit error:', error);
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, host, () => {
    console.log(`Local app running at http://localhost:${port}/`);
  });
}

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
