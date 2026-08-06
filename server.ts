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
