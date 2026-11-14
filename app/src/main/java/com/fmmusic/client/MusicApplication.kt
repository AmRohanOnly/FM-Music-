package com.fmmusic.client

import android.app.Application
import com.fmmusic.client.model.MusicTrack
import com.fmmusic.client.network.InnerTubeClientService
import com.fmmusic.client.playback.ExoPlaybackManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.ensureActive
import kotlin.coroutines.coroutineContext
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

    private val mutableFavorites = MutableStateFlow<Set<String>>(emptySet())
    val favorites = mutableFavorites.asStateFlow()

    private val mutableDownloads = MutableStateFlow<Set<String>>(emptySet())
    val downloads = mutableDownloads.asStateFlow()

    private val mutableDownloading = MutableStateFlow<Set<String>>(emptySet())
    val downloading = mutableDownloading.asStateFlow()
    private val mutableDownloadError = MutableStateFlow<String?>(null)
    val downloadError = mutableDownloadError.asStateFlow()

    override fun onCreate() {
        super.onCreate()
        instance = this
        playbackManager = ExoPlaybackManager(this)
        innerTubeService = InnerTubeClientService(appScope)
        scanExistingDownloads()
    }

    private fun scanExistingDownloads() {
        try {
            val downloadDir = getDownloadDir()
            val files = downloadDir.listFiles() ?: return
            val downloadedIds = files
                .filter { it.isFile && it.extension == "mp3" && it.length() > 1024 }
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
        return if (file.exists() && file.length() > 1024) file else null
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

        mutableDownloadError.value = null
        appScope.launch {
            val targetFile = File(getDownloadDir(), "$trackId.mp3")
            val partial = File(getDownloadDir(), "$trackId.part")
            var connection: HttpURLConnection? = null
            try {
                val stream = innerTubeService.extractPlayerStream(track.youtubeId.ifBlank { track.id })
                check(stream.mimeType.startsWith("audio/")) { "Offline saving is not supported for this stream." }
                connection = URL(stream.streamUrl).openConnection() as HttpURLConnection
                connection.connectTimeout = 15000
                connection.readTimeout = 20000
                stream.headers.forEach { (key, value) -> connection.setRequestProperty(key, value) }
                connection.connect()
                check(connection.responseCode in 200..299) { "Audio download failed." }
                connection.inputStream.use { input ->
                    FileOutputStream(partial).use { output ->
                        val buffer = ByteArray(8192)
                        while (true) {
                            coroutineContext.ensureActive()
                            val count = input.read(buffer)
                            if (count < 0) break
                            output.write(buffer, 0, count)
                        }
                    }
                }
                check(partial.length() > 1024) { "Downloaded audio is empty." }
                val expected = connection.contentLengthLong
                check(expected < 0 || partial.length() == expected) { "Audio download was incomplete." }
                check(partial.renameTo(targetFile)) { "Unable to save audio." }
                mutableDownloads.update { it + trackId }
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                mutableDownloadError.value = "Download failed. Check your connection or try another track."
            } finally {
                partial.delete()
                connection?.disconnect()
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
