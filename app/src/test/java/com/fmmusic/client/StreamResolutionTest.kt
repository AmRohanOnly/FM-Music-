package com.fmmusic.client

import com.fmmusic.client.network.InnerTubeClientService
import com.metrolist.innertubex.extraction.AudioQuality
import com.metrolist.innertubex.extraction.ContentHints
import com.metrolist.innertubex.extraction.ExtractedStream
import com.metrolist.innertubex.extraction.StreamExtractor
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import kotlin.time.Instant

class StreamResolutionTest {
    private val videoId = "ElZfdU54Cp8"
    private var now = 1_000_000L

    private fun stream(id: String = videoId, expires: Long = now + 120_000) = ExtractedStream(
        videoId = id, audioUrl = "https://example.com/audio.m4a",
        headers = mapOf("User-Agent" to "test-player", "Referer" to "https://www.youtube.com/"),
        loudnessDb = null, expiresAt = Instant.fromEpochMilliseconds(expires),
        contentLengthBytes = null, itag = 140, mimeType = "audio/mp4", codecs = "mp4a.40.2",
        bitrate = 128000, sampleRate = 44100, clientName = "TEST", profileId = "TEST",
        requireBoundedRange = false, rangeChunkSizeBytes = 0,
    )

    private class FakeExtractor(val resolve: suspend (String) -> ExtractedStream?) : StreamExtractor {
        var calls = 0
        override suspend fun prewarm() {}
        override suspend fun extract(
            videoId: String, hints: ContentHints, excludedClients: Set<String>,
            audioQuality: AudioQuality, clientPlaybackNonce: String,
        ): ExtractedStream? {
            calls++
            assertTrue(hints.allowHls)
            assertFalse(hints.allowSabr)
            assertFalse(hints.allowBoundedRange)
            return resolve(videoId)
        }
    }

    private fun service(extractor: StreamExtractor) = InnerTubeClientService(
        CoroutineScope(Dispatchers.Default), extractor, initializeSession = false, nowMs = { now }
    )

    @Test fun preservesResolvedAudioAndRequiredHeaders() = runBlocking {
        val service = service(FakeExtractor { stream() })
        try {
            val result = service.extractPlayerStream(videoId)
            assertEquals("https://example.com/audio.m4a", result.streamUrl)
            assertEquals("test-player", result.headers["User-Agent"])
            assertEquals(140, result.itag)
            assertFalse(result.isSigned)
            assertFalse(service.sessionState.value.isInitialized)
            assertNull(service.sessionState.value.visitorData)
        } finally { service.close() }
    }

    @Test fun cachesOnlyFreshStreamsAndSupportsInvalidation() = runBlocking {
        val extractor = FakeExtractor { stream() }
        val service = service(extractor)
        try {
            service.extractPlayerStream(videoId)
            service.extractPlayerStream(videoId)
            assertEquals(1, extractor.calls)
            now += 70_000
            service.extractPlayerStream(videoId)
            assertEquals(2, extractor.calls)
            service.invalidateStream(videoId)
            service.extractPlayerStream(videoId)
            assertEquals(3, extractor.calls)
        } finally { service.close() }
    }

    @Test fun missingStreamFailsInsteadOfReturningUnrelatedAudio() = runBlocking {
        val service = service(FakeExtractor { null })
        try {
            try { service.extractPlayerStream(videoId); fail("Must not fabricate a stream") }
            catch (expected: IllegalStateException) { assertTrue(expected.message!!.contains("No playable audio")) }
        } finally { service.close() }
    }

    @Test fun cancellationIsNotReplacedByFallbackAudio() = runBlocking {
        val service = service(FakeExtractor { throw CancellationException("cancelled") })
        try {
            try { service.extractPlayerStream(videoId); fail("Expected cancellation") }
            catch (expected: CancellationException) { assertEquals("cancelled", expected.message) }
        } finally { service.close() }
    }

    @Test fun rejectsWrongVideoAndExpiredUrls() = runBlocking {
        for (result in listOf(stream(id = "dQw4w9WgXcQ"), stream(expires = now - 1))) {
            val service = service(FakeExtractor { result })
            try {
                try { service.extractPlayerStream(videoId); fail("Expected rejection") }
                catch (_: IllegalStateException) { }
            } finally { service.close() }
        }
    }

    @Test fun rejectsInvalidVideoIdsBeforeNetworking() = runBlocking {
        val extractor = FakeExtractor { stream() }
        val service = service(extractor)
        try {
            try { service.extractPlayerStream("bad-id"); fail("Expected invalid ID") }
            catch (_: IllegalArgumentException) { }
            assertEquals(0, extractor.calls)
        } finally { service.close() }
    }
}
