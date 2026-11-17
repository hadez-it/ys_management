import React from 'react';
import { Settings, Type, RotateCcw, Minus, Plus } from 'lucide-react';

export const UI_SCALE_MIN = 80;
export const UI_SCALE_MAX = 130;
export const UI_SCALE_DEFAULT = 100;
export const UI_SCALE_STEP = 5;

interface SettingsViewProps {
  uiScale: number;
  onUiScaleChange: (value: number) => void;
}

const SCALE_PRESETS = [
  { value: 85, label: 'Compact' },
  { value: 100, label: 'Default' },
  { value: 110, label: 'Large' },
  { value: 120, label: 'Extra Large' },
];

export default function SettingsView({ uiScale, onUiScaleChange }: SettingsViewProps) {
  const percent = Math.round(uiScale);
  const decrease = () => onUiScaleChange(Math.max(UI_SCALE_MIN, percent - UI_SCALE_STEP));
  const increase = () => onUiScaleChange(Math.min(UI_SCALE_MAX, percent + UI_SCALE_STEP));

  return (
    <div className="space-y-6" id="settings-tab-module">
      {/* Page intro */}
      <div className="flex items-start gap-3">
        <div className="bg-teal-500/15 border border-teal-500/25 text-teal-300 p-2.5 rounded-xl shrink-0">
          <Settings className="h-5 w-5" />
        </div>
        <div className="text-left">
          <h3 className="text-base font-extrabold text-white font-display">Settings &amp; Preferences</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Tune the workspace to fit your screen and workflow. Preferences are saved on this device.
          </p>
        </div>
      </div>

      {/* Appearance */}
      <section className="ios-glass-card rounded-3xl p-5 md:p-6 space-y-6 text-left" id="settings-appearance-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-bold text-white">
              <Type className="h-4 w-4 text-teal-400" /> Display Scale
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Resize the entire interface — text, spacing, and controls — to match your eyesight and device.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onUiScaleChange(UI_SCALE_DEFAULT)}
            disabled={percent === UI_SCALE_DEFAULT}
            className="inline-flex items-center gap-1.5 shrink-0 border border-white/10 hover:border-teal-500/30 hover:bg-teal-500/10 text-slate-300 hover:text-teal-300 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-bold py-2 px-3 rounded-lg transition-all cursor-pointer active:scale-95 outline-none"
            title="Reset to the default 100% scale"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">UI Scale</span>
          <span className="text-xs font-bold text-teal-300 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-lg tabular-nums">
            {percent}%
          </span>
        </div>

        {/* Slider with step buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={decrease}
            disabled={percent <= UI_SCALE_MIN}
            className="flex items-center justify-center h-9 w-9 shrink-0 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer active:scale-95 transition-all outline-none"
            aria-label="Decrease interface scale"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <input
              type="range"
              min={UI_SCALE_MIN}
              max={UI_SCALE_MAX}
              step={UI_SCALE_STEP}
              value={percent}
              onChange={(e) => onUiScaleChange(Number(e.target.value))}
              className="w-full h-2 rounded-full accent-teal-400 cursor-pointer"
              aria-label="Interface scale"
              id="ui-scale-slider"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-semibold mt-1.5">
              <span>{UI_SCALE_MIN}%</span>
              <span>{UI_SCALE_MAX}%</span>
            </div>
          </div>
          <button
            type="button"
            onClick={increase}
            disabled={percent >= UI_SCALE_MAX}
            className="flex items-center justify-center h-9 w-9 shrink-0 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer active:scale-95 transition-all outline-none"
            aria-label="Increase interface scale"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2">
          {SCALE_PRESETS.map((preset) => {
            const isSelected = percent === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => onUiScaleChange(preset.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer active:scale-95 outline-none ${
                  isSelected
                    ? 'bg-teal-500/15 text-teal-300 border-teal-500/30 shadow-[0_0_12px_rgba(20,184,166,0.15)]'
                    : 'border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
                aria-pressed={isSelected}
              >
                <span>{preset.label}</span>
                <span className="text-[10px] opacity-70 tabular-nums">{preset.value}%</span>
              </button>
            );
          })}
        </div>

        <p className="text-[10px] text-slate-500 leading-relaxed border-t border-white/5 pt-3">
          Tip: “Default” restores the original 100% layout. The scale applies instantly across the whole app and stays
          saved on this device, even after logging out.
        </p>
      </section>
    </div>
  );
}
