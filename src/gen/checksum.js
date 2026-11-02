export function checksumWorld(world) {
  const rocks = new Float32Array(world.rocks.length * 6);
  world.rocks.forEach((k, i) => rocks.set([k.x, k.y, k.z, k.sx, k.sy, k.sz], i * 6));
  const route = new Float32Array(world.route.flat());
  let hash = 2166136261;
  for (const arr of [world.h, world.occ, route, rocks]) {
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
