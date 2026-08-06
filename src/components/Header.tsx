import React from 'react';
import { FileText, Download, RotateCcw, Sparkles, Printer, AlertTriangle } from 'lucide-react';

interface HeaderProps {
  onLoadSample: () => void;
  onReset: () => void;
  onExportPdf: (type: 'single-exact' | 'a4-sheet') => void;
  isExporting: boolean;
  isOverflowing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onLoadSample,
  onReset,
  onExportPdf,
  isExporting,
  isOverflowing,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & App Name */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight tracking-wide flex items-center gap-2">
              Avisos Impresos PDF
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Prensa & Escala de Grises
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Maquetador de Edictos y Avisos Legales en Centímetros (3 mm de Margen)
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onLoadSample}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            title="Cargar el texto de ejemplo de la imagen adjunta"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Cargar</span> Ejemplo Imagen
          </button>

          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Reiniciar a valores por defecto"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Limpiar</span>
          </button>

          {/* Export Dropdown / Buttons */}
          <div
            className={`flex items-center gap-1 font-medium text-xs rounded-lg p-0.5 shadow-sm transition-colors ${
              isOverflowing
                ? 'bg-rose-950/80 border border-rose-700/60 text-rose-300'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <button
              onClick={() => onExportPdf('single-exact')}
              disabled={isExporting || isOverflowing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-emerald-700/50 disabled:opacity-60 transition-colors cursor-pointer disabled:cursor-not-allowed"
              title={
                isOverflowing
                  ? '⚠️ No se puede generar PDF si el texto está desbordado. Usa Auto-Encajar o reduce la fuente.'
                  : 'Descargar PDF único con el tamaño exacto en cm (6.3x3, 6.3x4, etc.)'
              }
            >
              {isOverflowing ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>
                {isExporting
                  ? 'Generando...'
                  : isOverflowing
                  ? 'PDF Deshabilitado (Desborde)'
                  : 'Descargar PDF (Cm Real)'}
              </span>
            </button>
            <div
              className={`w-px h-4 ${isOverflowing ? 'bg-rose-700/60' : 'bg-emerald-400/40'}`}
            ></div>
            <button
              onClick={() => onExportPdf('a4-sheet')}
              disabled={isExporting || isOverflowing}
              className="px-2 py-1.5 rounded-md hover:bg-emerald-700/50 disabled:opacity-60 transition-colors text-emerald-100 cursor-pointer disabled:cursor-not-allowed"
              title={
                isOverflowing
                  ? '⚠️ No se puede generar PDF si el texto está desbordado'
                  : 'Descargar hoja A4 con múltiples avisos y marcas de corte para imprenta'
              }
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Overflow Banner Warning at top if active */}
      {isOverflowing && (
        <div className="bg-rose-600 text-white px-4 py-1.5 text-xs font-semibold text-center flex items-center justify-center gap-2 border-t border-rose-500">
          <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0 animate-bounce" />
          <span>⚠️ ¡ATENCIÓN! El texto se DESBORDA del área delimitada. NO SE PERMITE GENERAR EL PDF mientras exista desborde. Utiliza &quot;Auto-Encajar&quot; o reduce el tamaño de fuente.</span>
        </div>
      )}
    </header>
  );
};
