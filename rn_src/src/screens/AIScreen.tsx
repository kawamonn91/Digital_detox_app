/**
 * AIScreen.tsx
 * Gemini AIレコメンド画面
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAppStore } from '../store/useAppStore';
import { getDailyScrollTotals, getDailyRunTotals, getRunStreak } from '../services/storageService';
import { getGeminiRecommendation, WeeklySummary, GeminiRecommendation } from '../services/geminiService';
import { COLORS, FONTS, RADIUS } from '../theme';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export default function AIScreen() {
  const { settings, setSettings } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [rec, setRec] = useState<GeminiRecommendation | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    loadRecommendation();
  }, []);

  const buildWeeklySummary = async (): Promise<WeeklySummary> => {
    const [scrollData, runData, streak] = await Promise.all([
      getDailyScrollTotals(7),
      getDailyRunTotals(7),
      getRunStreak(),
    ]);

    const avgScreens = scrollData.length
      ? scrollData.reduce((s, d) => s + (d.screens || 0), 0) / scrollData.length
      : 0;
    const avgRunMeters = runData.length
      ? runData.reduce((s, d) => s + d.meters, 0) / runData.length
      : 0;

    // 最もスクロールが多い/少ない曜日
    const scrollByDay = scrollData.map(d => ({
      day: WEEKDAYS[new Date(d.date).getDay()],
      screens: d.screens || 0,
    }));
    const worstDay = scrollByDay.reduce((max, d) => d.screens > max.screens ? d : max, scrollByDay[0] || { day: '不明', screens: 0 });
    const bestRunDay = runData.reduce((max: any, d: any) => d.meters > (max?.meters || 0) ? d : max, null);

    return {
      avgDailyScrollScreens: avgScreens,
      avgDailyRunMeters: avgRunMeters,
      worstDayOfWeek: worstDay.day,
      bestDayOfWeek: bestRunDay ? WEEKDAYS[new Date(bestRunDay.date).getDay()] : '記録なし',
      topApp: 'Instagram',   // TODO: UsageStats から取得
      topAppMinutes: 0,
      currentMeterPerScreen: settings.metersPerScreen,
      totalDebtMeters: scrollData.reduce((s, d) => s + (d.meters || 0), 0),
      totalRunMeters: runData.reduce((s, d) => s + d.meters, 0),
      runDaysCount: runData.filter(d => d.meters > 0).length,
      streak,
    };
  };

  const loadRecommendation = async () => {
    if (!settings.geminiApiKey) {
      // APIキー未設定 → フォールバック
      const summary = await buildWeeklySummary();
      const { getFallbackRecommendation } = await import('../services/geminiService');
      setRec(getFallbackRecommendation(summary));
      setLastUpdated(new Date().toLocaleTimeString('ja-JP'));
      return;
    }

    setLoading(true);
    try {
      const summary = await buildWeeklySummary();
      const result = await getGeminiRecommendation(summary, settings.geminiApiKey);
      setRec(result);
      setLastUpdated(new Date().toLocaleTimeString('ja-JP'));
    } catch (e) {
      Alert.alert('エラー', 'AIレコメンドの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const applyRatioSuggestion = () => {
    if (!rec?.ratiSuggestion) return;
    Alert.alert(
      '換算比率を更新',
      `1画面 = ${rec.ratiSuggestion}m に変更しますか？\n\n理由: ${rec.ratioReason}`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '適用', onPress: () => setSettings({ metersPerScreen: rec.ratiSuggestion! }) },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── ヘッダー ── */}
      <LinearGradient
        colors={['rgba(124,58,237,0.15)', 'rgba(59,130,246,0.1)']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>✨ Gemini AI</Text>
        </View>
        <Text style={styles.headerTitle}>AIレコメンド</Text>
        <Text style={styles.headerSub}>あなたのデータをもとにパーソナライズドアドバイスを提供</Text>
        {lastUpdated && (
          <Text style={styles.lastUpdated}>最終更新: {lastUpdated}</Text>
        )}
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.purple400} />
          <Text style={styles.loadingText}>Geminiが分析中...</Text>
        </View>
      ) : rec ? (
        <>
          {/* ── 健康スコア ── */}
          <View style={styles.scoreCard}>
            <Text style={styles.cardTitle}>💯 デジタル健康スコア</Text>
            <View style={styles.scoreRow}>
              <Text style={[
                styles.scoreValue,
                { color: rec.healthScore >= 70 ? COLORS.green400 : rec.healthScore >= 50 ? COLORS.yellow400 : COLORS.red400 }
              ]}>
                {rec.healthScore}
              </Text>
              <Text style={styles.scoreMax}>/100</Text>
            </View>
            <View style={styles.scoreTrack}>
              <LinearGradient
                colors={rec.healthScore >= 70
                  ? [COLORS.green400, '#06b6d4']
                  : rec.healthScore >= 50
                  ? [COLORS.yellow400, COLORS.orange400]
                  : [COLORS.red400, '#f97316']}
                style={[styles.scoreFill, { width: `${rec.healthScore}%` }]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              />
            </View>
            <Text style={styles.encouragement}>{rec.encouragement}</Text>
          </View>

          {/* ── サマリー ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📊 今週のまとめ</Text>
            <Text style={styles.bodyText}>{rec.summary}</Text>
          </View>

          {/* ── デトックスTips ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>💡 デトックスのコツ</Text>
            {rec.detoxTips.map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={styles.tipDot} />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>

          {/* ── ランニングTip ── */}
          <LinearGradient
            colors={['rgba(34,197,94,0.12)', 'rgba(6,182,212,0.08)']}
            style={styles.runTipCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.cardTitle}>🏃 ランニングアドバイス</Text>
            <Text style={styles.bodyText}>{rec.runningTip}</Text>
          </LinearGradient>

          {/* ── 換算比率提案 ── */}
          {rec.ratiSuggestion !== null &&
           rec.ratiSuggestion !== settings.metersPerScreen && (
            <View style={styles.ratioCard}>
              <Text style={styles.cardTitle}>⚙️ 換算比率の提案</Text>
              <View style={styles.ratioRow}>
                <View style={styles.ratioBox}>
                  <Text style={styles.ratioLabel}>現在</Text>
                  <Text style={styles.ratioValue}>{settings.metersPerScreen}m</Text>
                </View>
                <Text style={styles.ratioArrow}>→</Text>
                <View style={[styles.ratioBox, styles.ratioBoxNew]}>
                  <Text style={styles.ratioLabel}>提案</Text>
                  <Text style={[styles.ratioValue, { color: COLORS.purple400 }]}>
                    {rec.ratiSuggestion}m
                  </Text>
                </View>
              </View>
              <Text style={styles.ratioReason}>{rec.ratioReason}</Text>
              <TouchableOpacity style={styles.applyBtn} onPress={applyRatioSuggestion}>
                <Text style={styles.applyBtnText}>提案を適用する</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🤖</Text>
          <Text style={styles.emptyText}>データが集まると{'\n'}AIアドバイスが表示されます</Text>
        </View>
      )}

      {/* ── 更新ボタン ── */}
      <TouchableOpacity
        style={styles.refreshBtn}
        onPress={loadRecommendation}
        disabled={loading}
      >
        <LinearGradient
          colors={[COLORS.purple600, COLORS.blue500]}
          style={styles.refreshBtnGrad}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        >
          <Text style={styles.refreshBtnText}>
            {loading ? '分析中...' : '🔄 AIに再分析してもらう'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      {!settings.geminiApiKey && (
        <Text style={styles.apiKeyNote}>
          ※ Gemini APIキーを設定すると、より高度なAI分析が利用できます（設定画面）
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary, padding: 16 },

  header: {
    borderRadius: RADIUS.xl,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
  },
  aiBadge: {
    backgroundColor: 'rgba(124,58,237,0.3)',
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 100, alignSelf: 'flex-start', marginBottom: 12,
  },
  aiBadgeText: { color: COLORS.purple400, fontSize: 11, fontWeight: '700' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: COLORS.textPrimary, fontFamily: FONTS.grotesk, marginBottom: 6 },
  headerSub: { fontSize: 13, color: COLORS.textSecondary },
  lastUpdated: { fontSize: 11, color: COLORS.textMuted, marginTop: 8 },

  loadingBox: { alignItems: 'center', paddingVertical: 60, gap: 16 },
  loadingText: { color: COLORS.textSecondary, fontSize: 14 },

  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  cardTitle: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  bodyText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },

  scoreCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  scoreValue: { fontSize: 56, fontWeight: '900', fontFamily: FONTS.grotesk, lineHeight: 60 },
  scoreMax: { fontSize: 20, color: COLORS.textMuted, marginBottom: 8, marginLeft: 4 },
  scoreTrack: {
    height: 10, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 100, overflow: 'hidden', marginBottom: 14,
  },
  scoreFill: { height: '100%', borderRadius: 100 },
  encouragement: { fontSize: 14, color: COLORS.textPrimary, fontStyle: 'italic' },

  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.purple400, marginTop: 6 },
  tipText: { flex: 1, fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },

  runTipCard: {
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },

  ratioCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
  },
  ratioRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 12 },
  ratioBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.md,
    padding: 16,
    minWidth: 80,
  },
  ratioBoxNew: { backgroundColor: 'rgba(124,58,237,0.1)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' },
  ratioLabel: { fontSize: 11, color: COLORS.textMuted, marginBottom: 4 },
  ratioValue: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, fontFamily: FONTS.grotesk },
  ratioArrow: { fontSize: 24, color: COLORS.textMuted },
  ratioReason: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 14 },
  applyBtn: {
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderRadius: RADIUS.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
  },
  applyBtnText: { color: COLORS.purple400, fontWeight: '700', fontSize: 14 },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { color: COLORS.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 24 },

  refreshBtn: { marginBottom: 14, borderRadius: RADIUS.lg, overflow: 'hidden' },
  refreshBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  refreshBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },

  apiKeyNote: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
});
