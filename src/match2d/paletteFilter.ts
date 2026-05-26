import { Filter, GlProgram, UniformGroup } from 'pixi.js';

const VERT = `
  in vec2 aPosition;
  out vec2 vTextureCoord;
  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;

  void main(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    gl_Position = vec4((position / uOutputTexture.xy) * 2.0 - 1.0, 0.0, 1.0);
    gl_Position.y = -gl_Position.y;
    vTextureCoord = (position - uOutputFrame.xy) / uInputSize.xy;
  }
`;

// UBO block name must match the resource key passed to super().
const FRAG = `
  in vec2 vTextureCoord;
  out vec4 finalColor;
  uniform sampler2D uTexture;

  uniform paletteData {
    vec4 colors[16];
  };

  void main(void) {
    vec4 src = texture(uTexture, vTextureCoord);
    if (src.a < 0.01) { finalColor = vec4(0.0); return; }
    int idx = int(floor(src.r * 255.0 + 0.5));
    finalColor = colors[idx];
  }
`;

export class PaletteFilter extends Filter {
  constructor(palette: Array<[number, number, number]>) {
    // Pack 16 RGB entries as vec4 (alpha = 0 for index 0, 1 for the rest).
    // std140 layout: vec4 array has no inter-element padding — Float32Array(64) is exact.
    const data = new Float32Array(64);
    for (let i = 0; i < 16; i++) {
      const [r, g, b] = palette[i] ?? [0, 0, 0];
      data[i * 4 + 0] = r / 255;
      data[i * 4 + 1] = g / 255;
      data[i * 4 + 2] = b / 255;
      data[i * 4 + 3] = i === 0 ? 0 : 1;
    }

    const paletteGroup = new UniformGroup({
      colors: { value: data, type: 'vec4<f32>', size: 16 },
    });

    super({
      glProgram: GlProgram.from({ vertex: VERT, fragment: FRAG }),
      resources: { paletteData: paletteGroup },
    });
  }
}
