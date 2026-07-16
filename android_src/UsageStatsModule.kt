package com.debtrun

import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.*

/**
 * UsageStatsModule
 *
 * Android の UsageStatsManager を使ってアプリ別スクリーンタイムを取得する
 * React Native ネイティブモジュール。
 *
 * 使用例 (JS側):
 *   import { NativeModules } from 'react-native';
 *   const result = await NativeModules.UsageStats.getAppUsage(startTime, endTime);
 */
class UsageStatsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "UsageStatsModule"

        // スクリーンタイム取得対象アプリ
        val TRACKED_APPS = mapOf(
            "com.instagram.android"      to "Instagram",
            "com.twitter.android"        to "X (Twitter)",
            "com.zhiliaoapp.musically"   to "TikTok",
            "com.google.android.youtube" to "YouTube",
            "com.facebook.katana"        to "Facebook",
            "com.reddit.frontpage"       to "Reddit",
            "com.pinterest"              to "Pinterest",
            "com.snapchat.android"       to "Snapchat",
            "com.linkedin.android"       to "LinkedIn",
        )
    }

    override fun getName() = "UsageStats"

    /**
     * 使用許可が付与されているかチェック
     */
    @ReactMethod
    fun hasUsagePermission(promise: Promise) {
        val usm = reactApplicationContext
            .getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val now = System.currentTimeMillis()
        val stats = usm.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY, now - 3600000L, now
        )
        promise.resolve(stats != null && stats.isNotEmpty())
    }

    /**
     * 使用許可設定画面を開く
     */
    @ReactMethod
    fun openUsageAccessSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * 指定期間のアプリ別使用時間を取得
     * @param startTime epoch milliseconds
     * @param endTime   epoch milliseconds
     * @returns [{ packageName, appName, totalTimeMs, isTracked }]
     */
    @ReactMethod
    fun getAppUsage(startTime: Double, endTime: Double, promise: Promise) {
        try {
            val usm = reactApplicationContext
                .getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

            val stats: List<UsageStats> = usm.queryUsageStats(
                UsageStatsManager.INTERVAL_BEST,
                startTime.toLong(),
                endTime.toLong()
            ) ?: emptyList()

            val result = Arguments.createArray()

            // 追跡対象アプリのみフィルタリング
            stats
                .filter { it.totalTimeInForeground > 0 }
                .sortedByDescending { it.totalTimeInForeground }
                .forEach { stat ->
                    val appName = TRACKED_APPS[stat.packageName]
                    if (appName != null) {
                        val map = Arguments.createMap().apply {
                            putString("packageName", stat.packageName)
                            putString("appName", appName)
                            putDouble("totalTimeMs", stat.totalTimeInForeground.toDouble())
                            putDouble("totalTimeMin", stat.totalTimeInForeground / 60000.0)
                            putBoolean("isTracked", true)
                        }
                        result.pushMap(map)
                    }
                }

            Log.d(TAG, "Usage stats fetched: ${result.size()} apps")
            promise.resolve(result)

        } catch (e: SecurityException) {
            promise.reject("PERMISSION_DENIED", "使用状況へのアクセス許可がありません")
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * 今日のスクリーンタイム合計を取得
     */
    @ReactMethod
    fun getTodayUsage(promise: Promise) {
        val now = System.currentTimeMillis()
        val startOfDay = getStartOfDay()
        getAppUsage(startOfDay.toDouble(), now.toDouble(), promise)
    }

    /**
     * 過去N日分の使用時間を取得（日別集計）
     */
    @ReactMethod
    fun getWeeklyUsage(days: Int, promise: Promise) {
        try {
            val usm = reactApplicationContext
                .getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

            val result = Arguments.createArray()
            val cal = java.util.Calendar.getInstance()

            for (i in 0 until days) {
                cal.set(java.util.Calendar.HOUR_OF_DAY, 0)
                cal.set(java.util.Calendar.MINUTE, 0)
                cal.set(java.util.Calendar.SECOND, 0)
                cal.set(java.util.Calendar.MILLISECOND, 0)
                val dayStart = cal.timeInMillis
                val dayEnd   = dayStart + 86400000L

                val stats = usm.queryUsageStats(
                    UsageStatsManager.INTERVAL_DAILY, dayStart, dayEnd
                ) ?: emptyList()

                val dayMap = Arguments.createMap()
                dayMap.putDouble("date", dayStart.toDouble())

                var totalMs = 0L
                val appArray = Arguments.createArray()

                stats.filter { TRACKED_APPS.containsKey(it.packageName) && it.totalTimeInForeground > 0 }
                    .forEach { stat ->
                        totalMs += stat.totalTimeInForeground
                        val m = Arguments.createMap().apply {
                            putString("packageName", stat.packageName)
                            putString("appName", TRACKED_APPS[stat.packageName] ?: "")
                            putDouble("totalTimeMs", stat.totalTimeInForeground.toDouble())
                        }
                        appArray.pushMap(m)
                    }

                dayMap.putDouble("totalTrackedMs", totalMs.toDouble())
                dayMap.putArray("apps", appArray)
                result.pushMap(dayMap)

                cal.add(java.util.Calendar.DAY_OF_YEAR, -1)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    private fun getStartOfDay(): Long {
        val cal = java.util.Calendar.getInstance().apply {
            set(java.util.Calendar.HOUR_OF_DAY, 0)
            set(java.util.Calendar.MINUTE, 0)
            set(java.util.Calendar.SECOND, 0)
            set(java.util.Calendar.MILLISECOND, 0)
        }
        return cal.timeInMillis
    }
}
