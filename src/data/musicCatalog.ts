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
    youtubeId: 'NJAv_7lHUIU',
    title: 'Kesariya',
    artist: 'Arijit Singh, Pritam',
    album: 'Brahmāstra',
    vibe: 'Hindi hits',
    duration: 269,
    durationFormatted: '4:29',
    thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80',
    lyrics: [
      'Mujhko itna bataye koyi',
      'Kaise tujhse dil na lagaye koyi',
      'Rabba ne tujhko banane me',
      'Kardi hai husn ki khaali tijoriyan',
      'Kesariya tera ishq hai piya',
      'Rang jaaun jo main haath lagaun',
    ],
  },
  {
    id: 'hindi-2',
    youtubeId: 'YALvuUpY_b0',
    title: 'Apna Bana Le',
    artist: 'Arijit Singh, Sachin-Jigar',
    album: 'Bhediya',
    vibe: 'Hindi hits',
    duration: 262,
    durationFormatted: '4:22',
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
    youtubeId: 'Dm6YRJHy64c',
    title: 'Raataan Lambiyan',
    artist: 'Jubin Nautiyal, Asees Kaur',
    album: 'Shershaah',
    vibe: 'Hindi hits',
    duration: 231,
    durationFormatted: '3:51',
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
    youtubeId: 'V_jp5_VAzXk',
    title: 'Chaleya',
    artist: 'Arijit Singh, Shilpa Rao, Anirudh',
    album: 'Jawan',
    vibe: 'Hindi hits',
    duration: 201,
    durationFormatted: '3:21',
    thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&auto=format&fit=crop&q=80',
  },

  // New releases
  {
    id: 'new-1',
    youtubeId: 'FXovf5dsRTw',
    title: 'Despacito',
    artist: 'Luis Fonsi ft. Daddy Yankee',
    album: 'Vida',
    vibe: 'New releases',
    duration: 229,
    durationFormatted: '3:49',
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
    youtubeId: 'xTvyyoF_LZY',
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    album: '÷ (Divide)',
    vibe: 'New releases',
    duration: 234,
    durationFormatted: '3:54',
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
    youtubeId: 'BSTsnWoslP4',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    vibe: 'New releases',
    duration: 355,
    durationFormatted: '5:55',
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
    youtubeId: 'WrWcOLlmv7k',
    title: 'Sunset Lover',
    artist: 'Petit Biscuit',
    album: 'Presence',
    vibe: 'Chill',
    duration: 239,
    durationFormatted: '3:59',
    thumbnail: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&auto=format&fit=crop&q=80',
  },

  // Indie
  {
    id: 'indie-1',
    youtubeId: 'cULQhvuq1Zc',
    title: 'Sweater Weather',
    artist: 'The Neighbourhood',
    album: 'I Love You.',
    vibe: 'Indie',
    duration: 241,
    durationFormatted: '4:01',
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
    youtubeId: 'En_6WWOWh8E',
    title: 'Riptide',
    artist: 'Vance Joy',
    album: 'Dream Your Life Away',
    vibe: 'Indie',
    duration: 205,
    durationFormatted: '3:25',
    thumbnail: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=300&auto=format&fit=crop&q=80',
  },

  // Focus
  {
    id: 'focus-1',
    youtubeId: 'eQ6--TNre9k',
    title: 'Weightless (Ambient Soundscape)',
    artist: 'Marconi Union',
    album: 'Weightless',
    vibe: 'Focus',
    duration: 487,
    durationFormatted: '8:07',
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
    youtubeId: 'S-LO6dctBms',
    title: 'Eye of the Tiger',
    artist: 'Survivor',
    album: 'Eye of the Tiger',
    vibe: 'Workout',
    duration: 244,
    durationFormatted: '4:04',
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
    youtubeId: 'oMfMUfgjiLg',
    title: 'Sweet Child O\' Mine',
    artist: 'Guns N\' Roses',
    album: 'Appetite for Destruction',
    vibe: 'Workout',
    duration: 357,
    durationFormatted: '5:57',
    thumbnail: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=300&auto=format&fit=crop&q=80',
  },
];

/**
 * Search the curated catalog for matching tracks.
 */
export function searchCatalog(query: string): Track[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return CURATED_CATALOG.filter(
    (track) =>
      track.title.toLowerCase().includes(q) ||
      track.artist.toLowerCase().includes(q) ||
      (track.album && track.album.toLowerCase().includes(q)) ||
      track.vibe.toLowerCase().includes(q)
  );
}
