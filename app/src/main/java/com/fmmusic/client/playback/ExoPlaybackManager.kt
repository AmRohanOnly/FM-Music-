package com.fmmusic.client.playback

import android.content.Context
import android.net.Uri
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.cancel
import kotlinx.coroutines.ensureActive
import kotlin.coroutines.coroutineContext
import com.fmmusic.client.MusicApplication
import com.fmmusic.client.model.MusicTrack
import com.fmmusic.client.model.PlaybackUiState
import com.fmmusic.client.model.RepeatMode
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class ExoPlaybackManager(context: Context) {
    private val scope = CoroutineScope(Dispatchers.Main.immediate)

    private val player: ExoPlayer = ExoPlayer.Builder(context.applicationContext).build().apply {
        setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .build(),
            true
        )
    }

    private val mutableState = MutableStateFlow(PlaybackUiState())
    val state = mutableState.asStateFlow()

    private var resolutionJob: Job? = null
    private var progressJob: Job? = null
    private var sleepTimerJob: Job? = null

    init {
        player.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                mutableState.update { it.copy(isPlaying = isPlaying) }
                if (isPlaying) {
                    startProgressTracker()
                } else {
                    stopProgressTracker()
                }
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                val isBuffering = playbackState == Player.STATE_BUFFERING
                val duration = if (player.duration > 0) player.duration else mutableState.value.durationMs
                mutableState.update {
                    it.copy(
                        isBuffering = isBuffering,
                        durationMs = duration
                    )
                }

                if (playbackState == Player.STATE_ENDED) {
                    handleTrackEnded()
                }
            }

            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                mutableState.value.currentTrack?.let {
                    MusicApplication.instance.innerTubeService.invalidateStream(it.youtubeId.ifBlank { it.id })
                }
                mutableState.update {
                    it.copy(
                        isPlaying = false,
                        isBuffering = false,
                        errorMessage = "Audio could not play (${error.errorCodeName}). Check your connection and tap Retry."
                    )
                }
            }
        })
    }

    fun playTrack(track: MusicTrack, queueList: List<MusicTrack>? = null) {
        resolutionJob?.cancel()
        player.stop()
        player.clearMediaItems()
        val currentQueue = queueList ?: if (mutableState.value.queue.any { it.id == track.id }) {
            mutableState.value.queue
        } else {
            mutableState.value.queue + track
        }
        val trackIdx = currentQueue.indexOfFirst { it.id == track.id }.coerceAtLeast(0)

        mutableState.update {
            it.copy(
                currentTrack = track,
                isPlaying = false,
                queue = currentQueue,
                queueIndex = trackIdx,
                isBuffering = true,
                errorMessage = null,
                durationMs = track.durationSeconds * 1000L,
                currentPositionMs = 0L
            )
        }

        val localFile = MusicApplication.instance.getLocalTrackFile(track.id)
        if (localFile != null && localFile.exists()) {
            val playbackUri = Uri.fromFile(localFile)
            val mediaItem = MediaItem.Builder()
                .setUri(playbackUri)
                .setMediaId(track.id)
                .setMediaMetadata(
                    MediaMetadata.Builder()
                        .setTitle(track.title)
                        .setArtist(track.artist)
                        .setAlbumTitle(track.album)
                        .build()
                )
                .build()

            player.setMediaItem(mediaItem)
            player.prepare()
            player.play()
            mutableState.update {
                it.copy(
                    streamSource = "Device Local Storage (Offline)",
                    streamBitrate = 320000,
                    streamMimeType = "audio/mpeg",
                    isSignedStream = false,
                    isBuffering = false
                )
            }
            return
        }

        // Extract signed stream URLs from the player endpoint and feed into ExoPlayer
        resolutionJob = scope.launch {
            try {
                val videoId = track.youtubeId.ifBlank { track.id }
                val streamInfo = MusicApplication.instance.innerTubeService.extractPlayerStream(videoId)
                coroutineContext.ensureActive()
                val streamUri = Uri.parse(streamInfo.streamUrl)

                val mediaItem = MediaItem.Builder()
                    .setUri(streamUri)
                    .setMimeType(streamInfo.mimeType.substringBefore(';'))
                    .setMediaId(track.id)
                    .setMediaMetadata(
                        MediaMetadata.Builder()
                            .setTitle(track.title)
                            .setArtist(track.artist)
                            .setAlbumTitle(track.album)
                            .build()
                    )
                    .build()

                val http = DefaultHttpDataSource.Factory()
                    .setDefaultRequestProperties(streamInfo.headers)
                    .setConnectTimeoutMs(15_000)
                    .setReadTimeoutMs(20_000)
                val source = DefaultMediaSourceFactory(
                    DefaultDataSource.Factory(MusicApplication.instance, http)
                ).createMediaSource(mediaItem)
                player.setMediaSource(source)
                player.prepare()
                player.play()

                mutableState.update {
                    it.copy(
                        currentTrack = track.copy(streamUrl = streamInfo.streamUrl),
                        streamSource = streamInfo.formatDescription,
                        streamBitrate = streamInfo.bitrate,
                        streamMimeType = streamInfo.mimeType,
                        isSignedStream = streamInfo.isSigned,
                        isBuffering = false
                    )
                }
            } catch (e: TimeoutCancellationException) {
                showResolutionError("Audio lookup timed out. Check your connection and tap Retry.")
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                showResolutionError("No playable audio is available. This track may be unavailable or restricted. Try another track or tap Retry.")
            }
        }
    }

    private fun showResolutionError(message: String) {
        mutableState.update { it.copy(isPlaying = false, isBuffering = false, errorMessage = message) }
    }

    fun retry() {
        mutableState.value.currentTrack?.let { track ->
            MusicApplication.instance.innerTubeService.invalidateStream(track.youtubeId.ifBlank { track.id })
            playTrack(track)
        }
    }

    fun togglePlayPause() {
        if (mutableState.value.errorMessage != null) {
            retry()
            return
        }
        if (player.isPlaying) {
            player.pause()
        } else if (player.mediaItemCount > 0) {
            player.play()
        }
    }

    fun seekTo(positionMs: Long) {
        val clamped = positionMs.coerceIn(0L, player.duration.coerceAtLeast(0L))
        player.seekTo(clamped)
        mutableState.update { it.copy(currentPositionMs = clamped) }
    }

    fun next() {
        val q = mutableState.value.queue
        if (q.isEmpty()) return
        val nextIdx = (mutableState.value.queueIndex + 1) % q.size
        playTrack(q[nextIdx], q)
    }

    fun prev() {
        val q = mutableState.value.queue
        if (q.isEmpty()) return
        if (player.currentPosition > 3000L) {
            seekTo(0L)
            return
        }
        val prevIdx = (mutableState.value.queueIndex - 1 + q.size) % q.size
        playTrack(q[prevIdx], q)
    }

    fun toggleRepeat() {
        val nextMode = when (mutableState.value.repeatMode) {
            RepeatMode.OFF -> RepeatMode.ALL
            RepeatMode.ALL -> RepeatMode.ONE
            RepeatMode.ONE -> RepeatMode.OFF
        }
        mutableState.update { it.copy(repeatMode = nextMode) }
    }

    fun toggleShuffle() {
        val isShuffled = !mutableState.value.isShuffled
        val curTrack = mutableState.value.currentTrack
        val currentQueue = mutableState.value.queue
        val newQueue = if (isShuffled) {
            val rest = currentQueue.filter { it.id != curTrack?.id }.shuffled()
            if (curTrack != null) listOf(curTrack) + rest else rest
        } else {
            currentQueue
        }
        mutableState.update {
            it.copy(
                isShuffled = isShuffled,
                queue = newQueue,
                queueIndex = newQueue.indexOfFirst { t -> t.id == curTrack?.id }.coerceAtLeast(0)
            )
        }
    }

    fun setSleepTimer(minutes: Int?) {
        sleepTimerJob?.cancel()
        if (minutes == null || minutes <= 0) {
            mutableState.update { it.copy(sleepTimerMinutesRemaining = null) }
            return
        }

        mutableState.update { it.copy(sleepTimerMinutesRemaining = minutes) }
        sleepTimerJob = scope.launch {
            var remaining = minutes
            while (remaining > 0 && isActive) {
                delay(60_000L)
                remaining--
                mutableState.update { it.copy(sleepTimerMinutesRemaining = remaining) }
            }
            if (isActive) {
                player.pause()
                mutableState.update { it.copy(sleepTimerMinutesRemaining = null) }
            }
        }
    }

    private fun handleTrackEnded() {
        when (mutableState.value.repeatMode) {
            RepeatMode.ONE -> {
                seekTo(0L)
                player.play()
            }
            RepeatMode.ALL -> {
                next()
            }
            RepeatMode.OFF -> {
                if (mutableState.value.queueIndex < mutableState.value.queue.size - 1) {
                    next()
                } else {
                    mutableState.update { it.copy(isPlaying = false, currentPositionMs = 0L) }
                }
            }
        }
    }

    private fun startProgressTracker() {
        stopProgressTracker()
        progressJob = scope.launch {
            while (isActive) {
                val pos = player.currentPosition
                val dur = if (player.duration > 0) player.duration else mutableState.value.durationMs
                mutableState.update {
                    it.copy(
                        currentPositionMs = pos,
                        durationMs = dur
                    )
                }
                delay(400L)
            }
        }
    }

    private fun stopProgressTracker() {
        progressJob?.cancel()
        progressJob = null
    }

    fun release() {
        stopProgressTracker()
        sleepTimerJob?.cancel()
        scope.cancel()
        player.release()
    }
}
