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
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
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
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
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
import com.fmmusic.client.model.UserPlaylist
import com.fmmusic.client.playback.ExoPlaybackManager
import com.fmmusic.client.update.AppUpdateUiState
import com.fmmusic.client.update.ReleaseUpdateInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import java.util.Calendar

// ==========================================================================================
// THEME & CUSTOMIZATION ENGINE
// ==========================================================================================

data class AppThemePalette(
    val id: String,
    val name: String,
    val description: String,
    val background: Color,
    val surface: Color,
    val surfaceCard: Color,
    val surfaceHover: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val border: Color,
    val isGlass: Boolean = false,
    val isLight: Boolean = false,
    val glassHighlight: Color = Color.Transparent
)

val AppThemes = listOf(
    AppThemePalette(
        id = "YT_DARK",
        name = "YouTube Music Dark",
        description = "Official sleek YouTube Music dark surfaces",
        background = Color(0xFF030303),
        surface = Color(0xFF0F0F0F),
        surfaceCard = Color(0xFF1E1E1E),
        surfaceHover = Color(0xFF282828),
        textPrimary = Color(0xFFFFFFFF),
        textSecondary = Color(0xFFAAAAAA),
        border = Color(0xFF2A2A2A),
        isGlass = false,
        isLight = false
    ),
    AppThemePalette(
        id = "IOS_GLASS_DARK",
        name = "iOS Frosted Glass (Dark)",
        description = "Translucent frosted glass with specular highlight borders",
        background = Color(0xFF0A0D14),
        surface = Color(0xFF121824),
        surfaceCard = Color(0xFFFFFFFF).copy(alpha = 0.20f),
        surfaceHover = Color(0xFFFFFFFF).copy(alpha = 0.30f),
        textPrimary = Color(0xFFF8FAFC),
        textSecondary = Color(0xFF94A3B8),
        border = Color(0xFFFFFFFF).copy(alpha = 0.22f),
        isGlass = true,
        isLight = false,
        glassHighlight = Color(0xFFFFFFFF).copy(alpha = 0.30f)
    ),
    AppThemePalette(
        id = "IOS_GLASS_LIGHT",
        name = "iOS Frosted Glass (Light)",
        description = "Apple milk glass with bright vibrant ambiance",
        background = Color(0xFFE8EEF5),
        surface = Color(0xFFF1F5F9),
        surfaceCard = Color(0xFFFFFFFF).copy(alpha = 0.70f),
        surfaceHover = Color(0xFFFFFFFF).copy(alpha = 0.80f),
        textPrimary = Color(0xFF0F172A),
        textSecondary = Color(0xFF475569),
        border = Color(0xFF000000).copy(alpha = 0.15f),
        isGlass = true,
        isLight = true,
        glassHighlight = Color(0xFFFFFFFF).copy(alpha = 0.40f)
    ),
    AppThemePalette(
        id = "MODERN_LIGHT",
        name = "Modern Crisp Light",
        description = "Ultra clean, minimal daylight surfaces",
        background = Color(0xFFF8F9FA),
        surface = Color(0xFFFFFFFF),
        surfaceCard = Color(0xFFF1F3F5),
        surfaceHover = Color(0xFFE9ECEF),
        textPrimary = Color(0xFF111827),
        textSecondary = Color(0xFF6B7280),
        border = Color(0xFFE5E7EB),
        isGlass = false,
        isLight = true
    ),
    AppThemePalette(
        id = "MIDNIGHT_LIME",
        name = "Midnight Lime",
        description = "Deep stealth black with cyber energy",
        background = Color(0xFF090B08),
        surface = Color(0xFF12160E),
        surfaceCard = Color(0xFF1A2215),
        surfaceHover = Color(0xFF25301E),
        textPrimary = Color(0xFFF5FFF0),
        textSecondary = Color(0xFFA1B398),
        border = Color(0xFF2B3A23),
        isGlass = false,
        isLight = false
    ),
    AppThemePalette(
        id = "AURORA_CYAN",
        name = "Aurora Cyan",
        description = "Deep oceanic navy with ethereal reflections",
        background = Color(0xFF060D17),
        surface = Color(0xFF0C1929),
        surfaceCard = Color(0xFF13283F),
        surfaceHover = Color(0xFF1C3A5A),
        textPrimary = Color(0xFFF0F9FF),
        textSecondary = Color(0xFF7DD3FC),
        border = Color(0xFF1E4068),
        isGlass = true,
        isLight = false,
        glassHighlight = Color(0xFF38BDF8).copy(alpha = 0.20f)
    ),
    AppThemePalette(
        id = "OBSIDIAN_ROSE",
        name = "Obsidian Rose",
        description = "Luxurious dark ruby velvet aesthetic",
        background = Color(0xFF12070D),
        surface = Color(0xFF1E0D17),
        surfaceCard = Color(0xFF2D1423),
        surfaceHover = Color(0xFF3F1C31),
        textPrimary = Color(0xFFFFF1F2),
        textSecondary = Color(0xFFFDA4AF),
        border = Color(0xFF4C223C),
        isGlass = false,
        isLight = false
    ),
    AppThemePalette(
        id = "AMBER_VINYL",
        name = "Amber Vinyl",
        description = "Warm analog audio nostalgia",
        background = Color(0xFF120E09),
        surface = Color(0xFF1C150D),
        surfaceCard = Color(0xFF2A2014),
        surfaceHover = Color(0xFF3B2D1D),
        textPrimary = Color(0xFFFFFBEB),
        textSecondary = Color(0xFFFCD34D),
        border = Color(0xFF45341E),
        isGlass = false,
        isLight = false
    )
)

data class AccentOption(val name: String, val hex: String, val color: Color)

val CuratedAccents = listOf(
    AccentOption("YouTube Red", "#FF0000", Color(0xFFFF0000)),
    AccentOption("Apple Azure", "#007AFF", Color(0xFF007AFF)),
    AccentOption("Electric Lime", "#B9F36A", Color(0xFFB9F36A)),
    AccentOption("Emerald Mint", "#10B981", Color(0xFF10B981)),
    AccentOption("Cyan Aurora", "#06B6D4", Color(0xFF06B6D4)),
    AccentOption("Cyber Purple", "#A855F7", Color(0xFFA855F7)),
    AccentOption("Sunset Orange", "#F97316", Color(0xFFF97316)),
    AccentOption("Radiant Rose", "#F43F5E", Color(0xFFF43F5E)),
    AccentOption("Amber Gold", "#F59E0B", Color(0xFFF59E0B))
)

val LocalAppPalette = compositionLocalOf { AppThemes[0] }
val LocalAccentColor = compositionLocalOf { Color(0xFFFF0000) }

enum class NavigationTab(val label: String, val icon: String) {
    HOME("Home", "🏠"),
    EXPLORE("Explore", "🧭"),
    LIBRARY("Library", "📚"),
    OFFLINE("Offline", "💾")
}

// ==========================================================================================
// ACTIVITY ENTRYPOINT
// ==========================================================================================

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as MusicApplication
        val playbackManager = app.playbackManager

        setContent {
            val themeId by app.currentThemeId.collectAsState()
            val accentHex by app.currentAccentHex.collectAsState()

            val palette = remember(themeId) {
                AppThemes.firstOrNull { it.id == themeId } ?: AppThemes[0]
            }
            val accentColor = remember(accentHex) {
                try {
                    val parsed = android.graphics.Color.parseColor(accentHex)
                    Color(
                        red = (parsed shr 16) and 0xFF,
                        green = (parsed shr 8) and 0xFF,
                        blue = parsed and 0xFF,
                        alpha = (parsed ushr 24) and 0xFF
                    )
                } catch (_: Exception) {
                    Color(0xFFFF0000)
                }
            }

            CompositionLocalProvider(
                LocalAppPalette provides palette,
                LocalAccentColor provides accentColor
            ) {
                val colorScheme = if (palette.isLight) {
                    lightColorScheme(
                        background = palette.background,
                        surface = palette.surface,
                        primary = accentColor,
                        onPrimary = Color.White,
                        onBackground = palette.textPrimary,
                        onSurface = palette.textPrimary
                    )
                } else {
                    darkColorScheme(
                        background = palette.background,
                        surface = palette.surface,
                        primary = accentColor,
                        onPrimary = Color.Black,
                        onBackground = palette.textPrimary,
                        onSurface = palette.textPrimary
                    )
                }

                MaterialTheme(colorScheme = colorScheme) {
                    Surface(
                        modifier = Modifier.fillMaxSize(),
                        color = palette.background
                    ) {
                        ModernMusicAppRoot(playbackManager)
                    }
                }
            }
        }
    }
}

