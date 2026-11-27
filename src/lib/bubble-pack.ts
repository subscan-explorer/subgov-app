/** Greedy spiral circle packing for the vote bubble chart. Radius ∝ √weight; heaviest first at the centre. */
export type Bubble<T> = { item: T; x: number; y: number; r: number };

export function packBubbles<T>(items: { item: T; weight: number }[], maxRadius = 60, minRadius = 3): Bubble<T>[] {
  const sorted = items.filter((entry) => entry.weight > 0).sort((a, b) => b.weight - a.weight);
  if (!sorted.length) return [];
  const top = Math.sqrt(sorted[0].weight);
  const placed: Bubble<T>[] = [];
  for (const entry of sorted) {
    const r = Math.max(minRadius, (Math.sqrt(entry.weight) / top) * maxRadius);
    let x = 0;
    let y = 0;
    for (let step = 0; step < 20000; step++) {
      const angle = step * 0.35;
      const distance = step * 0.6;
      x = Math.cos(angle) * distance;
      y = Math.sin(angle) * distance;
      if (placed.every((other) => Math.hypot(other.x - x, other.y - y) >= other.r + r + 1)) break;
    }
    placed.push({ item: entry.item, x, y, r });
  }
  return placed;
}

/** Bounding box `[minX, minY, width, height]` with padding. */
export function bubbleBounds(bubbles: { x: number; y: number; r: number }[], pad = 4): [number, number, number, number] {
  if (!bubbles.length) return [0, 0, 1, 1];
  const minX = Math.min(...bubbles.map((b) => b.x - b.r)) - pad;
  const minY = Math.min(...bubbles.map((b) => b.y - b.r)) - pad;
  const maxX = Math.max(...bubbles.map((b) => b.x + b.r)) + pad;
  const maxY = Math.max(...bubbles.map((b) => b.y + b.r)) + pad;
  return [minX, minY, maxX - minX, maxY - minY];
}
