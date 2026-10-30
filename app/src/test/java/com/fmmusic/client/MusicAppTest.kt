package com.fmmusic.client

import com.fmmusic.client.data.MusicCatalogData
import com.fmmusic.client.model.MusicTrack
import com.fmmusic.client.network.InnerTubeClientService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MusicAppTest {
    @Test
    fun testDurationFormatting() {
        val track = MusicTrack(
            id = "test-1",
            title = "Test Song",
            artist = "Test Artist",
            durationSeconds = 268
        )
        assertEquals("4:28", track.durationFormatted)
    }

    @Test
    fun testCatalogSearchReturnsMatchingTracks() {
        val results = MusicCatalogData.search("Kesariya")
        assertFalse("Expected non-empty search results", results.isEmpty())
        assertTrue("Expected title match", results.any { it.title.contains("Kesariya", ignoreCase = true) })
    }

    @Test
    fun testVibeMixFiltering() {
        val hindiTracks = MusicCatalogData.curatedTracks.filter { it.vibe == "Hindi hits" }
        assertTrue("Expected Hindi hits in catalog", hindiTracks.size >= 3)
    }

    @Test
    fun testTrackDownloadStateHandling() {
        val track = MusicCatalogData.curatedTracks.first()
        val downloadedTrack = track.copy(isDownloaded = true)
        assertTrue(downloadedTrack.isDownloaded)
        assertFalse(track.isDownloaded)
    }

    @Test
    fun testInnerTubeServiceInitialization() = runBlocking {
        val service = InnerTubeClientService(CoroutineScope(Dispatchers.Default))
        assertNotNull(service.innerTube)
        val session = service.sessionState.value
        assertTrue("Expected visitor session to be initialized", session.isInitialized)
        assertTrue("Expected public browsing to be active", session.isPublicBrowsingActive)
        assertNotNull("Expected non-null visitor token", session.visitorData)
        assertEquals("WEB_REMIX", session.clientName)
        service.close()
    }

    @Test
    fun testStartVisitorSessionGeneratesValidSessionState() = runBlocking {
        val service = InnerTubeClientService(CoroutineScope(Dispatchers.Default))
        val session = service.startVisitorSession()
        assertTrue(session.isInitialized)
        assertTrue(session.isPublicBrowsingActive)
        assertNotNull(session.visitorData)
        assertTrue("Expected visitorData token format", session.visitorData?.startsWith("Cgt") == true)
        assertEquals("WEB_REMIX", session.clientName)
        service.close()
    }
}
