import { NoticeConfig } from '../types';

interface CompileApiOptions {
  config: NoticeConfig;
  exportType: 'single-exact' | 'a4-sheet';
  format: 'svg' | 'pdf';
}

async function compileWithLocalTypstCli({ config, exportType, format }: CompileApiOptions): Promise<Response> {
  const response = await fetch('/api/typst/compile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ config, exportType, format }),
  });

  if (!response.ok) {
    let message = 'Error compilando con Typst CLI.';
    try {
      const body = await response.json();
      message = body.error || message;
    } catch {
      message = await response.text();
    }
    throw new Error(message);
  }

  return response;
}

/**
 * Renders notice to SVG string using the local Typst CLI through the dev server.
 */
export async function compileNoticeToSvg(
  config: NoticeConfig,
  exportType: 'single-exact' | 'a4-sheet' = 'single-exact'
): Promise<string> {
  const response = await compileWithLocalTypstCli({ config, exportType, format: 'svg' });
  return response.text();
}

/**
 * Compiles notice directly to a vector PDF using the local Typst CLI through the dev server.
 */
export async function compileNoticeToPdf(
  config: NoticeConfig,
  exportType: 'single-exact' | 'a4-sheet' = 'single-exact'
): Promise<Uint8Array> {
  const response = await compileWithLocalTypstCli({ config, exportType, format: 'pdf' });
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
