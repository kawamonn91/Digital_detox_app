/**
 * dates.ts
 * 日付キー(YYYY-MM-DD)の扱い。
 *
 * new Date().toISOString() は UTC なので、日本時間(UTC+9)では 0〜9時の記録が前日扱いになる。
 * 日付キーは必ずここの関数で、端末のローカル日付から作ること。
 */

/** 端末のローカル日付で YYYY-MM-DD を返す */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD をローカル日付の0時として解釈する(new Date('YYYY-MM-DD') は UTC 扱いになるため使わない) */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

/** [today] を最後の日とする直近 [n] 日分の日付キー(古い順) */
export function lastNDates(n: number, today: string): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 曜日の1文字表記(日〜土) */
export function weekdayLabel(key: string): string {
  return WEEKDAYS[parseDateKey(key).getDay()];
}
