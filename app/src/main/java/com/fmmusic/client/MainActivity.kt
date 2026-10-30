package com.fmmusic.client

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode as AnimRepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fmmusic.client.data.MusicCatalogData
import com.fmmusic.client.model.MusicTrack
import com.fmmusic.client.model.PlaybackUiState
import com.fmmusic.client.model.RepeatMode
import com.fmmusic.client.playback.ExoPlaybackManager
import java.util.Calendar

private val Ink = Color(0xFF111116)
private val Panel = Color(0xFF1B1B23)
private val PanelSecondary = Color(0xFF22222D)
private val SoftText = Color(0xFFB7B7C4)
private val Accent = Color(0xFFB9F36A)
private val BorderDark = Color(0xFF393943)

private val VibesList = listOf("Hindi hits", "New releases", "Chill", "Indie", "Focus", "Workout")

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val playbackManager = (application as MusicApplication).playbackManager

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    background = Ink,
                    surface = Panel,
                    primary = Accent,
                    onPrimary = Ink,
                    onBackground = Color.White,
                    onSurface = Color.White
                )
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Ink
                ) {
                    MusicAppRoot(playbackManager)
                }
            }
        }
    }
}

private fun getTimeBasedGreeting(): Pair<String, String> {
    val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
    return when (hour) {
        in 5..11 -> Pair("Good morning,\nstart listening.", "Morning vibes")
        in 12..16 -> Pair("Good afternoon,\nfind your rhythm.", "Afternoon flow")
        in 17..21 -> Pair("Evening beats\nstart here.", "Evening beats")
        else -> Pair("Late night vibes\nstart here.", "Night session")
    }
}

