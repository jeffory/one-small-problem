// Texture-array layers baked by bake.frag, per-vertex flag bits read by the world shaders, and material tuples.
// Mat = [layer, texture scale, emissive strength, flags]. Later plans append layers.
export const LAYER = { regolith: 0, rock: 1, foil: 2, hull: 3, glass: 4, macro: 5, flesh: 6, chitin: 7, eye: 8, coil: 9, panel: 10, tape: 11, scorch: 12, goo: 13 };
export const LAYER_COUNT = 14;
export const FLAG = { faceted: 1, regolith: 2, foil: 4, wobble: 8, pulse: 16, wet: 64, sway: 128 };
export const MAT = { regolith: [0, .5, 0, 2], rock: [1, .7, 0, 1], foil: [2, 1.2, 0, 4], hull: [3, .8, 0, 0], glass: [4, 1, 0, 0],
  flesh: [6, 1.4, 0, 8], fleshS: [6, 1.4, 0, 0], tent: [6, 1.6, 0, 128], chitin: [7, 1.2, 0, 64], chitinF: [7, 1.2, 0, 65],
  eye: [8, 1, 2.2, 8], glowRing: [8, 2, 1.2, 16], wetEye: [4, 1, 0, 64], gunMetal: [10, 4, .6, 64], gunFlesh: [6, 3, 0, 64],
  coil: [9, 3, .55, 16], coilB: [9, 3, 1.0, 16], tape: [11, 2, 0, 0], scorch: [12, .8, 0, 0], goo: [13, 1.5, .25, 72] };
