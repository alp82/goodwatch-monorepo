"""Fixed companion vocabulary. No runtime-created tags or linked plot records."""

FIELDS = {}


def add(field, description, values=None, *, many=False, boolean=False, show=False, spoiler=False):
    schema = {'type': 'boolean'} if boolean else {'enum': values}
    if many:
        schema = {'type': 'array', 'items': schema, 'uniqueItems': True}
    FIELDS[field] = {'definition': description, 'value_schema': schema,
                     'applicability': 'show' if show else 'all', 'spoiler_sensitive': spoiler}


add('storytelling.chronology',
    'Predominant presentation order of story events. Occasional memories do not make a chronological narrative mixed. Reverse means substantial reverse ordering; a repeated time loop alone is not reverse chronology.',
    ['predominantly_chronological', 'predominantly_reverse', 'mixed_timelines', 'non_temporal'])
add('storytelling.retelling_structure',
    'Whether substantially the same events are presented again from different accounts. Parallel storylines alone are none. Complementary accounts add information; conflicting accounts disagree; both can apply.',
    ['none', 'same_events_complementary', 'same_events_conflicting', 'same_events_complementary_and_conflicting'], spoiler=True)
add('storytelling.tone_progression',
    'Dominant broad change in tone across the assessed work, not an exact timeline or a claim about every episode. Comedy throughout mixed with horror is mixed_without_dominant_direction.',
    ['broadly_stable', 'increasingly_dark', 'increasingly_light', 'comic_to_horror',
     'horror_to_comic', 'mixed_without_dominant_direction'], spoiler=True)
add('characters.competence_basis',
    'How focal characters\' demonstrated skill is established. These are whole-work categories, not claims that all tags describe the same person. Do not equate intelligence with competence.',
    ['shown_training_or_practice', 'established_professional_experience', 'demonstrated_problem_solving',
     'claimed_but_not_demonstrated', 'extraordinary_unexplained_mastery'], many=True)
add('presentation.narration_sources',
    'Sources of narration or explanatory speech, excluding ordinary dialogue. First-person character narration does not imply direct audience address. Source recordings are retained historical/archival speech rather than newly added explanation.',
    ['in_story_character', 'external_narrator', 'filmmaker', 'participant_testimony',
     'expert_commentary', 'archival_source_recordings', 'onscreen_text'], many=True)
add('presentation.jump_scares',
    'Abrupt audiovisual events deliberately staged to startle. General fear, loudness or sustained tension alone is not a jump scare.',
    ['present', 'absent', 'unknown'])
add('presentation.jump_scare_modalities',
    'Modalities used by actual jump scares, independently of sound-design prominence. Empty only when assessed absent; null when undetermined.',
    ['visual', 'audio'], many=True)
add('presentation.laugh_track',
    'Recorded or live audience laughter included in the soundtrack; ordinary characters laughing is excluded.',
    ['present', 'absent', 'unknown'])
add('presentation.sustained_screaming',
    'Extended or repeatedly sustained screaming in the soundtrack, distinct from an isolated shout or startle.',
    ['present', 'absent', 'unknown'])
add('ending.post_credits_function',
    'Narrative function of material during or after credits within the assessed edition. none means no such scene; a comic tag need not reopen a threat.',
    ['none', 'comic_tag', 'epilogue_or_resolution', 'reopens_threat_or_mystery',
     'introduces_next_story', 'tribute_or_non_narrative', 'multiple_functions'], spoiler=True)
add('series.case_resolution_pattern',
    'Typical resolution of the central case/problem in the assessed episodes. Not show cancellation status, ending quality or a promise about unseen seasons.',
    ['mostly_within_episode', 'mostly_multi_episode_arcs', 'mostly_season_or_series_arc',
     'mixed', 'no_case_structure'], show=True)
add('series.character_continuity',
    'Typical continuity of character relationships and personal development across the assessed episodes, independently of case resolution.',
    ['mostly_reset', 'cumulative_development', 'independent_casts', 'mixed'], show=True)
add('world_context.eras',
    'Substantial depicted story eras, not production dates. A brief mention or prop does not establish a setting. Ancient/medieval are broad temporal labels, not a claim that all societies share one historical periodization.',
    ['prehistoric', 'ancient', 'medieval', 'early_modern', 'nineteenth_century',
     'early_twentieth_century', 'late_twentieth_century', 'twenty_first_century', 'future', 'timeless'], many=True)
