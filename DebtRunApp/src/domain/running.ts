/**
 * running.ts
 * GPSランニング計測の計算。
 */

export interface GeoPoint {
  lat: number;
  lon: number;
}

/** 2点間の距離(m)。ハーバーサイン公式 */
export function haversine(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/** これより精度が悪い(誤差が大きい)測位は捨てる(m) */
export const MAX_ACCURACY_METERS = 40;
/** これより速い移動はGPSの飛びとみなして距離に足さない(m/s ≒ 72km/h) */
export const MAX_SPEED_MPS = 20;

/**
 * 前回の測位から今回の測位までに進んだ距離(m)。精度が悪い、またはGPSの飛びと思われる場合は0。
 */
export function segmentDistance(
  prev: (GeoPoint & { time: number }) | null,
  next: GeoPoint & { time: number; accuracy: number },
): number {
  if (!prev || next.accuracy > MAX_ACCURACY_METERS) return 0;
  const dist = haversine(prev, next);
  const seconds = (next.time - prev.time) / 1000;
  if (seconds <= 0 || dist / seconds >= MAX_SPEED_MPS) return 0;
  return dist;
}

/** ペース(分/km)。100m未満では不安定なので0(未計測)を返す */
export function paceMinPerKm(meters: number, seconds: number): number {
  if (meters < 100 || seconds <= 0) return 0;
  return seconds / 60 / (meters / 1000);
}

/**
 * 消費カロリー(kcal)の目安。ランニングは速さによらず「体重(kg) × 距離(km) × 約1.036」kcal
 * とされる(以前の実装は時速10km固定のMETで計算していた)。
 */
export function runCalories(meters: number, weightKg: number): number {
  return weightKg * (meters / 1000) * 1.036;
}
