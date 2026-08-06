import { NoticeConfig } from '../types';
import { compileNoticeToPdf } from './typstService';

export interface PDFExportOptions {
  config: NoticeConfig;
  widthCm: number;
  heightCm: number;
  filename?: string;
  exportType?: 'single-exact' | 'a4-sheet';
}

/**
 * Generates and downloads a vector PDF using the local Typst CLI.
 */
export async function generateNoticePDF(options: PDFExportOptions): Promise<void> {
  const { config, exportType = 'single-exact', filename } = options;

  const pdfBytes = await compileNoticeToPdf(config, exportType);

  const defaultFilename = `aviso_${config.size.widthCm}x${config.size.heightCm}cm_${Date.now()}.pdf`;
  const finalFilename = filename || defaultFilename;

  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10000);
}
