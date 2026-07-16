package com.debtrun

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * ScrollTrackerService
 *
 * AccessibilityService を使用して他アプリのスクロールイベントを監視し、
 * スクロール距離（画面数）を計測する。
 * 計測データは RCTDeviceEventEmitter 経由で React Native に送信される。
 *
 * 対象: Instagram, X(Twitter), TikTok, YouTube, Facebook, Reddit, Pinterest
 */
class ScrollTrackerService : AccessibilityService() {

    companion object {
        private const val TAG = "ScrollTrackerService"
        const val EVENT_SCROLL_UPDATE = "ScrollTrackerUpdate"

        // アプリのパッケージ名 → 表示名マッピング
        val TARGET_APPS = mapOf(
            "com.instagram.android"    to "Instagram",
            "com.twitter.android"      to "X (Twitter)",
            "com.zhiliaoapp.musically" to "TikTok",
            "com.google.android.youtube" to "YouTube",
            "com.facebook.katana"      to "Facebook",
            "com.reddit.frontpage"     to "Reddit",
            "com.pinterest"            to "Pinterest",
        )

        // セッション中のスクロール累計（アプリ別）
        private val sessionScrollPx = mutableMapOf<String, Float>()
        private var screenHeightPx: Float = 1920f  // デフォルト値
        private var isInitialized = false

        fun getSessionData(): Map<String, Float> = sessionScrollPx.toMap()
        fun clearSession() = sessionScrollPx.clear()
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d(TAG, "ScrollTrackerService connected")
        isInitialized = true

        // 画面の高さを取得
        val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
        screenHeightPx = metrics.heightPixels.toFloat()
        Log.d(TAG, "Screen height: $screenHeightPx px")

        // サービス設定を動的に更新（念のため）
        serviceInfo = serviceInfo.apply {
            eventTypes = AccessibilityEvent.TYPE_VIEW_SCROLLED or
                         AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
            notificationTimeout = 100
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return

        val pkg = event.packageName?.toString() ?: return
        if (!TARGET_APPS.containsKey(pkg)) return

        when (event.eventType) {
            AccessibilityEvent.TYPE_VIEW_SCROLLED -> {
                val scrollY = event.scrollY
                val maxScrollY = event.maxScrollY
                val deltaY = event.scrollDeltaY  // API 28+

                // スクロール量をピクセル換算
                val scrolledPx = when {
                    // API 28+ で deltaY が利用可能な場合
                    deltaY != 0 -> deltaY.toFloat().coerceAtLeast(0f)
                    // フォールバック: スクロール位置の差分を推定
                    maxScrollY > 0 -> {
                        val fraction = scrollY.toFloat() / maxScrollY.toFloat()
                        // 1フレームで5%以上スクロールした場合のみカウント（ノイズ除去）
                        if (fraction > 0.02f) screenHeightPx * 0.05f else 0f
                    }
                    else -> screenHeightPx * 0.08f  // デフォルト推定値
                }

                if (scrolledPx > 0f) {
                    sessionScrollPx[pkg] = (sessionScrollPx[pkg] ?: 0f) + scrolledPx
                    emitScrollUpdate(pkg, scrolledPx)
                }
            }
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                // アプリ切り替え時のログ（オプション）
                Log.v(TAG, "App foreground: $pkg")
            }
        }
    }

    override fun onInterrupt() {
        Log.d(TAG, "ScrollTrackerService interrupted")
    }

    override fun onDestroy() {
        super.onDestroy()
        isInitialized = false
        Log.d(TAG, "ScrollTrackerService destroyed")
    }

    /**
     * スクロールイベントを React Native に送信
     */
    private fun emitScrollUpdate(packageName: String, deltaPx: Float) {
        try {
            val reactContext = getReactContext() ?: return

            val totalPx = sessionScrollPx[packageName] ?: 0f
            val totalScreens = totalPx / screenHeightPx

            val params = com.facebook.react.bridge.Arguments.createMap().apply {
                putString("packageName", packageName)
                putString("appName", TARGET_APPS[packageName] ?: packageName)
                putDouble("deltaPx", deltaPx.toDouble())
                putDouble("totalPx", totalPx.toDouble())
                putDouble("totalScreens", totalScreens.toDouble())
                putDouble("screenHeightPx", screenHeightPx.toDouble())
            }

            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_SCROLL_UPDATE, params)

        } catch (e: Exception) {
            Log.w(TAG, "Failed to emit scroll update: ${e.message}")
        }
    }

    private fun getReactContext(): ReactContext? {
        return try {
            val app = applicationContext as? ReactApplication
            app?.reactNativeHost?.reactInstanceManager?.currentReactContext
        } catch (e: Exception) {
            null
        }
    }
}
