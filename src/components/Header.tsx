/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RotateCcw, Volume2, VolumeX, Sparkles, Languages } from 'lucide-react';
import { StateMetrics } from '../types/physics';
import { Language, translations } from '../i18n/translations';

interface HeaderProps {
  metrics: StateMetrics;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onReset: () => void;
  lang: Language;
  onToggleLang: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  metrics,
  soundEnabled,
  onToggleSound,
  onReset,
  lang,
  onToggleLang,
}) => {
  const t = translations[lang];
  const isNearEquilibrium = Math.abs(metrics.rRatio - 1.0) < 0.02;
  const isRepulsive = metrics.rRatio < 0.98;

  return (
    <header className="border-b border-sky-200/90 bg-white/95 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 lg:px-8 py-3 shadow-[0_2px_12px_rgba(186,230,253,0.3)]">
      <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand & Scientific Context */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-sky-500/25">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap font-sans">
              {t.appTitle}
            </h1>
            <p className="text-xs text-sky-700 font-medium font-sans">
              {t.appSubtitle}
            </p>
          </div>
        </div>

        {/* Live Readout Bar */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-50 border border-sky-200 shadow-xs">
            <span className="text-slate-500 font-sans">{t.regime}:</span>
            {isNearEquilibrium ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1 font-sans">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {t.equilibrium}
              </span>
            ) : isRepulsive ? (
              <span className="text-rose-700 font-bold flex items-center gap-1 font-sans">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                {t.repulsive}
              </span>
            ) : (
              <span className="text-sky-700 font-bold flex items-center gap-1 font-sans">
                <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                {t.attractive}
              </span>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2.5 text-slate-600 tabular-nums bg-white px-3 py-1 rounded-lg border border-sky-100 shadow-xs">
            <span>
              {t.netForce} F<sub className="text-[10px]">net</sub>:{' '}
              <strong className={metrics.forces.net > 0.05 ? 'text-rose-600 font-bold' : metrics.forces.net < -0.05 ? 'text-sky-700 font-bold' : 'text-emerald-600 font-bold'}>
                {metrics.forces.net >= 0 ? '+' : ''}{metrics.forces.net.toFixed(2)} eV/Å
              </strong>
            </span>
            <span aria-hidden="true" className="text-sky-300">·</span>
            <span>
              {t.potentialEnergy} U(r):{' '}
              <strong className={metrics.potential < -0.9 ? 'text-emerald-600 font-bold' : 'text-slate-800 font-bold'}>
                {metrics.potential.toFixed(3)} eV
              </strong>
            </span>
          </div>

          {/* Action CTAs: Language Switcher, Sound, Reset, and Red UDVASH */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Language Switcher (Bangla <-> English) */}
            <button
              onClick={onToggleLang}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-100/80 hover:bg-sky-200/80 text-sky-900 border border-sky-300/80 font-bold text-xs transition-all cursor-pointer shadow-xs font-sans"
              title={lang === 'bn' ? 'Switch to English' : 'বাংলায় পরিবর্তন করুন'}
              aria-label="Toggle Language"
            >
              <Languages className="w-3.5 h-3.5 text-sky-700" />
              <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
            </button>

            {/* Audio Toggle */}
            <button
              onClick={onToggleSound}
              className={`p-2 rounded-lg border transition-all cursor-pointer shadow-xs ${
                soundEnabled
                  ? 'bg-sky-500 text-white border-sky-600 hover:bg-sky-600 shadow-sky-500/20'
                  : 'bg-white text-slate-600 border-sky-200 hover:text-slate-900 hover:bg-sky-50'
              }`}
              title={soundEnabled ? t.muteSound : t.enableSound}
              aria-label="Toggle Sound"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Reset Button */}
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100/80 text-sky-800 border border-sky-200 font-medium text-xs transition-all cursor-pointer shadow-xs font-sans"
              title={t.reset}
              aria-label="Reset simulation"
            >
              <RotateCcw className="w-3.5 h-3.5 text-sky-600" />
              <span>{t.reset}</span>
            </button>

            {/* UDVASH in Red at Top Right */}
            <div className="px-3 py-1 rounded-xl bg-red-50 border-2 border-red-600 shadow-sm flex items-center justify-center">
              <span className="text-red-600 font-black tracking-widest text-sm sm:text-base font-sans select-none">
                UDVASH
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
