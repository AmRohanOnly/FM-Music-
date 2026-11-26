package com.fmmusic.client.network

import com.fmmusic.client.data.MusicCatalogData
import com.fmmusic.client.model.MusicTrack
import com.metrolist.innertubex.InnerTube
import com.metrolist.innertubex.cipher.YouTubeCipherService
import com.metrolist.innertubex.extraction.AudioQuality
import com.metrolist.innertubex.extraction.ContentHints
import com.metrolist.innertubex.extraction.InnerTubeExtractor
import com.metrolist.innertubex.extraction.YtConfigParserImpl
import com.metrolist.innertubex.models.YouTubeClient
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

data class VisitorSessionState(
    val isInitialized: Boolean = false,
    val visitorData: String? = null,
    val clientName: String = "WEB_REMIX",
    val clientVersion: String = "1.20260707.12.00",
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
    val contentLength: Long = 0L,
    val expiresInSeconds: Long = 21600L,
    val source: String = "InnerTube Player Endpoint",
    val isSigned: Boolean = true,
    val headers: Map<String, String> = emptyMap(),
    val extractedAtMs: Long = System.currentTimeMillis()
) {
    val formatDescription: String
        get() = "$source • ${bitrate / 1000}kbps ${mimeType.substringBefore(';')}"

    val isExpired: Boolean
        get() = (System.currentTimeMillis() - extractedAtMs) >= ((expiresInSeconds - 120).coerceAtLeast(60) * 1000L)
}

class InnerTubeClientService(private val scope: CoroutineScope) {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val httpClient = HttpClient(OkHttp) {
        engine {
            config {
                connectTimeout(8, TimeUnit.SECONDS)
                readTimeout(12, TimeUnit.SECONDS)
                callTimeout(15, TimeUnit.SECONDS)
                followRedirects(true)
            }
        }
        install(ContentNegotiation) {
            json(json)
        }
    }

    val innerTube = InnerTube(httpClient)

    private val cipherService by lazy {
        YouTubeCipherService(httpClient)
    }

    private val configParser by lazy {
        YtConfigParserImpl(httpClient, innerTube, cipherService = cipherService)
    }

    private val innerTubeExtractor by lazy {
        InnerTubeExtractor(
            configParser = configParser,
            cipherService = cipherService,
            innerTube = innerTube
        )
    }

    private val mutableSessionState = MutableStateFlow(VisitorSessionState())
    val sessionState = mutableSessionState.asStateFlow()

    private val mutableVisitorData = MutableStateFlow<String?>(null)
    val visitorData = mutableVisitorData.asStateFlow()

    @Volatile
    private var hasVerifiedVisitorData = false

    private var visitorFetchJob: Job? = null

    private val streamCache = ConcurrentHashMap<String, PlayerStreamInfo>()
    private val suggestionsCache = ConcurrentHashMap<String, List<MusicTrack>>()

    init {
        initializeVisitorSession()
    }

    fun initializeVisitorSession() {
        startVisitorSession()
    }

    fun startVisitorSession(): VisitorSessionState {
        val fallbackToken = "Cgt" + UUID.randomUUID().toString().replace("-", "").take(11).uppercase()
        hasVerifiedVisitorData = false
        try {
            innerTube.visitorData = fallbackToken
            mutableVisitorData.value = fallbackToken
        } catch (_: Exception) {}

        val newState = VisitorSessionState(
            isInitialized = true,
            visitorData = fallbackToken,
            clientName = "WEB_REMIX",
            clientVersion = "1.20260707.12.00",
            isPublicBrowsingActive = true,
            lastSessionStartTimestamp = System.currentTimeMillis(),
            statusMessage = "Visitor session active for public browsing"
        )
        mutableSessionState.value = newState

        visitorFetchJob?.cancel()
        visitorFetchJob = scope.launch(Dispatchers.IO) {
            try {
                val freshToken = withTimeoutOrNull(4500L) {
                    innerTube.fetchFreshVisitorData()
                }
                if (!freshToken.isNullOrBlank()) {
                    hasVerifiedVisitorData = true
                    mutableVisitorData.value = freshToken
                    innerTube.visitorData = freshToken
                    mutableSessionState.value = newState.copy(
                        visitorData = freshToken,
                        statusMessage = "Visitor session verified and active"
                    )
                }
            } catch (_: Exception) {
                // Keep initialized fallback visitorData
            }
        }

        return newState
    }

