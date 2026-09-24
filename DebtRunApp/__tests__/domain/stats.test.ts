import { dailyAverages, recommendRatio, runStreak, weekSeries } from '../../src/domain/stats';

describe('stats', () => {
  test('連続ランニング日数は今日から遡って数える', () => {
    expect(runStreak(['2026-09-24', '2026-09-23', '2026-09-22', '2026-09-20'], '2026-09-24')).toBe(3);
  });

  test('今日まだ走っていなくても昨日までの連続記録は途切れない', () => {
    expect(runStreak(['2026-09-23', '2026-09-22'], '2026-09-24')).toBe(2);
    expect(runStreak(['2026-09-22'], '2026-09-24')).toBe(0);
    expect(runStreak([], '2026-09-24')).toBe(0);
  });

  test('週間グラフは記録のない日も0で埋めて日付をそろえる', () => {
    const bars = weekSeries(
      [
        { date: '2026-09-20', screens: 100, runMeters: 0 },
        { date: '2026-09-24', screens: 0, runMeters: 3000 },
      ],
      2,
      '2026-09-24',
    );
    expect(bars.map(b => b.date)).toEqual([
      '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24',
    ]);
    expect(bars[2]).toEqual({ date: '2026-09-20', label: '日', scrollMeters: 200, runMeters: 0 });
    expect(bars[6].runMeters).toBe(3000);
    expect(bars[0].scrollMeters).toBe(0);
  });

  test('1日平均は記録のない日も0として数える', () => {
    const avg = dailyAverages(
      [
        { date: '2026-09-24', screens: 700, runMeters: 1400 },
        { date: '2026-09-01', screens: 9999, runMeters: 9999 },
      ],
      '2026-09-24',
    );
    expect(avg).toEqual({ screens: 100, runMeters: 200 });
  });

  test('ほとんど走っていない人には1日1.5kmで返せる比率をすすめる', () => {
    const rec = recommendRatio(3000, 0)!;
    expect(rec.metersPerScreen).toBe(0.5);
    expect(rec.targetDailyMeters).toBe(1500);
  });

  test('よく走る人には普段の1.2倍で返せる比率をすすめる', () => {
    const rec = recommendRatio(1000, 5000)!;
    expect(rec.metersPerScreen).toBe(6);
    expect(rec.targetDailyMeters).toBe(6000);
  });

  test('比率は0.1〜10mに収め、スクロールの記録が少なければ提案しない', () => {
    expect(recommendRatio(100_000, 0)!.metersPerScreen).toBe(0.1);
    expect(recommendRatio(20, 20_000)!.metersPerScreen).toBe(10);
    expect(recommendRatio(5, 0)).toBeNull();
  });
});
