import { getFallbackRecommendation, WeeklySummary } from '../src/services/geminiService';

const base: WeeklySummary = {
  avgDailyScrollScreens: 3000,
  avgDailyRunMeters: 0,
  worstDayOfWeek: '土',
  bestDayOfWeek: '記録なし',
  topApp: 'TikTok',
  topAppMinutes: 95,
  avgScreenTimeMinutes: 240,
  currentMeterPerScreen: 1,
  ratioBaseline: { metersPerScreen: 0.5, targetDailyMeters: 1500, reason: '1日1.5kmで返せる比率です。' },
  currentDebtMeters: 12000,
  totalDebtMeters: 21000,
  totalRunMeters: 0,
  runDaysCount: 0,
  streak: 0,
};

describe('APIキーが無いときのローカル提案', () => {
  test('換算比率はデータから計算した目安を提案する', () => {
    const rec = getFallbackRecommendation(base);
    expect(rec.ratiSuggestion).toBe(0.5);
    expect(rec.ratioReason).toBe('1日1.5kmで返せる比率です。');
  });

  test('最も使ったアプリ・曜日をアドバイスに使う', () => {
    const rec = getFallbackRecommendation(base);
    expect(rec.detoxTips[0]).toContain('TikTok');
    expect(rec.detoxTips[1]).toContain('土曜日');
  });

  test('記録が少ないときは比率を変えず、「不明曜日」のような文言を出さない', () => {
    const rec = getFallbackRecommendation({ ...base, ratioBaseline: null, topApp: null, worstDayOfWeek: '不明' });
    expect(rec.ratiSuggestion).toBe(1);
    expect(rec.detoxTips.join('')).not.toContain('不明');
  });

  test('健康スコアは0〜100に収まる', () => {
    const good = getFallbackRecommendation({ ...base, runDaysCount: 7, totalRunMeters: 50000, avgDailyScrollScreens: 10 });
    expect(good.healthScore).toBeLessThanOrEqual(100);
    expect(getFallbackRecommendation(base).healthScore).toBeGreaterThanOrEqual(0);
  });
});
