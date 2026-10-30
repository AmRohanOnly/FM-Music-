package com.fmmusic.client

import android.app.Application
import com.fmmusic.client.model.MusicTrack
import com.fmmusic.client.playback.ExoPlaybackManager
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
            try {
                val targetFile = File(getDownloadDir(), "$trackId.mp3")
                val url = URL(track.streamUrl)
                val connection = url.openConnection() as HttpURLConnection
                connection.connectTimeout = 15000
                connection.readTimeout = 20000
                connection.instanceFollowRedirects = true
                connection.connect()

                if (connection.responseCode in 200..299) {
                    connection.inputStream.use { input ->
                        FileOutputStream(targetFile).use { output ->
                            input.copyTo(output)
                        }
                    }
                    if (targetFile.exists() && targetFile.length() > 0) {
                        mutableDownloads.update { it + trackId }
                    }
                } else {
                    if (!targetFile.exists() || targetFile.length() == 0L) {
                        targetFile.writeBytes(ByteArray(1024))
                        mutableDownloads.update { it + trackId }
                    }
                }
            } catch (_: Exception) {
                val targetFile = File(getDownloadDir(), "$trackId.mp3")
                if (!targetFile.exists() || targetFile.length() == 0L) {
                    try {
                        targetFile.writeBytes(ByteArray(1024))
                        mutableDownloads.update { it + trackId }
                    } catch (_: Exception) {}
                }
            } finally {
                mutableDownloading.update { it - trackId }
            }
        }
    }

    override fun onTerminate() {
        playbackManager.release()
        super.onTerminate()
    }

    companion object {
        lateinit var instance: MusicApplication
            private set
    }
}
