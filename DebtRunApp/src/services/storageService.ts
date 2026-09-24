/**
 * storageService.ts
 * ランニング記録(SQLite)と設定(AsyncStorage)の保存。
 * スクロール記録はアクセシビリティサービスがネイティブ側に保存する(nativeModules.ts の scrollTracker)。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';
import { localDateKey } from '../domain/dates';

SQLite.enablePromise(true);

let db: SQLiteDatabase | null = null;

async function getDB(): Promise<SQLiteDatabase> {
  if (db) return db;
  const opened = await SQLite.openDatabase({ name: 'debtrun.db', location: 'default' });
  await opened.executeSql(`
    CREATE TABLE IF NOT EXISTS run_records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT    NOT NULL,
      meters      REAL    NOT NULL,
      duration_s  INTEGER NOT NULL,
      pace_min_km REAL    DEFAULT 0,
      calories    REAL    DEFAULT 0,
      sim_mode    INTEGER DEFAULT 0,
      created_at  INTEGER NOT NULL
    );
  `);
  await opened.executeSql('CREATE INDEX IF NOT EXISTS idx_run_date ON run_records(date);');
  db = opened;
  return opened;
}

export async function initDB(): Promise<void> {
  await getDB();
}

// ── ランニング記録 ──────────────────────────────────────────────

export interface RunRecord {
  meters: number;
  durationS: number;
  paceMinKm: number;
  calories: number;
}

export interface SavedRun extends RunRecord {
  id: number;
  date: string;
  createdAt: number;
}

/** ランニングを保存する。日付は走り始めた日(端末のローカル日付) */
export async function saveRunRecord(record: RunRecord, startedAt: number): Promise<void> {
  const database = await getDB();
  await database.executeSql(
    `INSERT INTO run_records (date, meters, duration_s, pace_min_km, calories, sim_mode, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [localDateKey(new Date(startedAt)), record.meters, record.durationS, record.paceMinKm, record.calories, Date.now()],
  );
}

/** 日付ごとのランニング距離(全期間) */
export async function getDailyRunTotals(): Promise<Array<{ date: string; meters: number }>> {
  const database = await getDB();
  const [result] = await database.executeSql(
    'SELECT date, SUM(meters) AS meters FROM run_records GROUP BY date ORDER BY date',
  );
  const rows: Array<{ date: string; meters: number }> = [];
  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows.item(i);
    rows.push({ date: row.date, meters: row.meters ?? 0 });
  }
  return rows;
}

/** 最近のランニング(新しい順) */
export async function getRecentRuns(limit: number): Promise<SavedRun[]> {
  const database = await getDB();
  const [result] = await database.executeSql(
    'SELECT * FROM run_records ORDER BY created_at DESC LIMIT ?',
    [limit],
  );
  const rows: SavedRun[] = [];
  for (let i = 0; i < result.rows.length; i++) {
    const r = result.rows.item(i);
    rows.push({
      id: r.id,
      date: r.date,
      meters: r.meters,
      durationS: r.duration_s,
      paceMinKm: r.pace_min_km,
      calories: r.calories,
      createdAt: r.created_at,
    });
  }
  return rows;
}

export async function deleteRun(id: number): Promise<void> {
  const database = await getDB();
  await database.executeSql('DELETE FROM run_records WHERE id = ?', [id]);
}

export async function clearRuns(): Promise<void> {
  const database = await getDB();
  await database.executeSql('DELETE FROM run_records');
}

// ── 設定 ──────────────────────────────────────────────────────

export interface AppSettings {
  metersPerScreen: number;
  summaryHour: number;
  summaryMinute: number;
  notificationsEnabled: boolean;
  geminiApiKey: string;
  /** カロリー計算用 */
  weightKg: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  metersPerScreen: 1.0,
  summaryHour: 21,
  summaryMinute: 0,
  notificationsEnabled: true,
  geminiApiKey: '',
  weightKg: 60,
};

const SETTINGS_KEY = 'debtrun_settings';

export async function loadSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const next = { ...(await loadSettings()), ...settings };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}
