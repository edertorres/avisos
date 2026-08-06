import React, { useState, useRef } from 'react';
import { NoticeConfig, SizeOption, FontFamily, TextAlign } from '../types';
import { SAMPLE_SHIELD_LOGO } from '../data/samples';
import { FONT_OPTIONS } from '../data/fonts';
import { InDesignStepper } from './InDesignStepper';
import { cleanPastedText } from '../utils/textCleaner';
import {
  Upload,
  Image as ImageIcon,
  Ruler,
  Type,
  AlignJustify,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sliders,
  Sparkles,
  Bold,
  Plus,
  Trash2,
  FileUp,
  Layers,
  BoxSelect,
  Grid,
  WrapText,
} from 'lucide-react';

interface EditorPanelProps {
  config: NoticeConfig;
  onChange: (updated: Partial<NoticeConfig>) => void;
  sizes: SizeOption[];
  onAddCustomSize: (newSize: SizeOption) => void;
  onDeleteCustomSize: (id: string) => void;
  onAutoFitFont: () => void;
  isOverflowing: boolean;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  config,
  onChange,
  sizes,
  onAddCustomSize,
  onDeleteCustomSize,
  onAutoFitFont,
  isOverflowing,
}) => {
  // Custom size modal state
  const [customWidth, setCustomWidth] = useState<string>('6.3');
  const [customHeight, setCustomHeight] = useState<string>('3.5');
  const [customName, setCustomName] = useState<string>('');
  const [showAddSizeModal, setShowAddSizeModal] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Logo upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onChange({ logoUrl: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  // Text file import handler (.txt)
  const handleTextFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        onChange({ bodyText: cleanPastedText(text) });
      };
      reader.readAsText(file);
    }
  };

  // Paste handler for body text: strips formatting & hard line breaks automatically
  const handleBodyPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const rawText = e.clipboardData.getData('text/plain') || e.clipboardData.getData('text');
    const cleaned = cleanPastedText(rawText);

    if (!bodyTextareaRef.current) {
      onChange({ bodyText: cleaned });
      return;
    }

    const textarea = bodyTextareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = config.bodyText;

    const newText = current.substring(0, start) + cleaned + current.substring(end);
    onChange({ bodyText: newText });

    setTimeout(() => {
      if (bodyTextareaRef.current) {
        bodyTextareaRef.current.focus();
        const newPos = start + cleaned.length;
        bodyTextareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  // Paste handler for title inputs
  const handleTitlePaste = (
    e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    key: 'headerTitle' | 'subheaderTitle'
  ) => {
    e.preventDefault();
    const rawText = e.clipboardData.getData('text/plain') || e.clipboardData.getData('text');
    const cleaned = cleanPastedText(rawText);
    onChange({ [key]: cleaned });
  };

  // Clean all hard returns from current body text
  const handleCleanBodyReturns = () => {
    if (config.bodyText) {
      onChange({ bodyText: cleanPastedText(config.bodyText) });
    }
  };

  // Add bold formatting around selected text
  const applyBoldToSelection = () => {
    if (!bodyTextareaRef.current) return;
    const textarea = bodyTextareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = config.bodyText.substring(start, end);

    if (!selected) return;

    const before = config.bodyText.substring(0, start);
    const after = config.bodyText.substring(end);
    const newText = `${before}**${selected}**${after}`;

    onChange({ bodyText: newText });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 2, end + 2);
    }, 0);
  };

  // Apply alignment tag around selected text or word under cursor
  const applyAlignmentToSelection = (align: 'left' | 'center' | 'right' | 'justify') => {
    if (!bodyTextareaRef.current) return;
    const textarea = bodyTextareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const fullText = config.bodyText;

    let selected = fullText.substring(start, end);
    let selStart = start;
    let selEnd = end;

    // If nothing selected, select current word
    if (start === end) {
      const leftPart = fullText.substring(0, start);
      const rightPart = fullText.substring(start);
      const wordStartMatch = leftPart.search(/\S+$/);
      const wordEndMatch = rightPart.search(/\s/);

      selStart = wordStartMatch >= 0 ? wordStartMatch : start;
      selEnd = wordEndMatch >= 0 ? start + wordEndMatch : fullText.length;
      selected = fullText.substring(selStart, selEnd) || 'texto';
    }

    const before = fullText.substring(0, selStart);
    const after = fullText.substring(selEnd);
    const tagged = `[${align}]${selected}[/${align}]`;

    onChange({ bodyText: `${before}${tagged}${after}` });

    setTimeout(() => {
      if (bodyTextareaRef.current) {
        bodyTextareaRef.current.focus();
        bodyTextareaRef.current.setSelectionRange(selStart, selStart + tagged.length);
      }
    }, 0);
  };

  const addUniqueKeyword = (keywords: string[], value: string) => {
    const cleaned = value
      .replace(/\s+/g, ' ')
      .replace(/^[,.;:\s]+|[,.;:\s]+$/g, '')
      .trim();

    if (cleaned.length < 3) return;
    const normalized = cleaned.toLocaleUpperCase('es-CO');
    if (!keywords.some((kw) => kw.toLocaleUpperCase('es-CO') === normalized)) {
      keywords.push(cleaned);
    }
  };

  // Auto-highlight names and document identifiers through Typst bold keywords.
  const autoHighlightNamesAndDocs = () => {
    const keywords = [...(config.boldKeywords || [])];
    const text = config.bodyText || '';

    const upperPhraseRe = /\b[A-ZÁÉÍÓÚÑ]{3,}(?:\s+(?:DE|DEL|DE LA|LA|LAS|LOS|Y|[A-ZÁÉÍÓÚÑ]{3,})){1,}\b/g;
    for (const match of text.matchAll(upperPhraseRe)) {
      addUniqueKeyword(keywords, match[0]);
    }

    const titledNameRe = /\b(?:señor(?:a)?|sr\.?|sra\.?)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:de|del|de la|la|las|los|y|[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)){1,5})/gi;
    for (const match of text.matchAll(titledNameRe)) {
      addUniqueKeyword(keywords, match[1]);
    }

    const documentRe = /\b(?:NIT|No\.?|N°|C\.?C\.?|cédula(?: de ciudadanía)?(?: No\.?)?)\s*[:#]?\s*[\d. -]{5,}\b/gi;
    for (const match of text.matchAll(documentRe)) {
      addUniqueKeyword(keywords, match[0]);
    }

    const markdownBoldRe = /\*\*(.*?)\*\*/g;
    for (const match of text.matchAll(markdownBoldRe)) {
      addUniqueKeyword(keywords, match[1]);
    }

    onChange({ boldKeywords: keywords });
  };

  const clearAutoHighlights = () => {
    onChange({ boldKeywords: [] });
  };

  const highlightedCount = config.boldKeywords?.length || 0;

  const handleAddCustomSizeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(customWidth);
    const h = parseFloat(customHeight);
    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return;

    const name = customName.trim() || `${w} x ${h} cm`;
    const newSizeOption: SizeOption = {
      id: `custom-${Date.now()}`,
      name,
      widthCm: w,
      heightCm: h,
      isCustom: true,
    };

    onAddCustomSize(newSizeOption);
    onChange({ size: newSizeOption });
    setShowAddSizeModal(false);
    setCustomName('');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
      {/* Panel Header */}
      <div className="bg-slate-900 text-white px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider">
            Panel Unificado de Parámetros
          </h2>
        </div>
        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
          Edición en vivo
        </span>
      </div>

      {/* Unified Single-Canvas Editor Body */}
      <div className="p-4 overflow-y-auto flex-1 space-y-6">
        {/* SECTION 1: TAMAÑO EN CM & MARGEN */}
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-200">
            <h3 className="text-xs font-extrabold uppercase text-slate-800 flex items-center gap-1.5">
              <Ruler className="w-4 h-4 text-emerald-600" />
              1. Dimensión del Aviso (Ancho × Alto en cm)
            </h3>
            <span className="text-[11px] font-mono font-bold text-slate-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {config.size.widthCm} × {config.size.heightCm} cm
            </span>
          </div>

          {/* Size selector dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={config.size.id}
              onChange={(e) => {
                const selected = sizes.find((sz) => sz.id === e.target.value);
                if (selected) onChange({ size: selected });
              }}
              className="flex-1 text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
            >
              {sizes.map((sz) => (
                <option key={sz.id} value={sz.id} className="text-slate-900 bg-white">
                  {sz.widthCm} × {sz.heightCm} cm — {sz.name}
                </option>
              ))}
            </select>
            {config.size.isCustom && (
              <button
                onClick={() => onDeleteCustomSize(config.size.id)}
                className="p-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center justify-center shrink-0"
                title="Eliminar este tamaño personalizado"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Add custom size form */}
          <div>
            <button
              onClick={() => setShowAddSizeModal(!showAddSizeModal)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Añadir Otro Tamaño en Centímetros</span>
            </button>

            {showAddSizeModal && (
              <form onSubmit={handleAddCustomSizeSubmit} className="mt-2 bg-slate-50 p-3 rounded-lg border border-slate-300 space-y-2">
                <div className="text-xs font-bold text-slate-800">
                  Definir Tamaño Personalizado
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-600 mb-0.5">Ancho (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="50"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(e.target.value)}
                      className="w-full text-xs font-mono border border-slate-300 rounded px-2 py-1 bg-white text-slate-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600 mb-0.5">Alto (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="50"
                      value={customHeight}
                      onChange={(e) => setCustomHeight(e.target.value)}
                      className="w-full text-xs font-mono border border-slate-300 rounded px-2 py-1 bg-white text-slate-900"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-600 mb-0.5">Etiqueta (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: AVISO 6.3x3.5 Especial"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-2 py-1 bg-white text-slate-900 placeholder:text-slate-400"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddSizeModal(false)}
                    className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs bg-slate-900 text-white font-semibold rounded hover:bg-slate-800"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Margin Rule setup (3mm default) */}
          <div className="mt-2">
            <InDesignStepper
              label="Margen de Texto"
              value={config.marginMm}
              onChange={(marginMm) => onChange({ marginMm })}
              min={1}
              max={10}
              step={0.5}
              unit="mm"
              presets={[1, 2, 3, 4, 5]}
              icon={<BoxSelect className="w-3.5 h-3.5 text-slate-600" />}
            />
          </div>
        </section>

        {/* SECTION 2: TEXTO Y LOGO */}
        <section className="space-y-3 pt-2 border-t border-slate-200">
          <h3 className="text-xs font-extrabold uppercase text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-200">
            <Type className="w-4 h-4 text-emerald-600" />
            2. Contenido del Texto y Logo
          </h3>

          {/* Logo Escudo Top Left */}
          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
                Logo Escudo (Esquina Izquierda)
              </span>
              {config.logoUrl && (
                <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  Logo Activo
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded border border-slate-300 bg-white flex items-center justify-center overflow-hidden p-1 shrink-0">
                {config.logoUrl ? (
                  <img
                    src={config.logoUrl}
                    alt="Logo"
                    className="max-h-full max-w-full object-contain filter grayscale"
                  />
                ) : (
                  <span className="text-[9px] text-slate-400 text-center leading-tight">Sin Logo</span>
                )}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex gap-2">
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1 text-xs bg-white hover:bg-slate-100 text-slate-700 font-medium py-1 px-2 rounded border border-slate-300 transition-colors"
                  >
                    <Upload className="w-3 h-3 text-slate-500" />
                    Subir Imagen
                  </button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />

                  {config.logoUrl ? (
                    <button
                      onClick={() => onChange({ logoUrl: null })}
                      className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 font-medium py-1 px-2 rounded border border-rose-200 transition-colors"
                    >
                      Quitar
                    </button>
                  ) : (
                    <button
                      onClick={() => onChange({ logoUrl: SAMPLE_SHIELD_LOGO })}
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-1 px-2 rounded border border-slate-300 transition-colors"
                    >
                      Usar Ejemplo
                    </button>
                  )}
                </div>

                {config.logoUrl && (
                  <div className="pt-1 space-y-2">
                    <InDesignStepper
                      label="Ancho del Logo"
                      value={config.logoWidthMm}
                      onChange={(logoWidthMm) => onChange({ logoWidthMm })}
                      min={5}
                      max={30}
                      step={1}
                      unit="mm"
                      presets={[8, 10, 12, 15, 18]}
                      icon={<ImageIcon className="w-3 h-3 text-slate-500" />}
                    />

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-1">
                        Ajuste y Posición de la Imagen (Text Wrap)
                      </label>
                      <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded border border-slate-200">
                        {[
                          { pos: 'left', label: 'Izquierda (Flotante)' },
                          { pos: 'right', label: 'Derecha (Flotante)' },
                          { pos: 'top-center', label: 'Centrado Arriba' },
                        ].map((opt) => {
                          const active = (config.logoPosition || 'left') === opt.pos;
                          return (
                            <button
                              key={opt.pos}
                              type="button"
                              onClick={() => onChange({ logoPosition: opt.pos as any })}
                              className={`py-1 px-1 rounded text-[9px] font-bold transition-colors ${
                                active
                                  ? 'bg-slate-900 text-white shadow-sm'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Titles Inputs */}
          <div className="space-y-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                Título Principal
              </label>
              <input
                type="text"
                value={config.headerTitle}
                onChange={(e) => onChange({ headerTitle: e.target.value })}
                onPaste={(e) => handleTitlePaste(e, 'headerTitle')}
                placeholder="Ej: AVISO ÚNICO, EDICTO, CITACIÓN"
                className="w-full text-xs font-bold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-900 focus:outline-none uppercase"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                Subtítulo / Entidad
              </label>
              <textarea
                rows={2}
                value={config.subheaderTitle}
                onChange={(e) => onChange({ subheaderTitle: e.target.value })}
                onPaste={(e) => handleTitlePaste(e, 'subheaderTitle')}
                placeholder="Ej: LA DIRECTORA DE TALENTO HUMANO DEL DEPARTAMENTO DE RISARALDA"
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg px-2.5 py-1 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-900 focus:outline-none uppercase resize-none"
              />
            </div>
          </div>

          {/* Body textarea */}
          <div>
            <div className="flex flex-wrap items-center justify-between mb-1 gap-1">
              <label className="text-[11px] font-bold text-slate-700">
                Cuerpo del Texto
              </label>
              <div className="flex flex-wrap items-center gap-1">
                {/* Selection Alignment Toolbar */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-300">
                  <span className="text-[9px] text-slate-500 font-bold px-1 uppercase">Alinear Sel:</span>
                  <button
                    type="button"
                    onClick={() => applyAlignmentToSelection('left')}
                    className="p-1 hover:bg-white text-slate-700 rounded transition-colors"
                    title="Alinear selección a la izquierda [left]"
                  >
                    <AlignLeft className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyAlignmentToSelection('center')}
                    className="p-1 hover:bg-white text-slate-700 rounded transition-colors"
                    title="Centrar selección [center]"
                  >
                    <AlignCenter className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyAlignmentToSelection('right')}
                    className="p-1 hover:bg-white text-slate-700 rounded transition-colors"
                    title="Alinear selección a la derecha [right]"
                  >
                    <AlignRight className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyAlignmentToSelection('justify')}
                    className="p-1 hover:bg-white text-slate-700 rounded transition-colors"
                    title="Justificar selección [justify]"
                  >
                    <AlignJustify className="w-3 h-3" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCleanBodyReturns}
                  className="p-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-0.5 border border-emerald-200"
                  title="Unir líneas y quitar retornos de carro"
                >
                  <WrapText className="w-3 h-3 text-emerald-600" />
                  <span className="text-[10px]">Sin Retornos</span>
                </button>

                <button
                  type="button"
                  onClick={applyBoldToSelection}
                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-0.5 border border-slate-300"
                  title="Formatear selección en negrita"
                >
                  <Bold className="w-3 h-3" />
                  <span className="text-[10px]">Negrita</span>
                </button>

                <button
                  type="button"
                  onClick={autoHighlightNamesAndDocs}
                  className="p-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-medium border border-amber-200"
                  title="Detectar nombres, frases en mayúsculas y documentos para resaltarlos en negrita"
                >
                  Resaltar Nombres{highlightedCount > 0 ? ` (${highlightedCount})` : ''}
                </button>

                {highlightedCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAutoHighlights}
                    className="p-1 rounded bg-white hover:bg-slate-100 text-slate-500 text-[10px] font-medium border border-slate-200"
                    title="Quitar resaltados automáticos"
                  >
                    Limpiar
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-0.5 border border-slate-300"
                >
                  <FileUp className="w-3 h-3" />
                  <span className="text-[10px]">.TXT</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={handleTextFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            <textarea
              ref={bodyTextareaRef}
              rows={8}
              value={config.bodyText}
              onChange={(e) => onChange({ bodyText: e.target.value })}
              onPaste={handleBodyPaste}
              placeholder="Pega o escribe aquí el texto del aviso..."
              className="w-full text-xs font-sans border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-900 focus:outline-none leading-relaxed"
            />
            <p className="mt-1 text-[10px] text-slate-500 italic">
              * Al pegar texto se elimina el formato y los retornos de carro automáticamente para asegurar un flujo de texto continuo.
            </p>
          </div>
        </section>

        {/* SECTION 3: ATRIBUTOS DE FUENTE Y FORMATO */}
        <section className="space-y-3 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between pb-1 border-b border-slate-200">
            <h3 className="text-xs font-extrabold uppercase text-slate-800 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-emerald-600" />
              3. Tipografía PT Sans & Formato
            </h3>

            <button
              onClick={onAutoFitFont}
              className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-slate-900 text-white font-bold text-[10px] rounded shadow-sm hover:opacity-90"
            >
              <Sparkles className="w-3 h-3 text-emerald-300" />
              Auto-Ajustar Fuente
            </button>
          </div>

          {/* Font Family selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Tipografía (Google Fonts PT Sans por defecto)
            </label>
            <select
              value={config.fontFamily}
              onChange={(e) => onChange({ fontFamily: e.target.value as FontFamily })}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.value} value={font.value} className="text-slate-900 bg-white">
                  {font.label}
                </option>
              ))}
            </select>
          </div>

          {/* Text Alignment */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Alineación
            </label>
            <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-lg">
              {[
                { align: 'justify', icon: AlignJustify, label: 'Justificado' },
                { align: 'left', icon: AlignLeft, label: 'Izquierda' },
                { align: 'center', icon: AlignCenter, label: 'Centro' },
                { align: 'right', icon: AlignRight, label: 'Derecha' },
              ].map((item) => {
                const Icon = item.icon;
                const active = config.textAlign === item.align;
                return (
                  <button
                    key={item.align}
                    onClick={() => onChange({ textAlign: item.align as TextAlign })}
                    className={`flex flex-col items-center justify-center py-1 rounded text-[10px] font-medium transition-colors ${
                      active
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 mb-0.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* InDesign Control Panel - Typography & Layout Grid */}
          <div className="space-y-2 bg-slate-100/80 p-2.5 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                Controles Tipográficos (Estilo InDesign)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Alta Precisión</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <InDesignStepper
                label="Tamaño Cuerpo"
                value={config.bodyFontSizePt}
                onChange={(bodyFontSizePt) => onChange({ bodyFontSizePt })}
                min={4}
                max={16}
                step={0.25}
                unit="pt"
                presets={[5, 5.5, 6, 6.5, 7, 8]}
                icon={<Type className="w-3.5 h-3.5 text-slate-600" />}
              />

              <InDesignStepper
                label="Título Principal"
                value={config.headerFontSizePt}
                onChange={(headerFontSizePt) => onChange({ headerFontSizePt })}
                min={5}
                max={24}
                step={0.5}
                unit="pt"
                presets={[7, 8, 9, 10, 12, 14]}
                icon={<Type className="w-3.5 h-3.5 text-slate-600" />}
              />

              <InDesignStepper
                label="Subtítulo / Entidad"
                value={config.subheaderFontSizePt}
                onChange={(subheaderFontSizePt) => onChange({ subheaderFontSizePt })}
                min={4.5}
                max={18}
                step={0.5}
                unit="pt"
                presets={[5, 6, 6.5, 7, 8, 9]}
                icon={<Type className="w-3.5 h-3.5 text-slate-600" />}
              />

              <InDesignStepper
                label="Interlineado"
                value={config.lineHeight}
                onChange={(lineHeight) => onChange({ lineHeight })}
                min={0.85}
                max={1.8}
                step={0.02}
                unit=""
                presets={[0.95, 1.0, 1.15, 1.25, 1.32]}
                icon={<Grid className="w-3.5 h-3.5 text-slate-600" />}
              />

              <div className="sm:col-span-2">
                <InDesignStepper
                  label="Grosor de Borde Negro"
                  value={config.borderWidthPx}
                  onChange={(borderWidthPx) => onChange({ borderWidthPx })}
                  min={0.25}
                  max={4}
                  step={0.25}
                  unit="px"
                  presets={[0.5, 1.0, 1.5, 2.0]}
                  icon={<BoxSelect className="w-3.5 h-3.5 text-slate-600" />}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