// ==========================================================================================
// ROOT COMPOSABLE
// ==========================================================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ModernMusicAppRoot(playbackManager: ExoPlaybackManager) {
    val app = MusicApplication.instance
    val palette = LocalAppPalette.current
    val accent = LocalAccentColor.current

    val playbackState by playbackManager.state.collectAsState()
    val favorites by app.favorites.collectAsState()
    val favoriteTracksMap by app.favoriteTracks.collectAsState()
    val playlists by app.playlists.collectAsState()
    val downloads by app.downloads.collectAsState()
    val downloading by app.downloading.collectAsState()
    val updateManager = app.updateManager
    val updateState by updateManager.state.collectAsState()

    var currentTab by remember { mutableStateOf(NavigationTab.HOME) }
    var showNowPlayingSheet by remember { mutableStateOf(false) }
    var showCustomizationDialog by remember { mutableStateOf(false) }
    var showUpdateDialog by remember { mutableStateOf(false) }
    var showNewPlaylistDialog by remember { mutableStateOf(false) }
    var playlistToRename by remember { mutableStateOf<UserPlaylist?>(null) }
    var activePlaylistDetails by remember { mutableStateOf<UserPlaylist?>(null) }
    var showAddToPlaylistDialogForTrack by remember { mutableStateOf<MusicTrack?>(null) }
    var showSleepTimerDialog by remember { mutableStateOf(false) }

    // Search state for Explore / Global
    var searchQuery by remember { mutableStateOf("") }
    var searchResults by remember { mutableStateOf<List<MusicTrack>>(emptyList()) }
    var isSearching by remember { mutableStateOf(false) }

    LaunchedEffect(searchQuery) {
        val trimmed = searchQuery.trim()
        if (trimmed.isNotBlank()) {
            isSearching = true
            searchResults = MusicCatalogData.search(trimmed)
            delay(350)
            try {
                val remote = app.innerTubeService.searchTracks(trimmed)
                if (remote.isNotEmpty()) {
                    searchResults = remote
                }
            } catch (_: Exception) {}
            isSearching = false
        } else {
            searchResults = emptyList()
            isSearching = false
        }
    }

    Scaffold(
        containerColor = palette.background,
        bottomBar = {
            Column {
                // Docked MiniPlayer above Bottom Navigation
                if (playbackState.hasMedia) {
                    YtMiniPlayerBar(
                        state = playbackState,
                        isFavorite = app.isFavorite(playbackState.currentTrack?.id.orEmpty()),
                        onToggleFavorite = {
                            playbackState.currentTrack?.let { app.toggleFavorite(it) }
                        },
                        onTogglePlay = playbackManager::togglePlayPause,
                        onNext = playbackManager::next,
                        onPrev = playbackManager::prev,
                        onExpand = { showNowPlayingSheet = true }
                    )
                }

                // Modern Navigation Bar
                YtBottomNavigationBar(
                    currentTab = currentTab,
                    onSelectTab = {
                        activePlaylistDetails = null
                        currentTab = it
                    }
                )
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Ambient glow orbs in iOS Glass mode
            if (palette.isGlass) {
                Box(
                    modifier = Modifier
                        .size(320.dp)
                        .align(Alignment.TopEnd)
                        .background(
                            Brush.radialGradient(
                                colors = listOf(accent.copy(alpha = 0.15f), Color.Transparent)
                            )
                        )
                )
            }

            Column(modifier = Modifier.fillMaxSize()) {
                // Modern Top App Bar
                YtTopAppBar(
                    onOpenThemePicker = { showCustomizationDialog = true },
                    onOpenUpdates = { showUpdateDialog = true },
                    onSearchQueryChange = { query ->
                        searchQuery = query
                        if (query.isNotBlank() && currentTab != NavigationTab.EXPLORE) {
                            currentTab = NavigationTab.EXPLORE
                        }
                    },
                    currentQuery = searchQuery
                )

                // Tab Content
                Box(modifier = Modifier.weight(1f)) {
                    when (currentTab) {
                        NavigationTab.HOME -> {
                            HomeScreen(
                                onPlayTrack = { track, list -> playbackManager.playTrack(track, list) },
                                onToggleFavorite = { app.toggleFavorite(it) },
                                onAddToPlaylist = { showAddToPlaylistDialogForTrack = it },
                                isFavorite = { app.isFavorite(it) },
                                onGoToLiked = { currentTab = NavigationTab.LIBRARY }
                            )
                        }
                        NavigationTab.EXPLORE -> {
                            ExploreScreen(
                                searchQuery = searchQuery,
                                onSearchQueryChange = { searchQuery = it },
                                isSearching = isSearching,
                                searchResults = searchResults,
                                onPlayTrack = { track, list -> playbackManager.playTrack(track, list) },
                                onToggleFavorite = { app.toggleFavorite(it) },
                                onAddToPlaylist = { showAddToPlaylistDialogForTrack = it },
                                isFavorite = { app.isFavorite(it) }
                            )
                        }
                        NavigationTab.LIBRARY -> {
                            if (activePlaylistDetails != null) {
                                PlaylistDetailsScreen(
                                    playlist = activePlaylistDetails!!,
                                    onBack = { activePlaylistDetails = null },
                                    onPlayTrack = { track, list -> playbackManager.playTrack(track, list) },
                                    onRemoveTrack = { tId ->
                                        app.removeTrackFromPlaylist(activePlaylistDetails!!.id, tId)
                                        activePlaylistDetails = app.playlists.value.firstOrNull { it.id == activePlaylistDetails!!.id }
                                    },
                                    onToggleFavorite = { app.toggleFavorite(it) },
                                    isFavorite = { app.isFavorite(it) }
                                )
                            } else {
                                LibraryScreen(
                                    favoriteTracks = favoriteTracksMap.values.toList(),
                                    playlists = playlists,
                                    onPlayTrack = { track, list -> playbackManager.playTrack(track, list) },
                                    onPlayAllLiked = {
                                        val list = favoriteTracksMap.values.toList()
                                        if (list.isNotEmpty()) playbackManager.playTrack(list.first(), list)
                                    },
                                    onShuffleAllLiked = {
                                        val list = favoriteTracksMap.values.toList()
                                        if (list.isNotEmpty()) {
                                            playbackManager.toggleShuffle(true)
                                            playbackManager.playTrack(list.shuffled().first(), list)
                                        }
                                    },
                                    onCreateNewPlaylist = { showNewPlaylistDialog = true },
                                    onOpenPlaylist = { activePlaylistDetails = it },
                                    onRenamePlaylist = { playlistToRename = it },
                                    onDeletePlaylist = { app.deletePlaylist(it.id) },
                                    onToggleFavorite = { app.toggleFavorite(it) }
                                )
                            }
                        }
                        NavigationTab.OFFLINE -> {
                            OfflineScreen(
                                downloads = downloads,
                                downloading = downloading,
                                onPlayTrack = { track, list -> playbackManager.playTrack(track, list) },
                                onToggleDownload = { app.toggleDownload(it) }
                            )
                        }
                    }
                }
            }
        }
    }

    // Now Playing Expanded Bottom Sheet
    if (showNowPlayingSheet && playbackState.hasMedia) {
        NowPlayingExpandedSheet(
            state = playbackState,
            isFavorite = app.isFavorite(playbackState.currentTrack?.id.orEmpty()),
            isDownloaded = downloads.contains(playbackState.currentTrack?.id.orEmpty()),
            isDownloading = downloading.contains(playbackState.currentTrack?.id.orEmpty()),
            onDismiss = { showNowPlayingSheet = false },
            onTogglePlay = playbackManager::togglePlayPause,
            onSeek = playbackManager::seekTo,
            onNext = playbackManager::next,
            onPrev = playbackManager::prev,
            onToggleShuffle = { playbackManager.toggleShuffle(it) },
            onToggleRepeat = { playbackManager.cycleRepeatMode() },
            onOpenSleepTimer = { showSleepTimerDialog = true },
            onToggleFavorite = {
                playbackState.currentTrack?.let { app.toggleFavorite(it) }
            },
            onToggleDownload = {
                playbackState.currentTrack?.let { app.toggleDownload(it) }
            },
            onPlayQueueTrack = { idx -> playbackManager.playFromQueue(idx) },
            onRetryTrack = playbackManager::retryCurrentTrack,
            onAddToPlaylist = {
                showAddToPlaylistDialogForTrack = playbackState.currentTrack
            }
        )
    }

    // Theme Customization Dialog
    if (showCustomizationDialog) {
        ThemeCustomizationDialog(
            currentThemeId = palette.id,
            currentAccentHex = app.currentAccentHex.value,
            onSelectTheme = { app.setTheme(it) },
            onSelectAccent = { app.setAccent(it) },
            onDismiss = { showCustomizationDialog = false }
        )
    }

    // In-App Update Dialog
    if (showUpdateDialog) {
        AppUpdateSettingsDialog(
            state = updateState,
            onSaveRepo = { updateManager.setGithubRepo(it) },
            onCheckNow = { updateManager.checkForUpdates(forceManual = true) },
            onOpenAvailableUpdate = { updateState.availableUpdate?.let { updateManager.downloadAndInstallUpdate(it) } },
            onOpenPackagesPage = {
                val repo = updateState.githubRepo.trim()
                if (repo.isNotBlank()) {
                    val url = if (repo.startsWith("http")) repo else "https://github.com/$repo/packages"
                    updateManager.openInBrowser(url)
                }
            },
            onDismiss = { showUpdateDialog = false }
        )
    }

    // New Playlist Dialog
    if (showNewPlaylistDialog) {
        CreatePlaylistDialog(
            onCreate = { name ->
                val newPl = app.createPlaylist(name)
                showNewPlaylistDialog = false
                activePlaylistDetails = newPl
            },
            onDismiss = { showNewPlaylistDialog = false }
        )
    }

    // Rename Playlist Dialog
    playlistToRename?.let { pl ->
        RenamePlaylistDialog(
            playlist = pl,
            onRename = { newName ->
                app.renamePlaylist(pl.id, newName)
                playlistToRename = null
            },
            onDismiss = { playlistToRename = null }
        )
    }

    // Add To Playlist Dialog
    showAddToPlaylistDialogForTrack?.let { track ->
        AddToPlaylistDialog(
            track = track,
            playlists = playlists,
            onAddToPlaylist = { plId ->
                app.addTrackToPlaylist(plId, track)
                showAddToPlaylistDialogForTrack = null
            },
            onCreateNewPlaylistAndAdd = { name ->
                val pl = app.createPlaylist(name)
                app.addTrackToPlaylist(pl.id, track)
                showAddToPlaylistDialogForTrack = null
            },
            onDismiss = { showAddToPlaylistDialogForTrack = null }
        )
    }

    // Sleep Timer Dialog
    if (showSleepTimerDialog) {
        SleepTimerDialog(
            currentMinutes = playbackState.sleepTimerMinutesRemaining,
            onSetTimer = { mins ->
                playbackManager.setSleepTimer(mins)
                showSleepTimerDialog = false
            },
            onCancelTimer = {
                playbackManager.cancelSleepTimer()
                showSleepTimerDialog = false
            },
            onDismiss = { showSleepTimerDialog = false }
        )
    }
}

