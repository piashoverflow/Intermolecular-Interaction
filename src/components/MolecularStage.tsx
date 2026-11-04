/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Compass } from 'lucide-react';
import { SimulationParams, StateMetrics, DisplayOptions } from '../types/physics';
import {
  getEquilibriumDistance,
  calculateForces,
  stepAtomDynamics,
} from '../physics/lennardJones';
import { soundEngine } from '../utils/audio';
import { Language, translations } from '../i18n/translations';

interface MolecularStageProps {
  r: number;
  onDistanceChange: (newR: number) => void;
  params: SimulationParams;
  metrics: StateMetrics;
  displayOptions: DisplayOptions;
  onToggleDisplay: (key: keyof DisplayOptions) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  lang: Language;
}

export const MolecularStage: React.FC<MolecularStageProps> = ({
  r,
  onDistanceChange,
  params,
  metrics,
  displayOptions,
  isPlaying,
  onTogglePlay,
  lang,
}) => {
  const t = translations[lang];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const velocityRef = useRef<number>(0);
  const currentRRef = useRef<number>(r);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    currentRRef.current = r;
  }, [r]);

  // Main 60 FPS Render & Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.033);
      lastTime = time;

      // Dynamics integration step
      if (isPlaying && !isDragging) {
        const prevR = currentRRef.current;
        const r0 = getEquilibriumDistance(params.sigma);
        const res = stepAtomDynamics(currentRRef.current, velocityRef.current, params, dt, isDragging);
        currentRRef.current = res.newR;
        velocityRef.current = res.newV;

        // Sound triggers
        if ((prevR - r0) * (res.newR - r0) <= 0) {
          soundEngine.playEquilibriumChime();
        }
        if (res.newR < 0.85 * params.sigma && Math.abs(res.newV) > 0.3) {
          soundEngine.playRepulsiveWallClash(Math.abs(res.newV));
        }

        onDistanceChange(res.newR);
      }

      const width = canvas.width;
      const height = canvas.height;

      // Fill canvas background
      ctx.fillStyle = '#f8fbff';
      ctx.fillRect(0, 0, width, height);

      if (displayOptions.showDistanceGrid) {
        drawLaboratoryGrid(ctx, width, height);
      }

      drawTwoAtomStage(
        ctx,
        width,
        height,
        currentRRef.current,
        params,
        displayOptions,
        isDragging,
        t,
        lang,
        time
      );

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, isDragging, params, displayOptions, onDistanceChange, t, lang]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    const container = containerRef.current;
    let observer: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        resizeCanvas();
      });
      observer.observe(container);
    }
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (observer) observer.disconnect();
    };
  }, [resizeCanvas]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const width = rect.width;
    const height = rect.height;

    const atomAX = Math.max(90, width * 0.15);
    const atomRadius = Math.min(42, Math.max(34, height * 0.085));
    const availableWidth = width - atomAX - atomRadius - 50;
    const scale = availableWidth / (2.65 * params.sigma);
    const atomBX = atomAX + currentRRef.current * scale;
    const centerY = height * 0.48;

    const distToB = Math.hypot(clientX - atomBX, clientY - centerY);
    if (distToB <= atomRadius + 32) {
      setIsDragging(true);
      velocityRef.current = 0;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const width = rect.width;

    const atomAX = Math.max(90, width * 0.15);
    const atomRadius = Math.min(42, Math.max(34, rect.height * 0.085));
    const availableWidth = width - atomAX - atomRadius - 50;
    const scale = availableWidth / (2.65 * params.sigma);

    const rawR = (clientX - atomAX) / scale;
    const clampedR = Math.max(0.65 * params.sigma, Math.min(rawR, 2.75 * params.sigma));

    currentRRef.current = clampedR;
    velocityRef.current = 0;
    onDistanceChange(clampedR);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Safe ignore
      }
      if (!isPlaying) {
        onTogglePlay();
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[460px] bg-gradient-to-b from-[#f8fbff] to-[#eaf4ff] rounded-2xl border border-sky-200/90 shadow-[0_4px_24px_rgba(186,230,253,0.35)] overflow-hidden select-none flex flex-col"
    >
      {/* Canvas Top Bar Overlay */}
      <div className="absolute top-3.5 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/95 border border-sky-200/90 text-xs font-bold text-sky-950 backdrop-blur-md shadow-xs font-sans">
            <Compass className="w-4 h-4 text-sky-600" />
            <span>{t.stageTitle}</span>
          </div>
        </div>

        {/* Play/Oscillate Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer font-sans ${
              isPlaying
                ? 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
                : 'bg-sky-600 hover:bg-sky-500 text-white border border-sky-700 shadow-sky-600/25'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current text-amber-600" />
                <span>{t.pauseMotion}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current text-white" />
                <span>{t.startOscillation}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Primary HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`w-full h-full block ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} touch-none`}
        tabIndex={0}
        aria-label="Interactive Molecular Canvas"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            const nextR = Math.min(2.75 * params.sigma, currentRRef.current + 0.05);
            currentRRef.current = nextR;
            onDistanceChange(nextR);
          } else if (e.key === 'ArrowLeft') {
            const nextR = Math.max(0.65 * params.sigma, currentRRef.current - 0.05);
            currentRRef.current = nextR;
            onDistanceChange(nextR);
          }
        }}
      />

      {/* Floating Canvas Legend & Helper Overlay */}
      <div className="absolute bottom-3.5 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-2.5 pointer-events-none">
        <div className="flex items-center gap-3.5 text-xs font-mono text-slate-700 bg-white/95 border border-sky-200/90 px-3.5 py-1.5 rounded-xl backdrop-blur-md shadow-xs pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 bg-rose-500 inline-block rounded"></span>
            <span className="text-slate-700 font-sans">{t.vectorRep} (∝ 1/r¹³)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 bg-emerald-600 inline-block rounded"></span>
            <span className="text-slate-700 font-sans">{t.vectorAtt} (∝ 1/r⁷)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 bg-sky-600 inline-block rounded"></span>
            <span className="text-sky-950 font-bold font-sans">{t.vectorNet}</span>
          </div>
        </div>

        {/* Distance Readout Pill */}
        <div className="flex items-center gap-2 text-xs font-mono bg-white/95 border border-sky-200/90 px-3.5 py-1.5 rounded-xl backdrop-blur-md shadow-xs pointer-events-auto font-sans">
          <span className="text-slate-500">{t.distanceLabel}:</span>
          <strong className="text-slate-900 font-bold font-mono">{r.toFixed(3)} Å</strong>
          <span className="text-slate-400 font-mono">({(r / 10).toFixed(4)} nm)</span>
          <span className="text-sky-700 font-bold font-mono">r/r₀ = {metrics.rRatio.toFixed(3)}</span>
        </div>
      </div>
    </div>
  );
};

