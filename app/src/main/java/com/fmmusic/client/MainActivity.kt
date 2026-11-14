package com.fmmusic.client

import android.graphics.BitmapFactory
import android.os.Bundle
import android.util.LruCache
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode as AnimRepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.defaultMinSize
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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fmmusic.client.data.MusicCatalogData
import com.fmmusic.client.model.MusicTrack
import com.fmmusic.client.model.PlaybackUiState
import com.fmmusic.client.model.RepeatMode
import com.fmmusic.client.playback.ExoPlaybackManager
import com.fmmusic.client.update.AppUpdateUiState
import com.fmmusic.client.update.ReleaseUpdateInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
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

enum class MainSectionMode {
    ONLINE, OFFLINE
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MusicAppRoot(playbackManager: ExoPlaybackManager) {
    val playbackState by playbackManager.state.collectAsState()
    val favorites by MusicApplication.instance.favorites.collectAsState()
    val downloads by MusicApplication.instance.downloads.collectAsState()
    val downloading by MusicApplication.instance.downloading.collectAsState()
    val visitorSession by MusicApplication.instance.innerTubeService.sessionState.collectAsState()
    val updateManager = MusicApplication.instance.updateManager
    val updateState by updateManager.state.collectAsState()
    val focusManager = LocalFocusManager.current

    var sectionMode by remember { mutableStateOf(MainSectionMode.ONLINE) }
    var searchFilterMode by remember { mutableStateOf("ALL") }
    var offlineSearchQuery by remember { mutableStateOf("") }

    val downloadedTracks = remember(downloads) {
        downloads.map { id ->
            MusicCatalogData.getTrackById(id).copy(isDownloaded = true)
        }
    }

    var searchQuery by remember { mutableStateOf("") }
    var selectedVibe by remember { mutableStateOf("Hindi hits") }
    var showNowPlayingSheet by remember { mutableStateOf(false) }
    var showSleepTimerDialog by remember { mutableStateOf(false) }
    var showUpdateSettingsDialog by remember { mutableStateOf(false) }

    val (greetingText, greetingTag) = remember { getTimeBasedGreeting() }

    var searchResults by remember { mutableStateOf<List<MusicTrack>>(emptyList()) }
    var isSearching by remember { mutableStateOf(false) }

    LaunchedEffect(searchQuery) {
        val trimmed = searchQuery.trim()
        if (trimmed.isNotBlank()) {
            isSearching = true
            searchResults = MusicCatalogData.search(trimmed)
            delay(350)
            try {
                val remoteResults = MusicApplication.instance.innerTubeService.searchTracks(trimmed)
                if (remoteResults.isNotEmpty()) {
                    searchResults = remoteResults
                }
            } catch (_: Exception) {}
            isSearching = false
        } else {
            searchResults = emptyList()
            isSearching = false
        }
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
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    FmLogoBadge(size = 38)
                    Spacer(Modifier.width(10.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "FM MUSIC",
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.5.sp,
                                fontSize = 15.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Spacer(Modifier.width(5.dp))
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .background(Accent, CircleShape)
                            )
                        }
                        Text(
                            "IN-APP STREAMING",
                            color = SoftText,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 0.8.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
                Spacer(Modifier.width(8.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Surface(
                        color = Panel,
                        shape = RoundedCornerShape(12.dp),
                        border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderDark))
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .background(if (visitorSession.isPublicBrowsingActive) Accent else Color.Yellow, CircleShape)
                            )
                            Spacer(Modifier.width(5.dp))
                            Text(
                                "InnerTube",
                                color = if (visitorSession.isPublicBrowsingActive) Accent else SoftText,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Surface(
                        color = if (updateState.availableUpdate != null) Accent else Panel,
                        shape = RoundedCornerShape(12.dp),
                        border = if (updateState.availableUpdate == null) {
                            CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderDark))
                        } else null,
                        modifier = Modifier.clickable {
                            if (updateState.availableUpdate != null) {
                                updateManager.openPromptIfAvailable()
                            } else {
                                showUpdateSettingsDialog = true
                            }
                        }
                    ) {
                        Text(
                            if (updateState.availableUpdate != null) {
                                "UPDATE v${updateState.availableUpdate?.versionName}"
                            } else {
                                "v${updateState.currentVersionName}"
                            },
                            color = if (updateState.availableUpdate != null) Ink else Accent,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                        )
                    }
                }
            }

            Spacer(Modifier.height(18.dp))

