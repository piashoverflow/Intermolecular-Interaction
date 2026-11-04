/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sliders, Eye, Thermometer, Snowflake, Droplets, Wind } from 'lucide-react';
import { SimulationParams, StateMetrics, DisplayOptions } from '../types/physics';
import {
  getEquilibriumDistance,
  getEffectiveSpringConstant,
} from '../physics/lennardJones';
import { Language, translations } from '../i18n/translations';

interface ControlsPanelProps {
  r: number;
  onDistanceChange: (newR: number) => void;
  params: SimulationParams;
  onParamsChange: (newParams: Partial<SimulationParams>) => void;
  metrics: StateMetrics;
  displayOptions: DisplayOptions;
  onToggleDisplay: (key: keyof DisplayOptions) => void;
  onApplyPreset: (type: 'equilibrium' | 'max_attraction' | 'repulsion' | 'solid' | 'liquid' | 'gas') => void;
  lang: Language;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  r,
  onDistanceChange,
  params,
  onParamsChange,
  metrics,
  displayOptions,
  onToggleDisplay,
  onApplyPreset,
  lang,
}) => {
  const t = translations[lang];
  const r0 = getEquilibriumDistance(params.sigma);
  const kEff = getEffectiveSpringConstant(params.epsilon, params.sigma);

  return (
    <aside className="w-full flex flex-col gap-4 bg-white/95 rounded-2xl border border-sky-200/90 shadow-[0_4px_20px_rgba(186,230,253,0.3)] p-4 sm:p-5 text-slate-800 backdrop-blur-md">
      {/* Panel Title */}
      <div className="flex items-center justify-between pb-3 border-b border-sky-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700">
            <Sliders className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-sky-950 uppercase tracking-wider font-sans">
            {t.controlDeck}
          </h2>
        </div>
        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-sky-100 text-sky-800">
          k = {kEff.toFixed(1)} eV/Å²
        </span>
      </div>

      {/* Quick State Presets */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block font-sans">
          {t.quickPresets}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-1.5">
          <button
            onClick={() => onApplyPreset('equilibrium')}
            className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors flex items-center justify-between cursor-pointer font-sans"
          >
            <span>{t.presetEquilibrium}</span>
            <span className="font-mono text-[10px] text-emerald-700 font-bold">F = 0</span>
          </button>
          <button
            onClick={() => onApplyPreset('max_attraction')}
            className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 transition-colors flex items-center justify-between cursor-pointer font-sans"
          >
            <span>{t.presetMaxAttraction}</span>
            <span className="font-mono text-[10px] text-sky-600 font-bold">1.11 r₀</span>
          </button>
          <button
            onClick={() => onApplyPreset('repulsion')}
            className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition-colors flex items-center justify-between cursor-pointer font-sans"
          >
            <span>{t.presetRepulsion}</span>
            <span className="font-mono text-[10px] text-rose-600 font-bold">0.85 r₀</span>
          </button>
        </div>
      </div>

      {/* Sliders Container (Vertical Flow) */}
      <div className="space-y-3.5 pt-1">
        {/* Slider 1: Separation Distance (r) */}
        <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200/70 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 font-sans">
            <span>{t.separationDistance}</span>
            <span className="text-sky-800 font-mono font-bold bg-white px-2 py-0.5 rounded border border-sky-200 shadow-xs">
              {r.toFixed(3)} Å
            </span>
          </div>
          <input
            id="separation-slider"
            type="range"
            min={0.65 * params.sigma}
            max={2.65 * params.sigma}
            step={0.01}
            value={r}
            onChange={(e) => onDistanceChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500 font-sans">
            <span>{t.repulsiveLabel}</span>
            <span className="text-emerald-700 font-bold">r₀ = {r0.toFixed(2)} Å</span>
            <span>{t.tensionLabel}</span>
          </div>
        </div>

        {/* Slider 2: Potential Well Depth (epsilon) */}
        <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200/70 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 font-sans">
            <span>{t.wellDepth}</span>
            <span className="text-sky-800 font-mono font-bold bg-white px-2 py-0.5 rounded border border-sky-200 shadow-xs">
              {params.epsilon.toFixed(2)} eV
            </span>
          </div>
          <input
            id="epsilon-slider"
            type="range"
            min={0.4}
            max={3.0}
            step={0.05}
            value={params.epsilon}
            onChange={(e) => onParamsChange({ epsilon: parseFloat(e.target.value) })}
            className="w-full h-2 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500 font-sans">
            <span>{t.weakBond}</span>
            <span className="text-sky-700">U_min = -ε</span>
            <span>{t.strongBond}</span>
          </div>
        </div>

        {/* Slider 3: Atomic Size Parameter (sigma) */}
        <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200/70 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 font-sans">
            <span>{t.atomicDiameter}</span>
            <span className="text-sky-800 font-mono font-bold bg-white px-2 py-0.5 rounded border border-sky-200 shadow-xs">
              {params.sigma.toFixed(2)} Å
            </span>
          </div>
          <input
            id="sigma-slider"
            type="range"
            min={2.6}
            max={4.2}
            step={0.05}
            value={params.sigma}
            onChange={(e) => {
              const newSigma = parseFloat(e.target.value);
              const oldR0 = getEquilibriumDistance(params.sigma);
              const newR0 = getEquilibriumDistance(newSigma);
              const scaleRatio = newR0 / oldR0;
              onParamsChange({ sigma: newSigma });
              onDistanceChange(r * scaleRatio);
            }}
            className="w-full h-2 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500 font-sans">
            <span>{t.smallAtom}</span>
            <span className="text-sky-700">r₀ = 1.122 σ</span>
            <span>{t.largeAtom}</span>
          </div>
        </div>

        {/* Slider 4: Temperature & Thermal Kinetic Energy */}
        <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200/70 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 font-sans">
            <span className="flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-sky-600" />
              <span>{t.temperature}</span>
            </span>
            <span className="text-sky-800 font-mono font-bold bg-white px-2 py-0.5 rounded border border-sky-200 shadow-xs">
              {params.temperature.toFixed(0)} K
            </span>
          </div>
          <input
            id="temp-slider"
            type="range"
            min={10}
            max={750}
            step={10}
            value={params.temperature}
            onChange={(e) => onParamsChange({ temperature: parseFloat(e.target.value) })}
            className="w-full h-2 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
          />
          {/* Phase State Mini-Buttons */}
          <div className="grid grid-cols-3 gap-1 pt-1 font-sans">
            <button
              onClick={() => onApplyPreset('solid')}
              className={`py-1 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                params.temperature < 150
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
                  : 'bg-white text-slate-600 border border-sky-200 hover:bg-sky-100/60'
              }`}
            >
              <Snowflake className="w-3 h-3" />
              {t.solidState}
            </button>
            <button
              onClick={() => onApplyPreset('liquid')}
              className={`py-1 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                params.temperature >= 150 && params.temperature < 400
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
                  : 'bg-white text-slate-600 border border-sky-200 hover:bg-sky-100/60'
              }`}
            >
              <Droplets className="w-3 h-3" />
              {t.liquidState}
            </button>
            <button
              onClick={() => onApplyPreset('gas')}
              className={`py-1 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                params.temperature >= 400
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
                  : 'bg-white text-slate-600 border border-sky-200 hover:bg-sky-100/60'
              }`}
            >
              <Wind className="w-3 h-3" />
              {t.gasState}
            </button>
          </div>
        </div>
      </div>

      {/* Component Toggles */}
      <div className="pt-2 border-t border-sky-100 space-y-2 font-sans">
        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-sky-600" />
          <span>{t.overlays}</span>
        </label>
        <div className="space-y-1.5 text-xs">
          <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-sky-50 transition-colors cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={displayOptions.showVectors}
              onChange={() => onToggleDisplay('showVectors')}
              className="w-4 h-4 rounded border-sky-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="font-medium">{t.showVectors}</span>
          </label>

          <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-sky-50 transition-colors cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={displayOptions.showSpring}
              onChange={() => onToggleDisplay('showSpring')}
              className="w-4 h-4 rounded border-sky-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="font-medium">{t.showSpring}</span>
          </label>

          <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-sky-50 transition-colors cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={displayOptions.showHookeTangent}
              onChange={() => onToggleDisplay('showHookeTangent')}
              className="w-4 h-4 rounded border-sky-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="font-medium">{t.showHooke}</span>
          </label>

          <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-sky-50 transition-colors cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={displayOptions.showComponentCurves}
              onChange={() => onToggleDisplay('showComponentCurves')}
              className="w-4 h-4 rounded border-sky-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="font-medium">{t.showComponents}</span>
          </label>

          <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-sky-50 transition-colors cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={displayOptions.showPotentialFill}
              onChange={() => onToggleDisplay('showPotentialFill')}
              className="w-4 h-4 rounded border-sky-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="font-medium">{t.showPotentialFill}</span>
          </label>
        </div>
      </div>
    </aside>
  );
};
