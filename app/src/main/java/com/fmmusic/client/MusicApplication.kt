package com.fmmusic.client

import android.app.Application
import android.content.Context
import android.content.SharedPreferences
import com.fmmusic.client.data.MusicCatalogData
import com.fmmusic.client.model.MusicTrack
import com.fmmusic.client.model.UserPlaylist
import com.fmmusic.client.network.InnerTubeClientService
import com.fmmusic.client.playback.ExoPlaybackManager
import com.fmmusic.client.update.AppUpdateManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache

@OptIn(UnstableApi::class)
class MusicApplication : Application() {
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    val mediaCache: SimpleCache by lazy {
        val databaseProvider = StandaloneDatabaseProvider(this)
        val cacheFolder = File(cacheDir, "media_cache")
        if (!cacheFolder.exists()) {
            cacheFolder.mkdirs()
        }
        SimpleCache(cacheFolder, LeastRecentlyUsedCacheEvictor(256 * 1024 * 1024L), databaseProvider)
    }

    lateinit var playbackManager: ExoPlaybackManager
        private set

    lateinit var innerTubeService: InnerTubeClientService
        private set

    lateinit var updateManager: AppUpdateManager
        private set

    private lateinit var prefs: SharedPreferences

    private val mutableFavorites = MutableStateFlow<Set<String>>(emptySet())
    val favorites = mutableFavorites.asStateFlow()

    private val mutableFavoriteTracks = MutableStateFlow<Map<String, MusicTrack>>(emptyMap())
    val favoriteTracks = mutableFavoriteTracks.asStateFlow()

    private val mutablePlaylists = MutableStateFlow<List<UserPlaylist>>(emptyList())
    val playlists = mutablePlaylists.asStateFlow()

    private val mutableDownloads = MutableStateFlow<Set<String>>(emptySet())
    val downloads = mutableDownloads.asStateFlow()

    private val mutableDownloading = MutableStateFlow<Set<String>>(emptySet())
    val downloading = mutableDownloading.asStateFlow()

    private val mutableThemeId = MutableStateFlow("YT_DARK")
    val currentThemeId = mutableThemeId.asStateFlow()

    private val mutableAccentHex = MutableStateFlow("#FF0000")
    val currentAccentHex = mutableAccentHex.asStateFlow()

    override fun onCreate() {
        super.onCreate()
        instance = this
        prefs = getSharedPreferences("fm_music_prefs", Context.MODE_PRIVATE)

        loadPreferences()

        playbackManager = ExoPlaybackManager(this)
        innerTubeService = InnerTubeClientService(appScope)
        updateManager = AppUpdateManager(this, appScope)
        updateManager.checkForUpdates(forceManual = false)
        scanExistingDownloads()
    }

    private fun loadPreferences() {
        try {
            // Load theme & accent
            val savedTheme = prefs.getString(PREF_THEME_ID, "YT_DARK") ?: "YT_DARK"
            val savedAccent = prefs.getString(PREF_ACCENT_HEX, "#FF0000") ?: "#FF0000"
            mutableThemeId.value = savedTheme
            mutableAccentHex.value = savedAccent

            // Load favorites
            val favsJson = prefs.getString(PREF_FAVORITES, null)
            if (!favsJson.isNullOrBlank()) {
                val jsonArr = JSONArray(favsJson)
                val favIds = mutableSetOf<String>()
                val favMap = mutableMapOf<String, MusicTrack>()
                for (i in 0 until jsonArr.length()) {
                    val obj = jsonArr.getJSONObject(i)
                    val track = parseTrackFromJson(obj)
                    favIds.add(track.id)
                    favMap[track.id] = track.copy(isFavorite = true)
                }
                mutableFavorites.value = favIds
                mutableFavoriteTracks.value = favMap
            } else {
                // Initial defaults: add top curated tracks as initial liked music
                val initialCurated = MusicCatalogData.curatedTracks.take(4)
                val favIds = initialCurated.map { it.id }.toSet()
                val favMap = initialCurated.associate { it.id to it.copy(isFavorite = true) }
                mutableFavorites.value = favIds
                mutableFavoriteTracks.value = favMap
                saveFavorites()
            }

            // Load user playlists
            val playlistsJson = prefs.getString(PREF_PLAYLISTS, null)
            if (!playlistsJson.isNullOrBlank()) {
                val jsonArr = JSONArray(playlistsJson)
                val loaded = mutableListOf<UserPlaylist>()
                for (i in 0 until jsonArr.length()) {
                    val pObj = jsonArr.getJSONObject(i)
                    val pId = pObj.optString("id", UUID.randomUUID().toString())
                    val pName = pObj.optString("name", "My Playlist")
                    val pCreated = pObj.optLong("createdAt", System.currentTimeMillis())
                    val tArr = pObj.optJSONArray("tracks") ?: JSONArray()
                    val tracksList = mutableListOf<MusicTrack>()
                    for (j in 0 until tArr.length()) {
                        tracksList.add(parseTrackFromJson(tArr.getJSONObject(j)))
                    }
                    loaded.add(UserPlaylist(id = pId, name = pName, tracks = tracksList, createdAt = pCreated))
                }
                mutablePlaylists.value = loaded
            } else {
                // Create a default initial playlist for great out-of-the-box experience
                val defaultPlaylist = UserPlaylist(
                    id = "pl-vibes-1",
                    name = "Vibes & Favorites",
                    tracks = MusicCatalogData.curatedTracks.take(5),
                    createdAt = System.currentTimeMillis()
                )
                mutablePlaylists.value = listOf(defaultPlaylist)
                savePlaylists()
            }
        } catch (_: Exception) {}
    }

