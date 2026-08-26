import React, { useState, useRef, useCallback } from 'react';
import { NoticeConfig, SizeOption, OverflowStatus } from './types';
import { INITIAL_SIZES, SAMPLE_NOTICE_IMAGE, DEFAULT_NOTICE_CONFIG } from './data/samples';
import { Header } from './components/Header';
import { EditorPanel } from './components/EditorPanel';
import { NoticePreview } from './components/NoticePreview';
import { generateNoticePDF } from './utils/pdfGenerator';
import { calculateAutoFitFont } from './utils/autoFitAlgorithm';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export default function App() {
  const [config, setConfig] = useState<NoticeConfig>(DEFAULT_NOTICE_CONFIG);
  const [sizes, setSizes] = useState<SizeOption[]>(INITIAL_SIZES);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isEditorPanelCollapsed, setIsEditorPanelCollapsed] = useState<boolean>(false);
  const [overflowStatus, setOverflowStatus] = useState<OverflowStatus>({
    isOverflowing: false,
    overflowHeightPx: 0,
    overflowPercentage: 0,
    recommendedHeightCm: config.size.heightCm,
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleConfigChange = (updated: Partial<NoticeConfig>) => {
    setConfig((prev) => ({ ...prev, ...updated }));
  };

  const handleAddCustomSize = (newSize: SizeOption) => {
    setSizes((prev) => [...prev, newSize]);
    showToast(`Nuevo tamaño agregado: ${newSize.widthCm} x ${newSize.heightCm} cm`);
  };

  const handleDeleteCustomSize = (id: string) => {
    setSizes((prev) => prev.filter((s) => s.id !== id));
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
      showToast('Generando PDF vectorial ultra nítido en escala de grises (DeviceGray)...');

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
        isExporting={isExporting}
        isOverflowing={overflowStatus.isOverflowing}
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
    </div>
  );
}
