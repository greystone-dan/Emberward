import { makeRng, nextFloat, nextInt, type RngState } from '../core/rng';
import { getSettings, subscribeSettings } from './settings';

/**
 * Procedural audio (ART.md): ZzFX for effects, Tone.js for two seeded loops. Nothing loads or plays until the
 * first user gesture (browsers require it), and every call is safe when audio is unavailable (tests, headless).
 * `window.__audio.log` records every effect name so Playwright can check the hooks fire.
 */

export type Sfx = 'summon' | 'reach' | 'shield' | 'poison' | 'rekindle' | 'hit' | 'death' | 'click';
export type MusicKind = 'stair' | 'boss' | null;

// ZzFX parameter lists: volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide,
// deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay.
const SOUNDS: Record<Sfx, (number | undefined)[]> = {
  // wick-light: a soft rising sine
  summon: [0.6, 0.02, 420, 0.01, 0.06, 0.18, 0, 1.6, 6, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 0.6, 0.05],
  // ember-crackle: short noise
  reach: [0.5, 0.1, 90, undefined, 0.03, 0.14, 4, 1.9, undefined, undefined, undefined, undefined, undefined, 0.9, undefined, undefined, undefined, 0.5, 0.06],
  // bronze clang
  shield: [0.5, 0.01, 740, 0.005, 0.1, 0.35, 1, 2.2, undefined, undefined, -120, 0.06, undefined, undefined, undefined, 0.1, 0.08, 0.5, 0.03],
  // hiss
  poison: [0.35, 0.05, 240, 0.02, 0.18, 0.28, 4, 1.1, undefined, undefined, undefined, undefined, undefined, 1.3, undefined, undefined, undefined, 0.4, 0.12],
  // the whoomph: the biggest sound in the game
  rekindle: [1.1, 0.02, 70, 0.06, 0.32, 0.7, 0, 1.4, 9, 0.2, undefined, undefined, undefined, 0.1, undefined, undefined, 0.12, 0.8, 0.25],
  hit: [0.4, 0.05, 210, undefined, 0.02, 0.07, 2, 1.3, -5, undefined, undefined, undefined, undefined, 0.1, undefined, undefined, undefined, 0.5, 0.02],
  death: [0.45, 0.05, 170, 0.01, 0.08, 0.26, 2, 1.4, -7, undefined, undefined, undefined, undefined, 0.3, undefined, undefined, undefined, 0.5, 0.08],
  click: [0.25, undefined, 900, undefined, 0.01, 0.03, 1, 1.5, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 0.4, 0.01],
};

type ZzfxModule = typeof import('zzfx');
type ToneModule = typeof import('tone');

interface AudioDebug {
  log: string[];
  music: MusicKind;
  /** What is really playing: the loop kind and Tone's transport state, for tests. */
  state(): { playing: MusicKind; transport: string | null; unlocked: boolean };
}
const debug: AudioDebug = { log: [], music: null, state: () => ({ playing, transport: tone ? tone.getTransport().state : null, unlocked }) };
if (typeof window !== 'undefined') (window as unknown as { __audio: AudioDebug }).__audio = debug;

let zz: ZzfxModule | null = null;
let tone: ToneModule | null = null;
let unlocked = false;
let wantMusic: MusicKind = null;
let playing: MusicKind = null;
let seed = 'demo';
let stop: (() => void) | null = null;

/** Called on the first pointer or key event: creates the audio contexts while the gesture is live. */
export async function unlockAudio(): Promise<void> {
  if (unlocked) return;
  unlocked = true;
  try {
    zz = await import('zzfx');
    zz.ZZFX.volume = getSettings().sfx;
  } catch {
    zz = null;
  }
  void startMusicIfWanted();
}

export function installAudioUnlock(): void {
  if (typeof window === 'undefined') return;
  const once = () => {
    void unlockAudio();
    window.removeEventListener('pointerdown', once);
    window.removeEventListener('keydown', once);
  };
  window.addEventListener('pointerdown', once);
  window.addEventListener('keydown', once);
  subscribeSettings(() => {
    if (zz) zz.ZZFX.volume = getSettings().sfx;
    applyMusicVolume();
  });
}

export function sfx(name: Sfx): void {
  debug.log.push(name);
  if (debug.log.length > 200) debug.log.splice(0, debug.log.length - 200);
  const vol = getSettings().sfx;
  if (!zz || vol <= 0) return;
  try {
    zz.zzfx(...SOUNDS[name]);
  } catch {
    /* no audio device */
  }
}

/** Switches the loop: 'stair' during a run, 'boss' in the boss battle, null on the title. */
export function music(kind: MusicKind, musicSeed = seed): void {
  seed = musicSeed;
  wantMusic = kind;
  debug.music = kind;
  void startMusicIfWanted();
}

