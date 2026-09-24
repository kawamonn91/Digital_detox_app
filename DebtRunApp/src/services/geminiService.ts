/**
 * geminiService.ts
 * Gemini API クライアント(AI提案)。
 *
 * 呼び出しは1日1回まで(結果をキャッシュ)。APIキーが無い・失敗した場合は、
 * 同じデータからローカルで作る提案(getFallbackRecommendation)を返す。
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from '../domain/dates';
import { RatioRecommendation } from '../domain/stats';

// gemini-1.5-flash は提供終了したため 2.5 Flash を使う
const GEMINI_MODEL = 'gemini-2.5-flash';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const CACHE_KEY = 'gemini_last_recommendation';
const CACHE_KEY_DATE = 'gemini_last_date';

export interface WeeklySummary {
  avgDailyScrollScreens: number;
  avgDailyRunMeters: number;
  worstDayOfWeek: string;
  bestDayOfWeek: string;
  /** 最も長く使った対象アプリ。使用状況へのアクセスが未許可なら null */
  topApp: string | null;
  topAppMinutes: number;
  /** 1日平均のスクリーンタイム(全アプリ合計、分)。未許可なら null */
  avgScreenTimeMinutes: number | null;
  currentMeterPerScreen: number;
  /** データから計算した換算比率のおすすめ(記録が少なければ null) */
  ratioBaseline: RatioRecommendation | null;
  /** 現在の残債(繰り越し込み) */
  currentDebtMeters: number;
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
  force = false,
): Promise<GeminiRecommendation> {

  // 同日にすでに呼び出した場合はキャッシュを返す([force] で再分析)
  const today = localDateKey();
  const lastDate = await AsyncStorage.getItem(CACHE_KEY_DATE);
  if (!force && lastDate === today) {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  }

  const prompt = buildPrompt(data);

  try {
    const response = await axios.post(
      `${API_BASE}/${GEMINI_MODEL}:generateContent`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          // 2.5 Flash は既定で「思考」に出力トークンを使い、JSON が途中で切れることがあるため無効にする
          thinkingConfig: { thinkingBudget: 0 },
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        ],
      },
      // APIキーはURLに載せず(ログに残りやすいため)ヘッダーで渡す
      { timeout: 30000, headers: { 'x-goog-api-key': apiKey } }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty Gemini response');

    // JSONパース
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    const result: GeminiRecommendation = {
      summary:       parsed.summary       || '',
      detoxTips:     parsed.detoxTips     || [],
      runningTip:    parsed.runningTip    || '',
      ratiSuggestion: sanitizeRatio(parsed.ratioSuggestion) ?? data.ratioBaseline?.metersPerScreen ?? null,
      ratioReason:   parsed.ratioReason   || data.ratioBaseline?.reason || '',
      healthScore:   Math.min(100, Math.max(0, Math.round(Number(parsed.healthScore) || 50))),
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
- 最もスクロールが多い曜日: ${withWeekdaySuffix(data.worstDayOfWeek)}
- 最もランニングをした曜日: ${withWeekdaySuffix(data.bestDayOfWeek)}
- 1日平均のスクリーンタイム(全アプリ): ${data.avgScreenTimeMinutes !== null ? `${data.avgScreenTimeMinutes.toFixed(0)}分` : '不明(使用時間の取得が未許可)'}
- 最多使用アプリ: ${data.topApp ? `${data.topApp}(${data.topAppMinutes.toFixed(0)}分/日)` : '不明(使用時間の取得が未許可)'}
- 現在の換算比率: 1画面 = ${data.currentMeterPerScreen}m
- 7日間のスクロール負債: ${data.totalDebtMeters.toFixed(0)}m
- 7日間のランニング返済: ${data.totalRunMeters.toFixed(0)}m
- 現在の残債(前日からの繰り越し込み): ${data.currentDebtMeters.toFixed(0)}m
- データから計算した換算比率の目安: ${data.ratioBaseline ? `1画面 = ${data.ratioBaseline.metersPerScreen}m(1日${data.ratioBaseline.targetDailyMeters}mで返せる比率)` : 'スクロールの記録が少なく計算できない'}
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
  "ratioSuggestion": 1.5,  // 推奨換算比率(m/画面、0.1〜10)。上の目安を基準に、続けやすさを考えて調整。変更不要なら現在値と同じ数値
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
  const score = Math.min(100, Math.max(0, Math.round(
    50 + data.runDaysCount * 5 + Math.min(15, repayRate * 15) -
    (data.avgDailyScrollScreens > 200 ? 15 : data.avgDailyScrollScreens > 100 ? 8 : 0)
  )));

  return {
    summary: `今週は${data.runDaysCount}日ランニングし、1日平均${data.avgDailyScrollScreens.toFixed(0)}画面スクロールしました。`,
    detoxTips: [
      data.topApp
        ? `いちばん長く使っている${data.topApp}(1日約${data.topAppMinutes.toFixed(0)}分)の通知をオフにして、開く回数を減らしましょう`
        : 'SNSや動画アプリの通知をオフにして、開く回数を減らしましょう',
      WEEKDAY_LABELS.includes(data.worstDayOfWeek)
        ? `${data.worstDayOfWeek}曜日は特にスクロールが多い傾向があります。その日にランニングを入れてみましょう`
        : '寝る前の30分はスマホを見ない時間にしてみましょう',
      'スマホを机の引き出しに入れる「置くだけデトックス」を試してみてください',
    ],
    runningTip: data.runDaysCount === 0
      ? '今日からでも遅くありません!10分のウォーキングから始めてみましょう'
      : `1日平均${data.avgDailyRunMeters.toFixed(0)}mのペースは良好です。週${Math.min(7, data.runDaysCount + 1)}日を目標にしてみましょう`,
    ratiSuggestion: data.ratioBaseline?.metersPerScreen ?? data.currentMeterPerScreen,
    ratioReason: data.ratioBaseline?.reason ?? 'スクロールの記録がまだ少ないため、今の換算比率のままで様子を見ましょう',
    healthScore: score,
    encouragement: score >= 70
      ? '素晴らしい調子です!この習慣を続けましょう 🌟'
      : '一歩一歩前進しています。今日も走り出しましょう 💪',
  };
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

/** 「月」→「月曜日」。記録がない場合の「不明」「記録なし」はそのまま */
function withWeekdaySuffix(day: string): string {
  return WEEKDAY_LABELS.includes(day) ? `${day}曜日` : day;
}

/** Gemini の提案値を 0.1〜10m・0.1刻みにそろえる。数値でなければ null */
function sanitizeRatio(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(10, Math.max(0.1, Math.round(n * 10) / 10));
}

export { getFallbackRecommendation };
