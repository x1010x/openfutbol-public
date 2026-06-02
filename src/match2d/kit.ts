// Per-team kit construction for the 2D viewer. Turns a team's `colors` (hex)
// and `kitStyle` into (a) the indexed sprite PNG to draw and (b) a 16-entry
// palette mapping for the CPU remap in `sprites.ts`.
//
// How the kit mapping works (derived from the original KIT_MADRID / KIT_BARCA
// constants in palette.ts): the player sprite's pixels store fixed sprite
// indices in their red channel. Only a few of those indices are "cloth":
//   - PRIMARY (shirt):   sprite indices 2,3,5,6,7  → dark/light shades
//   - SECONDARY (shorts): sprite indices 10,11      → dark/light shades
// Everything else (1 skin, 4 accent, 8/9, 12 black, 13 shadow, 14/15 trim) is
// left as identity. The colour mapping is the SAME for every style; the style
// only chooses the sprite: JUGALISO (solid), JUGARAYA (vertical stripes — the
// secondary colour fills the stripe indices on the torso), JUGARAYO (sash).

import type { KitStyle } from '../types/game.d.ts';
import { BASE_PAL, computeKitPalette } from './palette';

// A printable kit colour available in the VGA base palette, with its dark/light
// shade indices and a representative RGB used for nearest-colour matching.
interface Shade {
  dark: number;
  light: number;
  rgb: [number, number, number];
}

const SHADES: Shade[] = [
  { dark: 14, light: 15, rgb: [236, 236, 236] }, // white / light grey
  { dark: 12, light: 14, rgb: [20, 20, 20] },    // black / dark
  { dark: 6,  light: 7,  rgb: [0, 56, 252] },    // blue
  { dark: 8,  light: 9,  rgb: [240, 12, 0] },    // red
  { dark: 10, light: 11, rgb: [56, 156, 36] },   // green
  { dark: 4,  light: 5,  rgb: [252, 232, 0] },   // yellow
  { dark: 8,  light: 4,  rgb: [232, 144, 0] },   // orange
  { dark: 6,  light: 2,  rgb: [148, 112, 208] }, // purple
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h.padEnd(6, '0').slice(0, 6);
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}

function nearestShade(hex: string | undefined, fallback: Shade): Shade {
  if (!hex) return fallback;
  const [r, g, b] = hexToRgb(hex);
  let best = fallback;
  let bestD = Infinity;
  for (const s of SHADES) {
    const dr = r - s.rgb[0], dg = g - s.rgb[1], db = b - s.rgb[2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Away anti-clash kit. The away team keeps its normal primary kit UNLESS its
// shirt colour would clash with the home shirt after VGA quantisation — i.e.
// both resolve to the same dark palette index (the shirt's dominant slots use
// `primary.dark`). Comparing the resolved shade index (not raw hex) matches
// what actually renders: two near blues that quantise to the same index look
// identical on screen. When they clash, the away team is dressed in the
// printable shade whose RGB is farthest from the home shirt's, keeping its
// chosen pattern. The home team always wears its primary kit (handled by the
// caller, which only ever rewrites the away props).
export function resolveAwayKit(
  homeColors: string[] | undefined,
  awayColors: string[] | undefined,
  awayStyle: KitStyle | undefined,
): { colors?: string[]; style?: KitStyle } {
  const fallback = SHADES[0];
  const homeShade = nearestShade(homeColors?.[0], fallback);
  const awayShade = nearestShade(awayColors?.[0], fallback);
  if (homeShade.dark !== awayShade.dark) {
    return { colors: awayColors, style: awayStyle }; // no clash → normal kit
  }
  // Clash: pick the shade farthest from the home shirt (skipping any that share
  // its dark index, so the alternative is genuinely distinguishable).
  let alt = fallback;
  let bestD = -1;
  for (const s of SHADES) {
    if (s.dark === homeShade.dark) continue;
    const dr = s.rgb[0] - homeShade.rgb[0];
    const dg = s.rgb[1] - homeShade.rgb[1];
    const db = s.rgb[2] - homeShade.rgb[2];
    const d = dr * dr + dg * dg + db * db;
    if (d > bestD) { bestD = d; alt = s; }
  }
  const hex = rgbToHex(alt.rgb);
  return { colors: [hex, hex], style: awayStyle };
}

// Build the 16-entry palette (BASE_PAL colours) for a team from its colours.
// colors[0] = shirt (primary), colors[1] = shorts (secondary, falls back to
// primary). On striped/sash sprites the secondary colour also appears on the
// torso, so a sensible secondary matters even when shorts aren't visible.
export function buildKitPalette(colors?: string[]): Array<[number, number, number]> {
  const white = SHADES[0];
  const primary = nearestShade(colors?.[0], white);
  const secondary = nearestShade(colors?.[1] ?? colors?.[0], primary);

  // Identity baseline, then overwrite the cloth slots.
  const mapping = BASE_PAL.map((_, i) => i);
  mapping[2] = primary.dark;
  mapping[3] = primary.light;
  mapping[5] = primary.light;
  mapping[6] = primary.dark;
  mapping[7] = primary.light;
  mapping[10] = secondary.dark;
  mapping[11] = secondary.light;

  return computeKitPalette(mapping);
}

const STYLE_SPRITE: Record<KitStyle, string> = {
  solid: 'JUGALISO_indexed.png',
  stripes: 'JUGARAYA_indexed.png',
  sash: 'JUGARAYO_indexed.png',
};

export function spriteForStyle(style?: KitStyle): string {
  return STYLE_SPRITE[style ?? 'solid'];
}
