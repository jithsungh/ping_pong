/**
 * Audio Manager for ping pong sound effects
 * Uses Web Audio API for low-latency, accurate sounds
 */

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isEnabled = true;
  
  constructor() {
    this.initAudioContext();
  }
  
  private initAudioContext(): void {
    try {
      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = 0.5;
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
    }
  }
  
  /**
   * Resume audio context (required after user interaction)
   */
  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
  
  /**
   * Set master volume (0-1)
   */
  setVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }
  
  /**
   * Enable/disable all sounds
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }
  
  /**
   * Play paddle hit sound - sharp "tock" with varying pitch based on power
   */
  playPaddleHit(power: number = 0.5): void {
    if (!this.isEnabled || !this.audioContext || !this.masterGain) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    // Create oscillator for the "tock" sound
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    
    // Sharper frequency for harder hits
    const baseFreq = 800 + power * 400;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.08);
    osc.type = 'triangle';
    
    // Quick attack, fast decay (paddle hit is very short)
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(0.5 + power * 0.3, now + 0.002);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.1);
    
    // Add click/impact sound using noise burst
    this.playImpactNoise(0.03, 0.3 + power * 0.2);
  }
  
  /**
   * Play table bounce sound - deeper "tok" for ball hitting table
   */
  playTableBounce(): void {
    if (!this.isEnabled || !this.audioContext || !this.masterGain) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    // Lower frequency for table (hollow wood-like sound)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.05);
    osc.type = 'sine';
    
    // Quick envelope
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(0.4, now + 0.001);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.08);
    
    // Add table resonance
    this.playResonance(120, 0.1, 0.15);
  }
  
  /**
   * Play net hit sound - softer, damped sound
   */
  playNetHit(): void {
    if (!this.isEnabled || !this.audioContext || !this.masterGain) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    // Filtered noise for net
    const bufferSize = ctx.sampleRate * 0.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    // Low-pass filter for muffled sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.3;
    
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    
    noise.start(now);
  }
  
  /**
   * Play score/point sound
   */
  playScore(isPlayerPoint: boolean): void {
    if (!this.isEnabled || !this.audioContext || !this.masterGain) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    // Ascending tones for player, descending for opponent
    const baseNote = isPlayerPoint ? 440 : 330;
    const direction = isPlayerPoint ? 1 : -1;
    
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      
      const delay = i * 0.08;
      const freq = baseNote * Math.pow(2, (i * direction * 4) / 12);
      
      osc.frequency.setValueAtTime(freq, now + delay);
      osc.type = 'sine';
      
      oscGain.gain.setValueAtTime(0, now + delay);
      oscGain.gain.linearRampToValueAtTime(0.2, now + delay + 0.01);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
      
      osc.connect(oscGain);
      oscGain.connect(this.masterGain);
      
      osc.start(now + delay);
      osc.stop(now + delay + 0.2);
    }
  }
  
  /**
   * Play serve sound (whistle-like)
   */
  playServe(): void {
    if (!this.isEnabled || !this.audioContext || !this.masterGain) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.1);
    osc.type = 'sine';
    
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(0.15, now + 0.02);
    oscGain.gain.linearRampToValueAtTime(0.15, now + 0.08);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.2);
  }
  
  /**
   * Play ball out of bounds
   */
  playOut(): void {
    if (!this.isEnabled || !this.audioContext || !this.masterGain) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    // Low thud
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
    osc.type = 'sine';
    
    oscGain.gain.setValueAtTime(0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.25);
  }
  
  // Helper: short noise burst for impact
  private playImpactNoise(duration: number, volume: number): void {
    if (!this.audioContext || !this.masterGain) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.exp(-i / (ctx.sampleRate * 0.01));
      data[i] = (Math.random() * 2 - 1) * env;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = volume;
    
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    
    noise.start(now);
  }
  
  // Helper: resonance for hollow sounds
  private playResonance(freq: number, duration: number, volume: number): void {
    if (!this.audioContext || !this.masterGain) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    
    osc.frequency.setValueAtTime(freq, now);
    osc.type = 'sine';
    
    oscGain.gain.setValueAtTime(volume, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }
}

// Singleton instance
export const audioManager = new AudioManager();
