package com.fmmusic.client

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fmmusic.client.playback.Media3PlaybackController

private val Ink = Color(0xFF111116)
private val Panel = Color(0xFF1B1B23)
private val SoftText = Color(0xFFB7B7C4)
private val Accent = Color(0xFFB9F36A)
private val SearchSuggestions = listOf("New releases", "Hindi hits", "Chill", "Indie", "Focus", "Workout")

class MainActivity : ComponentActivity() {
    private lateinit var playbackController: Media3PlaybackController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        playbackController = Media3PlaybackController(this)
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
                MusicHomeScreen(::openYouTubeMusicSearch, playbackController)
            }
        }
    }

    override fun onDestroy() {
        playbackController.release()
        super.onDestroy()
    }

    private fun openYouTubeMusicSearch(query: String) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(youtubeMusicSearchUrl(query)))
        try {
            startActivity(intent)
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, "No app or browser is available to open YouTube Music.", Toast.LENGTH_LONG).show()
        }
    }
}

internal fun youtubeMusicSearchUrl(query: String): String =
    "https://music.youtube.com/search?q=${java.net.URLEncoder.encode(query.trim(), "UTF-8")}"

@Composable
private fun MusicHomeScreen(
    onSearch: (String) -> Unit,
    playbackController: Media3PlaybackController,
) {
    var query by remember { mutableStateOf("") }
    Scaffold(
        containerColor = Ink,
        bottomBar = { Media3PlayerBar(playbackController) },
    ) { contentPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Ink)
                .verticalScroll(rememberScrollState())
                .padding(contentPadding)
                .padding(horizontal = 24.dp, vertical = 20.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    modifier = Modifier.size(42.dp),
                    shape = CircleShape,
                    color = Accent
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text("FM", color = Ink, fontWeight = FontWeight.Black, fontSize = 14.sp)
                    }
                }
                Spacer(Modifier.width(12.dp))
                Text("FM MUSIC", color = Color.White, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
            }

            Spacer(Modifier.height(38.dp))
            Text("Your next\nfavorite track.", fontSize = 38.sp, lineHeight = 43.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))
            Text("Search music on YouTube Music and start listening.", color = SoftText, fontSize = 16.sp)
            Spacer(Modifier.height(28.dp))

            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    placeholder = { Text("Songs, artists, albums") },
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Accent,
                        unfocusedBorderColor = Color(0xFF393943),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        cursorColor = Accent
                    ),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = {
                        if (query.isNotBlank()) onSearch(query)
                    })
                )
                Spacer(Modifier.width(10.dp))
                Button(
                    onClick = { if (query.isNotBlank()) onSearch(query) },
                    enabled = query.isNotBlank(),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Accent),
                    modifier = Modifier.height(56.dp)
                ) {
                    Text("Go", color = Ink, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(Modifier.height(34.dp))
            Text("PICK A VIBE", color = SoftText, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.5.sp)
            Spacer(Modifier.height(14.dp))
            SearchSuggestions.chunked(2).forEach { row ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    row.forEach { suggestion ->
                        Card(
                            onClick = { onSearch(suggestion) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(18.dp),
                            colors = CardDefaults.cardColors(containerColor = Panel)
                        ) {
                            Column(Modifier.padding(18.dp)) {
                                Text(suggestion, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                                Spacer(Modifier.height(5.dp))
                                Text("Explore on YouTube Music", color = SoftText, fontSize = 12.sp)
                            }
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
            }

            Spacer(Modifier.height(20.dp))
            Text(
                "Search opens the official YouTube Music app when available, or your browser. " +
                    "Playback, ads, account features, and availability are handled by YouTube.",
                color = SoftText,
                fontSize = 12.sp,
                lineHeight = 18.sp
            )
        }
    }
}

@Composable
private fun Media3PlayerBar(playbackController: Media3PlaybackController) {
    val state by playbackController.state.collectAsState()
    Surface(color = Panel, shadowElevation = 12.dp) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.navigationBars)
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    state.title ?: "In-app player",
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    state.errorMessage ?: if (state.hasMedia) {
                        state.artist.orEmpty()
                    } else {
                        "A licensed music provider is needed for in-app playback."
                    },
                    color = SoftText,
                    fontSize = 12.sp,
                )
            }
            Button(
                onClick = playbackController::togglePlayback,
                enabled = state.hasMedia && !state.isBuffering,
                colors = ButtonDefaults.buttonColors(containerColor = Accent),
            ) {
                Text(if (state.isPlaying) "Pause" else "Play", color = Ink)
            }
        }
    }
}