// --------------------------------------------------------------------------
// Canvas Drawing Helper Functions
// --------------------------------------------------------------------------

function drawLaboratoryGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
  ctx.lineWidth = 1;

  const gridSize = 24;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTwoAtomStage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  r: number,
  params: SimulationParams,
  displayOptions: DisplayOptions,
  isDragging: boolean,
  t: typeof translations['bn'],
  lang: Language,
  time: number
) {
  const { sigma, epsilon, temperature } = params;
  const r0 = getEquilibriumDistance(sigma);

  const atomAX = Math.max(90, width * 0.15);
  const atomRadius = Math.min(42, Math.max(34, height * 0.085));
  const availableWidth = width - atomAX - atomRadius - 50;
  const scale = availableWidth / (2.65 * sigma);
  const atomBX = atomAX + r * scale;
  const r0X = atomAX + r0 * scale;
  const centerY = height * 0.48;

  // Real-time Thermal Jitter based on Temperature (calm & subtle at default, scales smoothly with temperature)
  const thermalAmp = Math.pow(Math.max(0, temperature) / 250, 1.3) * 1.6;
  const jitterX = !isDragging && thermalAmp > 0.05 ? (Math.sin(time * 0.038) * 0.65 + Math.sin(time * 0.083) * 0.35) * thermalAmp : 0;
  const jitterY = !isDragging && thermalAmp > 0.05 ? (Math.cos(time * 0.031) * 0.65 + Math.cos(time * 0.067) * 0.35) * (thermalAmp * 0.6) : 0;

  const currentAtomAX = atomAX + jitterX * 0.15;
  const currentAtomAY = centerY + jitterY * 0.15;
  const currentAtomBX = atomBX + jitterX;
  const currentAtomBY = centerY + jitterY;

  // 0. Live Thermal State HUD inside Canvas
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.strokeStyle = '#bae6fd';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(16, 16, 230, 30, 8);
  ctx.fill();
  ctx.stroke();

  const isSolid = temperature < 150;
  const isLiquid = temperature >= 150 && temperature < 400;
  const stateColor = isSolid ? '#0284c7' : isLiquid ? '#059669' : '#dc2626';
  ctx.fillStyle = stateColor;
  ctx.beginPath();
  ctx.arc(28, 31, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 10.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  const stateName = isSolid ? t.solidState : isLiquid ? t.liquidState : t.gasState;
  ctx.fillText(`T = ${temperature.toFixed(0)} K · ${stateName}`, 38, 35);
  ctx.restore();

  // 1. Equilibrium Reference Guide (r = r0)
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = 'rgba(5, 150, 105, 0.75)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(r0X, 45);
  ctx.lineTo(r0X, height - 52);
  ctx.stroke();

  // Equilibrium Marker Tag
  ctx.setLineDash([]);
  ctx.fillStyle = '#047857';
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`r₀ = ${r0.toFixed(2)} Å`, r0X, height - 36);
  ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(t.equilibriumMark, r0X, height - 22);
  ctx.restore();

  // 2. Valence Electron Cloud Aura
  const isOverlapping = r < sigma * 0.95;

  drawElectronCloud(
    ctx,
    currentAtomAX,
    currentAtomAY,
    atomRadius * 1.55,
    isOverlapping ? 'rgba(239, 68, 68, 0.24)' : isSolid ? 'rgba(56, 189, 248, 0.2)' : isLiquid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.22)'
  );
  drawElectronCloud(
    ctx,
    currentAtomBX,
    currentAtomBY,
    atomRadius * 1.55,
    isOverlapping ? 'rgba(239, 68, 68, 0.24)' : isSolid ? 'rgba(56, 189, 248, 0.2)' : isLiquid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.22)'
  );

  // Overlap warning
  if (isOverlapping) {
    ctx.save();
    const midX = (currentAtomAX + currentAtomBX) / 2;
    const grad = ctx.createRadialGradient(midX, centerY, 5, midX, centerY, 70);
    grad.addColorStop(0, 'rgba(244, 63, 94, 0.38)');
    grad.addColorStop(1, 'rgba(244, 63, 94, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(midX, centerY, 70, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#b91c1c';
    ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.pauliOverlap, midX, centerY - atomRadius - 28);
    ctx.restore();
  }

  // 3. Dynamic Interatomic Spring
  if (displayOptions.showSpring) {
    drawInteratomicSpring(ctx, currentAtomAX + atomRadius, currentAtomBX - atomRadius, (currentAtomAY + currentAtomBY) / 2, r, r0, t);
  }

  // 4. Distance Ruler & Measuring Bracket
  drawDistanceMeasurement(ctx, currentAtomAX, currentAtomBX, centerY + atomRadius + 28, r);

  // 5. Draw Atom A (Fixed Anchor with subtle thermal vibration)
  const glowColorA = isSolid ? 'rgba(56, 189, 248, 0.35)' : isLiquid ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.45)';
  const glowColorB = isDragging ? 'rgba(14, 165, 233, 0.65)' : glowColorA;

  drawSphericalAtom(ctx, currentAtomAX, currentAtomAY, atomRadius, {
    label: lang === 'bn' ? 'ক' : 'A',
    subLabel: t.fixedAtom,
    baseColor: '#0284c7',
    highlightColor: '#bae6fd',
    glowColor: glowColorA,
  });
  drawPinnedStand(ctx, atomAX, centerY, atomRadius);

  // 6. Draw Atom B (Movable with real-time thermal oscillation)
  drawSphericalAtom(ctx, currentAtomBX, currentAtomBY, atomRadius, {
    label: lang === 'bn' ? 'খ' : 'B',
    subLabel: isDragging ? t.atomDragging : t.movingAtom,
    baseColor: '#0ea5e9',
    highlightColor: '#e0f2fe',
    glowColor: glowColorB,
  });

  // Drag interaction ring around Atom B
  ctx.save();
  ctx.strokeStyle = isDragging ? '#0284c7' : 'rgba(2, 132, 199, 0.55)';
  ctx.lineWidth = isDragging ? 2.5 : 1.5;
  ctx.setLineDash(isDragging ? [] : [4, 4]);
  ctx.beginPath();
  ctx.arc(currentAtomBX, currentAtomBY, atomRadius + 10, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#0369a1';
  ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isDragging ? t.releaseHint : t.dragHint, currentAtomBX, currentAtomBY - atomRadius - 14);
  ctx.restore();

  // 7. Force Vectors
  if (displayOptions.showVectors) {
    const { repulsive, attractive, net } = calculateForces(r, epsilon, sigma);
    drawForceVectors(ctx, currentAtomBX, currentAtomBY, repulsive, attractive, net, t);
  }
}

