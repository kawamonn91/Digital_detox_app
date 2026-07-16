/**
 * ai.js — ローカルAIレコメンドエンジン
 * 過去データを分析してルールベースで提案を生成する
 */

import { getLast7Days, loadSettings, loadRuns, loadHistory } from './storage.js';

/**
 * 推奨スクリーン換算比率を計算する
 * @returns {{ recommended: number, reason: string }}
 */
function recommendMeterPerScreen() {
  const settings = loadSettings();
  const history  = loadHistory();
  const current  = settings.metersPerScreen;

  if (history.length < 3) {
    return {
      recommended: current,
      reason: 'データが少ないため、現在の設定を維持しています（3日以上使用後に推奨が更新されます）',
    };
  }

  const recent = history.slice(0, 7);
  const avgDebt = recent.reduce((s, d) => s + d.scrollDebtMeters, 0) / recent.length;
  const avgRun  = recent.reduce((s, d) => s + d.runMeters, 0) / recent.length;
  const repayRate = avgRun / (avgDebt || 1);

  if (repayRate < 0.2) {
    // 返済率が低い → 換算を緩める（負債を小さく見せる）でなく、運動を増やすよう促す
    const newVal = Math.max(0.3, current * 0.85);
    return {
      recommended: Math.round(newVal * 10) / 10,
      reason: `過去1週間の返済率が${Math.round(repayRate * 100)}%と低いです。換算比率を下げて負荷を調整するか、ランニング頻度を上げましょう。`,
    };
  } else if (repayRate > 1.5) {
    // 返済しすぎ → もっと厳しくしてもOK
    const newVal = Math.min(5, current * 1.2);
    return {
      recommended: Math.round(newVal * 10) / 10,
      reason: `過去1週間の返済率が${Math.round(repayRate * 100)}%と優秀です！換算比率を上げて、より高い目標に挑戦してみましょう。`,
    };
  }

  return {
    recommended: current,
    reason: '現在のバランスは良好です。現在の換算比率を維持することをお勧めします。',
  };
}

/**
 * メインのAI分析レポートを生成する
 * @returns {Array<{title:string, body:string, metrics:Array}>}
 */
