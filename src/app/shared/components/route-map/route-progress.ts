export type Coordinate = [number, number];

/** Split at the rider's projection onto the road, preserving the full road geometry. */
export function routeProgress(
  route: Coordinate[],
  marker: Coordinate | null,
): { travelled: Coordinate[]; remaining: Coordinate[]; bearing: number } {
  if (!marker || route.length < 2) return { travelled: [], remaining: route, bearing: 90 };
  let bestDistance = Infinity;
  let bestIndex = 0;
  let position = route[0];
  const scale = Math.cos((marker[1] * Math.PI) / 180);
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i],
      b = route[i + 1];
    const dx = (b[0] - a[0]) * scale,
      dy = b[1] - a[1];
    const length = dx * dx + dy * dy;
    const t = length
      ? Math.max(
          0,
          Math.min(1, ((marker[0] - a[0]) * scale * dx + (marker[1] - a[1]) * dy) / length),
        )
      : 0;
    const point: Coordinate = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const distance = ((point[0] - marker[0]) * scale) ** 2 + (point[1] - marker[1]) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
      position = point;
    }
  }
  const from = route[bestIndex],
    to = route[bestIndex + 1];
  const bearing = (Math.atan2((to[0] - from[0]) * scale, to[1] - from[1]) * 180) / Math.PI;
  return {
    travelled: [...route.slice(0, bestIndex + 1), position],
    remaining: [position, ...route.slice(bestIndex + 1)],
    bearing,
  };
}