function drawSphericalAtom(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  options: {
    label: string;
    subLabel: string;
    baseColor: string;
    highlightColor: string;
    glowColor: string;
  }
) {
  ctx.save();

  const glowGrad = ctx.createRadialGradient(x, y, radius * 0.8, x, y, radius * 1.55);
  glowGrad.addColorStop(0, options.glowColor);
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.55, 0, Math.PI * 2);
  ctx.fill();

  const sphereGrad = ctx.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.35,
    radius * 0.1,
    x,
    y,
    radius
  );
  sphereGrad.addColorStop(0, '#ffffff');
  sphereGrad.addColorStop(0.25, options.highlightColor);
  sphereGrad.addColorStop(0.7, options.baseColor);
  sphereGrad.addColorStop(1, '#034575');

  ctx.fillStyle = sphereGrad;
  ctx.shadowColor = 'rgba(2, 132, 199, 0.28)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 4;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(options.label, x, y - 2);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.font = 'bold 9.5px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(options.subLabel, x, y + 16);

  ctx.restore();
}

function drawElectronCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string
) {
  ctx.save();
  const grad = ctx.createRadialGradient(x, y, radius * 0.4, x, y, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPinnedStand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number
) {
  ctx.save();
  const standY = y + radius + 12;

  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y + radius);
  ctx.lineTo(x, standY + 22);
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(x - 26, standY + 22, 52, 6);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  for (let i = -22; i <= 22; i += 8) {
    ctx.beginPath();
    ctx.moveTo(x + i, standY + 28);
    ctx.lineTo(x + i - 6, standY + 36);
    ctx.stroke();
  }
  ctx.restore();
}

