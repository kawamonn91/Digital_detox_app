/**
 * geminiService.ts
 * Gemini 1.5 Flash API クライアント
 *
 * モデル: gemini-1.5-flash (無料枠: 15req/min, 1500req/day)
 * 呼び出しは1日1回のみ → コスト実質ゼロ
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GEMINI_MODEL = 'gemini-1.5-flash';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const CACHE_KEY = 'gemini_last_recommendation';
const CACHE_KEY_DATE = 'gemini_last_date';

export interface WeeklySummary {
  avgDailyScrollScreens: number;
  avgDailyRunMeters: number;
  worstDayOfWeek: string;
  bestDayOfWeek: string;
  topApp: string;
  topAppMinutes: number;
  currentMeterPerScreen: number;
  totalDebtMeters: number;
  totalRunMeters: number;
  runDaysCount: number;
  streak: number;
}

export interface GeminiRecommendation {
  summary: string;
  detoxTips: string[];
  runningTip: string;
  ratiSuggestion: number | null;
  ratioReason: string;
  healthScore: number;
  encouragement: string;
}

/**
 * Gemini API を呼び出してパーソナライズドレコメンドを生成
 * APIキーは環境変数または AsyncStorage から取得
 */
export async function getGeminiRecommendation(
  data: WeeklySummary,
  apiKey: string,
): Promise<GeminiRecommendation> {

  // 同日にすでに呼び出した場合はキャッシュを返す
  const today = new Date().toISOString().slice(0, 10);
  const lastDate = await AsyncStorage.getItem(CACHE_KEY_DATE);
  if (lastDate === today) {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  }

  const prompt = buildPrompt(data);

  try {
    const response = await axios.post(
      `${API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        ],
      },
      { timeout: 15000 }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty Gemini response');

    // JSONパース
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    const result: GeminiRecommendation = {
      summary:       parsed.summary       || '',
      detoxTips:     parsed.detoxTips     || [],
      runningTip:    parsed.runningTip    || '',
      ratiSuggestion: parsed.ratioSuggestion ?? null,
      ratioReason:   parsed.ratioReason   || '',
      healthScore:   parsed.healthScore   || 50,
      encouragement: parsed.encouragement || '',
    };

    // キャッシュに保存
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(result));
    await AsyncStorage.setItem(CACHE_KEY_DATE, today);

    return result;

  } catch (error: any) {
    console.warn('[Gemini] API error, using fallback:', error.message);
    return getFallbackRecommendation(data);
  }
}

/**
 * プロンプト構築
 */
function buildPrompt(data: WeeklySummary): string {
  return `あなたはスマホ依存症改善コーチです。以下のユーザーデータを分析し、JSON形式でアドバイスを返してください。

## ユーザーデータ（過去7日間）
- 平均スクロール画面数（1日）: ${data.avgDailyScrollScreens.toFixed(0)} 画面
- 平均ランニング距離（1日）: ${data.avgDailyRunMeters.toFixed(0)} m
- 最もスクロールが多い曜日: ${data.worstDayOfWeek}曜日
- 最もランニングをした曜日: ${data.bestDayOfWeek}曜日
- 最多使用アプリ: ${data.topApp}（${data.topAppMinutes.toFixed(0)}分/日）
- 現在の換算比率: 1画面 = ${data.currentMeterPerScreen}m
- 累計スクロール負債: ${data.totalDebtMeters.toFixed(0)}m
- 累計ランニング返済: ${data.totalRunMeters.toFixed(0)}m
- ランニング実施日数: ${data.runDaysCount}日/週
- 連続ランニング日数: ${data.streak}日

## 返答フォーマット（必ずこのJSON形式で返すこと）
{
  "summary": "全体の状況を2〜3文で要約（日本語）",
  "detoxTips": [
    "SNS使用を減らすための具体的アドバイス1",
    "具体的アドバイス2",
    "具体的アドバイス3"
  ],
  "runningTip": "ランニングに関する具体的なアドバイス（1文）",
  "ratioSuggestion": 1.5,  // 推奨換算比率(m/画面)、変更不要なら現在値と同じ数値
  "ratioReason": "換算比率を変更する理由（または維持する理由）",
  "healthScore": 65,  // 0〜100のデジタル健康スコア（整数）
  "encouragement": "励ましのメッセージ（1文、ポジティブに）"
}

必ずJSONのみを返し、他のテキストは含めないでください。`;
}

/**
 * API失敗時のフォールバック（ローカルロジック）
 */
function getFallbackRecommendation(data: WeeklySummary): GeminiRecommendation {
  const repayRate = data.totalRunMeters / Math.max(data.totalDebtMeters, 1);
  const score = Math.min(100, Math.round(
    50 + data.runDaysCount * 5 + Math.min(15, repayRate * 15) -
    (data.avgDailyScrollScreens > 200 ? 15 : data.avgDailyScrollScreens > 100 ? 8 : 0)
  ));

  return {
    summary: `今週は${data.runDaysCount}日間ランニングを行い、平均${data.avgDailyScrollScreens.toFixed(0)}画面のスクロールをしました。`,
    detoxTips: [
      `${data.topApp}の通知をオフにして、意識的な使用を心がけましょう`,
      `${data.worstDayOfWeek}曜日は特にSNSの使用が多い傾向があります。その日にランニングを入れてみましょう`,
      'スマホを机の引き出しに入れる「置くだけデトックス」を試してみてください',
    ],
    runningTip: data.runDaysCount === 0
      ? '今日からでも遅くありません！10分のウォーキングから始めてみましょう'
      : `${data.avgDailyRunMeters.toFixed(0)}mのペースは良好です。週${Math.min(7, data.runDaysCount + 1)}日を目標にしてみましょう`,
    ratiSuggestion: data.currentMeterPerScreen,
    ratioReason: '現在のデータでは換算比率の変更は不要です',
    healthScore: score,
    encouragement: score >= 70
      ? '素晴らしい調子です！この習慣を続けましょう 🌟'
      : '一歩一歩前進しています。今日も走り出しましょう 💪',
  };
}

export { getFallbackRecommendation };
