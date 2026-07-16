package com.debtrun

import android.content.Intent
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * ScrollTrackerNativeModule
 *
 * JS側から ScrollTrackerService の状態を制御するためのブリッジモジュール。
 * - アクセシビリティ許可チェック
 * - 設定画面を開く
 * - セッションデータの読み出し
 */
class ScrollTrackerNativeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "ScrollTrackerNM"
    }

    override fun getName() = "ScrollTracker"

    /**
     * AccessibilityService が有効か確認
     */
    @ReactMethod
    fun isAccessibilityEnabled(promise: Promise) {
        val serviceName = "${reactApplicationContext.packageName}/.ScrollTrackerService"
        val enabled = Settings.Secure.getString(
            reactApplicationContext.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        )?.contains(serviceName) == true
        promise.resolve(enabled)
    }

    /**
     * アクセシビリティ設定画面を開く
     */
    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * セッション中のスクロールデータを取得
     * @returns { packageName: { totalPx, totalScreens, appName } }
     */
    @ReactMethod
    fun getSessionScrollData(promise: Promise) {
        try {
            val data = ScrollTrackerService.getSessionData()
            val result = Arguments.createMap()

            data.forEach { (pkg, totalPx) ->
                val appInfo = Arguments.createMap().apply {
                    putString("appName", ScrollTrackerService.TARGET_APPS[pkg] ?: pkg)
                    putDouble("totalPx", totalPx.toDouble())
                    // 画面数はJS側で計算（設定値を使うため）
                }
                result.putMap(pkg, appInfo)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * セッションデータをリセット
     */
    @ReactMethod
    fun clearSessionData(promise: Promise) {
        ScrollTrackerService.clearSession()
        promise.resolve(true)
    }
}
