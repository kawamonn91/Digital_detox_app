package com.debtrunapp

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.sqlite.SQLiteDatabase
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import java.util.Calendar
import java.util.Locale

/**
 * 一日のまとめ通知。
 *
 * ユーザーが決めた時刻に AlarmManager で起動し、その時点の「今日のスクロール・ランニング・使用時間」を
 * 集計して通知する(notifee の予約通知は予約時点の固定文言しか出せないため、ネイティブで組み立てる)。
 * 通知をタップすると debtrun://summary でアプリを開き、JS 側のまとめ画面(繰り越し込みの残債など)を表示する。
 */
object DailySummary {
    private const val TAG = "DailySummary"
    private const val PREFS = "debtrun_daily_summary"
    private const val CHANNEL_ID = "daily-summary"
    private const val NOTIFICATION_ID = 2001
    const val ACTION_FIRE = "com.debtrunapp.DAILY_SUMMARY"
    const val SUMMARY_URI = "debtrun://summary"

    /** 設定を保存し、次の通知を予約し直す(無効なら予約を取り消す) */
    fun configure(context: Context, hour: Int, minute: Int, enabled: Boolean, metersPerScreen: Double) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putInt("hour", hour)
            .putInt("minute", minute)
            .putBoolean("enabled", enabled)
            .putFloat("metersPerScreen", metersPerScreen.toFloat())
            .apply()
        reschedule(context)
    }

    /** 保存済みの設定で次の通知を予約する(再起動後・通知後にも呼ぶ) */
    fun reschedule(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val alarmManager = context.getSystemService(AlarmManager::class.java)
        val pending = alarmIntent(context)
        alarmManager.cancel(pending)
        if (!prefs.getBoolean("enabled", false)) return

        val next = nextTriggerAt(System.currentTimeMillis(), prefs.getInt("hour", 21), prefs.getInt("minute", 0))
        // 正確なアラーム(SCHEDULE_EXACT_ALARM)は不要。数分遅れても問題ないので省電力に配慮した通常のアラームを使う
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pending)
    }

    /** [now] より後で最初に来る hour:minute の時刻(ms) */
    fun nextTriggerAt(now: Long, hour: Int, minute: Int): Long {
        val cal = Calendar.getInstance().apply {
            timeInMillis = now
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        if (cal.timeInMillis <= now) cal.add(Calendar.DAY_OF_YEAR, 1)
        return cal.timeInMillis
    }

    private fun alarmIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
        context,
        0,
        Intent(context, DailySummaryReceiver::class.java).setAction(ACTION_FIRE),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    /** 今日の集計を通知する */
    fun notify(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val metersPerScreen = prefs.getFloat("metersPerScreen", 1f).toDouble()
        val now = System.currentTimeMillis()
        val today = ScrollLog.dateKey(now)

        val screenHeight = ScrollLog.screenHeight(context) ?: 1920f
        val screens = ScrollLog.readAll(context).filter { it.date == today }.sumOf { it.px.toDouble() } / screenHeight
        val runMeters = todayRunMeters(context, today)
        val usage = if (UsageTime.hasPermission(context)) {
            UsageTime.foregroundTime(context, UsageTime.startOfDay(now).timeInMillis, now)
        } else {
            null
        }

        val lines = buildList {
            add("スクロール: ${screens.toInt()}画面(${formatDistance(screens * metersPerScreen)})")
            if (usage != null) {
                val total = usage.values.sum()
                val sns = usage.filterKeys { TrackedApps.NAMES.containsKey(it) }.values.sum()
                add("スクリーンタイム: ${formatScreenTime(total)}(うちSNS・動画 ${formatScreenTime(sns)})")
            }
            add("ランニング: ${formatDistance(runMeters)}")
        }

        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "一日のまとめ", NotificationManager.IMPORTANCE_DEFAULT),
        )
        val openSummary = PendingIntent.getActivity(
            context,
            0,
            Intent(Intent.ACTION_VIEW, Uri.parse(SUMMARY_URI), context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("📊 今日のDebtRunまとめ")
            .setContentText(lines.joinToString(" / "))
            .setStyle(NotificationCompat.BigTextStyle().bigText(lines.joinToString("\n") + "\nタップして残りの負債を確認"))
            .setContentIntent(openSummary)
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
    }

    /** JS 側(react-native-sqlite-storage)が保存したランニング記録から、今日の距離を読む */
    private fun todayRunMeters(context: Context, today: String): Double {
        val file = context.getDatabasePath("debtrun.db")
        if (!file.exists()) return 0.0
        return try {
            SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READONLY).use { db ->
                db.rawQuery("SELECT SUM(meters) FROM run_records WHERE date = ?", arrayOf(today)).use { c ->
                    if (c.moveToFirst() && !c.isNull(0)) c.getDouble(0) else 0.0
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to read run records: ${e.message}")
            0.0
        }
    }

    fun formatDistance(meters: Double): String =
        if (meters >= 1000) String.format(Locale.US, "%.2f km", meters / 1000) else "${Math.round(meters)} m"

    fun formatScreenTime(ms: Long): String {
        val totalMin = Math.round(ms / 60000.0)
        val h = totalMin / 60
        val m = totalMin % 60
        return if (h > 0) "${h}時間${m}分" else "${m}分"
    }
}

/** 予約した時刻の通知と、端末の再起動・アプリ更新後の予約し直し */
class DailySummaryReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            DailySummary.ACTION_FIRE -> {
                DailySummary.notify(context)
                DailySummary.reschedule(context)
            }
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> DailySummary.reschedule(context)
        }
    }
}
