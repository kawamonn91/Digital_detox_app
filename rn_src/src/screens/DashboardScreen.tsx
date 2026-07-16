/**
 * DashboardScreen.tsx
 * メインダッシュボード — スクロール負債 vs ランニング返済
 */

import React, { useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Animated, Easing, Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeModules, NativeEventEmitter } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { saveScrollRecord } from '../services/storageService';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../theme';
import DebtRingChart from '../components/DebtRingChart';
import WeekBarChart from '../components/WeekBarChart';
import AppUsageRow from '../components/AppUsageRow';

const { ScrollTracker, UsageStats } = NativeModules;
const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const {
    todayScrollScreens, todayScrollMeters, todayRunMeters,
    netDebtMeters, runStreak, todayScrollByApp,
    scrollTrend, runTrend, settings,
    refreshData, refreshScrollData, isLoading,
  } = useAppStore();

  const debtAnim = useRef(new Animated.Value(0)).current;
  const [refreshing, setRefreshing] = React.useState(false);

  // スクロールイベントリスナー登録
  useEffect(() => {
    let emitter: any;
    (async () => {
      try {
        const isEnabled = await ScrollTracker?.isAccessibilityEnabled();
        if (!isEnabled) return;

        emitter = new NativeEventEmitter(ScrollTracker);
        const sub = emitter.addListener('ScrollTrackerUpdate', async (e: any) => {
          const screenHeightPx: number = e.screenHeightPx || 1920;
          const deltaPx: number = e.deltaPx || 0;
          const deltaScreens = deltaPx / screenHeightPx;
          const deltaMeters  = deltaScreens * settings.metersPerScreen;

          if (deltaScreens > 0.001) {
            await saveScrollRecord({
              packageName: e.packageName,
              appName: e.appName,
              totalPx: deltaPx,
              screens: deltaScreens,
              meters: deltaMeters,
              source: 'auto',
            });
            refreshScrollData();
          }
        });
        return () => sub.remove();
      } catch (e) {
        console.warn('[Dashboard] Scroll listener error:', e);
      }
    })();
  }, [settings.metersPerScreen]);

  // 初回読み込み & UsageStats同期
  useEffect(() => {
    refreshData();
    syncUsageStats();
  }, []);

  // UsageStatsから自動同期（5分ごと）
  const syncUsageStats = async () => {
    try {
      const hasPermission = await UsageStats?.hasUsagePermission();
      if (!hasPermission) return;
      // 直近1時間のデータを取得して保存は省略（AccessibilityServiceが常時記録）
    } catch (e) {
      console.warn('[Dashboard] UsageStats sync error:', e);
    }
  };

  // 負債アニメーション
  useEffect(() => {
    Animated.timing(debtAnim, {
      toValue: netDebtMeters,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [netDebtMeters]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, []);

  const repayPercent = todayScrollMeters > 0
    ? Math.min(1, todayRunMeters / todayScrollMeters)
    : 0;

  const isBalanced = netDebtMeters === 0 && todayRunMeters > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.purple400}
        />
      }
    >
      {/* ── ヒーロー負債カード ── */}
      <LinearGradient
        colors={isBalanced
          ? ['rgba(34,197,94,0.18)', 'rgba(6,182,212,0.12)']
          : ['rgba(239,68,68,0.18)', 'rgba(249,115,22,0.12)']}
        style={[styles.heroCard, isBalanced && styles.heroCardBalanced]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.heroLabel}>スクロール負債</Text>

        <Animated.Text style={[styles.heroValue, isBalanced && styles.heroValueGreen]}>
          {netDebtMeters >= 1000
            ? `${(netDebtMeters / 1000).toFixed(2)}`
            : `${Math.round(netDebtMeters)}`}
        </Animated.Text>
        <Text style={styles.heroUnit}>
          {netDebtMeters >= 1000 ? 'km 残債' : 'm 残債'}
        </Text>

        {isBalanced && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>✅ 今日の負債完済！</Text>
          </View>
        )}

        <View style={styles.heroBreakdown}>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>📲 スクロール</Text>
            <Text style={[styles.breakdownVal, { color: COLORS.red400 }]}>
              {formatDistance(todayScrollMeters)}
            </Text>
          </View>
          <View style={styles.breakdownDivider} />
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>🏃 ランニング</Text>
            <Text style={[styles.breakdownVal, { color: COLORS.green400 }]}>
              {formatDistance(todayRunMeters)}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── 返済進捗 + リング ── */}
      <View style={styles.ringRow}>
        <DebtRingChart
          percent={repayPercent}
          screens={todayScrollScreens}
          meters={todayScrollMeters}
        />
        <View style={styles.statsRight}>
          <StatCard icon="🔥" value={`${runStreak}日`} label="連続ランニング" color={COLORS.orange400} />
          <StatCard
            icon="📱"
            value={`${todayScrollScreens.toFixed(0)}画面`}
            label="本日のスクロール"
            color={COLORS.red400}
          />
        </View>
      </View>

      {/* ── 週間グラフ ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>週間トレンド</Text>
        <WeekBarChart scrollData={scrollTrend} runData={runTrend} />
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.red400 }]} />
            <Text style={styles.legendText}>スクロール負債</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.green400 }]} />
            <Text style={styles.legendText}>ランニング返済</Text>
          </View>
        </View>
      </View>

      {/* ── アプリ別使用状況 ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📱 アプリ別スクロール</Text>
        {todayScrollByApp.length === 0 ? (
          <Text style={styles.emptyText}>まだデータがありません{'\n'}アクセシビリティ許可が必要です</Text>
        ) : (
          todayScrollByApp.map((record, i) => (
            <AppUsageRow key={i} record={record} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ── サブコンポーネント ──

function StatCard({ icon, value, label, color }: any) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

// ── スタイル ──

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary, padding: 16 },

  heroCard: {
    borderRadius: RADIUS.xl,
    padding: 28,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  heroCardBalanced: { borderColor: 'rgba(34,197,94,0.25)' },
  heroLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  heroValue: { fontSize: 60, fontWeight: '900', color: COLORS.red400, lineHeight: 66, fontFamily: FONTS.grotesk },
  heroValueGreen: { color: COLORS.green400 },
  heroUnit: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2, marginBottom: 16 },
  completedBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 100, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
  },
  completedText: { color: COLORS.green400, fontSize: 13, fontWeight: '700' },
  heroBreakdown: { flexDirection: 'row', paddingTop: 16, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.07)', width: '100%', justifyContent: 'space-around' },
  breakdownItem: { alignItems: 'center', gap: 4 },
  breakdownDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  breakdownLabel: { fontSize: 11, color: COLORS.textMuted },
  breakdownVal: { fontSize: 18, fontWeight: '800', fontFamily: FONTS.grotesk },

  ringRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statsRight: { flex: 1, gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '800', fontFamily: FONTS.grotesk },
  statLabel: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', marginTop: 2 },

  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  cardTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },

  chartLegend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: COLORS.textMuted },

  emptyText: { color: COLORS.textMuted, textAlign: 'center', fontSize: 13, lineHeight: 20, paddingVertical: 20 },
});
