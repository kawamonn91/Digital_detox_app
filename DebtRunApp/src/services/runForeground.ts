/**
 * runForeground.ts
 * ランニング計測中に前面サービス(常駐通知)を出して、画面を消しても・他のアプリを開いても
 * GPS計測が止まらないようにする。notifee の前面サービスを「位置情報」タイプで使う
 * (AndroidManifest.xml で notifee の ForegroundService を location タイプに置き換えている)。
 */

import notifee, { AndroidForegroundServiceType, AndroidImportance } from '@notifee/react-native';
import { formatDistance, formatDuration } from '../domain/format';

const NOTIFICATION_ID = 'running';
const CHANNEL_ID = 'running';

/** index.js で1回だけ呼ぶ。計測が終わるまで前面サービスを保つ(停止は stopRunForeground で行う) */
export function registerRunForegroundService() {
  notifee.registerForegroundService(() => new Promise<void>(() => {}));
}

async function display(body: string) {
  await notifee.displayNotification({
    id: NOTIFICATION_ID,
    title: '🏃 ランニング計測中',
    body,
    android: {
      channelId: CHANNEL_ID,
      asForegroundService: true,
      foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_LOCATION],
      ongoing: true,
      onlyAlertOnce: true,
      smallIcon: 'ic_notification',
      pressAction: { id: 'default' },
    },
  });
}

export async function startRunForeground(): Promise<void> {
  await notifee.createChannel({ id: CHANNEL_ID, name: 'ランニング計測', importance: AndroidImportance.LOW });
  await display('計測を開始しました');
}

export async function updateRunForeground(meters: number, seconds: number): Promise<void> {
  await display(`${formatDistance(meters)} ・ ${formatDuration(seconds)}`);
}

export async function stopRunForeground(): Promise<void> {
  await notifee.stopForegroundService();
  await notifee.cancelNotification(NOTIFICATION_ID);
}
