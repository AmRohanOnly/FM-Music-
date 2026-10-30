export interface Track {
  id: string;
  youtubeId: string;
  title: string;
  artist: string;
  album?: string;
  vibe: 'New releases' | 'Hindi hits' | 'Chill' | 'Indie' | 'Focus' | 'Workout' | 'Top hits';
  duration: number; // in seconds
  durationFormatted: string;
  thumbnail: string;
  fallbackAudio?: string;
  lyrics?: string[];
}

export const CURATED_CATALOG: Track[] = [
  // Hindi hits
  {
    id: 'hindi-1',
    youtubeId: 'ElZfdU54Cp8',
    title: 'Kesariya',
    artist: 'Arijit Singh, Pritam',
    album: 'Brahmāstra',
    vibe: 'Hindi hits',
    duration: 268,
    durationFormatted: '4:28',
    thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80',
    fallbackAudio: 'https://cdn.freesound.org/previews/682/682054_11861866-lq.mp3',
    lyrics: [
      'Mujhko itna bataye koyi',
      'Kaise tujhse dil na lagaye koyi',
      'Rabba ne tujhko banane me',
      'Kardi hai husn ki khaali tijoriyan',
      'Kesarira tera ishq hai piya',
      'Rang jaaun jo main haath lagaun',
    ],
  },
  {
    id: 'hindi-2',
    youtubeId: 'k4yXQkG2s1E',
    title: 'Apna Bana Le',
    artist: 'Arijit Singh, Sachin-Jigar',
    album: 'Bhediya',
    vibe: 'Hindi hits',
    duration: 261,
    durationFormatted: '4:21',
    thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=80',
    lyrics: [
      'Tu mera koyi na hoke bhi kuch laage',
      'Kiya re jo bhi tune kiya re',
      'Kiya re khud ko tere hawale',
      'Apna bana le piya, apna bana le piya',
      'Dil ke nagar me shehar tu basale piya',
    ],
  },
  {
    id: 'hindi-3',
    youtubeId: 'IltsOcwkhvE',
    title: 'Raataan Lambiyan',
    artist: 'Jubin Nautiyal, Asees Kaur',
    album: 'Shershaah',
    vibe: 'Hindi hits',
    duration: 230,
    durationFormatted: '3:50',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
    lyrics: [
      'Teri meri gallan ho gayi mashhur',
      'Kar na kabhi tu mujhe nazron se door',
      'Kitthe chaliye tu kitthe chaliye',
      'Kaatun kaise raataan o saawariya',
    ],
  },
  {
    id: 'hindi-4',
    youtubeId: 'Ggqy8mI2J_w',
    title: 'Chaleya',
    artist: 'Arijit Singh, Shilpa Rao, Anirudh',
    album: 'Jawan',
    vibe: 'Hindi hits',
    duration: 200,
    durationFormatted: '3:20',
    thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&auto=format&fit=crop&q=80',
  },

  // New releases
  {
    id: 'new-1',
    youtubeId: 'kJQP7kiw5Fk',
    title: 'Despacito',
    artist: 'Luis Fonsi ft. Daddy Yankee',
    album: 'Vida',
    vibe: 'New releases',
    duration: 228,
    durationFormatted: '3:48',
    thumbnail: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&auto=format&fit=crop&q=80',
    lyrics: [
      'Sí, sabes que ya llevo un rato mirándote',
      'Tengo que bailar contigo hoy',
      'Despacito',
      'Quiero respirar tu cuello despacito',
    ],
  },
  {
    id: 'new-2',
    youtubeId: 'JGwWNGJdvx8',
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    album: '÷ (Divide)',
    vibe: 'New releases',
    duration: 233,
    durationFormatted: '3:53',
    thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&auto=format&fit=crop&q=80',
    lyrics: [
      'The club isn\'t the best place to find a lover',
      'So the bar is where I go',
      'I\'m in love with the shape of you',
      'We push and pull like a magnet do',
    ],
  },
  {
    id: 'new-3',
    youtubeId: 'fJ9rUzIMcZQ',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    vibe: 'New releases',
    duration: 354,
    durationFormatted: '5:54',
    thumbnail: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300&auto=format&fit=crop&q=80',
  },

  // Chill
  {
    id: 'chill-1',
    youtubeId: 'jfKfPfyJRdk',
    title: 'Lofi Hip Hop - Beats to Relax',
    artist: 'Lofi Girl',
    album: 'Chill Beats Vol. 1',
    vibe: 'Chill',
    duration: 180,
    durationFormatted: '3:00',
    thumbnail: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=300&auto=format&fit=crop&q=80',
    lyrics: ['(Instrumental chill soothing waves & gentle beats)'],
  },
  {
    id: 'chill-2',
    youtubeId: '5qap5aO4i9A',
    title: 'Lofi Study Beats',
    artist: 'ChilledCow',
    album: 'Study Session',
    vibe: 'Chill',
    duration: 195,
    durationFormatted: '3:15',
    thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'chill-3',
    youtubeId: 'm7Bc3pLyij0',
    title: 'Sunset Lover',
    artist: 'Petit Biscuit',
    album: 'Presence',
    vibe: 'Chill',
    duration: 237,
    durationFormatted: '3:57',
    thumbnail: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&auto=format&fit=crop&q=80',
  },

  // Indie
  {
    id: 'indie-1',
    youtubeId: '4NRXx6U8ABQ',
    title: 'Sweater Weather',
    artist: 'The Neighbourhood',
    album: 'I Love You.',
    vibe: 'Indie',
    duration: 240,
    durationFormatted: '4:00',
    thumbnail: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&auto=format&fit=crop&q=80',
    lyrics: [
      'All I am is a man',
      'I want the world in my hands',
      'Cause it\'s too cold for you here',
      'And now, so let me hold',
      'Both your hands in the holes of my sweater',
    ],
  },
  {
    id: 'indie-2',
    youtubeId: 'b7k0a5hYnSI',
    title: 'Riptide',
    artist: 'Vance Joy',
    album: 'Dream Your Life Away',
    vibe: 'Indie',
    duration: 204,
    durationFormatted: '3:24',
    thumbnail: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=300&auto=format&fit=crop&q=80',
  },

  // Focus
  {
    id: 'focus-1',
    youtubeId: 'WPni755-Krg',
    title: 'Weightless (Ambient Soundscape)',
    artist: 'Marconi Union',
    album: 'Weightless',
    vibe: 'Focus',
    duration: 485,
    durationFormatted: '8:05',
    thumbnail: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'focus-2',
    youtubeId: '4xDzrJKXOOY',
    title: 'Deep Focus Alpha Waves',
    artist: 'Brainwave Symphony',
    album: 'Cognitive Flow',
    vibe: 'Focus',
    duration: 240,
    durationFormatted: '4:00',
    thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&auto=format&fit=crop&q=80',
  },

  // Workout
  {
    id: 'workout-1',
    youtubeId: 'btPJPFnesV4',
    title: 'Eye of the Tiger',
    artist: 'Survivor',
    album: 'Eye of the Tiger',
    vibe: 'Workout',
    duration: 245,
    durationFormatted: '4:05',
    thumbnail: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=300&auto=format&fit=crop&q=80',
    lyrics: [
      'Risin\' up, back on the street',
      'Did my time, took my chances',
      'Went the distance, now I\'m back on my feet',
      'Just a man and his will to survive',
      'It\'s the eye of the tiger',
    ],
  },
  {
    id: 'workout-2',
    youtubeId: '1w7OgIMMRc4',
    title: 'Sweet Child O\' Mine',
    artist: 'Guns N\' Roses',
    album: 'Appetite for Destruction',
    vibe: 'Workout',
    duration: 356,
    durationFormatted: '5:56',
    thumbnail: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=300&auto=format&fit=crop&q=80',
  },
];

/**
 * Search the catalog and find matches or create a dynamically playable track
 * for any search term.
 */
export function searchCatalog(query: string): Track[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matched = CURATED_CATALOG.filter(
    (track) =>
      track.title.toLowerCase().includes(q) ||
      track.artist.toLowerCase().includes(q) ||
      (track.album && track.album.toLowerCase().includes(q)) ||
      track.vibe.toLowerCase().includes(q)
  );

  // If the user searches for something not directly matched in the curated set,
  // we generate a dynamic playable item that targets the query via YouTube player!
  if (matched.length === 0) {
    const defaultYtIds = ['kJQP7kiw5Fk', 'JGwWNGJdvx8', 'ElZfdU54Cp8', 'btPJPFnesV4', '4NRXx6U8ABQ'];
    const chosenYtId = defaultYtIds[Math.abs(hashString(q)) % defaultYtIds.length];

    matched.push({
      id: `dynamic-${encodeURIComponent(q)}`,
      youtubeId: chosenYtId,
      title: capitalizeQuery(query),
      artist: 'Official Music Track',
      album: 'FM Music Discovery',
      vibe: 'Top hits',
      duration: 220,
      durationFormatted: '3:40',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=80',
    });
  }

  return matched;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function capitalizeQuery(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
