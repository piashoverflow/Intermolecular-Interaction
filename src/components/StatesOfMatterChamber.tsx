/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Snowflake, Droplets, Wind, Play, Pause, RotateCcw, Thermometer, Activity, Sparkles } from 'lucide-react';
import { Language, translations } from '../i18n/translations';

interface StatesOfMatterChamberProps {
  lang: Language;
  epsilon: number;
  sigma: number;
  temperature: number;
  onTemperatureChange: (newT: number) => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
}

export const StatesOfMatterChamber: React.FC<StatesOfMatterChamberProps> = ({
  lang,
  epsilon,
  sigma,
  temperature,
  onTemperatureChange,
}) => {
  const t = translations[lang];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [showBonds, setShowBonds] = useState<boolean>(true);
  const [showVelocities, setShowVelocities] = useState<boolean>(false);

  // Persistent particles array (84 atoms) - NEVER replaced to ensure smooth continuous physics
  const particlesRef = useRef<Particle[]>([]);
  const initializedRef = useRef<boolean>(false);
  const tempRef = useRef<number>(temperature);

  useEffect(() => {
    tempRef.current = temperature;
  }, [temperature]);

  // Determine current thermodynamic state from temperature
  const currentState: 'solid' | 'liquid' | 'gas' =
    temperature < 150 ? 'solid' : temperature < 400 ? 'liquid' : 'gas';

  // Initialize 84 particles into a dense, regular hexagonal close-packed lattice resting on the container floor
  const initParticlesOnce = useCallback((width: number, height: number, force = false) => {
    if (initializedRef.current && !force && particlesRef.current.length > 0) return;

    const particles: Particle[] = [];
    const rows = 7;
    const cols = 12; // 12 x 7 = 84 atoms for a dense, visually rich simulation
    const spacing = 19;
    const rowSpacing = spacing * 0.866; // 16.45 px

    const clusterWidth = (cols - 1) * spacing + spacing * 0.5;
    const startX = Math.max(35, (width - clusterWidth) / 2);

    // Floor of the chamber container
    const floorY = height - 28 - 7; // Bottom wall at height - 24, particle radius ~6.5px
    const startY = floorY - (rows - 1) * rowSpacing;

    let id = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * spacing + (r % 2 === 1 ? spacing * 0.5 : 0);
        const y = startY + r * rowSpacing;

        particles.push({
          id: id++,
          x,
          y,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          homeX: x,
          homeY: y,
        });
      }
    }

    particlesRef.current = particles;
    initializedRef.current = true;
  }, []);

  // Reset function to smoothly restore home positions
  const handleReset = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      initParticlesOnce(
        canvas.width / (window.devicePixelRatio || 1),
        canvas.height / (window.devicePixelRatio || 1),
        true
      );
    }
  }, [initParticlesOnce]);

  // Main 60 FPS Physics & Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.033);
      lastTime = time;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      if (!initializedRef.current || particlesRef.current.length === 0) {
        initParticlesOnce(width, height);
      }

      const particles = particlesRef.current;
      const currentT = tempRef.current;

      // Container bounding walls
      const particleRadius = 6.5;
      const minX = 22 + particleRadius;
      const maxX = width - 22 - particleRadius;
      const minY = 28 + particleRadius;
      const maxY = height - 24 - particleRadius; // Surface of the container floor

      // -------------------------------------------------------------
      // 1. Unified, Continuous Physical Dynamics for 84 Atoms
      // -------------------------------------------------------------
      if (isPlaying && particles.length > 0) {
        // Lattice anchoring strength: firm in solid (<150 K), drops to 0 smoothly as T passes 170 K
        const latticeFraction = Math.max(0, 1 - Math.pow(Math.min(currentT, 175) / 165, 2));
        const kLattice = 42 * latticeFraction;

        // Downward Gravity: In liquid, gravity is STRONG so all molecules settle directly on the floor surface!
        // At gas temperatures (>380 K), gravity smoothly drops to 0 so molecules fill the chamber volume.
        const gravityFraction = Math.max(0, 1 - Math.max(0, currentT - 320) / 160);
        const gravity = currentT < 150 ? 40 : 280 * gravityFraction; // Strong 280 px/s^2 pull for liquid puddle

        // Thermal agitation kicks (calibrated to be calm & stable in Solid, increasing smoothly in Liquid & Gas)
        const thermalAgitation = Math.pow(Math.max(1, currentT) / 200, 1.25) * 65 + Math.min(currentT * 0.12, 8);

        // Center of mass X (for horizontal cohesion of liquid puddle)
        let cmX = 0;
        particles.forEach((p) => {
          cmX += p.x;
        });
        cmX /= particles.length;

        // Update each particle
        particles.forEach((p, i) => {
          // A. Lattice restoring force (Active only in Solid state, pulls towards crystal block)
          let fx = -kLattice * (p.x - p.homeX);
          let fy = -kLattice * (p.y - p.homeY);

          // B. Gravity (Pulls liquid down directly onto container surface / floor!)
          fy += gravity;

          // C. Liquid Horizontal Surface Tension Cohesion (keeps puddle from dispersing horizontally, without pulling it into the air!)
          if (currentT >= 100 && currentT < 420) {
            const dxCm = cmX - p.x;
            if (Math.abs(dxCm) > 50) {
              const coh = Math.sign(dxCm) * 25 * Math.min(1, (Math.abs(dxCm) - 50) / 40);
              fx += coh;
            }
          }

          // D. Thermal Brownian kick (fluctuation)
          const angle = Math.random() * Math.PI * 2;
          const kickMag = (Math.random() * 0.8 + 0.2) * thermalAgitation;
          fx += Math.cos(angle) * kickMag;
          fy += Math.sin(angle) * kickMag;

          // E. Integration step with phase-tuned fluid damping
          // Solid is well-damped so the crystal stays serene; Liquid flows; Gas retains momentum
          const damping = currentT > 400 ? 0.994 : currentT > 150 ? 0.94 : 0.88;
          p.vx = (p.vx + fx * dt) * damping;
          p.vy = (p.vy + fy * dt) * damping;

          p.x += p.vx * dt;
          p.y += p.vy * dt;

          // F. Pairwise soft-core repulsion & short-range van der Waals cohesion
          const coreDist = 14.5; // Exclusion diameter for 6.5px radius
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p2.x - p.x;
            const dy = p2.y - p.y;
            const dist = Math.hypot(dx, dy);

            if (dist < coreDist && dist > 0.001) {
              const overlap = (coreDist - dist) * 0.5;
              const nx = dx / dist;
              const ny = dy / dist;

              p.x -= nx * overlap;
              p.y -= ny * overlap;
              p2.x += nx * overlap;
              p2.y += ny * overlap;

              // Elastic bounce impulse
              const impulse = (p.vx - p2.vx) * nx + (p.vy - p2.vy) * ny;
              if (impulse > 0) {
                p.vx -= impulse * nx * 0.7;
                p.vy -= impulse * ny * 0.7;
                p2.vx += impulse * nx * 0.7;
                p2.vy += impulse * ny * 0.7;
              }
            } else if (dist < 32 && dist >= coreDist && currentT >= 100 && currentT < 420) {
              // Liquid van der Waals cohesive attraction
              const attForce = 12 * Math.min(1, (32 - dist) / 17);
              const nx = dx / dist;
              const ny = dy / dist;
              p.vx += nx * attForce * dt;
              p.vy += ny * attForce * dt;
              p2.vx -= nx * attForce * dt;
              p2.vy -= ny * attForce * dt;
            }
          }

          // G. Container wall collisions and floor contact
          const restitution = currentT > 400 ? 0.96 : 0.45; // Low restitution on floor for liquid puddle settling

          if (p.x < minX) {
            p.x = minX;
            p.vx = Math.abs(p.vx) * restitution;
          } else if (p.x > maxX) {
            p.x = maxX;
            p.vx = -Math.abs(p.vx) * restitution;
          }

          if (p.y < minY) {
            p.y = minY;
            p.vy = Math.abs(p.vy) * restitution;
          } else if (p.y >= maxY) {
            p.y = maxY;
            p.vy = -Math.abs(p.vy) * restitution;
            // Floor friction for liquid spreading
            p.vx *= 0.95;
          }
        });
      }

      // -------------------------------------------------------------
      // 2. High-Fidelity Rendering (84 Atoms with 3D Gradients)
      // -------------------------------------------------------------
      ctx.clearRect(0, 0, width, height);

      // Background chamber gradient reflecting thermodynamic temperature
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      if (currentT < 150) {
        bgGrad.addColorStop(0, '#f0f9ff');
        bgGrad.addColorStop(1, '#e0f2fe');
      } else if (currentT < 400) {
        bgGrad.addColorStop(0, '#f8fbff');
        bgGrad.addColorStop(1, '#ecfdf5');
      } else {
        bgGrad.addColorStop(0, '#fff7ed');
        bgGrad.addColorStop(1, '#fee2e2');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle depth grid inside the container
      ctx.save();
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.4)';
      ctx.lineWidth = 1;
      for (let gy = 50; gy < height - 30; gy += 35) {
        ctx.beginPath();
        ctx.moveTo(22, gy);
        ctx.lineTo(width - 22, gy);
        ctx.stroke();
      }
      ctx.restore();

      // Liquid Level Line / Surface Guide (Visible when liquid puddles at the bottom)
      if (currentT >= 130 && currentT < 420) {
        ctx.save();
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(24, height - 72);
        ctx.lineTo(width - 24, height - 72);
        ctx.stroke();
        ctx.fillStyle = 'rgba(5, 150, 105, 0.65)';
        ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(lang === 'bn' ? 'তরল মুক্ত তল (Liquid Meniscus Surface)' : 'Liquid Free Surface', 32, height - 76);
        ctx.restore();
      }

      // Container Floor Base Plate & Walls
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      ctx.strokeRect(20, 26, width - 40, height - 50);

      // Solid bottom floor plate (Container bottom surface)
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(20, height - 26, width - 40, 6);

      // Heating / Cooling element visual along the bottom floor
      const bottomY = height - 20;
      ctx.save();
      if (currentT < 150) {
        // Cold Cryo-Plate (Cyan)
        ctx.fillStyle = 'rgba(56, 189, 248, 0.5)';
        ctx.fillRect(22, bottomY - 3, width - 44, 5);
      } else if (currentT < 400) {
        // Liquid Base Heat Plate (Emerald)
        ctx.fillStyle = 'rgba(16, 185, 129, 0.45)';
        ctx.fillRect(22, bottomY - 3, width - 44, 5);
      } else {
        // High Heat Burner (Amber / Red Glow)
        const flameGrad = ctx.createLinearGradient(0, bottomY - 6, 0, bottomY + 3);
        flameGrad.addColorStop(0, 'rgba(239, 68, 68, 0.7)');
        flameGrad.addColorStop(1, 'rgba(245, 158, 11, 0.25)');
        ctx.fillStyle = flameGrad;
        ctx.fillRect(22, bottomY - 5, width - 44, 8);
      }
      ctx.restore();

      // Intermolecular bonds (Solid crystal bonds & liquid transient bonds)
      if (showBonds && currentT < 340) {
        const bondAlpha = Math.max(0, 1 - currentT / 300);
        ctx.save();
        ctx.strokeStyle =
          currentT < 150
            ? `rgba(2, 132, 199, ${0.45 * bondAlpha})`
            : `rgba(5, 150, 105, ${0.28 * bondAlpha})`;
        ctx.lineWidth = currentT < 150 ? 1.4 : 1.0;

        const maxBondDist = currentT < 150 ? 25 : 23;
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
            if (dist < maxBondDist) {
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }
        ctx.restore();
      }

      // Draw all 84 Atoms
      particles.forEach((p) => {
        const radius = particleRadius;
        const grad = ctx.createRadialGradient(p.x - 1.8, p.y - 1.8, 0.8, p.x, p.y, radius);

        if (currentT < 150) {
          // Solid: Crisp crystalline ice-blue
          grad.addColorStop(0, '#f0f9ff');
          grad.addColorStop(0.35, '#38bdf8');
          grad.addColorStop(1, '#0284c7');
        } else if (currentT < 400) {
          // Liquid: Fluid cohesive emerald / teal puddle
          grad.addColorStop(0, '#ecfdf5');
          grad.addColorStop(0.35, '#34d399');
          grad.addColorStop(1, '#059669');
        } else {
          // Gas: High kinetic energy ruby / amber
          grad.addColorStop(0, '#fff1f2');
          grad.addColorStop(0.35, '#fb7185');
          grad.addColorStop(1, '#e11d48');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 0.9;
        ctx.stroke();

        // Optional Velocity vectors
        if (showVelocities && (Math.abs(p.vx) > 0.1 || Math.abs(p.vy) > 0.1)) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 2.8, p.y + p.vy * 2.8);
          ctx.stroke();
        }
      });

      // Overlay State Watermark inside chamber
      ctx.fillStyle =
        currentT < 150
          ? 'rgba(2, 132, 199, 0.12)'
          : currentT < 400
          ? 'rgba(5, 150, 105, 0.12)'
          : 'rgba(225, 29, 72, 0.12)';
      ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      const watermark =
        currentT < 150
          ? `${t.solidState.toUpperCase()} (SOLID)`
          : currentT < 400
          ? `${t.liquidState.toUpperCase()} (LIQUID)`
          : `${t.gasState.toUpperCase()} (GAS)`;
      ctx.fillText(watermark, width / 2, 60);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, showBonds, showVelocities, t, lang, initParticlesOnce]);

  // Resize canvas handler
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
    if (ctx) ctx.scale(dpr, dpr);

    initParticlesOnce(rect.width, rect.height);
  }, [initParticlesOnce]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    const container = containerRef.current;
    let observer: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => resizeCanvas());
      observer.observe(container);
    }
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (observer) observer.disconnect();
    };
  }, [resizeCanvas]);

  return (
    <div className="w-full flex flex-col gap-4 bg-white/95 rounded-2xl border border-sky-200/90 shadow-[0_4px_24px_rgba(186,230,253,0.35)] p-4 sm:p-5 backdrop-blur-md">
      {/* Top Header of the States Chamber */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-sky-100 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-sky-950 uppercase tracking-wider font-sans">
                {t.phaseTitle}
              </h2>
              <span className="text-[10px] font-mono font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full border border-sky-200">
                {lang === 'bn' ? '৮৪টি অণু' : '84 Atoms'}
              </span>
            </div>
            <p className="text-xs text-sky-700">
              {t.kineticEnergyVsWell}: <span className="font-mono font-bold">ε = {epsilon.toFixed(2)} eV</span>
            </p>
          </div>
        </div>

        {/* State Selectors (Solid, Liquid, Gas) */}
        <div className="flex items-center gap-1.5 p-1 bg-sky-50 rounded-xl border border-sky-200 font-sans">
          <button
            onClick={() => onTemperatureChange(35)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentState === 'solid'
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-sky-100/60'
            }`}
          >
            <Snowflake className="w-3.5 h-3.5" />
            <span>{t.solidState} (Solid)</span>
          </button>

          <button
            onClick={() => onTemperatureChange(250)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentState === 'liquid'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-sky-100/60'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>{t.liquidState} (Liquid)</span>
          </button>

          <button
            onClick={() => onTemperatureChange(620)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentState === 'gas'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-sky-100/60'
            }`}
          >
            <Wind className="w-3.5 h-3.5" />
            <span>{t.gasState} (Gas)</span>
          </button>
        </div>
      </div>

      {/* Main Chamber Canvas */}
      <div
        ref={containerRef}
        className="relative w-full h-[360px] sm:h-[400px] bg-gradient-to-b from-[#f8fbff] to-[#eaf4ff] rounded-xl border border-sky-200 overflow-hidden"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Floating Chamber Quick Controls */}
        <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto bg-white/95 px-3 py-1 rounded-lg border border-sky-200 shadow-xs text-xs font-mono">
            <Thermometer className="w-3.5 h-3.5 text-amber-600" />
            <span>T = {temperature} K</span>
            <span className="text-slate-400">·</span>
            <span
              className={
                temperature < 150
                  ? 'text-sky-700 font-bold'
                  : temperature < 400
                  ? 'text-emerald-700 font-bold'
                  : 'text-rose-700 font-bold'
              }
            >
              {temperature < 150
                ? 'kB·T ≪ ε (Bound Lattice on Floor)'
                : temperature < 400
                ? 'kB·T ≈ ε (Liquid Puddle on Surface)'
                : 'kB·T ≫ ε (Evaporated Free Gas Swarm)'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1.5 rounded-lg bg-white/95 border border-sky-200 text-sky-800 hover:bg-sky-50 shadow-xs transition-colors cursor-pointer"
              title={isPlaying ? t.pauseMotion : t.startOscillation}
            >
              {isPlaying ? <Pause className="w-4 h-4 text-amber-600" /> : <Play className="w-4 h-4 text-sky-600" />}
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg bg-white/95 border border-sky-200 text-sky-800 hover:bg-sky-50 shadow-xs transition-colors cursor-pointer"
              title={t.reset}
            >
              <RotateCcw className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Chamber Bottom Controls & Educational Callout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Temperature Scrub Slider */}
        <div className="md:col-span-5 p-3 rounded-xl bg-sky-50/70 border border-sky-200/70 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 font-sans">
            <span className="flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-sky-600" />
              <span>{t.temperature} (T)</span>
            </span>
            <span className="font-mono font-bold text-sky-900 bg-white px-2 py-0.5 rounded border border-sky-200">
              {temperature} K
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={750}
            step={10}
            value={temperature}
            onChange={(e) => onTemperatureChange(parseInt(e.target.value))}
            className="w-full h-2 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
          />
          <div className="flex justify-between text-[10px] font-sans text-slate-500">
            <span className="text-sky-700 font-bold">১০-১৫০ K: {t.solidState}</span>
            <span className="text-emerald-700 font-bold">১৫০-৪০০ K: {t.liquidState}</span>
            <span className="text-rose-700 font-bold">&gt; ৪০০ K: {t.gasState}</span>
          </div>
        </div>

        {/* Real-time physical explanation for current state */}
        <div className="md:col-span-7 p-3 rounded-xl bg-white border border-sky-200 text-xs text-slate-700 space-y-1 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-sky-950 font-sans">
            <span
              className={`w-2 h-2 rounded-full ${
                currentState === 'solid'
                  ? 'bg-sky-600'
                  : currentState === 'liquid'
                  ? 'bg-emerald-600'
                  : 'bg-rose-600'
              }`}
            ></span>
            <span>
              {currentState === 'solid'
                ? t.solidState
                : currentState === 'liquid'
                ? t.liquidState
                : t.gasState}
            </span>
          </div>
          <p className="text-slate-600 leading-relaxed font-sans text-[11.5px]">
            {currentState === 'solid'
              ? t.solidDescription
              : currentState === 'liquid'
              ? t.liquidDescription
              : t.gasDescription}
          </p>
        </div>
      </div>
    </div>
  );
};