// ==========================================================================================
// TOP APP BAR (YouTube Music Style)
// ==========================================================================================

@Composable
private fun YtTopAppBar(
    onOpenThemePicker: () -> Unit,
    onOpenUpdates: () -> Unit,
    onSearchQueryChange: (String) -> Unit,
    currentQuery: String
) {
    val palette = LocalAppPalette.current
    val accent = LocalAccentColor.current
    val sessionState by MusicApplication.instance.innerTubeService.sessionState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.surface)
            .padding(horizontal = 16.dp, vertical = 10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // YouTube Music Brand Badge
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                // Red YouTube play badge
                Box(
                    modifier = Modifier
                        .size(34.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(
                            Brush.linearGradient(
                                colors = listOf(accent, accent.copy(alpha = 0.8f))
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text("▶", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }

                Spacer(Modifier.width(10.dp))

                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "FM Music",
                            color = palette.textPrimary,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 17.sp,
                            letterSpacing = (-0.5).sp
                        )
                        Spacer(Modifier.width(6.dp))
                        // Version badge
                        Surface(
                            color = palette.surfaceCard,
                            shape = RoundedCornerShape(6.dp),
                            border = BorderStroke(1.dp, palette.border)
                        ) {
                            Text(
                                "v1.0.21",
                                color = accent,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                            )
                        }
                    }
                    Text(
                        if (sessionState.isInitialized) "● InnerTube Connected" else "○ In-App Streaming",
                        color = if (sessionState.isInitialized) Color(0xFF10B981) else palette.textSecondary,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            // Action Buttons
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Theme Customization Button
                Button(
                    onClick = onOpenThemePicker,
                    colors = ButtonDefaults.buttonColors(containerColor = palette.surfaceCard),
                    shape = CircleShape,
                    modifier = Modifier.size(38.dp),
                    contentPadding = PaddingValues(0.dp),
                    border = BorderStroke(1.dp, palette.border)
                ) {
                    Text("🎨", fontSize = 16.sp)
                }

                // Diagnostics / Update Button
                Button(
                    onClick = onOpenUpdates,
                    colors = ButtonDefaults.buttonColors(containerColor = palette.surfaceCard),
                    shape = CircleShape,
                    modifier = Modifier.size(38.dp),
                    contentPadding = PaddingValues(0.dp),
                    border = BorderStroke(1.dp, palette.border)
                ) {
                    Text("⚙", fontSize = 16.sp, color = palette.textPrimary)
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        // Search Bar in Header
        OutlinedTextField(
            value = currentQuery,
            onValueChange = onSearchQueryChange,
            placeholder = {
                Text(
                    "Search songs, albums, artists...",
                    color = palette.textSecondary,
                    fontSize = 13.sp
                )
            },
            leadingIcon = {
                Text("🔍", fontSize = 14.sp)
            },
            trailingIcon = {
                if (currentQuery.isNotBlank()) {
                    Text(
                        "✕",
                        color = palette.textSecondary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier
                            .clickable { onSearchQueryChange("") }
                            .padding(8.dp)
                    )
                }
            },
            singleLine = true,
            shape = RoundedCornerShape(24.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = accent,
                unfocusedBorderColor = palette.border,
                focusedTextColor = palette.textPrimary,
                unfocusedTextColor = palette.textPrimary,
                cursorColor = accent,
                focusedContainerColor = palette.surfaceCard,
                unfocusedContainerColor = palette.surfaceCard
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
        )
    }
}

// ==========================================================================================
// BOTTOM NAVIGATION BAR
// ==========================================================================================

@Composable
private fun YtBottomNavigationBar(
    currentTab: NavigationTab,
    onSelectTab: (NavigationTab) -> Unit
) {
    val palette = LocalAppPalette.current
    val accent = LocalAccentColor.current

    Surface(
        color = palette.surface,
        border = BorderStroke(1.dp, palette.border),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.navigationBars)
                .padding(vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically
        ) {
            NavigationTab.values().forEach { tab ->
                val selected = currentTab == tab
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .clickable { onSelectTab(tab) }
                        .padding(horizontal = 14.dp, vertical = 4.dp)
                ) {
                    Text(
                        tab.icon,
                        fontSize = if (selected) 20.sp else 18.sp,
                        modifier = Modifier.padding(bottom = 2.dp)
                    )
                    Text(
                        tab.label,
                        color = if (selected) accent else palette.textSecondary,
                        fontSize = 11.sp,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                    )
                }
            }
        }
    }
}

// ==========================================================================================
// MINI PLAYER BAR
// ==========================================================================================

@Composable
private fun YtMiniPlayerBar(
    state: PlaybackUiState,
    isFavorite: Boolean,
    onToggleFavorite: () -> Unit,
    onTogglePlay: () -> Unit,
    onNext: () -> Unit,
    onPrev: () -> Unit,
    onExpand: () -> Unit
) {
    val palette = LocalAppPalette.current
    val accent = LocalAccentColor.current

    Surface(
        color = palette.surfaceCard,
        border = BorderStroke(1.dp, palette.border),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onExpand)
    ) {
        Column {
            // Live top progress line
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(2.5.dp)
                    .background(palette.border)
            ) {
                if (state.isBuffering) {
                    LinearProgressIndicator(
                        color = accent,
                        trackColor = Color.Transparent,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(state.progressFraction)
                            .fillMaxSize()
                            .background(accent)
                    )
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Artwork thumbnail
                TrackArtworkImage(
                    track = state.currentTrack,
                    modifier = Modifier.size(44.dp),
                    cornerRadiusDp = 8,
                    showPlayingVisualizer = state.isPlaying
                )

                Spacer(Modifier.width(10.dp))

                // Title & Artist
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        state.currentTrack?.title ?: "FM Music",
                        color = palette.textPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        state.currentTrack?.artist ?: "YouTube Music Stream",
                        color = palette.textSecondary,
                        fontSize = 11.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // Heart / Like button in MiniPlayer
                Button(
                    onClick = onToggleFavorite,
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                    contentPadding = PaddingValues(0.dp),
                    modifier = Modifier.size(36.dp)
                ) {
                    Text(
                        if (isFavorite) "♥" else "♡",
                        color = if (isFavorite) accent else palette.textSecondary,
                        fontSize = 18.sp
                    )
                }

                // Play / Pause circular accent button
                Button(
                    onClick = onTogglePlay,
                    colors = ButtonDefaults.buttonColors(containerColor = accent),
                    shape = CircleShape,
                    modifier = Modifier.size(38.dp),
                    contentPadding = PaddingValues(0.dp)
                ) {
                    if (state.isBuffering && !state.isPlaying) {
                        CircularProgressIndicator(
                            color = Color.White,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(16.dp)
                        )
                    } else {
                        Text(
                            if (state.isPlaying) "⏸" else "▶",
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(Modifier.width(6.dp))

                // Next Button
                Button(
                    onClick = onNext,
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                    contentPadding = PaddingValues(0.dp),
                    modifier = Modifier.size(36.dp)
                ) {
                    Text("⏭", color = palette.textPrimary, fontSize = 16.sp)
                }
            }
        }
    }
}

// ==========================================================================================
// HOME SCREEN
// ==========================================================================================

@Composable
private fun HomeScreen(
    onPlayTrack: (MusicTrack, List<MusicTrack>) -> Unit,
    onToggleFavorite: (MusicTrack) -> Unit,
    onAddToPlaylist: (MusicTrack) -> Unit,
    isFavorite: (String) -> Boolean,
    onGoToLiked: () -> Unit
) {
    val palette = LocalAppPalette.current
    val accent = LocalAccentColor.current
    val curated = remember { MusicCatalogData.curatedTracks }
    val vibes = remember { listOf("All", "Hindi hits", "New releases", "Chill", "Indie", "Focus", "Workout") }
    var selectedVibe by remember { mutableStateOf("All") }

    val filteredTracks = remember(selectedVibe) {
        if (selectedVibe == "All") curated
        else curated.filter { it.vibe.equals(selectedVibe, ignoreCase = true) }
    }

    val (greetingText, _) = remember { getTimeGreeting() }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp)
    ) {
        // Greeting & Quick Picks Header
        item {
            Text(
                greetingText,
                color = palette.textPrimary,
                fontSize = 24.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.5).sp
            )
            Spacer(Modifier.height(14.dp))

            // Vibe Chips (YouTube Music style)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                vibes.forEach { vibe ->
                    val isSelected = selectedVibe == vibe
                    Surface(
                        color = if (isSelected) accent else palette.surfaceCard,
                        shape = RoundedCornerShape(20.dp),
                        border = BorderStroke(1.dp, if (isSelected) accent else palette.border),
                        modifier = Modifier.clickable { selectedVibe = vibe }
                    ) {
                        Text(
                            vibe,
                            color = if (isSelected) Color.White else palette.textPrimary,
                            fontSize = 12.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp)
                        )
                    }
                }
            }

            Spacer(Modifier.height(20.dp))
        }

        // Liked Songs Shortcut Banner
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.Transparent),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onGoToLiked)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.horizontalGradient(
                                colors = listOf(accent.copy(alpha = 0.35f), palette.surfaceCard)
                            )
                        )
                        .padding(16.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(accent),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("♥", color = Color.White, fontSize = 24.sp)
                        }

                        Spacer(Modifier.width(14.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                "Your Liked Music",
                                color = palette.textPrimary,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                "Tap to open your saved tracks & playlists",
                                color = palette.textSecondary,
                                fontSize = 12.sp
                            )
                        }

                        Text("➔", color = accent, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(Modifier.height(22.dp))
        }

        // Section Title: Quick Picks
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    "Quick Picks",
                    color = palette.textPrimary,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    "PLAY ALL",
                    color = accent,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.clickable {
                        if (filteredTracks.isNotEmpty()) {
                            onPlayTrack(filteredTracks.first(), filteredTracks)
                        }
                    }
                )
            }
            Spacer(Modifier.height(12.dp))
        }

        // Track items
        items(filteredTracks) { track ->
            TrackListItem(
                track = track,
                isFav = isFavorite(track.id),
                onPlay = { onPlayTrack(track, filteredTracks) },
                onToggleFav = { onToggleFavorite(track) },
                onAddToPlaylist = { onAddToPlaylist(track) }
            )
            Spacer(Modifier.height(8.dp))
        }
    }
}

