import { addDays, lastNDates, localDateKey, parseDateKey, weekdayLabel } from '../../src/domain/dates';

describe('dates', () => {
  test('ローカル日付でキーを作る(UTCに変換しない)', () => {
    // ローカル時刻の深夜0:30。toISOString() だとタイムゾーンによっては前日になる
    expect(localDateKey(new Date(2026, 8, 24, 0, 30))).toBe('2026-09-24');
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  test('キーはローカル日付の0時として解釈する', () => {
    const d = parseDateKey('2026-09-24');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 24, 0]);
  });

  test('日付の加減算は月・年をまたぐ', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  test('直近n日を古い順に返す', () => {
    expect(lastNDates(3, '2026-09-24')).toEqual(['2026-09-22', '2026-09-23', '2026-09-24']);
  });

  test('曜日', () => {
    expect(weekdayLabel('2026-09-24')).toBe('木');
  });
});