add('world_context.relative_periods',
    'Substantial story periods relative to the title\'s original release, not today. Multiple selections describe the work overall, without pairing each period to an event.',
    ['distant_past', 'recent_past', 'contemporary_at_release', 'near_future', 'far_future', 'timeless'], many=True)
add('world_context.reality_layers',
    'Kinds of depicted reality that matter to the work. Physical staged reality (e.g. an elaborate set) is distinct from a digital simulation or virtual reality.',
    ['ordinary_physical', 'physically_staged', 'digital_simulation', 'virtual_reality',
     'dream', 'parallel_world', 'afterlife'], many=True, spoiler=True)
add('world_context.environmental_obstacles',
    'Environmental conditions that materially impede action or survival. Scenic weather alone does not qualify; these tags do not identify who is obstructed or when.',
    ['snow_or_ice', 'extreme_heat', 'storm', 'flood_or_water', 'drought', 'fire',
     'rough_terrain', 'darkness', 'toxic_environment'], many=True)
add('seasonal.depicted_seasons',
    'Substantial seasons depicted, based on the setting\'s local climate/calendar. Release month and viewing associations are insufficient.',
    ['spring', 'summer', 'autumn', 'winter', 'wet_season', 'dry_season'], many=True)
add('seasonal.depicted_holidays',
    'Named celebrations actually depicted or materially organizing the story. This bounded vocabulary is not exhaustive; do not invent a new label for an unlisted tradition.',
    ['christmas', 'halloween', 'new_year', 'lunar_new_year', 'thanksgiving', 'easter',
     'hanukkah', 'passover', 'ramadan', 'eid_al_fitr', 'eid_al_adha', 'diwali', 'holi',
     'day_of_the_dead', 'carnival', 'valentines_day'], many=True)
add('cultural.movements_and_traditions',
    'Established artistic affiliation or substantial recognizable stylistic tradition. Country, language, slow pacing or production date alone is insufficient. This list is bounded; unlisted traditions require a future schema revision, not a guessed synonym.',
    ['german_expressionism', 'soviet_montage', 'italian_neorealism', 'french_new_wave',
     'new_hollywood', 'cinema_novo', 'third_cinema', 'dogme_95', 'mumblecore', 'slow_cinema',
     'film_noir', 'neo_noir', 'giallo', 'spaghetti_western', 'wuxia', 'jidaigeki', 'chambara',
     'hong_kong_action', 'j_horror', 'korean_new_wave', 'iranian_new_wave',
     'taiwan_new_cinema', 'indian_parallel_cinema', 'masala', 'afrofuturism',
     'new_queer_cinema', 'surrealist_cinema', 'cinema_verite', 'direct_cinema',
     'new_french_extremity', 'berlin_school', 'romanian_new_wave', 'hong_kong_new_wave',
     'la_rebellion', 'blaxploitation', 'poliziotteschi', 'ozploitation', 'pinku_eiga',
     'heroic_bloodshed', 'nollywood', 'bollywood_masala', 'k_drama', 'telenovela'], many=True)
add('cultural.depicted_contexts',
    'Social/cultural experiences substantially depicted, independently of the production industry or an actor\'s identity. Diaspora and indigenous contexts require established depiction, not inference from appearance.',
    ['diaspora', 'migration', 'indigenous_community', 'cross_cultural_encounter',
     'religious_community', 'secular_community', 'working_class', 'aristocratic',
     'youth_subculture', 'queer_community', 'rural_community', 'urban_community'], many=True)
add('representation.established_protagonist_traits',
    'Explicitly established traits of one or more protagonists/co-protagonists. Whole-work set: selections need not describe the same person. Never infer from an actor\'s identity, appearance, name or a viewer stereotype.',
    ['woman', 'man', 'nonbinary', 'transgender', 'gay_or_lesbian', 'bisexual', 'asexual',
     'physical_disability', 'sensory_disability', 'neurodivergent', 'child', 'teenager',
     'older_adult', 'nonhuman'], many=True, spoiler=True)

