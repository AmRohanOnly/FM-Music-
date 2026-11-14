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

    val resolvedThumbnailUrl: String
        get() {
            val raw = thumbnailUrl.trim()
            val normalized = when {
                raw.startsWith("//") -> "https:$raw"
                raw.startsWith("http://") -> "https://" + raw.removePrefix("http://")
                else -> raw
            }.replace(Regex("=w\\d+-h\\d+[^\"&\\s]*"), "=w544-h544-l90-rj")

            if (normalized.startsWith("https://")) return normalized

            val vid = youtubeId.ifBlank { id }.trim()
            return if (vid.isNotBlank() && !vid.contains("-") && !vid.startsWith("dyn")) {
                "https://i.ytimg.com/vi/$vid/hqdefault.jpg"
            } else {
                ""
            }
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
    val sleepTimerMinutesRemaining: Int? = null,
    val streamSource: String? = null,
    val streamBitrate: Int? = null,
    val streamMimeType: String? = null,
    val isSignedStream: Boolean = false
) {
    val hasMedia: Boolean get() = currentTrack != null
    val progressFraction: Float
        get() = if (durationMs > 0) (currentPositionMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f) else 0f
}
