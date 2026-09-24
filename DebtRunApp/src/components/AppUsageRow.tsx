/**
 * AppUsageRow.tsx
 * アプリ別のスクロール量・使用時間の1行コンポーネント
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppRow } from '../domain/dashboard';
import { formatDistance, formatScreenTime } from '../domain/format';
import { COLORS, FONTS } from '../theme';

interface Props {
  record: AppRow;
}

// アプリパッケージ → 絵文字マップ
const APP_ICONS: Record<string, string> = {
  'com.instagram.android': '📸',
  'com.twitter.android': '🐦',
  'com.instagram.barcelona': '🧵',
  'com.zhiliaoapp.musically': '🎵',
  'com.google.android.youtube': '▶️',
  'com.facebook.katana': '👤',
  'com.reddit.frontpage': '🤖',
  'com.ss.android.ugc.trill': '🎵',
  'com.pinterest': '📌',
  'com.snapchat.android': '👻',
};

function getAppIcon(packageName?: string): string {
  if (!packageName) return '📱';
  return APP_ICONS[packageName] || '📱';
}

export default function AppUsageRow({ record }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>{getAppIcon(record.packageName)}</Text>
      <View style={styles.info}>
        <Text style={styles.appName} numberOfLines={1}>
          {record.appName}
        </Text>
        <Text style={styles.screens}>
          {record.screens.toFixed(1)} 画面
          {record.timeMs !== null ? ` ・ ${formatScreenTime(record.timeMs)}` : ''}
        </Text>
      </View>
      <View style={styles.metersContainer}>
        <Text style={styles.meters}>{formatDistance(record.meters)}</Text>
        <Text style={styles.metersLabel}>スクロール負債</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  icon: {
    fontSize: 28,
    width: 36,
    textAlign: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  appName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  screens: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  metersContainer: {
    alignItems: 'flex-end',
  },
  meters: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.red400,
    fontFamily: FONTS.grotesk,
  },
  metersLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