    private fun parseTrackFromJson(obj: JSONObject): MusicTrack {
        return MusicTrack(
            id = obj.optString("id", ""),
            title = obj.optString("title", "Unknown Title"),
            artist = obj.optString("artist", "Unknown Artist"),
            album = obj.optString("album", "FM Music"),
            durationSeconds = obj.optLong("durationSeconds", 210L),
            vibe = obj.optString("vibe", "Top hits"),
            youtubeId = obj.optString("youtubeId", obj.optString("id", "")),
            streamUrl = "",
            lyrics = emptyList(),
            isFavorite = true,
            isDownloaded = false,
            thumbnailUrl = obj.optString("thumbnailUrl", "")
        )
    }

    private fun trackToJson(track: MusicTrack): JSONObject {
        return JSONObject().apply {
            put("id", track.id)
            put("title", track.title)
            put("artist", track.artist)
            put("album", track.album)
            put("durationSeconds", track.durationSeconds)
            put("vibe", track.vibe)
            put("youtubeId", track.youtubeId.ifBlank { track.id })
            put("thumbnailUrl", track.resolvedThumbnailUrl)
        }
    }

    private fun saveFavorites() {
        try {
            val arr = JSONArray()
            mutableFavoriteTracks.value.values.forEach { track ->
                arr.put(trackToJson(track))
            }
            prefs.edit().putString(PREF_FAVORITES, arr.toString()).apply()
        } catch (_: Exception) {}
    }

    private fun savePlaylists() {
        try {
            val arr = JSONArray()
            mutablePlaylists.value.forEach { pl ->
                val pObj = JSONObject().apply {
                    put("id", pl.id)
                    put("name", pl.name)
                    put("createdAt", pl.createdAt)
                    val tArr = JSONArray()
                    pl.tracks.forEach { t -> tArr.put(trackToJson(t)) }
                    put("tracks", tArr)
                }
                arr.put(pObj)
            }
            prefs.edit().putString(PREF_PLAYLISTS, arr.toString()).apply()
        } catch (_: Exception) {}
    }

    fun setTheme(themeId: String) {
        mutableThemeId.value = themeId
        prefs.edit().putString(PREF_THEME_ID, themeId).apply()
    }

    fun setAccent(accentHex: String) {
        mutableAccentHex.value = accentHex
        prefs.edit().putString(PREF_ACCENT_HEX, accentHex).apply()
    }

    fun isFavorite(trackId: String): Boolean {
        return mutableFavorites.value.contains(trackId)
    }

    fun toggleFavorite(track: MusicTrack) {
        val trackId = track.id
        val currentlyFav = mutableFavorites.value.contains(trackId)
        if (currentlyFav) {
            mutableFavorites.update { it - trackId }
            mutableFavoriteTracks.update { it - trackId }
        } else {
            mutableFavorites.update { it + trackId }
            mutableFavoriteTracks.update { it + (trackId to track.copy(isFavorite = true)) }
        }
        saveFavorites()
    }

    fun createPlaylist(name: String): UserPlaylist {
        val trimmed = name.trim().ifBlank { "New Playlist" }
        val newPl = UserPlaylist(
            id = UUID.randomUUID().toString(),
            name = trimmed,
            tracks = emptyList(),
            createdAt = System.currentTimeMillis()
        )
        mutablePlaylists.update { it + newPl }
        savePlaylists()
        return newPl
    }

    fun renamePlaylist(playlistId: String, newName: String) {
        val trimmed = newName.trim().ifBlank { "Playlist" }
        mutablePlaylists.update { list ->
            list.map { if (it.id == playlistId) it.copy(name = trimmed) else it }
        }
        savePlaylists()
    }

    fun deletePlaylist(playlistId: String) {
        mutablePlaylists.update { list ->
            list.filter { it.id != playlistId }
        }
        savePlaylists()
    }

    fun addTrackToPlaylist(playlistId: String, track: MusicTrack) {
        mutablePlaylists.update { list ->
            list.map { pl ->
                if (pl.id == playlistId) {
                    if (pl.tracks.any { it.id == track.id }) pl
                    else pl.copy(tracks = pl.tracks + track)
                } else pl
            }
        }
        savePlaylists()
    }

    fun removeTrackFromPlaylist(playlistId: String, trackId: String) {
        mutablePlaylists.update { list ->
            list.map { pl ->
                if (pl.id == playlistId) {
                    pl.copy(tracks = pl.tracks.filter { it.id != trackId })
                } else pl
            }
        }
        savePlaylists()
    }

