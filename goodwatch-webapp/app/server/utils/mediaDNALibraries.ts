import type { TraitRule, HighlightRule } from "./mediaDNA"

/**
 * =============================================================================
 * LEVEL 1: GENRE BLEND LIBRARY (PURGED OF THEMATIC GUESSES)
 * =============================================================================
 */
export const GENRE_BLEND_LIBRARY: TraitRule[] = [
    { id: 'action_comedy', name: 'Action Comedy', description: "High-energy action sequences paired with laugh-out-loud humor.", condition: s => s.adrenaline > 7 && s.wit_wordplay > 7, matchedScoreKeys: ['adrenaline', 'wit_wordplay']},
    { id: 'action_thriller', name: 'Action Thriller', description: "Combines high-stakes physical action with suspenseful, tense situations.", condition: s => s.adrenaline > 7 && s.tension > 7 && s.fast_pace > 7, matchedScoreKeys: ['adrenaline', 'tension', 'fast_pace']},
    { id: 'action_drama', name: 'Action Drama', description: "Focuses on the emotional and personal consequences of high-stakes action.", condition: s => s.adrenaline > 7 && s.pathos > 7 && s.character_depth > 6, matchedScoreKeys: ['adrenaline', 'pathos', 'character_depth']},
    { id: 'romantic_comedy', name: 'Romantic Comedy', description: "A heartwarming love story that's also full of witty and funny moments.", condition: s => s.romance > 7 && s.wholesome > 6 && ((s.wit_wordplay + s.situational_comedy)/2 > 6), matchedScoreKeys: ['romance', 'wholesome', 'wit_wordplay']},
    { id: 'romantic_drama', name: 'Romantic Drama', description: "An emotional love story focused on character relationships and high stakes.", condition: s => s.romance > 7 && s.pathos > 7 && s.character_depth > 6, matchedScoreKeys: ['romance', 'pathos', 'character_depth']},
    { id: 'sci_fi_horror', name: 'Sci-Fi Horror', description: "Horror and suspense driven by futuristic technology, aliens, or scientific experiments gone wrong.", condition: s => s.futuristic > 7 && s.scare > 7 && s.uncanny > 6, matchedScoreKeys: ['futuristic', 'scare', 'uncanny']},
    { id: 'sci_fi_drama', name: 'Sci-Fi Drama', description: "Uses a futuristic setting to explore deep, human, and emotional conflicts.", condition: s => s.futuristic > 7 && s.pathos > 7 && s.technology_and_humanity > 7, matchedScoreKeys: ['futuristic', 'pathos', 'technology_and_humanity']},
    { id: 'sci_fi_action', name: 'Sci-Fi Action', description: "Thrilling action sequences featuring advanced technology, space battles, or future warfare.", condition: s => s.futuristic > 7 && s.adrenaline > 7 && s.spectacle > 7, matchedScoreKeys: ['futuristic', 'adrenaline', 'spectacle']},
    { id: 'sci_fi_thriller', name: 'Sci-Fi Thriller', description: "A suspenseful story where future technology creates high-stakes tension.", condition: s => s.futuristic > 7 && s.tension > 7 && s.intrigue > 7, matchedScoreKeys: ['futuristic', 'tension', 'intrigue']},
    { id: 'sci_fi_mystery', name: 'Sci-Fi Mystery', description: "A puzzle to be solved in a futuristic world, often involving advanced technology.", condition: s => s.futuristic > 7 && s.mystery > 7 && s.complexity > 7, matchedScoreKeys: ['futuristic', 'mystery', 'complexity']},
    { id: 'fantasy_action', name: 'Fantasy Action', description: "Epic battles and thrilling action set in a world of magic and mythical creatures.", condition: s => s.fantasy > 7 && s.adrenaline > 7 && s.spectacle > 6, matchedScoreKeys: ['fantasy', 'adrenaline', 'spectacle']},
    { id: 'fantasy_romance', name: 'Fantasy Romance', description: "A love story unfolding in a world filled with magic, myth, and wonder.", condition: s => s.fantasy > 7 && s.romance > 7 && s.wonder > 7, matchedScoreKeys: ['fantasy', 'romance', 'wonder']},
    { id: 'fantasy_drama', name: 'Fantasy Drama', description: "Focuses on the emotional and political conflicts within a magical or mythical world.", condition: s => s.fantasy > 7 && s.pathos > 7 && s.character_depth > 7, matchedScoreKeys: ['fantasy', 'pathos', 'character_depth']},
    { id: 'fantasy_comedy', name: 'Fantasy Comedy', description: "Humor derived from magical situations, mythical creatures, or epic quests gone wrong.", condition: s => s.fantasy > 7 && s.wit_wordplay > 7, matchedScoreKeys: ['fantasy', 'wit_wordplay']},
    { id: 'dark_fantasy', name: 'Dark Fantasy', description: "A gritty, mature, and often bleak take on the fantasy genre.", condition: s => s.fantasy > 7 && s.bleakness > 7 && s.violence > 6, matchedScoreKeys: ['fantasy', 'bleakness', 'violence']},
    { id: 'horror_comedy', name: 'Horror Comedy', description: "Blends scares and suspense with morbid or situational humor.", condition: s => s.scare > 7 && s.dark_humor > 6 && s.violence < 8, matchedScoreKeys: ['scare', 'dark_humor']},
    { id: 'psychological_thriller', name: 'Psychological Thriller', description: "A suspenseful story that plays with the minds of both the characters and the audience.", condition: s => s.psychological > 7 && s.tension > 7 && s.ambiguity > 6, matchedScoreKeys: ['psychological', 'tension', 'ambiguity']},
    { id: 'psychological_horror', name: 'Psychological Horror', description: 'Generates fear from mental and emotional states rather than explicit gore.', condition: s => s.psychological > 7 && s.scare > 7 && s.uncanny > 7, matchedScoreKeys: ['psychological', 'scare', 'uncanny']},
    { id: 'psychological_drama', name: 'Psychological Drama', description: "An intense, serious story focused on the inner lives and mental states of its characters.", condition: s => s.psychological > 7 && s.pathos > 7 && s.character_depth > 7, matchedScoreKeys: ['psychological', 'pathos', 'character_depth']},
    { id: 'crime_mystery', name: 'Crime Mystery', description: "Follows the investigation of a central crime, challenging viewers to solve the puzzle.", condition: s => s.crime > 7 && s.mystery > 7 && s.intrigue > 7, matchedScoreKeys: ['crime', 'mystery', 'intrigue']},
    { id: 'crime_thriller', name: 'Crime Thriller', description: "A suspenseful story about criminal acts, investigation, and high-stakes conflict.", condition: s => s.crime > 7 && s.tension > 7 && s.violence > 6, matchedScoreKeys: ['crime', 'tension', 'violence']},
    { id: 'crime_drama', name: 'Crime Drama', description: "Focuses on the personal lives and moral conflicts of those within the criminal justice system.", condition: s => s.crime > 7 && s.pathos > 7 && s.character_depth > 7, matchedScoreKeys: ['crime', 'pathos', 'character_depth']},
    { id: 'crime_comedy', name: 'Crime Comedy', description: 'Finds humor in criminal activities, incompetent law enforcement, or bizarre heists.', condition: s => s.crime > 7 && s.dark_humor > 6 && s.wit_wordplay > 6, matchedScoreKeys: ['crime', 'dark_humor', 'wit_wordplay']},
    { id: 'historical_drama', name: 'Historical Drama', description: "A dramatic story centered on real events and people from a specific period in the past.", condition: s => s.historical > 7 && s.pathos > 7 && s.biographical > 6, matchedScoreKeys: ['historical', 'pathos', 'biographical']},
    { id: 'historical_action', name: 'Historical Action', description: "Action and warfare set in a specific, real-world past era.", condition: s => s.historical > 7 && s.warfare > 7 && s.spectacle > 7, matchedScoreKeys: ['historical', 'warfare', 'spectacle']},
    { id: 'historical_romance', name: 'Historical Romance', description: 'A love story set against the backdrop of a specific historical period.', condition: s => s.historical > 7 && s.romance > 7 && s.pathos > 6, matchedScoreKeys: ['historical', 'romance', 'pathos']},
    { id: 'family_drama', name: 'Family Drama', description: "Focuses on the complex relationships, conflicts, and bonds within a family.", condition: s => s.family_dynamics > 7 && s.pathos > 7 && s.dialogue_centrality > 7, matchedScoreKeys: ['family_dynamics', 'pathos', 'dialogue_centrality']},
    { id: 'family_comedy', name: 'Family Comedy', description: "A lighthearted and funny story about family life and relationships.", condition: s => s.family_dynamics > 7 && s.situational_comedy > 7 && s.wholesome > 6, matchedScoreKeys: ['family_dynamics', 'situational_comedy', 'wholesome']},
    { id: 'political_thriller', name: 'Political Thriller', description: "A suspenseful story of political intrigue, conspiracies, and power struggles.", condition: s => s.political > 7 && s.tension > 7 && s.complexity > 7, matchedScoreKeys: ['political', 'tension', 'complexity']},
    { id: 'political_drama', name: 'Political Drama', description: "A serious look at governance, power, and the people who wield it.", condition: s => s.political > 7 && s.pathos > 7 && s.dialogue_quality > 8, matchedScoreKeys: ['political', 'pathos', 'dialogue_quality']},
    { id: 'political_satire', name: 'Political Satire', description: 'Uses sharp, ironic humor to critique political figures, systems, and events.', condition: s => s.political > 7 && s.satire_parody > 7 && s.wit_wordplay > 7, matchedScoreKeys: ['political', 'satire_parody', 'wit_wordplay']},
    { id: 'sports_drama', name: 'Sports Drama', description: "An emotional story centered on the challenges, triumphs, and personal lives of athletes.", condition: s => s.sports > 7 && s.pathos > 7 && s.catharsis > 6, matchedScoreKeys: ['sports', 'pathos', 'catharsis']},
    { id: 'sports_comedy', name: 'Sports Comedy', description: 'Finds humor in the world of sports, from underdog teams to rivalries.', condition: s => s.sports > 7 && s.situational_comedy > 7 && s.wholesome > 6, matchedScoreKeys: ['sports', 'situational_comedy', 'wholesome']},
    { id: 'supernatural_thriller', name: 'Supernatural Thriller', description: "Generates suspense and tension from ghosts, magic, or other paranormal events.", condition: s => s.fantasy > 7 && s.tension > 7 && s.scare > 6, matchedScoreKeys: ['fantasy', 'tension', 'scare']},
    { id: 'supernatural_horror', name: 'Supernatural Horror', description: 'A horror story driven by ghosts, demons, or other paranormal forces.', condition: s => s.fantasy > 7 && s.scare > 8 && s.bleakness > 6, matchedScoreKeys: ['fantasy', 'scare', 'bleakness']},
    { id: 'coming_of_age_drama', name: 'Coming-of-Age Drama', description: 'A serious, emotional story about a character\'s transition from youth to adulthood.', condition: s => s.coming_of_age > 7 && s.pathos > 7, matchedScoreKeys: ['coming_of_age', 'pathos']},
    { id: 'coming_of_age_comedy', name: 'Coming-of-Age Comedy', description: 'A funny and often heartwarming story about the awkwardness of growing up.', condition: s => s.coming_of_age > 7 && s.cringe_humor > 6 && s.wholesome > 6, matchedScoreKeys: ['coming_of_age', 'cringe_humor', 'wholesome']},
    { id: 'satirical_comedy', name: 'Satirical Comedy', description: 'A comedy that uses sharp wit and irony to critique aspects of society.', condition: s => s.satire_parody > 7 && s.social_commentary > 7, matchedScoreKeys: ['satire_parody', 'social_commentary']},
    { id: 'showbiz_drama', name: 'Showbiz Drama', description: 'A dramatic look behind the scenes of the entertainment industry.', condition: s => s.showbiz > 7 && s.pathos > 7, matchedScoreKeys: ['showbiz', 'pathos']},
    { id: 'showbiz_comedy', name: 'Showbiz Comedy', description: 'A funny take on the absurdity of Hollywood, stardom, and the entertainment world.', condition: s => s.showbiz > 7 && s.satire_parody > 7, matchedScoreKeys: ['showbiz', 'satire_parody']},
    { id: 'war_drama', name: 'War Drama', description: 'Focuses on the human and emotional cost of military conflict.', condition: s => s.warfare > 7 && s.pathos > 8, matchedScoreKeys: ['warfare', 'pathos']},
    { id: 'contemporary_drama', name: 'Contemporary Drama', description: 'A serious story focused on believable characters and situations in the modern world.', condition: s => s.contemporary_realism > 8 && s.pathos > 7, matchedScoreKeys: ['contemporary_realism', 'pathos']},
    { id: 'biographical_drama', name: 'Biographical Drama', description: 'The dramatic retelling of the life of a real, notable person.', condition: s => s.biographical > 8 && s.historical > 7, matchedScoreKeys: ['biographical', 'historical']},
    { id: 'gaming_adventure', name: 'Gaming Adventure', description: 'An adventure story centered on video games, virtual reality, or gamer culture.', condition: s => s.gaming > 7 && s.adrenaline > 7, matchedScoreKeys: ['gaming', 'adrenaline']},
    { id: 'absurdist_comedy', name: 'Absurdist Comedy', description: 'A bizarre, surreal, and nonsensical comedy that defies logic.', condition: s => s.absurdist_humor > 7 && s.eccentricity > 7, matchedScoreKeys: ['absurdist_humor', 'eccentricity']},
    { id: 'erotic_thriller', name: 'Erotic Thriller', description: 'A suspenseful plot where sexual tension and sensual content are central to the story.', condition: s => s.eroticism > 7 && s.tension > 7, matchedScoreKeys: ['eroticism', 'tension']},
    { id: 'erotic_drama', name: 'Erotic Drama', description: 'An emotional, character-focused story where sexuality and sensuality are central themes.', condition: s => s.eroticism > 7 && s.pathos > 7, matchedScoreKeys: ['eroticism', 'pathos']},
    { id: 'spiritual_drama', name: 'Spiritual Drama', description: 'An emotional story that explores themes of faith, religion, or metaphysical concepts.', condition: s => s.spiritual > 7 && s.pathos > 7, matchedScoreKeys: ['spiritual', 'pathos']},
    { id: 'docudrama', name: 'Docudrama', description: 'A dramatized retelling of factual events, blending documentary style with narrative filmmaking.', condition: s => s.biographical > 7 && s.educational > 7, matchedScoreKeys: ['biographical', 'educational']},
    { id: 'mockumentary', name: 'Mockumentary', description: 'A comedy that uses the style of a documentary to parody its subject.', condition: s => s.satire_parody > 7 && s.situational_comedy > 7, matchedScoreKeys: ['satire_parody', 'situational_comedy']},
    { id: 'neo_noir', name: 'Neo-Noir', description: 'A modern take on the classic crime noir, often featuring a bleak worldview, complex mysteries, and moral ambiguity.', condition: s => s.crime > 7 && s.bleakness > 7 && s.ambiguity > 7, matchedScoreKeys: ['crime', 'bleakness', 'ambiguity']},
    { id: 'heist_movie', name: 'Heist Movie', description: 'A story focused on the planning, execution, and aftermath of a major robbery.', condition: s => s.crime > 7 && s.intrigue > 8 && s.complexity > 7, matchedScoreKeys: ['crime', 'intrigue', 'complexity']},
    { id: 'courtroom_drama', name: 'Courtroom Drama', description: 'A drama where the central conflict plays out within the legal system and a courtroom.', condition: s => s.crime > 7 && s.dialogue_centrality > 8 && s.intrigue > 7, matchedScoreKeys: ['crime', 'dialogue_centrality', 'intrigue']},
    { id: 'dystopian_future', name: 'Dystopian Future', description: 'A story set in a bleak, oppressive future society.', condition: s => s.futuristic > 7 && s.bleakness > 8 && s.social_commentary > 7, matchedScoreKeys: ['futuristic', 'bleakness', 'social_commentary']},
    { id: 'space_opera', name: 'Space Opera', description: 'A grand, adventurous story of romance and conflict set primarily in outer space.', condition: s => s.futuristic > 7 && s.spectacle > 8 && s.romance > 6, matchedScoreKeys: ['futuristic', 'spectacle', 'romance']},
    { id: 'whodunit_mystery', name: 'Whodunit Mystery', description: 'A classic mystery format where the audience is challenged to identify the culprit among a group of suspects.', condition: s => s.mystery > 8 && s.intrigue > 8 && s.complexity > 7, matchedScoreKeys: ['mystery', 'intrigue']},
    { id: 'found_footage', name: 'Found Footage', description: 'The story is presented as discovered video recordings, creating a sense of realism and immediacy.', condition: s => s.contemporary_realism > 8 && s.tension > 8 && s.cinematography < 5, matchedScoreKeys: ['contemporary_realism', 'tension']},
];

