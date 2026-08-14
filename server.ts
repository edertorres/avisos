import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { NoticeConfig } from './src/types';
import { generateTypstMarkup } from './src/utils/typstGenerator';
import { WRAP_IT_TYP_SOURCE } from './src/utils/wrapItSource';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface CompileRequest {
  config: NoticeConfig;
  exportType?: 'single-exact' | 'a4-sheet';
  format?: 'svg' | 'pdf';
}

interface ImageAsset {
  bytes: Buffer;
  path: string;
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
}

interface FitProbe {
  config: NoticeConfig;
  bodyPt: number;
  headerPt: number;
  subheaderPt: number;
  lineHeight: number;
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

  return { bytes, path: `/logo.${extension}` };
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
  return { bytes, path: `/logo.${extension}` };
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

function chooseLineHeight(bodyPt: number): number {
  if (bodyPt < 5.5) return 1.0;
  if (bodyPt < 7.0) return 1.08;
  if (bodyPt < 9.0) return 1.15;
  return 1.25;
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
    headerPt: Number(Math.max(5.0, Math.min(20.0, bodyPt * headerRatio)).toFixed(2)),
    subheaderPt: Number(Math.max(4.5, Math.min(16.0, bodyPt * subheaderRatio)).toFixed(2)),
    lineHeight: chooseLineHeight(bodyPt),
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

async function calculateAutoFitWithTypst(config: NoticeConfig): Promise<AutoFitResult> {
  const minBodyPt = 4.0;
  const maxBodyPt = 14.0;
  const currentBodyPt = Math.max(minBodyPt, Math.min(maxBodyPt, config.bodyFontSizePt));

  const minProbe = getScaledProbe(config, minBodyPt);
  const minFits = await fitsInTypst(minProbe);

  if (!minFits) {
    return {
      changes: {
        bodyFontSizePt: minProbe.bodyPt,
        headerFontSizePt: minProbe.headerPt,
        subheaderFontSizePt: minProbe.subheaderPt,
        lineHeight: minProbe.lineHeight,
      },
      message: 'El texto no cabe ni con la fuente mínima. Reduce contenido o aumenta el alto del aviso.',
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
        logoPath = logo.path;
        await fs.writeFile(path.join(tempDir, logo.path.slice(1)), logo.bytes);
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

    const output = await fs.readFile(outputPath);
    return format === 'svg' ? fixSvgDimensions(output.toString('utf8')) : output;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';

  app.use(express.json({ limit: '25mb' }));

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
      const { config }: { config?: NoticeConfig } = req.body;
      if (!config) {
        res.status(400).json({ error: 'Falta config para calcular el auto-ajuste.' });
        return;
      }

      const result = await calculateAutoFitWithTypst(config);
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
