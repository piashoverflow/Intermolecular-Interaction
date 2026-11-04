/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SimulationParams {
  epsilon: number; // Potential well depth (eV or normalized units, default ~ 1.0)
  sigma: number;   // Zero-potential distance in Angstroms (default ~ 3.4 A)
  temperature: number; // Temperature in Kelvin (0 to 800 K)
  damping: number; // Damping coefficient (0 to 1)
  mass: number;    // Reduced mass in atomic units
  timeStep: number;// Simulation time step dt
}

export interface ForceComponents {
  repulsive: number; // 48 * eps * sigma^12 / r^13 (points away, positive)
  attractive: number; // 24 * eps * sigma^6 / r^7 (points towards, positive magnitude)
  net: number;        // repulsive - attractive (positive = repulsive / push apart, negative = attractive)
}

export interface StateMetrics {
  r: number;          // Current separation (Angstroms)
  rRatio: number;     // r / r0
  potential: number;  // U(r) in eV
  forces: ForceComponents;
  effectiveSpringConstant: number; // k = d2U/dr2 near r0
  hookeForce: number; // -k * (r - r0)
  stateDescription: 'repulsive' | 'equilibrium' | 'attractive';
  phase: 'solid' | 'liquid' | 'gas';
}

export interface AtomParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  radius: number;
  color: string;
  isPinned?: boolean;
}

export interface DisplayOptions {
  showVectors: boolean;
  showSpring: boolean;
  showDistanceGrid: boolean;
  showHookeTangent: boolean;
  showComponentCurves: boolean;
  showPotentialFill: boolean;
  clusterMode: boolean;
  soundEnabled: boolean;
}
