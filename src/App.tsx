/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { MolecularStage } from './components/MolecularStage';
import { GraphPanel } from './components/GraphPanel';
import { ControlsPanel } from './components/ControlsPanel';
import { StatesOfMatterChamber } from './components/StatesOfMatterChamber';
import {
  SimulationParams,
  StateMetrics,
  DisplayOptions,
} from './types/physics';
import {
  getEquilibriumDistance,
  getMaxAttractionDistance,
  calculateForces,
  calculatePotential,
  getEffectiveSpringConstant,
} from './physics/lennardJones';
import { soundEngine } from './utils/audio';
import { Language, translations } from './i18n/translations';
import { Atom, Layers } from 'lucide-react';

const INITIAL_PARAMS: SimulationParams = {
  epsilon: 1.0,      // eV
  sigma: 3.4,        // Angstroms (Typical Argon atom)
  temperature: 25,   // Kelvin
  damping: 0.16,     // Smooth harmonic oscillation
  mass: 1.0,         // Normalized mass
  timeStep: 0.016,   // 60 FPS
};

export default function App() {
  const [lang, setLang] = useState<Language>('bn');
  const [activeMode, setActiveMode] = useState<'twoAtom' | 'statesOfMatter'>('twoAtom');
  const [params, setParams] = useState<SimulationParams>(INITIAL_PARAMS);
  const initialR0 = useMemo(() => getEquilibriumDistance(INITIAL_PARAMS.sigma), []);
  const [r, setR] = useState<number>(initialR0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  const t = translations[lang];

  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>({
    showVectors: true,
    showSpring: true,
    showDistanceGrid: true,
    showHookeTangent: true,
    showComponentCurves: true,
    showPotentialFill: true,
    clusterMode: false,
    soundEnabled: false,
  });

  // Calculate live state metrics
  const metrics: StateMetrics = useMemo(() => {
    const r0 = getEquilibriumDistance(params.sigma);
    const rRatio = r / r0;
    const potential = calculatePotential(r, params.epsilon, params.sigma);
    const forces = calculateForces(r, params.epsilon, params.sigma);
    const effectiveSpringConstant = getEffectiveSpringConstant(params.epsilon, params.sigma);
    const hookeForce = -effectiveSpringConstant * (r - r0);

    let stateDescription: 'repulsive' | 'equilibrium' | 'attractive' = 'equilibrium';
    if (rRatio < 0.98) stateDescription = 'repulsive';
    else if (rRatio > 1.02) stateDescription = 'attractive';

    let phase: 'solid' | 'liquid' | 'gas' = 'solid';
    if (params.temperature > 400) phase = 'gas';
    else if (params.temperature >= 150) phase = 'liquid';

    return {
      r,
      rRatio,
      potential,
      forces,
      effectiveSpringConstant,
      hookeForce,
      stateDescription,
      phase,
    };
  }, [r, params]);

  const handleParamsChange = useCallback((newParams: Partial<SimulationParams>) => {
    setParams((prev) => ({ ...prev, ...newParams }));
  }, []);

  const handleDistanceChange = useCallback((newR: number) => {
    setR(newR);
  }, []);

  const handleToggleDisplay = useCallback((key: keyof DisplayOptions) => {
    setDisplayOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleToggleSound = useCallback(() => {
    setDisplayOptions((prev) => {
      const nextVal = !prev.soundEnabled;
      soundEngine.setEnabled(nextVal);
      return { ...prev, soundEnabled: nextVal };
    });
  }, []);

  const handleToggleLang = useCallback(() => {
    setLang((prev) => (prev === 'bn' ? 'en' : 'bn'));
  }, []);

  const handleApplyPreset = useCallback(
    (type: 'equilibrium' | 'max_attraction' | 'repulsion' | 'solid' | 'liquid' | 'gas') => {
      const r0 = getEquilibriumDistance(params.sigma);
      const rMaxAtt = getMaxAttractionDistance(params.sigma);

      switch (type) {
        case 'equilibrium':
          setR(r0);
          setIsPlaying(false);
          break;
        case 'max_attraction':
          setR(rMaxAtt);
          setIsPlaying(true);
          break;
        case 'repulsion':
          setR(0.85 * r0);
          setIsPlaying(true);
          break;
        case 'solid':
          setParams((prev) => ({ ...prev, temperature: 30 }));
          setIsPlaying(true);
          break;
        case 'liquid':
          setParams((prev) => ({ ...prev, temperature: 260 }));
          setIsPlaying(true);
          break;
        case 'gas':
          setParams((prev) => ({ ...prev, temperature: 620 }));
          setIsPlaying(true);
          break;
      }
    },
    [params.sigma]
  );

  const handleReset = useCallback(() => {
    const r0 = getEquilibriumDistance(INITIAL_PARAMS.sigma);
    setParams(INITIAL_PARAMS);
    setR(r0);
    setIsPlaying(false);
  }, []);

  return (
    <div className="min-h-screen bg-[#f0f7ff] text-slate-800 flex flex-col font-sans">
      {/* Top Header with Language Switcher and Red UDVASH Badge */}
      <Header
        metrics={metrics}
        soundEnabled={displayOptions.soundEnabled}
        onToggleSound={handleToggleSound}
        onReset={handleReset}
        lang={lang}
        onToggleLang={handleToggleLang}
      />

      {/* Main Container: Full simulation space layout with Left Vertical Sidebar */}
      <main className="flex-1 w-full max-w-[1720px] mx-auto p-3 sm:p-5 lg:p-6 flex flex-col lg:flex-row gap-5 items-start">
        {/* Left Column: Vertical Control & Preset Panel */}
        <div className="w-full lg:w-[320px] xl:w-[340px] shrink-0 sticky top-20">
          <ControlsPanel
            r={r}
            onDistanceChange={handleDistanceChange}
            params={params}
            onParamsChange={handleParamsChange}
            metrics={metrics}
            displayOptions={displayOptions}
            onToggleDisplay={handleToggleDisplay}
            onApplyPreset={handleApplyPreset}
            lang={lang}
          />
        </div>

        {/* Right Area: Interactive Workspace */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 w-full">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-2 p-1.5 bg-white/95 rounded-2xl border border-sky-200/90 shadow-xs">
            <button
              onClick={() => setActiveMode('twoAtom')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeMode === 'twoAtom'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                  : 'text-slate-600 hover:text-sky-950 hover:bg-sky-50/80'
              }`}
            >
              <Atom className="w-4 h-4" />
              <span>{t.modeTwoAtom}</span>
            </button>
            <button
              onClick={() => setActiveMode('statesOfMatter')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeMode === 'statesOfMatter'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                  : 'text-slate-600 hover:text-sky-950 hover:bg-sky-50/80'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{t.modeStatesOfMatter}</span>
            </button>
          </div>

          {/* Active Mode Content */}
          {activeMode === 'twoAtom' ? (
            /* Side-by-Side Grid: Molecular Stage (Left) & Synced Graphs (Right) */
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch">
              {/* Left Box: Interactive Molecular Stage Canvas */}
              <div className="h-[540px] sm:h-[580px] xl:h-[620px] flex flex-col min-w-0">
                <MolecularStage
                  r={r}
                  onDistanceChange={handleDistanceChange}
                  params={params}
                  metrics={metrics}
                  displayOptions={displayOptions}
                  onToggleDisplay={handleToggleDisplay}
                  isPlaying={isPlaying}
                  onTogglePlay={() => setIsPlaying((prev) => !prev)}
                  lang={lang}
                />
              </div>

              {/* Right Box: Synchronized Dynamic Real-Time Curves */}
              <div className="h-[540px] sm:h-[580px] xl:h-[620px] flex flex-col min-w-0">
                <GraphPanel
                  r={r}
                  onDistanceChange={handleDistanceChange}
                  params={params}
                  metrics={metrics}
                  displayOptions={displayOptions}
                  lang={lang}
                />
              </div>
            </div>
          ) : (
            /* Dedicated States of Matter Chamber */
            <div className="w-full">
              <StatesOfMatterChamber
                lang={lang}
                epsilon={params.epsilon}
                sigma={params.sigma}
                temperature={params.temperature}
                onTemperatureChange={(newT) => handleParamsChange({ temperature: newT })}
              />
            </div>
          )}

          {/* Scientific Key Insights Card Grid (Bilingual) */}
          <div className="rounded-2xl bg-white/95 border border-sky-200/90 p-4 sm:p-5 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
            <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-100 space-y-1.5">
              <h3 className="font-bold text-sky-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                {t.insight1Title}
              </h3>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                {t.insight1Desc}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-100 space-y-1.5">
              <h3 className="font-bold text-sky-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                {t.insight2Title}
              </h3>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                {t.insight2Desc}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-100 space-y-1.5">
              <h3 className="font-bold text-sky-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                {t.insight3Title}
              </h3>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                {t.insight3Desc}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer in Bilingual Version */}
      <footer className="border-t border-sky-200/80 bg-white/85 py-3.5 px-6 text-center text-xs text-sky-900 font-medium">
        <span>{t.footer}</span>
      </footer>
    </div>
  );
}