function drawInteratomicSpring(
  ctx: CanvasRenderingContext2D,
  startX: number,
  endX: number,
  y: number,
  r: number,
  r0: number,
  t: typeof translations['bn']
) {
  const length = endX - startX;
  if (length <= 4) return;

  ctx.save();
  const coils = 14;
  const isCompressed = r < r0 * 0.97;
  const isStretched = r > r0 * 1.03;

  let springColor = '#d97706';
  if (isCompressed) {
    springColor = '#dc2626';
  } else if (isStretched) {
    springColor = '#0284c7';
  }

  const amplitude = Math.max(7, Math.min(18, 16 * (r0 / Math.max(0.01, r))));

  ctx.strokeStyle = springColor;
  ctx.lineWidth = isCompressed ? 3.5 : 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(startX, y);

  const lead = 10;
  ctx.lineTo(startX + lead, y);

  const activeLength = length - 2 * lead;
  const step = activeLength / (coils * 2);

  for (let i = 0; i < coils * 2; i++) {
    const cx = startX + lead + (i + 0.5) * step;
    const cy = y + (i % 2 === 0 ? -1 : 1) * amplitude;
    ctx.lineTo(cx, cy);
  }

  ctx.lineTo(endX - lead, y);
  ctx.lineTo(endX, y);
  ctx.stroke();

  ctx.fillStyle = springColor;
  ctx.font = 'bold 10.5px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  const tensionLabel = isCompressed ? t.springCompression : isStretched ? t.springTension : t.springRelaxed;
  ctx.fillText(tensionLabel, (startX + endX) / 2, y - amplitude - 8);

  ctx.restore();
}

