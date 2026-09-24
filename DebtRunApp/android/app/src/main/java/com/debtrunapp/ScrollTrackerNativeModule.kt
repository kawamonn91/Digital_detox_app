package com.debtrunapp

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * JS から [ScrollTrackerService] の状態確認と、保存済みスクロール記録([ScrollLog])の読み出しを行う。
 */
class ScrollTrackerNativeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "ScrollTracker"

    /** アクセシビリティサービス(スクロール計測)が有効か */
    @ReactMethod
    fun isAccessibilityEnabled(promise: Promise) {
        val component = ComponentName(reactApplicationContext, ScrollTrackerService::class.java)
        val enabled = Settings.Secure.getString(
            reactApplicationContext.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
        )?.split(':')?.any { ComponentName.unflattenFromString(it) == component } == true
        promise.resolve(enabled)
    }

    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            reactApplicationContext.startActivity(
                Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    /**
     * 保存済みのスクロール記録すべて。
     * @returns { screenHeightPx: number | null, entries: [{ date, packageName, appName, px }] }
     */
    @ReactMethod
    fun getScrollLog(promise: Promise) {
        try {
            val context = reactApplicationContext
            val entries = Arguments.createArray()
            ScrollLog.readAll(context).forEach { entry ->
                entries.pushMap(Arguments.createMap().apply {
                    putString("date", entry.date)
                    putString("packageName", entry.packageName)
                    putString("appName", TrackedApps.nameOf(entry.packageName))
                    putDouble("px", entry.px.toDouble())
                })
            }
            val result = Arguments.createMap().apply {
                val height = ScrollLog.screenHeight(context)
                if (height != null) putDouble("screenHeightPx", height.toDouble()) else putNull("screenHeightPx")
                putArray("entries", entries)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    // JS の NativeEventEmitter が "ScrollTrackerUpdate" の購読時に呼ぶ(イベントはサービス側から送るので何もしない)
    @ReactMethod
    fun addListener(eventName: String) = Unit

    @ReactMethod
    fun removeListeners(count: Double) = Unit

    /** スクロール記録をすべて消す(設定画面の「データを消去」用) */
    @ReactMethod
    fun clearScrollLog(promise: Promise) {
        ScrollLog.clear(reactApplicationContext)
        promise.resolve(true)
    }
}
