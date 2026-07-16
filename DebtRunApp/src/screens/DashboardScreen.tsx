/**
 * DashboardScreen.tsx
 * メインダッシュボード — スクロール負債 vs ランニング返済
 * v2: タッチ修正、ランニング開始ボタン追加、UI調整パネル追加
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Animated, Easing, Modal, TextInput, Alert,
  Switch, Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeModules, NativeEventEmitter } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store/useAppStore';
import { saveScrollRecord } from '../services/storageService';
import { COLORS, FONTS, RADIUS } from '../theme';
import DebtRingChart from '../components/DebtRingChart';
import WeekBarChart from '../components/WeekBarChart';
import AppUsageRow from '../components/AppUsageRow';

const { ScrollTracker, UsageStats } = NativeModules;

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const {
    todayScrollScreens, todayScrollMeters, todayRunMeters,
    netDebtMeters, runStreak, todayScrollByApp,
    scrollTrend, runTrend, settings,
    refreshData, refreshScrollData, isLoading, setSettings,
  } = useAppStore();

  const debtAnim = useRef(new Animated.Value(0)).current;
  const [refreshing, setRefreshing] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [mpsInput, setMpsInput] = useState(String(settings.metersPerScreen));

  // スクロールイベントリスナー登録
  useEffect(() => {
    let sub: any;
    (async () => {
      try {
        const isEnabled = await ScrollTracker?.isAccessibilityEnabled();
        if (!isEnabled) return;
        const emitter = new NativeEventEmitter(ScrollTracker);
        sub = emitter.addListener('ScrollTrackerUpdate', async (e: any) => {
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
      } catch (e) {
        console.warn('[Dashboard] Scroll listener error:', e);
      }
    })();
    return () => sub?.remove();
  }, [settings.metersPerScreen]);

  useEffect(() => {
    refreshData();
  }, []);

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

  const saveMps = async () => {
    const val = parseFloat(mpsInput);
    if (isNaN(val) || val <= 0 || val > 100) {
      Alert.alert('無効な値', '0.1〜100 の範囲で入力してください。');
      return;
    }
    await setSettings({ metersPerScreen: val });
    setSettingsVisible(false);
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 120 }}
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

        {/* ── ランニング開始ボタン（ホーム画面） ── */}
        <TouchableOpacity
          style={styles.runBtn}
          activeOpacity={0.82}
          onPress={() => navigation.navigate('Running')}
        >
          <LinearGradient
            colors={[COLORS.purple600, COLORS.blue500]}
            style={styles.runBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.runBtnText}>🏃 ランニングを開始して負債を返済</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── 返済進捗 + リング ── */}
        <View style={styles.ringRow}>
          <DebtRingChart
            percent={repayPercent}
            screens={todayScrollScreens}
            meters={todayScrollMeters}
          />
          <View style={styles.statsRight}>
            <TouchableOpacity
              style={styles.statCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Running')}
            >
              <Text style={styles.statIcon}>🔥</Text>
              <Text style={[styles.statValue, { color: COLORS.orange400 }]}>{runStreak}日</Text>
              <Text style={styles.statLabel}>連続ランニング</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statCard}
              activeOpacity={0.7}
              onPress={() => setSettingsVisible(true)}
            >
              <Text style={styles.statIcon}>📱</Text>
              <Text style={[styles.statValue, { color: COLORS.red400 }]}>
                {todayScrollScreens.toFixed(0)}画面
              </Text>
              <Text style={styles.statLabel}>本日のスクロール</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── UI調整ボタン ── */}
        <TouchableOpacity
          style={styles.adjustBtn}
          activeOpacity={0.75}
          onPress={() => { setMpsInput(String(settings.metersPerScreen)); setSettingsVisible(true); }}
        >
          <Text style={styles.adjustBtnText}>⚙️ UI・換算比率を調整する</Text>
        </TouchableOpacity>

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
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Alert.alert(
                'アクセシビリティ許可が必要です',
                '設定 → アクセシビリティ → DebtRun → オン にすることでスクロール計測が始まります。',
                [{ text: 'OK' }]
              )}
            >
              <Text style={styles.emptyText}>
                まだデータがありません{'\n'}タップして許可の設定方法を確認
              </Text>
            </TouchableOpacity>
          ) : (
            todayScrollByApp.map((record, i) => (
              <AppUsageRow key={i} record={record} />
            ))
          )}
        </View>
      </ScrollView>

      {/* ── UI調整モーダル ── */}
      <Modal
        visible={settingsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSettingsVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>⚙️ UI調整</Text>

            <Text style={styles.settingLabel}>
              スクロール1画面あたりの距離（m）
            </Text>
            <Text style={styles.settingNote}>
              現在: {settings.metersPerScreen}m/画面
              {'\n'}1.0 = 標準　2.0 = 厳しめ　0.5 = ゆるめ
            </Text>
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setMpsInput(String(Math.max(0.1, parseFloat(mpsInput || '1') - 0.1).toFixed(1)))}
              >
                <Text style={styles.stepBtnText}>－</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.mpsInput}
                value={mpsInput}
                onChangeText={setMpsInput}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setMpsInput(String(Math.min(100, parseFloat(mpsInput || '1') + 0.1).toFixed(1)))}
              >
                <Text style={styles.stepBtnText}>＋</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.settingLabel, { marginTop: 20 }]}>体重（カロリー計算用）</Text>
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setSettings({ weightKg: Math.max(30, settings.weightKg - 1) })}
              >
                <Text style={styles.stepBtnText}>－</Text>
              </TouchableOpacity>
              <Text style={styles.weightDisplay}>{settings.weightKg} kg</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setSettings({ weightKg: Math.min(200, settings.weightKg + 1) })}
              >
                <Text style={styles.stepBtnText}>＋</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={saveMps}>
              <Text style={styles.saveBtnText}>保存して閉じる</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navToSettings}
              onPress={() => { setSettingsVisible(false); navigation.navigate('Settings'); }}
            >
              <Text style={styles.navToSettingsText}>📋 全設定（通知・APIキー等）を開く →</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary, padding: 16 },

  heroCard: {
    borderRadius: RADIUS.xl,
    padding: 28,
    marginBottom: 14,
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

  // ランニング開始ボタン
  runBtn: { marginBottom: 14, borderRadius: RADIUS.lg, overflow: 'hidden' },
  runBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  runBtnText: { color: 'white', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  ringRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
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

  // UI調整ボタン
  adjustBtn: {
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
  },
  adjustBtnText: { color: COLORS.purple400, fontSize: 13, fontWeight: '700' },

  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  cardTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },

  chartLegend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: COLORS.textMuted },

  emptyText: { color: COLORS.textMuted, textAlign: 'center', fontSize: 13, lineHeight: 22, paddingVertical: 20 },

  // モーダル
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#13132a',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: COLORS.textPrimary, marginBottom: 20, fontFamily: FONTS.grotesk },

  settingLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '700', marginBottom: 6 },
  settingNote: { fontSize: 12, color: COLORS.textMuted, lineHeight: 18, marginBottom: 12 },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: {
    width: 44, height: 44,
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
  },
  stepBtnText: { color: COLORS.purple400, fontSize: 22, fontWeight: '700' },
  mpsInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  weightDisplay: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    fontFamily: FONTS.grotesk,
  },

  saveBtn: {
    marginTop: 24,
    backgroundColor: COLORS.purple600,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },

  navToSettings: { marginTop: 12, alignItems: 'center', paddingVertical: 8 },
  navToSettingsText: { color: COLORS.textMuted, fontSize: 13 },
});