            // Main Section Mode Switcher (Online vs. Offline)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Panel, RoundedCornerShape(14.dp))
                    .padding(4.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Surface(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { sectionMode = MainSectionMode.ONLINE },
                    color = if (sectionMode == MainSectionMode.ONLINE) Accent else Color.Transparent,
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Box(
                        modifier = Modifier.padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            "🌐 Online Discovery",
                            color = if (sectionMode == MainSectionMode.ONLINE) Ink else SoftText,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    }
                }

                Surface(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { sectionMode = MainSectionMode.OFFLINE },
                    color = if (sectionMode == MainSectionMode.OFFLINE) Accent else Color.Transparent,
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Box(
                        modifier = Modifier.padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            "💾 Offline (${downloadedTracks.size})",
                            color = if (sectionMode == MainSectionMode.OFFLINE) Ink else SoftText,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    }
                }
            }

            if (sectionMode == MainSectionMode.ONLINE) {
                Spacer(Modifier.height(24.dp))

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
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { focusManager.clearFocus() }),
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

                    val downloadedSearchCount = searchResults.count { downloads.contains(it.id) }
                    val displayResults = if (searchFilterMode == "DOWNLOADED") {
                        searchResults.filter { downloads.contains(it.id) }
                    } else {
                        searchResults
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "SEARCH RESULTS (${displayResults.size})",
                                color = SoftText,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                            if (isSearching) {
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    "• Searching...",
                                    color = Accent,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Normal
                                )
                            }
                        }
                        Text(
                            "Clear",
                            color = Accent,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.clickable { searchQuery = "" }
                        )
                    }

                    Spacer(Modifier.height(8.dp))

                    // Filter toggles for search (Online vs Downloaded)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Surface(
                            modifier = Modifier.clickable { searchFilterMode = "ALL" },
                            color = if (searchFilterMode == "ALL") Accent else Panel,
                            shape = RoundedCornerShape(8.dp),
                            border = if (searchFilterMode != "ALL") CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderDark)) else null
                        ) {
                            Text(
                                "All Results (${searchResults.size})",
                                color = if (searchFilterMode == "ALL") Ink else SoftText,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                            )
                        }

                        Surface(
                            modifier = Modifier.clickable { searchFilterMode = "DOWNLOADED" },
                            color = if (searchFilterMode == "DOWNLOADED") Accent else Panel,
                            shape = RoundedCornerShape(8.dp),
                            border = if (searchFilterMode != "DOWNLOADED") CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderDark)) else null
                        ) {
                            Text(
                                "Downloaded ($downloadedSearchCount)",
                                color = if (searchFilterMode == "DOWNLOADED") Ink else SoftText,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                            )
                        }
                    }

                    Spacer(Modifier.height(10.dp))
                    displayResults.forEach { track ->
                        TrackListItem(
                            track = track,
                            isPlaying = playbackState.currentTrack?.id == track.id && playbackState.isPlaying,
                            isFavorite = favorites.contains(track.id),
                            isDownloaded = downloads.contains(track.id),
                            isDownloading = downloading.contains(track.id),
                            onPlay = { playbackManager.playTrack(track, displayResults) },
                            onToggleFavorite = { MusicApplication.instance.toggleFavorite(track.id) },
                            onToggleDownload = { MusicApplication.instance.toggleDownload(track) }
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
                                isDownloading = downloading.contains(track.id),
                                onPlay = { playbackManager.playTrack(track, currentVibeTracks) },
                                onToggleFavorite = { MusicApplication.instance.toggleFavorite(track.id) },
                                onToggleDownload = { MusicApplication.instance.toggleDownload(track) }
                            )
                        }
                    }
                }
            } else {
                // OFFLINE SECTION
                OfflineCollectionSection(
                    downloadedTracks = downloadedTracks,
                    searchQuery = offlineSearchQuery,
                    onSearchQueryChange = { offlineSearchQuery = it },
                    isPlayingTrack = { trackId -> playbackState.currentTrack?.id == trackId && playbackState.isPlaying },
                    isFavorite = { trackId -> favorites.contains(trackId) },
                    onPlay = { track -> playbackManager.playTrack(track, downloadedTracks) },
                    onPlayAll = {
                        if (downloadedTracks.isNotEmpty()) {
                            playbackManager.playTrack(downloadedTracks.first(), downloadedTracks)
                        }
                    },
                    onToggleFavorite = { trackId -> MusicApplication.instance.toggleFavorite(trackId) },
                    onDeleteDownload = { track -> MusicApplication.instance.toggleDownload(track) },
                    onSwitchToOnline = { sectionMode = MainSectionMode.ONLINE }
                )
            }

            Spacer(Modifier.height(30.dp))
        }
    }

    // Full Now Playing Sheet
    if (showNowPlayingSheet && playbackState.currentTrack != null) {
        val curTrack = playbackState.currentTrack!!
        NowPlayingSheet(
            state = playbackState,
            isFavorite = favorites.contains(curTrack.id),
            isDownloaded = downloads.contains(curTrack.id),
            isDownloading = downloading.contains(curTrack.id),
            onDismiss = { showNowPlayingSheet = false },
            onTogglePlay = playbackManager::togglePlayPause,
            onSeek = playbackManager::seekTo,
            onNext = playbackManager::next,
            onPrev = playbackManager::prev,
            onToggleShuffle = playbackManager::toggleShuffle,
            onToggleRepeat = playbackManager::toggleRepeat,
            onOpenSleepTimer = { showSleepTimerDialog = true },
            onToggleFavorite = { MusicApplication.instance.toggleFavorite(curTrack.id) },
            onToggleDownload = { MusicApplication.instance.toggleDownload(curTrack) },
            onPlayQueueTrack = playbackManager::playFromQueue,
            onRetryTrack = playbackManager::retryCurrentTrack
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

    // Automatic In-App "New Update Available" Prompt for Older APK Versions
    val pendingRelease = updateState.availableUpdate
    if (updateState.showPromptDialog && pendingRelease != null) {
        NewUpdateAvailableDialog(
            state = updateState,
            release = pendingRelease,
            onUpdateNow = { updateManager.downloadAndInstallUpdate(pendingRelease) },
            onDownloadInBrowser = { updateManager.openInBrowser(pendingRelease.apkDownloadUrl) },
            onSkipVersion = { updateManager.skipUpdateVersion(pendingRelease.tagName) },
            onLater = { updateManager.dismissPrompt() }
        )
    }

    // App Version & GitHub Releases Update Checker Dialog
    if (showUpdateSettingsDialog) {
        AppUpdateSettingsDialog(
            state = updateState,
            onSaveRepo = { updateManager.setGithubRepo(it) },
            onCheckNow = { updateManager.checkForUpdates(forceManual = true) },
            onOpenAvailableUpdate = {
                showUpdateSettingsDialog = false
                updateManager.openPromptIfAvailable()
            },
            onOpenPackagesPage = {
                val repo = updateState.githubRepo.trim()
                if (repo.isNotBlank()) {
                    updateManager.openInBrowser("https://github.com/$repo?tab=packages")
                }
            },
            onDismiss = {
                updateManager.clearStatusMessages()
                showUpdateSettingsDialog = false
            }
        )
    }
}

@Composable
private fun OfflineCollectionSection(
    downloadedTracks: List<MusicTrack>,
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    isPlayingTrack: (String) -> Boolean,
    isFavorite: (String) -> Boolean,
    onPlay: (MusicTrack) -> Unit,
    onPlayAll: () -> Unit,
    onToggleFavorite: (String) -> Unit,
    onDeleteDownload: (MusicTrack) -> Unit,
    onSwitchToOnline: () -> Unit
) {
    val filtered = remember(downloadedTracks, searchQuery) {
        if (searchQuery.isBlank()) downloadedTracks else {
            val q = searchQuery.trim().lowercase()
            downloadedTracks.filter { it.title.lowercase().contains(q) || it.artist.lowercase().contains(q) }
        }
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        Spacer(Modifier.height(24.dp))

        // Offline Header Banner
        Card(
            colors = CardDefaults.cardColors(containerColor = Panel),
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(18.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            "Offline Storage",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 20.sp
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(
                            "${downloadedTracks.size} Songs Saved • Zero Data",
                            color = SoftText,
                            fontSize = 12.sp
                        )
                    }

                    if (downloadedTracks.isNotEmpty()) {
                        Button(
                            onClick = onPlayAll,
                            colors = ButtonDefaults.buttonColors(containerColor = Accent),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("▶ Play All", color = Ink, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(18.dp))

        if (downloadedTracks.isNotEmpty()) {
            val offlineFocusManager = LocalFocusManager.current
            OutlinedTextField(
                value = searchQuery,
                onValueChange = onSearchQueryChange,
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Search your downloaded songs", color = Color(0xFF6B6B7A)) },
                shape = RoundedCornerShape(14.dp),
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { offlineFocusManager.clearFocus() }),
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

            Spacer(Modifier.height(16.dp))

            Card(
                colors = CardDefaults.cardColors(containerColor = Panel),
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(Modifier.padding(14.dp)) {
                    Text(
                        "Downloaded Tracks (${filtered.size})",
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp
                    )
                    Spacer(Modifier.height(8.dp))
                    filtered.forEach { track ->
                        TrackListItem(
                            track = track,
                            isPlaying = isPlayingTrack(track.id),
                            isFavorite = isFavorite(track.id),
                            isDownloaded = true,
                            isDownloading = false,
                            onPlay = { onPlay(track) },
                            onToggleFavorite = { onToggleFavorite(track.id) },
                            onToggleDownload = { onDeleteDownload(track) }
                        )
                    }
                }
            }
        } else {
            // Empty State
            Card(
                colors = CardDefaults.cardColors(containerColor = Panel),
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Surface(
                        modifier = Modifier.size(60.dp),
                        shape = CircleShape,
                        color = PanelSecondary
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text("💾", fontSize = 26.sp)
                        }
                    }
                    Spacer(Modifier.height(14.dp))
                    Text(
                        "No Offline Songs Stored",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "Tap the ↓ download button next to any track in Online Discovery to save it to your local device storage.",
                        color = SoftText,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(20.dp))
                    Button(
                        onClick = onSwitchToOnline,
                        colors = ButtonDefaults.buttonColors(containerColor = Accent),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Explore Online Catalog", color = Ink, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

private object ArtworkBitmapCache {
    private val cache = LruCache<String, ImageBitmap>(60)

    fun get(url: String): ImageBitmap? {
        if (url.isBlank()) return null
        return synchronized(cache) { cache.get(url) }
    }

    fun put(url: String, bitmap: ImageBitmap) {
        if (url.isBlank()) return
        synchronized(cache) { cache.put(url, bitmap) }
    }
}

private suspend fun loadImageBitmapFromUrl(urlString: String): ImageBitmap? = withContext(Dispatchers.IO) {
    if (!urlString.startsWith("https://") && !urlString.startsWith("http://")) {
        return@withContext null
    }
    var connection: HttpURLConnection? = null
    try {
        connection = (URL(urlString).openConnection() as HttpURLConnection).apply {
            connectTimeout = 8000
            readTimeout = 8000
            instanceFollowRedirects = true
            setRequestProperty(
                "User-Agent",
                "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
            )
        }
        connection.connect()
        if (connection.responseCode in 200..299) {
            val bytes = connection.inputStream.use { it.readBytes() }
            val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            return@withContext decoded?.asImageBitmap()
        }
    } catch (_: Exception) {
        // Fallback handled by caller
    } finally {
        try {
            connection?.disconnect()
        } catch (_: Exception) {}
    }
    null
}

@Composable
private fun TrackArtworkImage(
    track: MusicTrack?,
    modifier: Modifier = Modifier,
    showPlayingVisualizer: Boolean = false,
    cornerRadiusDp: Int = 10,
    placeholderTextSizeSp: Int = 14
) {
    val primaryUrl = track?.resolvedThumbnailUrl.orEmpty()
    val fallbackUrl = remember(track?.youtubeId, track?.id) {
        val vid = track?.youtubeId?.ifBlank { track.id }.orEmpty().trim()
        if (vid.isNotBlank() && !vid.contains("-") && !vid.startsWith("dyn")) {
            "https://i.ytimg.com/vi/$vid/hqdefault.jpg"
        } else {
            ""
        }
    }

    var bitmap by remember(primaryUrl, fallbackUrl) {
        mutableStateOf(
            ArtworkBitmapCache.get(primaryUrl) ?: ArtworkBitmapCache.get(fallbackUrl)
        )
    }

    LaunchedEffect(primaryUrl, fallbackUrl) {
        if (bitmap == null) {
            val loadedPrimary = if (primaryUrl.isNotBlank()) {
                loadImageBitmapFromUrl(primaryUrl)?.also { ArtworkBitmapCache.put(primaryUrl, it) }
            } else null

            val resolved = loadedPrimary ?: if (fallbackUrl.isNotBlank() && fallbackUrl != primaryUrl) {
                loadImageBitmapFromUrl(fallbackUrl)?.also { ArtworkBitmapCache.put(fallbackUrl, it) }
            } else null

            if (resolved != null) {
                bitmap = resolved
            }
        }
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(cornerRadiusDp.dp))
            .background(PanelSecondary),
        contentAlignment = Alignment.Center
    ) {
        val currentBitmap = bitmap
        if (currentBitmap != null) {
            Image(
                bitmap = currentBitmap,
                contentDescription = track?.title ?: "Album Artwork",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
            if (showPlayingVisualizer) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Ink.copy(alpha = 0.48f)),
                    contentAlignment = Alignment.Center
                ) {
                    AnimatedVisualizerBars(isPlaying = true)
                }
            }
        } else if (showPlayingVisualizer) {
            AnimatedVisualizerBars(isPlaying = true)
        } else {
            Text(
                text = track?.title?.take(2)?.uppercase()?.ifBlank { "FM" } ?: "FM",
                color = Accent,
                fontWeight = FontWeight.Bold,
                fontSize = placeholderTextSizeSp.sp
            )
        }
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
    isDownloading: Boolean = false,
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
            TrackArtworkImage(
                track = track,
                modifier = Modifier.size(46.dp),
                showPlayingVisualizer = isPlaying,
                cornerRadiusDp = 10
            )

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

            Spacer(Modifier.width(8.dp))

            // Download Button
            Surface(
                modifier = Modifier
                    .size(40.dp)
                    .clickable(onClick = onToggleDownload),
                shape = CircleShape,
                color = when {
                    isDownloaded -> Accent
                    isDownloading -> Color(0xFF383848)
                    else -> PanelSecondary
                }
            ) {
                Box(contentAlignment = Alignment.Center) {
                    when {
                        isDownloading -> {
                            Text(
                                "⋯",
                                color = Accent,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Black
                            )
                        }
                        isDownloaded -> {
                            Text(
                                "✓",
                                color = Ink,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        else -> {
                            Text(
                                "↓",
                                color = SoftText,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.width(8.dp))

            // Favorite Button
            Surface(
                modifier = Modifier
                    .size(40.dp)
                    .clickable(onClick = onToggleFavorite),
                shape = CircleShape,
                color = if (isFavorite) Accent else PanelSecondary
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        if (isFavorite) "★" else "☆",
                        color = if (isFavorite) Ink else SoftText,
                        fontSize = 15.sp
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
            if (state.isBuffering) {
                LinearProgressIndicator(
                    color = Accent,
                    trackColor = PanelSecondary,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(3.dp)
                )
            } else {
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
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .windowInsetsPadding(WindowInsets.navigationBars)
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TrackArtworkImage(
                    track = state.currentTrack,
                    modifier = Modifier.size(42.dp),
                    showPlayingVisualizer = state.isPlaying,
                    cornerRadiusDp = 10
                )

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
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            state.currentTrack?.artist ?: "In-App Audio Stream",
                            color = SoftText,
                            fontSize = 11.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f, fill = false)
                        )
                        val statusText = when {
                            !state.errorMessage.isNullOrBlank() -> "• Tap to Retry"
                            state.isBuffering -> "• Buffering..."
                            !state.streamSource.isNullOrBlank() -> "• ${state.streamSource}"
                            else -> null
                        }
                        if (!statusText.isNullOrBlank()) {
                            Spacer(Modifier.width(6.dp))
                            Text(
                                statusText,
                                color = if (!state.errorMessage.isNullOrBlank()) Color(0xFFFF7A7A) else Accent,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Medium,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
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
                    if (state.isBuffering && !state.isPlaying) {
                        CircularProgressIndicator(
                            color = Ink,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(18.dp)
                        )
                    } else {
                        Text(if (state.isPlaying) "⏸" else "▶", color = Ink, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
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
    isDownloaded: Boolean,
    isDownloading: Boolean = false,
    onDismiss: () -> Unit,
    onTogglePlay: () -> Unit,
    onSeek: (Long) -> Unit,
    onNext: () -> Unit,
    onPrev: () -> Unit,
    onToggleShuffle: () -> Unit,
    onToggleRepeat: () -> Unit,
    onOpenSleepTimer: () -> Unit,
    onToggleFavorite: () -> Unit,
    onToggleDownload: () -> Unit,
    onPlayQueueTrack: (Int) -> Unit,
    onRetryTrack: () -> Unit
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
                .padding(bottom = 28.dp)
                .verticalScroll(rememberScrollState()),
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

            Spacer(Modifier.height(18.dp))

            when (selectedTab) {
                0 -> {
                    // Track Album Art + Live Playback Overlay
                    Box(
                        modifier = Modifier
                            .size(220.dp)
                            .clip(RoundedCornerShape(24.dp))
                            .background(Panel),
                        contentAlignment = Alignment.Center
                    ) {
                        TrackArtworkImage(
                            track = state.currentTrack,
                            modifier = Modifier.fillMaxSize(),
                            showPlayingVisualizer = false,
                            cornerRadiusDp = 24,
                            placeholderTextSizeSp = 36
                        )

                        if (state.isBuffering || state.isPlaying) {
                            Surface(
                                color = Ink.copy(alpha = 0.78f),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier
                                    .align(Alignment.BottomEnd)
                                    .padding(10.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    if (state.isBuffering) {
                                        CircularProgressIndicator(
                                            color = Accent,
                                            strokeWidth = 2.dp,
                                            modifier = Modifier.size(14.dp)
                                        )
                                        Spacer(Modifier.width(6.dp))
                                        Text(
                                            "Buffering",
                                            color = Accent,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    } else {
                                        AnimatedVisualizerBars(isPlaying = true, heightDp = 16)
                                    }
                                }
                            }
                        }
                    }

                    Spacer(Modifier.height(20.dp))

                    // Title & Artist with Download + Favorite
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

                        Spacer(Modifier.width(8.dp))

                        // Download button
                        Button(
                            onClick = onToggleDownload,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (isDownloaded) Accent else PanelSecondary
                            ),
                            shape = CircleShape,
                            modifier = Modifier.size(42.dp),
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)
                        ) {
                            Text(
                                if (isDownloading) "⋯" else if (isDownloaded) "✓" else "↓",
                                color = if (isDownloaded) Ink else Color.White,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Spacer(Modifier.width(8.dp))

                        // Favorite button
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

                    Spacer(Modifier.height(12.dp))

                    // Stream Source Badge or Playback Error Retry Card
                    if (!state.errorMessage.isNullOrBlank()) {
                        Surface(
                            color = Color(0xFF2D191E),
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, Color(0xFFFF7A7A).copy(alpha = 0.5f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    state.errorMessage,
                                    color = Color(0xFFFFB4B4),
                                    fontSize = 12.sp,
                                    modifier = Modifier.weight(1f),
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Spacer(Modifier.width(10.dp))
                                Button(
                                    onClick = onRetryTrack,
                                    colors = ButtonDefaults.buttonColors(containerColor = Accent),
                                    shape = RoundedCornerShape(8.dp),
                                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                ) {
                                    Text("Retry", color = Ink, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                }
                            }
                        }
                    } else {
                        Surface(
                            color = PanelSecondary,
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.dp, BorderDark)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .background(Accent, CircleShape)
                                )
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    when {
                                        state.isBuffering -> "Resolving audio stream..."
                                        !state.streamSource.isNullOrBlank() -> "ExoPlayer • ${state.streamSource}"
                                        else -> "ExoPlayer • InnerTube Stream Engine"
                                    },
                                    color = Accent,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(10.dp))

                    // Scrubber Timeline Slider with smooth drag state
                    var isDraggingSlider by remember(state.currentTrack?.id) { mutableStateOf(false) }
                    var dragPositionFloat by remember(state.currentTrack?.id) { mutableFloatStateOf(0f) }
                    val maxDurationFloat = state.durationMs.coerceAtLeast(1L).toFloat()
                    val displayedSliderPos = if (isDraggingSlider) {
                        dragPositionFloat.coerceIn(0f, maxDurationFloat)
                    } else {
                        state.currentPositionMs.toFloat().coerceIn(0f, maxDurationFloat)
                    }

                    Slider(
                        value = displayedSliderPos,
                        onValueChange = {
                            isDraggingSlider = true
                            dragPositionFloat = it
                        },
                        onValueChangeFinished = {
                            onSeek(dragPositionFloat.toLong())
                            isDraggingSlider = false
                        },
                        valueRange = 0f..maxDurationFloat,
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
                        Text(
                            formatDuration(if (isDraggingSlider) dragPositionFloat.toLong() else state.currentPositionMs),
                            color = SoftText,
                            fontSize = 12.sp
                        )
                        Text(formatDuration(state.durationMs), color = SoftText, fontSize = 12.sp)
                    }

                    Spacer(Modifier.height(16.dp))

                    // Primary Transport Controls Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Button(
                            onClick = onPrev,
                            colors = ButtonDefaults.buttonColors(containerColor = PanelSecondary),
                            shape = CircleShape,
                            modifier = Modifier.size(52.dp),
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)
                        ) {
                            Text("⏮", color = Color.White, fontSize = 17.sp)
                        }

                        Spacer(Modifier.width(22.dp))

                        Button(
                            onClick = onTogglePlay,
                            colors = ButtonDefaults.buttonColors(containerColor = Accent),
                            shape = CircleShape,
                            modifier = Modifier.size(68.dp),
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)
                        ) {
                            if (state.isBuffering && !state.isPlaying) {
                                CircularProgressIndicator(
                                    color = Ink,
                                    strokeWidth = 3.dp,
                                    modifier = Modifier.size(26.dp)
                                )
                            } else {
                                Text(
                                    if (state.isPlaying) "⏸" else "▶",
                                    color = Ink,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 24.sp
                                )
                            }
                        }

                        Spacer(Modifier.width(22.dp))

                        Button(
                            onClick = onNext,
                            colors = ButtonDefaults.buttonColors(containerColor = PanelSecondary),
                            shape = CircleShape,
                            modifier = Modifier.size(52.dp),
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)
                        ) {
                            Text("⏭", color = Color.White, fontSize = 17.sp)
                        }
                    }

                    Spacer(Modifier.height(18.dp))

                    // Secondary Playback Modes Row: Shuffle, Repeat, Sleep Timer
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            onClick = onToggleShuffle,
                            color = if (state.isShuffled) Accent else PanelSecondary,
                            shape = RoundedCornerShape(12.dp),
                            border = if (state.isShuffled) null else BorderStroke(1.dp, BorderDark),
                            modifier = Modifier
                                .weight(1f)
                                .defaultMinSize(minHeight = 42.dp)
                        ) {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 10.dp)
                            ) {
                                Text(
                                    text = if (state.isShuffled) "🔀 Shuffle On" else "🔀 Shuffle",
                                    color = if (state.isShuffled) Ink else Color.White,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }

                        val repeatActive = state.repeatMode != RepeatMode.OFF
                        Surface(
                            onClick = onToggleRepeat,
                            color = if (repeatActive) Accent else PanelSecondary,
                            shape = RoundedCornerShape(12.dp),
                            border = if (repeatActive) null else BorderStroke(1.dp, BorderDark),
                            modifier = Modifier
                                .weight(1f)
                                .defaultMinSize(minHeight = 42.dp)
                        ) {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 10.dp)
                            ) {
                                Text(
                                    text = when (state.repeatMode) {
                                        RepeatMode.OFF -> "🔁 Repeat Off"
                                        RepeatMode.ALL -> "🔁 Repeat All"
                                        RepeatMode.ONE -> "🔂 Repeat 1"
                                    },
                                    color = if (repeatActive) Ink else Color.White,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }

                        val timerActive = state.sleepTimerMinutesRemaining != null
                        Surface(
                            onClick = onOpenSleepTimer,
                            color = if (timerActive) Accent else PanelSecondary,
                            shape = RoundedCornerShape(12.dp),
                            border = if (timerActive) null else BorderStroke(1.dp, BorderDark),
                            modifier = Modifier
                                .weight(1f)
                                .defaultMinSize(minHeight = 42.dp)
                        ) {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 10.dp)
                            ) {
                                Text(
                                    text = if (timerActive) "⏳ ${state.sleepTimerMinutesRemaining}m" else "⏳ Timer",
                                    color = if (timerActive) Ink else Color.White,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
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
                    // Interactive Queue list
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(320.dp)
                            .verticalScroll(rememberScrollState())
                    ) {
                        Text(
                            "UP NEXT (${state.queue.size} TRACKS)" + if (state.isShuffled) " • SHUFFLED" else "",
                            color = SoftText,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )
                        state.queue.forEachIndexed { index, track ->
                            val isThis = index == state.queueIndex
                            Surface(
                                onClick = { onPlayQueueTrack(index) },
                                color = if (isThis) PanelSecondary else Color.Transparent,
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 3.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        "${index + 1}",
                                        color = if (isThis) Accent else SoftText,
                                        fontSize = 12.sp,
                                        fontWeight = if (isThis) FontWeight.Bold else FontWeight.Normal,
                                        modifier = Modifier.width(22.dp)
                                    )
                                    TrackArtworkImage(
                                        track = track,
                                        modifier = Modifier.size(38.dp),
                                        showPlayingVisualizer = isThis && state.isPlaying,
                                        cornerRadiusDp = 8,
                                        placeholderTextSizeSp = 11
                                    )
                                    Spacer(Modifier.width(10.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            track.title,
                                            color = if (isThis) Accent else Color.White,
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Text(
                                            track.artist,
                                            color = SoftText,
                                            fontSize = 11.sp,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                    Spacer(Modifier.width(6.dp))
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

@Composable
private fun NewUpdateAvailableDialog(
    state: AppUpdateUiState,
    release: ReleaseUpdateInfo,
    onUpdateNow: () -> Unit,
    onDownloadInBrowser: () -> Unit,
    onSkipVersion: () -> Unit,
    onLater: () -> Unit
) {
    AlertDialog(
        onDismissRequest = { if (!state.isDownloading && !release.isMandatory) onLater() },
        containerColor = Panel,
        title = {
            Column {
                Text(
                    if (release.isMandatory) "Required Update Available" else "New Update Available",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 19.sp
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "v${state.currentVersionName}  →  v${release.versionName}  •  ${release.sizeFormatted}",
                    color = Accent,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                Text(
                    "What's New:",
                    color = Color.White,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    release.releaseNotes,
                    color = SoftText,
                    fontSize = 13.sp,
                    lineHeight = 18.sp
                )

                if (state.isDownloading) {
                    Spacer(Modifier.height(14.dp))
                    val pct = (state.downloadProgress * 100).toInt().coerceIn(0, 100)
                    Text(
                        "Downloading APK... $pct%",
                        color = Accent,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(Modifier.height(6.dp))
                    LinearProgressIndicator(
                        progress = { state.downloadProgress },
                        color = Accent,
                        trackColor = PanelSecondary,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(6.dp)
                            .clip(RoundedCornerShape(4.dp))
                    )
                }

                if (!state.errorMessage.isNullOrBlank()) {
                    Spacer(Modifier.height(10.dp))
                    Text(
                        state.errorMessage,
                        color = Color(0xFFFF7A7A),
                        fontSize = 12.sp
                    )
                }
            }
        },
        confirmButton = {
            Column(horizontalAlignment = Alignment.End) {
                Button(
                    onClick = onUpdateNow,
                    enabled = !state.isDownloading,
                    colors = ButtonDefaults.buttonColors(containerColor = Accent),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text(
                        if (state.isDownloading) "Downloading..." else "Update Now",
                        color = Ink,
                        fontWeight = FontWeight.Bold
                    )
                }
                Spacer(Modifier.height(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    TextButton(
                        onClick = onDownloadInBrowser,
                        enabled = !state.isDownloading
                    ) {
                        Text("Browser", color = Accent, fontSize = 12.sp)
                    }
                    if (!release.isMandatory) {
                        TextButton(
                            onClick = onSkipVersion,
                            enabled = !state.isDownloading
                        ) {
                            Text("Skip", color = SoftText, fontSize = 12.sp)
                        }
                        TextButton(
                            onClick = onLater,
                            enabled = !state.isDownloading
                        ) {
                            Text("Later", color = SoftText, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    )
}

@Composable
private fun AppUpdateSettingsDialog(
    state: AppUpdateUiState,
    onSaveRepo: (String) -> Unit,
    onCheckNow: () -> Unit,
    onOpenAvailableUpdate: () -> Unit,
    onOpenPackagesPage: () -> Unit,
    onDismiss: () -> Unit
) {
    var repoInput by remember(state.githubRepo) { mutableStateOf(state.githubRepo) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Panel,
        title = {
            Text(
                "FM Music Updates",
                color = Color.White,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                Text(
                    "Installed Version: v${state.currentVersionName} (Build ${state.currentVersionCode})",
                    color = Accent,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(10.dp))
                Text(
                    "Update Source (GitHub owner/repo or manifest URL):",
                    color = SoftText,
                    fontSize = 12.sp
                )
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(
                    value = repoInput,
                    onValueChange = { repoInput = it },
                    placeholder = { Text("user/fm-music or https://.../update-manifest.json", color = Color(0xFF6B6B7A)) },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Accent,
                        unfocusedBorderColor = BorderDark,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        cursorColor = Accent,
                        focusedContainerColor = PanelSecondary,
                        unfocusedContainerColor = PanelSecondary
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                if (!state.upToDateMessage.isNullOrBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(state.upToDateMessage, color = Accent, fontSize = 12.sp)
                }
                if (!state.errorMessage.isNullOrBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(state.errorMessage, color = Color(0xFFFF7A7A), fontSize = 12.sp)
                }

                state.availableUpdate?.let { available ->
                    Spacer(Modifier.height(10.dp))
                    OutlinedButton(
                        onClick = onOpenAvailableUpdate,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(
                            "Install v${available.versionName} Update",
                            color = Accent,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                if (state.githubRepo.isNotBlank() && !state.githubRepo.startsWith("https://")) {
                    Spacer(Modifier.height(6.dp))
                    TextButton(
                        onClick = onOpenPackagesPage,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Open GitHub Packages", color = SoftText, fontSize = 12.sp)
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSaveRepo(repoInput)
                    onCheckNow()
                },
                enabled = !state.isChecking,
                colors = ButtonDefaults.buttonColors(containerColor = Accent),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text(
                    if (state.isChecking) "Checking..." else "Check for Updates",
                    color = Ink,
                    fontWeight = FontWeight.Bold
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Close", color = SoftText)
            }
        }
    )
}

