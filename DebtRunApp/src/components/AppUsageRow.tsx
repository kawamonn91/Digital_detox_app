/**
 * AppUsageRow.tsx
 * アプリ別スクロール使用状況の1行コンポーネント
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS } from '../theme';

interface ScrollRecord {
  packageName?: string;
  appName?: string;
  screens: number;
  meters: number;
  totalPx?: number;
}

interface Props {
  record: ScrollRecord;
}

// アプリパッケージ → 絵文字マップ
const APP_ICONS: Record<string, string> = {
  'com.instagram.android': '📸',
  'com.twitter.android': '🐦',
  'com.zhiliaoapp.musically': '🎵',
  'com.google.android.youtube': '▶️',
  'com.facebook.katana': '👤',
  'com.reddit.frontpage': '🤖',
  'com.ss.android.ugc.trill': '🎵',
  'com.linkedin.android': '💼',
};

function getAppIcon(packageName?: string): string {
  if (!packageName) return '📱';
  return APP_ICONS[packageName] || '📱';
}

function getDisplayName(record: ScrollRecord): string {
  if (record.appName) return record.appName;
  if (record.packageName) {
    const parts = record.packageName.split('.');
    return parts[parts.length - 1] || record.packageName;
  }
  return 'Unknown';
}

export default function AppUsageRow({ record }: Props) {
  const icon = getAppIcon(record.packageName);
  const name = getDisplayName(record);
  const meters = record.meters;
  const screens = record.screens;

  return (
    <View style={styles.row}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.info}>
        <Text style={styles.appName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.screens}>
          {screens.toFixed(1)} 画面
        </Text>
      </View>
      <View style={styles.metersContainer}>
        <Text style={styles.meters}>
          {meters >= 1000
            ? `${(meters / 1000).toFixed(2)} km`
            : `${Math.round(meters)} m`}
        </Text>
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