    private fun scanExistingDownloads() {
        try {
            val downloadDir = getDownloadDir()
            val files = downloadDir.listFiles() ?: return
            val downloadedIds = files
                .filter { it.isFile && it.length() > 0 }
                .map { it.name.substringBeforeLast(".") }
                .toSet()
            mutableDownloads.value = downloadedIds
        } catch (_: Exception) {}
    }

    private fun getDownloadDir(): File {
        val dir = File(filesDir, "downloads")
        if (!dir.exists()) {
            dir.mkdirs()
        }
        return dir
    }

    fun getLocalTrackFile(trackId: String): File? {
        val file = File(getDownloadDir(), "$trackId.mp3")
        return if (file.exists() && file.length() > 0) file else null
    }

    fun toggleDownload(track: MusicTrack) {
        val trackId = track.id
        if (mutableDownloads.value.contains(trackId)) {
            try {
                val file = File(getDownloadDir(), "$trackId.mp3")
                if (file.exists()) {
                    file.delete()
                }
            } catch (_: Exception) {}
            mutableDownloads.update { it - trackId }
        } else {
            triggerDownload(track)
        }
    }

    private fun triggerDownload(track: MusicTrack) {
        val trackId = track.id
        if (mutableDownloading.value.contains(trackId)) return
        mutableDownloading.update { it + trackId }

        appScope.launch {
            val targetFile = File(getDownloadDir(), "$trackId.mp3")
            try {
                val streamInfo = innerTubeService.extractPlayerStream(
                    track.youtubeId.ifBlank { track.id },
                    allowFallback = false
                )
                val streamUrl = streamInfo.streamUrl
                val isGoogleVideo = streamUrl.contains("googlevideo.com")
                val userAgent = streamInfo.headers.entries
                    .firstOrNull { it.key.equals("User-Agent", ignoreCase = true) }
                    ?.value
                    ?: "com.google.android.youtube/20.01.35 (Linux; U; Android 11) gzip"

                if (!isGoogleVideo) {
                    val conn = (URL(streamUrl).openConnection() as HttpURLConnection).apply {
                        connectTimeout = 15000
                        readTimeout = 20000
                        instanceFollowRedirects = true
                        setRequestProperty("User-Agent", userAgent)
                        connect()
                    }
                    if (conn.responseCode in 200..299) {
                        conn.inputStream.use { input ->
                            FileOutputStream(targetFile).use { output ->
                                input.copyTo(output)
                            }
                        }
                    }
                } else {
                    // Chunked download with 512 KB bounded ranges to satisfy YouTube edge server requirements
                    val chunkSize = 512 * 1024L
                    var startByte = 0L
                    var totalLength = streamInfo.contentLength

                    FileOutputStream(targetFile).use { output ->
                        var hasMore = true
                        while (hasMore) {
                            val endByte = if (totalLength > 0L) {
                                minOf(startByte + chunkSize - 1, totalLength - 1)
                            } else {
                                startByte + chunkSize - 1
                            }

                            val conn = (URL(streamUrl).openConnection() as HttpURLConnection).apply {
                                connectTimeout = 15000
                                readTimeout = 20000
                                instanceFollowRedirects = true
                                setRequestProperty("User-Agent", userAgent)
                                setRequestProperty("Range", "bytes=$startByte-$endByte")
                                connect()
                            }

                            val code = conn.responseCode
                            if (code in 200..299) {
                                if (totalLength <= 0L) {
                                    val cr = conn.getHeaderField("Content-Range")
                                    if (!cr.isNullOrBlank() && cr.contains("/")) {
                                        totalLength = cr.substringAfter("/").trim().toLongOrNull() ?: 0L
                                    }
                                }
                                val bytesCopied = conn.inputStream.use { input ->
                                    input.copyTo(output)
                                }
                                if (bytesCopied <= 0) {
                                    hasMore = false
                                } else {
                                    startByte += bytesCopied
                                    if (totalLength > 0L && startByte >= totalLength) {
                                        hasMore = false
                                    }
                                }
                            } else {
                                hasMore = false
                            }
                            conn.disconnect()
                        }
                    }
                }

                if (targetFile.exists() && targetFile.length() > 0) {
                    mutableDownloads.update { it + trackId }
                } else {
                    if (targetFile.exists()) targetFile.delete()
                }
            } catch (_: Exception) {
                if (targetFile.exists() && targetFile.length() == 0L) {
                    try {
                        targetFile.delete()
                    } catch (_: Exception) {}
                }
            } finally {
                mutableDownloading.update { it - trackId }
            }
        }
    }

    override fun onTerminate() {
        innerTubeService.close()
        playbackManager.release()
        super.onTerminate()
    }

    companion object {
        private const val PREF_FAVORITES = "pref_favorites_v2"
        private const val PREF_PLAYLISTS = "pref_playlists_v2"
        private const val PREF_THEME_ID = "pref_theme_id"
        private const val PREF_ACCENT_HEX = "pref_accent_hex"

        lateinit var instance: MusicApplication
            private set
    }
}