private fun formatDuration(millis: Long): String {
    val totalSeconds = (millis / 1000).coerceAtLeast(0)
    val mins = totalSeconds / 60
    val secs = totalSeconds % 60
    return "%d:%02d".format(mins, secs)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MusicAppRoot(playbackManager: ExoPlaybackManager) {
    val playbackState by playbackManager.state.collectAsState()
    val favorites by MusicApplication.instance.favorites.collectAsState()
    val downloads by MusicApplication.instance.downloads.collectAsState()

    var searchQuery by remember { mutableStateOf("") }
    var selectedVibe by remember { mutableStateOf("Hindi hits") }
    var showNowPlayingSheet by remember { mutableStateOf(false) }
    var showSleepTimerDialog by remember { mutableStateOf(false) }

    val (greetingText, greetingTag) = remember { getTimeBasedGreeting() }

    val searchResults = remember(searchQuery) {
        if (searchQuery.isNotBlank()) MusicCatalogData.search(searchQuery) else emptyList()
    }

    val currentVibeTracks = remember(selectedVibe) {
        MusicCatalogData.curatedTracks.filter { it.vibe.equals(selectedVibe, ignoreCase = true) }
    }

    Scaffold(
        containerColor = Ink,
        bottomBar = {
            if (playbackState.hasMedia) {
                MiniPlayerBar(
                    state = playbackState,
                    onTogglePlay = playbackManager::togglePlayPause,
                    onNext = playbackManager::next,
                    onPrev = playbackManager::prev,
                    onExpand = { showNowPlayingSheet = true }
                )
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 16.dp)
        ) {
            // Header Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    FmLogoBadge(size = 40)
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "FM MUSIC",
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 2.sp,
                                fontSize = 16.sp
                            )
                            Spacer(Modifier.width(6.dp))
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .background(Accent, CircleShape)
                            )
                        }
                        Text(
                            "IN-APP STREAMING",
                            color = SoftText,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 1.sp
                        )
                    }
                }

                Surface(
                    color = Panel,
                    shape = RoundedCornerShape(12.dp),
                    border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderDark))
                ) {
                    Text(
                        greetingTag.uppercase(),
                        color = Accent,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                    )
                }
            }

            Spacer(Modifier.height(30.dp))

            // Hero Greeting
            Text(
                greetingText,
                fontSize = 34.sp,
                lineHeight = 39.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "High-fidelity stream extraction with zero external redirects.",
                color = SoftText,
                fontSize = 14.sp
            )

            Spacer(Modifier.height(24.dp))

            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Songs, artists, albums", color = Color(0xFF6B6B7A)) },
                shape = RoundedCornerShape(16.dp),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Accent,
                    unfocusedBorderColor = BorderDark,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    cursorColor = Accent,
                    focusedContainerColor = Panel,
                    unfocusedContainerColor = Panel
                )
            )

            // Search Results Section
            if (searchQuery.isNotBlank()) {
                Spacer(Modifier.height(18.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "SEARCH RESULTS (${searchResults.size})",
                        color = SoftText,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "Clear",
                        color = Accent,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.clickable { searchQuery = "" }
                    )
                }
                Spacer(Modifier.height(8.dp))
                searchResults.forEach { track ->
                    TrackListItem(
                        track = track,
                        isPlaying = playbackState.currentTrack?.id == track.id && playbackState.isPlaying,
                        isFavorite = favorites.contains(track.id),
                        isDownloaded = downloads.contains(track.id),
                        onPlay = { playbackManager.playTrack(track, searchResults) },
                        onToggleFavorite = { MusicApplication.instance.toggleFavorite(track.id) },
                        onToggleDownload = { MusicApplication.instance.toggleDownload(track.id) }
                    )
                }
            }

            Spacer(Modifier.height(28.dp))

            // Vibe Mixes Tabs
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "PICK A VIBE",
                    color = SoftText,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.5.sp
                )
                Text(
                    "Play Mix",
                    color = Accent,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.clickable {
                        if (currentVibeTracks.isNotEmpty()) {
                            playbackManager.playTrack(currentVibeTracks.first(), currentVibeTracks)
                        }
                    }
                )
            }

            Spacer(Modifier.height(12.dp))

            // Horizontal Vibe Chips
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                VibesList.forEach { vibe ->
                    val isSelected = selectedVibe == vibe
                    Surface(
                        modifier = Modifier.clickable { selectedVibe = vibe },
                        color = if (isSelected) Accent else Panel,
                        shape = RoundedCornerShape(12.dp),
                        border = if (!isSelected) CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderDark)) else null
                    ) {
                        Text(
                            vibe,
                            color = if (isSelected) Ink else SoftText,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp)
                        )
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            // Tracklist for selected Vibe
            Card(
                colors = CardDefaults.cardColors(containerColor = Panel),
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            "$selectedVibe Playlist",
                            color = Color.White,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp
                        )
                        Text(
                            "${currentVibeTracks.size} Tracks",
                            color = SoftText,
                            fontSize = 12.sp
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    currentVibeTracks.forEach { track ->
                        TrackListItem(
                            track = track,
                            isPlaying = playbackState.currentTrack?.id == track.id && playbackState.isPlaying,
                            isFavorite = favorites.contains(track.id),
                            isDownloaded = downloads.contains(track.id),
                            onPlay = { playbackManager.playTrack(track, currentVibeTracks) },
                            onToggleFavorite = { MusicApplication.instance.toggleFavorite(track.id) },
                            onToggleDownload = { MusicApplication.instance.toggleDownload(track.id) }
                        )
                    }
                }
            }

            Spacer(Modifier.height(30.dp))
        }
    }

    // Full Now Playing Sheet
    if (showNowPlayingSheet && playbackState.currentTrack != null) {
        NowPlayingSheet(
            state = playbackState,
            isFavorite = favorites.contains(playbackState.currentTrack?.id.orEmpty()),
            onDismiss = { showNowPlayingSheet = false },
            onTogglePlay = playbackManager::togglePlayPause,
            onSeek = playbackManager::seekTo,
            onNext = playbackManager::next,
            onPrev = playbackManager::prev,
            onToggleShuffle = playbackManager::toggleShuffle,
            onToggleRepeat = playbackManager::toggleRepeat,
            onOpenSleepTimer = { showSleepTimerDialog = true },
            onToggleFavorite = {
                playbackState.currentTrack?.id?.let { MusicApplication.instance.toggleFavorite(it) }
            }
        )
    }

    // Sleep Timer Dialog
    if (showSleepTimerDialog) {
        SleepTimerDialog(
            currentMinutes = playbackState.sleepTimerMinutesRemaining,
            onDismiss = { showSleepTimerDialog = false },
            onSetTimer = { mins ->
                playbackManager.setSleepTimer(mins)
                showSleepTimerDialog = false
            }
        )
    }
}

