/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Activity } from 'lucide-react';
import { SimulationParams, StateMetrics, DisplayOptions } from '../types/physics';
import { Language, translations } from '../i18n/translations';
import {
  getEquilibriumDistance,
  getMaxAttractionDistance,
  generateGraphData,
  calculateForces,
  calculatePotential,
  getEffectiveSpringConstant,
} from '../physics/lennardJones';

interface GraphPanelProps {
  r: number;
  onDistanceChange: (newR: number) => void;
  params: SimulationParams;
  metrics: StateMetrics;
  displayOptions: DisplayOptions;
  lang: Language;
}

export const GraphPanel: React.FC<GraphPanelProps> = ({
  r,
  onDistanceChange,
  params,
  metrics,
  displayOptions,
  lang,
}) => {
  const t = translations[lang];
  const forceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const potentialCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = useState<'both' | 'potential' | 'force'>('both');
  const [hoverR, setHoverR] = useState<number | null>(null);

  const r0 = getEquilibriumDistance(params.sigma);
  const rMaxAtt = getMaxAttractionDistance(params.sigma);
  const kEff = getEffectiveSpringConstant(params.epsilon, params.sigma);

  const resizeCanvases = useCallback(() => {
    const dpr = window.devicePixelRatio || 1;
    const forceCanvas = forceCanvasRef.current;
    const potCanvas = potentialCanvasRef.current;

    [forceCanvas, potCanvas].forEach((canvas) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    });
  }, []);

  useEffect(() => {
    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);
    const container = containerRef.current;
    let observer: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        resizeCanvases();
      });
      observer.observe(container);
    }
    return () => {
      window.removeEventListener('resize', resizeCanvases);
      if (observer) observer.disconnect();
    };
  }, [resizeCanvases, activeTab]);

  useEffect(() => {
    const forceCanvas = forceCanvasRef.current;
    const potCanvas = potentialCanvasRef.current;

    const rMin = 0.82 * params.sigma;
    const rMax = 2.65 * params.sigma;
    const graphData = generateGraphData(params.epsilon, params.sigma, rMin, rMax, 220);

    // 1. Render Force vs Distance Graph
    if (forceCanvas && (activeTab === 'both' || activeTab === 'force')) {
      const ctx = forceCanvas.getContext('2d');
      if (ctx) {
        const rect = forceCanvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        drawForceGraph(
          ctx,
          rect.width,
          rect.height,
          graphData,
          r,
          r0,
          rMaxAtt,
          rMin,
          rMax,
          params,
          displayOptions,
          hoverR,
          t
        );
      }
    }

    // 2. Render Potential Energy vs Distance Graph
    if (potCanvas && (activeTab === 'both' || activeTab === 'potential')) {
      const ctx = potCanvas.getContext('2d');
      if (ctx) {
        const rect = potCanvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        drawPotentialGraph(
          ctx,
          rect.width,
          rect.height,
          graphData,
          r,
          r0,
          rMin,
          rMax,
          params,
          displayOptions,
          hoverR,
          t
        );
      }
    }
  }, [r, params, displayOptions, hoverR, activeTab, t]);

  const handleGraphPointer = (e: React.PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const paddingLeft = 52;
    const paddingRight = 20;
    const plotWidth = rect.width - paddingLeft - paddingRight;

    const rMin = 0.82 * params.sigma;
    const rMax = 2.65 * params.sigma;

    const normalizedX = Math.max(0, Math.min(1, (x - paddingLeft) / plotWidth));
    const targetR = rMin + normalizedX * (rMax - rMin);

    setHoverR(targetR);
    if (e.buttons === 1) {
      onDistanceChange(targetR);
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-white/95 rounded-2xl border border-sky-200/90 shadow-[0_4px_24px_rgba(186,230,253,0.35)] p-4 sm:p-5 backdrop-blur-md"
    >
      {/* Header with Segmented View Controls */}
      <div className="flex items-center justify-between pb-3 border-b border-sky-100 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700">
            <Activity className="w-4 h-4" />
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-sky-950 uppercase tracking-wider font-sans">
            {t.graphTitle}
          </h2>
        </div>

        {/* Segmented Tab Controls */}
        <div className="flex items-center gap-1 p-0.5 bg-sky-50 rounded-xl border border-sky-200 font-sans">
          <button
            onClick={() => setActiveTab('both')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'both'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.tabBoth}
          </button>
          <button
            onClick={() => setActiveTab('force')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'force'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.tabForce}
          </button>
          <button
            onClick={() => setActiveTab('potential')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'potential'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.tabPotential}
          </button>
        </div>
      </div>

      {/* Main Graphs Area */}
      <div className="flex-1 flex flex-col gap-3.5 pt-3.5 min-h-[380px]">
        {/* Graph 1: Force vs Distance */}
        {(activeTab === 'both' || activeTab === 'force') && (
          <div className="flex-1 relative flex flex-col min-h-[190px] bg-[#f8fbff] rounded-xl border border-sky-200/80 p-2.5 shadow-xs">
            <div className="flex items-center justify-between text-[11px] font-mono px-1 pb-1">
              <span className="text-slate-900 font-bold flex items-center gap-1.5 font-sans">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
                {t.forceVsDistance}
              </span>
              <span className="text-sky-800 font-bold text-[10px] bg-sky-100/80 px-2 py-0.5 rounded font-sans">
                {t.equilibriumZero}
              </span>
            </div>
            <canvas
              ref={forceCanvasRef}
              className="flex-1 w-full h-full block cursor-crosshair touch-none"
              onPointerDown={(e) => handleGraphPointer(e, forceCanvasRef.current)}
              onPointerMove={(e) => handleGraphPointer(e, forceCanvasRef.current)}
              onPointerLeave={() => setHoverR(null)}
            />
          </div>
        )}

        {/* Graph 2: Potential Energy vs Distance */}
        {(activeTab === 'both' || activeTab === 'potential') && (
          <div className="flex-1 relative flex flex-col min-h-[190px] bg-[#f8fbff] rounded-xl border border-sky-200/80 p-2.5 shadow-xs">
            <div className="flex items-center justify-between text-[11px] font-mono px-1 pb-1">
              <span className="text-slate-900 font-bold flex items-center gap-1.5 font-sans">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                {t.potentialVsDistance}
              </span>
              <span className="text-emerald-800 font-bold text-[10px] bg-emerald-100/80 px-2 py-0.5 rounded font-sans">
                {t.deepestWell}
              </span>
            </div>
            <canvas
              ref={potentialCanvasRef}
              className="flex-1 w-full h-full block cursor-crosshair touch-none"
              onPointerDown={(e) => handleGraphPointer(e, potentialCanvasRef.current)}
              onPointerMove={(e) => handleGraphPointer(e, potentialCanvasRef.current)}
              onPointerLeave={() => setHoverR(null)}
            />
          </div>
        )}
      </div>

      {/* Physics Notation Micro-Banner */}
      <div className="mt-3 pt-2.5 border-t border-sky-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <span>F = -dU/dr</span>
        <span aria-hidden="true" className="text-sky-300">·</span>
        <span>r₀ = 2¹ᐟ⁶σ ≈ {(params.sigma * 1.12246).toFixed(2)} Å</span>
        <span aria-hidden="true" className="text-sky-300">·</span>
        <span className="text-sky-800 font-bold">U_min = -{params.epsilon.toFixed(2)} eV</span>
      </div>
    </div>
  );
};

