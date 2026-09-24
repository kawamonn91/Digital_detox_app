/**
 * WeekBarChart.tsx
 * 週間スクロール vs ランニング棒グラフ（Viewベース、SVG不使用）。日付ごとにそろえて表示する
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WeekBar } from '../domain/stats';
import { COLORS } from '../theme';

interface Props {
  /** 直近7日分(古い順)。記録のない日も0で入っている */
  data: WeekBar[];
}

const CHART_HEIGHT = 100;

export default function WeekBarChart({ data }: Props) {
  const maxMeters = Math.max(...data.map(d => Math.max(d.scrollMeters, d.runMeters)), 1);

  return (
    <View style={styles.container}>
      <View style={[styles.chartArea, { height: CHART_HEIGHT + 18 }]}>
        {data.map(day => {
          const scrollH = (day.scrollMeters / maxMeters) * CHART_HEIGHT;
          const runH = (day.runMeters / maxMeters) * CHART_HEIGHT;
          return (
            <View key={day.date} style={styles.barGroup}>
              <View style={styles.barsRow}>
                {/* スクロール棒(赤) */}
                <View style={[styles.bar, styles.scrollBar, { height: Math.max(2, scrollH) }]} />
                {/* ランニング棒(緑) */}
                <View style={[styles.bar, styles.runBar, { height: Math.max(2, runH) }]} />
              </View>
              <Text style={styles.dayLabel}>{day.label}</Text>
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
