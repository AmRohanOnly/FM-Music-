package com.fmmusic.client.network

import com.fmmusic.client.data.MusicCatalogData
import com.fmmusic.client.model.MusicTrack
import com.metrolist.innertubex.InnerTube
import com.metrolist.innertubex.models.YouTubeClient
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.statement.bodyAsText
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

import com.metrolist.innertubex.cipher.PlayerConfigRepository
import com.metrolist.innertubex.cipher.RemotePlayerConfigStore
import com.metrolist.innertubex.cipher.YouTubeCipherService
import com.metrolist.innertubex.extraction.AudioQuality
import com.metrolist.innertubex.extraction.ContentHints
import com.metrolist.innertubex.extraction.InnerTubeExtractor
import com.metrolist.innertubex.extraction.StreamExtractor
import com.metrolist.innertubex.extraction.YtConfigParserImpl
import io.ktor.client.plugins.HttpTimeout
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.withTimeout
import java.util.concurrent.ConcurrentHashMap

data class VisitorSessionState(
    val isInitialized: Boolean = false,
    val visitorData: String? = null,
    val clientName: String = "WEB_REMIX",
    val clientVersion: String = "1.20240101.01.00",
    val isPublicBrowsingActive: Boolean = false,
    val lastSessionStartTimestamp: Long = 0L,
    val statusMessage: String = "Uninitialized"
)

data class PlayerStreamInfo(
    val videoId: String,
    val streamUrl: String,
    val mimeType: String = "audio/mp4",
    val bitrate: Int = 128000,
    val itag: Int? = null,
    val expiresInSeconds: Long = 21600L,
    val source: String = "InnerTube Player Endpoint",
    val headers: Map<String, String> = emptyMap(),
    val isSigned: Boolean = false
) {
    val formatDescription: String
        get() = "$source • ${bitrate / 1000}kbps ${mimeType.substringBefore(';')}"
}