/**
 * =============================================================================
 * LEVEL 2: HIGHLIGHT LIBRARY (80 ENTRIES WITH DEPENDENCIES)
 * =============================================================================
 */
export const HIGHLIGHT_LIBRARY: HighlightRule[] = [
    // --- Aesthetic & Production Highlights ---
    { id: 'visual_feast', name: 'Visual Feast', icon: '🎇', description: 'A feast for the eyes with stunning visuals, big action, and incredible scenery.', condition: s => s.spectacle > 9 && s.cinematography > 9 && s.world_immersion > 9, matchedScoreKeys: ['spectacle', 'cinematography', 'world_immersion'] },
    { id: 'masterful_acting', name: 'Masterful Acting', icon: '🌟', description: 'Features powerhouse, award-worthy performances from the cast.', condition: s => s.acting > 9, matchedScoreKeys: ['acting'] },
    { id: 'visionary_direction', name: 'Visionary Direction', icon: '🎥', description: 'The director\'s unique creative vision is powerfully and clearly executed.', condition: s => s.direction > 9 && s.visual_stylization > 8, matchedScoreKeys: ['direction', 'visual_stylization'] },
    { id: 'seamless_editing', name: 'Seamless Editing', icon: '✂️', description: 'The pacing, rhythm, and flow of the story are assembled flawlessly.', condition: s => s.editing > 9, matchedScoreKeys: ['editing'] },
    { id: 'amazing_soundtrack', name: 'Amazing Soundtrack', icon: '🎵', description: 'The original score or licensed music is essential to the story and emotional impact.', condition: s => s.music_centrality > 9 && s.music_composition > 9, matchedScoreKeys: ['music_centrality', 'music_composition'] },
    { id: 'immersive_sound_design', name: 'Immersive Sound Design', icon: '🔊', description: 'Creates a rich and convincing atmosphere through detailed, non-musical sound.', condition: s => s.sound_centrality > 9 && s.world_immersion > 8, matchedScoreKeys: ['sound_centrality', 'world_immersion'] },
    { id: 'epic_fantasy_world', name: 'Epic Fantasy World', icon: '🐉', description: 'Builds a detailed, convincing world of magic and myth that you can get lost in.', condition: s => s.fantasy > 9 && s.world_immersion > 9, requiredGenreBlends: ['fantasy_action', 'fantasy_drama', 'dark_fantasy'], matchedScoreKeys: ['fantasy', 'world_immersion'] },
    { id: 'unique_visual_style', name: 'Unique Visual Style', icon: '🎨', description: 'Characterized by a distinct, non-realistic, and memorable visual or auditory style.', condition: s => s.visual_stylization > 9 && s.novelty > 8, matchedScoreKeys: ['visual_stylization', 'novelty'] },
    { id: 'retro_style', name: 'Retro Style', icon: '🖼️', description: 'Copies the look and feel of a different time period or an older style of art.', condition: s => s.pastiche > 9 && s.homage_and_reference > 8, matchedScoreKeys: ['pastiche', 'homage_and_reference'] },
    { id: 'trippy_visuals', name: 'Trippy Visuals', icon: '🌀', description: 'Hallucination-like visuals with distorted, swirling, and super-vibrant images.', condition: s => s.psychedelic > 9 && s.surrealism > 8, matchedScoreKeys: ['psychedelic', 'surrealism'] },
    { id: 'stunning_costume_design', name: 'Stunning Costume Design', icon: '👗', description: 'The costumes are exceptionally detailed, creative, and vital to the storytelling.', condition: s => s.world_immersion > 8 && s.cinematography > 8, requiredGenreBlends: ['historical_drama', 'historical_romance', 'fantasy_action', 'sci_fi_drama'], matchedScoreKeys: ['world_immersion', 'cinematography']},
    { id: 'epic_battle_sequence', name: 'Epic Battle Sequence', icon: '⚔️', description: 'Features large-scale, masterfully choreographed, and visually spectacular battle scenes.', condition: s => s.warfare > 9 && s.spectacle > 9, requiredGenreBlends: ['historical_action', 'fantasy_action', 'sci_fi_action', 'war_drama'], matchedScoreKeys: ['warfare', 'spectacle']},
    { id: 'breathtaking_landscapes', name: 'Breathtaking Landscapes', icon: '🏞️', description: 'The cinematography showcases stunning, awe-inspiring natural or fictional landscapes.', condition: s => s.cinematography > 9 && s.spectacle > 8 && s.world_immersion > 8, matchedScoreKeys: ['cinematography', 'spectacle']},
    { id: 'claustrophobic_atmosphere', name: 'Claustrophobic Atmosphere', icon: '🚪', description: 'Expertly creates a feeling of being trapped, confined, and under pressure.', condition: s => s.tension > 9 && s.world_immersion > 8, requiredGenreBlends: ['psychological_thriller', 'sci_fi_horror', 'supernatural_thriller'], matchedScoreKeys: ['tension', 'world_immersion']},
    { id: 'gorgeous_animation', name: 'Gorgeous Animation', icon: '✍️', description: 'The quality of the animation itself is a primary highlight, showcasing incredible artistry.', condition: s => s.visual_stylization > 9 && s.cinematography > 8, matchedScoreKeys: ['visual_stylization', 'cinematography']},
    
    // --- Cognitive & Structural Highlights ---
    { id: 'character_study', name: 'Character Study', icon: '🎭', description: 'Focuses deeply on a character\'s mind, feelings, and personal growth.', condition: s => s.character_depth > 9 && s.psychological > 8 && s.dialogue_centrality > 8, requiredGenreBlends: ['psychological_drama', 'family_drama', 'biographical_drama', 'contemporary_drama'], matchedScoreKeys: ['character_depth', 'psychological'] },
    { id: 'puzzle_box', name: 'Puzzle Box', icon: '🧠', description: 'A complex story that makes you think hard and piece clues together.', condition: s => s.complexity > 9 && s.intrigue > 9 && s.ambiguity > 8, requiredGenreBlends: ['psychological_thriller', 'crime_mystery', 'sci_fi_drama', 'sci_fi_mystery'], matchedScoreKeys: ['complexity', 'intrigue', 'ambiguity'] },
    { id: 'great_storytelling', name: 'Great Storytelling', icon: '✒️', description: 'Features excellent writing with a strong plot, great pacing, and a satisfying story.', condition: s => s.narrative_structure > 9 && s.dialogue_quality > 9, matchedScoreKeys: ['narrative_structure', 'dialogue_quality'] },
    { id: 'makes_you_think', name: 'Makes You Think', icon: '🤔', description: 'Asks big questions about life, humanity, or the universe.', condition: s => s.philosophical > 9 && s.complexity > 8 && s.dialogue_quality > 8, requiredGenreBlends: ['sci_fi_drama', 'political_drama', 'spiritual_drama'], matchedScoreKeys: ['philosophical', 'complexity'] },
    { id: 'witty_and_smart', name: 'Witty & Smart', icon: '💬', description: 'Full of smart jokes, quick comebacks, and funny conversations.', condition: s => s.wit_wordplay > 9 && s.dialogue_quality > 9 && s.physical_comedy < 5, requiredGenreBlends: ['romantic_comedy', 'action_comedy', 'satirical_comedy', 'mockumentary'], matchedScoreKeys: ['wit_wordplay', 'dialogue_quality'] },
    { id: 'slow_burn_tension', name: 'Slow Burn Tension', icon: '⏳', description: 'Expertly builds suspense and atmosphere gradually towards a powerful climax.', condition: s => s.slow_burn > 9 && s.tension > 8 && s.fast_pace < 4, requiredGenreBlends: ['psychological_thriller', 'crime_thriller', 'neo_noir'], matchedScoreKeys: ['slow_burn', 'tension'] },
    { id: 'fast_paced_thrills', name: 'Fast-Paced Thrills', icon: '⚡', description: 'A narrative that moves at a breakneck speed with rapid plot progression.', condition: s => s.fast_pace > 9 && s.adrenaline > 8 && s.slow_burn < 4, requiredGenreBlends: ['action_thriller', 'action_comedy'], matchedScoreKeys: ['fast_pace', 'adrenaline'] },
    { id: 'highly_rewatchable', name: 'Highly Rewatchable', icon: '🔁', description: 'So good you\'ll want to watch it again, finding new details each time.', condition: s => s.rewatchability > 9 && s.complexity > 7, matchedScoreKeys: ['rewatchability'] },
    { id: 'truly_original', name: 'Truly Original', icon: '💡', description: 'Presents a concept or execution so unique it feels completely new.', condition: s => s.novelty > 9, matchedScoreKeys: ['novelty'] },
    { id: 'non_linear_story', name: 'Non-Linear Story', icon: '🔄', description: 'Tells its story out of chronological order, revealing information in a unique way.', condition: s => s.non_linear_narrative > 9 && s.narrative_structure > 8, matchedScoreKeys: ['non_linear_narrative'] },
    { id: 'ensemble_cast', name: 'Ensemble Cast', icon: '👥', description: 'Juggles a large cast of characters, giving each a meaningful role in the story.', condition: s => s.complexity > 8 && s.character_depth > 8 && s.family_dynamics > 7, requiredGenreBlends: ['family_drama', 'family_comedy', 'political_drama'], matchedScoreKeys: ['complexity', 'character_depth']},
    { id: 'meta_commentary', name: 'Meta Commentary', icon: '🗣️', description: 'A story that is self-aware, breaking the fourth wall or commenting on its own genre.', condition: s => s.meta_narrative > 9, requiredGenreBlends: ['satirical_comedy', 'mockumentary'], matchedScoreKeys: ['meta_narrative']},
    { id: 'ambiguous_ending', name: 'Ambiguous Ending', icon: '❓', description: 'The story deliberately leaves key elements open to interpretation.', condition: s => s.ambiguity > 9 && s.catharsis < 5, matchedScoreKeys: ['ambiguity']},
    { id: 'educational_and_engaging', name: 'Educational & Engaging', icon: '🎓', description: 'Teaches factual knowledge about a topic in an entertaining and memorable way.', condition: s => s.educational > 9, requiredGenreBlends: ['docudrama', 'biographical_drama'], matchedScoreKeys: ['educational']},
    { id: 'dialogue_driven', name: 'Dialogue-Driven', icon: '🗣️', description: 'The story is primarily advanced through sharp, masterfully written conversations.', condition: s => s.dialogue_centrality > 9 && s.dialogue_quality > 9, requiredGenreBlends: ['political_drama', 'courtroom_drama', 'contemporary_drama'], matchedScoreKeys: ['dialogue_centrality', 'dialogue_quality']},

    // --- Emotional Highlights ---
    { id: 'real_tearjerker', name: 'Real Tearjerker', icon: '😭', description: 'A deeply sad story exploring loss and suffering. You might need tissues.', condition: s => s.pathos > 9 && s.melancholy > 8 && s.character_depth > 8, requiredGenreBlends: ['romantic_drama', 'family_drama', 'war_drama', 'action_drama'], matchedScoreKeys: ['pathos', 'melancholy'] },
    { id: 'nail_biting_thriller', name: 'Nail-Biting Thriller', icon: '🎢', description: 'A high-energy ride full of suspense and action that keeps you guessing.', condition: s => s.adrenaline > 9 && s.tension > 9 && s.intrigue > 8, requiredGenreBlends: ['action_thriller', 'political_thriller', 'crime_thriller', 'sci_fi_thriller'], matchedScoreKeys: ['adrenaline', 'tension'] },
    { id: 'pure_comfort', name: 'Pure Comfort', icon: '🥰', description: 'An exceptionally warm, positive, and reassuring story that feels like a hug.', condition: s => s.wholesome > 9 && s.hopefulness > 8 && s.bleakness < 3, requiredGenreBlends: ['romantic_comedy', 'family_comedy', 'coming_of_age_comedy'], matchedScoreKeys: ['wholesome', 'hopefulness'] },
    { id: 'intense_and_violent', name: 'Intense & Violent', icon: '🩸', description: 'Features a high degree of visceral, impactful, and graphic physical conflict.', condition: s => s.violence > 9 && s.adrenaline > 8, requiredGenreBlends: ['action_thriller', 'war_drama', 'crime_thriller', 'dark_fantasy'], matchedScoreKeys: ['violence'] },
    { id: 'deeply_romantic', name: 'Deeply Romantic', icon: '❤️‍🔥', description: 'A powerful love story with exceptional chemistry and emotional depth.', condition: s => s.romance > 9 && s.pathos > 8 && s.character_depth > 8, requiredGenreBlends: ['romantic_drama', 'fantasy_romance', 'historical_romance'], matchedScoreKeys: ['romance', 'pathos'] },
    { id: 'sense_of_wonder', name: 'Sense of Wonder', icon: '✨', description: 'Evokes a powerful sense of awe and amazement at the magical, sublime, or grand.', condition: s => s.wonder > 9, requiredGenreBlends: ['sci_fi_drama', 'fantasy_romance', 'spiritual_drama'], matchedScoreKeys: ['wonder'] },
    { id: 'hopeful_outlook', name: 'Hopeful Outlook', icon: '☀️', description: 'A narrative with a powerfully positive and optimistic message, even in the face of hardship.', condition: s => s.hopefulness > 9 && s.bleakness < 3, matchedScoreKeys: ['hopefulness'] },
    { id: 'bleak_worldview', name: 'Bleak Worldview', icon: '', description: 'A narrative with a deeply pessimistic, nihilistic, or tragic perspective on its subject.', condition: s => s.bleakness > 9 && s.hopefulness < 3, requiredGenreBlends: ['dark_fantasy', 'war_drama', 'neo_noir', 'dystopian_future'], matchedScoreKeys: ['bleakness'] },
    { id: 'powerful_release', name: 'Powerful Release', icon: '😌', description: 'Provides a powerful feeling of emotional release or closure after an intense journey.', condition: s => s.catharsis > 9, matchedScoreKeys: ['catharsis'] },
    { id: 'lingering_sadness', name: 'Lingering Sadness', icon: '💧', description: 'Leaves you with a lasting, beautifully melancholic, and pensive feeling.', condition: s => s.melancholy > 9, matchedScoreKeys: ['melancholy'] },
    { id: 'steamy_and_sensual', name: 'Steamy & Sensual', icon: '🌶️', description: 'Features a strong focus on eroticism, sensuality, and sexual tension.', condition: s => s.eroticism > 9, requiredGenreBlends: ['erotic_thriller', 'erotic_drama', 'romantic_drama'], matchedScoreKeys: ['eroticism']},
    { id: 'feel_good_fun', name: 'Feel-Good Fun', icon: '😄', description: 'An overwhelmingly fun and positive experience designed to make you happy.', condition: s => s.wholesome > 8 && s.hopefulness > 8, requiredGenreBlends: ['family_comedy', 'romantic_comedy', 'sports_comedy'], matchedScoreKeys: ['wholesome', 'hopefulness']},
    { id: 'jump_scare_fest', name: 'Jump-Scare Fest', icon: '👻', description: 'Relies heavily on sudden, loud, and shocking moments to startle the audience.', condition: s => s.scare > 9, requiredGenreBlends: ['sci_fi_horror', 'supernatural_horror'], matchedScoreKeys: ['scare']},
    { id: 'body_horror', name: 'Body Horror', icon: '🧬', description: 'Features grotesque and disturbing violations of the human body.', condition: s => s.grotesque > 9, requiredGenreBlends: ['sci_fi_horror'], matchedScoreKeys: ['grotesque']},
    { id: 'slapstick_genius', name: 'Slapstick Genius', icon: '🤸', description: 'Elevates physical comedy to an art form with perfectly timed gags and stunts.', condition: s => s.physical_comedy > 9, requiredGenreBlends: ['action_comedy'], matchedScoreKeys: ['physical_comedy']},

    // --- Humor & Unconventional Highlights ---
    { id: 'bizarre_comedy', name: 'Bizarre Comedy', icon: '🤪', description: 'Nonsensical and bizarre comedy that doesn\'t follow normal rules.', condition: s => s.absurdist_humor > 9 && s.surrealism > 8, requiredGenreBlends: ['absurdist_comedy'], matchedScoreKeys: ['absurdist_humor', 'surrealism'] },
    { id: 'darkly_funny', name: 'Darkly Funny', icon: '💀', description: 'Expertly finds humor in morbid, taboo, or tragic subjects.', condition: s => s.dark_humor > 9 && s.wit_wordplay > 8, requiredGenreBlends: ['horror_comedy', 'satirical_comedy', 'crime_comedy'], matchedScoreKeys: ['dark_humor'] },
    { id: 'smart_satire', name: 'Smart Satire', icon: '🧐', description: 'Uses humor to make fun of and critique society, politics, or culture.', condition: s => s.satire_parody > 9 && s.social_commentary > 8, requiredGenreBlends: ['satirical_comedy', 'political_satire', 'mockumentary'], matchedScoreKeys: ['satire_parody', 'social_commentary'] },
    { id: 'quirky_and_charming', name: 'Quirky & Charming', icon: '🤡', description: 'Features delightfully strange characters and an unconventional sense of humor.', condition: s => s.eccentricity > 9 && s.wholesome > 7, matchedScoreKeys: ['eccentricity'] },
    { id: 'so_bad_its_good', name: 'So Bad It\'s Good', icon: '🤌', description: "This work defies conventional quality with its charm, offering a uniquely entertaining experience through its flaws.", condition: s => s.camp_and_irony > 9 && s.narrative_structure < 4 && s.acting < 5, matchedScoreKeys: ['camp_and_irony', 'acting'] },
    { id: 'cult_classic', name: 'Cult Classic', icon: '🎬', description: "A film with a unique, unconventional vision that has attracted a passionate, dedicated fanbase over time.", condition: s => s.novelty > 9 && s.rewatchability > 9 && s.eccentricity > 8, matchedScoreKeys: ['novelty', 'rewatchability'] },
    { id: 'hidden_gem', name: 'Hidden Gem', icon: '💎', description: "An exceptionally well-crafted work that flew under the radar and deserves more recognition.", condition: s => (s.direction + s.acting + s.narrative_structure) / 3 > 9 && s.pop_culture < 5, matchedScoreKeys: ['direction', 'acting', 'pop_culture'] },
    { id: 'loving_homage', name: 'Loving Homage', icon: '💌', description: 'Filled with respectful tributes and "easter egg" references to other great works.', condition: s => s.homage_and_reference > 9 && s.pastiche > 8, matchedScoreKeys: ['homage_and_reference'] },
    { id: 'creepy_and_unsettling', name: 'Creepy & Unsettling', icon: '👤', description: 'Creates a deeply unsettling and creepy feeling with psychologically disturbing or "off" moments.', condition: s => s.uncanny > 9 && s.psychological > 8, requiredGenreBlends: ['psychological_thriller', 'psychological_horror', 'sci_fi_horror'], matchedScoreKeys: ['uncanny'] },
    { id: 'pure_nostalgia', name: 'Pure Nostalgia', icon: '📼', description: 'Perfectly captures a sentimental longing or wistful affection for a period in the past.', condition: s => s.nostalgia > 9, matchedScoreKeys: ['nostalgia'] },
];