    private suspend fun ensureRealVisitorData(): String? {
        val current = mutableVisitorData.value
        if (hasVerifiedVisitorData && !current.isNullOrBlank()) {
            return current
        }

        withTimeoutOrNull(3500L) {
            visitorFetchJob?.join()
        }

        if (hasVerifiedVisitorData && !mutableVisitorData.value.isNullOrBlank()) {
            return mutableVisitorData.value
        }

        return try {
            val fresh = withTimeoutOrNull(4500L) {
                innerTube.fetchFreshVisitorData()
            }
            if (!fresh.isNullOrBlank()) {
                hasVerifiedVisitorData = true
                mutableVisitorData.value = fresh
                innerTube.visitorData = fresh
                mutableSessionState.value = mutableSessionState.value.copy(
                    visitorData = fresh,
                    statusMessage = "Visitor session verified and active"
                )
                fresh
            } else {
                mutableVisitorData.value
            }
        } catch (_: Exception) {
            mutableVisitorData.value
        }
    }

    suspend fun searchTracks(query: String): List<MusicTrack> = withContext(Dispatchers.IO) {
        val trimmed = query.trim()
        if (trimmed.isBlank()) return@withContext emptyList()

        try {
            val response = withTimeoutOrNull(6500L) {
                innerTube.search(
                    client = YouTubeClient.WEB_REMIX,
                    query = trimmed
                )
            }
            if (response != null) {
                val responseText = response.bodyAsText()
                val parsedTracks = parseInnerTubeSearchResponse(responseText)
                if (parsedTracks.isNotEmpty()) {
                    return@withContext parsedTracks
                }
            }
        } catch (_: Exception) {
            // Fall through to local catalog fallback
        }

        return@withContext MusicCatalogData.search(trimmed)
    }

    /**
     * Fetches YouTube Music "Up Next / Radio" suggestions for a seed track via InnerTube `/next`
     * with `playlistId = RDAMVM<videoId>`, falling back cleanly to curated vibe recommendations offline.
     */
    suspend fun fetchUpNextSuggestions(
        videoId: String,
        seedTrack: MusicTrack? = null
    ): List<MusicTrack> = withContext(Dispatchers.IO) {
        val cleanId = videoId.trim()
        if (cleanId.isBlank()) {
            return@withContext buildCatalogSuggestions(seedTrack)
        }

        suggestionsCache[cleanId]?.let { cached ->
            if (cached.isNotEmpty()) return@withContext cached
        }

        val visitorToken = ensureRealVisitorData()
        val radioPlaylistId = "RDAMVM$cleanId"

        try {
            val payload = buildJsonObject {
                put("context", buildJsonObject {
                    put("client", buildJsonObject {
                        put("clientName", "WEB_REMIX")
                        put("clientVersion", "1.20260707.12.00")
                        put("hl", "en")
                        put("gl", "US")
                        if (!visitorToken.isNullOrBlank()) {
                            put("visitorData", visitorToken)
                        }
                    })
                })
                put("videoId", cleanId)
                put("playlistId", radioPlaylistId)
                put("isAudioOnly", true)
                put("enablePersistentPlaylistPanel", true)
            }.toString()

            val responseText = withTimeoutOrNull(6500L) {
                httpClient.post("https://music.youtube.com/youtubei/v1/next?prettyPrint=false") {
                    contentType(ContentType.Application.Json)
                    header("User-Agent", YouTubeClient.USER_AGENT_WEB)
                    header("X-YouTube-Client-Name", "67")
                    header("X-YouTube-Client-Version", "1.20260707.12.00")
                    header("Origin", "https://music.youtube.com")
                    header("Referer", "https://music.youtube.com/")
                    if (!visitorToken.isNullOrBlank()) {
                        header("X-Goog-Visitor-Id", visitorToken)
                    }
                    setBody(payload)
                }.bodyAsText()
            }

            if (!responseText.isNullOrBlank()) {
                val parsed = parseUpNextRadioResponse(responseText, excludeVideoId = cleanId)
                if (parsed.isNotEmpty()) {
                    suggestionsCache[cleanId] = parsed
                    return@withContext parsed
                }
            }
        } catch (_: Exception) {}

        // Also try innertubex built-in next() endpoint if direct POST returned empty
        try {
            val resp = withTimeoutOrNull(6000L) {
                innerTube.next(
                    client = YouTubeClient.WEB_REMIX,
                    videoId = cleanId,
                    playlistId = radioPlaylistId
                )
            }
            if (resp != null) {
                val parsed = parseUpNextRadioResponse(resp.bodyAsText(), excludeVideoId = cleanId)
                if (parsed.isNotEmpty()) {
                    suggestionsCache[cleanId] = parsed
                    return@withContext parsed
                }
            }
        } catch (_: Exception) {}

        return@withContext buildCatalogSuggestions(seedTrack, excludeId = cleanId)
    }

