// Muddy, gritty fixed palette (sRGB hex, the look test's PAL). The post pass forces the final image into these colours.
export const PALETTE = ('000000 0d0c0b 171513 211e1b 2c2824 38332e 453f38 534c44 635b51 746b60 877d70 9b9082 b2a695 d0c6b6 efe8dc ' +
  '1a1c1f 2e3134 4a4e52 24150c 3a2112 552e17 70401c 8e5524 b07436 26240f 3d3a19 575224 766f35 1b1220 2d1d35 42294c 5c3a62 ' +
  '0c211c 133a30 1c5a46 2a8263 4fb685 9fe8b0 7ff0e0 e0fff8 5a6418 9aa62c 5a120a b8301a 1a305c 3d68a8 fff4dc 6e5220 9a7630 ' +
  'c49a44 e0c270').split(' ');

// r, g, b per entry as n/255, so the shader's choices round-trip exactly through an RGBA8 target.
export function paletteFloats() {
  const f = new Float32Array(PALETTE.length * 3);
  PALETTE.forEach((h, i) => { const n = parseInt(h, 16); f[i * 3] = (n >> 16 & 255) / 255; f[i * 3 + 1] = (n >> 8 & 255) / 255; f[i * 3 + 2] = (n & 255) / 255; });
  return f;
}
