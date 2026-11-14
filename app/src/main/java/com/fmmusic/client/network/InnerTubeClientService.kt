package com.fmmusic.client.network

import com.fmmusic.client.data.MusicCatalogData
import com.fmmusic.client.model.MusicTrack
import com.metrolist.innertubex.InnerTube
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
                connectTimeout(6, TimeUnit.SECONDS)
                readTimeout(8, TimeUnit.SECONDS)
                callTimeout(10, TimeUnit.SECONDS)
                followRedirects(true)
            }
        }
        install(ContentNegotiation) {
            json(json)
        }
    }

    val innerTube = InnerTube(httpClient)

    private val mutableSessionState = MutableStateFlow(VisitorSessionState())
    val sessionState = mutableSessionState.asStateFlow()

    private val mutableVisitorData = MutableStateFlow<String?>(null)
    val visitorData = mutableVisitorData.asStateFlow()

    private var visitorFetchJob: Job? = null

    init {
        initializeVisitorSession()
    }

    fun initializeVisitorSession() {
        startVisitorSession()
    }

    fun startVisitorSession(): VisitorSessionState {
        val fallbackToken = "Cgt" + UUID.randomUUID().toString().replace("-", "").take(11).uppercase()
        try {
            innerTube.visitorData = fallbackToken
            mutableVisitorData.value = fallbackToken
        } catch (_: Exception) {}

        val newState = VisitorSessionState(
            isInitialized = true,
            visitorData = fallbackToken,
            clientName = "WEB_REMIX",
            clientVersion = "1.20240101.01.00",
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

    private val streamCache = ConcurrentHashMap<String, PlayerStreamInfo>()

    fun invalidateStream(videoId: String) {
        val cleanId = videoId.trim()
        if (cleanId.isNotBlank()) {
            streamCache.remove(cleanId)
        }
    }

    /**
     * Resolves a direct playable audio stream URL + required HTTP headers for ExoPlayer.
     *
     * Stage 1: Direct InnerTube player API profiles (ANDROID_VR, IOS, ANDROID_MUSIC) with playability check.
     * Stage 2: Piped public stream extractors.
     * Stage 3: Invidious public stream extractors.
     */
    suspend fun extractPlayerStream(
        videoId: String,
        allowFallback: Boolean = false
    ): PlayerStreamInfo = withContext(Dispatchers.IO) {
        val cleanId = videoId.trim()
        val cached = streamCache[cleanId]
        if (cached != null && !cached.isExpired && cached.streamUrl.startsWith("http")) {
            return@withContext cached
        }
        streamCache.remove(cleanId)

        val visitorToken = mutableVisitorData.value ?: mutableSessionState.value.visitorData

        // Stage 1: Direct InnerTube player clients that issue unencrypted direct audio URLs
        data class ClientProfile(
            val clientName: String,
            val clientVersion: String,
            val clientId: String,
            val userAgent: String,
            val extraClientFields: Map<String, String> = emptyMap()
        )

        val clientProfiles = listOf(
            ClientProfile(
                clientName = "ANDROID_VR",
                clientVersion = "1.65.10",
                clientId = "28",
                userAgent = "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
                extraClientFields = mapOf("deviceMake" to "Oculus", "deviceModel" to "Quest 3", "osName" to "Android", "osVersion" to "12L")
            ),
            ClientProfile(
                clientName = "IOS",
                clientVersion = "20.10.4",
                clientId = "5",
                userAgent = "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X)",
                extraClientFields = mapOf("deviceMake" to "Apple", "deviceModel" to "iPhone16,2", "osName" to "iPhone", "osVersion" to "18.3.2.22D82")
            ),
            ClientProfile(
                clientName = "ANDROID_MUSIC",
                clientVersion = "7.29.52",
                clientId = "21",
                userAgent = "com.google.android.apps.youtube.music/7.29.52 (Linux; U; Android 14; en_US; Pixel 8) gzip",
                extraClientFields = mapOf("osName" to "Android", "osVersion" to "14")
            )
        )

        for (profile in clientProfiles) {
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

                val text = withTimeoutOrNull(5000L) {
                    httpClient.post("https://youtubei.googleapis.com/youtubei/v1/player?prettyPrint=false") {
                        contentType(ContentType.Application.Json)
                        header("User-Agent", profile.userAgent)
                        header("X-YouTube-Client-Name", profile.clientId)
                        header("X-YouTube-Client-Version", profile.clientVersion)
                        if (!visitorToken.isNullOrBlank()) {
                            header("X-Goog-Visitor-Id", visitorToken)
                        }
                        setBody(payload)
                    }.bodyAsText()
                } ?: continue

                val parsed = parsePlayerResponse(
                    videoId = cleanId,
                    rawJson = text,
                    sourceLabel = "InnerTube (${profile.clientName})",
                    streamHeaders = mapOf("User-Agent" to profile.userAgent)
                )
                if (parsed != null) {
                    streamCache[cleanId] = parsed
                    return@withContext parsed
                }
            } catch (_: Exception) {
                // Try next profile
            }
        }

        // Stage 2: Piped API public instances
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

        // Stage 3: Invidious public instances
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
        streamHeaders: Map<String, String>
    ): PlayerStreamInfo? {
        try {
            val root = json.parseToJsonElement(rawJson).jsonObject
            val playability = root["playabilityStatus"]?.jsonObject
            val status = playability?.get("status")?.jsonPrimitive?.content
            if (status != null && !status.equals("OK", ignoreCase = true)) {
                return null
            }

            val streamingData = root["streamingData"]?.jsonObject ?: return null
            val adaptiveFormats = streamingData["adaptiveFormats"]?.jsonArray ?: return null
            val expiresIn = streamingData["expiresInSeconds"]?.jsonPrimitive?.content?.toLongOrNull() ?: 21600L

            var bestUrl: String? = null
            var bestScore = -1
            var bestBitrate = 0
            var bestMime = "audio/mp4"
            var bestItag: Int? = null

            for (fmtElement in adaptiveFormats) {
                val fmt = fmtElement.jsonObject
                val mime = fmt["mimeType"]?.jsonPrimitive?.content ?: ""
                if (mime.startsWith("audio/")) {
                    val url = fmt["url"]?.jsonPrimitive?.content
                    if (!url.isNullOrBlank() && url.startsWith("http")) {
                        val bitrate = fmt["bitrate"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                        // Prefer m4a/mp4 slightly for universal Media3 hardware compatibility
                        val containerBonus = if (mime.contains("mp4", ignoreCase = true)) 15000 else 0
                        val score = bitrate + containerBonus
                        if (score >= bestScore) {
                            bestScore = score
                            bestBitrate = bitrate
                            bestUrl = url
                            bestMime = mime
                            bestItag = fmt["itag"]?.jsonPrimitive?.content?.toIntOrNull()
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
        try {
            innerTube.close()
        } catch (_: Exception) {}
        try {
            httpClient.close()
        } catch (_: Exception) {}
    }
}
