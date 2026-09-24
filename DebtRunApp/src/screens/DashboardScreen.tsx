/**
 * DashboardScreen.tsx
 * メインダッシュボード — スクロール負債(前日からの繰り越し込み) vs ランニング返済
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Modal, TextInput, Alert, AppState,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store/useAppStore';
import { scrollTracker, usageStats } from '../services/nativeModules';
import { formatDistance, formatScreenTime } from '../domain/format';
import { COLORS, FONTS, RADIUS } from '../theme';
import DebtRingChart from '../components/DebtRingChart';
import WeekBarChart from '../components/WeekBarChart';
import AppUsageRow from '../components/AppUsageRow';

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { dashboard, permissions, settings, refreshData, setSettings, openSummary } = useAppStore();
  const {
    todayScreens, todayScrollMeters, todayRunMeters, debtMeters, carriedOverMeters,
    todayRepayRatio, streak, week, apps, screenTimeTodayMs, snsTimeTodayMs,
  } = dashboard;

  const [refreshing, setRefreshing] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [mpsInput, setMpsInput] = useState(String(settings.metersPerScreen));

  // スクロールが記録されたら(アプリ起動中のみ)画面を更新する。
  // 他のアプリや設定画面から戻ってきたときも読み直す(その間の記録はネイティブ側に保存されている)
  useEffect(() => {
    refreshData();
    const scrollSub = scrollTracker.onUpdate(() => {
      // 他のアプリでスクロールしている間(このアプリが背面)は読み直さない。前面に戻ったときにまとめて読む
      if (AppState.currentState === 'active') refreshData();
    });
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') refreshData();
    });
    return () => {
      scrollSub.remove();
      appStateSub.remove();
    };
  }, [refreshData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const isBalanced = debtMeters <= 0 && todayRunMeters > 0;
  const debtIsKm = debtMeters >= 1000;

  const saveMps = async () => {
    const val = parseFloat(mpsInput);
    if (isNaN(val) || val <= 0 || val > 100) {
      Alert.alert('無効な値', '0.1〜100 の範囲で入力してください。');
      return;
    }
    await setSettings({ metersPerScreen: Math.round(val * 10) / 10 });
    setSettingsVisible(false);
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.purple400} />
        }
      >
        {/* ── 計測がオフのときの案内 ── */}
        {!permissions.scrollTracking && (
          <PermissionBanner
            title="スクロール計測がオフです"
            desc="設定 → ユーザー補助(アクセシビリティ) → DebtRun スクロール計測 をオンにすると、SNSや動画アプリのスクロール距離の記録が始まります。"
            onPress={() => scrollTracker.openSettings()}
          />
        )}
        {!permissions.usageAccess && (
          <PermissionBanner
            title="スクリーンタイムを記録しましょう"
            desc="「使用状況へのアクセス」で DebtRun を許可すると、アプリ別の使用時間も記録します。"
            onPress={() => usageStats.openSettings()}
          />
        )}

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
          <Text style={[styles.heroValue, debtMeters <= 0 && styles.heroValueGreen]}>
            {debtIsKm ? (debtMeters / 1000).toFixed(2) : Math.round(debtMeters)}
          </Text>
          <Text style={styles.heroUnit}>{debtIsKm ? 'km 残債' : 'm 残債'}</Text>

          {isBalanced && (
            <View style={styles.completedBadge}>
              <Text style={styles.completedText}>✅ 負債完済!</Text>
            </View>
          )}
          {carriedOverMeters > 0 && (
            <Text style={styles.carriedText}>うち前日からの繰り越し {formatDistance(carriedOverMeters)}</Text>
          )}

          <View style={styles.heroBreakdown}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>📲 今日のスクロール</Text>
              <Text style={[styles.breakdownVal, { color: COLORS.red400 }]}>{formatDistance(todayScrollMeters)}</Text>
            </View>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>🏃 今日のランニング</Text>
              <Text style={[styles.breakdownVal, { color: COLORS.green400 }]}>{formatDistance(todayRunMeters)}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── ランニング開始ボタン ── */}
        <TouchableOpacity style={styles.runBtn} activeOpacity={0.82} onPress={() => navigation.navigate('Running')}>
          <LinearGradient
            colors={[COLORS.purple600, COLORS.blue500]}
            style={styles.runBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.runBtnText}>🏃 ランニングを開始して負債を返済</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── 今日の返済率 + 統計 ── */}
        <View style={styles.ringRow}>
          <DebtRingChart percent={todayRepayRatio} screens={todayScreens} />
          <View style={styles.statsRight}>
            <TouchableOpacity style={styles.statCard} activeOpacity={0.7} onPress={() => navigation.navigate('Running')}>
              <Text style={styles.statIcon}>🔥</Text>
              <Text style={[styles.statValue, { color: COLORS.orange400 }]}>{streak}日</Text>
              <Text style={styles.statLabel}>連続ランニング</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statCard}
              activeOpacity={0.7}
              onPress={() => (screenTimeTodayMs === null ? usageStats.openSettings() : openSummary())}
            >
              <Text style={styles.statIcon}>⏱️</Text>
              <Text style={[styles.statValue, { color: COLORS.red400 }]}>
                {screenTimeTodayMs === null ? '--' : formatScreenTime(screenTimeTodayMs)}
              </Text>
              <Text style={styles.statLabel}>
                今日のスクリーンタイム{snsTimeTodayMs !== null ? `\n(SNS・動画 ${formatScreenTime(snsTimeTodayMs)})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── まとめ・換算比率 ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.adjustBtn, { flex: 1 }]} activeOpacity={0.75} onPress={openSummary}>
            <Text style={styles.adjustBtnText}>📊 今日のまとめ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.adjustBtn, { flex: 1 }]}
            activeOpacity={0.75}
            onPress={() => { setMpsInput(String(settings.metersPerScreen)); setSettingsVisible(true); }}
          >
            <Text style={styles.adjustBtnText}>⚙️ 1画面 = {settings.metersPerScreen}m</Text>
          </TouchableOpacity>
        </View>

        {/* ── 週間グラフ ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>週間トレンド</Text>
          <WeekBarChart data={week} />
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

        {/* ── アプリ別 ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📱 今日のアプリ別</Text>
          {apps.length === 0 ? (
            <Text style={styles.emptyText}>
              {permissions.scrollTracking
                ? 'まだ今日の記録がありません'
                : 'スクロール計測をオンにすると、ここにアプリ別の記録が表示されます'}
            </Text>
          ) : (
            apps.map(record => <AppUsageRow key={record.appName} record={record} />)
          )}
        </View>
      </ScrollView>

      {/* ── 換算比率・体重の調整 ── */}
      <Modal
        visible={settingsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSettingsVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>⚙️ 換算比率の調整</Text>

            <Text style={styles.settingLabel}>スクロール1画面あたりの距離(m)</Text>
            <Text style={styles.settingNote}>
              現在: {settings.metersPerScreen}m/画面(過去の記録も新しい比率で計算し直します)
              {'\n'}1.0 = 標準　2.0 = 厳しめ　0.5 = ゆるめ。「AI提案」でおすすめの値も確認できます
            </Text>
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setMpsInput((Math.max(0.1, (parseFloat(mpsInput) || 1) - 0.1)).toFixed(1))}
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
                onPress={() => setMpsInput((Math.min(100, (parseFloat(mpsInput) || 1) + 0.1)).toFixed(1))}
              >
                <Text style={styles.stepBtnText}>＋</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.settingLabel, { marginTop: 20 }]}>体重(カロリー計算用)</Text>
            <View style={styles.inputRow}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setSettings({ weightKg: Math.max(30, settings.weightKg - 1) })}>
                <Text style={styles.stepBtnText}>－</Text>
              </TouchableOpacity>
              <Text style={styles.weightDisplay}>{settings.weightKg} kg</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setSettings({ weightKg: Math.min(200, settings.weightKg + 1) })}>
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
              <Text style={styles.navToSettingsText}>📋 全設定(通知・APIキー等)を開く →</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function PermissionBanner({ title, desc, onPress }: { title: string; desc: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.banner} activeOpacity={0.8} onPress={onPress}>
      <Text style={styles.bannerTitle}>⚠️ {title}</Text>
      <Text style={styles.bannerDesc}>{desc}</Text>
      <Text style={styles.bannerAction}>タップして設定を開く →</Text>
    </TouchableOpacity>
  );
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

  carriedText: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 12 },

  banner: {
    backgroundColor: 'rgba(250,204,21,0.08)',
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.3)',
  },
  bannerTitle: { color: COLORS.yellow400, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  bannerDesc: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 },
  bannerAction: { color: COLORS.yellow400, fontSize: 12, fontWeight: '700', marginTop: 6 },

  actionRow: { flexDirection: 'row', gap: 10 },

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
