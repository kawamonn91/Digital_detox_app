import { formatDistance, formatDuration, formatPace, formatScreenTime } from '../../src/domain/format';
import { haversine, paceMinPerKm, runCalories, segmentDistance } from '../../src/domain/running';
import { buildDailySummary } from '../../src/domain/summary';

describe('format', () => {
  test('距離・時間・ペース・使用時間', () => {
    expect(formatDistance(999.6)).toBe('1000 m');
    expect(formatDistance(1234)).toBe('1.23 km');
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatPace(5.5)).toBe('5:30');
    expect(formatPace(5.999)).toBe('6:00');
    expect(formatPace(0)).toBe('--:--');
    expect(formatPace(Infinity)).toBe('--:--');
    expect(formatScreenTime(83 * 60000)).toBe('1時間23分');
    expect(formatScreenTime(45 * 60000)).toBe('45分');
  });
});

describe('running', () => {
  const tokyo = { lat: 35.681236, lon: 139.767125 };

  test('緯度0.001度はおよそ111m', () => {
    expect(haversine(tokyo, { lat: tokyo.lat + 0.001, lon: tokyo.lon })).toBeCloseTo(111.2, 0);
  });

  test('精度が悪い測位・GPSの飛び・最初の測位は距離に足さない', () => {
    const prev = { ...tokyo, time: 0 };
    const next = { lat: tokyo.lat + 0.0001, lon: tokyo.lon, time: 5000, accuracy: 10 };
    expect(segmentDistance(prev, next)).toBeCloseTo(11.1, 0);
    expect(segmentDistance(prev, { ...next, accuracy: 50 })).toBe(0);
    expect(segmentDistance(prev, { ...next, lat: tokyo.lat + 0.01 })).toBe(0); // 5秒で1.1km
    expect(segmentDistance(null, next)).toBe(0);
  });

  test('ペースとカロリー', () => {
    expect(paceMinPerKm(5000, 25 * 60)).toBe(5);
    expect(paceMinPerKm(50, 60)).toBe(0);
    expect(runCalories(5000, 60)).toBeCloseTo(310.8, 1);
  });
});

describe('summary', () => {
  const base = {
    screens: 1200.4, scrollMeters: 1200.4, runMeters: 0, debtMeters: 1500,
    carriedOverMeters: 300, screenTimeMs: 180 * 60000, snsTimeMs: 95 * 60000, streak: 0,
  };

  test('まとめの行には使用時間と繰り越しを含める', () => {
    const s = buildDailySummary(base);
    expect(s.lines).toEqual([
      'スクロール: 1200画面(1.20 km)',
      'スクリーンタイム: 3時間0分(うちSNS・動画 1時間35分)',
      'ランニング: 0 m',
      '前日からの繰り越し: 300 m',
    ]);
    expect(s.headline).toContain('1.50 km');
  });

  test('完済・返済中で見出しが変わり、取得できない項目は出さない', () => {
    expect(buildDailySummary({ ...base, debtMeters: 0, runMeters: 2000 }).headline).toContain('完済');
    const repaying = buildDailySummary({
      ...base, runMeters: 500, screenTimeMs: null, snsTimeMs: null, carriedOverMeters: 0, streak: 3,
    });
    expect(repaying.headline).toContain('500 m返済');
    expect(repaying.lines).toEqual(['スクロール: 1200画面(1.20 km)', 'ランニング: 500 m', '連続ランニング: 3日']);
  });
});
