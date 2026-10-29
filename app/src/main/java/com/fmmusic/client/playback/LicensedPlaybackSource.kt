package com.fmmusic.client.playback

import java.net.URI

data class PlaybackTrack(
    val id: String,
    val title: String,
    val artist: String,
) {
    init {
        require(id.isNotBlank()) { "Track ID must not be blank." }
        require(title.isNotBlank()) { "Track title must not be blank." }
        require(artist.isNotBlank()) { "Track artist must not be blank." }
    }
}

/**
 * A provider-authorized audio location. The URI is sensitive and must not be logged.
 */
class LicensedMediaItem(
    providerId: String,
    val uri: String,
    val title: String,
    val artist: String,
    val mimeType: String? = null,
) {
    val providerId = providerId.trim()

    init {
        require(this.providerId.isNotBlank()) { "Provider ID must not be blank." }
        require(!this.providerId.equals("innertubex", ignoreCase = true)) {
            "InnerTubeX is restricted to public catalog metadata, not playback."
        }
        require(title.isNotBlank()) { "Track title must not be blank." }
        require(artist.isNotBlank()) { "Track artist must not be blank." }

        val parsedUri = URI(uri)
        val scheme = parsedUri.scheme?.lowercase()
        require(scheme in setOf("https", "content", "file")) {
            "Licensed media must use an HTTPS or local content URI."
        }
        require(scheme != "https" || (!parsedUri.host.isNullOrBlank() && parsedUri.userInfo == null)) {
            "HTTPS media URIs must have a host and must not include user information."
        }
        require(parsedUri.host.isNullOrBlank() || !isYouTubeHost(parsedUri.host)) {
            "YouTube media must use YouTube's official playback experience."
        }
    }

    override fun toString(): String =
        "LicensedMediaItem(providerId=$providerId, uri=[REDACTED], title=$title, artist=$artist, mimeType=$mimeType)"
}

private fun isYouTubeHost(host: String): Boolean {
    val normalizedHost = host.lowercase().removeSuffix(".")
    return listOf("youtube.com", "youtube-nocookie.com", "youtu.be", "googlevideo.com", "ytimg.com")
        .any { normalizedHost == it || normalizedHost.endsWith(".$it") }
}

/**
 * Implement this only for a provider that is authorized to stream the requested track.
 * The implementation owns provider-specific licensing, consent, and authentication.
 */
interface LicensedPlaybackSource {
    suspend fun resolve(track: PlaybackTrack): LicensedMediaItem?
}