    private fun buildCatalogSuggestions(
        seedTrack: MusicTrack?,
        excludeId: String? = null
    ): List<MusicTrack> {
        val targetVibe = seedTrack?.vibe
        val seedVid = seedTrack?.youtubeId?.ifBlank { seedTrack.id }
        val pool = MusicCatalogData.curatedTracks.filter { candidate ->
            val candVid = candidate.youtubeId.ifBlank { candidate.id }
            candidate.id != seedTrack?.id && candVid != seedVid && candVid != excludeId
        }
        val sameVibe = if (!targetVibe.isNullOrBlank()) {
            pool.filter { it.vibe.equals(targetVibe, ignoreCase = true) }
        } else {
            emptyList()
        }
        val rest = pool.filterNot { it in sameVibe }
        return (sameVibe + rest).take(12)
    }

    private fun parseUpNextRadioResponse(rawJson: String, excludeVideoId: String): List<MusicTrack> {
        val rawTracks = mutableListOf<MusicTrack>()
        try {
            val root = json.parseToJsonElement(rawJson).jsonObject
            findPlaylistPanelVideoRenderers(root, rawTracks)
        } catch (_: Exception) {}

        val seenIds = mutableSetOf(excludeVideoId)
        val result = mutableListOf<MusicTrack>()
        for (track in rawTracks) {
            val key = track.youtubeId.ifBlank { track.id }
            if (key.isNotBlank() && seenIds.add(key)) {
                result.add(track)
            }
        }
        return result.take(25)
    }

    private fun findPlaylistPanelVideoRenderers(
        element: JsonElement,
        resultList: MutableList<MusicTrack>
    ) {
        when (element) {
            is JsonObject -> {
                val panelRenderer = element["playlistPanelVideoRenderer"]?.jsonObject
                if (panelRenderer != null) {
                    mapPanelRendererToTrack(panelRenderer)?.let { resultList.add(it) }
                } else {
                    for ((_, value) in element) {
                        findPlaylistPanelVideoRenderers(value, resultList)
                    }
                }
            }
            is JsonArray -> {
                for (item in element) {
                    findPlaylistPanelVideoRenderers(item, resultList)
                }
            }
            else -> {}
        }
    }

    private fun mapPanelRendererToTrack(renderer: JsonObject): MusicTrack? {
        try {
            val videoId = renderer["videoId"]?.jsonPrimitive?.content?.trim()
                ?.takeIf { it.isNotBlank() } ?: return null

            val title = renderer["title"]?.jsonObject
                ?.get("runs")?.jsonArray?.getOrNull(0)
                ?.jsonObject?.get("text")?.jsonPrimitive?.content
                ?.trim()?.takeIf { it.isNotBlank() } ?: return null

            val bylineRuns = (renderer["longBylineText"] ?: renderer["shortBylineText"])
                ?.jsonObject?.get("runs")?.jsonArray

            val artist = bylineRuns?.getOrNull(0)
                ?.jsonObject?.get("text")?.jsonPrimitive?.content
                ?.trim()?.takeIf { it.isNotBlank() } ?: "YouTube Music"

            val album = bylineRuns?.getOrNull(2)
                ?.jsonObject?.get("text")?.jsonPrimitive?.content
                ?.trim()?.takeIf { it.isNotBlank() && !it.matches(Regex("^\\d{4}$")) }
                ?: "Up Next Radio"

            val durationText = renderer["lengthText"]?.jsonObject
                ?.get("runs")?.jsonArray?.getOrNull(0)
                ?.jsonObject?.get("text")?.jsonPrimitive?.content
            val durationSeconds = parseDurationToSeconds(durationText)

            val thumbnails = renderer["thumbnail"]?.jsonObject
                ?.get("thumbnails")?.jsonArray
            val rawThumb = thumbnails?.lastOrNull()
                ?.jsonObject?.get("url")?.jsonPrimitive?.content

            return MusicTrack(
                id = videoId,
                title = title,
                artist = artist,
                album = album,
                durationSeconds = durationSeconds,
                vibe = "Up Next",
                youtubeId = videoId,
                streamUrl = "",
                thumbnailUrl = normalizeThumbnailUrl(rawThumb, videoId)
            )
        } catch (_: Exception) {
            return null
        }
    }

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

