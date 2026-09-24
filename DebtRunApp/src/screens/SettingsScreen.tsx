/**
 * SettingsScreen.tsx
 * 設定画面
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TextInput, Switch, TouchableOpacity, Alert, AppState,
} from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { dailySummary, scrollTracker, usageStats } from '../services/nativeModules';
import { COLORS, FONTS, RADIUS } from '../theme';

export default function SettingsScreen() {
  const { settings, setSettings } = useAppStore();
  const [mps, setMps] = useState(settings.metersPerScreen.toString());
  const [summaryTime, setSummaryTime] = useState(
    `${String(settings.summaryHour).padStart(2, '0')}:${String(settings.summaryMinute).padStart(2, '0')}`
  );
  const [apiKey, setApiKey] = useState(settings.geminiApiKey);
  const [weight, setWeight] = useState(settings.weightKg.toString());

  const [hasUsagePerm, setHasUsagePerm] = useState(false);
  const [hasAccessPerm, setHasAccessPerm] = useState(false);

  const checkPermissions = async () => {
    try {
      setHasUsagePerm(await usageStats.hasPermission());
      setHasAccessPerm(await scrollTracker.isEnabled());
    } catch (e) {
      console.warn('Permission check error:', e);
    }
  };

  // 許可の設定画面から戻ってきたときに表示を更新する
  useEffect(() => {
    checkPermissions();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') checkPermissions();
    });
    return () => sub.remove();
  }, []);

  const saveMps = () => {
    const val = parseFloat(mps);
    if (isNaN(val) || val <= 0 || val > 100) {
      Alert.alert('無効な値', '0.1〜100の数値を入力してください。');
      return;
    }
    const rounded = Math.round(val * 10) / 10;
    setSettings({ metersPerScreen: rounded });
    setMps(String(rounded));
    Alert.alert('保存しました', `1画面 = ${rounded}m に設定しました。過去の記録も新しい比率で計算し直します。`);
  };

  const saveSummaryTime = () => {
    const [h, m] = summaryTime.split(':').map(Number);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      Alert.alert('無効な時刻', 'HH:MM 形式で入力してください（例: 21:00）');
      return;
    }
    setSettings({ summaryHour: h, summaryMinute: m });
    const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setSummaryTime(label);
    Alert.alert('保存しました', `毎日 ${label} にその日のまとめを通知します。`);
  };

  const saveApiKey = () => {
    setSettings({ geminiApiKey: apiKey.trim() });
    Alert.alert('保存しました', apiKey.trim() ? 'Gemini APIキーを設定しました。' : 'APIキーをクリアしました（データからローカルで提案します）。');
  };

  const saveWeight = () => {
    const val = parseFloat(weight);
    if (isNaN(val) || val < 30 || val > 200) {
      Alert.alert('無効な値', '30〜200kgの数値を入力してください。');
      return;
    }
    setSettings({ weightKg: val });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── 権限ステータス ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>権限ステータス</Text>

        <PermissionRow
          label="スクリーンタイム取得"
          desc="アプリ別の使用時間を計測"
          granted={hasUsagePerm}
          onPress={() => usageStats.openSettings()}
        />
        <PermissionRow
          label="スクロール計測"
          desc="他アプリのスクロール距離を自動計測（要アクセシビリティ許可）"
          granted={hasAccessPerm}
          onPress={() => scrollTracker.openSettings()}
        />
      </View>

      {/* ── 換算設定 ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>換算比率</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>1画面 = ? メートル</Text>
            <Text style={styles.settingDesc}>スクロール1画面分をランニング何mとして換算するか</Text>
          </View>
          <View style={styles.inputGroup}>
            <TextInput
              style={styles.numInput}
              value={mps}
              onChangeText={setMps}
              keyboardType="decimal-pad"
              maxLength={5}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveMps}>
              <Text style={styles.saveBtnText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.presetRow}>
          <Text style={styles.presetLabel}>プリセット:</Text>
          {[0.5, 1.0, 2.0, 3.0].map(val => (
            <TouchableOpacity
              key={val}
              style={[styles.preset, settings.metersPerScreen === val && styles.presetActive]}
              onPress={() => {
                setMps(val.toString());
                setSettings({ metersPerScreen: val });
              }}
            >
              <Text style={[styles.presetText, settings.metersPerScreen === val && styles.presetTextActive]}>
                {val}m
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── 通知設定 ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>毎日のまとめ通知</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>通知時刻</Text>
            <Text style={styles.settingDesc}>HH:MM 形式で入力（例: 21:00）</Text>
          </View>
          <View style={styles.inputGroup}>
            <TextInput
              style={styles.numInput}
              value={summaryTime}
              onChangeText={setSummaryTime}
              placeholder="21:00"
              placeholderTextColor={COLORS.textMuted}
              maxLength={5}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveSummaryTime}>
              <Text style={styles.saveBtnText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.settingRow, { marginTop: 8 }]}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>通知を有効にする</Text>
            <Text style={styles.settingDesc}>その日のスクロール・ランニング・使用時間をまとめて通知します</Text>
          </View>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={(v) => setSettings({ notificationsEnabled: v })}
            trackColor={{ false: 'rgba(255,255,255,0.1)', true: COLORS.purple600 }}
            thumbColor="white"
          />
        </View>
        <TouchableOpacity style={[styles.saveBtnFull, { marginTop: 12 }]} onPress={() => dailySummary.showNow()}>
          <Text style={styles.saveBtnText}>今すぐまとめ通知を試す</Text>
        </TouchableOpacity>
      </View>

      {/* ── AI設定 ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gemini AI 設定</Text>

        <View style={styles.apiKeyCard}>
          <Text style={styles.settingLabel}>Gemini APIキー</Text>
          <Text style={styles.settingDesc}>
            https://aistudio.google.com でAPIキーを取得できます。{'\n'}
            空欄の場合は、記録データからアプリ内で提案を作ります（通信なし）。
          </Text>
          <TextInput
            style={styles.apiInput}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="AIzaSy..."
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.saveBtnFull} onPress={saveApiKey}>
            <Text style={styles.saveBtnText}>APIキーを保存</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 身体設定 ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>身体データ</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>体重（kg）</Text>
            <Text style={styles.settingDesc}>カロリー計算に使用</Text>
          </View>
          <View style={styles.inputGroup}>
            <TextInput
              style={styles.numInput}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              maxLength={5}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveWeight}>
              <Text style={styles.saveBtnText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── アプリ情報 ── */}
      <View style={styles.appInfo}>
        <Text style={styles.appInfoText}>DebtRun v1.0.0</Text>
        <Text style={styles.appInfoSub}>スクロール負債をランニングで返済</Text>
      </View>
    </ScrollView>
  );
}

