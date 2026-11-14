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

// Two streaming services per title; a title on Netflix is on its ads tier too (one tile in Your services), so a
// Netflix card carries both offers, as in production.
export const servicesOf = (title) => {
  const ids = [STREAMING[title.tmdbId % STREAMING.length], STREAMING[(title.tmdbId * 5 + 3) % STREAMING.length]];
  return ids.includes(8) && !ids.includes(1796) ? [...ids, 1796] : ids;
};

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

// ---- production-sized cards -------------------------------------------------------------------------------
// A production room update is 64-130 KB: each card carries offers with long tracking links (JustWatch click URLs,
// ~650 characters), the title analysis (essence, effects), scores, people, tagline and a ~150-character synopsis.
// The fixture gives every title the same, so a local room update weighs what a production one does and the gates
// see its parse and render cost. Deterministic per title.
const ESSENCE = ['High-Octane Sci-Fi Action', 'Military Tech Thriller', 'Visually Spectacular Combat', 'Immersive Sound Design',
  'Futuristic Warfare', 'Blockbuster Entertainment', 'Quiet Character Study', 'Sharp Ensemble Comedy', 'Slow-Burn Mystery Box',
  'Warm Family Adventure', 'Gritty Urban Crime Saga', 'Dreamlike Visual Poetry'];
const SCORE_KEYS = ['adrenaline', 'tension', 'scare', 'violence', 'romance', 'wholesome', 'wonder', 'pathos', 'melancholy',
  'situational_comedy', 'wit_wordplay', 'dark_humor', 'fantasy', 'futuristic', 'crime', 'mystery', 'warfare', 'family_dynamics',
  'psychological', 'slow_burn', 'fast_pace', 'intrigue', 'complexity', 'spectacle', 'cinematography', 'music_composition'];
const NAMES = ['Patrick Hughes', 'Alan Ritchson', 'Stephan James', 'Blake Richardson', 'Greta Lindqvist', 'Omar Haddad',
  'Mei Tanaka', 'Lucía Romero', 'Jonas Becker', 'Priya Natarajan', 'Tomás Oliveira', 'Hana Kowalski'];
/** A tracking link as long as a JustWatch click URL. */
export function offerUrl(serviceId, tmdbId) {
  const payload = Buffer.from(JSON.stringify({ schema: 'iglu:com.example/clickout_context/jsonschema/1-3-2', data: [{ provider: serviceId, monetizationType: 'flatrate', presentationType: '4k', currency: 'EUR', partnerId: 6, providerId: serviceId, clickoutType: 'content-partner-export-api' }, { titleId: tmdbId, objectType: 'movie', entityId: `tm${tmdbId}` }] })).toString('base64url');
  return `https://example.invalid/a?cx=${payload.repeat(2).slice(0, 560)}&r=https%3A%2F%2Fwww.example.invalid%2Ftitle%2F${tmdbId}&uct_country=de`;
}
/**
 * The catalog reads of the card enrichment (continuous-presentation.server.ts readExtras: title rows, credits,
 * people, trailers), answered from the fixture, so the real enrichment code fills each card.
 */
export function extrasQuery(titles) {
  const byId = new Map(titles.map((t) => [t.tmdbId, t]));
  const person = (i) => 7000 + (i % NAMES.length);
  const idsOf = (args) => args.filter((a) => typeof a === 'number');
  return async (sql, args = []) => {
    const ids = idsOf(args).filter((id) => byId.has(id));
    if (/FROM doc\.(movie|show) /.test(sql)) {
      return ids.map((id) => {
        const t = byId.get(id);
        return {
          tmdb_id: id,
          fingerprint_scores: Object.fromEntries(SCORE_KEYS.map((k, j) => [k, ((id * 7 + j * 13) % 100) / 10])),
          essence_tags: Array.from({ length: 6 }, (_, j) => ESSENCE[(id + j * 5) % ESSENCE.length]),
          tagline: 'All grit. No quit.',
          synopsis: `On one last grueling mission, a ${t.genres.join(' and ')} crew must lead the unit in a fight against something no one trained them for, title ${id}.`,
          genres: ['Action', 'Science Fiction', 'Thriller'],
          age_certifications: ['DE_16', 'US_PG-13', 'GB_15'],
          fingerprint_highlight_keys: [SCORE_KEYS[id % SCORE_KEYS.length], SCORE_KEYS[(id + 3) % SCORE_KEYS.length], SCORE_KEYS[(id + 9) % SCORE_KEYS.length]],
          imdb_user_score_original: 5 + (id % 40) / 10,
          rotten_tomatoes_tomato_score_original: 40 + (id % 60),
          rotten_tomatoes_audience_score_original: 30 + (id % 70),
          metacritic_meta_score_original: 35 + (id % 60),
        };
      });
    }
    if (sql.includes('doc.person_worked_on')) return ids.map((id) => ({ media_tmdb_id: id, person_tmdb_id: person(id) }));
    if (sql.includes('doc.person_appeared_in')) return ids.flatMap((id) => [1, 2, 3].map((j) => ({ media_tmdb_id: id, person_tmdb_id: person(id + j) })));
    if (sql.includes('doc.media_video')) return ids.map((id) => ({ media_tmdb_id: id, site_key: `AFuE1L${String(id).padStart(5, '0')}`.slice(0, 11) }));
    if (sql.includes('FROM doc.person ')) return idsOf(args).map((id) => ({ tmdb_id: id, name: NAMES[(id - 7000) % NAMES.length] }));
    return [];
  };
}