// --------------------------------------------------------------------------
// Graph Drawing Algorithms
// --------------------------------------------------------------------------

function drawForceGraph(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: ReturnType<typeof generateGraphData>,
  currentR: number,
  r0: number,
  rMaxAtt: number,
  rMin: number,
  rMax: number,
  params: SimulationParams,
  displayOptions: DisplayOptions,
  hoverR: number | null,
  t: typeof translations['bn']
) {
  const padding = { top: 16, right: 18, bottom: 28, left: 48 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const fMin = -7 * (params.epsilon / params.sigma);
  const fMax = 10 * (params.epsilon / params.sigma);

  const getX = (valR: number) => padding.left + ((valR - rMin) / (rMax - rMin)) * plotWidth;
  const getY = (valF: number) => padding.top + plotHeight - ((valF - fMin) / (fMax - fMin)) * plotHeight;

  ctx.fillStyle = '#f8fbff';
  ctx.fillRect(0, 0, width, height);

  // 1. Shaded Zones
  const zeroY = getY(0);
  ctx.save();
  ctx.fillStyle = 'rgba(244, 63, 94, 0.06)';
  ctx.fillRect(padding.left, padding.top, plotWidth, zeroY - padding.top);

  ctx.fillStyle = 'rgba(14, 165, 233, 0.06)';
  ctx.fillRect(padding.left, zeroY, plotWidth, padding.top + plotHeight - zeroY);
  ctx.restore();

  // 2. Grid & Axis
  ctx.save();
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.6)';
  ctx.lineWidth = 1;

  for (let rVal = Math.ceil(rMin); rVal <= rMax; rVal += 0.5) {
    const gx = getX(rVal);
    ctx.beginPath();
    ctx.moveTo(gx, padding.top);
    ctx.lineTo(gx, padding.top + plotHeight);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${rVal.toFixed(1)}`, gx, padding.top + plotHeight + 14);
  }

  // Zero Force Horizontal Axis
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(padding.left, zeroY);
  ctx.lineTo(padding.left + plotWidth, zeroY);
  ctx.stroke();

  // Axis Labels
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText('0', padding.left - 6, zeroY + 3);
  ctx.fillText(`+${fMax.toFixed(0)}`, padding.left - 6, padding.top + 8);
  ctx.fillText(`${fMin.toFixed(0)}`, padding.left - 6, padding.top + plotHeight);

  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 9.5px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(t.repulsionZone, padding.left + 6, padding.top + 12);

  ctx.fillStyle = '#0284c7';
  ctx.fillText(t.attractionZone, padding.left + 6, padding.top + plotHeight - 6);

  // Equilibrium Line (r = r0)
  const r0X = getX(r0);
  ctx.strokeStyle = '#059669';
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(r0X, padding.top);
  ctx.lineTo(r0X, padding.top + plotHeight);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#059669';
  ctx.font = 'bold 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('r₀', r0X, padding.top + plotHeight + 14);
  ctx.restore();

  // 3. Decomposed Force Components
  if (displayOptions.showComponentCurves) {
    ctx.save();
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    data.forEach((p, idx) => {
      const px = getX(p.r);
      const py = getY(p.F_rep);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    ctx.strokeStyle = '#059669';
    ctx.beginPath();
    data.forEach((p, idx) => {
      const px = getX(p.r);
      const py = getY(p.F_att);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();
  }

  // 4. Hooke's Law Tangent Line near r0
  if (displayOptions.showHookeTangent) {
    ctx.save();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    let started = false;
    data.forEach((p) => {
      if (Math.abs(p.r - r0) < 0.35 * params.sigma) {
        const px = getX(p.r);
        const py = getY(p.hookeForce);
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
    });
    ctx.stroke();
    ctx.restore();
  }

  // 5. Net Force Main Curve
  ctx.save();
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  data.forEach((p, idx) => {
    const px = getX(p.r);
    const py = getY(p.F);
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.restore();

  // 6. Max Attraction Point Marker
  const maxAttX = getX(rMaxAtt);
  const maxAttY = getY(calculateForces(rMaxAtt, params.epsilon, params.sigma).net);
  ctx.save();
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.arc(maxAttX, maxAttY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0369a1';
  ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(t.maxAttractionMarker, maxAttX + 6, maxAttY + 10);
  ctx.restore();

  // 7. Live Dynamic Indicator Dot
  const currentForces = calculateForces(currentR, params.epsilon, params.sigma);
  const curX = getX(currentR);
  const curY = getY(currentForces.net);

  if (curX >= padding.left && curX <= padding.left + plotWidth) {
    ctx.save();
    ctx.strokeStyle = 'rgba(2, 132, 199, 0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(curX, padding.top);
    ctx.lineTo(curX, padding.top + plotHeight);
    ctx.moveTo(padding.left, curY);
    ctx.lineTo(padding.left + plotWidth, curY);
    ctx.stroke();

    ctx.fillStyle = '#0284c7';
    ctx.shadowColor = 'rgba(2, 132, 199, 0.4)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(curX, curY, 5.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = curX > width - 110 ? 'right' : 'left';
    ctx.fillText(
      `F = ${currentForces.net >= 0 ? '+' : ''}${currentForces.net.toFixed(2)} eV/Å`,
      curX > width - 110 ? curX - 8 : curX + 8,
      curY - 8
    );
    ctx.restore();
  }
}

function drawPotentialGraph(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: ReturnType<typeof generateGraphData>,
  currentR: number,
  r0: number,
  rMin: number,
  rMax: number,
  params: SimulationParams,
  displayOptions: DisplayOptions,
  hoverR: number | null,
  t: typeof translations['bn']
) {
  const padding = { top: 16, right: 18, bottom: 28, left: 48 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const uMin = -1.5 * params.epsilon;
  const uMax = 4.0 * params.epsilon;

  const getX = (valR: number) => padding.left + ((valR - rMin) / (rMax - rMin)) * plotWidth;
  const getY = (valU: number) => padding.top + plotHeight - ((valU - uMin) / (uMax - uMin)) * plotHeight;

  ctx.fillStyle = '#f8fbff';
  ctx.fillRect(0, 0, width, height);

  // 1. Shaded Potential Well Fill below U = 0
  const zeroY = getY(0);
  if (displayOptions.showPotentialFill) {
    ctx.save();
    ctx.beginPath();
    let started = false;
    data.forEach((p) => {
      if (p.U <= 0) {
        const px = getX(p.r);
        const py = getY(p.U);
        if (!started) {
          ctx.moveTo(px, zeroY);
          ctx.lineTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
    });
    ctx.lineTo(getX(rMax), zeroY);
    ctx.closePath();

    const fillGrad = ctx.createLinearGradient(0, zeroY, 0, getY(-params.epsilon));
    fillGrad.addColorStop(0, 'rgba(14, 165, 233, 0.05)');
    fillGrad.addColorStop(1, 'rgba(14, 165, 233, 0.25)');
    ctx.fillStyle = fillGrad;
    ctx.fill();
    ctx.restore();
  }

  // 2. Grid & Axis
  ctx.save();
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.6)';
  ctx.lineWidth = 1;

  for (let rVal = Math.ceil(rMin); rVal <= rMax; rVal += 0.5) {
    const gx = getX(rVal);
    ctx.beginPath();
    ctx.moveTo(gx, padding.top);
    ctx.lineTo(gx, padding.top + plotHeight);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${rVal.toFixed(1)}`, gx, padding.top + plotHeight + 14);
  }

  // Zero Potential Axis U = 0
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(padding.left, zeroY);
  ctx.lineTo(padding.left + plotWidth, zeroY);
  ctx.stroke();

  // Axis Labels
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText('0', padding.left - 6, zeroY + 3);
  ctx.fillText(`-${params.epsilon.toFixed(1)}`, padding.left - 6, getY(-params.epsilon) + 3);
  ctx.fillText(`+${uMax.toFixed(0)}`, padding.left - 6, padding.top + 8);

  // Minimum Potential Line
  const minEnergyY = getY(-params.epsilon);
  ctx.strokeStyle = 'rgba(5, 150, 105, 0.6)';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(padding.left, minEnergyY);
  ctx.lineTo(padding.left + plotWidth, minEnergyY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Equilibrium Line r0
  const r0X = getX(r0);
  ctx.strokeStyle = '#059669';
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(r0X, padding.top);
  ctx.lineTo(r0X, padding.top + plotHeight);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#059669';
  ctx.font = 'bold 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('r₀', r0X, padding.top + plotHeight + 14);

  // Sigma marker where U(sigma) = 0
  const sigmaX = getX(params.sigma);
  ctx.fillStyle = '#0284c7';
  ctx.font = 'bold 9.5px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('σ', sigmaX, zeroY - 6);
  ctx.beginPath();
  ctx.arc(sigmaX, zeroY, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 3. Hooke's Parabolic Potential Approximation
  if (displayOptions.showHookeTangent) {
    ctx.save();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    let started = false;
    data.forEach((p) => {
      if (Math.abs(p.r - r0) < 0.35 * params.sigma) {
        const px = getX(p.r);
        const py = getY(p.hookePotential);
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
    });
    ctx.stroke();
    ctx.restore();
  }

  // 4. Main Potential Curve U(r)
  ctx.save();
  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  data.forEach((p, idx) => {
    const px = getX(p.r);
    const py = getY(p.U);
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  // Deepest Well dot at (r0, -epsilon)
  ctx.fillStyle = '#059669';
  ctx.beginPath();
  ctx.arc(r0X, minEnergyY, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#047857';
  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.fillText(`U_min = -${params.epsilon} eV`, r0X + 8, minEnergyY + 12);
  ctx.restore();

  // 5. Live Dynamic Tracker Dot
  const curU = calculatePotential(currentR, params.epsilon, params.sigma);
  const curX = getX(currentR);
  const curY = getY(curU);

  if (curX >= padding.left && curX <= padding.left + plotWidth) {
    ctx.save();
    ctx.strokeStyle = 'rgba(5, 150, 105, 0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(curX, padding.top);
    ctx.lineTo(curX, padding.top + plotHeight);
    ctx.moveTo(padding.left, curY);
    ctx.lineTo(padding.left + plotWidth, curY);
    ctx.stroke();

    ctx.fillStyle = '#059669';
    ctx.shadowColor = 'rgba(5, 150, 105, 0.4)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(curX, curY, 5.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = curX > width - 110 ? 'right' : 'left';
    ctx.fillText(
      `U = ${curU.toFixed(3)} eV`,
      curX > width - 110 ? curX - 8 : curX + 8,
      curY - 8
    );
    ctx.restore();
  }
}
