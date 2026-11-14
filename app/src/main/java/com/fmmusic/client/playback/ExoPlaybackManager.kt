package com.fmmusic.client.playback

import android.content.Context
import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
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

@OptIn(UnstableApi::class)
class ExoPlaybackManager(context: Context) {
    private val appContext = context.applicationContext
    private val scope = CoroutineScope(Dispatchers.Main.immediate)

    private val httpDataSourceFactory = DefaultHttpDataSource.Factory()
        .setUserAgent(DEFAULT_USER_AGENT)
        .setConnectTimeoutMs(10_000)
        .setReadTimeoutMs(15_000)
        .setAllowCrossProtocolRedirects(true)

    private val dataSourceFactory = DefaultDataSource.Factory(appContext, httpDataSourceFactory)

    private val player: ExoPlayer = ExoPlayer.Builder(appContext)
        .setMediaSourceFactory(DefaultMediaSourceFactory(dataSourceFactory))
        .setHandleAudioBecomingNoisy(true)
        .setWakeMode(C.WAKE_MODE_NETWORK)
        .build()
        .apply {
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

    private var originalQueue: List<MusicTrack> = emptyList()
    private var progressJob: Job? = null
    private var sleepTimerJob: Job? = null
    private var loadTrackJob: Job? = null
    private var retriedCurrentTrack = false

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

                if (playbackState == Player.STATE_READY) {
                    retriedCurrentTrack = false
                } else if (playbackState == Player.STATE_ENDED) {
                    handleTrackEnded()
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                val track = mutableState.value.currentTrack
                if (!retriedCurrentTrack && track != null) {
                    retriedCurrentTrack = true
                    val vid = track.youtubeId.ifBlank { track.id }
                    MusicApplication.instance.innerTubeService.invalidateStream(vid)
                    playTrack(track, mutableState.value.queue, preserveRetryFlag = true)
                    return
                }

                mutableState.update {
                    it.copy(
                        isPlaying = false,
                        isBuffering = false,
                        errorMessage = "Playback failed (${error.errorCodeName}): ${error.message ?: "Unable to stream track"}"
                    )
                }
            }
        })
    }

    fun playTrack(
        track: MusicTrack,
        queueList: List<MusicTrack>? = null,
        preserveRetryFlag: Boolean = false
    ) {
        if (!preserveRetryFlag) {
            retriedCurrentTrack = false
        }
        loadTrackJob?.cancel()

        val incomingQueue = queueList ?: if (mutableState.value.queue.any { it.id == track.id }) {
            mutableState.value.queue
        } else {
            mutableState.value.queue + track
        }

        if (queueList != null) {
            originalQueue = queueList
        } else if (originalQueue.none { it.id == track.id }) {
            originalQueue = originalQueue + track
        }

        val effectiveQueue = if (mutableState.value.isShuffled && queueList != null && queueList.size > 1) {
            val rest = queueList.filter { it.id != track.id }.shuffled()
            listOf(track) + rest
        } else {
            incomingQueue
        }

        val trackIdx = effectiveQueue.indexOfFirst { it.id == track.id }.coerceAtLeast(0)

        mutableState.update {
            it.copy(
                currentTrack = track,
                queue = effectiveQueue,
                queueIndex = trackIdx,
                isBuffering = true,
                errorMessage = null,
                durationMs = track.durationSeconds * 1000L,
                currentPositionMs = 0L
            )
        }

        val metadata = buildMediaMetadata(track)
        val localFile = MusicApplication.instance.getLocalTrackFile(track.id)
        if (localFile != null && localFile.exists()) {
            val playbackUri = Uri.fromFile(localFile)
            val mediaItem = MediaItem.Builder()
                .setUri(playbackUri)
                .setMediaId(track.id)
                .setMediaMetadata(metadata)
                .build()

            player.repeatMode = if (mutableState.value.repeatMode == RepeatMode.ONE) {
                Player.REPEAT_MODE_ONE
            } else {
                Player.REPEAT_MODE_OFF
            }
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

        loadTrackJob = scope.launch {
            try {
                val videoId = track.youtubeId.ifBlank { track.id }
                val streamInfo = MusicApplication.instance.innerTubeService.extractPlayerStream(
                    videoId = videoId,
                    allowFallback = false
                )

                val headerMap = streamInfo.headers
                val ua = headerMap.entries
                    .firstOrNull { it.key.equals("User-Agent", ignoreCase = true) }
                    ?.value
                    ?: DEFAULT_USER_AGENT
                httpDataSourceFactory.setUserAgent(ua)
                val extraHeaders = headerMap.filterKeys { !it.equals("User-Agent", ignoreCase = true) }
                httpDataSourceFactory.setDefaultRequestProperties(extraHeaders)

                val streamUri = Uri.parse(streamInfo.streamUrl)
                val mediaItem = MediaItem.Builder()
                    .setUri(streamUri)
                    .setMediaId(track.id)
                    .setMediaMetadata(metadata)
                    .build()

                player.repeatMode = if (mutableState.value.repeatMode == RepeatMode.ONE) {
                    Player.REPEAT_MODE_ONE
                } else {
                    Player.REPEAT_MODE_OFF
                }
                player.setMediaItem(mediaItem)
                player.prepare()
                player.play()

                mutableState.update {
                    it.copy(
                        currentTrack = track.copy(streamUrl = streamInfo.streamUrl),
                        streamSource = streamInfo.formatDescription,
                        streamBitrate = streamInfo.bitrate,
                        streamMimeType = streamInfo.mimeType,
                        isSignedStream = streamInfo.isSigned,
                        errorMessage = null
                    )
                }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                mutableState.update {
                    it.copy(
                        isPlaying = false,
                        isBuffering = false,
                        streamSource = "Stream Extraction Failed",
                        errorMessage = e.message ?: "Unable to fetch playable audio stream."
                    )
                }
            }
        }
    }

    private fun buildMediaMetadata(track: MusicTrack): MediaMetadata {
        val builder = MediaMetadata.Builder()
            .setTitle(track.title)
            .setArtist(track.artist)
            .setAlbumTitle(track.album)
        val thumb = track.resolvedThumbnailUrl
        if (thumb.isNotBlank()) {
            builder.setArtworkUri(Uri.parse(thumb))
        }
        return builder.build()
    }

    fun retryCurrentTrack() {
        val track = mutableState.value.currentTrack ?: return
        val vid = track.youtubeId.ifBlank { track.id }
        MusicApplication.instance.innerTubeService.invalidateStream(vid)
        retriedCurrentTrack = false
        playTrack(track, mutableState.value.queue)
    }

    fun playFromQueue(index: Int) {
        val q = mutableState.value.queue
        if (index in q.indices) {
            playTrack(q[index], q)
        }
    }

    fun togglePlayPause() {
        if (player.isPlaying) {
            player.pause()
        } else if (player.mediaItemCount > 0) {
            player.play()
        } else {
            retryCurrentTrack()
        }
    }

    fun seekTo(positionMs: Long) {
        val maxDur = if (player.duration > 0) player.duration else mutableState.value.durationMs
        val clamped = positionMs.coerceIn(0L, maxDur.coerceAtLeast(0L))
        if (player.mediaItemCount > 0) {
            player.seekTo(clamped)
        }
        mutableState.update { it.copy(currentPositionMs = clamped) }
    }

    fun next() {
        val q = mutableState.value.queue
        if (q.isEmpty()) return
        if (q.size == 1 && mutableState.value.repeatMode == RepeatMode.ALL) {
            seekTo(0L)
            player.play()
            return
        }
        val nextIdx = (mutableState.value.queueIndex + 1) % q.size
        playTrack(q[nextIdx])
    }

    fun prev() {
        val q = mutableState.value.queue
        if (q.isEmpty()) return
        if (player.currentPosition > 3000L) {
            seekTo(0L)
            return
        }
        val prevIdx = (mutableState.value.queueIndex - 1 + q.size) % q.size
        playTrack(q[prevIdx])
    }

    fun toggleRepeat() {
        val nextMode = when (mutableState.value.repeatMode) {
            RepeatMode.OFF -> RepeatMode.ALL
            RepeatMode.ALL -> RepeatMode.ONE
            RepeatMode.ONE -> RepeatMode.OFF
        }
        player.repeatMode = if (nextMode == RepeatMode.ONE) {
            Player.REPEAT_MODE_ONE
        } else {
            Player.REPEAT_MODE_OFF
        }
        mutableState.update { it.copy(repeatMode = nextMode) }
    }

    fun toggleShuffle() {
        val enableShuffle = !mutableState.value.isShuffled
        val curTrack = mutableState.value.currentTrack
        val currentQueue = mutableState.value.queue

        if (enableShuffle) {
            if (originalQueue.isEmpty() || originalQueue.size < currentQueue.size) {
                originalQueue = currentQueue
            }
            val rest = currentQueue.filter { it.id != curTrack?.id }.shuffled()
            val shuffledQueue = if (curTrack != null) listOf(curTrack) + rest else rest
            mutableState.update {
                it.copy(
                    isShuffled = true,
                    queue = shuffledQueue,
                    queueIndex = if (curTrack != null) 0 else -1
                )
            }
        } else {
            val restored = if (originalQueue.isNotEmpty()) originalQueue else currentQueue
            val restoredIdx = if (curTrack != null) {
                restored.indexOfFirst { it.id == curTrack.id }.coerceAtLeast(0)
            } else {
                -1
            }
            mutableState.update {
                it.copy(
                    isShuffled = false,
                    queue = restored,
                    queueIndex = restoredIdx
                )
            }
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
                val q = mutableState.value.queue
                if (mutableState.value.queueIndex in 0 until q.lastIndex) {
                    next()
                } else {
                    player.pause()
                    player.seekTo(0L)
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
        loadTrackJob?.cancel()
        stopProgressTracker()
        sleepTimerJob?.cancel()
        player.release()
    }

    companion object {
        private const val DEFAULT_USER_AGENT =
            "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L) gzip"
    }
}
