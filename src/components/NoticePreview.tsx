import React, { useEffect, useState } from 'react';
import { NoticeConfig, OverflowStatus, SizeOption, FontFamily, TextAlign } from '../types';
import { FONT_OPTIONS } from '../data/fonts';
import { compileNoticeToSvg } from '../utils/typstService';
import { generateTypstMarkup } from '../utils/typstGenerator';
import {
  AlertTriangle,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Ruler,
  Download,
  Info,
  Type,
  AlignJustify,
  AlignLeft,
  AlignCenter,
  Minus,
  Plus,
  Loader2,
  FileCode2,
  Copy,
  Check,
  X,
  Rows3,
  FileText,
} from 'lucide-react';

const PT_PER_CM = 28.3465;

interface NoticePreviewProps {
  config: NoticeConfig;
  onConfigChange: (updated: Partial<NoticeConfig>) => void;
  onOverflowStatusChange: (status: OverflowStatus) => void;
  onAutoFitFont: () => void;
  onSelectSize: (size: SizeOption) => void;
  availableSizes: SizeOption[];
  onExportPdf: (type: 'single-exact' | 'a4-sheet') => void;
  isExporting: boolean;
}

function detectTypstOverflow(svg: string, config: NoticeConfig): OverflowStatus {
  const pageMatches = svg.match(/class="typst-page"/g);
  const pageCount = pageMatches ? pageMatches.length : 1;

  const viewBoxMatch = svg.match(/viewBox="0 0 ([\d.]+)\s+([\d.]+)"/);
  const dataHeightMatch = svg.match(/data-height="([\d.]+)"/);
  const pageHeightPt = viewBoxMatch
    ? parseFloat(viewBoxMatch[2])
    : dataHeightMatch
    ? parseFloat(dataHeightMatch[1])
    : config.size.heightCm * PT_PER_CM;

  let maxBaselineY = 0;

  // Typst CLI SVG output positions text with matrix(1 0 0 -1 x y).
  const matrixRe = /transform="matrix\(1 0 0 -1\s+(-?[\d.]+)\s+(-?[\d.]+)\)"/g;
  let matrixMatch;
  while ((matrixMatch = matrixRe.exec(svg)) !== null) {
    const y = parseFloat(matrixMatch[2]);
    if (!Number.isNaN(y) && y > maxBaselineY) {
      maxBaselineY = y;
    }
  }

  // Keep support for SVG output that positions elements with translate(x, y).
  const translateRe = /transform="translate\(\s*-?[\d.]+\s*,\s*(-?[\d.]+)\s*\)"/g;
  let translateMatch;
  while ((translateMatch = translateRe.exec(svg)) !== null) {
    const y = parseFloat(translateMatch[1]);
    if (!Number.isNaN(y) && y > maxBaselineY) {
      maxBaselineY = y;
    }
  }

  const estimatedTextBottomPt = maxBaselineY + Math.max(1.5, config.bodyFontSizePt * 0.35);
  const isOverflowing = pageCount > 1 || estimatedTextBottomPt > pageHeightPt - 0.5;
  const overflowHeightPt = Math.max(0, estimatedTextBottomPt - pageHeightPt);
  const overflowHeightPx = overflowHeightPt * (96 / 72);
  const overflowPercentage = isOverflowing
    ? Math.max(pageCount > 1 ? (pageCount - 1) * 100 : 1, Math.round((overflowHeightPt / pageHeightPt) * 100))
    : 0;
  const recommendedHeightCm = isOverflowing
    ? Number(Math.max(config.size.heightCm + 0.5, config.size.heightCm + overflowHeightPt / PT_PER_CM + 0.4).toFixed(1))
    : config.size.heightCm;

  return {
    isOverflowing,
    overflowHeightPx,
    overflowPercentage,
    recommendedHeightCm,
  };
}