# Retain existing useful format facts, with fixed values rather than per-fact evidence objects.
FORMATS = {
    'production_method': ('Perceptible production method, distinct from genre and depicted entities.', ['live_action', 'animation', 'mixed_media']),
    'narrative_mode': ('Fiction, nonfiction or an explicit hybrid; mockumentary is normally fiction.', ['fiction', 'nonfiction', 'hybrid']),
    'series_structure': ('Overall show format within scope, separate from its current release/cancellation status.', ['limited', 'ongoing_serial', 'episodic', 'anthology', 'mixed']),
    'color_process': ('Predominant color presentation of the assessed edition.', ['color', 'black_and_white', 'mixed', 'tinted']),
    'adaptation_type': ('Broad source-material type. Do not invent a source-work identifier.', ['original', 'novel', 'short_story', 'play', 'comic', 'game', 'folklore', 'biography', 'mixed', 'other']),
    'factual_basis': ('Relationship to real people/events; does not certify factual accuracy.', ['fictional', 'based_on_real_events', 'biographical', 'documentary', 'mixed', 'disputed']),
}
for key, (description, values) in FORMATS.items():
    add('format_facts.' + key, description, values, show=key == 'series_structure')
for key, (description, values) in {
    'animation_techniques': ('Animation techniques actually used, not creatures depicted.', ['traditional_2d', 'digital_2d', 'cgi_3d', 'stop_motion', 'rotoscoping', 'cutout', 'puppetry', 'mixed', 'other']),
    'presentation_modes': ('Observable presentation modes, not audience approval.', ['conventional_narrative', 'mockumentary', 'found_footage', 'sketch', 'observational_documentary', 'expository_documentary', 'participatory_documentary', 'essay', 'reality_competition', 'reality_observational', 'experimental', 'non_narrative', 'other']),
    'documentary_devices': ('Devices used in documentary-style presentation, including fictional mockumentary. Voiceover origin is captured separately.', ['interviews', 'archive', 'reenactment', 'voiceover', 'observation', 'participation', 'animation', 'other']),
    'capture_media': ('Known original capture medium, never inferred from a digital streaming release or merely simulated grain. Unknown is appropriate without knowledge.', ['8mm', 'super_8', '16mm', 'super_16', '35mm', '65mm', 'digital', 'analog_video', 'mixed', 'other']),
    'work_relation_types': ('Known relation types to other works; these tags do not resolve target works or establish influence from resemblance alone.', ['adaptation', 'remake', 'reimagining', 'sequel', 'prequel', 'spinoff', 'homage', 'parody', 'shared_universe']),
}.items():
    add('format_facts.' + key, description, values, many=True)
for key, description in {
    'anime_tradition': 'Affiliation with the anime production/artistic tradition; animation alone is insufficient.',
    'silent_or_intertitles': 'Principally silent-film/intertitle presentation, not simply sparse dialogue.',
    'single_take_presentation': 'Whole work presented as one continuous take, real or simulated; an isolated long take is insufficient.',
    'real_time_presentation': 'Main narrative is presented approximately in real elapsed time; not merely rapid plot events.',
    'post_credits_scene_present': 'A scene during/after credits in this edition, not ordinary credit text.',
    'alternate_endings_present': 'Known alternative endings for this title/edition; do not invent them from narrative ambiguity.',
}.items():
    add('format_facts.' + key, description, boolean=True,
        spoiler=key in {'post_credits_scene_present', 'alternate_endings_present'})

# Common alternate wording helps identify a field; it does not add query execution logic.
ALIASES = {
    'characters.demonstrated_competence': ['competence', 'competency porn', 'skilled professionals'],
    'storytelling.chronology': ['reverse chronology', 'chronological order'],
    'storytelling.retelling_structure': ['Rashomon structure', 'same event from different perspectives'],
    'presentation.narration_sources': ['source audio', 'talking heads', 'external narrator'],
    'presentation.jump_scares': ['jump scares', 'jump scares absent'],
    'presentation.laugh_track': ['canned laughter', 'audience laughter'],
    'advisories.death.presence': ['death', 'someone dies'],
    'format_facts.single_take_presentation': ['one take', 'single shot'],
    'format_facts.color_process': ['black and white', 'monochrome'],
}
