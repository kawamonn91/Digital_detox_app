package com.debtrunapp

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ShortsPageDetectorTest {
    private val seekBar = "android.widget.SeekBar"

    /** 数えた回数 */
    private fun count(detector: ShortsPageDetector, events: List<Pair<String?, Long>>): Int =
        events.count { (cls, t) -> detector.onContentChanged(cls, t) }

    @Test
    fun `実機のYouTubeで8回スワイプしたときの実際のイベントで、8本の切り替えを数える`() {
        // エミュレータの YouTube 21.35(ショート)で、uiautomator events で記録した SeekBar の内容変更イベントの時刻(ms)。
        // 8回スワイプして9件。最初の切り替えでは、0.44秒の間に2件続けて出ている
        val seekBarTimes = listOf(5_484L, 5_926L, 10_156L, 14_998L, 20_252L, 24_683L, 30_392L, 34_321L, 39_048L)
        assertEquals(8, count(ShortsPageDetector(), seekBarTimes.map { seekBar to it }))
    }

    @Test
    fun `SeekBar 以外のビューの内容変更は数えない(通常の動画の再生・操作・スクロールで出るもの)`() {
        val others = listOf(
            "android.widget.FrameLayout", "android.view.ViewGroup", "android.widget.ImageView",
            "android.widget.ProgressBar", "android.support.v7.widget.RecyclerView", null,
        )
        val events = (0 until 60).map { i -> others[i % others.size] to (i * 500L) }
        assertEquals(0, count(ShortsPageDetector(), events))
    }

    @Test
    fun `切り替えが無い間(ただ再生している)は数えない`() {
        assertEquals(0, count(ShortsPageDetector(), emptyList()))
    }

    @Test
    fun `700ms未満で続けて出たイベントは1回の切り替え。ちょうど700msなら次の切り替え`() {
        val d = ShortsPageDetector()
        assertTrue(d.onContentChanged(seekBar, 10_000))
        assertFalse(d.onContentChanged(seekBar, 10_699))
        // 数えなかったイベント(10_699)ではなく、最後に数えた時刻(10_000)から700ms たっていれば数える
        assertTrue(d.onContentChanged(seekBar, 10_700))
    }

    @Test
    fun `スクロール量を数えた直後(1秒半以内)の切り替えは、二重になるので数えない`() {
        val d = ShortsPageDetector()
        d.onScrollCounted(20_000)
        assertFalse(d.onContentChanged(seekBar, 20_500))
        // 1秒半たってからの切り替えは、別の動きなので数える
        assertTrue(d.onContentChanged(seekBar, 21_600))
    }

    @Test
    fun `スクロール量を数えていなければ、切り替えは数える`() {
        val d = ShortsPageDetector()
        assertTrue(d.onContentChanged(seekBar, 1_000))
        assertTrue(d.onContentChanged(seekBar, 5_000))
    }
}