@Composable
private fun FmLogoBadge(size: Int) {
    Surface(
        modifier = Modifier.size(size.dp),
        shape = CircleShape,
        color = Accent
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text("FM", color = Ink, fontWeight = FontWeight.Black, fontSize = 14.sp)
        }
    }
}

@Composable
private fun TrackListItem(
    track: MusicTrack,
    isPlaying: Boolean,
    isFavorite: Boolean,
    isDownloaded: Boolean,
    onPlay: () -> Unit,
    onToggleFavorite: () -> Unit,
    onToggleDownload: () -> Unit
) {
    Surface(
        color = Color.Transparent,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onPlay)
            .padding(vertical = 4.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 6.dp, horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                modifier = Modifier.size(46.dp),
                shape = RoundedCornerShape(10.dp),
                color = PanelSecondary
            ) {
                Box(contentAlignment = Alignment.Center) {
                    if (isPlaying) {
                        AnimatedVisualizerBars(isPlaying = true)
                    } else {
                        Text(
                            track.title.take(2).uppercase(),
                            color = Accent,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                    }
                }
            }

            Spacer(Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    track.title,
                    color = if (isPlaying) Accent else Color.White,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    track.artist,
                    color = SoftText,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(Modifier.width(8.dp))

            Text(
                track.durationFormatted,
                color = SoftText,
                fontSize = 12.sp
            )

            Spacer(Modifier.width(10.dp))

            Surface(
                modifier = Modifier
                    .size(32.dp)
                    .clickable(onClick = onToggleFavorite),
                shape = CircleShape,
                color = if (isFavorite) Accent else PanelSecondary
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        if (isFavorite) "★" else "☆",
                        color = if (isFavorite) Ink else SoftText,
                        fontSize = 14.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun MiniPlayerBar(
    state: PlaybackUiState,
    onTogglePlay: () -> Unit,
    onNext: () -> Unit,
    onPrev: () -> Unit,
    onExpand: () -> Unit
) {
    Surface(
        color = Panel,
        shadowElevation = 16.dp,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onExpand)
    ) {
        Column {
            // Live Scrubber Progress line
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(3.dp)
                    .background(PanelSecondary)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(state.progressFraction)
                        .height(3.dp)
                        .background(Accent)
                )
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .windowInsetsPadding(WindowInsets.navigationBars)
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                AnimatedVisualizerBars(isPlaying = state.isPlaying)

                Spacer(Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        state.currentTrack?.title ?: "FM Music Player",
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        state.currentTrack?.artist ?: "In-App Audio Stream",
                        color = SoftText,
                        fontSize = 11.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(Modifier.width(8.dp))

                Button(
                    onClick = onPrev,
                    colors = ButtonDefaults.buttonColors(containerColor = PanelSecondary),
                    shape = CircleShape,
                    modifier = Modifier.size(36.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)
                ) {
                    Text("⏮", color = Color.White, fontSize = 12.sp)
                }

                Spacer(Modifier.width(6.dp))

                Button(
                    onClick = onTogglePlay,
                    colors = ButtonDefaults.buttonColors(containerColor = Accent),
                    shape = CircleShape,
                    modifier = Modifier.size(40.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)
                ) {
                    Text(if (state.isPlaying) "⏸" else "▶", color = Ink, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }

                Spacer(Modifier.width(6.dp))

                Button(
                    onClick = onNext,
                    colors = ButtonDefaults.buttonColors(containerColor = PanelSecondary),
                    shape = CircleShape,
                    modifier = Modifier.size(36.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)
                ) {
                    Text("⏭", color = Color.White, fontSize = 12.sp)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NowPlayingSheet(
    state: PlaybackUiState,
    isFavorite: Boolean,
    onDismiss: () -> Unit,
    onTogglePlay: () -> Unit,
    onSeek: (Long) -> Unit,
    onNext: () -> Unit,
    onPrev: () -> Unit,
    onToggleShuffle: () -> Unit,
    onToggleRepeat: () -> Unit,
    onOpenSleepTimer: () -> Unit,
    onToggleFavorite: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var selectedTab by remember { mutableStateOf(0) }
    val tabTitles = listOf("Track", "Lyrics", "Queue")

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Ink,
        dragHandle = {
            Surface(
                modifier = Modifier
                    .padding(vertical = 12.dp)
                    .size(width = 36.dp, height = 4.dp),
                shape = CircleShape,
                color = SoftText.copy(alpha = 0.4f)
            ) {}
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header Tab row
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = Color.Transparent,
                contentColor = Accent,
                indicator = { tabPositions ->
                    TabRowDefaults.SecondaryIndicator(
                        Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                        color = Accent
                    )
                }
            ) {
                tabTitles.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        text = {
                            Text(
                                title,
                                color = if (selectedTab == index) Accent else SoftText,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                        }
                    )
                }
            }

            Spacer(Modifier.height(20.dp))

            when (selectedTab) {
                0 -> {
                    // Track Art and Visualizer
                    Surface(
                        modifier = Modifier
                            .size(240.dp)
                            .clip(RoundedCornerShape(24.dp)),
                        color = Panel
                    ) {
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.Center,
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            FmLogoBadge(size = 64)
                            Spacer(Modifier.height(16.dp))
                            AnimatedVisualizerBars(isPlaying = state.isPlaying, heightDp = 30)
                        }
                    }

                    Spacer(Modifier.height(24.dp))

                    // Title & Artist with Favorite
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                state.currentTrack?.title.orEmpty(),
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 20.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                state.currentTrack?.artist.orEmpty(),
                                color = SoftText,
                                fontSize = 14.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        Button(
                            onClick = onToggleFavorite,
                            colors = ButtonDefaults.buttonColors(containerColor = if (isFavorite) Accent else PanelSecondary),
                            shape = CircleShape,
                            modifier = Modifier.size(42.dp),
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)
                        ) {
                            Text(if (isFavorite) "★" else "☆", color = if (isFavorite) Ink else Color.White, fontSize = 16.sp)
                        }
                    }

                    Spacer(Modifier.height(18.dp))

                    // Scrubber Timeline Slider
                    var sliderPos by remember(state.currentPositionMs) {
                        mutableFloatStateOf(state.currentPositionMs.toFloat())
                    }

                    Slider(
                        value = sliderPos,
                        onValueChange = { sliderPos = it },
                        onValueChangeFinished = { onSeek(sliderPos.toLong()) },
                        valueRange = 0f..(state.durationMs.coerceAtLeast(1L).toFloat()),
                        colors = SliderDefaults.colors(
                            thumbColor = Accent,
                            activeTrackColor = Accent,
                            inactiveTrackColor = PanelSecondary
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(formatDuration(state.currentPositionMs), color = SoftText, fontSize = 12.sp)
                        Text(formatDuration(state.durationMs), color = SoftText, fontSize = 12.sp)
                    }

                    Spacer(Modifier.height(18.dp))

                    // Main Controls Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Shuffle
                        TextButton(onClick = onToggleShuffle) {
                            Text(if (state.isShuffled) "🔀 ON" else "🔀", color = if (state.isShuffled) Accent else SoftText)
                        }

                        // Prev
                        Button(
                            onClick = onPrev,
                            colors = ButtonDefaults.buttonColors(containerColor = PanelSecondary),
                            shape = CircleShape,
                            modifier = Modifier.size(50.dp)
                        ) {
                            Text("⏮", color = Color.White, fontSize = 16.sp)
                        }

                        // Play/Pause
                        Button(
                            onClick = onTogglePlay,
                            colors = ButtonDefaults.buttonColors(containerColor = Accent),
                            shape = CircleShape,
                            modifier = Modifier.size(68.dp)
                        ) {
                            Text(if (state.isPlaying) "⏸" else "▶", color = Ink, fontWeight = FontWeight.Bold, fontSize = 24.sp)
                        }

                        // Next
                        Button(
                            onClick = onNext,
                            colors = ButtonDefaults.buttonColors(containerColor = PanelSecondary),
                            shape = CircleShape,
                            modifier = Modifier.size(50.dp)
                        ) {
                            Text("⏭", color = Color.White, fontSize = 16.sp)
                        }

                        // Repeat
                        TextButton(onClick = onToggleRepeat) {
                            Text(
                                when (state.repeatMode) {
                                    RepeatMode.OFF -> "🔁"
                                    RepeatMode.ALL -> "🔁 ALL"
                                    RepeatMode.ONE -> "🔂 ONE"
                                },
                                color = if (state.repeatMode != RepeatMode.OFF) Accent else SoftText
                            )
                        }
                    }

                    Spacer(Modifier.height(10.dp))

                    // Sleep Timer row button
                    TextButton(onClick = onOpenSleepTimer) {
                        Text(
                            if (state.sleepTimerMinutesRemaining != null)
                                "⏳ Sleep Timer: ${state.sleepTimerMinutesRemaining}m left"
                            else
                                "⏳ Set Sleep Timer",
                            color = Accent,
                            fontSize = 12.sp
                        )
                    }
                }

                1 -> {
                    // Synchronized Lyrics View
                    val lyrics = state.currentTrack?.lyrics ?: emptyList()
                    if (lyrics.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(300.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("No lyrics available for this track.", color = SoftText, fontSize = 14.sp)
                        }
                    } else {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(320.dp)
                                .verticalScroll(rememberScrollState()),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            lyrics.forEachIndexed { idx, line ->
                                Text(
                                    line,
                                    color = if (idx == 0 && state.isPlaying) Accent else Color.White,
                                    fontSize = 16.sp,
                                    fontWeight = if (idx == 0 && state.isPlaying) FontWeight.Bold else FontWeight.Normal,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.padding(vertical = 8.dp)
                                )
                            }
                        }
                    }
                }

                2 -> {
                    // Queue list
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(320.dp)
                            .verticalScroll(rememberScrollState())
                    ) {
                        Text(
                            "UP NEXT (${state.queue.size} TRACKS)",
                            color = SoftText,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )
                        state.queue.forEachIndexed { index, track ->
                            val isThis = index == state.queueIndex
                            Surface(
                                color = if (isThis) PanelSecondary else Color.Transparent,
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 3.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(10.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("${index + 1}", color = SoftText, fontSize = 12.sp, modifier = Modifier.width(24.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(track.title, color = if (isThis) Accent else Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                        Text(track.artist, color = SoftText, fontSize = 11.sp)
                                    }
                                    Text(track.durationFormatted, color = SoftText, fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AnimatedVisualizerBars(isPlaying: Boolean, heightDp: Int = 18) {
    val infiniteTransition = rememberInfiniteTransition(label = "visualizer")

    val h1 by infiniteTransition.animateFloat(
        initialValue = 0.2f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(450, easing = LinearEasing),
            repeatMode = AnimRepeatMode.Reverse
        ),
        label = "bar1"
    )

    val h2 by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 0.85f,
        animationSpec = infiniteRepeatable(
            animation = tween(600, easing = LinearEasing),
            repeatMode = AnimRepeatMode.Reverse
        ),
        label = "bar2"
    )

    val h3 by infiniteTransition.animateFloat(
        initialValue = 0.15f,
        targetValue = 0.95f,
        animationSpec = infiniteRepeatable(
            animation = tween(350, easing = LinearEasing),
            repeatMode = AnimRepeatMode.Reverse
        ),
        label = "bar3"
    )

    val h4 by infiniteTransition.animateFloat(
        initialValue = 0.4f,
        targetValue = 0.8f,
        animationSpec = infiniteRepeatable(
            animation = tween(500, easing = LinearEasing),
            repeatMode = AnimRepeatMode.Reverse
        ),
        label = "bar4"
    )

    Row(
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        modifier = Modifier.height(heightDp.dp)
    ) {
        val fractions = listOf(h1, h2, h3, h4)
        fractions.forEach { frac ->
            val scale = if (isPlaying) frac else 0.2f
            Box(
                modifier = Modifier
                    .width(3.dp)
                    .height((heightDp * scale).dp)
                    .background(Accent, RoundedCornerShape(2.dp))
            )
        }
    }
}

@Composable
private fun SleepTimerDialog(
    currentMinutes: Int?,
    onDismiss: () -> Unit,
    onSetTimer: (Int?) -> Unit
) {
    val options = listOf(15, 30, 45, 60)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Sleep Timer", color = Color.White) },
        text = {
            Column {
                Text("Stop playback automatically after:", color = SoftText, fontSize = 14.sp)
                Spacer(Modifier.height(12.dp))
                options.forEach { mins ->
                    TextButton(
                        onClick = { onSetTimer(mins) },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            "$mins Minutes" + if (currentMinutes == mins) " (Active)" else "",
                            color = if (currentMinutes == mins) Accent else Color.White,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
                if (currentMinutes != null) {
                    TextButton(
                        onClick = { onSetTimer(null) },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Turn Off Timer", color = Color.Red)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = SoftText)
            }
        },
        containerColor = Panel
    )
}