function generateRecommendations() {
  const data7 = getLast7Days();
  const settings = loadSettings();
  const runs = loadRuns();
  const recommendations = [];

  // ── 1. スクロール負債トレンド分析 ──
  const debtValues = data7.map(d => d.scrollDebtMeters);
  const todayDebt  = debtValues[6];
  const prevDebt   = debtValues.slice(0, 6).filter(v => v > 0);
  const avgPrevDebt = prevDebt.length ? prevDebt.reduce((a, b) => a + b, 0) / prevDebt.length : 0;

  if (todayDebt > avgPrevDebt * 1.3 && avgPrevDebt > 0) {
    recommendations.push({
      type: 'warning',
      title: '⚠️ スクロール負債が増加中',
      body: `今日の負債は <strong>${todayDebt.toFixed(0)}m</strong> で、過去平均より <strong>${Math.round((todayDebt / avgPrevDebt - 1) * 100)}%</strong> 多いです。SNSの使用時間を意識的に減らしてみましょう。`,
      metrics: [
        `今日の負債: ${todayDebt.toFixed(0)}m`,
        `過去平均: ${avgPrevDebt.toFixed(0)}m`,
      ],
    });
  }

  // ── 2. ランニング習慣分析 ──
  const runDays = data7.filter(d => d.runMeters > 0).length;
  const totalRunMeters = data7.reduce((s, d) => s + d.runMeters, 0);

  if (runDays === 0) {
    recommendations.push({
      type: 'action',
      title: '🏃 今週はまだ走っていません',
      body: `今週のランニング実績がゼロです。負債を解消するために、今日 <strong>${Math.max(500, todayDebt).toFixed(0)}m</strong> のランニングから始めてみましょう！`,
      metrics: [`目標距離: ${Math.max(500, todayDebt).toFixed(0)}m`],
    });
  } else if (runDays >= 5) {
    recommendations.push({
      type: 'praise',
      title: '🌟 素晴らしい継続力！',
      body: `今週 <strong>${runDays}日</strong> ランニングを継続中！合計 <strong>${(totalRunMeters / 1000).toFixed(2)}km</strong> を走りました。この調子でスマホ依存から脱却しましょう！`,
      metrics: [
        `今週の走行日数: ${runDays}日`,
        `今週の総走行距離: ${(totalRunMeters / 1000).toFixed(2)}km`,
      ],
    });
  }

  // ── 3. 最も負債を生む曜日の分析 ──
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const worstDay = data7.reduce((max, d) =>
    d.scrollDebtMeters > (max?.scrollDebtMeters || 0) ? d : max, null);
  if (worstDay && worstDay.scrollDebtMeters > 0) {
    const dayName = dayNames[worstDay.dateObj.getDay()];
    recommendations.push({
      type: 'insight',
      title: `📊 ${dayName}曜日に負債が集中`,
      body: `${dayName}曜日のスクロール負債が <strong>${worstDay.scrollDebtMeters.toFixed(0)}m</strong> と1週間で最多です。${dayName}曜日は意識的にSNSを控えるか、その日にランニングを入れてみましょう。`,
      metrics: [
        `${dayName}曜日の負債: ${worstDay.scrollDebtMeters.toFixed(0)}m`,
      ],
    });
  }

  // ── 4. 換算比率の提案 ──
  const rec = recommendMeterPerScreen();
  if (rec.recommended !== settings.metersPerScreen) {
    recommendations.push({
      type: 'setting',
      title: '⚙️ 換算比率の調整提案',
      body: `${rec.reason} 現在の比率: <strong>${settings.metersPerScreen}m/画面</strong> → 推奨: <strong>${rec.recommended}m/画面</strong>`,
      metrics: [
        `現在: ${settings.metersPerScreen}m/画面`,
        `推奨: ${rec.recommended}m/画面`,
      ],
      recommended: rec.recommended,
    });
  } else {
    recommendations.push({
      type: 'info',
      title: '📐 換算比率レポート',
      body: rec.reason,
      metrics: [
        `現在の換算比率: ${settings.metersPerScreen}m/画面`,
      ],
    });
  }

  // ── 5. 総合健康スコア ──
  const score = calcHealthScore(data7);
  recommendations.push({
    type: 'score',
    title: '💯 デジタル健康スコア',
    body: `あなたの今週のデジタル健康スコアは <strong>${score}/100</strong> です。${getScoreMessage(score)}`,
    metrics: [`スコア: ${score}/100`],
    score,
  });

  return recommendations;
}

function calcHealthScore(data7) {
  let score = 50;

  const runDays = data7.filter(d => d.runMeters > 0).length;
  score += runDays * 5; // 最大 35pt

  const totalDebt = data7.reduce((s, d) => s + d.scrollDebtMeters, 0);
  const totalRun  = data7.reduce((s, d) => s + d.runMeters, 0);
  const repayRate = totalRun / (totalDebt || 1);
  score += Math.min(15, repayRate * 15);

  // SNS使用時間が多いとマイナス
  if (totalDebt > 5000) score -= 15;
  else if (totalDebt > 2000) score -= 8;
  else if (totalDebt > 1000) score -= 3;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getScoreMessage(score) {
  if (score >= 80) return '素晴らしい！スマホとの付き合い方が上手です 🎉';
  if (score >= 60) return 'まずまずです。ランニングを増やして改善できます 👍';
  if (score >= 40) return 'スマホ使用時間を少し減らし、外に出る時間を作りましょう 💪';
  return 'スマホ依存のリスクがあります。今すぐランニングを始めましょう 🚨';
}

export { generateRecommendations, recommendMeterPerScreen, calcHealthScore };
