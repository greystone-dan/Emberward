declare module 'zzfx' {
  /** Plays a ZzFX sound from its parameter list; returns the AudioBufferSourceNode. */
  export function zzfx(...parameters: (number | undefined)[]): AudioBufferSourceNode | undefined;
  export const ZZFX: { volume: number; sampleRate: number; x?: AudioContext; play(...parameters: (number | undefined)[]): AudioBufferSourceNode | undefined };
}
