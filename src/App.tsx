import React, { useState, useCallback, useEffect, useRef } from 'react';
import { NoticeConfig, SizeOption, OverflowStatus } from './types';
import { INITIAL_SIZES, SAMPLE_NOTICE_IMAGE, DEFAULT_NOTICE_CONFIG } from './data/samples';
import { Header } from './components/Header';
import { EditorPanel } from './components/EditorPanel';
import { NoticePreview } from './components/NoticePreview';
import { generateNoticePDF } from './utils/pdfGenerator';
import { calculateAutoFitFont } from './utils/autoFitAlgorithm';
import { AlertTriangle, Download, FileText, Loader2, PanelLeftClose, PanelLeftOpen, Trash2, Upload, X } from 'lucide-react';

interface PrintRiskAnalysis {
  hasRisk: boolean;
  warnings: string[];
  recommendedMode: 'preserve' | 'flatten';
}

interface SavedNotice {
  id: string;
  name: string;
  config: NoticeConfig;
  createdAt: string;
  updatedAt: string;
}

interface NoticeJsonPayload {
  schemaVersion: 1;
  exportedAt: string;
  notice: {
    name: string;
    config: NoticeConfig;
  };
  customSizes: SizeOption[];
}

const SAVED_NOTICES_KEY = 'avisos.savedNotices.v1';
const CUSTOM_SIZES_KEY = 'avisos.customSizes.v1';

function isNoticeConfig(value: unknown): value is NoticeConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<NoticeConfig>;
  return (
    typeof config.headerTitle === 'string' &&
    typeof config.subheaderTitle === 'string' &&
    typeof config.bodyText === 'string' &&
    !!config.size &&
    typeof config.size.widthCm === 'number' &&
    typeof config.size.heightCm === 'number'
  );
}

function filenameSafeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'aviso';
}

function isSizeOption(value: unknown): value is SizeOption {
  if (!value || typeof value !== 'object') return false;
  const size = value as Partial<SizeOption>;
  return (
    typeof size.id === 'string' &&
    typeof size.name === 'string' &&
    typeof size.widthCm === 'number' &&
    typeof size.heightCm === 'number' &&
    size.widthCm > 0 &&
    size.heightCm > 0
  );
}

function mergeSizes(baseSizes: SizeOption[], extraSizes: SizeOption[]): SizeOption[] {
  return extraSizes.reduce<SizeOption[]>((merged, size) => {
    const exists = merged.some((item) => item.id === size.id || (item.widthCm === size.widthCm && item.heightCm === size.heightCm));
    return exists ? merged : [...merged, size];
  }, baseSizes);
}

