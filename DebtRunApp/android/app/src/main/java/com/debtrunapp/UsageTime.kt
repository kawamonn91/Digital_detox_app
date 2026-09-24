package com.debtrunapp

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import java.util.Calendar

/**
 * アプリの前面表示時間(スクリーンタイム)の計算。
 *
 * queryUsageStats は指定期間より前から始まる集計単位ごと丸ごと返すため「今日の使用時間」が多めに出る。
 * そこで前面/背面の切り替えイベント(UsageEvents の ACTIVITY_RESUMED / ACTIVITY_PAUSED)から、
 * 期間内の時間だけを足し合わせる。
 */
object UsageTime {
    fun hasPermission(context: Context): Boolean {
        val appOps = context.getSystemService(AppOpsManager::class.java)
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    /**
     * [start]〜[end] に各アプリが前面にあった時間(ms)、パッケージ名ごと。
     * ホーム画面(ランチャー)にいた時間はスマホを「使っていた」時間に含めない。
     */
    fun foregroundTime(context: Context, start: Long, end: Long): Map<String, Long> {
        val launchers = launcherPackages(context)
        val usm = context.getSystemService(UsageStatsManager::class.java)
        val events = usm.queryEvents(start, end)
        val totals = mutableMapOf<String, Long>()
        val resumedAt = mutableMapOf<String, Long>()
        val seen = mutableSetOf<String>()
        val event = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val pkg = event.packageName ?: continue
            if (pkg in launchers) continue
            when (event.eventType) {
                UsageEvents.Event.ACTIVITY_RESUMED -> {
                    if (!resumedAt.containsKey(pkg)) resumedAt[pkg] = event.timeStamp
                    seen.add(pkg)
                }
                UsageEvents.Event.ACTIVITY_PAUSED -> {
                    // 期間の開始時点ですでに前面にあった(このアプリの最初のイベントが PAUSED)なら開始時刻から数える。
                    // 同じアプリ内の画面切り替えなどで対応する RESUMED が無い PAUSED は数えない
                    val from = resumedAt.remove(pkg) ?: if (seen.add(pkg)) start else null
                    seen.add(pkg)
                    if (from != null) totals[pkg] = (totals[pkg] ?: 0L) + (event.timeStamp - from).coerceAtLeast(0L)
                }
            }
        }
        // 期間の終わりの時点でまだ前面にあるもの
        resumedAt.forEach { (pkg, from) -> totals[pkg] = (totals[pkg] ?: 0L) + (end - from).coerceAtLeast(0L) }
        return totals
    }

    /** ホーム画面アプリのパッケージ名(AndroidManifest の <queries> で HOME を宣言している) */
    private fun launcherPackages(context: Context): Set<String> {
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        val resolved = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.packageManager.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION")
            context.packageManager.queryIntentActivities(intent, 0)
        }
        return resolved.mapNotNull { it.activityInfo?.packageName }.toSet()
    }

    fun startOfDay(time: Long): Calendar = Calendar.getInstance().apply {
        timeInMillis = time
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }
}