function drawDistanceMeasurement(
  ctx: CanvasRenderingContext2D,
  startX: number,
  endX: number,
  y: number,
  r: number
) {
  ctx.save();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.3;

  ctx.beginPath();
  ctx.moveTo(startX, y - 6);
  ctx.lineTo(startX, y + 6);
  ctx.moveTo(startX, y);
  ctx.lineTo(endX, y);
  ctx.moveTo(endX, y - 6);
  ctx.lineTo(endX, y + 6);
  ctx.stroke();

  const midX = (startX + endX) / 2;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`r = ${r.toFixed(3)} Å`, midX, y + 16);
  ctx.restore();
}

function drawForceVectors(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  repulsive: number,
  attractive: number,
  net: number,
  t: typeof translations['bn']
) {
  const scale = 22;
  const maxArrow = 160;

  const repLen = Math.min(maxArrow, repulsive * scale);
  if (repLen > 3) {
    drawArrow(ctx, bx, by - 24, bx + repLen, by - 24, '#e11d48', `${t.vectorRep} = +${repulsive.toFixed(2)} eV/Å`);
  }

  const attLen = Math.min(maxArrow, attractive * scale);
  if (attLen > 3) {
    drawArrow(ctx, bx, by + 24, bx - attLen, by + 24, '#059669', `${t.vectorAtt} = -${attractive.toFixed(2)} eV/Å`);
  }

  const netLen = Math.max(-maxArrow, Math.min(maxArrow, net * scale));
  if (Math.abs(netLen) > 3) {
    const isRep = net > 0;
    const netColor = isRep ? '#d97706' : '#0284c7';
    drawArrow(
      ctx,
      bx,
      by,
      bx + netLen,
      by,
      netColor,
      `${t.vectorNet} = ${net >= 0 ? '+' : ''}${net.toFixed(2)} eV/Å`,
      true
    );
  } else {
    ctx.save();
    ctx.fillStyle = '#059669';
    ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.balancedForce, bx, by - 38);
    ctx.restore();
  }
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
  label: string,
  isProminent = false
) {
  const headLength = isProminent ? 12 : 9;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = isProminent ? 3 : 2;

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  ctx.font = isProminent ? 'bold 11px "JetBrains Mono", monospace' : 'bold 10px "JetBrains Mono", monospace';
  ctx.textAlign = toX >= fromX ? 'left' : 'right';
  ctx.textBaseline = 'middle';
  const labelOffset = toX >= fromX ? 10 : -10;
  ctx.fillText(label, toX + labelOffset, toY);

  ctx.restore();
}