// ==========================================================================================
// EXPLORE SCREEN
// ==========================================================================================

@Composable
private fun ExploreScreen(
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    isSearching: Boolean,
    searchResults: List<MusicTrack>,
    onPlayTrack: (MusicTrack, List<MusicTrack>) -> Unit,
    onToggleFavorite: (MusicTrack) -> Unit,
    onAddToPlaylist: (MusicTrack) -> Unit,
    isFavorite: (String) -> Boolean
) {
    val palette = LocalAppPalette.current
    val accent = LocalAccentColor.current
    val displayTracks = if (searchQuery.isNotBlank()) searchResults else MusicCatalogData.curatedTracks

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp)
    ) {
        item {
            Text(
                if (searchQuery.isNotBlank()) "Search Results" else "Explore & Trending",
                color = palette.textPrimary,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(6.dp))
            Text(
                if (isSearching) "Searching YouTube Music catalogs..."
                else "${displayTracks.size} tracks available",
                color = palette.textSecondary,
                fontSize = 12.sp
            )
            Spacer(Modifier.height(14.dp))
        }

        if (isSearching) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = accent)
                }
            }
        } else {
            items(displayTracks) { track ->
                TrackListItem(
                    track = track,
                    isFav = isFavorite(track.id),
                    onPlay = { onPlayTrack(track, displayTracks) },
                    onToggleFav = { onToggleFavorite(track) },
                    onAddToPlaylist = { onAddToPlaylist(track) }
                )
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

// ==========================================================================================
// LIBRARY SCREEN (Liked Songs + Custom Playlists)
// ==========================================================================================

@Composable
private fun LibraryScreen(
    favoriteTracks: List<MusicTrack>,
    playlists: List<UserPlaylist>,
    onPlayTrack: (MusicTrack, List<MusicTrack>) -> Unit,
    onPlayAllLiked: () -> Unit,
    onShuffleAllLiked: () -> Unit,
    onCreateNewPlaylist: () -> Unit,
    onOpenPlaylist: (UserPlaylist) -> Unit,
    onRenamePlaylist: (UserPlaylist) -> Unit,
    onDeletePlaylist: (UserPlaylist) -> Unit,
    onToggleFavorite: (MusicTrack) -> Unit
) {
    val palette = LocalAppPalette.current
    val accent = LocalAccentColor.current
    var showLikedTracksList by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp)
    ) {
        // Section: Liked Music Card
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = palette.surfaceCard),
                shape = RoundedCornerShape(18.dp),
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { showLikedTracksList = !showLikedTracksList }
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.linearGradient(
                                colors = listOf(accent.copy(alpha = 0.4f), palette.surfaceCard)
                            )
                        )
                        .padding(18.dp)
                ) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(56.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(accent),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("♥", color = Color.White, fontSize = 30.sp)
                            }

                            Spacer(Modifier.width(14.dp))

                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    "Liked Music",
                                    color = palette.textPrimary,
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.ExtraBold
                                )
                                Text(
                                    "Auto playlist • ${favoriteTracks.size} songs",
                                    color = palette.textSecondary,
                                    fontSize = 12.sp
                                )
                            }
                        }

                        Spacer(Modifier.height(14.dp))

                        Row(
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Button(
                                onClick = onPlayAllLiked,
                                enabled = favoriteTracks.isNotEmpty(),
                                colors = ButtonDefaults.buttonColors(containerColor = accent),
                                shape = RoundedCornerShape(20.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("▶ Play All", color = Color.White, fontWeight = FontWeight.Bold)
                            }

                            OutlinedButton(
                                onClick = onShuffleAllLiked,
                                enabled = favoriteTracks.isNotEmpty(),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = palette.textPrimary),
                                border = BorderStroke(1.dp, palette.border),
                                shape = RoundedCornerShape(20.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("🔀 Shuffle", color = palette.textPrimary, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(14.dp))
        }

        // Expanded Liked Songs List
        if (showLikedTracksList) {
            item {
                Text(
                    "Liked Songs (${favoriteTracks.size})",
                    color = accent,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(vertical = 4.dp)
                )
            }

            if (favoriteTracks.isEmpty()) {
                item {
                    Text(
                        "No liked songs yet. Tap the heart on any song to add it here!",
                        color = palette.textSecondary,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(vertical = 12.dp)
                    )
                }
            } else {
                items(favoriteTracks) { track ->
                    TrackListItem(
                        track = track,
                        isFav = true,
                        onPlay = { onPlayTrack(track, favoriteTracks) },
                        onToggleFav = { onToggleFavorite(track) },
                        onAddToPlaylist = {}
                    )
                    Spacer(Modifier.height(8.dp))
                }
            }

            item {
                Spacer(Modifier.height(16.dp))
            }
        }

        // Playlists Section Header
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    "Custom Playlists (${playlists.size})",
                    color = palette.textPrimary,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )

                Button(
                    onClick = onCreateNewPlaylist,
                    colors = ButtonDefaults.buttonColors(containerColor = accent),
                    shape = RoundedCornerShape(16.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text("+ New Playlist", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(12.dp))
        }

        // Playlists Items
        items(playlists) { pl ->
            PlaylistItemCard(
                playlist = pl,
                onClick = { onOpenPlaylist(pl) },
                onPlay = {
                    if (pl.tracks.isNotEmpty()) onPlayTrack(pl.tracks.first(), pl.tracks)
                },
                onRename = { onRenamePlaylist(pl) },
                onDelete = { onDeletePlaylist(pl) }
            )
            Spacer(Modifier.height(10.dp))
        }
    }
}

