"""Bounded additions from the all-tag draft.8 essence audit; no vector changes."""

ADDITIONS = {
    'storytelling.character_emphasis': ('prominence', 'content_attributes',
        'Extent to which sustained understanding of characters, their motives, choices and relationships organizes the work. Independent of writing quality, intimate presentation, cast size, slow pacing, psychology as subject or whether a character changes. Can coexist with strong external plotting. A character merely causing events does not by itself establish sustained character-study emphasis.'),
    'themes.ethical_dilemmas': ('centrality', 'content_attributes',
        'Narrative importance of consequential choices between competing moral duties, values or harms. A principled person can face such choices; morally ambiguous people, guilt or philosophical discussion alone do not establish a dilemma.'),
    'themes.resilience': ('centrality', 'content_attributes',
        'Narrative importance of sustained endurance, adaptation or persistence in response to adversity. Not generic achievement, inspirational praise, remaining alive alone or necessarily rebuilding after a crisis. Neither personal transformation nor a hopeful outcome is required.'),
    'themes.voluntary_sacrifice': ('centrality', 'content_attributes',
        'Narrative importance of willingly giving up something substantial or accepting personal cost for another person, value or commitment. Excludes victimization, coerced loss and ritual offerings or killing without voluntary self-sacrifice. Bare sacrifice is not sufficient to determine voluntariness.'),
    'atmosphere.claustrophobia': ('intensity', 'content_attributes',
        'Strength of a felt inability to escape or move freely, created by situation and audiovisual treatment. Distinct from physically small locations, concentrated narrative setting, geographic isolation, general anxiety and low budget. Open surroundings can still be presented as inescapable.'),
    'themes.economic_precarity': ('centrality', 'content_attributes',
        'Narrative importance of material deprivation, insecure livelihood or inability to meet basic needs. Class hierarchy, financial work, wealth management and desire for greater wealth alone do not establish it.'),
    'music_styles.blues': ('prominence', 'content_attributes',
        'Blues musical traditions perceptibly present in the audible soundtrack. A musician as subject, blue imagery, sadness or the word blues in a title is insufficient. Can coexist with other supported musical styles.'),
    'music_styles.reggae': ('prominence', 'content_attributes',
        'Reggae music perceptibly present in the audible soundtrack. Caribbean location, a performer as subject or production origin alone is insufficient. Can coexist with other supported musical styles.'),
    'music_styles.gospel': ('prominence', 'content_attributes',
        'Gospel musical traditions perceptibly present in the audible soundtrack. Religious subject matter, a church setting, choral singing or sacred music in general is insufficient. Can coexist with soul, folk or other supported musical styles.'),
}

FACET_ADDITIONS = {
    'relationships.family_dynamics': {
        'definition': 'Dynamics explicitly involving a family relationship. family_secrets means consequential information concealed within or about a family, not merely an unrelated secret and a family both appearing. reconciliation means repair or restoration of an estranged or damaged family bond, not forgiveness alone or conflict merely ending. Select every supported dynamic; selections need not concern the same family. Null is undetermined; [] means assessed with neither listed dynamic.',
        'values': ['family_secrets', 'reconciliation'],
    },
    'relationships.romantic_arc_patterns': {
        'definition': 'Specific patterns established within a romantic relationship. rekindled_relationship means former romantic partners renew or attempt to renew their relationship with each other; a breakup and a different new romance do not qualify. Multiple patterns may be selected when supported. Null is undetermined; [] means no listed pattern identified, not no romance.',
        'values': ['rekindled_relationship'],
    },
    'speculative.supernatural_mechanisms': {
        'definition': 'Extraordinary mechanisms depicted or established as operative within the work, including speculative-scientific explanations: reincarnation is rebirth as another life; resurrection is returning to life after death; immortality is freedom from ordinary aging/death, not invulnerability or a long lifespan alone; telepathy is direct mind-to-mind communication or mind reading without ordinary sensory communication. Mere belief, research, rumor, metaphor, ritual performance or an unconfirmed claim does not establish an operative mechanism. Use null when this cannot be determined and [] when assessed with no listed mechanism; these choices do not certify absence of all supernatural phenomena. Existing afterlife, possession and superpower fields remain separate; do not infer them automatically. Select every supported mechanism.',
        'values': ['reincarnation', 'resurrection', 'immortality', 'telepathy'],
    },
}

ENUM_ADDITIONS = {
    'format_facts.presentation_modes': [
        'stand_up', 'concert_performance', 'game_show', 'talk_show', 'variety_show',
        'staged_performance', 'opera_performance', 'live_puppetry',
    ],
    'cultural.movements_and_traditions': [
        'czechoslovak_new_wave', 'british_new_wave', 'new_german_cinema', 'french_poetic_realism',
    ],
}

FACET_DEFINITION_SUFFIXES = {
    'format_facts.presentation_modes':
        ' Stand_up means a substantial stand-up comedy performance organizes the presentation; concert_performance means a substantial concert or musical performance constitutes the work or a substantial program segment, not simply a scene in a narrative film. Game_show uses a presented contestant game or quiz format, not competition as story subject; talk_show uses a presenter-led conversation/interview program, not documentary interviews alone; variety_show combines hosted entertainment segments. Staged_performance presents a substantial staged theatrical, dance or musical production; opera_performance presents an operatic performance tradition and does not imply Western classical music. Live_puppetry presents physically manipulated puppets performing in real time, not automatically stop-motion or puppet animation. These modes may overlap with each other and documentary modes when independently supported. Depicted toys or performers alone are insufficient.',
    'cultural.movements_and_traditions':
        ' Bollywood industry affiliation does not establish masala or bollywood_masala style. French_poetic_realism names the established film movement, not any poetic or realistic treatment. New_german_cinema names the film movement, not German nationality or new-wave music. The British and Czechoslovak New Wave choices likewise require the artistic affiliation, not country or release decade alone.',
}

ALIASES = {
    'storytelling.character_emphasis': ['character study', 'character-driven', 'character-focused'],
    'themes.ethical_dilemmas': ['moral dilemma', 'ethical dilemma', 'competing moral obligations'],
    'themes.resilience': ['human resilience', 'perseverance', 'overcoming adversity'],
    'themes.voluntary_sacrifice': ['self-sacrifice', 'heroic sacrifice', 'personal sacrifice'],
    'atmosphere.claustrophobia': ['claustrophobic atmosphere', 'claustrophobic tension'],
    'themes.economic_precarity': ['poverty', 'economic hardship', 'insecure livelihood'],
    'music_styles.blues': ['blues music'],
    'music_styles.reggae': ['reggae music'],
    'music_styles.gospel': ['gospel music'],
    'relationships.family_dynamics': ['family secrets', 'family reconciliation'],
    'relationships.romantic_arc_patterns': ['second chance romance', 'rekindled romance'],
    'speculative.supernatural_mechanisms': ['reincarnation', 'resurrection', 'immortality', 'telepathy'],
}
