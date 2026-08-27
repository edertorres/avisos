import { NoticeConfig, SizeOption } from '../types';

export interface AutoFitResult {
  changes: Partial<NoticeConfig>;
  message: string;
  suggestedSize?: SizeOption;
}

/**
 * Auto-fit based on real Typst CLI compilations performed by the local server.
 */
export async function calculateAutoFitFont(config: NoticeConfig, availableSizes: SizeOption[]): Promise<AutoFitResult | null> {
  const response = await fetch('/api/typst/autofit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ config, availableSizes }),
  });

  if (!response.ok) {
    let message = 'No se pudo calcular el auto-ajuste.';
    try {
      const body = await response.json();
      message = body.error || message;
    } catch {
      message = await response.text();
    }
    throw new Error(message);
  }

  return response.json();
}
