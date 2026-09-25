package com.debtrunapp

/**
 * スクロール・使用時間の計測対象アプリ(パッケージ名 → 表示名)。
 * accessibility_service_config.xml の packageNames もこの一覧とそろえること。
 */
object TrackedApps {
    val NAMES = linkedMapOf(
        "com.instagram.android" to "Instagram",
        "com.instagram.barcelona" to "Threads",
        "com.twitter.android" to "X (Twitter)",
        // TikTok は地域によってパッケージ名が異なる(日本版は trill)
        "com.zhiliaoapp.musically" to "TikTok",
        "com.ss.android.ugc.trill" to "TikTok",
        // YouTube は、ショートの切り替えを ShortsPageDetector で数える(通常のスクロールは量が報告されないため数えられない)
        "com.google.android.youtube" to "YouTube",
        "com.facebook.katana" to "Facebook",
        "com.reddit.frontpage" to "Reddit",
        "com.pinterest" to "Pinterest",
        "com.snapchat.android" to "Snapchat",
    )

    fun nameOf(packageName: String): String = NAMES[packageName] ?: packageName
}
