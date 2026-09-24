package com.debtrunapp

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** JS の設定([DailySummary] の時刻・有効/無効・換算比率)をネイティブ側に渡す */
class DailySummaryModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "DailySummary"

    @ReactMethod
    fun configure(hour: Double, minute: Double, enabled: Boolean, metersPerScreen: Double, promise: Promise) {
        try {
            DailySummary.configure(reactApplicationContext, hour.toInt(), minute.toInt(), enabled, metersPerScreen)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    /** まとめ通知を今すぐ出す(設定画面の「テスト通知」用) */
    @ReactMethod
    fun showNow(promise: Promise) {
        DailySummary.notify(reactApplicationContext)
        promise.resolve(true)
    }
}
