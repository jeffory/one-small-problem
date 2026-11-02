import { sampleGround, HALF, N, MAP_MARGIN } from '../src/gen/surface.js';
export function edgeMargin(w, bound = HALF - MAP_MARGIN, eye = 1.7) {
  let worst = Infinity;
  for (let k = HALF - bound; k <= HALF + bound; k++) {
    const c = k - HALF;
    for (const [e, g] of [[w.h[k * N], sampleGround(w, -bound, c)], [w.h[k * N + N - 1], sampleGround(w, bound, c)],
      [w.h[k], sampleGround(w, c, -bound)], [w.h[(N - 1) * N + k], sampleGround(w, c, bound)]]) worst = Math.min(worst, e - g - eye);
  }
  return worst;
}
