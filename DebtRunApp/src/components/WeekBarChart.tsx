/**
 * WeekBarChart.tsx
 * 週間スクロール vs ランニング棒グラフ（Viewベース、SVG不使用）
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { COLORS, FONTS } from '../theme';

interface DailyTrend {
  date: string;
  screens: number;
  meters: number;
}
interface RunTrend {
  date: string;
  meters: number;
}
interface Props {
  scrollData: DailyTrend[];
  runData: RunTrend[];
}

const CHART_HEIGHT = 100;
const DAYS = ['月', '火', '水', '木', '金', '土', '日'];

export default function WeekBarChart({ scrollData, runData }: Props) {
  const n = 7;

  const maxMeters = Math.max(
    ...scrollData.map(d => d.meters),
    ...runData.map(d => d.meters),
    1,
  );

  return (
    <View style={styles.container}>
      {/* 棒グラフ本体 */}
      <View style={[styles.chartArea, { height: CHART_HEIGHT }]}>
        {Array.from({ length: n }).map((_, i) => {
          const scrollRec = scrollData[i];
          const runRec    = runData[i];
          const scrollH   = scrollRec ? (scrollRec.meters / maxMeters) * CHART_HEIGHT : 0;
          const runH      = runRec    ? (runRec.meters    / maxMeters) * CHART_HEIGHT : 0;

          const label = scrollRec
            ? (() => {
                const d = new Date(scrollRec.date);
                return DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
              })()
            : DAYS[i];

          return (
            <View key={i} style={styles.barGroup}>
              <View style={styles.barsRow}>
                {/* スクロール棒（赤） */}
                <View style={[styles.bar, styles.scrollBar, { height: Math.max(2, scrollH) }]} />
                {/* ランニング棒（緑） */}
                <View style={[styles.bar, styles.runBar, { height: Math.max(2, runH) }]} />
              </View>
              <Text style={styles.dayLabel}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  barGroup: {
    alignItems: 'center',
    flex: 1,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  bar: {
    width: 10,
    borderRadius: 3,
  },
  scrollBar: {
    backgroundColor: COLORS.red400,
    opacity: 0.85,
  },
  runBar: {
    backgroundColor: COLORS.green400,
    opacity: 0.85,
  },
  dayLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
  },
});