function PermissionRow({ label, desc, granted, onPress }: any) {
  return (
    <View style={styles.permRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDesc}>{desc}</Text>
      </View>
      {granted ? (
        <View style={styles.grantedBadge}>
          <Text style={styles.grantedText}>✓ 許可済</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.grantBtn} onPress={onPress}>
          <Text style={styles.grantBtnText}>許可する</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary, padding: 16 },

  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.5,
    marginBottom: 12, paddingLeft: 4,
  },

  settingRow: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 2 },
  settingDesc: { fontSize: 12, color: COLORS.textMuted, lineHeight: 17 },

  inputGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numInput: {
    width: 72,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: RADIUS.sm,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 8,
    fontFamily: FONTS.grotesk,
  },
  saveBtn: {
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
  },
  saveBtnText: { color: COLORS.purple400, fontSize: 12, fontWeight: '700' },

  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    flexWrap: 'wrap',
  },
  presetLabel: { fontSize: 12, color: COLORS.textMuted },
  preset: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  presetActive: { backgroundColor: 'rgba(124,58,237,0.2)', borderColor: COLORS.purple500 },
  presetText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  presetTextActive: { color: COLORS.purple400 },

  apiKeyCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    gap: 10,
  },
  apiInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: RADIUS.md,
    color: COLORS.textPrimary,
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'monospace',
  },
  saveBtnFull: {
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
  },

  permRow: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  grantedBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
  },
  grantedText: { color: COLORS.green400, fontSize: 12, fontWeight: '700' },
  grantBtn: {
    backgroundColor: 'rgba(124,58,237,0.2)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)',
  },
  grantBtnText: { color: COLORS.purple400, fontSize: 12, fontWeight: '700' },

  appInfo: { alignItems: 'center', paddingVertical: 20 },
  appInfoText: { fontSize: 13, color: COLORS.textMuted },
  appInfoSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
});
