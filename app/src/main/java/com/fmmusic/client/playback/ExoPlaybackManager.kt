package com.fmmusic.client.playback

import android.content.Context
import android.content.Intent
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
import androidx.media3.datasource.cache.CacheDataSource
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

    private val upstreamDataSourceFactory = DefaultDataSource.Factory(appContext, httpDataSourceFactory)
    private val boundedDataSourceFactory = BoundedRangeDataSourceFactory(upstreamDataSourceFactory)
    private val cacheDataSourceFactory = CacheDataSource.Factory()
        .setCache(MusicApplication.instance.mediaCache)
        .setUpstreamDataSourceFactory(boundedDataSourceFactory)
        .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)

    private val player: ExoPlayer = ExoPlayer.Builder(appContext)
        .setMediaSourceFactory(DefaultMediaSourceFactory(cacheDataSourceFactory))
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

    val exoPlayer: ExoPlayer
        get() = player

    private val mutableState = MutableStateFlow(PlaybackUiState())
    val state = mutableState.asStateFlow()

    private var originalQueue: List<MusicTrack> = emptyList()
    private var progressJob: Job? = null
    private var sleepTimerJob: Job? = null
    private var loadTrackJob: Job? = null
    private var suggestionsJob: Job? = null
    private val failedSourcesForTrack = mutableSetOf<String>()
    private var retryCountForTrack = 0
    private var isSeeking = false

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

            override fun onPositionDiscontinuity(
                oldPosition: Player.PositionInfo,
                newPosition: Player.PositionInfo,
                reason: Int
            ) {
                if (!isSeeking) {
                    mutableState.update {
                        it.copy(currentPositionMs = newPosition.positionMs.coerceAtLeast(0L))
                    }
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                val track = mutableState.value.currentTrack
                val currentPos = player.currentPosition.coerceAtLeast(mutableState.value.currentPositionMs)
                val failedSource = mutableState.value.streamSource
                if (!failedSource.isNullOrBlank()) {
                    failedSourcesForTrack.add(failedSource)
                }

                if (retryCountForTrack < MAX_STREAM_RETRIES && track != null) {
                    retryCountForTrack++
                    val vid = track.youtubeId.ifBlank { track.id }
                    MusicApplication.instance.innerTubeService.invalidateStream(vid)
                    playTrack(
                        track = track,
                        queueList = mutableState.value.queue,
                        isRetry = true,
                        forceAlternative = true,
                        initialPositionMs = currentPos,
                        excludedSources = failedSourcesForTrack.toSet()
                    )
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
        isRetry: Boolean = false,
        forceAlternative: Boolean = false,
        initialPositionMs: Long = 0L,
        excludedSources: Set<String> = emptySet()
    ) {
        if (!isRetry) {
            failedSourcesForTrack.clear()
            retryCountForTrack = 0
        }
        loadTrackJob?.cancel()
        ensurePlaybackServiceStarted()

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
                currentPositionMs = initialPositionMs
            )
        }

        if (!isRetry) {
            loadSuggestionsForTrack(track, effectiveQueue)
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
            if (initialPositionMs > 0L) {
                player.seekTo(initialPositionMs)
            }
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
                    allowFallback = false,
                    forceAlternative = forceAlternative,
                    excludedSources = excludedSources
                )

                val headerMap = streamInfo.headers
                val ua = headerMap.entries
                    .firstOrNull { it.key.equals("User-Agent", ignoreCase = true) }
                    ?.value
                    ?: DEFAULT_USER_AGENT
                val extraHeaders = headerMap.filterKeys { !it.equals("User-Agent", ignoreCase = true) }

                val streamUri = Uri.parse(streamInfo.streamUrl)
                val mediaItem = MediaItem.Builder()
                    .setUri(streamUri)
                    .setMediaId(track.id)
                    .setMediaMetadata(metadata)
                    .build()

                val trackHttpFactory = DefaultHttpDataSource.Factory()
                    .setUserAgent(ua)
                    .setConnectTimeoutMs(12_000)
                    .setReadTimeoutMs(20_000)
                    .setAllowCrossProtocolRedirects(true)
                    .setDefaultRequestProperties(extraHeaders)

                val trackUpstreamFactory = DefaultDataSource.Factory(appContext, trackHttpFactory)
                val trackBoundedFactory = BoundedRangeDataSourceFactory(trackUpstreamFactory)
                val trackCacheFactory = CacheDataSource.Factory()
                    .setCache(MusicApplication.instance.mediaCache)
                    .setUpstreamDataSourceFactory(trackBoundedFactory)
                    .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
                val mediaSourceFactory = DefaultMediaSourceFactory(trackCacheFactory)
                val mediaSource = mediaSourceFactory.createMediaSource(mediaItem)

                player.repeatMode = if (mutableState.value.repeatMode == RepeatMode.ONE) {
                    Player.REPEAT_MODE_ONE
                } else {
                    Player.REPEAT_MODE_OFF
                }
                player.setMediaSource(mediaSource)
                player.prepare()
                if (initialPositionMs > 0L) {
                    player.seekTo(initialPositionMs)
                }
                player.play()

                mutableState.update {
                    it.copy(
                        currentTrack = track.copy(streamUrl = streamInfo.streamUrl),
                        streamSource = streamInfo.source,
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

    private fun loadSuggestionsForTrack(seedTrack: MusicTrack, currentQueue: List<MusicTrack>) {
        suggestionsJob?.cancel()
        mutableState.update { it.copy(isLoadingSuggestions = true) }

        suggestionsJob = scope.launch {
            try {
                val vid = seedTrack.youtubeId.ifBlank { seedTrack.id }
                val fetched = MusicApplication.instance.innerTubeService.fetchUpNextSuggestions(
                    videoId = vid,
                    seedTrack = seedTrack
                )
                val queuedIds = currentQueue.mapTo(mutableSetOf()) { it.youtubeId.ifBlank { it.id } }
                val currentVid = seedTrack.youtubeId.ifBlank { seedTrack.id }
                val freshSuggestions = fetched.filter { candidate ->
                    val candVid = candidate.youtubeId.ifBlank { candidate.id }
                    candidate.id != seedTrack.id && candVid != currentVid && candVid !in queuedIds
                }.ifEmpty {
                    fetched.filter { candidate ->
                        val candVid = candidate.youtubeId.ifBlank { candidate.id }
                        candidate.id != seedTrack.id && candVid != currentVid
                    }
                }
                mutableState.update {
                    it.copy(
                        suggestedTracks = freshSuggestions,
                        isLoadingSuggestions = false
                    )
                }
            } catch (_: Exception) {
                mutableState.update { it.copy(isLoadingSuggestions = false) }
            }
        }
    }

    fun playSuggestedTrack(track: MusicTrack) {
        val currentQueue = mutableState.value.queue.toMutableList()
        val existingIdx = currentQueue.indexOfFirst { it.id == track.id }
        val targetQueue = if (existingIdx >= 0) {
            currentQueue
        } else {
            val insertIdx = (mutableState.value.queueIndex + 1).coerceIn(0, currentQueue.size)
            currentQueue.add(insertIdx, track)
            currentQueue
        }
        mutableState.update { state ->
            state.copy(suggestedTracks = state.suggestedTracks.filterNot { it.id == track.id })
        }
        playTrack(track, targetQueue)
    }

    fun enqueueSuggestion(track: MusicTrack) {
        val currentQueue = mutableState.value.queue
        if (currentQueue.none { it.id == track.id }) {
            val updated = currentQueue + track
            if (originalQueue.none { it.id == track.id }) {
                originalQueue = originalQueue + track
            }
            mutableState.update { state ->
                state.copy(
                    queue = updated,
                    suggestedTracks = state.suggestedTracks.filterNot { it.id == track.id }
                )
            }
        } else {
            mutableState.update { state ->
                state.copy(suggestedTracks = state.suggestedTracks.filterNot { it.id == track.id })
            }
        }
    }

    fun toggleAutoplay() {
        mutableState.update { it.copy(autoplayEnabled = !it.autoplayEnabled) }
    }

    private fun buildMediaMetadata(track: MusicTrack): MediaMetadata {
        val builder = MediaMetadata.Builder()
            .setTitle(track.title)
            .setArtist(track.artist)
            .setAlbumTitle(track.album)
            .setDisplayTitle(track.title)
            .setSubtitle(track.artist)
            .setDescription(track.album)
            .setIsPlayable(true)
            .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
        val thumb = track.resolvedThumbnailUrl
        if (thumb.isNotBlank()) {
            builder.setArtworkUri(Uri.parse(thumb))
        }
        return builder.build()
    }

    private fun ensurePlaybackServiceStarted() {
        try {
            appContext.startService(Intent(appContext, PlaybackService::class.java))
        } catch (_: Exception) {
            // Ignored if OS restricts background start; MediaController binding or active foreground service handles it.
        }
    }

    fun retryCurrentTrack() {
        val track = mutableState.value.currentTrack ?: return
        val resumePos = mutableState.value.currentPositionMs.takeIf { it > 0L } ?: 0L
        val vid = track.youtubeId.ifBlank { track.id }
        MusicApplication.instance.innerTubeService.invalidateStream(vid)
        failedSourcesForTrack.clear()
        retryCountForTrack = 0
        playTrack(
            track = track,
            queueList = mutableState.value.queue,
            forceAlternative = true,
            initialPositionMs = resumePos
        )
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
        } else if (player.mediaItemCount > 0 && mutableState.value.errorMessage.isNullOrBlank()) {
            ensurePlaybackServiceStarted()
            player.play()
        } else {
            retryCurrentTrack()
        }
    }

    fun seekTo(positionMs: Long) {
        val maxDur = if (player.duration > 0) player.duration else mutableState.value.durationMs
        val clamped = positionMs.coerceIn(0L, maxDur.coerceAtLeast(0L))
        isSeeking = true
        mutableState.update { it.copy(currentPositionMs = clamped) }
        if (player.mediaItemCount > 0) {
            player.seekTo(clamped)
        }
        scope.launch {
            delay(500L)
            isSeeking = false
        }
    }

    fun next() {
        val stateVal = mutableState.value
        val q = stateVal.queue
        if (q.isEmpty()) {
            val firstSug = stateVal.suggestedTracks.firstOrNull() ?: return
            playSuggestedTrack(firstSug)
            return
        }
        if (stateVal.queueIndex in 0 until q.lastIndex) {
            playTrack(q[stateVal.queueIndex + 1])
            return
        }
        if (stateVal.autoplayEnabled && stateVal.suggestedTracks.isNotEmpty() && stateVal.repeatMode != RepeatMode.ALL) {
            playSuggestedTrack(stateVal.suggestedTracks.first())
            return
        }
        if (q.size == 1 && stateVal.repeatMode == RepeatMode.ALL) {
            seekTo(0L)
            player.play()
            return
        }
        val nextIdx = (stateVal.queueIndex + 1) % q.size
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

    fun cycleRepeatMode() = toggleRepeat()

    fun toggleShuffle(forceEnable: Boolean? = null) {
        val enableShuffle = forceEnable ?: !mutableState.value.isShuffled
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

    fun cancelSleepTimer() = setSleepTimer(null)

    private fun handleTrackEnded() {
        val stateVal = mutableState.value
        when (stateVal.repeatMode) {
            RepeatMode.ONE -> {
                seekTo(0L)
                player.play()
            }
            RepeatMode.ALL -> {
                next()
            }
            RepeatMode.OFF -> {
                val q = stateVal.queue
                if (stateVal.queueIndex in 0 until q.lastIndex) {
                    next()
                } else if (stateVal.autoplayEnabled && stateVal.suggestedTracks.isNotEmpty()) {
                    playSuggestedTrack(stateVal.suggestedTracks.first())
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
                if (!isSeeking) {
                    val pos = player.currentPosition
                    val dur = if (player.duration > 0) player.duration else mutableState.value.durationMs
                    mutableState.update {
                        it.copy(
                            currentPositionMs = pos,
                            durationMs = dur
                        )
                    }
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
        suggestionsJob?.cancel()
        stopProgressTracker()
        sleepTimerJob?.cancel()
        player.release()
    }

    companion object {
        private const val MAX_STREAM_RETRIES = 4
        private const val DEFAULT_USER_AGENT =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
    }
}
