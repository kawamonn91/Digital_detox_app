package com.debtrunapp

/**
 * YouTube ショートの「次の動画へ」の切り替え(画面遷移)を、アクセシビリティイベントから見つける。
 *
 * ショートは、上にスワイプして次の動画に移るとき、スクロール量(scrollDeltaY)を報告しない
 * (スクロールイベントが出ても、量は0)ので、スクロール量では数えられない。
 * そのかわり、動画が切り替わるたびに、進行バー(SeekBar)の内容変更イベント(TYPE_WINDOW_CONTENT_CHANGED)が
 * 1回出る。実機の YouTube 21.35 で、8回スワイプして8回出て、何もしない間(約40秒の再生)は1回も出ないことを確かめた。
 * これを「ショート1本ぶん = 画面1枚ぶんの遷移」として数える。
 *
 * 数え間違いを避けるため:
 *  - 短い間([MIN_INTERVAL_MS])に続けて出たイベントは、1回の切り替えとして扱う(1回の切り替えで、内容の違う
 *    SeekBar のイベントが続けて出ることがある)
 *  - 通常のスクロール量を数えた直後([SCROLL_OVERLAP_MS])は数えない。将来、YouTube がショートでもスクロール量を
 *    報告するようになったとき、同じ動きを、スクロール量と遷移の両方で二重に数えないため
 */
class ShortsPageDetector(
    private val minIntervalMs: Long = MIN_INTERVAL_MS,
    private val scrollOverlapMs: Long = SCROLL_OVERLAP_MS,
) {
    private var lastPageAt = NEVER
    private var lastScrollCountedAt = NEVER

    /** 通常のスクロール量を数えたときに呼ぶ */
    fun onScrollCounted(nowMs: Long) {
        lastScrollCountedAt = nowMs
    }

    /**
     * 内容変更イベントを渡す。動画の切り替え(画面1枚ぶんの遷移)として数えるなら true。
     * @param className イベントの発生元のビューのクラス名
     * @param nowMs イベントの時刻(ms)
     */
    fun onContentChanged(className: CharSequence?, nowMs: Long): Boolean {
        if (className?.toString() != SEEK_BAR) return false
        if (nowMs - lastPageAt < minIntervalMs) return false
        lastPageAt = nowMs
        // スクロール量として数えたばかりの動きは、遷移としては数えない(ただし、切り替えとしては覚えておく)
        if (nowMs - lastScrollCountedAt < scrollOverlapMs) return false
        return true
    }

    companion object {
        const val PACKAGE_NAME = "com.google.android.youtube"
        const val SEEK_BAR = "android.widget.SeekBar"

        /** これより短い間隔で続けて出たイベントは、同じ切り替え */
        const val MIN_INTERVAL_MS = 700L

        /** スクロール量を数えてからこの間に出た切り替えは、二重になるので数えない */
        const val SCROLL_OVERLAP_MS = 1_500L

        private const val NEVER = Long.MIN_VALUE / 2
    }
}
