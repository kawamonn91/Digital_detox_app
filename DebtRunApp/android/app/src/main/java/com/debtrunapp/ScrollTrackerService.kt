package com.debtrunapp

import android.accessibilityservice.AccessibilityService
import android.os.Build
import android.util.Log
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * ScrollTrackerService
 *
 * AccessibilityService で対象アプリ(SNS・動画アプリ)のスクロールイベントを受け取り、
 * スクロール量(px)を日付・アプリ別に [ScrollLog] へ保存する。
 * YouTube ショートは、次の動画へ切り替わってもスクロール量が報告されないので、切り替わり自体を
 * [ShortsPageDetector] で見つけて、1本 = 画面1枚ぶんとして保存する。
 * アプリ(JS)が起動中なら "ScrollTrackerUpdate" イベントも送り、画面をすぐ更新させる。
 */
class ScrollTrackerService : AccessibilityService() {

    companion object {
        private const val TAG = "ScrollTrackerService"
        const val EVENT_SCROLL_UPDATE = "ScrollTrackerUpdate"

        /** JS へのイベント送信の最短間隔(スクロール中に毎フレーム送らないため) */
        private const val EMIT_INTERVAL_MS = 1_500L

        /** AccessibilityRecord の「未設定」値(スクロール量を報告しないイベントでは -1 のまま) */
        private const val UNDEFINED = -1
    }

    private var screenHeightPx = 1920f
    private var lastEmitAt = 0L
    /** scrollDeltaY を報告しないアプリ用に、直前の scrollY をビューごとに覚えておく */
    private val lastScrollY = mutableMapOf<String, Int>()

    /** YouTube ショートの動画の切り替えを、スクロール量とは別に数える(ショートはスクロール量を報告しないため) */
    private val shortsDetector = ShortsPageDetector()

    override fun onServiceConnected() {
        super.onServiceConnected()
        val wm = getSystemService(WindowManager::class.java)
        screenHeightPx = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            wm.currentWindowMetrics.bounds.height().toFloat()
        } else {
            val metrics = android.util.DisplayMetrics()
            @Suppress("DEPRECATION")
            wm.defaultDisplay.getRealMetrics(metrics)
            metrics.heightPixels.toFloat()
        }
        ScrollLog.setScreenHeight(this, screenHeightPx)
        Log.d(TAG, "connected, screen height: $screenHeightPx px")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return
        val pkg = event.packageName?.toString() ?: return
        if (!TrackedApps.NAMES.containsKey(pkg)) return

        when (event.eventType) {
            AccessibilityEvent.TYPE_VIEW_SCROLLED -> {
                val scrolledPx = scrolledPixels(event, pkg)
                if (scrolledPx <= 0f) return
                if (pkg == ShortsPageDetector.PACKAGE_NAME) shortsDetector.onScrollCounted(event.eventTime)
                ScrollLog.add(this, pkg, scrolledPx)
                emitUpdate(pkg)
            }
            // YouTube ショートで次の動画へ切り替わったら、画面1枚ぶん(1本 = 画面1枚)として数える
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
                if (pkg != ShortsPageDetector.PACKAGE_NAME) return
                val counted = shortsDetector.onContentChanged(event.className, event.eventTime)
                // 動作の確認用(ショートの切り替えを数えたか。SeekBar 以外の内容変更は、量が多いので出さない)
                if (event.className?.toString() == ShortsPageDetector.SEEK_BAR) Log.d(TAG, "YouTube SeekBar event, counted as page change: $counted")
                if (counted) {
                    ScrollLog.add(this, pkg, screenHeightPx)
                    emitUpdate(pkg)
                }
            }
        }
    }

    /**
     * このイベントで下方向(フィードを進める方向)にスクロールした量(px)。上に戻った分は数えない。
     *
     * Android 9 以降はスクロール量(scrollDeltaY)が付いてくる。量が0のイベント(RecyclerView がレイアウト後に送るものなど)は
     * 実際には動いていないので数えない。量が報告されないイベントは、同じビューの scrollY の変化から求める。
     * どちらも分からない場合は推測で足さない(以前の実装は1回あたり画面の8%を足していたが、
     * レイアウトのたびに来るイベントまで負債に数えてしまうため)。
     */
    private fun scrolledPixels(event: AccessibilityEvent, pkg: String): Float {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P &&
            !(event.scrollDeltaX == UNDEFINED && event.scrollDeltaY == UNDEFINED)
        ) {
            return event.scrollDeltaY.coerceAtLeast(0).toFloat()
        }
        if (event.scrollY >= 0 && event.maxScrollY > 0) {
            val viewKey = "$pkg|${event.className}|${event.windowId}"
            val previous = lastScrollY.put(viewKey, event.scrollY) ?: return 0f
            return (event.scrollY - previous).coerceAtLeast(0).toFloat()
        }
        return 0f
    }

    private fun emitUpdate(pkg: String) {
        val now = System.currentTimeMillis()
        if (now - lastEmitAt < EMIT_INTERVAL_MS) return
        lastEmitAt = now
        try {
            // New Architecture では reactNativeHost は使えない(例外になる)ので reactHost から取る
            val reactContext = (application as? ReactApplication)?.reactHost?.currentReactContext ?: return
            ScrollLog.flush(this, now)
            val params = Arguments.createMap().apply {
                putString("packageName", pkg)
                putString("appName", TrackedApps.nameOf(pkg))
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_SCROLL_UPDATE, params)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to emit scroll update: ${e.message}")
        }
    }

    override fun onInterrupt() {
        ScrollLog.flush(this)
    }

    override fun onDestroy() {
        ScrollLog.flush(this)
        super.onDestroy()
    }
}
