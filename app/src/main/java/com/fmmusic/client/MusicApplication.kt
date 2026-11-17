package com.fmmusic.client

import android.app.Application
import com.fmmusic.client.model.MusicTrack
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
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class MusicApplication : Application() {
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    lateinit var playbackManager: ExoPlaybackManager
        private set

    lateinit var innerTubeService: InnerTubeClientService
        private set

    lateinit var updateManager: AppUpdateManager
        private set

    private val mutableFavorites = MutableStateFlow<Set<String>>(emptySet())
    val favorites = mutableFavorites.asStateFlow()

    private val mutableDownloads = MutableStateFlow<Set<String>>(emptySet())
    val downloads = mutableDownloads.asStateFlow()

    private val mutableDownloading = MutableStateFlow<Set<String>>(emptySet())
    val downloading = mutableDownloading.asStateFlow()

    override fun onCreate() {
        super.onCreate()
        instance = this
        playbackManager = ExoPlaybackManager(this)
        innerTubeService = InnerTubeClientService(appScope)
        updateManager = AppUpdateManager(this, appScope)
        updateManager.checkForUpdates(forceManual = false)
        scanExistingDownloads()
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

    fun toggleFavorite(trackId: String) {
        mutableFavorites.update { cur ->
            if (cur.contains(trackId)) cur - trackId else cur + trackId
        }
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
        lateinit var instance: MusicApplication
            private set
    }
}
