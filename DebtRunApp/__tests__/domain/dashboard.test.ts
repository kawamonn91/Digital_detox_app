import { avgScreenTimeMinutes, buildDashboard, topApp } from '../../src/domain/dashboard';

const today = '2026-09-24';
const scrollEntries = [
  { date: '2026-09-23', packageName: 'com.instagram.android', appName: 'Instagram', px: 2_000_000 }, // 1000画面
  { date: today, packageName: 'com.instagram.android', appName: 'Instagram', px: 600_000 }, // 300画面
  { date: today, packageName: 'com.google.android.youtube', appName: 'YouTube', px: 200_000 }, // 100画面
];
const usage = [
  { date: today, packageName: 'com.instagram.android', appName: 'Instagram', totalTimeMs: 30 * 60000 },
  { date: today, packageName: 'com.twitter.android', appName: 'X (Twitter)', totalTimeMs: 10 * 60000 },
  { date: '2026-09-23', packageName: 'com.twitter.android', appName: 'X (Twitter)', totalTimeMs: 90 * 60000 },
];

describe('buildDashboard', () => {
  const dash = buildDashboard({
    scrollEntries,
    screenHeightPx: 2000,
    runTotals: [{ date: '2026-09-23', meters: 400 }, { date: today, meters: 100 }],
    usage,
    screenTime: [{ date: today, totalTimeMs: 150 * 60000 }, { date: '2026-09-23', totalTimeMs: 200 * 60000 }],
    metersPerScreen: 1,
    today,
  });

  test('今日の数字と、繰り越し込みの残債', () => {
    expect(dash.todayScreens).toBe(400);
    expect(dash.todayScrollMeters).toBe(400);
    expect(dash.todayRunMeters).toBe(100);
    expect(dash.carriedOverMeters).toBe(600);
    expect(dash.debtMeters).toBe(900);
    expect(dash.todayRepayRatio).toBe(0.25);
    expect(dash.streak).toBe(2);
    expect(dash.week).toHaveLength(7);
  });

  test('アプリ別はスクロール量と使用時間をあわせ、スクロールしていない使用アプリも含める', () => {
    expect(dash.apps).toEqual([
      { appName: 'Instagram', packageName: 'com.instagram.android', screens: 300, meters: 300, timeMs: 30 * 60000 },
      { appName: 'YouTube', packageName: 'com.google.android.youtube', screens: 100, meters: 100, timeMs: 0 },
      { appName: 'X (Twitter)', packageName: 'com.twitter.android', screens: 0, meters: 0, timeMs: 10 * 60000 },
    ]);
    expect(dash.snsTimeTodayMs).toBe(40 * 60000);
    expect(dash.screenTimeTodayMs).toBe(150 * 60000);
  });

  test('使用状況へのアクセスが未許可なら使用時間は null', () => {
    const noUsage = buildDashboard({
      scrollEntries, screenHeightPx: 2000, runTotals: [], usage: null, screenTime: null, metersPerScreen: 1, today,
    });
    expect(noUsage.screenTimeTodayMs).toBeNull();
    expect(noUsage.snsTimeTodayMs).toBeNull();
    expect(noUsage.apps.map(a => a.timeMs)).toEqual([null, null]);
  });

  test('記録がまったくなければすべて0', () => {
    const empty = buildDashboard({
      scrollEntries: [], screenHeightPx: null, runTotals: [], usage: [], screenTime: [], metersPerScreen: 1, today,
    });
    expect(empty.debtMeters).toBe(0);
    expect(empty.todayRepayRatio).toBe(0);
    expect(empty.apps).toEqual([]);
    expect(empty.screenTimeTodayMs).toBe(0);
    expect(empty.snsTimeTodayMs).toBe(0);
  });
});

describe('avgScreenTimeMinutes', () => {
  test('1日平均のスクリーンタイム(分)', () => {
    expect(avgScreenTimeMinutes([{ date: today, totalTimeMs: 90 * 60000 }, { date: '2026-09-23', totalTimeMs: 150 * 60000 }])).toBe(120);
    expect(avgScreenTimeMinutes(null)).toBeNull();
    expect(avgScreenTimeMinutes([])).toBeNull();
  });
});

describe('topApp', () => {
  test('期間中に最も長く使ったアプリと1日平均', () => {
    expect(topApp(usage, 7)).toEqual({ appName: 'X (Twitter)', avgMinutes: 100 / 7 });
    expect(topApp(null, 7)).toBeNull();
    expect(topApp([], 7)).toBeNull();
  });
});