@Composable
private fun PlaylistItemCard(
    playlist: UserPlaylist,
    onClick: () -> Unit,
    onPlay: () -> Unit,
    onRename: () -> Unit,
    onDelete: () -> Unit
) {
    val palette = LocalAppPalette.current
    val accent = LocalAccentColor.current
    var showMenu by remember { mutableStateOf(false) }

    Surface(
        color = palette.surfaceCard,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, palette.border),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Playlist Art Thumbnail
            Box(
                modifier = Modifier
                    .size(50.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(palette.surface),
                contentAlignment = Alignment.Center
            ) {
                if (playlist.tracks.isNotEmpty()) {
                    TrackArtworkImage(
                        track = playlist.tracks.first(),
                        modifier = Modifier.fillMaxSize(),
                        cornerRadiusDp = 10
                    )
                } else {
                    Text("🎵", fontSize = 24.sp)
                }
            }

            Spacer(Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    playlist.name,
                    color = palette.textPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    "${playlist.tracks.size} songs",
                    color = palette.textSecondary,
                    fontSize = 12.sp
                )
            }

            // Quick Play Button
            if (playlist.tracks.isNotEmpty()) {
                Button(
                    onClick = onPlay,
                    colors = ButtonDefaults.buttonColors(containerColor = accent),
                    shape = CircleShape,
                    modifier = Modifier.size(34.dp),
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Text("▶", color = Color.White, fontSize = 12.sp)
                }
                Spacer(Modifier.width(6.dp))
            }

            // 3-dots Menu for Rename / Delete
            Box {
                Button(
                    onClick = { showMenu = true },
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                    modifier = Modifier.size(34.dp),
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Text("⋮", color = palette.textSecondary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                }

                DropdownMenu(
                    expanded = showMenu,
                    onDismissRequest = { showMenu = false },
                    modifier = Modifier.background(palette.surface)
                ) {
                    DropdownMenuItem(
                        text = { Text("✏ Rename Playlist", color = palette.textPrimary) },
                        onClick = {
                            showMenu = false
                            onRename()
                        }
                    )
                    DropdownMenuItem(
                        text = { Text("🗑 Delete Playlist", color = Color(0xFFFF5252)) },
                        onClick = {
                            showMenu = false
                            onDelete()
                        }
                    )
                }
            }
        }
    }
}

// ==========================================================================================
// PLAYLIST DETAILS SCREEN
// ==========================================================================================

