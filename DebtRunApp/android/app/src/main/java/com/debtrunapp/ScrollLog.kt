package com.debtrunapp

import android.content.Context
import android.content.SharedPreferences
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * 日付・アプリ別のスクロール量(px)を端末に保存する。
 *
 * スクロールは AccessibilityService の中で起きるため、アプリ(JS)が起動していない間も
 * ここに貯めておき、JS 側は画面を開いたときに [readAll] で読み出す。
 * キーは「YYYY-MM-DD|パッケージ名」(日付は端末のローカル日付)。
 *
 * イベントは短い間隔で大量に来るので、メモリに貯めて [FLUSH_INTERVAL_MS] ごとにまとめて書き込む。
 */
object ScrollLog {
    private const val PREFS = "debtrun_scroll_log"
    private const val KEY_SCREEN_HEIGHT = "__screen_height_px"
    private const val FLUSH_INTERVAL_MS = 3_000L

    private val pending = mutableMapOf<String, Float>()
    private var lastFlushAt = 0L

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun dateKey(time: Long = System.currentTimeMillis()): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(time))

    @Synchronized
    fun add(context: Context, packageName: String, px: Float, now: Long = System.currentTimeMillis()) {
        val key = "${dateKey(now)}|$packageName"
        pending[key] = (pending[key] ?: 0f) + px
        if (now - lastFlushAt >= FLUSH_INTERVAL_MS) flush(context, now)
    }

    @Synchronized
    fun flush(context: Context, now: Long = System.currentTimeMillis()) {
        lastFlushAt = now
        if (pending.isEmpty()) return
        val p = prefs(context)
        val editor = p.edit()
        pending.forEach { (key, px) -> editor.putFloat(key, p.getFloat(key, 0f) + px) }
        editor.apply()
        pending.clear()
    }

    fun setScreenHeight(context: Context, px: Float) {
        prefs(context).edit().putFloat(KEY_SCREEN_HEIGHT, px).apply()
    }

    /** 画面の高さ(px)。サービスがまだ一度も起動していなければ null */
    fun screenHeight(context: Context): Float? =
        prefs(context).getFloat(KEY_SCREEN_HEIGHT, 0f).takeIf { it > 0f }

    data class Entry(val date: String, val packageName: String, val px: Float)

    /** 保存済みの全記録(書き込み待ちの分も含む) */
    @Synchronized
    fun readAll(context: Context): List<Entry> {
        val totals = mutableMapOf<String, Float>()
        prefs(context).all.forEach { (key, value) ->
            if (key.contains('|') && value is Float) totals[key] = value
        }
        pending.forEach { (key, px) -> totals[key] = (totals[key] ?: 0f) + px }
        return totals.map { (key, px) ->
            val (date, pkg) = key.split('|', limit = 2)
            Entry(date, pkg, px)
        }
    }

    @Synchronized
    fun clear(context: Context) {
        pending.clear()
        val height = screenHeight(context)
        prefs(context).edit().clear().apply()
        if (height != null) setScreenHeight(context, height)
    }
}
