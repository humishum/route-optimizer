import type { GeoCircle } from "./models";

const EARTH_RADIUS_M = 6371000;

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistanceM(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const dLat = degToRad(b.lat - a.lat);
  const dLon = degToRad(b.lon - a.lon);
  const lat1 = degToRad(a.lat);
  const lat2 = degToRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isPointInCircle(
  point: { lat: number; lon: number },
  circle: GeoCircle,
): boolean {
  return haversineDistanceM(point, circle) <= circle.radiusM;
}

export function angleDiffDeg(a: number, b: number): number {
  const delta = ((a - b + 540) % 360) - 180;
  return Math.abs(delta);
}

export function distancePointToSegmentM(
  p: { lat: number; lon: number },
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const ax = degToRad(a.lon);
  const ay = degToRad(a.lat);
  const bx = degToRad(b.lon);
  const by = degToRad(b.lat);
  const px = degToRad(p.lon);
  const py = degToRad(p.lat);

  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) {
    return haversineDistanceM(p, a);
  }

  const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  const proj = {
    lon: (ax + clamped * dx) * (180 / Math.PI),
    lat: (ay + clamped * dy) * (180 / Math.PI),
  };
  return haversineDistanceM(p, proj);
}

export function averageDistanceToPolylineM(
  points: { lat: number; lon: number }[],
  polyline: { lat: number; lon: number }[],
): number | undefined {
  if (points.length === 0 || polyline.length < 2) {
    return undefined;
  }

  let sum = 0;
  for (const point of points) {
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < polyline.length - 1; i += 1) {
      const segDist = distancePointToSegmentM(
        point,
        polyline[i],
        polyline[i + 1],
      );
      if (segDist < best) {
        best = segDist;
      }
    }
    sum += best;
  }

  return sum / points.length;
}
