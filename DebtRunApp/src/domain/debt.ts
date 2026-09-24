/**
 * debt.ts
 * スクロール負債の計算。
 *
 * - スクロールは「画面数」で記録し、距離は換算比率(m/画面)を掛けてその都度求める
 *   (比率を変えると過去分も新しい比率で計算し直される)。
 * - 負債は日をまたいで繰り越す: その日の残債 = max(0, 前日の残債 + その日のスクロール距離 - その日のランニング距離)。
 *   走りすぎた分を「貯金」として翌日以降に持ち越すことはしない(0で止まる)。
 */

export interface DayActivity {
  /** YYYY-MM-DD */
  date: string;
  /** その日のスクロール画面数 */
  screens: number;
  /** その日のランニング距離(m) */
  runMeters: number;
}

export interface LedgerDay extends DayActivity {
  /** その日のスクロール距離(m) = 画面数 × 換算比率 */
  scrollMeters: number;
  /** その日の終わり(または現時点)の残債(m) */
  balance: number;
}

/**
 * 日ごとの記録から、日別の残債の推移を作る。[days] は日付の重複がなく、順不同でよい。
 * 記録のない日は負債が増減しないので飛ばしてかまわない。
 */
export function buildDebtLedger(days: DayActivity[], metersPerScreen: number): LedgerDay[] {
  let balance = 0;
  return [...days]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map(day => {
      const scrollMeters = day.screens * metersPerScreen;
      balance = Math.max(0, balance + scrollMeters - day.runMeters);
      return { ...day, scrollMeters, balance };
    });
}

/** 現在の残債(m)。記録がなければ0。 */
export function currentDebt(ledger: LedgerDay[]): number {
  return ledger.length > 0 ? ledger[ledger.length - 1].balance : 0;
}

/** 前日までから繰り越された残債(m)。今日の記録より前の最後の残高。 */
export function carriedOverDebt(ledger: LedgerDay[], today: string): number {
  const before = ledger.filter(d => d.date < today);
  return before.length > 0 ? before[before.length - 1].balance : 0;
}

/**
 * スクロール(日付・アプリ別)とランニング(日付別)を、日付ごとの DayActivity にまとめる。
 */
export function mergeDailyActivity(
  scroll: Array<{ date: string; screens: number }>,
  runs: Array<{ date: string; meters: number }>,
): DayActivity[] {
  const byDate = new Map<string, DayActivity>();
  const get = (date: string) => {
    let day = byDate.get(date);
    if (!day) {
      day = { date, screens: 0, runMeters: 0 };
      byDate.set(date, day);
    }
    return day;
  };
  scroll.forEach(s => { get(s.date).screens += s.screens; });
  runs.forEach(r => { get(r.date).runMeters += r.meters; });
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
