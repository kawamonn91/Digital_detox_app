/**
 * App.tsx
 * メインエントリ — ナビゲーション、初期化、通知スケジューラ
 */

import React, { useEffect } from 'react';
import { StatusBar, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';

import DashboardScreen from './screens/DashboardScreen';
import RunningScreen   from './screens/RunningScreen';
import AIScreen        from './screens/AIScreen';
import SettingsScreen  from './screens/SettingsScreen';
import { initDB }      from './services/storageService';
import { useAppStore } from './store/useAppStore';
import { COLORS, RADIUS } from './theme';

const Tab = createBottomTabNavigator();

export default function App() {
  const { refreshData, settings } = useAppStore();

  useEffect(() => {
    // DB 初期化 → データ読み込み
    (async () => {
      await initDB();
      await refreshData();
    })();
  }, []);

  // 毎日まとめ通知のスケジューリング
  useEffect(() => {
    scheduleDailySummary(settings.summaryHour, settings.summaryMinute);
  }, [settings.summaryHour, settings.summaryMinute, settings.notificationsEnabled]);

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.bgPrimary}
        translucent={false}
      />
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: COLORS.purple400,
            background: COLORS.bgPrimary,
            card: COLORS.bgSecondary,
            text: COLORS.textPrimary,
            border: 'rgba(255,255,255,0.08)',
            notification: COLORS.purple400,
          },
        }}
      >
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused }) => {
              const icons: Record<string, string> = {
                Dashboard: focused ? '🏠' : '🏡',
                Running:   focused ? '🏃' : '👟',
                AI:        focused ? '🤖' : '✨',
                Settings:  focused ? '⚙️' : '🔧',
              };
              return null; // アイコンはtabBarLabelで絵文字を使う
            },
            tabBarLabel: ({ focused }) => {
              const labels: Record<string, string> = {
                Dashboard: '🏠 ホーム',
                Running:   '🏃 ランニング',
                AI:        '✨ AI提案',
                Settings:  '⚙️ 設定',
              };
              return labels[route.name] || route.name;
            },
            tabBarStyle: {
              backgroundColor: 'rgba(10,10,26,0.95)',
              borderTopColor: 'rgba(255,255,255,0.08)',
              borderTopWidth: 1,
              height: 68,
              paddingBottom: Platform.OS === 'ios' ? 16 : 8,
            },
            tabBarActiveTintColor: COLORS.purple400,
            tabBarInactiveTintColor: COLORS.textMuted,
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: '600',
            },
            headerStyle: {
              backgroundColor: COLORS.bgPrimary,
              borderBottomColor: 'rgba(255,255,255,0.08)',
              borderBottomWidth: 1,
            },
            headerTitleStyle: {
              color: COLORS.textPrimary,
              fontSize: 16,
              fontWeight: '700',
            },
            headerRight: () => null,
          })}
        >
          <Tab.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ title: 'DebtRun 🏃' }}
          />
          <Tab.Screen
            name="Running"
            component={RunningScreen}
            options={{ title: 'ランニング' }}
          />
          <Tab.Screen
            name="AI"
            component={AIScreen}
            options={{ title: 'AI提案' }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: '設定' }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// ── 毎日まとめ通知 ──

async function scheduleDailySummary(hour: number, minute: number) {
  try {
    // 既存の通知をキャンセル
    await notifee.cancelAllNotifications();

    // チャンネル作成 (Android)
    const channelId = await notifee.createChannel({
      id: 'daily-summary',
      name: 'デイリーまとめ',
      importance: AndroidImportance.HIGH,
    });

    // 次の通知時刻を計算
    const now = new Date();
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);

    await notifee.createTriggerNotification(
      {
        title: '📊 今日のDebtRunまとめ',
        body: 'タップして今日のスクロール負債とランニング記録を確認しましょう',
        android: {
          channelId,
          pressAction: { id: 'default' },
          smallIcon: 'ic_notification',
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: next.getTime(),
        repeatFrequency: 1, // 毎日繰り返し
      }
    );

    console.log('[Notifications] Daily summary scheduled:', next.toLocaleString());
  } catch (e) {
    console.warn('[Notifications] Failed to schedule:', e);
  }
}
