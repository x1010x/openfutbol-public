// Coordinate transforms, scale constants and small pure helpers shared by the
// renderer (scene construction) and the animator (per-frame update). No Pixi
// Application state lives here — only stateless math and lookup tables.

import type { AnimatedSprite } from 'pixi.js';
import type { SpriteAtlas } from './sprites';

export const SPEED_OPTIONS = [1, 2, 4, 8, 16] as const;
export const SPEED_FACTORS: Record<number, number> = {
  1: 0.5,
  2: 1.0,
  4: 2.0,
  8: 4.0,
  16: 8.0
};

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
