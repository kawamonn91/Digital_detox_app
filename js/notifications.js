/**
 * notifications.js — Web Push / 通知システム
 */

import { loadSettings, loadToday, getNetDebt } from './storage.js';

let summaryTimerHandle = null;

/** 通知許可を要求 */
async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result;
}

/** インアプリ通知バナーを表示 */
function showBanner(title, body, duration = 5000) {
  const banner = document.getElementById('notificationBanner');
  if (!banner) return;

  document.getElementById('bannerTitle').textContent = title;
  document.getElementById('bannerBody').textContent  = body;

  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), duration);
}

/** ネイティブ通知を送信 */
function sendNativeNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  new Notification(title, {
    body,
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="%237c3aed"/><text y="48" font-size="40" text-anchor="middle" x="32">🏃</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">🏃</text></svg>',
    tag: 'debtrun-summary',
    renotify: true,
  });
}

/** まとめ通知を今すぐ表示 */
function sendDailySummary() {
  const today = loadToday();
  const netDebt = getNetDebt(today);
  const runKm   = (today.runMeters / 1000).toFixed(2);
  const debtKm  = (today.scrollDebtMeters / 1000).toFixed(2);

  const title = '📊 今日のDebtRunまとめ';
  const body  = netDebt > 0
    ? `スクロール負債: ${debtKm}km | ランニング: ${runKm}km | 残負債: ${(netDebt/1000).toFixed(2)}km — 明日も走って返済しよう！`
    : `スクロール負債: ${debtKm}km | ランニング: ${runKm}km | ✅ 今日は完済！素晴らしい！`;

  sendNativeNotification(title, body);
  showBanner(title, body, 8000);

  // まとめモーダルも表示
  showSummaryModal(today, netDebt);
}

/** まとめモーダルの表示 */
function showSummaryModal(today, netDebt) {
  const modal = document.getElementById('summaryModal');
  if (!modal) return;

  const net = netDebt ?? getNetDebt(today);

  document.getElementById('sumDebt').textContent   = `${today.scrollDebtMeters.toFixed(0)} m`;
  document.getElementById('sumRun').textContent    = `${today.runMeters.toFixed(0)} m`;
  document.getElementById('sumNet').textContent    = `${net.toFixed(0)} m`;
  document.getElementById('sumScreens').textContent = `${today.scrollDebtScreens.toFixed(1)} 画面`;

  const netEl = document.getElementById('sumNet');
  netEl.className = 'summary-val ' + (net > 0 ? 'text-red' : 'text-green');

  modal.classList.add('show');
}

/** まとめモーダルを閉じる */
function hideSummaryModal() {
  const modal = document.getElementById('summaryModal');
  if (modal) modal.classList.remove('show');
}

/** 毎日のスケジューラを開始 */
function startDailyScheduler() {
  clearDailyScheduler();

  const settings = loadSettings();
  if (!settings.notificationsEnabled) return;

  const [h, m] = settings.summaryTime.split(':').map(Number);
  scheduleNext(h, m);
}

function scheduleNext(h, m) {
  const now = new Date();
  const next = new Date();
  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  const delay = next - now;
  summaryTimerHandle = setTimeout(() => {
    sendDailySummary();
    scheduleNext(h, m); // 再スケジュール
  }, delay);

  console.log(`[Notifications] 次回まとめ通知: ${next.toLocaleString()}`);
}

function clearDailyScheduler() {
  if (summaryTimerHandle) {
    clearTimeout(summaryTimerHandle);
    summaryTimerHandle = null;
  }
}

export {
  requestPermission,
  showBanner,
  sendNativeNotification,
  sendDailySummary,
  showSummaryModal,
  hideSummaryModal,
  startDailyScheduler,
  clearDailyScheduler,
};
