import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface InDesignStepperProps {
  label: string;
  value: number;
  onChange: (newValue: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  presets?: number[];
  decimals?: number;
  icon?: React.ReactNode;
}

export const InDesignStepper: React.FC<InDesignStepperProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  presets,
  decimals,
  icon,
}) => {
  const dec = decimals ?? (step < 0.1 ? 2 : step < 1 ? 1 : 0);

  const handleDecrement = () => {
    const next = Math.max(min, Number((value - step).toFixed(4)));
    onChange(next);
  };

  const handleIncrement = () => {
    const next = Math.min(max, Number((value + step).toFixed(4)));
    onChange(next);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      onChange(clamped);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 truncate">
          {icon}
          {label}
        </span>
        <span className="text-[10px] font-mono text-slate-400 font-medium">
          {min}-{max}{unit}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= min}
          className="w-7 h-7 flex items-center justify-center bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 disabled:opacity-30 rounded border border-slate-300 transition-colors shrink-0 shadow-xs"
          title="Disminuir"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <div className="relative flex-1 flex items-center">
          <input
            type="number"
            step={step}
            min={min}
            max={max}
            value={Number(value.toFixed(dec))}
            onChange={handleInputChange}
            className="w-full text-center text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded py-1 px-1 focus:ring-2 focus:ring-slate-900 focus:outline-none"
          />
          {unit && (
            <span className="absolute right-1.5 text-[10px] font-bold text-slate-400 pointer-events-none select-none">
              {unit}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={value >= max}
          className="w-7 h-7 flex items-center justify-center bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 disabled:opacity-30 rounded border border-slate-300 transition-colors shrink-0 shadow-xs"
          title="Aumentar"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {presets && presets.length > 0 && (
        <div className="flex items-center gap-1 mt-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {presets.map((p) => {
            const isSelected = Math.abs(value - p) < 0.01;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onChange(p)}
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-all shrink-0 ${
                  isSelected
                    ? 'bg-slate-900 text-white font-bold border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {p}{unit}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
