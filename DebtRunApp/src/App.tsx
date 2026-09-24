/**
 * App.tsx
 * メインエントリ — ナビゲーション、初期化、まとめ通知の設定
 */

import React, { useEffect } from 'react';
import { StatusBar, Text, Linking } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import notifee from '@notifee/react-native';

import DashboardScreen from './screens/DashboardScreen';
import RunningScreen   from './screens/RunningScreen';
import AIScreen        from './screens/AIScreen';
import SettingsScreen  from './screens/SettingsScreen';
import DailySummaryModal from './components/DailySummaryModal';
import { initDB }      from './services/storageService';
import { dailySummary } from './services/nativeModules';
import { useAppStore } from './store/useAppStore';
import { COLORS } from './theme';

const Tab = createBottomTabNavigator();

export default function App() {
  const { refreshData, settings, openSummary } = useAppStore();

  useEffect(() => {
    (async () => {
      await initDB();
      await refreshData();
    })();
  }, [refreshData]);

  // まとめ通知の設定をネイティブ側に渡す(時刻になるとネイティブが今日の集計を通知する)
  useEffect(() => {
    (async () => {
      if (settings.notificationsEnabled) await notifee.requestPermission();
      await dailySummary.configure(
        settings.summaryHour, settings.summaryMinute, settings.notificationsEnabled, settings.metersPerScreen,
      );
    })().catch(e => console.warn('[DailySummary] configure failed:', e));
  }, [settings.summaryHour, settings.summaryMinute, settings.notificationsEnabled, settings.metersPerScreen]);

  // まとめ通知のタップ(debtrun://summary)でまとめ画面を開く
  useEffect(() => {
    const handle = (url: string | null) => {
      if (url?.startsWith('debtrun://summary')) {
        refreshData().then(openSummary);
      }
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', e => handle(e.url));
    return () => sub.remove();
  }, [refreshData, openSummary]);

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.bgPrimary}
        translucent={false}
      />
      <NavigationContainer
        theme={{
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
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
            tabBarIcon: () => {
              const icons: Record<string, string> = {
                Dashboard: '🏠',
                Running:   '🏃',
                AI:        '✨',
                Settings:  '⚙️',
              };
              return <Text style={{ fontSize: 20 }}>{icons[route.name]}</Text>;
            },
            tabBarLabel: ({ focused }) => {
              const labels: Record<string, string> = {
                Dashboard: 'ホーム',
                Running:   'ランニング',
                AI:        'AI提案',
                Settings:  '設定',
              };
              return (
                <Text style={{
                  fontSize: 10,
                  fontWeight: focused ? '700' : '400',
                  color: focused ? COLORS.purple400 : COLORS.textMuted,
                  marginBottom: 2,
                }}>
                  {labels[route.name]}
                </Text>
              );
            },
            tabBarStyle: {
              backgroundColor: '#0f0f2e',
              borderTopColor: 'rgba(255,255,255,0.1)',
              borderTopWidth: 1,
              paddingTop: 6,
              // height と paddingBottom は指定せず、React NavigationのSafeArea自動調整に任せる
            },
            tabBarActiveTintColor: COLORS.purple400,
            tabBarInactiveTintColor: COLORS.textMuted,
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
        <DailySummaryModal />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
