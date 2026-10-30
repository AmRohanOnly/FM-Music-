package com.fmmusic.client.data

import com.fmmusic.client.model.MusicTrack

object MusicCatalogData {
    val curatedTracks = listOf(
        // Hindi hits
        MusicTrack(
            id = "hindi-1",
            title = "Kesariya",
            artist = "Arijit Singh, Pritam",
            album = "Brahmāstra",
            durationSeconds = 268,
            vibe = "Hindi hits",
            youtubeId = "ElZfdU54Cp8",
            streamUrl = "https://cdn.freesound.org/previews/682/682054_11861866-lq.mp3",
            lyrics = listOf(
                "Mujhko itna bataye koyi",
                "Kaise tujhse dil na lagaye koyi",
                "Rabba ne tujhko banane me",
                "Kardi hai husn ki khaali tijoriyan",
                "Kesariya tera ishq hai piya",
                "Rang jaaun jo main haath lagaun"
            )
        ),
        MusicTrack(
            id = "hindi-2",
            title = "Apna Bana Le",
            artist = "Arijit Singh, Sachin-Jigar",
            album = "Bhediya",
            durationSeconds = 261,
            vibe = "Hindi hits",
            youtubeId = "k4yXQkG2s1E",
            streamUrl = "https://cdn.freesound.org/previews/682/682055_11861866-lq.mp3",
            lyrics = listOf(
                "Tu mera koyi na hoke bhi kuch laage",
                "Kiya re jo bhi tune kiya re",
                "Kiya re khud ko tere hawale",
                "Apna bana le piya, apna bana le piya"
            )
        ),
        MusicTrack(
            id = "hindi-3",
            title = "Raataan Lambiyan",
            artist = "Jubin Nautiyal, Asees Kaur",
            album = "Shershaah",
            durationSeconds = 230,
            vibe = "Hindi hits",
            youtubeId = "IltsOcwkhvE",
            streamUrl = "https://cdn.freesound.org/previews/682/682054_11861866-lq.mp3",
            lyrics = listOf(
                "Teri meri gallan ho gayi mashhur",
                "Kar na kabhi tu mujhe nazron se door",
                "Kitthe chaliye tu kitthe chaliye",
                "Kaatun kaise raataan o saawariya"
            )
        ),

        // New releases
        MusicTrack(
            id = "new-1",
            title = "Shape of You",
            artist = "Ed Sheeran",
            album = "÷ (Divide)",
            durationSeconds = 233,
            vibe = "New releases",
            youtubeId = "JGwWNGJdvx8",
            streamUrl = "https://cdn.freesound.org/previews/682/682055_11861866-lq.mp3",
            lyrics = listOf(
                "The club isn't the best place to find a lover",
                "So the bar is where I go",
                "I'm in love with the shape of you",
                "We push and pull like a magnet do"
            )
        ),
        MusicTrack(
            id = "new-2",
            title = "Despacito",
            artist = "Luis Fonsi ft. Daddy Yankee",
            album = "Vida",
            durationSeconds = 228,
            vibe = "New releases",
            youtubeId = "kJQP7kiw5Fk",
            streamUrl = "https://cdn.freesound.org/previews/682/682054_11861866-lq.mp3",
            lyrics = listOf(
                "Sí, sabes que ya llevo un rato mirándote",
                "Tengo que bailar contigo hoy",
                "Despacito, quiero respirar tu cuello despacito"
            )
        ),

        // Chill
        MusicTrack(
            id = "chill-1",
            title = "Lofi Study Beats",
            artist = "ChilledCow / Lofi Girl",
            album = "Study Session",
            durationSeconds = 195,
            vibe = "Chill",
            youtubeId = "5qap5aO4i9A",
            streamUrl = "https://cdn.freesound.org/previews/682/682054_11861866-lq.mp3",
            lyrics = listOf(
                "(Instrumental relaxing lofi melodies and peaceful vinyl crackles)"
            )
        ),
        MusicTrack(
            id = "chill-2",
            title = "Sunset Lover",
            artist = "Petit Biscuit",
            album = "Presence",
            durationSeconds = 237,
            vibe = "Chill",
            youtubeId = "m7Bc3pLyij0",
            streamUrl = "https://cdn.freesound.org/previews/682/682055_11861866-lq.mp3"
        ),

        // Indie
        MusicTrack(
            id = "indie-1",
            title = "Sweater Weather",
            artist = "The Neighbourhood",
            album = "I Love You.",
            durationSeconds = 240,
            vibe = "Indie",
            youtubeId = "4NRXx6U8ABQ",
            streamUrl = "https://cdn.freesound.org/previews/682/682054_11861866-lq.mp3",
            lyrics = listOf(
                "All I am is a man, I want the world in my hands",
                "Cause it's too cold for you here",
                "And now, so let me hold both your hands in the holes of my sweater"
            )
        ),
        MusicTrack(
            id = "indie-2",
            title = "Riptide",
            artist = "Vance Joy",
            album = "Dream Your Life Away",
            durationSeconds = 204,
            vibe = "Indie",
            youtubeId = "b7k0a5hYnSI",
            streamUrl = "https://cdn.freesound.org/previews/682/682055_11861866-lq.mp3"
        ),

        // Focus
        MusicTrack(
            id = "focus-1",
            title = "Weightless (Ambient)",
            artist = "Marconi Union",
            album = "Weightless",
            durationSeconds = 485,
            vibe = "Focus",
            youtubeId = "WPni755-Krg",
            streamUrl = "https://cdn.freesound.org/previews/682/682054_11861866-lq.mp3"
        ),

        // Workout
        MusicTrack(
            id = "workout-1",
            title = "Eye of the Tiger",
            artist = "Survivor",
            album = "Eye of the Tiger",
            durationSeconds = 245,
            vibe = "Workout",
            youtubeId = "btPJPFnesV4",
            streamUrl = "https://cdn.freesound.org/previews/682/682055_11861866-lq.mp3",
            lyrics = listOf(
                "Risin' up, back on the street",
                "Did my time, took my chances",
                "Went the distance, now I'm back on my feet",
                "It's the eye of the tiger"
            )
        )
    )

    fun search(query: String): List<MusicTrack> {
        val q = query.trim().lowercase()
        if (q.isBlank()) return emptyList()

        val results = curatedTracks.filter {
            it.title.lowercase().contains(q) ||
            it.artist.lowercase().contains(q) ||
            it.vibe.lowercase().contains(q)
        }

        if (results.isEmpty()) {
            return listOf(
                MusicTrack(
                    id = "dyn-" + q.hashCode(),
                    title = query.trim().replaceFirstChar { it.uppercase() },
                    artist = "FM Music Stream",
                    album = "Discovery Mix",
                    durationSeconds = 210,
                    vibe = "Top hits",
                    youtubeId = "JGwWNGJdvx8",
                    streamUrl = "https://cdn.freesound.org/previews/682/682054_11861866-lq.mp3"
                )
            )
        }

        return results
    }

    fun getTrackById(id: String): MusicTrack {
        return curatedTracks.firstOrNull { it.id == id } ?: MusicTrack(
            id = id,
            title = "Track $id",
            artist = "Downloaded Audio",
            album = "Offline Collection",
            durationSeconds = 220,
            vibe = "Offline",
            isDownloaded = true
        )
    }
}
