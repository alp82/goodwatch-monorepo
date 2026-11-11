// Deterministic fixture catalog shared by the E2E API (deck reads) and the fake search role (ideas).
// 600 titles, two mood words each, offered on two streaming services; posters are local SVGs.
export const PROVIDERS = [
  [8, 'Netflix'],
  [1796, 'Netflix Standard with Ads'],
  [9, 'Amazon Prime Video'],
  [10, 'Amazon Video'],
  [337, 'Disney Plus'],
  [350, 'Apple TV+'],
  [1899, 'HBO Max'],
  [531, 'Paramount Plus'],
];
export const COUNTRIES = [
  { code: 'DE', name: 'Germany' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
];
export const STREAMING = PROVIDERS.map(([id]) => id).filter((id) => id !== 10);
export const WORDS = [
  'funny', 'mystery', 'space', 'family', 'rainy', 'twist', 'cartoon', 'short',
  'cosy', 'heist', 'romance', 'horror', 'western', 'musical', 'war', 'sports',
];

export function fixtureTitles(imagesOrigin) {
  return Array.from({ length: 600 }, (_, n) => {
    const i = n + 1;
    const show = i % 3 === 0;
    const words = [WORDS[i % WORDS.length], WORDS[(i * 7) % WORDS.length]];
    return {
      key: (show ? 2_000_000_000_000 : 1_000_000_000_000) + i,
      tmdbId: i,
      mediaType: show ? 'show' : 'movie',
      title: `${words[0][0].toUpperCase()}${words[0].slice(1)} ${words[1]} ${i}`,
      year: 1990 + (i % 35),
      overview: `A ${words.join(', ')} title.`,
      posterUrl: `${imagesOrigin}/posters/${i}.svg`,
      backdropUrl: null,
      trailerUrl: null,
      runtimeMinutes: show ? 30 : 80 + (i % 60),
      goodwatchScore: 50 + (i % 50),
      genres: words,
    };
  });
}

export const servicesOf = (title) => [
  STREAMING[title.tmdbId % STREAMING.length],
  STREAMING[(title.tmdbId * 5 + 3) % STREAMING.length],
];

/** The search role's answer for a room idea: titles whose words appear in the prompt, best score first. */
export function interpretIdea(titles, prompt) {
  const words = prompt.toLowerCase().split(/\W+/);
  let hits = titles.filter((t) => t.genres.some((g) => words.includes(g)));
  if (!hits.length) {
    const seed = [...prompt].reduce((a, c) => a + c.charCodeAt(0), 0);
    hits = titles.filter((t) => (t.tmdbId + seed) % 9 === 0);
  }
  return {
    prompt,
    attributes: words.filter((w) => WORDS.includes(w)).map((w) => ({ text: w, kind: 'want' })),
    rankedKeys: hits.sort((a, b) => (b.goodwatchScore ?? 0) - (a.goodwatchScore ?? 0)).map((t) => t.key),
    interpretedAt: Date.now(),
  };
}
