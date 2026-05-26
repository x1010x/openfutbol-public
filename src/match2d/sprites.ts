import { Assets, Texture, Rectangle, getCanvasTexture } from 'pixi.js';

interface AtlasFrameEntry {
  frame: { x: number; y: number; w: number; h: number };
}

interface AtlasJSON {
  frames: Record<string, AtlasFrameEntry>;
  animations: Record<string, number[]>;
}

export interface SpriteAtlas {
  frames: Texture[];
  animations: Record<string, Texture[]>;
}

// Loads an indexed PNG via <img>, remaps each pixel through the 16-entry palette
// using Canvas 2D (no shader), and returns a PixiJS Texture ready to use.
export async function remapWithPalette(
  pngUrl: string,
  palette: Array<[number, number, number]>,
): Promise<Texture> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = pngUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width  = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);

  const imgData = ctx.getImageData(0, 0, img.width, img.height);
  const d = imgData.data;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;   // index 0 = transparent, leave it
    const idx = d[i];                // R channel stores the raw palette index (1-15)
    const [r, g, b] = palette[idx] ?? [0, 0, 0];
    d[i]     = r;
    d[i + 1] = g;
    d[i + 2] = b;
    // alpha unchanged
  }

  ctx.putImageData(imgData, 0, 0);

  // getCanvasTexture uses CanvasSource internally — the correct PixiJS v8 path.
  const tex = getCanvasTexture(canvas, { scaleMode: 'nearest' });
  return tex;
}

// Loads an indexed PNG + atlas JSON, applies the palette on CPU, then slices
// into per-frame Textures and named animation sequences.
export async function loadAtlasWithPalette(
  pngUrl: string,
  jsonUrl: string,
  palette: Array<[number, number, number]>,
): Promise<SpriteAtlas> {
  const [baseTex, json] = await Promise.all([
    remapWithPalette(pngUrl, palette),
    fetch(jsonUrl).then(r => r.json() as Promise<AtlasJSON>),
  ]);

  const frameEntries = Object.values(json.frames);
  const frames = frameEntries.map(({ frame: f }) =>
    new Texture({ source: baseTex.source, frame: new Rectangle(f.x, f.y, f.w, f.h) })
  );

  const animations: Record<string, Texture[]> = {};
  for (const [name, indices] of Object.entries(json.animations)) {
    animations[name] = indices.map(i => frames[i]);
  }

  return { frames, animations };
}

// Original loader for atlases that don't need palette remapping (kept for future use).
export async function loadAtlas(pngPath: string, jsonPath: string): Promise<SpriteAtlas> {
  const [baseTex, json] = await Promise.all([
    Assets.load<Texture>(pngPath),
    fetch(jsonPath).then(r => r.json() as Promise<AtlasJSON>),
  ]);

  baseTex.source.scaleMode = 'nearest';

  const frameEntries = Object.values(json.frames);
  const frames = frameEntries.map(({ frame: f }) =>
    new Texture({ source: baseTex.source, frame: new Rectangle(f.x, f.y, f.w, f.h) })
  );

  const animations: Record<string, Texture[]> = {};
  for (const [name, indices] of Object.entries(json.animations)) {
    animations[name] = indices.map(i => frames[i]);
  }

  return { frames, animations };
}
