/**
 * scroll.ts
 * ネイティブに保存されたスクロール量(px)を「画面数」にまとめる。
 */

/** 画面の高さが分からない場合に仮に使う値(px) */
export const FALLBACK_SCREEN_HEIGHT_PX = 1920;

export interface ScrollPx {
  date: string;
  packageName: string;
  appName: string;
  px: number;
}

export interface AppScroll {
  packageName: string;
  appName: string;
  screens: number;
}

function screensOf(px: number, screenHeightPx: number | null): number {
  return px / (screenHeightPx && screenHeightPx > 0 ? screenHeightPx : FALLBACK_SCREEN_HEIGHT_PX);
}

/** 日付ごとのスクロール画面数 */
export function dailyScreens(entries: ScrollPx[], screenHeightPx: number | null): Array<{ date: string; screens: number }> {
  const byDate = new Map<string, number>();
  entries.forEach(e => byDate.set(e.date, (byDate.get(e.date) ?? 0) + screensOf(e.px, screenHeightPx)));
  return [...byDate.entries()].map(([date, screens]) => ({ date, screens }));
}

/**
 * [date] のアプリ別スクロール画面数(多い順)。表示名が同じアプリ(地域違いの TikTok など)は1つにまとめる。
 */
export function appScreensOn(entries: ScrollPx[], screenHeightPx: number | null, date: string): AppScroll[] {
  const byApp = new Map<string, AppScroll>();
  entries
    .filter(e => e.date === date)
    .forEach(e => {
      const current = byApp.get(e.appName);
      const screens = screensOf(e.px, screenHeightPx);
      if (current) current.screens += screens;
      else byApp.set(e.appName, { packageName: e.packageName, appName: e.appName, screens });
    });
  return [...byApp.values()].sort((a, b) => b.screens - a.screens);
}
