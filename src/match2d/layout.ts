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

// Map an engine timestamp to the cosmetic 0–nominal match clock, holding it at
// Engine time frozen before `t`: the sum of clock-held spans (substitution
// walk-offs, Bloque 9) that end before t, plus the partial span if t is inside
// one — so the returned "live" time holds constant across a freeze and the
// clock pauses. Spans are chronological and disjoint (one sub at a time).
function frozenBefore(t: number, spans: [number, number][]): number {
  let f = 0;
  for (const [s, e] of spans) {
    if (t >= e) f += e - s;
    else if (t > s) { f += t - s; break; }
    else break;
  }
  return f;
}

// 0' / 45' through the player entrances (B2): the clock stays at 0 until the
// first-half ball-in-play, then spans [live1, halfTime] → [0', 45'], holds at
// 45' through the half-time break, and spans [live2, end] → [45', 90'].
// Substitution walk-offs additionally hold the clock (B9): live engine time is
// `t` minus the frozen spans, applied to every engine-time anchor so the minute
// pauses across a change with no long-term drift. Falls back to the plain
// linear remap when the timeline carries no nominal length or entrance marks
// (sandbox clips, which also carry no frozen spans).
export function toClockMs(
  t: number,
  timeline: {
    durationMs: number; nominalMatchMs?: number; entranceLiveMs?: number[];
    clockFrozenSpans?: [number, number][]; fullTimeMs?: number;
    stoppage1Min?: number; stoppage2Min?: number;
  },
  halfTimeMs: number | null,
): number {
  const { durationMs, nominalMatchMs, entranceLiveMs, clockFrozenSpans } = timeline;
  if (!nominalMatchMs || durationMs <= 0) return t;
  const half = nominalMatchMs / 2;
  const spans = clockFrozenSpans;
  const adj = (x: number) => (spans && spans.length ? x - frozenBefore(x, spans) : x);
  const ta = adj(t);
  const live1 = entranceLiveMs?.[0];
  const live2 = entranceLiveMs?.[1];
  // Stoppage padding so each half plays its last X minutes as 45+X' / 90+X'.
  const st1 = (timeline.stoppage1Min ?? 0) * 60000;
  const st2 = (timeline.stoppage2Min ?? 0) * 60000;

  if (halfTimeMs === null || t < halfTimeMs) {
    if (live1 == null) return ta * (nominalMatchMs / durationMs);
    if (t <= live1) return 0;
    const end = halfTimeMs ?? durationMs;
    // [live1, halfTime] → [0', (45+st1)'] so regulation 45' is reached before
    // the whistle and the tail reads as "45+X'".
    return Math.min(half + st1, ((ta - adj(live1)) / Math.max(1, adj(end) - adj(live1))) * (half + st1));
  }

  if (live2 == null) return ta * (nominalMatchMs / durationMs);
  if (t <= live2) return half;
  // [live2, fullTime] → [45', (90+st2)']. Mapping onto the whistle instant
  // (not the padded durationMs) makes the clock reach 90' regardless of how
  // many fixed walk-off/entrance ticks the compressed timeline reserves.
  const end2 = timeline.fullTimeMs ?? durationMs;
  return Math.min(nominalMatchMs + st2, half + ((ta - adj(live2)) / Math.max(1, adj(end2) - adj(live2))) * (half + st2));
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