@Composable
private fun PlaylistDetailsScreen(
    playlist: UserPlaylist,
    onBack: () -> Unit,
    onPlayTrack: (MusicTrack, List<MusicTrack>) -> Unit,
    onRemoveTrack: (String) -> Unit,
    onToggleFavorite: (MusicTrack) -> Unit,
    isFavorite: (String) -> Boolean
) {
    val palette = LocalAppPalette.current
    val accent = LocalAccentColor.current

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp)
    ) {
        item {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Button(
                    onClick = onBack,
                    colors = ButtonDefaults.buttonColors(containerColor = palette.surfaceCard),
                    shape = CircleShape,
                    modifier = Modifier.size(36.dp),
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Text("←", color = palette.textPrimary, fontSize = 18.sp)
                }

                Spacer(Modifier.width(12.dp))

                Column {
                    Text(
                        playlist.name,
                        color = palette.textPrimary,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Text(
                        "${playlist.tracks.size} tracks",
                        color = palette.textSecondary,
                        fontSize = 12.sp
                    )
                }
            }

            Spacer(Modifier.height(16.dp))

            if (playlist.tracks.isNotEmpty()) {
                Button(
                    onClick = { onPlayTrack(playlist.tracks.first(), playlist.tracks) },
                    colors = ButtonDefaults.buttonColors(containerColor = accent),
                    shape = RoundedCornerShape(20.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("▶ Play All Tracks", color = Color.White, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(16.dp))
            }
        }

        if (playlist.tracks.isEmpty()) {
            item {
                Text(
                    "This playlist is currently empty.\nExplore and tap '+ Add to Playlist' on any track to add it here!",
                    color = palette.textSecondary,
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 32.dp)
                )
            }
        } else {
            items(playlist.tracks) { track ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(modifier = Modifier.weight(1f)) {
                        TrackListItem(
                            track = track,
                            isFav = isFavorite(track.id),
                            onPlay = { onPlayTrack(track, playlist.tracks) },
                            onToggleFav = { onToggleFavorite(track) },
                            onAddToPlaylist = {}
                        )
                    }

                    Button(
                        onClick = { onRemoveTrack(track.id) },
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                        contentPadding = PaddingValues(0.dp),
                        modifier = Modifier.size(36.dp)
                    ) {
                        Text("✕", color = palette.textSecondary, fontSize = 14.sp)
                    }
                }
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

// ==========================================================================================
// OFFLINE SCREEN
// ==========================================================================================

@Composable
private fun OfflineScreen(
    downloads: Set<String>,
    downloading: Set<String>,
    onPlayTrack: (MusicTrack, List<MusicTrack>) -> Unit,
    onToggleDownload: (MusicTrack) -> Unit
) {
    val palette = LocalAppPalette.current
    val accent = LocalAccentColor.current
    val curated = remember { MusicCatalogData.curatedTracks }

    val downloadedTracks = remember(downloads) {
        downloads.map { id ->
            MusicCatalogData.getTrackById(id).copy(isDownloaded = true)
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp)
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = palette.surfaceCard),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("💾", fontSize = 28.sp)
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(
                            "Offline Storage",
                            color = palette.textPrimary,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            "${downloadedTracks.size} songs downloaded on device",
                            color = palette.textSecondary,
                            fontSize = 12.sp
                        )
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            if (downloadedTracks.isNotEmpty()) {
                Button(
                    onClick = { onPlayTrack(downloadedTracks.first(), downloadedTracks) },
                    colors = ButtonDefaults.buttonColors(containerColor = accent),
                    shape = RoundedCornerShape(20.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("▶ Play All Offline Tracks", color = Color.White, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(16.dp))
            }
        }

        if (downloadedTracks.isEmpty()) {
            item {
                Text(
                    "No offline tracks saved yet.\nTap the download icon on any track to listen offline without internet connection!",
                    color = palette.textSecondary,
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 32.dp)
                )
            }
        } else {
            items(downloadedTracks) { track ->
                TrackListItem(
                    track = track,
                    isFav = false,
                    onPlay = { onPlayTrack(track, downloadedTracks) },
                    onToggleFav = {},
                    onAddToPlaylist = {}
                )
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

// ==========================================================================================
// TRACK LIST ITEM
// ==========================================================================================

@Composable
private fun TrackListItem(
    track: MusicTrack,
    isFav: Boolean,
    onPlay: () -> Unit,
    onToggleFav: () -> Unit,
    onAddToPlaylist: () -> Unit
) {
    val palette = LocalAppPalette.current
    val accent = LocalAccentColor.current

    Surface(
        color = palette.surfaceCard,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, palette.border),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onPlay)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TrackArtworkImage(
                track = track,
                modifier = Modifier.size(46.dp),
                cornerRadiusDp = 8
            )

            Spacer(Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    track.title,
                    color = palette.textPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    "${track.artist} • ${track.durationFormatted}",
                    color = palette.textSecondary,
                    fontSize = 11.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            // Favorite button
            Button(
                onClick = onToggleFav,
                colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                contentPadding = PaddingValues(0.dp),
                modifier = Modifier.size(36.dp)
            ) {
                Text(
                    if (isFav) "♥" else "♡",
                    color = if (isFav) accent else palette.textSecondary,
                    fontSize = 18.sp
                )
            }

            // Add to Playlist button
            Button(
                onClick = onAddToPlaylist,
                colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                contentPadding = PaddingValues(0.dp),
                modifier = Modifier.size(36.dp)
            ) {
                Text("➕", color = palette.textSecondary, fontSize = 14.sp)
            }
        }
    }
}

// ==========================================================================================
// EXPANDED NOW PLAYING BOTTOM SHEET
// ==========================================================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NowPlayingExpandedSheet(
    state: PlaybackUiState,
    isFavorite: Boolean,
    isDownloaded: Boolean,
    isDownloading: Boolean,
    onDismiss: () -> Unit,
    onTogglePlay: () -> Unit,
    onSeek: (Long) -> Unit,
    onNext: () -> Unit,
    onPrev: () -> Unit,
    onToggleShuffle: (Boolean) -> Unit,
    onToggleRepeat: () -> Unit,
    onOpenSleepTimer: () -> Unit,
    onToggleFavorite: () -> Unit,
    onToggleDownload: () -> Unit,
    onPlayQueueTrack: (Int) -> Unit,
    onRetryTrack: () -> Unit,
    onAddToPlaylist: () -> Unit
) {
    val palette = LocalAppPalette.current
    val accent = LocalAccentColor.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("Track", "Lyrics", "Queue")

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = palette.surface,
        dragHandle = {
            Surface(
                modifier = Modifier
                    .padding(vertical = 12.dp)
                    .size(width = 38.dp, height = 4.dp),
                shape = CircleShape,
                color = palette.textSecondary.copy(alpha = 0.4f)
            ) {}
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Dismiss arrow & Stream Source header
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Button(
                    onClick = onDismiss,
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                    contentPadding = PaddingValues(0.dp),
                    modifier = Modifier.size(36.dp)
                ) {
                    Text("⌄", color = palette.textPrimary, fontSize = 28.sp, fontWeight = FontWeight.Bold)
                }

                Surface(
                    color = palette.surfaceCard,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, palette.border)
                ) {
                    Text(
                        state.streamSource ?: "InnerTube Audio Stream",
                        color = accent,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }

                Button(
                    onClick = onAddToPlaylist,
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                    contentPadding = PaddingValues(0.dp),
                    modifier = Modifier.size(36.dp)
                ) {
                    Text("➕", color = palette.textPrimary, fontSize = 16.sp)
                }
            }

            Spacer(Modifier.height(8.dp))

            // Sub-tabs: Track / Lyrics / Queue
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = Color.Transparent,
                contentColor = accent,
                indicator = { tabPositions ->
                    TabRowDefaults.SecondaryIndicator(
                        Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                        color = accent
                    )
                }
            ) {
                tabs.forEachIndexed { idx, title ->
                    Tab(
                        selected = selectedTab == idx,
                        onClick = { selectedTab = idx },
                        text = {
                            Text(
                                title,
                                color = if (selectedTab == idx) accent else palette.textSecondary,
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
                    // Large Artwork
                    Box(
                        modifier = Modifier
                            .size(260.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(palette.surfaceCard),
                        contentAlignment = Alignment.Center
                    ) {
                        TrackArtworkImage(
                            track = state.currentTrack,
                            modifier = Modifier.fillMaxSize(),
                            cornerRadiusDp = 20
                        )

                        if (state.isBuffering) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Color.Black.copy(alpha = 0.5f)),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(color = accent)
                            }
                        }
                    }

                    Spacer(Modifier.height(24.dp))

                    // Title & Artist with Favorite & Download buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                state.currentTrack?.title ?: "FM Music Track",
                                color = palette.textPrimary,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.ExtraBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                state.currentTrack?.artist ?: "Unknown Artist",
                                color = palette.textSecondary,
                                fontSize = 14.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        // Heart Button
                        Button(
                            onClick = onToggleFavorite,
                            colors = ButtonDefaults.buttonColors(containerColor = palette.surfaceCard),
                            shape = CircleShape,
                            modifier = Modifier.size(42.dp),
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Text(
                                if (isFavorite) "♥" else "♡",
                                color = if (isFavorite) accent else palette.textSecondary,
                                fontSize = 20.sp
                            )
                        }

                        Spacer(Modifier.width(8.dp))

                        // Download Button
                        Button(
                            onClick = onToggleDownload,
                            colors = ButtonDefaults.buttonColors(containerColor = palette.surfaceCard),
                            shape = CircleShape,
                            modifier = Modifier.size(42.dp),
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            if (isDownloading) {
                                CircularProgressIndicator(
                                    color = accent,
                                    strokeWidth = 2.dp,
                                    modifier = Modifier.size(18.dp)
                                )
                            } else {
                                Text(
                                    if (isDownloaded) "✓" else "⬇",
                                    color = if (isDownloaded) Color(0xFF10B981) else palette.textSecondary,
                                    fontSize = 18.sp
                                )
                            }
                        }
                    }

                    // Playback error banner (with retry)
                    if (!state.errorMessage.isNullOrBlank()) {
                        Spacer(Modifier.height(14.dp))
                        Surface(
                            color = Color(0xFFFF5252).copy(alpha = 0.20f),
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, Color(0xFFFF5252)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    state.errorMessage,
                                    color = Color(0xFFFF8A80),
                                    fontSize = 11.sp,
                                    modifier = Modifier.weight(1f)
                                )
                                Spacer(Modifier.width(8.dp))
                                Button(
                                    onClick = onRetryTrack,
                                    colors = ButtonDefaults.buttonColors(containerColor = accent),
                                    shape = RoundedCornerShape(8.dp),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                ) {
                                    Text("Retry", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }

                    Spacer(Modifier.height(16.dp))

                    var isDraggingScrubber by remember { mutableStateOf(false) }
                    var scrubFraction by remember { mutableFloatStateOf(0f) }

                    val effectiveFraction = if (isDraggingScrubber) scrubFraction else state.progressFraction
                    val effectivePositionMs = if (isDraggingScrubber) {
                        (scrubFraction * state.durationMs).toLong()
                    } else {
                        state.currentPositionMs
                    }

                    // Scrubber Slider with smooth 60fps dragging and debounced seek commit
                    Slider(
                        value = effectiveFraction.coerceIn(0f, 1f),
                        onValueChange = { frac ->
                            isDraggingScrubber = true
                            scrubFraction = frac
                        },
                        onValueChangeFinished = {
                            val targetMs = (scrubFraction * state.durationMs).toLong()
                            onSeek(targetMs)
                            isDraggingScrubber = false
                        },
                        colors = SliderDefaults.colors(
                            thumbColor = accent,
                            activeTrackColor = accent,
                            inactiveTrackColor = palette.border
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(formatDuration(effectivePositionMs), color = palette.textSecondary, fontSize = 12.sp)
                        Text(formatDuration(state.durationMs), color = palette.textSecondary, fontSize = 12.sp)
                    }

                    Spacer(Modifier.height(20.dp))

                    // Main Controls Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Shuffle
                        Button(
                            onClick = { onToggleShuffle(!state.isShuffled) },
                            colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                            modifier = Modifier.size(46.dp),
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Text(
                                "🔀",
                                color = if (state.isShuffled) accent else palette.textSecondary,
                                fontSize = 18.sp
                            )
                        }

                        // Previous
                        Button(
                            onClick = onPrev,
                            colors = ButtonDefaults.buttonColors(containerColor = palette.surfaceCard),
                            shape = CircleShape,
                            modifier = Modifier.size(52.dp),
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Text("⏮", color = palette.textPrimary, fontSize = 18.sp)
                        }

                        // Play / Pause Big Circular Button
                        Button(
                            onClick = onTogglePlay,
                            colors = ButtonDefaults.buttonColors(containerColor = accent),
                            shape = CircleShape,
                            modifier = Modifier.size(68.dp),
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Text(
                                if (state.isPlaying) "⏸" else "▶",
                                color = Color.White,
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        // Next
                        Button(
                            onClick = onNext,
                            colors = ButtonDefaults.buttonColors(containerColor = palette.surfaceCard),
                            shape = CircleShape,
                            modifier = Modifier.size(52.dp),
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Text("⏭", color = palette.textPrimary, fontSize = 18.sp)
                        }

                        // Repeat
                        Button(
                            onClick = onToggleRepeat,
                            colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                            modifier = Modifier.size(46.dp),
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            val repSymbol = when (state.repeatMode) {
                                RepeatMode.OFF -> "🔁"
                                RepeatMode.ALL -> "🔁"
                                RepeatMode.ONE -> "🔂"
                            }
                            Text(
                                repSymbol,
                                color = if (state.repeatMode != RepeatMode.OFF) accent else palette.textSecondary,
                                fontSize = 18.sp
                            )
                        }
                    }

                    Spacer(Modifier.height(20.dp))

                    // Secondary Tools Row (Sleep Timer)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        OutlinedButton(
                            onClick = onOpenSleepTimer,
                            shape = RoundedCornerShape(16.dp),
                            border = BorderStroke(1.dp, palette.border),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = palette.textPrimary)
                        ) {
                            val timerText = state.sleepTimerMinutesRemaining?.let { "⏳ Timer: ${it}m" } ?: "⏳ Sleep Timer"
                            Text(timerText, fontSize = 12.sp, color = if (state.sleepTimerMinutesRemaining != null) accent else palette.textPrimary)
                        }
                    }
                }
                1 -> {
                    // Lyrics View
                    val lyrics = state.currentTrack?.lyrics.orEmpty()
                    if (lyrics.isEmpty()) {
                        Text(
                            "No lyrics synchronized for this track yet.",
                            color = palette.textSecondary,
                            fontSize = 14.sp,
                            modifier = Modifier.padding(vertical = 40.dp)
                        )
                    } else {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            lyrics.forEach { line ->
                                Text(
                                    line,
                                    color = palette.textPrimary,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Medium,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    }
                }
                2 -> {
                    // Queue View
                    val queue = state.queue
                    if (queue.isEmpty()) {
                        Text(
                            "Queue is empty.",
                            color = palette.textSecondary,
                            fontSize = 14.sp,
                            modifier = Modifier.padding(vertical = 40.dp)
                        )
                    } else {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            queue.forEachIndexed { idx, track ->
                                val isCurrent = idx == state.queueIndex
                                Surface(
                                    color = if (isCurrent) accent.copy(alpha = 0.2f) else palette.surfaceCard,
                                    shape = RoundedCornerShape(10.dp),
                                    border = BorderStroke(1.dp, if (isCurrent) accent else palette.border),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { onPlayQueueTrack(idx) }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(10.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            "${idx + 1}",
                                            color = if (isCurrent) accent else palette.textSecondary,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.width(24.dp)
                                        )
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                track.title,
                                                color = palette.textPrimary,
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Bold,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                            Text(
                                                track.artist,
                                                color = palette.textSecondary,
                                                fontSize = 11.sp,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ==========================================================================================
// THEME & CUSTOMIZATION DIALOG
// ==========================================================================================

@Composable
private fun ThemeCustomizationDialog(
    currentThemeId: String,
    currentAccentHex: String,
    onSelectTheme: (String) -> Unit,
    onSelectAccent: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val palette = LocalAppPalette.current
    val accent = LocalAccentColor.current

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = palette.surface,
        title = {
            Text(
                "🎨 Themes & Customizations",
                color = palette.textPrimary,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 18.sp
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
            ) {
                // Section: App Theme Selection
                Text(
                    "APP THEME",
                    color = accent,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
                Spacer(Modifier.height(8.dp))

                AppThemes.forEach { theme ->
                    val isSelected = theme.id == currentThemeId
                    Surface(
                        color = theme.surfaceCard,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(if (isSelected) 2.dp else 1.dp, if (isSelected) accent else theme.border),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onSelectTheme(theme.id) }
                            .padding(vertical = 4.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Swatch pill
                            Box(
                                modifier = Modifier
                                    .size(32.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(theme.background)
                                    .border(1.dp, theme.border, RoundedCornerShape(8.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(16.dp)
                                        .clip(CircleShape)
                                        .background(accent)
                                )
                            }

                            Spacer(Modifier.width(12.dp))

                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    theme.name,
                                    color = theme.textPrimary,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    theme.description,
                                    color = theme.textSecondary,
                                    fontSize = 11.sp
                                )
                            }

                            if (isSelected) {
                                Text("✓", color = accent, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                        }
                    }
                }

                Spacer(Modifier.height(18.dp))

                // Section: Accent Color Selection
                Text(
                    "ACCENT COLOR",
                    color = accent,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
                Spacer(Modifier.height(8.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    CuratedAccents.forEach { acc ->
                        val isSelected = acc.hex.equals(currentAccentHex, ignoreCase = true)
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.clickable { onSelectAccent(acc.hex) }
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(42.dp)
                                    .clip(CircleShape)
                                    .background(acc.color)
                                    .border(
                                        if (isSelected) 3.dp else 1.dp,
                                        if (isSelected) palette.textPrimary else Color.Transparent,
                                        CircleShape
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                if (isSelected) {
                                    Text("✓", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(
                                acc.name.substringBefore(" "),
                                color = palette.textSecondary,
                                fontSize = 10.sp
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = accent),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text("Done", color = Color.White, fontWeight = FontWeight.Bold)
            }
        }
    )
}

// ==========================================================================================
// CREATE PLAYLIST DIALOG
// ==========================================================================================

@Composable
private fun CreatePlaylistDialog(
    onCreate: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val palette = LocalAppPalette.current
    val accent = LocalAccentColor.current
    var nameInput by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = palette.surface,
        title = {
            Text("➕ Create New Playlist", color = palette.textPrimary, fontWeight = FontWeight.Bold)
        },
        text = {
            Column {
                Text("Enter a name for your custom playlist:", color = palette.textSecondary, fontSize = 13.sp)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = nameInput,
                    onValueChange = { nameInput = it },
                    placeholder = { Text("e.g. Chill Beats, Hindi Grooves", color = palette.textSecondary) },
                    singleLine = true,
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = accent,
                        unfocusedBorderColor = palette.border,
                        focusedTextColor = palette.textPrimary,
                        unfocusedTextColor = palette.textPrimary,
                        cursorColor = accent,
                        focusedContainerColor = palette.surfaceCard,
                        unfocusedContainerColor = palette.surfaceCard
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onCreate(nameInput) },
                enabled = nameInput.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = accent),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text("Create", color = Color.White, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = palette.textSecondary)
            }
        }
    )
}

// ==========================================================================================
// RENAME PLAYLIST DIALOG
// ==========================================================================================

@Composable
private fun RenamePlaylistDialog(
    playlist: UserPlaylist,
    onRename: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val palette = LocalAppPalette.current
    val accent = LocalAccentColor.current
    var nameInput by remember(playlist.name) { mutableStateOf(playlist.name) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = palette.surface,
        title = {
            Text("✏ Rename Playlist", color = palette.textPrimary, fontWeight = FontWeight.Bold)
        },
        text = {
            Column {
                Text("Update playlist name:", color = palette.textSecondary, fontSize = 13.sp)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = nameInput,
                    onValueChange = { nameInput = it },
                    singleLine = true,
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = accent,
                        unfocusedBorderColor = palette.border,
                        focusedTextColor = palette.textPrimary,
                        unfocusedTextColor = palette.textPrimary,
                        cursorColor = accent,
                        focusedContainerColor = palette.surfaceCard,
                        unfocusedContainerColor = palette.surfaceCard
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onRename(nameInput) },
                enabled = nameInput.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = accent),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text("Save", color = Color.White, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = palette.textSecondary)
            }
        }
    )
}

// ==========================================================================================
// ADD TO PLAYLIST DIALOG
// ==========================================================================================

@Composable
private fun AddToPlaylistDialog(
    track: MusicTrack,
    playlists: List<UserPlaylist>,
    onAddToPlaylist: (String) -> Unit,
    onCreateNewPlaylistAndAdd: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val palette = LocalAppPalette.current
    val accent = LocalAccentColor.current
    var showNewField by remember { mutableStateOf(false) }
    var newPlaylistName by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = palette.surface,
        title = {
            Text("Add to Playlist", color = palette.textPrimary, fontWeight = FontWeight.Bold)
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
            ) {
                Text(
                    "Select a playlist for \"${track.title}\":",
                    color = palette.textSecondary,
                    fontSize = 13.sp
                )
                Spacer(Modifier.height(10.dp))

                playlists.forEach { pl ->
                    val alreadyContains = pl.tracks.any { it.id == track.id }
                    Surface(
                        color = palette.surfaceCard,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, palette.border),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(enabled = !alreadyContains) { onAddToPlaylist(pl.id) }
                            .padding(vertical = 4.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("🎵", fontSize = 18.sp)
                            Spacer(Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(pl.name, color = palette.textPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                Text("${pl.tracks.size} tracks", color = palette.textSecondary, fontSize = 11.sp)
                            }
                            if (alreadyContains) {
                                Text("Added", color = accent, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))

                if (!showNewField) {
                    OutlinedButton(
                        onClick = { showNewField = true },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, accent)
                    ) {
                        Text("+ New Playlist", color = accent, fontWeight = FontWeight.Bold)
                    }
                } else {
                    OutlinedTextField(
                        value = newPlaylistName,
                        onValueChange = { newPlaylistName = it },
                        placeholder = { Text("New playlist name...", color = palette.textSecondary) },
                        singleLine = true,
                        shape = RoundedCornerShape(10.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = accent,
                            unfocusedBorderColor = palette.border,
                            focusedTextColor = palette.textPrimary,
                            unfocusedTextColor = palette.textPrimary,
                            cursorColor = accent
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = {
                            if (newPlaylistName.isNotBlank()) {
                                onCreateNewPlaylistAndAdd(newPlaylistName)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = accent),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text("Create & Add", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close", color = palette.textSecondary)
            }
        }
    )
}

// ==========================================================================================
// SLEEP TIMER DIALOG
// ==========================================================================================

@Composable
private fun SleepTimerDialog(
    currentMinutes: Int?,
    onSetTimer: (Int) -> Unit,
    onCancelTimer: () -> Unit,
    onDismiss: () -> Unit
) {
    val palette = LocalAppPalette.current
    val accent = LocalAccentColor.current
    val timerOptions = listOf(15, 30, 45, 60, 90)

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = palette.surface,
        title = {
            Text("⏳ Sleep Timer", color = palette.textPrimary, fontWeight = FontWeight.Bold)
        },
        text = {
            Column {
                Text(
                    if (currentMinutes != null) "Active timer: $currentMinutes minutes remaining"
                    else "Turn off playback automatically after:",
                    color = palette.textSecondary,
                    fontSize = 13.sp
                )
                Spacer(Modifier.height(14.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    timerOptions.forEach { mins ->
                        Button(
                            onClick = { onSetTimer(mins) },
                            colors = ButtonDefaults.buttonColors(containerColor = palette.surfaceCard),
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.dp, palette.border),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Text("${mins}m", color = palette.textPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }
                }

                if (currentMinutes != null) {
                    Spacer(Modifier.height(14.dp))
                    Button(
                        onClick = onCancelTimer,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFF5252)),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Cancel Sleep Timer", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close", color = palette.textSecondary)
            }
        }
    )
}

// ==========================================================================================
// UPDATE SETTINGS DIALOG (Preserved for in-app updates)
// ==========================================================================================

@Composable
private fun AppUpdateSettingsDialog(
    state: AppUpdateUiState,
    onSaveRepo: (String) -> Unit,
    onCheckNow: () -> Unit,
    onOpenAvailableUpdate: () -> Unit,
    onOpenPackagesPage: () -> Unit,
    onDismiss: () -> Unit
) {
    val palette = LocalAppPalette.current
    val accent = LocalAccentColor.current
    var repoInput by remember(state.githubRepo) { mutableStateOf(state.githubRepo) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = palette.surface,
        title = {
            Text("FM Music Settings & Updates", color = palette.textPrimary, fontWeight = FontWeight.Bold)
        },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                Text(
                    "Installed Version: v${state.currentVersionName} (Build ${state.currentVersionCode})",
                    color = accent,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(10.dp))
                Text("Update Source (GitHub owner/repo):", color = palette.textSecondary, fontSize = 12.sp)
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(
                    value = repoInput,
                    onValueChange = { repoInput = it },
                    placeholder = { Text("owner/repo", color = palette.textSecondary) },
                    singleLine = true,
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = accent,
                        unfocusedBorderColor = palette.border,
                        focusedTextColor = palette.textPrimary,
                        unfocusedTextColor = palette.textPrimary,
                        cursorColor = accent
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                if (!state.upToDateMessage.isNullOrBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(state.upToDateMessage, color = accent, fontSize = 12.sp)
                }

                state.availableUpdate?.let { available ->
                    Spacer(Modifier.height(10.dp))
                    Button(
                        onClick = onOpenAvailableUpdate,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = accent),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text("Install v${available.versionName} Update", color = Color.White, fontWeight = FontWeight.Bold)
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
                colors = ButtonDefaults.buttonColors(containerColor = accent),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text(if (state.isChecking) "Checking..." else "Check for Updates", color = Color.White, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Close", color = palette.textSecondary)
            }
        }
    )
}

// ==========================================================================================
// ARTWORK IMAGE & BITMAP CACHING
// ==========================================================================================

private object ArtworkBitmapCache {
    private val cache = LruCache<String, ImageBitmap>(80)
    fun get(key: String): ImageBitmap? = if (key.isNotBlank()) cache.get(key) else null
    fun put(key: String, bitmap: ImageBitmap) {
        if (key.isNotBlank()) cache.put(key, bitmap)
    }
}

private suspend fun loadImageBitmapFromUrl(urlString: String): ImageBitmap? = withContext(Dispatchers.IO) {
    if (urlString.isBlank()) return@withContext null
    try {
        val conn = (URL(urlString).openConnection() as HttpURLConnection).apply {
            connectTimeout = 6000
            readTimeout = 8000
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "Mozilla/5.0")
        }
        if (conn.responseCode in 200..299) {
            conn.inputStream.use { stream ->
                val bmp = BitmapFactory.decodeStream(stream)
                bmp?.asImageBitmap()
            }
        } else null
    } catch (_: Exception) {
        null
    }
}

@Composable
private fun TrackArtworkImage(
    track: MusicTrack?,
    modifier: Modifier = Modifier,
    showPlayingVisualizer: Boolean = false,
    cornerRadiusDp: Int = 10
) {
    val palette = LocalAppPalette.current
    val accent = LocalAccentColor.current
    val primaryUrl = track?.resolvedThumbnailUrl.orEmpty()
    val fallbackUrl = remember(track?.youtubeId, track?.id) {
        val vid = track?.youtubeId?.ifBlank { track.id }.orEmpty().trim()
        if (vid.isNotBlank() && !vid.contains("-") && !vid.startsWith("dyn")) {
            "https://i.ytimg.com/vi/$vid/hqdefault.jpg"
        } else ""
    }

    var bitmap by remember(primaryUrl, fallbackUrl) {
        mutableStateOf(ArtworkBitmapCache.get(primaryUrl) ?: ArtworkBitmapCache.get(fallbackUrl))
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
            .background(palette.surfaceCard),
        contentAlignment = Alignment.Center
    ) {
        if (bitmap != null) {
            Image(
                bitmap = bitmap!!,
                contentDescription = track?.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
        } else {
            // Elegant initial placeholder
            val initial = track?.title?.firstOrNull()?.uppercase() ?: "♫"
            Text(
                initial,
                color = accent,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold
            )
        }

        if (showPlayingVisualizer) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.35f)),
                contentAlignment = Alignment.Center
            ) {
                Text("▶", color = accent, fontSize = 14.sp)
            }
        }
    }
}

private fun getTimeGreeting(): Pair<String, String> {
    val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
    return when (hour) {
        in 5..11 -> Pair("Good morning", "Morning flow")
        in 12..16 -> Pair("Good afternoon", "Afternoon vibe")
        in 17..21 -> Pair("Good evening", "Evening beats")
        else -> Pair("Late night", "Night session")
    }
}

private fun formatDuration(millis: Long): String {
    val totalSeconds = (millis / 1000).coerceAtLeast(0)
    val mins = totalSeconds / 60
    val secs = totalSeconds % 60
    return "%d:%02d".format(mins, secs)
}
