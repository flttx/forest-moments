/** Pure helpers for the night lights: where a glow mask sits on a mesh, and which lamps get the few real lights. */

export interface MaskPixels {
  width: number;
  height: number;
  /** RGBA bytes, image row 0 = glTF v 0. */
  data: ArrayLike<number>;
}

/**
 * Mean local position of the vertices whose UV lands on the lit part of a glow mask (red channel above
 * `threshold`): the lantern's glass, where its light hangs. Null when no vertex is lit.
 */
export function maskedCentroid(
  positions: ArrayLike<number>,
  uvs: ArrayLike<number>,
  mask: MaskPixels,
  threshold = 128,
): [number, number, number] | null {
  let x = 0, y = 0, z = 0, n = 0;
  const count = Math.min(positions.length / 3, uvs.length / 2);
  for (let i = 0; i < count; i += 1) {
    const u = uvs[i * 2] - Math.floor(uvs[i * 2]);
    const v = uvs[i * 2 + 1] - Math.floor(uvs[i * 2 + 1]);
    const column = Math.min(mask.width - 1, Math.floor(u * mask.width));
    const row = Math.min(mask.height - 1, Math.floor(v * mask.height));
    if (mask.data[(row * mask.width + column) * 4] <= threshold) continue;
    x += positions[i * 3];
    y += positions[i * 3 + 1];
    z += positions[i * 3 + 2];
    n += 1;
  }
  return n ? [x / n, y / n, z / n] : null;
}

/**
 * Indices of the `count` anchors (xyz triplets) nearest to (x, z) on the ground plane, nearest first,
 * within `reach` metres. Fills `out` and returns how many were found.
 */
export function nearestAnchors(anchors: ArrayLike<number>, x: number, z: number, count: number, reach: number, out: number[]): number {
  out.length = 0;
  const best: number[] = [];
  for (let i = 0; i < anchors.length / 3; i += 1) {
    const d = Math.hypot(anchors[i * 3] - x, anchors[i * 3 + 2] - z);
    if (d > reach) continue;
    let slot = best.length;
    while (slot > 0 && best[slot - 1] > d) slot -= 1;
    if (slot >= count) continue;
    best.splice(slot, 0, d);
    out.splice(slot, 0, i);
    if (best.length > count) {
      best.pop();
      out.pop();
    }
  }
  return out.length;
}
