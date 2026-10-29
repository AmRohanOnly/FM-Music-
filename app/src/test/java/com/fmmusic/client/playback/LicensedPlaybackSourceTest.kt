package com.fmmusic.client.playback

import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class LicensedPlaybackSourceTest {
    @Test
    fun acceptsSecureProviderMediaAndRedactsUriFromLogs() {
        val media = LicensedMediaItem(
            providerId = "licensed-provider",
            uri = "https://audio.example.test/track?token=private",
            title = "Example track",
            artist = "Example artist",
        )

        assertTrue("token=private" !in media.toString())
        assertTrue("uri=[REDACTED]" in media.toString())
    }

    @Test
    fun rejectsInnerTubeXAsPlaybackProvider() {
        assertThrows(IllegalArgumentException::class.java) {
            LicensedMediaItem(
                providerId = "InnerTubeX",
                uri = "https://audio.example.test/track",
                title = "Example track",
                artist = "Example artist",
            )
        }
    }

    @Test
    fun rejectsYouTubeAndGoogleVideoMediaHosts() {
        listOf(
            "https://music.youtube.com/audio",
            "https://r1.googlevideo.com/audio",
            "https://youtu.be/example",
        ).forEach { uri ->
            assertThrows(IllegalArgumentException::class.java) {
                LicensedMediaItem(
                    providerId = "licensed-provider",
                    uri = uri,
                    title = "Example track",
                    artist = "Example artist",
                )
            }
        }
    }
}
