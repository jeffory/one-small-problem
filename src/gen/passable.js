export function passable(grid, n, start, goal, maxStep, margin = 0) {
  const lo = margin, hi = n - 1 - margin;
  const inside = (i, j) => i >= lo && i <= hi && j >= lo && j <= hi;
  if (!inside(start[0], start[1]) || !inside(goal[0], goal[1])) return false;
  const seen = new Uint8Array(n * n), queue = new Int32Array(n * n);
  let head = 0, tail = 0;
  const s = start[1] * n + start[0], g = goal[1] * n + goal[0];
  seen[s] = 1; queue[tail++] = s;
  while (head < tail) {
    const c = queue[head++];
    if (c === g) return true;
    const i = c % n, j = (c - i) / n;
    for (let d = 0; d < 4; d++) {
      const ni = i + (d === 0 ? 1 : d === 1 ? -1 : 0), nj = j + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (!inside(ni, nj)) continue;
      const k = nj * n + ni;
      if (seen[k]) continue;
      const dh = grid[k] - grid[c];
      if ((dh < 0 ? -dh : dh) > maxStep) continue;
      seen[k] = 1; queue[tail++] = k;
    }
  }
  return false;
}