export const NoticePreview: React.FC<NoticePreviewProps> = ({
  config,
  onConfigChange,
  onOverflowStatusChange,
  onAutoFitFont,
  onSelectSize,
  availableSizes,
  onExportPdf,
  isExporting,
}) => {
  const [zoomScale, setZoomScale] = useState<number>(2.2);
  const [svgContent, setSvgContent] = useState<string>('');
  const [isCompilingTypst, setIsCompilingTypst] = useState<boolean>(true);
  const [typstError, setTypstError] = useState<string | null>(null);
  const [showCodeModal, setShowCodeModal] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const [overflowData, setOverflowData] = useState<OverflowStatus>({
    isOverflowing: false,
    overflowHeightPx: 0,
    overflowPercentage: 0,
    recommendedHeightCm: config.size.heightCm,
  });

  // Calculate physical dimensions in screen pixels (1 cm ≈ 37.795px at standard 96 DPI)
  const BASE_DPI_PX_PER_CM = 37.795;
  const pixelWidth = config.size.widthCm * BASE_DPI_PX_PER_CM * zoomScale;
  const pixelHeight = config.size.heightCm * BASE_DPI_PX_PER_CM * zoomScale;
  const marginPx = (config.marginMm / 10) * BASE_DPI_PX_PER_CM * zoomScale;
  const wordCount = (config.bodyText || '')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\*\*/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  // Real-time Typst CLI vector compilation through the local server
  useEffect(() => {
    let isCancelled = false;
    setIsCompilingTypst(true);

    const timer = setTimeout(async () => {
      try {
        const svg = await compileNoticeToSvg(config, 'single-exact');
        if (!isCancelled) {
          setSvgContent(svg);
          setTypstError(null);

          const newStatus = detectTypstOverflow(svg, config);
          setOverflowData(newStatus);
          onOverflowStatusChange(newStatus);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Typst SVG Compilation error:', err);
          setTypstError(err?.message || 'Error al compilar con Typst CLI');
        }
      } finally {
        if (!isCancelled) {
          setIsCompilingTypst(false);
        }
      }
    }, 450);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [
    config.bodyText,
    config.headerTitle,
    config.subheaderTitle,
    config.bodyFontSizePt,
    config.headerFontSizePt,
    config.subheaderFontSizePt,
    config.lineHeight,
    config.letterSpacingMm,
    config.marginMm,
    config.size,
    config.fontFamily,
    config.logoUrl,
    config.logoWidthMm,
    config.logoPosition,
    config.logoVerticalAlign,
    config.borderWidthPx,
    config.textAlign,
    config.headerAlign,
    config.boldKeywords,
  ]);

  const recommendedNextSize = availableSizes.find(
    (s) => s.widthCm === config.size.widthCm && s.heightCm > config.size.heightCm
  );
  const commitBodyFontSize = (rawValue: string) => {
    const parsed = parseFloat(rawValue.replace(',', '.'));
    if (Number.isNaN(parsed)) return;
    const clamped = Math.min(16, Math.max(4, parsed));
    onConfigChange({ bodyFontSizePt: Number(clamped.toFixed(2)) });
  };

  return (
    <div className="bg-slate-100 rounded-xl border border-slate-200 flex flex-col h-full overflow-hidden shadow-inner">
      {/* Top Controls Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm font-black text-slate-900 uppercase tracking-wide">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-emerald-300">
            <Ruler className="w-4 h-4" />
          </span>
          <span>Vista previa</span>
        </div>

        {/* Zoom controls & Scale info */}
        <div className="flex items-center gap-2">
          {isCompilingTypst && (
            <div className="flex items-center gap-1 text-xs text-blue-600 font-bold animate-pulse mr-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Compilando...</span>
            </div>
          )}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setZoomScale((z) => Math.max(1, Number((z - 0.3).toFixed(1))))}
              className="p-1 hover:bg-white text-slate-700 rounded transition-colors"
              title="Alejar vista"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono font-extrabold text-slate-800 px-1 w-12 text-center">
              {Math.round((zoomScale / 2.2) * 100)}%
            </span>
            <button
              onClick={() => setZoomScale((z) => Math.min(4, Number((z + 0.3).toFixed(1))))}
              className="p-1 hover:bg-white text-slate-700 rounded transition-colors"
              title="Acercar vista"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomScale(2.2)}
              className="px-2 py-1 text-xs bg-white text-slate-700 hover:bg-slate-200 rounded font-bold border border-slate-300 ml-1"
            >
              Zoom 100%
            </button>
          </div>
        </div>
      </div>

      {/* Overflow Banner Indicator */}
      {overflowData.isOverflowing ? (
        <div className="bg-rose-50 border-b border-rose-200 p-3 flex flex-wrap items-center justify-between gap-2 text-rose-900 animate-fadeIn">
          <div className="flex items-center gap-2 text-sm font-black">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Desborde de texto. El contenido excede el espacio de {config.size.heightCm} cm.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onAutoFitFont}
              className="flex items-center gap-1 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded shadow-sm transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Auto-Ajustar Fuente
            </button>

            {recommendedNextSize && (
              <button
                onClick={() => onSelectSize(recommendedNextSize)}
                className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-900 font-bold text-xs rounded border border-rose-300 transition-colors"
              >
                <Ruler className="w-3.5 h-3.5 text-rose-600" />
                Usar {recommendedNextSize.widthCm}×{recommendedNextSize.heightCm} cm
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* QUICK CANVAS FLOATING TOOLBAR */}
      <div className="bg-white text-slate-900 px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-1.5">
            <Type className="w-3.5 h-3.5 text-emerald-600" /> Atributos Rápidos
          </span>

          {/* Quick Font selector */}
          <select
            value={config.fontFamily}
            onChange={(e) => onConfigChange({ fontFamily: e.target.value as FontFamily })}
            className="bg-white text-slate-900 border border-slate-300 rounded-md px-2.5 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font.value} value={font.value} className="text-slate-900 bg-white font-sans">
                {font.label}
              </option>
            ))}
          </select>

          {/* Font size +/- controls */}
          <div className="flex items-center gap-1 bg-slate-100 px-2 py-1.5 rounded-md border border-slate-200">
            <span className="text-xs text-slate-600 font-extrabold uppercase">Letra</span>
            <button
              onClick={() => onConfigChange({ bodyFontSizePt: Math.max(4, Number((config.bodyFontSizePt - 0.25).toFixed(2))) })}
              className="p-1 hover:bg-white rounded text-slate-700 border border-transparent hover:border-slate-200"
              title="Reducir letra"
            >
              <Minus className="w-3 h-3" />
            </button>
            <div className="relative w-20">
              <input
                type="text"
                inputMode="decimal"
                defaultValue={config.bodyFontSizePt.toString()}
                key={`quick-body-font-${config.bodyFontSizePt}`}
                onBlur={(e) => commitBodyFontSize(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                className="w-full rounded border border-slate-300 bg-white py-1 pr-6 pl-2 text-center font-mono text-sm font-extrabold text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 select-none text-xs font-extrabold text-slate-500 pointer-events-none">
                pt
              </span>
            </div>
            <button
              onClick={() => onConfigChange({ bodyFontSizePt: Math.min(16, Number((config.bodyFontSizePt + 0.25).toFixed(2))) })}
              className="p-1 hover:bg-white rounded text-slate-700 border border-transparent hover:border-slate-200"
              title="Aumentar letra"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Line-height +/- controls */}
          <div className="flex items-center gap-1 bg-emerald-50 px-2 py-1.5 rounded-md border border-emerald-200 shadow-sm">
            <Rows3 className="w-3.5 h-3.5 text-emerald-700" />
            <span className="text-xs text-emerald-800 font-extrabold uppercase">Inter</span>
            <button
              onClick={() => onConfigChange({ lineHeight: Math.max(1.1, Number((config.lineHeight - 0.02).toFixed(2))) })}
              className="p-1 hover:bg-white rounded text-slate-700 border border-transparent hover:border-emerald-200"
              title="Reducir interlineado"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-mono font-extrabold text-emerald-950 bg-white rounded px-1.5 min-w-12 text-center border border-emerald-200 text-sm">
              {config.lineHeight.toFixed(2)}
            </span>
            <button
              onClick={() => onConfigChange({ lineHeight: Math.min(1.8, Number((config.lineHeight + 0.02).toFixed(2))) })}
              className="p-1 hover:bg-white rounded text-slate-700 border border-transparent hover:border-emerald-200"
              title="Aumentar interlineado"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Alignment quick buttons */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-1.5 rounded-md border border-slate-200">
            {[
              { align: 'justify', icon: AlignJustify, label: 'Justificar' },
              { align: 'left', icon: AlignLeft, label: 'Izquierda' },
              { align: 'center', icon: AlignCenter, label: 'Centro' },
            ].map((btn) => {
              const Icon = btn.icon;
              const active = config.textAlign === btn.align;
              return (
                <button
                  key={btn.align}
                  onClick={() => onConfigChange({ textAlign: btn.align as TextAlign })}
                  className={`p-1.5 rounded transition-colors ${
                    active ? 'bg-slate-950 text-white font-bold shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-950'
                  }`}
                  title={btn.label}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Auto fit & guide toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={onAutoFitFont}
            className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-md shadow-sm transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Encajar</span>
          </button>

          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-600 hover:text-slate-950 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
            <input
              type="checkbox"
              checked={config.showMarginGuides}
              onChange={(e) => onConfigChange({ showMarginGuides: e.target.checked })}
              className="rounded accent-emerald-500"
            />
            <span>Guía 3mm</span>
          </label>
        </div>
      </div>

      {/* Main Preview Work Area */}
      <div className="flex-1 overflow-auto overscroll-contain p-4 sm:p-6 pt-8 pb-16 relative bg-slate-100">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#000 1px, transparent 1px)`,
            backgroundSize: `16px 16px`,
          }}
        />

        {/* Notice Card Frame Container */}
        <div className="relative z-10 w-max min-w-max transition-all duration-200 mx-auto">
          <div className="absolute -top-6 left-0 right-0 flex justify-between text-xs font-mono text-slate-500 font-bold">
            <span>0 cm</span>
            <span>{config.size.widthCm} cm</span>
          </div>
          <div className="absolute -left-7 top-0 bottom-0 flex flex-col justify-between text-xs font-mono text-slate-500 font-bold text-right pr-1">
            <span>0</span>
            <span>{config.size.heightCm}cm</span>
          </div>

          {/* TYPST CLI VECTOR CANVAS DISPLAY */}
          <div
            data-notice-canvas="true"
            style={{
              width: `${pixelWidth}px`,
              height: `${pixelHeight}px`,
            }}
            className={`bg-white text-black relative shadow-xl transition-shadow overflow-hidden box-border border border-slate-300 ${
              overflowData.isOverflowing ? 'ring-4 ring-rose-500/80' : ''
            }`}
          >
            {/* 3mm Margin Guide lines (Visual indicator inside preview if enabled) */}
            {config.showMarginGuides && (
              <div
                style={{
                  position: 'absolute',
                  top: `${marginPx}px`,
                  left: `${marginPx}px`,
                  right: `${marginPx}px`,
                  bottom: `${marginPx}px`,
                  border: '1px dashed rgba(220, 38, 38, 0.5)',
                  pointerEvents: 'none',
                  zIndex: 20,
                }}
                title="Guía de margen de seguridad (3 mm)"
              />
            )}

            {/* Typst SVG Render Output */}
            {typstError ? (
              <div className="w-full h-full p-4 bg-rose-50 text-rose-800 text-xs flex flex-col items-center justify-center text-center">
                <AlertTriangle className="w-6 h-6 text-rose-600 mb-2" />
                <p className="font-bold mb-1">Error de compilación en Typst</p>
                <p className="text-[11px] font-mono">{typstError}</p>
              </div>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center [&_svg]:w-full [&_svg]:h-full [&_svg]:object-contain"
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            )}
          </div>

          {/* Real physical size label floating */}
          <div className="mt-3 text-center">
            <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono text-slate-700 shadow-sm">
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-950 px-3 py-1.5 font-extrabold text-white border border-slate-800">
                <Ruler className="w-3.5 h-3.5 text-emerald-300" />
                {config.size.widthCm} × {config.size.heightCm} cm
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-3 py-1.5 font-extrabold text-amber-900 border border-amber-200">
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                {wordCount} palabras
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-3 py-1.5 font-extrabold text-emerald-900 border border-emerald-200">
                <Rows3 className="w-3.5 h-3.5 text-emerald-600" />
                Inter {config.lineHeight.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Quick Action Bar */}
      <div className="bg-white border-t border-slate-200 p-3 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600 font-bold flex items-center gap-1.5">
          <Info className="w-4 h-4 text-slate-500" />
          <span>{overflowData.isOverflowing ? 'Ajusta el aviso antes de exportar.' : 'Aviso listo para exportar.'}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCodeModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 font-bold text-sm rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 shadow-sm transition-colors"
            title="Ver o copiar el código Typst completo de este edicto"
          >
            <FileCode2 className="w-4 h-4 text-blue-600" />
            <span>Ver Código Typst</span>
          </button>

          <button
            onClick={() => onExportPdf('single-exact')}
            disabled={isExporting || overflowData.isOverflowing}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-bold text-sm rounded-lg shadow transition-colors ${
              overflowData.isOverflowing
                ? 'bg-rose-100 text-rose-800 border border-rose-300 cursor-not-allowed opacity-90'
                : 'bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50'
            }`}
            title={
              overflowData.isOverflowing
                ? '⚠️ No se puede exportar el PDF porque el texto está desbordado. Ajusta la fuente o usa Auto-Encajar.'
                : `Descargar PDF Vectorial (${config.size.widthCm}x${config.size.heightCm} cm)`
            }
          >
            {overflowData.isOverflowing ? (
              <>
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>PDF Deshabilitado (Texto Desbordado)</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Descargar PDF Vectorial ({config.size.widthCm}x${config.size.heightCm} cm)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Código Fuentes Typst Generado</h3>
                  <p className="text-xs text-slate-500">Documento listo para compilar con Typst CLI o Typst Web Engine</p>
                </div>
              </div>
              <button
                onClick={() => setShowCodeModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto bg-slate-950 font-mono text-xs text-slate-100 leading-relaxed selection:bg-blue-600 selection:text-white">
              <pre className="whitespace-pre-wrap break-all">
                {generateTypstMarkup(config, 'single-exact', !!config.logoUrl)}
              </pre>
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Formato: <code className="font-mono bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">.typ</code> ({config.size.widthCm}x{config.size.heightCm} cm)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const typstCode = generateTypstMarkup(config, 'single-exact', !!config.logoUrl);
                    navigator.clipboard.writeText(typstCode);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow transition-colors"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>¡Copiado al Portapapeles!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar Código</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowCodeModal(false)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
