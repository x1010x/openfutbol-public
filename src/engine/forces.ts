import type { Vec2 } from '../types/match';

/**
 * Calculates a spring force vector from `pos` towards `target`.
 * @param pos Current position
 * @param target Target position
 * @param k Spring constant (stiffness)
 */
export function spring(pos: Vec2, target: Vec2, k: number): Vec2 {
  return {
    x: (target.x - pos.x) * k,
    y: (target.y - pos.y) * k,
  };
}

/**
 * Calculates an attraction force from `pos` towards `target` based on a strength.
 * Unlike a spring, this can be linear or bounded.
 * @param pos Current position
 * @param target Target position
 * @param strength Attraction strength
 */
export function attract(pos: Vec2, target: Vec2, strength: number): Vec2 {
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return { x: 0, y: 0 };
  
  return {
    x: (dx / dist) * strength,
    y: (dy / dist) * strength,
  };
}

/**
 * Calculates a repulsion force pushing `pos` away from `other`.
 * @param pos Current position
 * @param other The position to repel from
 * @param strength Repulsion strength
 */
export function repel(pos: Vec2, other: Vec2, strength: number): Vec2 {
  const dx = pos.x - other.x;
  const dy = pos.y - other.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return { x: 0, y: 0 }; // If on top of each other, ignore or apply random vector
  
  return {
    x: (dx / dist) * strength,
    y: (dy / dist) * strength,
  };
}

/**
 * Clamps the magnitude of a vector to `maxMag`.
 */
export function clampMagnitude(vec: Vec2, maxMag: number): Vec2 {
  const mag = Math.hypot(vec.x, vec.y);
  if (mag > maxMag) {
    return {
      x: (vec.x / mag) * maxMag,
      y: (vec.y / mag) * maxMag,
    };
  }
  return vec;
}
