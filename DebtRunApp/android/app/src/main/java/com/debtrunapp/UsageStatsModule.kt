package com.debtrunapp

import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Calendar

/**
 * UsageStatsModule
 *
 * スクリーンタイム(アプリが前面に表示されていた時間)を JS に渡す。
 * 計算は [UsageTime] で行う。
 */
class UsageStatsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "UsageStats"

    /** 「使用状況へのアクセス」が許可されているか */
    @ReactMethod
    fun hasUsagePermission(promise: Promise) {
        promise.resolve(hasPermission())
    }

    @ReactMethod
    fun openUsageAccessSettings(promise: Promise) {
        try {
            reactApplicationContext.startActivity(
                Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    /**
     * 直近 [days] 日分(今日を含む)の使用時間。
     * @returns {
     *   apps: [{ date: 'YYYY-MM-DD', packageName, appName, totalTimeMs }]  対象アプリ(SNS・動画)ごと。0のものは含めない
     *   screenTime: [{ date: 'YYYY-MM-DD', totalTimeMs }]                  全アプリ合計(ホーム画面を除く)
     * }
     */
    @ReactMethod
    fun getDailyUsage(days: Int, promise: Promise) {
        if (!hasPermission()) {
            promise.reject("PERMISSION_DENIED", "使用状況へのアクセスが許可されていません")
            return
        }
        try {
            val apps = Arguments.createArray()
            val screenTime = Arguments.createArray()
            val now = System.currentTimeMillis()
            val dayStart = startOfDay(now)
            for (i in 0 until days) {
                val start = dayStart.clone() as Calendar
                start.add(Calendar.DAY_OF_YEAR, -i)
                val end = start.clone() as Calendar
                end.add(Calendar.DAY_OF_YEAR, 1)
                val date = ScrollLog.dateKey(start.timeInMillis)
                val times = UsageTime.foregroundTime(reactApplicationContext, start.timeInMillis, minOf(end.timeInMillis, now))

                times.forEach { (pkg, ms) ->
                    if (ms <= 0 || !TrackedApps.NAMES.containsKey(pkg)) return@forEach
                    apps.pushMap(Arguments.createMap().apply {
                        putString("date", date)
                        putString("packageName", pkg)
                        putString("appName", TrackedApps.nameOf(pkg))
                        putDouble("totalTimeMs", ms.toDouble())
                    })
                }
                screenTime.pushMap(Arguments.createMap().apply {
                    putString("date", date)
                    putDouble("totalTimeMs", times.values.sum().toDouble())
                })
            }
            promise.resolve(Arguments.createMap().apply {
                putArray("apps", apps)
                putArray("screenTime", screenTime)
            })
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    private fun hasPermission(): Boolean = UsageTime.hasPermission(reactApplicationContext)

    private fun startOfDay(time: Long): Calendar = UsageTime.startOfDay(time)
}