class InnerTubeClientService(
    private val scope: CoroutineScope,
    private val suppliedExtractor: StreamExtractor? = null,
    private val initializeSession: Boolean = true,
    private val nowMs: () -> Long = System::currentTimeMillis,
) {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val httpClient = HttpClient(OkHttp) {
        install(HttpTimeout) {
            requestTimeoutMillis = 20_000
            connectTimeoutMillis = 10_000
            socketTimeoutMillis = 15_000
        }
        install(ContentNegotiation) {
            json(json)
        }
    }

    val innerTube = InnerTube(httpClient)
    private val extractor: StreamExtractor by lazy {
        suppliedExtractor ?: run {
            val store = RemotePlayerConfigStore(httpClient, PlayerConfigRepository.disabled())
            val cipher = YouTubeCipherService(httpClient, store)
            InnerTubeExtractor(
                configParser = YtConfigParserImpl(httpClient, innerTube, store, cipherService = cipher),
                cipherService = cipher,
                innerTube = innerTube,
            )
        }
    }
    private var visitorJob: Job? = null

    private val mutableSessionState = MutableStateFlow(VisitorSessionState())
    val sessionState = mutableSessionState.asStateFlow()

    private val mutableVisitorData = MutableStateFlow<String?>(null)
    val visitorData = mutableVisitorData.asStateFlow()

    init {
        // Step 1: Initialize an unauthenticated visitor session for InnerTube
        if (initializeSession) initializeVisitorSession()
    }

    fun initializeVisitorSession() {
        startVisitorSession()
    }

    /**
     * Initializes the InnerTube client and starts a visitor session for public music browsing.
     * Generates or fetches visitorData (X-Goog-Visitor-Id) and configures the unauthenticated session.
     */
    fun startVisitorSession(): VisitorSessionState {
        visitorJob?.cancel()
        val newState = VisitorSessionState(
            clientVersion = YouTubeClient.WEB_REMIX.clientVersion,
            lastSessionStartTimestamp = nowMs(),
            statusMessage = "Connecting to music service…"
        )
        mutableSessionState.value = newState
        visitorJob = scope.launch(Dispatchers.IO) {
            try {
                val freshToken = innerTube.fetchFreshVisitorData()
                if (!freshToken.isNullOrBlank()) {
                    mutableVisitorData.value = freshToken
                    innerTube.visitorData = freshToken
                    mutableSessionState.value = newState.copy(
                        isInitialized = true,
                        isPublicBrowsingActive = true,
                        visitorData = freshToken,
                        statusMessage = "Music service connected"
                    )
                } else {
                    mutableSessionState.value = newState.copy(statusMessage = "Visitor session unavailable")
                }
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                mutableSessionState.value = newState.copy(statusMessage = "Unable to connect. Check your connection.")
            }
        }

        return newState
    }

    /**
     * Search YouTube Music catalog using InnerTube unauthenticated session
     * and map retrieved metadata directly into the app's MusicTrack UI models.
     */
    suspend fun searchTracks(query: String): List<MusicTrack> = withContext(Dispatchers.IO) {
        val trimmed = query.trim()
        if (trimmed.isBlank()) return@withContext emptyList()

        try {
            val response = innerTube.search(
                client = YouTubeClient.WEB_REMIX,
                query = trimmed
            )
            val responseText = response.bodyAsText()
            val parsedTracks = parseInnerTubeSearchResponse(responseText)

            return@withContext parsedTracks
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            throw IllegalStateException("Search unavailable. Check your connection and try again.")
        }
    }

    /**
     * Parse raw InnerTube JSON search payload and map track title, artist name,
     * thumbnail URL, video ID, and duration into MusicTrack models.
     */
    private fun parseInnerTubeSearchResponse(rawJson: String): List<MusicTrack> {
        val tracks = mutableListOf<MusicTrack>()
        try {
            val root = json.parseToJsonElement(rawJson).jsonObject
            findMusicResponsiveListItemRenderers(root, tracks)
        } catch (_: Exception) {}
        return tracks
    }

    private fun findMusicResponsiveListItemRenderers(
        element: JsonElement,
        resultList: MutableList<MusicTrack>
    ) {
        when (element) {
            is JsonObject -> {
                if (element.containsKey("musicResponsiveListItemRenderer")) {
                    val renderer = element["musicResponsiveListItemRenderer"]?.jsonObject
                    if (renderer != null) {
                        val track = mapRendererToTrack(renderer)
                        if (track != null) {
                            resultList.add(track)
                        }
                    }
                } else {
                    for ((_, value) in element) {
                        findMusicResponsiveListItemRenderers(value, resultList)
                    }
                }
            }
            is JsonArray -> {
                for (item in element) {
                    findMusicResponsiveListItemRenderers(item, resultList)
                }
            }
            else -> {}
        }
    }

    private fun mapRendererToTrack(renderer: JsonObject): MusicTrack? {
        try {
            // 1. Extract Video ID
            val playNav = renderer["overlay"]
                ?.jsonObject?.get("musicItemThumbnailOverlayRenderer")
                ?.jsonObject?.get("content")
                ?.jsonObject?.get("musicPlayButtonRenderer")
                ?.jsonObject?.get("playNavigationEndpoint")
                ?.jsonObject?.get("watchEndpoint")
                ?.jsonObject?.get("videoId")
                ?.jsonPrimitive?.content

            val navVideoId = renderer["navigationEndpoint"]
                ?.jsonObject?.get("watchEndpoint")
                ?.jsonObject?.get("videoId")
                ?.jsonPrimitive?.content

            val videoId = playNav ?: navVideoId ?: return null

            // 2. Extract Title & Artist from flexColumns
            val flexColumns = renderer["flexColumns"]?.jsonArray ?: return null
            if (flexColumns.isEmpty()) return null

            val title = flexColumns.getOrNull(0)
                ?.jsonObject?.get("musicResponsiveListItemFlexColumnRenderer")
                ?.jsonObject?.get("text")
                ?.jsonObject?.get("runs")
                ?.jsonArray?.getOrNull(0)
                ?.jsonObject?.get("text")
                ?.jsonPrimitive?.content ?: "Unknown Track"

            val artistRuns = flexColumns.getOrNull(1)
                ?.jsonObject?.get("musicResponsiveListItemFlexColumnRenderer")
                ?.jsonObject?.get("text")
                ?.jsonObject?.get("runs")
                ?.jsonArray

            val artist = artistRuns?.getOrNull(0)
                ?.jsonObject?.get("text")
                ?.jsonPrimitive?.content ?: "FM Music Artist"

            // 3. Extract Duration
            val durationText = artistRuns?.lastOrNull()
                ?.jsonObject?.get("text")
                ?.jsonPrimitive?.content
            val durationSeconds = parseDurationToSeconds(durationText)

            // 4. Extract Thumbnail
            val thumbnails = renderer["thumbnail"]
                ?.jsonObject?.get("musicThumbnailRenderer")
                ?.jsonObject?.get("thumbnail")
                ?.jsonObject?.get("thumbnails")
                ?.jsonArray

            val thumbnail = thumbnails?.lastOrNull()
                ?.jsonObject?.get("url")
                ?.jsonPrimitive?.content
                ?: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80"

            // 5. Modular media streaming URL
            val streamUrl = ""

            return MusicTrack(
                id = videoId,
                title = title,
                artist = artist,
                album = "YouTube Music",
                durationSeconds = durationSeconds,
                vibe = "Search",
                youtubeId = videoId,
                streamUrl = streamUrl,
                thumbnailUrl = thumbnail
            )
        } catch (_: Exception) {
            return null
        }
    }

    private fun parseDurationToSeconds(durationText: String?): Long {
        if (durationText.isNullOrBlank()) return 210L
        val parts = durationText.trim().split(":")
        return when (parts.size) {
            2 -> {
                val mins = parts[0].toLongOrNull() ?: 3L
                val secs = parts[1].toLongOrNull() ?: 30L
                (mins * 60) + secs
            }
            3 -> {
                val hrs = parts[0].toLongOrNull() ?: 0L
                val mins = parts[1].toLongOrNull() ?: 3L
                val secs = parts[2].toLongOrNull() ?: 30L
                (hrs * 3600) + (mins * 60) + secs
            }
            else -> 210L
        }
    }

    private data class CachedStream(val info: PlayerStreamInfo, val expiresAtMs: Long)
    private val streamCache = ConcurrentHashMap<String, CachedStream>()

    /** Resolve actual audio using the library's client selection and cipher handling. */
    suspend fun extractPlayerStream(videoId: String): PlayerStreamInfo = withContext(Dispatchers.IO) {
        val cleanId = videoId.trim()
        require(Regex("[A-Za-z0-9_-]{11}").matches(cleanId)) { "This track has no valid video ID." }
        streamCache[cleanId]?.let { cached ->
            if (cached.expiresAtMs > nowMs() + 60_000) return@withContext cached.info
            streamCache.remove(cleanId)
        }
        val stream = withTimeout(45_000) {
            extractor.extract(
                videoId = cleanId,
                hints = ContentHints(wantVideo = false).withStreamCapabilities(
                    allowHls = true, allowSabr = false, allowBoundedRange = false
                ),
                audioQuality = AudioQuality.HIGH,
            )
        } ?: throw IllegalStateException("No playable audio is available for this track.")
        check(stream.videoId == cleanId && stream.audioUrl.startsWith("https://")) {
            "The music service returned an invalid stream."
        }
        check(stream.sabrBootstrap == null && !stream.requireBoundedRange && !stream.useRangeChunks) {
            "This track requires an unsupported streaming transport."
        }
        val expiresAt = stream.expiresAt?.toEpochMilliseconds() ?: (nowMs() + 5 * 60_000)
        check(expiresAt > nowMs()) { "The audio link has expired. Please retry." }
        val info = PlayerStreamInfo(
            videoId = cleanId,
            streamUrl = stream.audioUrl,
            mimeType = stream.mimeType ?: "audio/mp4",
            bitrate = stream.bitrate ?: 0,
            itag = stream.itag,
            expiresInSeconds = (expiresAt - nowMs()) / 1000,
            source = "InnerTubeX • ${stream.clientName}",
            headers = stream.headers,
            isSigned = false,
        )
        if (streamCache.size >= 50) streamCache.clear()
        streamCache[cleanId] = CachedStream(info, expiresAt)
        info
    }

    fun invalidateStream(videoId: String) {
        streamCache.remove(videoId)
    }

    fun close() {
        visitorJob?.cancel()
        streamCache.clear()
        innerTube.close()
        httpClient.close()
    }
}
