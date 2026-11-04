/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ForceComponents, SimulationParams } from '../types/physics';

/**
 * Equilibrium separation distance r0 where F(r0) = 0 and U(r0) = -epsilon.
 * r0 = 2^(1/6) * sigma ~= 1.122462048 * sigma
 */
export function getEquilibriumDistance(sigma: number): number {
  return Math.pow(2, 1 / 6) * sigma;
}

/**
 * Distance of maximum restoring attractive force (inflection point of U(r)):
 * dF/dr = 0 => r = (26/7)^(1/6) * sigma ~= 1.244455 * sigma
 */
export function getMaxAttractionDistance(sigma: number): number {
  return Math.pow(26 / 7, 1 / 6) * sigma;
}

/**
 * Effective microscopic spring constant k = d²U/dr² evaluated at r0:
 * k = 72 * epsilon / (2^(1/3) * sigma^2) ~= 57.144 * epsilon / sigma^2
 */
export function getEffectiveSpringConstant(epsilon: number, sigma: number): number {
  return (72 * epsilon) / (Math.pow(2, 1 / 3) * sigma * sigma);
}

/**
 * Calculates Lennard-Jones Potential Energy:
 * U(r) = 4 * epsilon * [(sigma / r)^12 - (sigma / r)^6]
 */
export function calculatePotential(r: number, epsilon: number, sigma: number): number {
  if (r <= 0.001) return 1000 * epsilon;
  const safeR = Math.max(r, 0.45 * sigma);
  const sOverR = sigma / safeR;
  const s6 = Math.pow(sOverR, 6);
  const s12 = s6 * s6;
  return 4 * epsilon * (s12 - s6);
}

/**
 * Calculates repulsive, attractive, and net intermolecular forces:
 * F(r) = -dU/dr = (24 * epsilon / r) * [2*(sigma/r)^12 - (sigma/r)^6]
 * Net force > 0 means REPULSIVE (pushes Atom B away in +x direction)
 * Net force < 0 means ATTRACTIVE (pulls Atom B toward Atom A in -x direction)
 */
export function calculateForces(r: number, epsilon: number, sigma: number): ForceComponents {
  const safeR = Math.max(r, 0.45 * sigma);
  const sOverR = sigma / safeR;
  const s6 = Math.pow(sOverR, 6);
  const s12 = s6 * s6;

  const repulsive = (48 * epsilon * s12) / safeR;
  const attractive = (24 * epsilon * s6) / safeR;
  const net = repulsive - attractive;

  return { repulsive, attractive, net };
}

/**
 * Generates coordinate curve arrays for graphing U(r) and F(r) across a range of r.
 */
export function generateGraphData(
  epsilon: number,
  sigma: number,
  rMin = 0.85 * sigma,
  rMax = 2.65 * sigma,
  steps = 220
) {
  const points = [];
  const dr = (rMax - rMin) / (steps - 1);
  const r0 = getEquilibriumDistance(sigma);
  const k = getEffectiveSpringConstant(epsilon, sigma);

  for (let i = 0; i < steps; i++) {
    const r = rMin + i * dr;
    const U = calculatePotential(r, epsilon, sigma);
    const { repulsive, attractive, net } = calculateForces(r, epsilon, sigma);
    const hookeForce = -k * (r - r0);
    const hookePotential = -epsilon + 0.5 * k * Math.pow(r - r0, 2);

    points.push({
      r,
      U: Math.max(Math.min(U, 6 * epsilon), -1.5 * epsilon),
      F: Math.max(Math.min(net, 12 * (epsilon / sigma)), -8 * (epsilon / sigma)),
      F_rep: Math.min(repulsive, 15 * (epsilon / sigma)),
      F_att: -attractive,
      hookeForce: Math.max(Math.min(hookeForce, 10 * (epsilon / sigma)), -10 * (epsilon / sigma)),
      hookePotential: Math.min(hookePotential, 4 * epsilon),
    });
  }

  return points;
}

/**
 * Velocity Verlet / Langevin dynamic integration step for Atom B.
 * Calibrated for smooth, brisk, responsive harmonic return when released from tension!
 */
export function stepAtomDynamics(
  currentR: number,
  velocity: number,
  params: SimulationParams,
  dt: number,
  isDragging: boolean
): { newR: number; newV: number } {
  if (isDragging) {
    return { newR: currentR, newV: 0 };
  }

  const { epsilon, sigma, temperature, damping, mass } = params;
  const r0 = getEquilibriumDistance(sigma);
  const { net: fNet } = calculateForces(currentR, epsilon, sigma);

  // In pure Lennard-Jones, attraction falls off as 1/r^7, which becomes vanishingly small
  // beyond 1.8 sigma. To ensure Atom B returns smoothly and oscillates when pulled to tension,
  // we ensure a robust physical restoring force across the entire interactive stage:
  let effectiveForce = fNet;
  if (currentR > r0) {
    const deltaR = currentR - r0;
    // Physical restoring tension guarantee for classroom visual physics
    const minAttraction = -0.55 * (epsilon / sigma) * (deltaR / (0.4 * sigma + deltaR)) * 3.5;
    effectiveForce = Math.min(fNet, minAttraction);
  }

  // Visual simulation acceleration factor (scales time-step to comfortable human perception ~1Hz)
  const visualForceMultiplier = 7.5;
  const scaledForce = effectiveForce * visualForceMultiplier;

  // Damping force (tuned for smooth damped oscillations: 4-6 pleasant visible periods)
  const fDamp = -damping * velocity * mass * 3.2;

  // Thermal random force (calibrated so default/low temperature is calm and stable, increasing smoothly at higher T)
  const thermalNoiseStd = Math.pow(Math.max(0, temperature) / 280, 1.3) * 0.85;
  const u1 = Math.max(1e-7, Math.random());
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const fThermal = thermalNoiseStd * z0 * 1.2;

  const totalForce = scaledForce + fDamp + fThermal;
  const accel = totalForce / Math.max(0.1, mass);

  let newV = velocity + accel * dt;
  let newR = currentR + newV * dt;

  // Boundary wall constraints for visualization stage
  const minR = 0.65 * sigma;
  const maxR = 2.85 * sigma;

  if (newR < minR) {
    newR = minR;
    newV = -newV * 0.35; // Inelastic rebound off repulsive wall
  } else if (newR > maxR) {
    newR = maxR;
    newV = -newV * 0.4; // Soft rebound off outer boundary
  }

  return { newR, newV };
}