function applyMusicVolume(): void {
  if (!tone) return;
  const v = getSettings().music;
  tone.getDestination().volume.value = v <= 0 ? -Infinity : -28 + 24 * v;
}

async function startMusicIfWanted(): Promise<void> {
  if (!unlocked) return;
  if (wantMusic === playing) return;
  if (stop) {
    stop();
    stop = null;
  }
  playing = wantMusic;
  if (!wantMusic) return;
  try {
    tone ??= await import('tone');
    if (playing !== wantMusic) return;
    await tone.start();
    applyMusicVolume();
    stop = wantMusic === 'boss' ? bossLoop(tone, seed) : stairLoop(tone, seed);
  } catch {
    playing = null;
  }
}

/** The Stair: low strings, drip echoes, a distant bell. Seeded so the same run hums the same tune. */
function stairLoop(T: ToneModule, s: string): () => void {
  let rng: RngState = makeRng(s, 'music');
  const verb = new T.Reverb({ decay: 7, wet: 0.6 }).toDestination();
  const filter = new T.Filter(600, 'lowpass').connect(verb);
  const drone = new T.PolySynth(T.AMSynth, { volume: -14, envelope: { attack: 4, release: 6 }, harmonicity: 1.5 }).connect(filter);
  const drip = new T.PluckSynth({ volume: -10, dampening: 2400, resonance: 0.92 }).connect(verb);
  const bell = new T.MetalSynth({ volume: -22, envelope: { attack: 0.01, decay: 3.5, release: 2 }, harmonicity: 4.1, modulationIndex: 20, resonance: 1200, octaves: 1 }).connect(verb);
  const scale = ['C3', 'Eb3', 'F3', 'G3', 'Bb3', 'C4', 'Eb4'];
  drone.triggerAttack(['C2', 'G2']);
  const dripLoop = new T.Loop((time) => {
    let f: number;
    [f, rng] = nextFloat(rng);
    if (f < 0.55) {
      let i: number;
      [i, rng] = nextInt(rng, scale.length);
      drip.triggerAttack(scale[i]!, time);
    }
  }, '4n').start(0);
  const bellLoop = new T.Loop((time) => {
    let f: number;
    [f, rng] = nextFloat(rng);
    if (f < 0.35) bell.triggerAttackRelease('G4', '2n', time);
  }, '4m').start('2m');
  const swell = new T.Loop((time) => {
    let i: number;
    [i, rng] = nextInt(rng, 3);
    drone.triggerRelease(['C2', 'G2'], time);
    drone.triggerAttack(i === 0 ? ['C2', 'G2'] : i === 1 ? ['Ab1', 'Eb2'] : ['F2', 'C3'], time + 0.1);
  }, '8m').start('8m');
  T.getTransport().bpm.value = 54;
  T.getTransport().start();
  return () => {
    dripLoop.dispose();
    bellLoop.dispose();
    swell.dispose();
    drone.releaseAll();
    T.getTransport().stop();
    T.getTransport().cancel();
    setTimeout(() => [drone, drip, bell, filter, verb].forEach((n) => n.dispose()), 7000);
  };
}

/** The boss: a heavier pulse under the same drowned room. */
function bossLoop(T: ToneModule, s: string): () => void {
  let rng: RngState = makeRng(s, 'boss-music');
  const verb = new T.Reverb({ decay: 5, wet: 0.5 }).toDestination();
  const dist = new T.Distortion(0.15).connect(verb);
  const drone = new T.PolySynth(T.FMSynth, { volume: -16, envelope: { attack: 2, release: 4 }, modulationIndex: 6 }).connect(dist);
  const kick = new T.MembraneSynth({ volume: -8, pitchDecay: 0.08, octaves: 6 }).connect(verb);
  const drip = new T.PluckSynth({ volume: -12, dampening: 1800, resonance: 0.9 }).connect(verb);
  const scale = ['A2', 'Bb2', 'C3', 'Eb3', 'E3', 'G3'];
  drone.triggerAttack(['A1', 'E2', 'Bb2']);
  const pulse = new T.Loop((time) => kick.triggerAttackRelease('A1', '8n', time), '2n').start(0);
  const dripLoop = new T.Loop((time) => {
    let f: number;
    [f, rng] = nextFloat(rng);
    if (f < 0.5) {
      let i: number;
      [i, rng] = nextInt(rng, scale.length);
      drip.triggerAttack(scale[i]!, time);
    }
  }, '8n').start('4n');
  T.getTransport().bpm.value = 72;
  T.getTransport().start();
  return () => {
    pulse.dispose();
    dripLoop.dispose();
    drone.releaseAll();
    T.getTransport().stop();
    T.getTransport().cancel();
    setTimeout(() => [drone, kick, drip, dist, verb].forEach((n) => n.dispose()), 5000);
  };
}
