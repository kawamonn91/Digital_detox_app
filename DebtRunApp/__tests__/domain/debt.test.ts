import { buildDebtLedger, carriedOverDebt, currentDebt, mergeDailyActivity } from '../../src/domain/debt';

describe('debt', () => {
  test('負債は日をまたいで繰り越される', () => {
    const ledger = buildDebtLedger(
      [
        { date: '2026-09-22', screens: 1000, runMeters: 0 },
        { date: '2026-09-23', screens: 500, runMeters: 800 },
        { date: '2026-09-24', screens: 200, runMeters: 0 },
      ],
      1,
    );
    expect(ledger.map(d => d.balance)).toEqual([1000, 700, 900]);
    expect(currentDebt(ledger)).toBe(900);
    expect(carriedOverDebt(ledger, '2026-09-24')).toBe(700);
  });

  test('走りすぎた分は貯金にならず0で止まる', () => {
    const ledger = buildDebtLedger(
      [
        { date: '2026-09-23', screens: 100, runMeters: 5000 },
        { date: '2026-09-24', screens: 300, runMeters: 0 },
      ],
      1,
    );
    expect(ledger.map(d => d.balance)).toEqual([0, 300]);
  });

  test('換算比率を変えると過去分も新しい比率で計算し直す', () => {
    const days = [{ date: '2026-09-24', screens: 1000, runMeters: 500 }];
    expect(currentDebt(buildDebtLedger(days, 1))).toBe(500);
    expect(currentDebt(buildDebtLedger(days, 0.5))).toBe(0);
    expect(buildDebtLedger(days, 2)[0].scrollMeters).toBe(2000);
  });

  test('日付順でなくても日付順に計算する', () => {
    const ledger = buildDebtLedger(
      [
        { date: '2026-09-24', screens: 0, runMeters: 300 },
        { date: '2026-09-23', screens: 1000, runMeters: 0 },
      ],
      1,
    );
    expect(ledger.map(d => d.date)).toEqual(['2026-09-23', '2026-09-24']);
    expect(currentDebt(ledger)).toBe(700);
  });

  test('記録がなければ負債0・繰り越し0', () => {
    expect(currentDebt([])).toBe(0);
    expect(carriedOverDebt([], '2026-09-24')).toBe(0);
  });

  test('アプリ別スクロールとランニングを日付ごとにまとめる', () => {
    const days = mergeDailyActivity(
      [
        { date: '2026-09-24', screens: 100 },
        { date: '2026-09-24', screens: 50 },
        { date: '2026-09-23', screens: 30 },
      ],
      [
        { date: '2026-09-24', meters: 1000 },
        { date: '2026-09-22', meters: 2000 },
      ],
    );
    expect(days).toEqual([
      { date: '2026-09-22', screens: 0, runMeters: 2000 },
      { date: '2026-09-23', screens: 30, runMeters: 0 },
      { date: '2026-09-24', screens: 150, runMeters: 1000 },
    ]);
  });
});
