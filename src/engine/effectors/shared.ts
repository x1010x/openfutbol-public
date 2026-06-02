// Shared effector vocabulary: the deps bag and the constants/helpers used
// across more than one effector slice. Per-slice constants live in their slice.

import type { PlayerId, TeamSide } from '../../types/match';
import type { EnginePlayer } from '../zoneEngine';

export const KICK_FREEZE_MS = 250;

export function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }

// Carrier reset logic depends on per-player skill profiles that live in
// zoneEngine, so effectors receive setCarrier/resetCarry via this bag.
export interface EffectorDeps {
  setCarrier: (id: PlayerId, side: TeamSide) => void;
  resetCarry: (p: EnginePlayer | undefined) => void;
}
