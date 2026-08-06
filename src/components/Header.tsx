import React, { useState } from 'react';
import { FileText, Download, RotateCcw, Sparkles, Printer, AlertTriangle, BookOpen, X } from 'lucide-react';
import manualText from '../../MANUAL_USUARIO.md?raw';

interface HeaderProps {
  onLoadSample: () => void;
  onReset: () => void;
  onExportPdf: (type: 'single-exact' | 'a4-sheet') => void;
  isExporting: boolean;
  isOverflowing: boolean;
}

function renderManualMarkdown(markdown: string) {
  return markdown.split('\n').map((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return <div key={index} className="h-2" />;
    }

    if (trimmed.startsWith('# ')) {
      return (
        <h1 key={index} className="mt-1 mb-3 text-xl font-black text-slate-950">
          {trimmed.replace(/^#\s+/, '')}
        </h1>
      );
    }

    if (trimmed.startsWith('## ')) {
      return (
        <h2 key={index} className="mt-5 mb-2 border-b border-slate-200 pb-1 text-sm font-extrabold uppercase tracking-wide text-slate-900">
          {trimmed.replace(/^##\s+/, '')}
        </h2>
      );
    }

    if (trimmed.startsWith('### ')) {
      return (
        <h3 key={index} className="mt-4 mb-1 text-sm font-bold text-slate-800">
          {trimmed.replace(/^###\s+/, '')}
        </h3>
      );
    }

    if (trimmed.startsWith('- ')) {
      return (
        <div key={index} className="ml-3 flex gap-2 text-sm leading-relaxed text-slate-700">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
          <span>{trimmed.replace(/^-\s+/, '')}</span>
        </div>
      );
    }

    if (/^\d+\.\s/.test(trimmed)) {
      return (
        <p key={index} className="pl-2 text-sm leading-relaxed text-slate-700">
          {trimmed}
        </p>
      );
    }

    if (trimmed.startsWith('```')) {
      return null;
    }

    return (
      <p key={index} className="text-sm leading-relaxed text-slate-700">
        {trimmed}
      </p>
    );
  });
}

export const Header: React.FC<HeaderProps> = ({
  onLoadSample,
  onReset,
  onExportPdf,
  isExporting,
  isOverflowing,
}) => {
  const [showManual, setShowManual] = useState(false);

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
            onClick={() => setShowManual(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-100 border border-blue-400/40 transition-colors"
            title="Abrir manual de usuario"
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-300" />
            <span>Manual</span>
          </button>

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

      {showManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-emerald-300" />
                <div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wide">Manual de Usuario</h2>
                  <p className="text-xs text-slate-300">Avisos impresos PDF para prensa y rotativa</p>
                </div>
              </div>
              <button
                onClick={() => setShowManual(false)}
                className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                title="Cerrar manual"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-1">
                {renderManualMarkdown(manualText)}
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                onClick={() => setShowManual(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
