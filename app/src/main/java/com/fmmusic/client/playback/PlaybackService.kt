package com.fmmusic.client.playback

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.fmmusic.client.MainActivity
import com.fmmusic.client.MusicApplication
import com.fmmusic.client.R
import java.util.IdentityHashMap

/**
 * Media3 [MediaSessionService] managing background audio playback and publishing
 * the system media player notification in the notification shade, quick settings,
 * and lock screen.
 */
@OptIn(UnstableApi::class)
class PlaybackService : MediaSessionService() {
    private var mediaSession: MediaSession? = null

    override fun onCreate() {
        super.onCreate()
        ensureNotificationChannel()

        val notificationProvider = DefaultMediaNotificationProvider.Builder(this)
            .setChannelId(CHANNEL_ID)
            .setChannelName(R.string.notification_channel_name)
            .setNotificationId(NOTIFICATION_ID)
            .build().apply {
                setSmallIcon(R.drawable.ic_notification)
            }
        setMediaNotificationProvider(notificationProvider)

        setListener(object : Listener {
            override fun onForegroundServiceStartNotAllowedException() {
                Log.w(TAG, "Foreground service start not allowed while app is backgrounded")
            }
        })

        val playbackManager = MusicApplication.instance.playbackManager
        val sessionPlayer = PlaybackSessionPlayer(playbackManager)

        val activityIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            activityIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val session = MediaSession.Builder(this, sessionPlayer)
            .setSessionActivity(pendingIntent)
            .build()
        mediaSession = session
        addSession(session)
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return mediaSession
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        val player = mediaSession?.player
        if (player == null || !player.playWhenReady || player.mediaItemCount == 0 || player.playbackState == Player.STATE_ENDED) {
            stopSelf()
        }
    }

    override fun onDestroy() {
        mediaSession?.let { session ->
            removeSession(session)
            session.release()
            mediaSession = null
        }
        super.onDestroy()
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows currently playing music and playback controls"
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private class PlaybackSessionPlayer(
        private val playbackManager: ExoPlaybackManager
    ) : ForwardingPlayer(playbackManager.exoPlayer) {
        private val listeners = IdentityHashMap<Player.Listener, Player.Listener>()

        override fun getAvailableCommands(): Player.Commands {
            return augmentCommands(super.getAvailableCommands())
        }

        override fun isCommandAvailable(command: Int): Boolean {
            return when (command) {
                Player.COMMAND_PLAY_PAUSE,
                Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM,
                Player.COMMAND_SEEK_TO_NEXT,
                Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
                Player.COMMAND_SEEK_TO_PREVIOUS,
                Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM -> true
                else -> super.isCommandAvailable(command)
            }
        }

        override fun hasNextMediaItem(): Boolean {
            return playbackManager.state.value.queue.size > 1 || super.hasNextMediaItem()
        }

        override fun hasPreviousMediaItem(): Boolean {
            return playbackManager.state.value.queue.size > 1 || super.hasPreviousMediaItem()
        }

        override fun play() {
            if (mediaItemCount > 0) {
                super.play()
            } else {
                playbackManager.retryCurrentTrack()
            }
        }

        override fun seekTo(positionMs: Long) {
            playbackManager.seekTo(positionMs)
        }

        override fun seekTo(mediaItemIndex: Int, positionMs: Long) {
            if (mediaItemIndex == currentMediaItemIndex) {
                playbackManager.seekTo(positionMs)
            } else {
                super.seekTo(mediaItemIndex, positionMs)
            }
        }

        override fun seekToNext() {
            playbackManager.next()
        }

        override fun seekToNextMediaItem() {
            playbackManager.next()
        }

        override fun seekToPrevious() {
            playbackManager.prev()
        }

        override fun seekToPreviousMediaItem() {
            playbackManager.prev()
        }

        override fun addListener(listener: Player.Listener) {
            val wrapped = listeners.getOrPut(listener) {
                object : Player.Listener by listener {
                    override fun onEvents(player: Player, events: Player.Events) {
                        listener.onEvents(this@PlaybackSessionPlayer, events)
                    }

                    override fun onAvailableCommandsChanged(availableCommands: Player.Commands) {
                        listener.onAvailableCommandsChanged(augmentCommands(availableCommands))
                    }
                }
            }
            super.addListener(wrapped)
        }

        override fun removeListener(listener: Player.Listener) {
            val wrapped = listeners.remove(listener) ?: listener
            super.removeListener(wrapped)
        }

        private fun augmentCommands(base: Player.Commands): Player.Commands {
            return base.buildUpon()
                .addAll(
                    Player.COMMAND_PLAY_PAUSE,
                    Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM,
                    Player.COMMAND_SEEK_TO_NEXT,
                    Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
                    Player.COMMAND_SEEK_TO_PREVIOUS,
                    Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM
                )
                .build()
        }
    }

    companion object {
        private const val TAG = "PlaybackService"
        const val CHANNEL_ID = "fm_music_playback_channel"
        private const val NOTIFICATION_ID = 1001
    }
}
