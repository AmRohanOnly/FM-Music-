package com.fmmusic.client.playback

import android.content.Context
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext

data class PlaybackUiState(
    val title: String? = null,
    val artist: String? = null,
    val isPlaying: Boolean = false,
    val isBuffering: Boolean = false,
    val errorMessage: String? = null,
) {
    val hasMedia: Boolean get() = title != null
}

class Media3PlaybackController(context: Context) {
    private val player = ExoPlayer.Builder(context.applicationContext).build().apply {
        setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .build(),
            true,
        )
    }

    private val mutableState = MutableStateFlow(PlaybackUiState())
    val state = mutableState.asStateFlow()

    private val listener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) = publishState()

        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) = publishState()

        override fun onPlaybackStateChanged(playbackState: Int) = publishState()

        override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
            publishState(errorMessage = "Playback failed. Check the provider and try again.")
        }
    }

    init {
        player.addListener(listener)
    }

    suspend fun play(track: PlaybackTrack, source: LicensedPlaybackSource) {
        val media = source.resolve(track)
            ?: throw IllegalStateException("The licensed provider did not return a playable track.")
        play(media)
    }

    suspend fun play(media: LicensedMediaItem) {
        withContext(Dispatchers.Main.immediate) {
            val mediaItem = MediaItem.Builder()
                .setMediaId(media.providerId + ":" + media.title)
                .setUri(media.uri)
                .setMimeType(media.mimeType)
                .setMediaMetadata(
                    MediaMetadata.Builder()
                        .setTitle(media.title)
                        .setArtist(media.artist)
                        .build(),
                )
                .build()
            mutableState.value = PlaybackUiState(title = media.title, artist = media.artist)
            player.setMediaItem(mediaItem)
            player.prepare()
            player.play()
        }
    }

    fun togglePlayback() {
        if (player.isPlaying) {
            player.pause()
        } else if (player.mediaItemCount > 0) {
            player.play()
        }
    }

    fun release() {
        player.removeListener(listener)
        player.release()
    }

    private fun publishState(errorMessage: String? = null) {
        val mediaMetadata = player.currentMediaItem?.mediaMetadata
        mutableState.value = PlaybackUiState(
            title = mediaMetadata?.title?.toString(),
            artist = mediaMetadata?.artist?.toString(),
            isPlaying = player.isPlaying,
            isBuffering = player.playbackState == Player.STATE_BUFFERING,
            errorMessage = errorMessage,
        )
    }
}
