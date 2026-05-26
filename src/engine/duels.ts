export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function passForward(rng: Rng, passing: number, defending: number): boolean {
  return rng() < clamp(0.55 + 0.30 * (passing - defending) / 99, 0.20, 0.92);
}

export function dribble(
  rng: Rng,
  dribbling: number,
  defDefending: number,
  atkSpeed: number,
  defSpeed: number,
): boolean {
  return rng() < clamp(
    0.40 + 0.35 * (dribbling - defDefending) / 99 + 0.10 * (atkSpeed - defSpeed) / 99,
    0.10, 0.85,
  );
}

export function shotOnTarget(rng: Rng, shooting: number, distFromBox: number): boolean {
  return rng() < clamp(0.45 + 0.30 * shooting / 99 - 0.10 * distFromBox, 0.10, 0.88);
}

export function goalScored(rng: Rng, shooting: number, gkDefending: number, distFromBox: number): boolean {
  return rng() < clamp(
    0.30 + 0.25 * (shooting - gkDefending) / 99 - 0.20 * distFromBox,
    0.04, 0.55,
  );
}

export function foulCommitted(rng: Rng, defPhysical: number): boolean {
  return rng() < clamp(0.10 + 0.20 * (1 - defPhysical / 99), 0.05, 0.45);
}
