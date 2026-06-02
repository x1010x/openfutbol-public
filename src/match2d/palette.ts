// VGA master palette extracted from MANAGER.DAT (offset 46603)
// Values are raw DOS VGA (0-63) multiplied by 4 and clamped to 255.
export const BASE_PAL: Array<[number, number, number]> = [
  [0,   0,   0  ], // 0  — transparent (index 0 = no pixel)
  [252, 164, 120 ], // 1  — skin
  [148, 112, 208 ], // 2
  [176, 212, 252 ], // 3
  [232, 144, 0  ], // 4
  [252, 232, 0  ], // 5  — yellow
  [0,   0,   124 ], // 6  — dark blue
  [0,   56,  252 ], // 7  — blue
  [120, 0,   0  ], // 8  — dark red
  [240, 12,  0  ], // 9  — red
  [40,  136, 32 ], // 10 — dark green (field)
  [56,  156, 36 ], // 11 — lighter green (field)
  [0,   0,   0  ], // 12 — black (outlines / shadows)
  [28,  104, 28 ], // 13 — dark green (sprite shadows)
  [168, 168, 168 ], // 14 — light gray
  [236, 236, 236 ], // 15 — near white
];

// Kit remapping: mapping[spriteIdx] = palIdx in BASE_PAL.
// Data from MANAGER.DAT offset 46651, 17 bytes per kit (first 16 = mapping).
export function computeKitPalette(mapping: number[]): Array<[number, number, number]> {
  return mapping.map(palIdx => BASE_PAL[palIdx] ?? [0, 0, 0]);
}

export const KIT_BARCA    = computeKitPalette([0, 1, 6, 7, 4, 7, 6, 7, 8, 9, 8, 9, 12, 13, 14, 15]);
export const KIT_MADRID   = computeKitPalette([0, 1, 14, 15, 4, 15, 14, 15, 8, 9, 10, 11, 12, 13, 14, 15]);
export const KIT_RAYO     = computeKitPalette([0, 1, 6, 7, 4, 7, 6, 7, 8, 9, 14, 15, 12, 13, 14, 15]);
export const KIT_GK       = computeKitPalette([0, 1, 2, 5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
export const KIT_GK_AWAY  = computeKitPalette([0, 1, 9, 8, 4, 8, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
