/**
 * DailySummaryModal.tsx
 * 一日のまとめ。まとめ通知のタップ、またはホームの「今日のまとめ」から開く。
 */

import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store/useAppStore';
import { buildDailySummary } from '../domain/summary';
import { COLORS, FONTS, RADIUS } from '../theme';

export default function DailySummaryModal() {
  const navigation = useNavigation<any>();
  const { summaryVisible, closeSummary, dashboard } = useAppStore();
  const summary = buildDailySummary({
    screens: dashboard.todayScreens,
    scrollMeters: dashboard.todayScrollMeters,
    runMeters: dashboard.todayRunMeters,
    debtMeters: dashboard.debtMeters,
    carriedOverMeters: dashboard.carriedOverMeters,
    screenTimeMs: dashboard.screenTimeTodayMs,
    snsTimeMs: dashboard.snsTimeTodayMs,
    streak: dashboard.streak,
  });

  return (
    <Modal visible={summaryVisible} transparent animationType="fade" onRequestClose={closeSummary}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>📊 {summary.title}</Text>
          <Text style={styles.headline}>{summary.headline}</Text>
          <View style={styles.lines}>
            {summary.lines.map(line => (
              <Text key={line} style={styles.line}>・{line}</Text>
            ))}
          </View>
          {dashboard.debtMeters > 0 && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => { closeSummary(); navigation.navigate('Running'); }}
            >
              <Text style={styles.primaryBtnText}>🏃 走って返済する</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.closeBtn} onPress={closeSummary}>
            <Text style={styles.closeBtnText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 24 },
  sheet: {
    backgroundColor: '#13132a',
    borderRadius: RADIUS.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.textPrimary, fontFamily: FONTS.grotesk, marginBottom: 12 },
  headline: { fontSize: 15, fontWeight: '700', color: COLORS.purple400, lineHeight: 22, marginBottom: 14 },
  lines: { gap: 6, marginBottom: 20 },
  line: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  primaryBtn: { backgroundColor: COLORS.purple600, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
  closeBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  closeBtnText: { color: COLORS.textMuted, fontSize: 14 },
});
