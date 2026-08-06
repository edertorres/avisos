import React, { useState, useRef, useCallback } from 'react';
import { NoticeConfig, SizeOption, OverflowStatus } from './types';
import { INITIAL_SIZES, SAMPLE_NOTICE_IMAGE, DEFAULT_NOTICE_CONFIG } from './data/samples';
import { Header } from './components/Header';
import { EditorPanel } from './components/EditorPanel';
import { NoticePreview } from './components/NoticePreview';
import { generateNoticePDF } from './utils/pdfGenerator';
import { calculateAutoFitFont } from './utils/autoFitAlgorithm';

export default function App() {
  const [config, setConfig] = useState<NoticeConfig>(DEFAULT_NOTICE_CONFIG);
  const [sizes, setSizes] = useState<SizeOption[]>(INITIAL_SIZES);
  const [isExporting, setIsExporting] = useState<boolean>(false);
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

  // Reinforced High-Precision Auto-fit font algorithm
  const handleAutoFitFont = useCallback(() => {
    const containerEl = document.querySelector('[data-notice-canvas="true"] > div') as HTMLElement;
    if (!containerEl) {
      showToast('No se encontró el lienzo para calcular el auto-ajuste');
      return;
    }

    const result = calculateAutoFitFont(config, containerEl);
    if (!result) {
      showToast('No se pudo calcular el auto-ajuste.');
      return;
    }

    if (Object.keys(result.changes).length > 0) {
      handleConfigChange(result.changes);
    }
    showToast(result.message);
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
    <div className="h-screen w-screen bg-slate-900 text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Header Bar */}
      <Header
        onLoadSample={handleLoadSample}
        onReset={handleReset}
        onExportPdf={handleExportPdf}
        isExporting={isExporting}
        isOverflowing={overflowStatus.isOverflowing}
      />

      {/* Main Workspace */}
      <main className="flex-1 min-h-0 max-w-[1600px] w-full mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-y-auto lg:overflow-hidden">
        {/* Left Control Panel (5 cols desktop - Independent internal scroll) */}
        <div className="order-2 lg:order-1 lg:col-span-5 h-[500px] lg:h-full min-h-0 flex flex-col overflow-hidden">
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

        {/* Right Preview Panel (7 cols desktop - Static anchored canvas) */}
        <div className="order-1 lg:order-2 lg:col-span-7 h-[450px] sm:h-[550px] lg:h-full min-h-0 flex flex-col overflow-hidden">
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
