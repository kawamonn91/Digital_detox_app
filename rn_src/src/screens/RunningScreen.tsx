/**
 * RunningScreen.tsx
 * GPSランニングトラッカー画面
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, Vibration, ScrollView,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../store/useAppStore';
import { saveRunRecord, formatDistance, formatDuration } from '../services/storageService';
import { COLORS, FONTS, RADIUS } from '../theme';

interface RunState {
  isRunning: boolean;
  elapsed: number;       // 秒
  totalMeters: number;
  pace: number;          // 分/km
  speed: number;         // km/h
  calories: number;
  positions: Array<{ lat: number; lon: number }>;
}

export default function RunningScreen() {
  const insets = useSafeAreaInsets();
  const { netDebtMeters, settings, refreshTodayRun, setIsRunning } = useAppStore();

  const [run, setRun] = useState<RunState>({
    isRunning: false, elapsed: 0, totalMeters: 0,
    pace: 0, speed: 0, calories: 0, positions: [],
  });

  const startTimeRef  = useRef<number>(0);
  const timerRef      = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef    = useRef<number | null>(null);
  const lastPosRef    = useRef<{ lat: number; lon: number; time: number } | null>(null);
  const totalMetersRef = useRef(0);
  const positionsRef  = useRef<Array<{ lat: number; lon: number }>>([]);

  // 後払い返済プレビュー
  const debtRepayPreview = run.totalMeters;
  const remainingAfter  = Math.max(0, netDebtMeters - debtRepayPreview);

  useEffect(() => {
    return () => {
      // アンマウント時クリーンアップ
      if (timerRef.current)  clearInterval(timerRef.current);
      if (watchIdRef.current !== null) Geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      const { check, request, PERMISSIONS, RESULTS } = require('react-native-permissions');
      const result = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
      if (result === RESULTS.GRANTED) return true;
      const granted = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
      return granted === RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  const startRun = async () => {
    const granted = await requestLocationPermission();
    if (!granted) {
      Alert.alert('位置情報が必要です', 'ランニング計測のために位置情報へのアクセスを許可してください。');
      return;
    }

    Vibration.vibrate(100);
    startTimeRef.current  = Date.now();
    totalMetersRef.current = 0;
    positionsRef.current  = [];
    lastPosRef.current    = null;

    setRun(prev => ({ ...prev, isRunning: true, elapsed: 0, totalMeters: 0, pace: 0, speed: 0, calories: 0 }));
    setIsRunning(true);

    // GPS監視
    watchIdRef.current = Geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (accuracy > 40) return; // 精度が低い場合は無視

        const newPos = { lat: latitude, lon: longitude };
        const now = Date.now();

        if (lastPosRef.current) {
          const dist = haversine(lastPosRef.current, newPos);
          const elapsed = (now - lastPosRef.current.time) / 1000;
          const instSpeed = elapsed > 0 ? dist / elapsed : 0; // m/s

          // 瞬間速度が 20m/s 以下（GPSジャンプ除外）
          if (instSpeed < 20) {
            totalMetersRef.current += dist;
            positionsRef.current.push(newPos);
          }
        }

        lastPosRef.current = { ...newPos, time: now };

        const totalElapsed = (now - startTimeRef.current) / 1000;
        const paceMinKm = totalMetersRef.current > 100
          ? (totalElapsed / 60) / (totalMetersRef.current / 1000)
          : 0;
        const speedKmh = totalElapsed > 0
          ? (totalMetersRef.current / totalElapsed) * 3.6
          : 0;
        const calories = calcCalories(totalMetersRef.current, settings.weightKg);

        setRun(prev => ({
          ...prev,
          totalMeters: totalMetersRef.current,
          pace: paceMinKm,
          speed: speedKmh,
          calories,
        }));
      },
      (error) => {
        console.warn('GPS Error:', error.message);
        Alert.alert('GPS エラー', 'GPS信号を取得できません。屋外で試してください。');
      },
      { enableHighAccuracy: true, distanceFilter: 5, interval: 2000, fastestInterval: 1000 }
    );

    // タイマー
    timerRef.current = setInterval(() => {
      setRun(prev => ({
        ...prev,
        elapsed: Math.floor((Date.now() - startTimeRef.current) / 1000),
      }));
    }, 1000);
  };

  const stopRun = async () => {
    if (!run.isRunning) return;
    Vibration.vibrate([100, 50, 100]);

    if (timerRef.current)  clearInterval(timerRef.current);
    if (watchIdRef.current !== null) Geolocation.clearWatch(watchIdRef.current);

    const finalMeters   = totalMetersRef.current;
    const finalElapsed  = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const finalPace     = finalMeters > 100 ? (finalElapsed / 60) / (finalMeters / 1000) : 0;
    const finalCalories = calcCalories(finalMeters, settings.weightKg);

    setIsRunning(false);
    setRun(prev => ({ ...prev, isRunning: false }));

    if (finalMeters > 10) {
      await saveRunRecord({
        meters: Math.round(finalMeters),
        durationS: finalElapsed,
        paceMinKm: finalPace,
        calories: finalCalories,
        simMode: false,
      });
      await refreshTodayRun();

      Alert.alert(
        '🏁 ランニング完了！',
        `距離: ${formatDistance(finalMeters)}\n時間: ${formatDuration(finalElapsed)}\nペース: ${formatPace(finalPace)}\nカロリー: ${Math.round(finalCalories)} kcal\n\n負債を ${formatDistance(finalMeters)} 返済しました！`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert('短すぎます', '10m以上走ってください。');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
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

        <Text style={styles.distanceBig}>
          {formatDistance(run.totalMeters)}
        </Text>

        {run.isRunning && (
          <Text style={styles.statusText}>GPS計測中...</Text>
        )}
      </LinearGradient>

      {/* ── メトリクス ── */}
      <View style={styles.metricsRow}>
        <MetricCard label="ペース" value={formatPace(run.pace)} unit="分/km" />
        <MetricCard label="速度" value={run.speed.toFixed(1)} unit="km/h" />
        <MetricCard label="カロリー" value={Math.round(run.calories).toString()} unit="kcal" />
      </View>

      {/* ── 負債返済プレビュー ── */}
      <View style={styles.debtPreview}>
        <Text style={styles.previewIcon}>⚡</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.previewLabel}>返済中の負債</Text>
          <Text style={styles.previewValue}>
            {formatDistance(debtRepayPreview)}
            <Text style={styles.previewRemain}> → 残 {formatDistance(remainingAfter)}</Text>
          </Text>
        </View>
      </View>

      {/* ── スタート/ストップボタン ── */}
      <TouchableOpacity
        style={[styles.ctaBtn, run.isRunning && styles.ctaBtnStop]}
        onPress={run.isRunning ? stopRun : startRun}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={run.isRunning
            ? [COLORS.red400, '#f97316']
            : [COLORS.purple600, COLORS.blue500]}
          style={styles.ctaBtnGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.ctaBtnText}>
            {run.isRunning ? '⏹ ストップ' : '▶ ランニング開始'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── 今日の目標 ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎯 今日の目標</Text>
        <Text style={styles.goalText}>
          残負債 <Text style={{ color: COLORS.red400, fontWeight: '700' }}>
            {formatDistance(netDebtMeters)}
          </Text> を返済するために走ろう！
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, (run.totalMeters / Math.max(netDebtMeters, 1)) * 100)}%` }
            ]}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function MetricCard({ label, value, unit }: any) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricUnit}>{unit}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

// ── 計算ユーティリティ ──

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function calcCalories(meters: number, weightKg: number): number {
  // MET法: ランニング MET ≈ 8.0
  const hours = meters / 1000 / 10; // 10km/h想定
  return 8.0 * weightKg * hours;
}

function formatPace(pace: number): string {
  if (!pace || pace === Infinity || pace <= 0) return '--:--';
  const m = Math.floor(pace);
  const s = Math.round((pace - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
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
});
