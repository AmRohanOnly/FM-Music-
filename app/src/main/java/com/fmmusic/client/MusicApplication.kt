package com.fmmusic.client

import android.app.Application
import com.fmmusic.client.playback.ExoPlaybackManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

class MusicApplication : Application() {
    lateinit var playbackManager: ExoPlaybackManager
        private set

    private val mutableFavorites = MutableStateFlow<Set<String>>(emptySet())
    val favorites = mutableFavorites.asStateFlow()

    private val mutableDownloads = MutableStateFlow<Set<String>>(emptySet())
    val downloads = mutableDownloads.asStateFlow()

    override fun onCreate() {
        super.onCreate()
        instance = this
        playbackManager = ExoPlaybackManager(this)
    }

    override fun onTerminate() {
        playbackManager.release()
        super.onTerminate()
    }

    fun toggleFavorite(trackId: String) {
        mutableFavorites.update { cur ->
            if (cur.contains(trackId)) cur - trackId else cur + trackId
        }
    }

    fun toggleDownload(trackId: String) {
        mutableDownloads.update { cur ->
            if (cur.contains(trackId)) cur - trackId else cur + trackId
        }
    }

    companion object {
        lateinit var instance: MusicApplication
            private set
    }
}
