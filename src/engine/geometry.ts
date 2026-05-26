import type { Vec2 } from '../types/match';

/**
 * Calculates the shortest distance from a point `p` to a line segment `a`-`b`.
 */
export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ap = { x: p.x - a.x, y: p.y - a.y };
  const ab2 = ab.x * ab.x + ab.y * ab.y;
  
  if (ab2 === 0) return Math.hypot(ap.x, ap.y); // a and b are the same point
  
  const t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / ab2));
  const proj = { x: a.x + ab.x * t, y: a.y + ab.y * t };
  
  return Math.hypot(p.x - proj.x, p.y - proj.y);
}
