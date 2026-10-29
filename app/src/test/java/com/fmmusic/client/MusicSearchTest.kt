package com.fmmusic.client

import org.junit.Assert.assertEquals
import org.junit.Test

class MusicSearchTest {
    @Test
    fun encodesSearchTextForOfficialYouTubeMusicUrl() {
        assertEquals(
            "https://music.youtube.com/search?q=Daft+Punk+%26+Justice",
            youtubeMusicSearchUrl("  Daft Punk & Justice  ")
        )
    }
}
