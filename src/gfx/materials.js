// Texture-array layers baked by bake.frag, per-vertex flag bits read by the world shaders, and material tuples.
// Mat = [layer, texture scale, emissive strength, flags]. Later plans append layers.
export const LAYER = { regolith: 0, rock: 1, foil: 2, hull: 3, glass: 4, macro: 5 };
export const LAYER_COUNT = 6;
export const FLAG = { faceted: 1, regolith: 2, foil: 4, wobble: 8, pulse: 16, wet: 64, sway: 128 };
export const MAT = { regolith: [0, .5, 0, 2], rock: [1, .7, 0, 1], foil: [2, 1.2, 0, 4], hull: [3, .8, 0, 0], glass: [4, 1, 0, 0] };
