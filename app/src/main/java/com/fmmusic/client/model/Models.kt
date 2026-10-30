package com.fmmusic.client.model

data class MusicTrack(
    val id: String,
    val title: String,
    val artist: String,
    val album: String = "FM Music",
    val durationSeconds: Long = 240,
    val vibe: String = "Top hits",
    val youtubeId: String = "",
    val streamUrl: String = "",
    val lyrics: List<String> = emptyList(),
    val isFavorite: Boolean = false,
    val isDownloaded: Boolean = false,
    val thumbnailUrl: String = ""
) {
    val durationFormatted: String
        get() {
            val mins = durationSeconds / 60
            val secs = durationSeconds % 60
            return "%d:%02d".format(mins, secs)
        }
}

enum class RepeatMode {
    OFF, ALL, ONE
}

data class PlaybackUiState(
    val currentTrack: MusicTrack? = null,
    val isPlaying: Boolean = false,
    val isBuffering: Boolean = false,
    val currentPositionMs: Long = 0L,
    val durationMs: Long = 0L,
    val errorMessage: String? = null,
    val repeatMode: RepeatMode = RepeatMode.OFF,
    val isShuffled: Boolean = false,
    val queue: List<MusicTrack> = emptyList(),
    val queueIndex: Int = -1,
    val sleepTimerMinutesRemaining: Int? = null
) {
    val hasMedia: Boolean get() = currentTrack != null
    val progressFraction: Float
        get() = if (durationMs > 0) (currentPositionMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f) else 0f
}