// --- LEVEL 3: DOUBLE FEATURE LIBRARY ---
export const DOUBLE_FEATURE_LIBRARY: DoubleFeatureRule[] = [
    {
        id: "mind_bending_thriller",
        name: "Mind-Bending Thriller",
        description: "A psychological thriller with a complex, often non-linear narrative that challenges perceptions of reality.",
        icon: "🧠🌀",
        condition: (blends, highlights) => 
            blends.some(b => b.id === "psychological_thriller") && highlights.some(h => h.id === "complex_narrative"),
        getScore: (blends, highlights) => {
            const blendScore = blends.find(b => b.id === "psychological_thriller")?.score || 0;
            const highlightScore = highlights.find(h => h.id === "complex_narrative")?.score || 0;
            return (blendScore + highlightScore) / 2;
        }
    },
    {
        id: "epic_action_comedy",
        name: "Epic Action-Comedy",
        description: "A high-energy film that blends laugh-out-loud comedy with large-scale, spectacular action sequences.",
        icon: "😂💥",
        condition: (blends, highlights) => 
            blends.some(b => b.id === "action_comedy") && highlights.some(h => h.id === "spectacle"),
        getScore: (blends, highlights) => {
            const blendScore = blends.find(b => b.id === "action_comedy")?.score || 0;
            const highlightScore = highlights.find(h => h.id === "spectacle")?.score || 0;
            return (blendScore + highlightScore) / 2;
        }
    },
    {
        id: "heartwarming_tearjerker",
        name: "Heartwarming Tearjerker",
        description: "A sentimental drama designed to evoke a strong emotional response, blending heartwarming moments with deep pathos.",
        icon: "😭💖",
        condition: (blends, highlights) => 
            blends.some(b => b.id === "sentimental_drama") && highlights.some(h => h.id === "high_pathos"),
        getScore: (blends, highlights) => {
            const blendScore = blends.find(b => b.id === "sentimental_drama")?.score || 0;
            const highlightScore = highlights.find(h => h.id === "high_pathos")?.score || 0;
            return (blendScore + highlightScore) / 2;
        }
    },
    {
        id: "stylish_crime_caper",
        name: "Stylish Crime Caper",
        description: "A slick, visually stylized film about clever criminals and intricate heists, often with a touch of wit.",
        icon: "💎😎",
        condition: (blends, highlights) => 
            blends.some(b => b.id === "crime_thriller") && highlights.some(h => h.id === "visually_stylized"),
        getScore: (blends, highlights) => {
            const blendScore = blends.find(b => b.id === "crime_thriller")?.score || 0;
            const highlightScore = highlights.find(h => h.id === "visually_stylized")?.score || 0;
            return (blendScore + highlightScore) / 2;
        }
    },
];