    private fun normalizeThumbnailUrl(rawUrl: String?, videoId: String): String {
        val cleaned = rawUrl?.trim().orEmpty()
        val withHttps = when {
            cleaned.startsWith("//") -> "https:$cleaned"
            cleaned.startsWith("http://") -> "https://" + cleaned.removePrefix("http://")
            else -> cleaned
        }.replace(Regex("=w\\d+-h\\d+[^\"&\\s]*"), "=w544-h544-l90-rj")

        return if (withHttps.startsWith("https://")) {
            withHttps
        } else {
            "https://i.ytimg.com/vi/$videoId/hqdefault.jpg"
        }
    }

    private fun mapRendererToTrack(renderer: JsonObject): MusicTrack? {
        try {
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

            val durationText = artistRuns?.lastOrNull()
                ?.jsonObject?.get("text")
                ?.jsonPrimitive?.content
            val durationSeconds = parseDurationToSeconds(durationText)

            val thumbnails = renderer["thumbnail"]
                ?.jsonObject?.get("musicThumbnailRenderer")
                ?.jsonObject?.get("thumbnail")
                ?.jsonObject?.get("thumbnails")
                ?.jsonArray

            val rawThumb = thumbnails?.lastOrNull()
                ?.jsonObject?.get("url")
                ?.jsonPrimitive?.content

            return MusicTrack(
                id = videoId,
                title = title,
                artist = artist,
                album = "YouTube Music",
                durationSeconds = durationSeconds,
                vibe = "Search",
                youtubeId = videoId,
                streamUrl = "",
                thumbnailUrl = normalizeThumbnailUrl(rawThumb, videoId)
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

    fun invalidateStream(videoId: String) {
        val cleanId = videoId.trim()
        if (cleanId.isNotBlank()) {
            streamCache.remove(cleanId)
        }
    }

    /**
     * Resolves a direct playable audio stream URL + required HTTP headers for ExoPlayer.
     *
     * Stage 1: Unthrottled VISIONOS_0_1 & VISIONOS_1.02 profiles on music.youtube.com with verified visitorData
     *          (streams 100% of tracks cleanly past the 1 MiB cutoff with full range seeking).
     * Stage 2: InnerTubeX full cipher-deobfuscating StreamExtractor (handles age-restricted/explicit/WEB_REMIX).
     * Stage 3: ANDROID progressive fallback (itag 18).
     * Stage 4: Piped & Invidious public extractors.
     */
    suspend fun extractPlayerStream(
        videoId: String,
        allowFallback: Boolean = false,
        forceAlternative: Boolean = false,
        excludedSources: Set<String> = emptySet()
    ): PlayerStreamInfo = withContext(Dispatchers.IO) {
        val cleanId = videoId.trim()
        val cached = streamCache[cleanId]
        if (!forceAlternative && excludedSources.isEmpty() && cached != null && !cached.isExpired && cached.streamUrl.startsWith("http")) {
            return@withContext cached
        }
        streamCache.remove(cleanId)

        val visitorToken = ensureRealVisitorData()

        data class ClientProfile(
            val label: String,
            val endpointUrl: String,
            val clientName: String,
            val clientVersion: String,
            val clientId: String,
            val userAgent: String,
            val originUrl: String,
            val allowProgressiveFallback: Boolean = false,
            val skipAdaptiveFormats: Boolean = false,
            val extraClientFields: Map<String, String> = emptyMap()
        )

        val profiles = listOf(
            ClientProfile(
                label = "InnerTube (VISIONOS_0_1)",
                endpointUrl = "https://music.youtube.com/youtubei/v1/player?prettyPrint=false",
                clientName = "VISIONOS",
                clientVersion = "0.1",
                clientId = "101",
                userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
                originUrl = "https://music.youtube.com",
                extraClientFields = mapOf(
                    "osName" to "VISION_OS",
                    "osVersion" to "1.3",
                    "deviceMake" to "Apple",
                    "deviceModel" to "RealityDevice14,1",
                    "platform" to "MOBILE"
                )
            ),
            ClientProfile(
                label = "InnerTube (VISIONOS_1.02)",
                endpointUrl = "https://music.youtube.com/youtubei/v1/player?prettyPrint=false",
                clientName = "VISIONOS",
                clientVersion = "1.02",
                clientId = "101",
                userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
                originUrl = "https://music.youtube.com",
                extraClientFields = mapOf(
                    "osName" to "visionOS",
                    "osVersion" to "26.5.23O471",
                    "deviceMake" to "Apple",
                    "deviceModel" to "RealityDevice17,1"
                )
            )
        )

        val rotatedProfiles = if (forceAlternative && excludedSources.isEmpty() && profiles.size > 1) {
            profiles.drop(1) + profiles.take(1)
        } else {
            profiles
        }

        // Stage 1: Primary VISIONOS profiles (full-song unthrottled adaptive audio)
        for (profile in rotatedProfiles) {
            if (profile.label in excludedSources) continue
            try {
                val payload = buildJsonObject {
                    put("context", buildJsonObject {
                        put("client", buildJsonObject {
                            put("clientName", profile.clientName)
                            put("clientVersion", profile.clientVersion)
                            put("hl", "en")
                            put("gl", "US")
                            profile.extraClientFields.forEach { (k, v) -> put(k, v) }
                            if (!visitorToken.isNullOrBlank()) {
                                put("visitorData", visitorToken)
                            }
                        })
                    })
                    put("videoId", cleanId)
                    put("contentCheckOk", true)
                    put("racyCheckOk", true)
                }.toString()

                val text = withTimeoutOrNull(5500L) {
                    httpClient.post(profile.endpointUrl) {
                        contentType(ContentType.Application.Json)
                        header("User-Agent", profile.userAgent)
                        header("X-Goog-Api-Format-Version", "1")
                        header("X-YouTube-Client-Name", profile.clientId)
                        header("X-YouTube-Client-Version", profile.clientVersion)
                        header("Origin", profile.originUrl)
                        header("Referer", "${profile.originUrl}/")
                        if (!visitorToken.isNullOrBlank()) {
                            header("X-Goog-Visitor-Id", visitorToken)
                        }
                        setBody(payload)
                    }.bodyAsText()
                } ?: continue

                val parsed = parsePlayerResponse(
                    videoId = cleanId,
                    rawJson = text,
                    sourceLabel = profile.label,
                    streamHeaders = mapOf("User-Agent" to profile.userAgent),
                    allowProgressiveFallback = profile.allowProgressiveFallback,
                    skipAdaptiveFormats = profile.skipAdaptiveFormats
                )
                if (parsed != null) {
                    streamCache[cleanId] = parsed
                    return@withContext parsed
                }
            } catch (_: Exception) {
                // Try next profile
            }
        }

        // Stage 2: InnerTubeX StreamExtractor with JS cipher/n-transform deobfuscation
        try {
            val excludedExtractorClients = buildSet {
                if (excludedSources.any { it.contains("InnerTubeX", ignoreCase = true) || it.contains("WEB_REMIX", ignoreCase = true) }) {
                    add("WEB_REMIX")
                }
                if (excludedSources.any { it.contains("VISIONOS", ignoreCase = true) }) {
                    add("VISIONOS")
                    add("VISIONOS_0_1")
                }
                // Avoid known 1 MiB adaptive cutoff clients unless explicitly needed
                add("ANDROID_VR")
                add("ANDROID_VR_1_65_10")
                add("ANDROID_VR_1_61_48")
                add("ANDROID_VR_1_43_32")
                add("ANDROID_VR_NO_AUTH")
                add("IOS")
            }

            val extracted = withTimeoutOrNull(9000L) {
                innerTubeExtractor.extract(
                    videoId = cleanId,
                    hints = ContentHints().withStreamCapabilities(
                        allowHls = false,
                        allowSabr = false,
                        allowBoundedRange = true
                    ),
                    excludedClients = excludedExtractorClients,
                    audioQuality = AudioQuality.AUTO
                )
            }
            if (extracted != null && extracted.audioUrl.startsWith("http")) {
                val label = "InnerTubeX (${extracted.clientName})"
                if (label !in excludedSources) {
                    val info = PlayerStreamInfo(
                        videoId = cleanId,
                        streamUrl = extracted.audioUrl,
                        mimeType = extracted.mimeType ?: "audio/mp4",
                        bitrate = extracted.bitrate ?: 128000,
                        itag = extracted.itag,
                        contentLength = extracted.contentLengthBytes ?: 0L,
                        expiresInSeconds = 21600L,
                        source = label,
                        isSigned = true,
                        headers = extracted.headers
                    )
                    streamCache[cleanId] = info
                    return@withContext info
                }
            }
        } catch (_: Exception) {}

        // Stage 3: ANDROID 21.26 progressive itag 18 (verified unaffected by the 1 MiB adaptive cutoff)
        val androidProgLabel = "InnerTube (ANDROID_PROGRESSIVE)"
        if (androidProgLabel !in excludedSources) {
            try {
                val androidClient = YouTubeClient.ANDROID
                val payload = buildJsonObject {
                    put("context", buildJsonObject {
                        put("client", buildJsonObject {
                            put("clientName", androidClient.clientName)
                            put("clientVersion", androidClient.clientVersion)
                            put("osName", androidClient.osName ?: "Android")
                            put("osVersion", androidClient.osVersion ?: "11")
                            put("androidSdkVersion", androidClient.androidSdkVersion ?: "30")
                            put("userAgent", androidClient.userAgent)
                            put("hl", "en")
                            put("gl", "US")
                            if (!visitorToken.isNullOrBlank()) {
                                put("visitorData", visitorToken)
                            }
                        })
                    })
                    put("videoId", cleanId)
                    put("contentCheckOk", true)
                    put("racyCheckOk", true)
                }.toString()

                val text = withTimeoutOrNull(5000L) {
                    httpClient.post("https://youtubei.googleapis.com/youtubei/v1/player?prettyPrint=false") {
                        contentType(ContentType.Application.Json)
                        header("User-Agent", androidClient.userAgent)
                        header("X-YouTube-Client-Name", androidClient.clientId)
                        header("X-YouTube-Client-Version", androidClient.clientVersion)
                        if (!visitorToken.isNullOrBlank()) {
                            header("X-Goog-Visitor-Id", visitorToken)
                        }
                        setBody(payload)
                    }.bodyAsText()
                }
                if (!text.isNullOrBlank()) {
                    val parsed = parsePlayerResponse(
                        videoId = cleanId,
                        rawJson = text,
                        sourceLabel = androidProgLabel,
                        streamHeaders = mapOf("User-Agent" to androidClient.userAgent),
                        allowProgressiveFallback = true,
                        skipAdaptiveFormats = true
                    )
                    if (parsed != null) {
                        streamCache[cleanId] = parsed
                        return@withContext parsed
                    }
                }
            } catch (_: Exception) {}
        }

        // Stage 4: Piped API public instances
        if ("Piped Stream Extractor" !in excludedSources) {
            val pipedUrls = listOf(
                "https://pipedapi.kavin.rocks/streams/$cleanId",
                "https://api.piped.video/streams/$cleanId",
                "https://pipedapi.adminforge.de/streams/$cleanId"
            )
            for (pipedUrl in pipedUrls) {
                try {
                    val text = withTimeoutOrNull(4500L) {
                        httpClient.get(pipedUrl).bodyAsText()
                    } ?: continue
                    val parsed = parsePipedResponse(cleanId, text)
                    if (parsed != null) {
                        streamCache[cleanId] = parsed
                        return@withContext parsed
                    }
                } catch (_: Exception) {}
            }
        }

        // Stage 5: Invidious public instances
        if ("Invidious Extractor" !in excludedSources) {
            val invidiousUrls = listOf(
                "https://inv.nadeko.net/api/v1/videos/$cleanId",
                "https://invidious.nerdvpn.de/api/v1/videos/$cleanId"
            )
            for (invUrl in invidiousUrls) {
                try {
                    val text = withTimeoutOrNull(4500L) {
                        httpClient.get(invUrl).bodyAsText()
                    } ?: continue
                    val parsed = parseInvidiousResponse(cleanId, text)
                    if (parsed != null) {
                        streamCache[cleanId] = parsed
                        return@withContext parsed
                    }
                } catch (_: Exception) {}
            }
        }

        if (allowFallback) {
            val fallback = PlayerStreamInfo(
                videoId = cleanId,
                streamUrl = "https://music.youtube.com/watch?v=$cleanId",
                mimeType = "audio/mp4",
                bitrate = 128000,
                source = "InnerTube Fallback Metadata",
                isSigned = true
            )
            return@withContext fallback
        }

        throw IllegalStateException("Could not resolve playable audio stream for $cleanId. Tap Retry or check network.")
    }

    private fun parsePlayerResponse(
        videoId: String,
        rawJson: String,
        sourceLabel: String,
        streamHeaders: Map<String, String>,
        allowProgressiveFallback: Boolean = false,
        skipAdaptiveFormats: Boolean = false
    ): PlayerStreamInfo? {
        try {
            val root = json.parseToJsonElement(rawJson).jsonObject
            val playability = root["playabilityStatus"]?.jsonObject
            val status = playability?.get("status")?.jsonPrimitive?.content
            if (status != null && !status.equals("OK", ignoreCase = true)) {
                return null
            }

            val streamingData = root["streamingData"]?.jsonObject ?: return null
            val expiresIn = streamingData["expiresInSeconds"]?.jsonPrimitive?.content?.toLongOrNull() ?: 21600L

            var bestUrl: String? = null
            var bestScore = -1
            var bestBitrate = 0
            var bestMime = "audio/mp4"
            var bestItag: Int? = null
            var bestContentLength: Long = 0L

            if (!skipAdaptiveFormats) {
                val adaptiveFormats = streamingData["adaptiveFormats"]?.jsonArray
                if (adaptiveFormats != null) {
                    for (fmtElement in adaptiveFormats) {
                        val fmt = fmtElement.jsonObject
                        val mime = fmt["mimeType"]?.jsonPrimitive?.content ?: ""
                        if (mime.startsWith("audio/")) {
                            val url = fmt["url"]?.jsonPrimitive?.content
                            if (!url.isNullOrBlank() && url.startsWith("http")) {
                                val itag = fmt["itag"]?.jsonPrimitive?.content?.toIntOrNull()
                                // Filter out known restricted itags (139, 249, 599, 600) that trigger 403 on seeking/ranges
                                if (itag in setOf(139, 249, 599, 600)) {
                                    continue
                                }

                                val bitrate = fmt["bitrate"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                                val contentLength = fmt["contentLength"]?.jsonPrimitive?.content?.toLongOrNull() ?: 0L
                                // Heavily bonus proven seekable itags (140 = 128k AAC mp4, 251 = 160k Opus)
                                val itagBonus = if (itag == 140) 80000 else if (itag == 251) 60000 else 0
                                val containerBonus = if (mime.contains("mp4", ignoreCase = true)) 20000 else 0
                                val score = bitrate + containerBonus + itagBonus
                                if (score >= bestScore) {
                                    bestScore = score
                                    bestBitrate = bitrate
                                    bestUrl = url
                                    bestMime = mime
                                    bestItag = itag
                                    bestContentLength = contentLength
                                }
                            }
                        }
                    }
                }
            }

            // Fallback to progressive muxed MP4 format (e.g. itag 18) when adaptiveFormats aren't available
            if (bestUrl.isNullOrBlank() && allowProgressiveFallback) {
                val progressiveFormats = streamingData["formats"]?.jsonArray
                if (progressiveFormats != null) {
                    for (fmtElement in progressiveFormats) {
                        val fmt = fmtElement.jsonObject
                        val url = fmt["url"]?.jsonPrimitive?.content
                        if (!url.isNullOrBlank() && url.startsWith("http")) {
                            val itag = fmt["itag"]?.jsonPrimitive?.content?.toIntOrNull()
                            val mime = fmt["mimeType"]?.jsonPrimitive?.content ?: "video/mp4"
                            val bitrate = fmt["bitrate"]?.jsonPrimitive?.content?.toIntOrNull() ?: 96000
                            val contentLength = fmt["contentLength"]?.jsonPrimitive?.content?.toLongOrNull() ?: 0L
                            val itagBonus = if (itag == 18) 50000 else 0
                            val score = bitrate + itagBonus
                            if (score >= bestScore) {
                                bestScore = score
                                bestBitrate = bitrate
                                bestUrl = url
                                bestMime = mime
                                bestItag = itag
                                bestContentLength = contentLength
                            }
                        }
                    }
                }
            }

            if (!bestUrl.isNullOrBlank()) {
                return PlayerStreamInfo(
                    videoId = videoId,
                    streamUrl = bestUrl,
                    mimeType = bestMime,
                    bitrate = if (bestBitrate > 0) bestBitrate else 128000,
                    itag = bestItag,
                    contentLength = bestContentLength,
                    expiresInSeconds = expiresIn,
                    source = sourceLabel,
                    isSigned = true,
                    headers = streamHeaders
                )
            }
        } catch (_: Exception) {}
        return null
    }

    private fun parsePipedResponse(videoId: String, rawJson: String): PlayerStreamInfo? {
        try {
            val root = json.parseToJsonElement(rawJson).jsonObject
            val audioStreams = root["audioStreams"]?.jsonArray ?: return null
            var bestUrl: String? = null
            var bestScore = -1
            var bestBitrate = 0
            var bestMime = "audio/mp4"

            for (streamEl in audioStreams) {
                val streamObj = streamEl.jsonObject
                val url = streamObj["url"]?.jsonPrimitive?.content
                val bitrate = streamObj["bitrate"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                val rawMime = streamObj["mimeType"]?.jsonPrimitive?.content.orEmpty()
                val mime = if (rawMime.contains("audio", ignoreCase = true)) rawMime else "audio/mp4"
                if (!url.isNullOrBlank() && url.startsWith("http")) {
                    val bonus = if (mime.contains("mp4", ignoreCase = true)) 15000 else 0
                    val score = bitrate + bonus
                    if (score >= bestScore) {
                        bestScore = score
                        bestBitrate = bitrate
                        bestUrl = url
                        bestMime = mime
                    }
                }
            }

            if (!bestUrl.isNullOrBlank()) {
                return PlayerStreamInfo(
                    videoId = videoId,
                    streamUrl = bestUrl,
                    mimeType = bestMime,
                    bitrate = if (bestBitrate > 0) bestBitrate else 128000,
                    source = "Piped Stream Extractor",
                    isSigned = true
                )
            }
        } catch (_: Exception) {}
        return null
    }

    private fun parseInvidiousResponse(videoId: String, rawJson: String): PlayerStreamInfo? {
        try {
            val root = json.parseToJsonElement(rawJson).jsonObject
            val adaptiveFormats = root["adaptiveFormats"]?.jsonArray ?: return null
            var bestUrl: String? = null
            var bestScore = -1
            var bestBitrate = 0
            var bestMime = "audio/mp4"

            for (fmtEl in adaptiveFormats) {
                val fmtObj = fmtEl.jsonObject
                val type = fmtObj["type"]?.jsonPrimitive?.content.orEmpty()
                val url = fmtObj["url"]?.jsonPrimitive?.content
                if (type.startsWith("audio/") && !url.isNullOrBlank() && url.startsWith("http")) {
                    val bitrate = fmtObj["bitrate"]?.jsonPrimitive?.content?.toIntOrNull() ?: 128000
                    val bonus = if (type.contains("mp4", ignoreCase = true)) 15000 else 0
                    if (bitrate + bonus >= bestScore) {
                        bestScore = bitrate + bonus
                        bestBitrate = bitrate
                        bestUrl = url
                        bestMime = type
                    }
                }
            }

            if (!bestUrl.isNullOrBlank()) {
                return PlayerStreamInfo(
                    videoId = videoId,
                    streamUrl = bestUrl,
                    mimeType = bestMime,
                    bitrate = if (bestBitrate > 0) bestBitrate else 128000,
                    source = "Invidious Extractor",
                    isSigned = true
                )
            }
        } catch (_: Exception) {}
        return null
    }

    fun close() {
        visitorFetchJob?.cancel()
        visitorFetchJob = null
        streamCache.clear()
        suggestionsCache.clear()
        try {
            innerTube.close()
        } catch (_: Exception) {}
        try {
            httpClient.close()
        } catch (_: Exception) {}
    }
}
