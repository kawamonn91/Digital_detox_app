/**
 * running.js — GPS ランニングトラッカー
 */

import { addRunMeters } from './storage.js';
import { todayKey } from './storage.js';

let watchId = null;
let isRunning = false;
let startTime = null;
let lastPos = null;
let totalMeters = 0;
let posHistory = [];
let timerInterval = null;
let onUpdateCallback = null;
let simulateMode = false;  // GPS が使えない場合のシミュレーション

/** ランニング開始 */
async function startRun(onUpdate) {
  if (isRunning) return;

  onUpdateCallback = onUpdate;
  isRunning = true;
  startTime = Date.now();
  totalMeters = 0;
  posHistory = [];
  lastPos = null;

  // タイマー開始
  timerInterval = setInterval(() => {
    if (onUpdateCallback) onUpdateCallback(getRunState());
  }, 1000);

  // GPS取得試行
  if (!navigator.geolocation) {
    console.warn('GPS非対応 → シミュレーションモード');
    simulateMode = true;
    startSimulation();
    return;
  }

  try {
    watchId = navigator.geolocation.watchPosition(
      onGPSSuccess,
      (err) => {
        console.warn('GPS error:', err.message);
        simulateMode = true;
        startSimulation();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  } catch (e) {
    simulateMode = true;
    startSimulation();
  }
}

/** シミュレーションモード（GPS不使用）*/
let simInterval = null;
function startSimulation() {
  const avgPace = 6.0; // 6分/km
  const metersPerSecond = 1000 / (avgPace * 60);
  simInterval = setInterval(() => {
    if (!isRunning) {
      clearInterval(simInterval);
      return;
    }
    totalMeters += metersPerSecond + (Math.random() - 0.5) * 0.3;
    if (onUpdateCallback) onUpdateCallback(getRunState());
  }, 1000);
}

/** GPS 成功コールバック */
function onGPSSuccess(pos) {
  const { latitude, longitude, accuracy } = pos.coords;
  if (accuracy > 50) return; // 精度が低い場合は無視

  const newPos = { lat: latitude, lon: longitude };

  if (lastPos) {
    const dist = haversine(lastPos, newPos);
    // 瞬間移動チェック（100m/s 以上は無効）
    const elapsed = (Date.now() - (lastPos.time || Date.now())) / 1000;
    const speed = elapsed > 0 ? dist / elapsed : 0;
    if (speed < 20) {
      totalMeters += dist;
      posHistory.push(newPos);
    }
  }

  lastPos = { ...newPos, time: Date.now() };
  if (onUpdateCallback) onUpdateCallback(getRunState());
}

/** Haversine 公式で2点間の距離 (m) */
function haversine(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function toRad(deg) { return deg * Math.PI / 180; }

/** 現在の走行状態を返す */
function getRunState() {
  const elapsed = isRunning ? Math.floor((Date.now() - startTime) / 1000) : 0;
  const pace = totalMeters > 50
    ? (elapsed / 60) / (totalMeters / 1000)  // 分/km
    : 0;
  const speed = elapsed > 0 ? (totalMeters / elapsed) * 3.6 : 0; // km/h

  return {
    isRunning,
    elapsed,
    totalMeters,
    pace,       // 分/km
    speed,      // km/h
    simMode: simulateMode,
  };
}

/** ランニング停止 */
function stopRun() {
  if (!isRunning) return null;

  isRunning = false;
  clearInterval(timerInterval);
  clearInterval(simInterval);

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const runEntry = {
    date: todayKey(),
    meters: Math.round(totalMeters),
    duration: elapsed,
    pace: totalMeters > 0 ? (elapsed / 60) / (totalMeters / 1000) : 0,
    simMode: simulateMode,
    timestamp: Date.now(),
  };

  if (totalMeters > 10) {
    addRunMeters(Math.round(totalMeters), runEntry);
  }

  const result = { ...runEntry };

  // リセット
  totalMeters = 0;
  startTime = null;
  lastPos = null;
  posHistory = [];
  simulateMode = false;

  return result;
}

/** タイマー表示フォーマット */
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function pad(n) { return n.toString().padStart(2, '0'); }

/** ペース表示フォーマット */
function formatPace(pace) {
  if (!pace || pace === Infinity || pace === 0) return '--:--';
  const m = Math.floor(pace);
  const s = Math.round((pace - m) * 60);
  return `${m}:${pad(s)}`;
}

export { startRun, stopRun, getRunState, formatTime, formatPace };
