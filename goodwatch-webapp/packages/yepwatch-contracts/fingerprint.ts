export interface FingerprintMeta {
  key: string
  label: string
  description: string
  color: string // rgba
  emoji: string
}

// Helper to build meta
const m = (
  key: string,
  label: string,
  description: string,
  color: string,
  emoji: string,
): FingerprintMeta => ({ key, label, description, color, emoji })

// Mapping covering all CoreScores keys
export const FINGERPRINT_META: Record<string, FingerprintMeta> = {
  // --- Overall similarity (no key) ---
  overall: m(
    "overall",
    "Overall",
    "Similar vibe.",
    "rgba(33, 150, 243, 0.6)",
    "🧬",
  ),
  // --- Core Emotional Palette ---
  adrenaline: m("adrenaline", "Adrenaline", "High-energy, pulse-pounding intensity.", "rgba(255, 99, 71, 0.6)", "⚡"),
  tension: m("tension", "Tension", "Edge-of-your-seat suspense and pressure.", "rgba(255, 87, 34, 0.6)", "😬"),
  scare: m("scare", "Scare", "Frightening moments and scares.", "rgba(183, 28, 28, 0.6)", "👻"),
  violence: m("violence", "Violence", "Physical conflict and intensity.", "rgba(239, 83, 80, 0.6)", "🗡️"),
  romance: m("romance", "Romance", "Love stories and emotional connections.", "rgba(233, 30, 99, 0.6)", "💞"),
  eroticism: m("eroticism", "Eroticism", "Sensual or sexual themes.", "rgba(255, 64, 129, 0.6)", "🔥"),
  wholesome: m("wholesome", "Wholesome", "Heartwarming, uplifting feelings.", "rgba(129, 199, 132, 0.6)", "🌈"),
  wonder: m("wonder", "Wonder", "Awe, discovery, and amazement.", "rgba(33, 150, 243, 0.6)", "✨"),
  pathos: m("pathos", "Pathos", "Deeply moving, empathetic emotion.", "rgba(156, 39, 176, 0.6)", "💔"),
  melancholy: m("melancholy", "Melancholy", "Bittersweet, reflective sadness.", "rgba(121, 85, 72, 0.6)", "🍂"),
  uncanny: m("uncanny", "Uncanny", "Eerie, unsettling strangeness.", "rgba(63, 81, 181, 0.6)", "🕯️"),
  catharsis: m("catharsis", "Catharsis", "Emotional release and payoff.", "rgba(103, 58, 183, 0.6)", "😭"),
  nostalgia: m("nostalgia", "Nostalgia", "Warmth of memory and retro vibes.", "rgba(255, 193, 7, 0.6)", "📼"),

  // --- Humor Palette ---
  situational_comedy: m("situational_comedy", "Situational Comedy", "Humor from everyday scenarios and setups.", "rgba(255, 202, 40, 0.6)", "😂"),
  wit_wordplay: m("wit_wordplay", "Wit & Wordplay", "Clever dialogue and verbal humor.", "rgba(255, 214, 0, 0.6)", "🧠"),
  physical_comedy: m("physical_comedy", "Physical Comedy", "Slapstick and visual gags.", "rgba(255, 238, 88, 0.6)", "🤸"),
  cringe_humor: m("cringe_humor", "Cringe Humor", "Awkward, uncomfortable laughs.", "rgba(255, 167, 38, 0.6)", "😖"),
  absurdist_humor: m("absurdist_humor", "Absurdist Humor", "Surreal, nonsensical comedy.", "rgba(102, 187, 106, 0.6)", "🌀"),
  satire_parody: m("satire_parody", "Satire & Parody", "Sharp critique and playful imitation.", "rgba(29, 233, 182, 0.6)", "🎭"),
  dark_humor: m("dark_humor", "Dark Humor", "Humor from taboo or grim topics.", "rgba(84, 110, 122, 0.6)", "🕳️"),

  // --- Thematic & World-Building ---
  fantasy: m("fantasy", "Fantasy", "Mythic worlds and magical systems.", "rgba(121, 134, 203, 0.6)", "🧙"),
  futuristic: m("futuristic", "Futuristic", "Speculative tech and future worlds.", "rgba(3, 169, 244, 0.6)", "🚀"),
  historical: m("historical", "Historical", "Period settings and real events.", "rgba(93, 64, 55, 0.6)", "🏛️"),
  contemporary_realism: m("contemporary_realism", "Contemporary Realism", "Modern, grounded storytelling.", "rgba(120, 144, 156, 0.6)", "🏙️"),
  crime: m("crime", "Crime", "Heists, investigation, and underworld.", "rgba(183, 28, 28, 0.6)", "🕵️"),
  mystery: m("mystery", "Mystery", "Whodunnits and unraveling secrets.", "rgba(106, 27, 154, 0.6)", "🧩"),
  warfare: m("warfare", "Warfare", "Battles, strategy, and conflict.", "rgba(244, 67, 54, 0.6)", "🎖️"),
  political: m("political", "Politics", "Thought-provoking works exploring political themes.", "rgba(33, 150, 243, 0.6)", "🏛️"),
  sports: m("sports", "Sports", "Competition, training, and teamwork.", "rgba(0, 150, 136, 0.6)", "🏅"),
  biographical: m("biographical", "Biographical", "Lives of notable figures.", "rgba(255, 152, 0, 0.6)", "🧬"),
  coming_of_age: m("coming_of_age", "Coming of Age", "Personal growth and self-discovery.", "rgba(156, 204, 101, 0.6)", "🌱"),
  family_dynamics: m("family_dynamics", "Family Dynamics", "Relationships and generational ties.", "rgba(255, 183, 77, 0.6)", "👨‍👩‍👧‍👦"),
  psychological: m("psychological", "Psychological", "Inner worlds and mind games.", "rgba(63, 81, 181, 0.6)", "🧠"),
  showbiz: m("showbiz", "Showbiz", "Entertainment industry and performance.", "rgba(171, 71, 188, 0.6)", "🎬"),
  gaming: m("gaming", "Gaming", "Video games and game culture.", "rgba(0, 188, 212, 0.6)", "🎮"),
  pop_culture: m("pop_culture", "Pop Culture", "References and cultural commentary.", "rgba(255, 235, 59, 0.6)", "📰"),
  social_commentary: m("social_commentary", "Social Commentary", "Perspectives on society and norms.", "rgba(76, 175, 80, 0.6)", "🗣️"),
  class_and_capitalism: m("class_and_capitalism", "Class & Capitalism", "Wealth, power, and inequality.", "rgba(205, 220, 57, 0.6)", "💰"),
  technology_and_humanity: m("technology_and_humanity", "Tech & Humanity", "Human stories in a tech world.", "rgba(0, 188, 212, 0.6)", "🤖"),
  spiritual: m("spiritual", "Spiritual", "Faith, meaning, and transcendence.", "rgba(121, 85, 72, 0.6)", "🕊️"),

  // --- Cognitive & Structural ---
  narrative_structure: m("narrative_structure", "Narrative Structure", "Story architecture and form.", "rgba(66, 165, 245, 0.6)", "🏗️"),
  dialogue_quality: m("dialogue_quality", "Dialogue Quality", "Sharp writing and memorable lines.", "rgba(100, 181, 246, 0.6)", "💬"),
  character_depth: m("character_depth", "Character Depth", "Rich, complex characterization.", "rgba(77, 182, 172, 0.6)", "🧩"),
  slow_burn: m("slow_burn", "Slow Burn", "Gradual build with payoff.", "rgba(120, 144, 156, 0.6)", "🕯️"),
  fast_pace: m("fast_pace", "Fast Pace", "Quick tempo and momentum.", "rgba(255, 138, 101, 0.6)", "🏎️"),
  intrigue: m("intrigue", "Intrigue", "Curiosity and investigative pull.", "rgba(149, 117, 205, 0.6)", "🕵️"),
  complexity: m("complexity", "Complexity", "Layered plots and ideas.", "rgba(126, 87, 194, 0.6)", "🧠"),
  rewatchability: m("rewatchability", "Rewatchability", "Invites repeat viewing.", "rgba(0, 150, 136, 0.6)", "🔁"),
  hopefulness: m("hopefulness", "Hopefulness", "Optimism and uplifting resolve.", "rgba(129, 199, 132, 0.6)", "🌤️"),
  bleakness: m("bleakness", "Bleakness", "Grim, stark outlooks.", "rgba(120, 144, 156, 0.6)", "🌫️"),
  ambiguity: m("ambiguity", "Ambiguity", "Open-endedness and uncertainty.", "rgba(158, 158, 158, 0.6)", "❓"),
  novelty: m("novelty", "Novelty", "Fresh ideas and invention.", "rgba(0, 229, 255, 0.6)", "✨"),
  homage_and_reference: m("homage_and_reference", "Homage & Reference", "Allusions to other works.", "rgba(255, 241, 118, 0.6)", "🖼️"),
  non_linear_narrative: m("non_linear_narrative", "Non-linear Narrative", "Time-shifts and structure play.", "rgba(3, 155, 229, 0.6)", "🕰️"),
  meta_narrative: m("meta_narrative", "Meta Narrative", "Stories about storytelling.", "rgba(0, 188, 212, 0.6)", "🪞"),
  surrealism: m("surrealism", "Surrealism", "Dreamlike, bizarre imagery.", "rgba(186, 104, 200, 0.6)", "🌀"),
  eccentricity: m("eccentricity", "Eccentricity", "Oddball tone and quirks.", "rgba(244, 143, 177, 0.6)", "🎩"),
  philosophical: m("philosophical", "Philosophical", "Ideas about life and existence.", "rgba(156, 204, 101, 0.6)", "🧘"),
  educational: m("educational", "Educational", "Informative and instructive.", "rgba(0, 191, 165, 0.6)", "📚"),

  // --- Aesthetic & Production ---
  direction: m("direction", "Direction", "Vision and command behind the camera.", "rgba(103, 58, 183, 0.6)", "🎬"),
  acting: m("acting", "Acting", "Performance craft and presence.", "rgba(81, 45, 168, 0.6)", "🎭"),
  cinematography: m("cinematography", "Cinematography", "Visual composition and camera work.", "rgba(63, 81, 181, 0.6)", "🎥"),
  editing: m("editing", "Editing", "Pacing and structure through cuts.", "rgba(33, 150, 243, 0.6)", "✂️"),
  music_composition: m("music_composition", "Music Composition", "Score and musical identity.", "rgba(0, 172, 193, 0.6)", "🎼"),
  world_immersion: m("world_immersion", "World Immersion", "Depth and sensory richness of setting.", "rgba(76, 175, 80, 0.6)", "🌍"),
  spectacle: m("spectacle", "Spectacle", "Scale and set-piece grandeur.", "rgba(255, 82, 82, 0.6)", "🎆"),
  visual_stylization: m("visual_stylization", "Visual Stylization", "Distinctive aesthetic signature.", "rgba(244, 143, 177, 0.6)", "🎨"),
  pastiche: m("pastiche", "Pastiche", "Playful imitation of styles.", "rgba(255, 202, 40, 0.6)", "🧩"),
  psychedelic: m("psychedelic", "Psychedelic", "Mind-bending, trippy visuals.", "rgba(186, 104, 200, 0.6)", "🌈"),
  grotesque: m("grotesque", "Grotesque", "Macabre, distorted imagery.", "rgba(121, 85, 72, 0.6)", "🧟"),
  camp_and_irony: m("camp_and_irony", "Camp & Irony", "Stylized exaggeration and wink.", "rgba(255, 171, 145, 0.6)", "💅"),
  dialogue_centrality: m("dialogue_centrality", "Dialogue Centrality", "Stories driven by conversation.", "rgba(66, 165, 245, 0.6)", "🗣️"),
  music_centrality: m("music_centrality", "Music Centrality", "The score or soundtrack shapes the emotional experience.", "rgba(0, 188, 212, 0.6)", "🎵"),
  sound_centrality: m("sound_centrality", "Sound Centrality", "Sound design as core element.", "rgba(129, 212, 250, 0.6)", "🔊"),
}

export function getFingerprintMeta(key: string): FingerprintMeta {
  const meta = FINGERPRINT_META[key]
  if (meta) return meta
  // Fallback formatting
  const label = key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
  return m(key, label, "", "rgba(158, 158, 158, 0.6)", "🏷️")
}
