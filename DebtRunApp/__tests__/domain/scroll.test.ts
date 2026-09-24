import { appScreensOn, dailyScreens, FALLBACK_SCREEN_HEIGHT_PX } from '../../src/domain/scroll';

const entries = [
  { date: '2026-09-24', packageName: 'com.instagram.android', appName: 'Instagram', px: 4000 },
  { date: '2026-09-24', packageName: 'com.zhiliaoapp.musically', appName: 'TikTok', px: 2000 },
  { date: '2026-09-24', packageName: 'com.ss.android.ugc.trill', appName: 'TikTok', px: 4000 },
  { date: '2026-09-23', packageName: 'com.instagram.android', appName: 'Instagram', px: 2000 },
];

describe('scroll', () => {
  test('px を画面の高さで割って日付ごとの画面数にする', () => {
    expect(dailyScreens(entries, 2000)).toEqual([
      { date: '2026-09-24', screens: 5 },
      { date: '2026-09-23', screens: 1 },
    ]);
  });

  test('画面の高さが分からなければ仮の値で割る', () => {
    expect(dailyScreens([entries[3]], null)[0].screens).toBeCloseTo(2000 / FALLBACK_SCREEN_HEIGHT_PX);
  });

  test('アプリ別は多い順で、同じ表示名のアプリはまとめる', () => {
    expect(appScreensOn(entries, 2000, '2026-09-24')).toEqual([
      { packageName: 'com.zhiliaoapp.musically', appName: 'TikTok', screens: 3 },
      { packageName: 'com.instagram.android', appName: 'Instagram', screens: 2 },
    ]);
    expect(appScreensOn(entries, 2000, '2026-09-01')).toEqual([]);
  });
});
