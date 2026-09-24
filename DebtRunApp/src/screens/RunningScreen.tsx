/**
 * RunningScreen.tsx
 * GPSランニング計測。走った距離がそのままスクロール負債の返済になる。
 * 計測中は前面サービス(常駐通知)を出すので、画面を消しても計測が続く。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Vibration, ScrollView, PermissionsAndroid, Platform,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useAppStore } from '../store/useAppStore';
import { deleteRun, getRecentRuns, saveRunRecord, SavedRun } from '../services/storageService';
import { startRunForeground, stopRunForeground, updateRunForeground } from '../services/runForeground';
import { formatDistance, formatDuration, formatPace } from '../domain/format';
import { MAX_ACCURACY_METERS, paceMinPerKm, runCalories, segmentDistance } from '../domain/running';
import { COLORS, FONTS, RADIUS } from '../theme';

/** これより短いランニングは記録しない(m) */
const MIN_RUN_METERS = 10;
/** 常駐通知の距離表示を更新する間隔(ms) */
const NOTIFICATION_UPDATE_MS = 10_000;

interface RunState {
  isRunning: boolean;
  elapsed: number;
  totalMeters: number;
}

export default function RunningScreen() {
  const { dashboard, settings, refreshData, setIsRunning } = useAppStore();
  const debtMeters = dashboard.debtMeters;

  const [run, setRun] = useState<RunState>({ isRunning: false, elapsed: 0, totalMeters: 0 });
  const [recentRuns, setRecentRuns] = useState<SavedRun[]>([]);

  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ lat: number; lon: number; time: number } | null>(null);
  const totalMetersRef = useRef(0);
  const lastNotificationAtRef = useRef(0);

  const loadRecentRuns = useCallback(() => {
    getRecentRuns(5).then(setRecentRuns).catch(() => {});
  }, []);
  useFocusEffect(loadRecentRuns);

  const stopTracking = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (watchIdRef.current !== null) Geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    stopRunForeground().catch(() => {});
  }, []);

  // 画面を離れても計測は続けるが、アプリ自体が終了する(アンマウント)ときは後片付けする
  useEffect(() => stopTracking, [stopTracking]);

  const elapsedSeconds = run.elapsed;
  const pace = paceMinPerKm(run.totalMeters, elapsedSeconds);
  const speedKmh = elapsedSeconds > 0 ? (run.totalMeters / elapsedSeconds) * 3.6 : 0;
  const calories = runCalories(run.totalMeters, settings.weightKg);
  const remainingAfter = Math.max(0, debtMeters - run.totalMeters);

  const startRun = async () => {
    if (!(await requestLocationPermission())) {
      Alert.alert('位置情報が必要です', 'ランニング計測のために位置情報へのアクセスを許可してください。');
      return;
    }

    Vibration.vibrate(100);
    startTimeRef.current = Date.now();
    totalMetersRef.current = 0;
    lastPosRef.current = null;
    lastNotificationAtRef.current = Date.now();
    setRun({ isRunning: true, elapsed: 0, totalMeters: 0 });
    setIsRunning(true);

    try {
      await startRunForeground();
    } catch (e) {
      // 通知が許可されていないなどで前面サービスを出せなくても、画面を開いている間の計測はできる
      console.warn('[Running] foreground service failed:', e);
    }

    watchIdRef.current = Geolocation.watchPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords;
        const next = { lat: latitude, lon: longitude, time: Date.now(), accuracy };
        totalMetersRef.current += segmentDistance(lastPosRef.current, next);
        if (accuracy <= MAX_ACCURACY_METERS) lastPosRef.current = { lat: latitude, lon: longitude, time: next.time };
        setRun(prev => ({ ...prev, totalMeters: totalMetersRef.current }));
        // 常駐通知の距離を更新する。画面を消している間は JS のタイマーが止まるため、測位のたびに間隔を見て更新する
        if (next.time - lastNotificationAtRef.current >= NOTIFICATION_UPDATE_MS) {
          lastNotificationAtRef.current = next.time;
          updateRunForeground(totalMetersRef.current, (next.time - startTimeRef.current) / 1000).catch(() => {});
        }
      },
      error => console.warn('GPS Error:', error.message),
      { enableHighAccuracy: true, distanceFilter: 5, interval: 2000, fastestInterval: 1000 },
    );

    // 経過時間の表示(画面を開いている間だけ動けばよい。時間そのものは開始時刻から計算する)
    timerRef.current = setInterval(() => {
      setRun(prev => ({ ...prev, elapsed: Math.floor((Date.now() - startTimeRef.current) / 1000) }));
    }, 1000);
  };

  const stopRun = async () => {
    Vibration.vibrate([100, 50, 100]);
    stopTracking();

    const meters = Math.round(totalMetersRef.current);
    const durationS = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setIsRunning(false);
    setRun(prev => ({ ...prev, isRunning: false }));

    if (meters < MIN_RUN_METERS) {
      Alert.alert('記録しませんでした', `${MIN_RUN_METERS}m以上走ると記録されます。屋外で試してください。`);
      return;
    }
    const finalPace = paceMinPerKm(meters, durationS);
    await saveRunRecord(
      { meters, durationS, paceMinKm: finalPace, calories: runCalories(meters, settings.weightKg) },
      startTimeRef.current,
    );
    await refreshData();
    loadRecentRuns();
    Alert.alert(
      '🏁 ランニング完了!',
      `距離: ${formatDistance(meters)}\n時間: ${formatDuration(durationS)}\nペース: ${formatPace(finalPace)}/km\n\n負債を ${formatDistance(meters)} 返済しました!`,
    );
  };

  const confirmDelete = (r: SavedRun) => {
    Alert.alert('記録を削除', `${r.date} の ${formatDistance(r.meters)} の記録を削除しますか?(負債が戻ります)`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await deleteRun(r.id);
          await refreshData();
          loadRecentRuns();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      {/* ── ランニングカード ── */}
      <LinearGradient
        colors={run.isRunning
          ? ['rgba(34,197,94,0.18)', 'rgba(6,182,212,0.12)']
          : ['rgba(59,130,246,0.12)', 'rgba(124,58,237,0.12)']}
        style={[styles.runCard, run.isRunning && styles.runCardActive]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.runIcon}>{run.isRunning ? '🏃' : '👟'}</Text>
        <Text style={styles.timer}>{formatDuration(run.elapsed)}</Text>
        <Text style={styles.distanceBig}>{formatDistance(run.totalMeters)}</Text>
        {run.isRunning && <Text style={styles.statusText}>GPS計測中(画面を消しても計測を続けます)</Text>}
      </LinearGradient>

      {/* ── メトリクス ── */}
      <View style={styles.metricsRow}>
        <MetricCard label="ペース" value={formatPace(pace)} unit="分/km" />
        <MetricCard label="速度" value={speedKmh.toFixed(1)} unit="km/h" />
        <MetricCard label="カロリー" value={Math.round(calories).toString()} unit="kcal" />
      </View>

      {/* ── 負債返済プレビュー ── */}
      <View style={styles.debtPreview}>
        <Text style={styles.previewIcon}>⚡</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.previewLabel}>このランニングで返済</Text>
          <Text style={styles.previewValue}>
            {formatDistance(run.totalMeters)}
            <Text style={styles.previewRemain}> → 残 {formatDistance(remainingAfter)}</Text>
          </Text>
        </View>
      </View>

      {/* ── スタート/ストップ ── */}
      <TouchableOpacity style={styles.ctaBtn} onPress={run.isRunning ? stopRun : startRun} activeOpacity={0.85}>
        <LinearGradient
          colors={run.isRunning ? [COLORS.red400, '#f97316'] : [COLORS.purple600, COLORS.blue500]}
          style={styles.ctaBtnGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.ctaBtnText}>{run.isRunning ? '⏹ ストップ' : '▶ ランニング開始'}</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── 目標 ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎯 返済目標</Text>
        <Text style={styles.goalText}>
          {debtMeters > 0 ? (
            <>
              残負債 <Text style={{ color: COLORS.red400, fontWeight: '700' }}>{formatDistance(debtMeters)}</Text> を返済するために走ろう!
            </>
          ) : (
            '負債はありません。走った分は今日のスクロールへの備えになります'
          )}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${debtMeters > 0 ? Math.min(100, (run.totalMeters / debtMeters) * 100) : 100}%` }]}
          />
        </View>
      </View>

      {/* ── 最近の記録 ── */}
      {recentRuns.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📝 最近のランニング</Text>
          {recentRuns.map(r => (
            <TouchableOpacity key={r.id} style={styles.historyRow} onLongPress={() => confirmDelete(r)}>
              <Text style={styles.historyDate}>{r.date}</Text>
              <Text style={styles.historyValue}>{formatDistance(r.meters)}</Text>
              <Text style={styles.historySub}>{formatDuration(r.durationS)} ・ {formatPace(r.paceMinKm)}/km</Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.historyHint}>長押しで記録を削除できます</Text>
        </View>
      )}
    </ScrollView>
  );
}

function MetricCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricUnit}>{unit}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ]);
  return result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary, padding: 16 },

  runCard: {
    borderRadius: RADIUS.xl,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  runCardActive: {
    borderColor: 'rgba(34,197,94,0.3)',
  },
  runIcon: { fontSize: 56, marginBottom: 12 },
  timer: {
    fontSize: 52,
    fontWeight: '900',
    color: COLORS.textPrimary,
    fontFamily: FONTS.grotesk,
    letterSpacing: -2,
    lineHeight: 60,
  },
  distanceBig: { fontSize: 32, fontWeight: '700', color: COLORS.green400, fontFamily: FONTS.grotesk },
  statusText: { fontSize: 12, color: COLORS.textMuted, marginTop: 8 },

  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  metricValue: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, fontFamily: FONTS.grotesk },
  metricUnit: { fontSize: 10, color: COLORS.textMuted },
  metricLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase' },

  debtPreview: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  previewIcon: { fontSize: 24 },
  previewLabel: { fontSize: 11, color: COLORS.textMuted },
  previewValue: { fontSize: 18, fontWeight: '700', color: COLORS.green400, fontFamily: FONTS.grotesk },
  previewRemain: { fontSize: 14, color: COLORS.textSecondary },

  ctaBtn: { marginBottom: 16, borderRadius: RADIUS.lg, overflow: 'hidden' },
  ctaBtnStop: {},
  ctaBtnGrad: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  ctaBtnText: { fontSize: 17, fontWeight: '800', color: 'white', letterSpacing: 0.5 },

  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  cardTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  goalText: { fontSize: 15, color: COLORS.textPrimary, marginBottom: 12 },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 100,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 100,
    backgroundColor: COLORS.green400,
  },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  historyDate: { fontSize: 12, color: COLORS.textMuted, width: 84 },
  historyValue: { fontSize: 15, fontWeight: '800', color: COLORS.green400, fontFamily: FONTS.grotesk },
  historySub: { flex: 1, fontSize: 11, color: COLORS.textSecondary, textAlign: 'right' },
  historyHint: { fontSize: 10, color: COLORS.textMuted, marginTop: 8, textAlign: 'right' },
});
