/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class PhysicsAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = false;
  private lastEquilibriumCrossing: number = 0;

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (enabled && !this.ctx) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();
      } catch {
        this.isEnabled = false;
      }
    }
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Plays a delicate tone when Atom B crosses or reaches equilibrium
   */
  public playEquilibriumChime() {
    if (!this.isEnabled || !this.ctx) return;
    const now = Date.now();
    if (now - this.lastEquilibriumCrossing < 120) return; // Debounce
    this.lastEquilibriumCrossing = now;

    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, this.ctx.currentTime + 0.15); // E5

      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch {
      // Audio autoplay policy or hardware muted
    }
  }

  /**
   * Plays a subtle deep click or thump when compressed into the repulsive wall
   */
  public playRepulsiveWallClash(intensity: number) {
    if (!this.isEnabled || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.08);

      const volume = Math.min(0.08, 0.02 * intensity);
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch {
      // Ignore
    }
  }
}

export const soundEngine = new PhysicsAudioSynthesizer();
