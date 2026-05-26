// Coordinate transforms, scale constants and small pure helpers shared by the
// renderer (scene construction) and the animator (per-frame update). No Pixi
// Application state lives here — only stateless math and lookup tables.

import type { AnimatedSprite } from 'pixi.js';
import type { SpriteAtlas } from './sprites';

// Playback speed model (see the "2D speed/time model" project memory).
// 1x is a FIXED comfortable movement pace (0.75 game-ms per real-ms), NOT a
// function of the chosen duration. The duration only sets how long the engine
// timeline is, so at 1x the match plays in exactly the chosen real minutes;
// higher presets multiply the pace and finish the same timeline sooner.
export const SPEED_OPTIONS = [1, 2, 4, 8] as const;
export const BASE_SPEED_FACTOR = 0.75; // the 1x factor
export const SPEED_FACTORS: Record<number, number> = {
  1: BASE_SPEED_FACTOR,        // 0.75
  2: BASE_SPEED_FACTOR * 2,    // 1.5
  4: BASE_SPEED_FACTOR * 4,    // 3.0
  8: BASE_SPEED_FACTOR * 8,    // 6.0
};

// Nominal full-match length the 0–90' minute display maps onto.
export const NOMINAL_MATCH_MS = 90 * 60 * 1000;

// Engine timeline length for a viewer that should last `watchMinutes` real
// minutes at 1x: durationMs / BASE_SPEED_FACTOR === watchMinutes (in ms).
export function engineDurationMs(watchMinutes: number): number {
  return Math.round(watchMinutes * 60_000 * BASE_SPEED_FACTOR);
}

// Remap a timeline timestamp to the equivalent real-match milliseconds for the
// minute display. Returns raw `t` when the timeline carries no nominal length
// (sandbox clips), so those keep showing real elapsed time.
export function toDisplayMs(t: number, durationMs: number, nominalMatchMs?: number): number {
  if (!nominalMatchMs || durationMs <= 0) return t;
  return t * (nominalMatchMs / durationMs);
}

export const FIELD_SCALE = 2;
export const PLAYER_SCALE = 2;
export const CANVAS_W = 640 * FIELD_SCALE;
export const CANVAS_H = 480 * FIELD_SCALE;
export const BASE = import.meta.env.BASE_URL;

// Playable area in canvas pixels (after FIELD_SCALE). Matches the actual touchlines
// in CAMP_indexed.png: source x=[20,619], y=[40,399] (so x2 with FIELD_SCALE).
// Anything past y=399 in source is scoreboard/banner, not grass.
export const PLAY_X: [number, number] = [40, 1238];
export const PLAY_Y: [number, number] = [80, 798];

export function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export function toCanvasX(nx: number) { return PLAY_X[0] + nx * (PLAY_X[1] - PLAY_X[0]); }
export function toCanvasY(ny: number) { return PLAY_Y[0] + ny * (PLAY_Y[1] - PLAY_Y[0]); }

export interface SpriteEntry {
  sp: AnimatedSprite;
  atlas: SpriteAtlas;
  isGK: boolean;
  isHomeGK: boolean;
  currentKey: string;
}

// Match one-shot animation suffixes (kick/dive/catch/punt/throw_<dir> etc.)
// but NOT `throw_moving`, which is the GK's looping run animation. Without the
// lookahead the regex caught it and the sprite froze on its last frame.
export const ONE_SHOT_RE = /_(kick|tackle|injury|dive|catch|punt|throw)(?:_(?!moving)|$)/;

export function ballHeightLevel(h: number): number {
  if (h < 0.005) return 1;
  if (h < 0.015) return 2;
  if (h < 0.035) return 3;
  if (h < 0.070) return 4;
  if (h < 0.130) return 5;
  return 6;
}

export function applyAnim(entry: SpriteEntry, key: string) {
  if (key === entry.currentKey) return;
  entry.currentKey = key;
  const frames = entry.atlas.animations[key] ?? entry.atlas.frames.slice(0, 4);
  entry.sp.textures = frames;
  entry.sp.loop = !ONE_SHOT_RE.test(key);
  entry.sp.gotoAndPlay(0);
}