export default function App() {
  const [config, setConfig] = useState<NoticeConfig>(DEFAULT_NOTICE_CONFIG);
  const [sizes, setSizes] = useState<SizeOption[]>(INITIAL_SIZES);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isGrayModalOpen, setIsGrayModalOpen] = useState<boolean>(false);
  const [isConvertingGrayPdf, setIsConvertingGrayPdf] = useState<boolean>(false);
  const [grayPdfFile, setGrayPdfFile] = useState<File | null>(null);
  const [flattenGrayPdf, setFlattenGrayPdf] = useState<boolean>(false);
  const [grayPdfProgress, setGrayPdfProgress] = useState<number>(0);
  const [grayPdfProgressLabel, setGrayPdfProgressLabel] = useState<string>('');
  const [isAnalyzingGrayPdf, setIsAnalyzingGrayPdf] = useState<boolean>(false);
  const [grayPdfRisk, setGrayPdfRisk] = useState<PrintRiskAnalysis | null>(null);
  const [isEditorPanelCollapsed, setIsEditorPanelCollapsed] = useState<boolean>(false);
  const [savedNotices, setSavedNotices] = useState<SavedNotice[]>([]);
  const [isSavedNoticesOpen, setIsSavedNoticesOpen] = useState<boolean>(false);
  const [overflowStatus, setOverflowStatus] = useState<OverflowStatus>({
    isOverflowing: false,
    overflowHeightPx: 0,
    overflowPercentage: 0,
    recommendedHeightCm: config.size.heightCm,
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const noticeJsonInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_NOTICES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSavedNotices(parsed.filter((item) => item && isNoticeConfig(item.config)));
        }
      }

      const rawSizes = localStorage.getItem(CUSTOM_SIZES_KEY);
      if (!rawSizes) return;

      const parsedSizes = JSON.parse(rawSizes);
      if (Array.isArray(parsedSizes)) {
        setSizes(mergeSizes(INITIAL_SIZES, parsedSizes.filter(isSizeOption).map((size) => ({ ...size, isCustom: true }))));
      }
    } catch (err) {
      console.warn('Saved notices/custom sizes load error:', err);
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleConfigChange = (updated: Partial<NoticeConfig>) => {
    setConfig((prev) => ({ ...prev, ...updated }));
  };

  const persistSavedNotices = (nextNotices: SavedNotice[]) => {
    setSavedNotices(nextNotices);
    localStorage.setItem(SAVED_NOTICES_KEY, JSON.stringify(nextNotices));
  };

  const persistCustomSizes = (nextSizes: SizeOption[]) => {
    const nextCustomSizes = nextSizes.filter((size) => size.isCustom);
    localStorage.setItem(CUSTOM_SIZES_KEY, JSON.stringify(nextCustomSizes));
  };

  const ensureSizeAvailable = (size: SizeOption) => {
    setSizes((prev) => {
      const exists = prev.some((item) => item.id === size.id || (item.widthCm === size.widthCm && item.heightCm === size.heightCm));
      if (exists) return prev;

      const nextSizes = [...prev, { ...size, isCustom: true }];
      persistCustomSizes(nextSizes);
      return nextSizes;
    });
  };

  const getSuggestedNoticeName = () => {
    const title = config.headerTitle.trim() || config.subheaderTitle.trim();
    const date = new Date().toLocaleDateString('es-CO');
    return title ? `${title} - ${date}` : `Aviso ${config.size.widthCm}x${config.size.heightCm} cm - ${date}`;
  };

  const handleSaveNotice = () => {
    const name = window.prompt('Nombre para guardar este anuncio:', getSuggestedNoticeName());
    if (!name) return;

    const now = new Date().toISOString();
    const savedNotice: SavedNotice = {
      id: `notice-${Date.now()}`,
      name: name.trim(),
      config,
      createdAt: now,
      updatedAt: now,
    };

    persistSavedNotices([savedNotice, ...savedNotices]);
    showToast('Anuncio guardado en este navegador.');
  };

  const handleLoadSavedNotice = (savedNotice: SavedNotice) => {
    ensureSizeAvailable(savedNotice.config.size);
    setConfig(savedNotice.config);
    setIsSavedNoticesOpen(false);
    showToast(`Anuncio cargado: ${savedNotice.name}`);
  };

  const handleDeleteSavedNotice = (id: string) => {
    if (!window.confirm('¿Eliminar este anuncio guardado?')) return;
    persistSavedNotices(savedNotices.filter((notice) => notice.id !== id));
    showToast('Anuncio eliminado.');
  };

  const handleExportNoticeJson = (noticeToExport?: SavedNotice) => {
    const exportName = noticeToExport?.name || getSuggestedNoticeName();
    const exportConfig = noticeToExport?.config || config;
    const customSizes = sizes.filter((size) => size.isCustom || size.id === exportConfig.size.id);
    const payload: NoticeJsonPayload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      notice: {
        name: exportName,
        config: exportConfig,
      },
      customSizes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameSafeName(exportName)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showToast('Anuncio exportado como JSON.');
  };

  const handleImportNoticeJsonFile = (file: File | null) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const importedConfig = isNoticeConfig(parsed)
          ? parsed
          : isNoticeConfig(parsed?.notice?.config)
          ? parsed.notice.config
          : isNoticeConfig(parsed?.config)
          ? parsed.config
          : null;

        if (!importedConfig) {
          showToast('El JSON no contiene un anuncio válido.');
          return;
        }

        if (Array.isArray(parsed?.customSizes)) {
          parsed.customSizes.forEach((size: SizeOption) => {
            if (size && typeof size.widthCm === 'number' && typeof size.heightCm === 'number') {
              ensureSizeAvailable(size);
            }
          });
        }
        ensureSizeAvailable(importedConfig.size);
        setConfig(importedConfig);
        showToast('Anuncio importado correctamente.');
      } catch (err) {
        console.error('Notice JSON import error:', err);
        showToast('No se pudo leer el archivo JSON.');
      } finally {
        if (noticeJsonInputRef.current) {
          noticeJsonInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleAddCustomSize = (newSize: SizeOption) => {
    setSizes((prev) => {
      const nextSizes = [...prev, { ...newSize, isCustom: true }];
      persistCustomSizes(nextSizes);
      return nextSizes;
    });
    showToast(`Nuevo tamaño agregado: ${newSize.widthCm} x ${newSize.heightCm} cm`);
  };

  const handleDeleteCustomSize = (id: string) => {
    setSizes((prev) => {
      const nextSizes = prev.filter((s) => s.id !== id);
      persistCustomSizes(nextSizes);
      return nextSizes;
    });
    if (config.size.id === id) {
      setConfig((prev) => ({ ...prev, size: INITIAL_SIZES[1] }));
    }
  };

  const handleLoadSample = () => {
    setConfig(SAMPLE_NOTICE_IMAGE);
    showToast('Ejemplo de aviso oficial cargado correctamente');
  };

  const handleReset = () => {
    setConfig(DEFAULT_NOTICE_CONFIG);
    showToast('Formulario limpiado');
  };

  const resetGrayPdfModal = () => {
    setIsGrayModalOpen(false);
    setGrayPdfFile(null);
    setFlattenGrayPdf(false);
    setGrayPdfProgress(0);
    setGrayPdfProgressLabel('');
    setIsAnalyzingGrayPdf(false);
    setGrayPdfRisk(null);
  };

  const analyzeGrayPdfRisk = async (file: File) => {
    try {
      setIsAnalyzingGrayPdf(true);
      setGrayPdfRisk(null);

      const response = await fetch('/api/pdf/analyze-print-risk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/pdf',
          'x-filename': encodeURIComponent(file.name),
        },
        body: file,
      });

      if (!response.ok) return;

      const analysis = (await response.json()) as PrintRiskAnalysis;
      setGrayPdfRisk(analysis);

      if (analysis.recommendedMode === 'flatten') {
        setFlattenGrayPdf(true);
      }
    } catch (err) {
      console.warn('PDF risk analysis error:', err);
    } finally {
      setIsAnalyzingGrayPdf(false);
    }
  };

  const handleConvertGrayPdf = async () => {
    if (!grayPdfFile) {
      showToast('Selecciona un PDF para convertir.');
      return;
    }

    try {
      setIsConvertingGrayPdf(true);
      setGrayPdfProgress(12);
      setGrayPdfProgressLabel('Preparando archivo...');
      showToast('Convirtiendo PDF externo a grises con Ghostscript...');

      window.setTimeout(() => {
        setGrayPdfProgress((current) => Math.max(current, 35));
        setGrayPdfProgressLabel('Aplicando perfil ICC...');
      }, 300);

      window.setTimeout(() => {
        setGrayPdfProgress((current) => Math.max(current, 68));
        setGrayPdfProgressLabel(flattenGrayPdf ? 'Acoplando transparencias a 1200 dpi...' : 'Preservando vectores y fuentes...');
      }, 1200);

      const response = await fetch('/api/pdf/convert-gray', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/pdf',
          'x-filename': encodeURIComponent(grayPdfFile.name),
          'x-gray-conversion-mode': flattenGrayPdf ? 'flatten' : 'preserve',
        },
        body: grayPdfFile,
      });

      if (!response.ok) {
        let message = 'No se pudo convertir el PDF.';
        try {
          const body = await response.json();
          message = body.error || message;
        } catch {
          message = await response.text();
        }
        throw new Error(message);
      }

      setGrayPdfProgress(90);
      setGrayPdfProgressLabel('Preparando descarga...');

      const blob = await response.blob();
      const baseName = grayPdfFile.name.replace(/\.pdf$/i, '') || 'documento';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}_K.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      setIsGrayModalOpen(false);
      setGrayPdfFile(null);
      setFlattenGrayPdf(false);
      setGrayPdfProgress(100);
      setGrayPdfProgressLabel('');
      setGrayPdfRisk(null);
      showToast('PDF convertido a canal K y descargado.');
    } catch (err) {
      console.error('Gray PDF conversion error:', err);
      const message = err instanceof Error ? err.message : 'Reintenta con otro PDF.';
      showToast(`Error convirtiendo PDF: ${message}`);
    } finally {
      setIsConvertingGrayPdf(false);
      window.setTimeout(() => {
        setGrayPdfProgress(0);
        setGrayPdfProgressLabel('');
      }, 500);
    }
  };

  // High-precision auto-fit: Typst CLI compiles trial sizes and chooses the largest one that fits.
  const handleAutoFitFont = useCallback(async () => {
    try {
      showToast('Calculando auto-ajuste con Typst...');
      const result = await calculateAutoFitFont(config);
      if (!result) {
        showToast('No se pudo calcular el auto-ajuste.');
        return;
      }

      if (Object.keys(result.changes).length > 0) {
        handleConfigChange(result.changes);
      }
      showToast(result.message);
    } catch (err) {
      console.error('Auto-fit error:', err);
      const message = err instanceof Error ? err.message : 'Revisa que Typst compile el aviso actual.';
      showToast(`No se pudo auto-ajustar: ${message}`);
    }
  }, [config, handleConfigChange]);

  // Export PDF handler
  const handleExportPdf = async (exportType: 'single-exact' | 'a4-sheet') => {
    if (overflowStatus.isOverflowing) {
      showToast('⚠️ NO SE PUEDE GENERAR EL PDF: El texto está desbordado. Usa "Auto-Encajar" o reduce el tamaño de letra.');
      return;
    }

    const noticeEl = document.querySelector('[data-notice-canvas="true"]') as HTMLElement;
    if (!noticeEl) {
      showToast('Error: No se encontró el lienzo para exportar');
      return;
    }

    try {
      setIsExporting(true);
      showToast('Generando PDF vectorial ultra nítido en escala de grises...');

      await generateNoticePDF({
        config,
        widthCm: config.size.widthCm,
        heightCm: config.size.heightCm,
        filename: `aviso_${config.size.widthCm}x${config.size.heightCm}cm_${Date.now()}.pdf`,
        exportType,
      });

      showToast('¡PDF generado y descargado con éxito!');
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('Ocurrió un error al generar el PDF. Por favor reintenta.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-100 text-slate-900 flex flex-col font-sans overflow-hidden">
      {/* Header Bar */}
      <Header
        onLoadSample={handleLoadSample}
        onReset={handleReset}
        onExportPdf={handleExportPdf}
        onOpenGrayPdfConverter={() => setIsGrayModalOpen(true)}
        onSaveNotice={handleSaveNotice}
        onOpenSavedNotices={() => setIsSavedNoticesOpen(true)}
        onExportNoticeJson={() => handleExportNoticeJson()}
        onImportNoticeJson={() => noticeJsonInputRef.current?.click()}
        isExporting={isExporting}
        isOverflowing={overflowStatus.isOverflowing}
      />

      <input
        ref={noticeJsonInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => handleImportNoticeJsonFile(event.target.files?.[0] || null)}
      />

      {/* Main Workspace */}
      <main className="flex-1 min-h-0 w-full p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-y-auto lg:overflow-hidden">
        {/* Left Control Panel (5 cols desktop - Independent internal scroll) */}
        {!isEditorPanelCollapsed && (
          <div className="order-2 lg:order-1 lg:col-span-5 h-[500px] lg:h-full min-h-0 flex flex-col overflow-hidden relative">
            <button
              type="button"
              onClick={() => setIsEditorPanelCollapsed(true)}
              className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
              title="Ocultar panel lateral"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
            <EditorPanel
              config={config}
              onChange={handleConfigChange}
              sizes={sizes}
              onAddCustomSize={handleAddCustomSize}
              onDeleteCustomSize={handleDeleteCustomSize}
              onAutoFitFont={handleAutoFitFont}
              isOverflowing={overflowStatus.isOverflowing}
            />
          </div>
        )}

        {/* Right Preview Panel (7 cols desktop - Static anchored canvas) */}
        <div
          className={`order-1 lg:order-2 ${
            isEditorPanelCollapsed ? 'lg:col-span-12' : 'lg:col-span-7'
          } h-[450px] sm:h-[550px] lg:h-full min-h-0 flex flex-col overflow-hidden relative`}
        >
          {isEditorPanelCollapsed && (
            <button
              type="button"
              onClick={() => setIsEditorPanelCollapsed(false)}
              className="absolute left-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-md transition-colors hover:bg-slate-100"
              title="Mostrar panel lateral"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
          <NoticePreview
            config={config}
            onConfigChange={handleConfigChange}
            onOverflowStatusChange={setOverflowStatus}
            onAutoFitFont={handleAutoFitFont}
            onSelectSize={(sz) => handleConfigChange({ size: sz })}
            availableSizes={sizes}
            onExportPdf={handleExportPdf}
            isExporting={isExporting}
          />
        </div>
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl border border-slate-700 flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {isSavedNoticesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-300" />
                <div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wide">Anuncios Guardados</h2>
                  <p className="text-xs text-slate-300">Guardado local en este navegador</p>
                </div>
              </div>
              <button
                onClick={() => setIsSavedNoticesOpen(false)}
                className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                title="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {savedNotices.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                  <p className="text-sm font-bold text-slate-800">Aún no hay anuncios guardados.</p>
                  <p className="mt-1 text-xs text-slate-500">Usa Guardar para conservar el anuncio actual en este navegador.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedNotices.map((notice) => {
                    const updatedAt = new Date(notice.updatedAt).toLocaleString('es-CO');
                    return (
                      <div key={notice.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-black text-slate-900">{notice.name}</h3>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {notice.config.size.widthCm} × {notice.config.size.heightCm} cm · {updatedAt}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleLoadSavedNotice(notice)}
                              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800"
                            >
                              Cargar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExportNoticeJson(notice)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100"
                              title="Exportar este anuncio"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSavedNotice(notice.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition-colors hover:bg-rose-100"
                              title="Eliminar este anuncio"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                type="button"
                onClick={() => noticeJsonInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100"
              >
                <Upload className="h-3.5 w-3.5" />
                Importar JSON
              </button>
              <button
                type="button"
                onClick={() => setIsSavedNoticesOpen(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {isGrayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-300" />
                <div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wide">Convertir PDF a Grises</h2>
                  <p className="text-xs text-slate-300">Ghostscript + ISOnewspaper26v4_gr.icc</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isConvertingGrayPdf) {
                    resetGrayPdfModal();
                  }
                }}
                className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
                disabled={isConvertingGrayPdf}
                title="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <label className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50">
                <Upload className="h-8 w-8 text-emerald-700" />
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {grayPdfFile ? grayPdfFile.name : 'Seleccionar PDF'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">El archivo se convertira a DeviceGray/K sin rasterizar textos ni imagenes</p>
                </div>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  disabled={isConvertingGrayPdf}
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setGrayPdfFile(file);
                    setFlattenGrayPdf(false);
                    setGrayPdfRisk(null);
                    if (file) {
                      void analyzeGrayPdfRisk(file);
                    }
                  }}
                />
              </label>

              {isAnalyzingGrayPdf && (
                <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-700" />
                  <span>Analizando transparencias, máscaras y efectos...</span>
                </div>
              )}

              {grayPdfRisk?.hasRisk && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-xs text-amber-950">
                  <div className="mb-2 flex items-center gap-2 font-extrabold">
                    <AlertTriangle className="h-4 w-4 text-amber-700" />
                    <span>Advertencia para RIP antiguo</span>
                  </div>
                  <div className="space-y-1">
                    {grayPdfRisk.warnings.slice(0, 4).map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                  <p className="mt-2 font-semibold">Se recomienda acoplar transparencias antes de enviar a rotativa.</p>
                </div>
              )}

              {isConvertingGrayPdf && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-emerald-950">
                    <span>{grayPdfProgressLabel || 'Procesando PDF...'}</span>
                    <span>{Math.max(1, Math.min(99, grayPdfProgress))}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white ring-1 ring-emerald-200">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all duration-500 ease-out"
                      style={{ width: `${Math.max(6, Math.min(99, grayPdfProgress))}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                Usa el perfil ICC local si esta disponible en el directorio actual. La salida preserva vectores, fuentes e imagenes; solo convierte el color a grises para imprenta.
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs text-slate-700 transition-colors hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={flattenGrayPdf}
                  disabled={isConvertingGrayPdf}
                  onChange={(event) => setFlattenGrayPdf(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 disabled:opacity-50"
                />
                <span>
                  <span className="block font-bold text-slate-900">Acoplar transparencias para RIP antiguo</span>
                  <span className="mt-0.5 block text-slate-500">Usa PDF 1.3 a 1200 dpi, sin reducir imagenes. Activar solo si la imprenta lo pide.</span>
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                onClick={() => {
                  resetGrayPdfModal();
                }}
                disabled={isConvertingGrayPdf}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConvertGrayPdf}
                disabled={!grayPdfFile || isConvertingGrayPdf}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {isConvertingGrayPdf ? 'Convirtiendo...' : 'Convertir y descargar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
