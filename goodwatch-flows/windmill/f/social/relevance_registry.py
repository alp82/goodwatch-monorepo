"""Seven stable IDs reviewed in the 2026-10-15 audit. No bio-based auto-enrolment."""
AUTHORS = {('bluesky', 'did:plc:ja5m5qsq5uwqokumcvrjt2sf'): {'name': 'Sarah Dempster',
                                                   'role_evidence': 'Reviewer posting her own Guardian '
                                                                    'review; byline and reviewer profile '
                                                                    'corroborate role.',
                                                   'source': 'https://www.theguardian.com/profile/sarahdempster',
                                                   'reviewed_at': '2026-10-15'},
 ('bluesky', 'did:plc:tpa4khyiq4jrqlke2a7gvcdk'): {'name': 'Xan Brooks',
                                                   'role_evidence': 'Guardian cinema writer/critic; '
                                                                    'publisher author page corroborates '
                                                                    'role.',
                                                   'source': 'https://www.theguardian.com/profile/xanbrooks',
                                                   'reviewed_at': '2026-10-15'},
 ('bluesky', 'did:plc:njvirfwp6aicogxnkgpbcjps'): {'name': 'Brian Steinberg',
                                                   'role_evidence': 'Valid Bluesky verification; Variety '
                                                                    'senior TV editor posting detailed '
                                                                    'reporting.',
                                                   'source': 'https://events.variety.com/truthseekers25/speaker/1799322/brian-steinberg-moderator',
                                                   'reviewed_at': '2026-10-15'},
 ('bluesky', 'did:plc:a67zdrt4nl2tv2qojpngogbq'): {'name': 'The Associated Press',
                                                   'role_evidence': 'Valid Bluesky verification and '
                                                                    'apnews.com domain handle; original '
                                                                    'premiere interview video.',
                                                   'source': 'https://bsky.app/profile/apnews.com',
                                                   'reviewed_at': '2026-10-15'},
 ('bluesky', 'did:plc:7uwvloz5lnqlsslhs5tfe66c'): {'name': 'Jason Herbert',
                                                   'role_evidence': 'Valid Bluesky verification; Historians '
                                                                    'At The Movies host with engaged current '
                                                                    'event.',
                                                   'source': 'https://bsky.app/profile/herberthistory.bsky.social',
                                                   'reviewed_at': '2026-10-15'},
 ('bluesky', 'did:plc:nvfposmpmhegtyvhbs75s3pw'): {'name': 'Jamelle Bouie',
                                                   'role_evidence': 'Valid Bluesky verification and '
                                                                    'jamellebouie.net domain handle; public '
                                                                    'NYT columnist profile.',
                                                   'source': 'https://bsky.app/profile/jamellebouie.net',
                                                   'reviewed_at': '2026-10-15'},
 ('bluesky', 'did:plc:on2fqp4z3zvvujczdpl27dve'): {'name': 'Candice Frederick',
                                                   'role_evidence': 'Publisher contributor page corroborates '
                                                                    'culture-journalist role; linked '
                                                                    'portfolio agrees.',
                                                   'source': 'https://bloomberg.com/authors/AXffNjDjMzw/candice-frederick',
                                                   'reviewed_at': '2026-10-15'}}


def main():
    return {"reviewed_authors": len(AUTHORS)}
