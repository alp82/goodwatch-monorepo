"""Relevance decisions and the read-only/apply boundary agreed in #556's brief."""
import sys
import unittest
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.social.relevance import judge_links

AT = datetime(2026, 10, 15, 16, tzinfo=timezone.utc)
TITLE = {'title': 'Example Movie', 'original_title': 'Example Movie', 'release_year': 2026}


def piece(**changes):
    return dict(media_type='movie', media_tmdb_id=1, post_id='one', content_hash='hash',
                source='rss', source_id='article', author_id='variety.com', author='Reviewer',
                url='https://variety.com/2026/film/reviews/example-movie-review/',
                text='Example Movie Review: A thoughtful and moving debut', context='Original film criticism.',
                published_at='2026-10-15T12:00:00Z', quality_evidence={},
                youtube_playability={'video_id': 'article', 'method': 'watch', 'checked_at': AT.isoformat(),
                    'status': 'playable', 'reason': 'test_fixture', 'countries': {'DE': True}}, **changes)


class RelevanceTests(unittest.TestCase):
    def judge(self, item, title=None):
        return judge_links([item], {'movie:1': title or TITLE}, at=AT)[0]

    def test_narnia_keeps_interview_reactions_and_music_analysis_beside_trailer(self):
        sys.path.insert(0, str(Path(__file__).parents[1] / 'tools'))
        from social_relevance_eval import FIXTURE, editorial_inputs
        data = json.loads(FIXTURE.read_text())
        links = [p for p in editorial_inputs(data) if p['media_tmdb_id'] == 1147572]
        labels = {v['post_id']: v['audit_id'] for v in data['verdicts']}
        from f.social.common import stamp
        decisions = judge_links(links, data['catalog'], at=stamp(data['at']))
        by_id = {labels[v['post_id']]: v for v in decisions}
        for audit_id in ('P196', 'P394', 'P424'):
            with self.subTest(audit_id=audit_id):
                self.assertEqual(by_id[audit_id]['status'], 'keep', by_id[audit_id]['reasons'])
        self.assertEqual(len({by_id[k]['dup_group'] for k in ('P196', 'P394', 'P424', 'P429')}), 4)
        # Plain release reports still collapse, and the low-reach social post fails.
        self.assertTrue(all(by_id[k]['status'] == 'drop' for k in ('P416', 'P423', 'P425', 'P426', 'P427', 'P432', 'P105')))

    def test_title_cast_discussion_needs_craft_and_preserves_reference_exclusions(self):
        for headline in ('Example Movie Director Talks Book Changes and Production Challenges',
                         'Example Movie Star Jane Doe on Cut Scenes and a Possible Sequel',
                         "Example Movie's Emotional Goodbye Scene Was Inspired by Its Character Design"):
            with self.subTest(headline=headline):
                self.assertEqual(self.judge(piece() | {'text': headline, 'context': ''})['status'], 'keep')
        for headline in ('Example Movie Star Jane Doe Signs With New Agency',
                         'Example Movie Fans Celebrate an Actor’s Wedding',
                         'Example Movie Sequel Director Reveals Production Secrets',
                         'From the Director of Example Movie: New Film Reveals Production Secrets',
                         'New Movie Like Example Movie Reveals Its Production Secrets'):
            with self.subTest(headline=headline):
                self.assertEqual(self.judge(piece() | {'text': headline, 'context': ''})['status'], 'drop')

    def test_body_subject_punctuation_and_german_compounds_without_incidental_credits(self):
        for body in ('Example Movie, which stars Jane Doe, has a new trailer.',
                     'Der erste Trailer zum neuen Example Movie-Film ist da.',
                     '"Example Movie" war eine Enttäuschung bei Kritik und Publikum.'):
            with self.subTest(body=body):
                self.assertEqual(self.judge(piece() | {'text': 'A filmmaker explains the new production',
                    'context': body})['status'], 'keep')
        for body in ('Her previous credits include "Example Movie". The new movie has a trailer.',
                     'From the director of Example Movie comes a new production.',
                     'The Example Movie-Fan talks about a different trailer.'):
            with self.subTest(body=body):
                self.assertEqual(self.judge(piece() | {'text': 'A filmmaker explains a new production',
                    'context': body})['status'], 'drop')

    def test_story_groups_separate_reactions_interview_and_analysis_from_trailer_release(self):
        rows = [piece() | {'post_id': key, 'url': 'https://variety.com/' + key,
                          'text': headline, 'context': body} for key, headline, body in (
            ('trailer', 'Example Movie Official Trailer Revealed', ''),
            ('repeat', 'Example Movie First Trailer Arrives', ''),
            ('interview', 'Example Movie Trailer Debuts as Director Opens Up',
             'The director participated in a Q&A about the film’s music choices.'),
            ('reaction', 'Example Movie Fans Split Over New Trailer', ''),
            ('reaction-repeat', 'Example Movie Trailer Reactions Divide Audiences', ''),
            ('analysis', 'Why Example Movie Trailer Uses This Song', 'An analysis of the music choices.'),
        )]
        judged = {r['post_id']: r for r in judge_links(rows, {'movie:1': TITLE}, at=AT)}
        self.assertEqual(sum(r['status'] == 'keep' for r in judged.values()), 4)
        self.assertEqual(judged['trailer']['dup_group'], judged['repeat']['dup_group'])
        self.assertEqual(judged['reaction']['dup_group'], judged['reaction-repeat']['dup_group'])
        self.assertEqual(len({judged[k]['dup_group'] for k in ('trailer', 'interview', 'reaction', 'analysis')}), 4)
        # URL identity still collapses a copy regardless of its headline angle.
        copy = rows[2] | {'post_id': 'copy', 'url': rows[0]['url'] + '?utm_source=copy'}
        result = judge_links([rows[0], copy], {'movie:1': TITLE}, at=AT)
        self.assertEqual(sum(r['status'] == 'keep' for r in result), 1)
        reversed_rows = judge_links(list(reversed(rows)), {'movie:1': TITLE}, at=AT)
        self.assertEqual(judged, {r['post_id']: r for r in reversed_rows})

    def test_news_freshness_uses_publication_and_rejects_future_dates(self):
        item = piece()
        self.assertEqual(self.judge(item)['status'], 'keep')
        for date in ('2026-10-08T15:59:59Z', '2026-10-16T00:00:00Z', None):
            with self.subTest(date=date):
                self.assertEqual(self.judge(item | {'published_at': date})['status'], 'drop')

    def test_official_video_needs_substantive_format_and_current_hook_for_archive(self):
        from f.social.inventory import CHANNELS
        item = piece() | dict(source='youtube', author_id=CHANNELS['Netflix'],
                              url='https://www.youtube.com/watch?v=one',
                              published_at='2026-10-02T16:00:00Z', text='Example Movie | Official Trailer')
        self.assertEqual(self.judge(item)['status'], 'keep')
        for change in (dict(author_id='fake'), dict(text='TRAILER TOMORROW'),
                       dict(text='Example Movie | Fortnite Trailer'), dict(text='Get tickets now'),
                       dict(published_at='2026-10-01T00:00:00Z')):
            with self.subTest(change=change):
                self.assertEqual(self.judge(item | change)['status'], 'drop')
        old = TITLE | {'release_year': 1992}
        self.assertEqual(self.judge(item, old)['status'], 'drop')
        self.assertEqual(self.judge(item | {'text': 'Example Movie | 4K restoration trailer'}, old)['status'], 'keep')

    def test_current_season_preview_and_cast_summary_qualify_without_archive_filler(self):
        from f.social.inventory import CHANNELS
        item = piece() | dict(source='youtube', author_id=CHANNELS['Netflix'], url='https://www.youtube.com/watch?v=one')
        old = TITLE | {'release_year': 2020}
        self.assertEqual(self.judge(item | {'text': 'Example Movie S11 | Sneak Peek',
            'context': 'The first episodes of Example Movie S11 premiere tomorrow.'}, old)['status'], 'keep')
        self.assertEqual(self.judge(item | {'text': 'Example Movie S1 | Scene', 'context': ''}, old)['status'], 'drop')
        self.assertEqual(self.judge(item | {'text': 'The cast summarize Example Movie for viewers'})['status'], 'keep')
        self.assertEqual(self.judge(item | {'text': 'Example Movie | Official Trailer'}, TITLE | {'release_year': None})['status'], 'keep')

    def test_alias_and_body_supported_analysis_survive_but_peripheral_credit_does_not(self):
        title = TITLE | {'aliases': ['Beispiel Film']}
        self.assertEqual(self.judge(piece() | {'text': '"Beispiel Film": Kritik zum neuen Kinofilm'}, title)['status'], 'keep')
        self.assertEqual(self.judge(piece() | {'text': 'Director explains a difficult production',
            'context': 'In "Beispiel Film", the director explains the new movie’s production and practical effects.'}, title)['status'], 'keep')
        self.assertEqual(self.judge(piece() | {'text': '"Example Movie" Star Signs With New Agency'}, title)['status'], 'drop')
        self.assertEqual(self.judge(piece() | {'text': 'A new interview with a director',
            'context': 'Her previous credits include "Example Movie".'}, title)['status'], 'drop')
        self.assertEqual(self.judge(piece() | {'text': '"Nárnia": Eine Kritik zum neuen Kinofilm'},
            TITLE | {'aliases': ['Nárnia']})['status'], 'keep')

    def test_editorial_noise_and_republication_fail_even_at_tier_a(self):
        for headline in ('Where to Watch Example Movie Tonight', 'Example Movie Red Carpet Photo Gallery',
                         '20 Best Movies Ranked Including Example Movie', 'Example Movie Merchandise Giveaway'):
            with self.subTest(headline=headline):
                self.assertEqual(self.judge(piece() | {'text': headline})['status'], 'drop')
        self.assertEqual(self.judge(piece() | {'context': 'This article was originally published in 2020 and republished today.'})['status'], 'drop')
        self.assertEqual(self.judge(piece() | {'url': 'https://unknown.example/review'})['status'], 'drop')

    def test_review_and_interview_kinds_use_publisher_evidence(self):
        self.assertEqual(self.judge(piece() | {'text': 'Example Movie',
            'url': 'https://film-rezensionen.de/2026/10/example-movie/'})['kind'], 'review')
        self.assertEqual(self.judge(piece() | {'text': 'Example Movie: Creative Choices',
            'url': 'https://indiewire.com/features/interviews/example-movie/'})['kind'], 'interview')
        self.assertEqual(self.judge(piece() | {'context': 'Dieser Artikel ist eine Wiederveröffentlichung.'})['status'], 'drop')

    def test_social_requires_measured_reach_own_words_and_foreground_for_every_author(self):
        item = piece() | dict(source='bluesky', author_id='unknown', context='',
            text='Example Movie offers a thoughtful account of grief through its careful lighting and generous performances. '
                 'The final act finds a moving balance between hope and ambiguity.',
            relevance_evidence=dict(likes=20, reposts=0, quotes=0, replies=999, followers=500))
        self.assertEqual(self.judge(item)['status'], 'keep')
        for metrics in ({}, dict(likes=20, reposts=0, quotes=0, followers=None),
                        dict(likes=19, reposts=0, quotes=0, followers=10000),
                        dict(likes=20, reposts=None, quotes=0, followers=10000)):
            with self.subTest(metrics=metrics):
                self.assertEqual(self.judge(item | {'relevance_evidence': metrics})['status'], 'drop')
        self.assertEqual(self.judge(item | {'relevance_evidence': dict(likes=100, reposts=0, quotes=0, followers=None)})['status'], 'keep')
        trusted = item | {'author_id': 'did:plc:nvfposmpmhegtyvhbs75s3pw', 'relevance_evidence': {}}
        self.assertEqual(self.judge(trusted)['status'], 'keep')
        self.assertEqual(self.judge(trusted | {'text': 'Example Movie is great!'})['status'], 'drop')
        self.assertEqual(self.judge(trusted | {'context': item['text']})['status'], 'drop')
        comparator = trusted | {'text': 'I have not watched this actor since Example Movie. '
            'I am watching another movie now and his performance is wooden and lacks any charisma at all.'}
        self.assertEqual(self.judge(comparator)['status'], 'drop')

    def test_cross_source_groups_prefer_originals_and_preserve_independent_angles(self):
        article = piece()
        share = article | dict(post_id='share', source='bluesky',
            author_id='did:plc:nvfposmpmhegtyvhbs75s3pw', url='https://bsky.app/profile/person/post/x',
            text='Example Movie tells a story about grief and memory with surprising care and formal invention. '
                 'I found the final scene haunting and the performances remarkably powerful and convincing.', context='',
            quality_evidence={'urls': [article['url'] + '?utm_source=bsky']})
        decisions = judge_links([article, share], {'movie:1': TITLE}, at=AT)
        self.assertNotEqual(decisions[0]['dup_group'], decisions[1]['dup_group'])
        headline = article | dict(text='Example Movie | Official Trailer revealed', post_id='news',
                                 url='https://variety.com/example-movie-trailer')
        other = headline | dict(post_id='other', url='https://deadline.com/example-movie-trailer')
        judged = judge_links([headline, other, article], {'movie:1': TITLE}, at=AT)
        self.assertEqual(judged[0]['dup_group'], judged[1]['dup_group'])
        self.assertNotEqual(judged[0]['dup_group'], judged[2]['dup_group'])
        self.assertEqual(sum(r['status'] == 'keep' for r in judged[:2]), 1)
        reversed_judged = judge_links([article, other, headline], {'movie:1': TITLE}, at=AT)
        self.assertEqual({r['post_id']: r for r in judged}, {r['post_id']: r for r in reversed_judged})

    def test_independent_reviews_with_identical_titles_remain_separate(self):
        title = TITLE | {'title': 'A Movie About Hope And Memory', 'original_title': 'A Movie About Hope And Memory'}
        first = piece() | {'text': title['title'], 'url': 'https://film-rezensionen.de/2026/10/a-movie/'}
        second = first | {'post_id': 'another', 'url': 'https://rogerebert.com/reviews/a-movie'}
        judged = judge_links([first, second], {'movie:1': title}, at=AT)
        self.assertEqual([v['status'] for v in judged], ['keep', 'keep'])
        self.assertNotEqual(judged[0]['dup_group'], judged[1]['dup_group'])

    def test_video_cut_and_seventy_two_hour_boundaries_are_distinct(self):
        from f.social.inventory import CHANNELS
        base = piece() | dict(source='youtube', author_id=CHANNELS['Netflix'], text='Example Movie | Official Trailer',
                              url='https://www.youtube.com/watch?v=first', published_at='2026-10-12T00:00:00Z')
        local = base | dict(post_id='localized', author_id=CHANNELS['Netflix Brasil'],
                           text='Beispiel Film | Trailer oficial', url='https://www.youtube.com/watch?v=local')
        cut = base | dict(post_id='cut2', text='Example Movie | Trailer 2', url='https://www.youtube.com/watch?v=cut2')
        later = base | dict(post_id='later', published_at='2026-10-15T00:00:01Z', url='https://www.youtube.com/watch?v=later')
        judged = judge_links([base, local, cut, later], {'movie:1': TITLE}, at=AT)
        self.assertEqual(judged[0]['dup_group'], judged[1]['dup_group'])
        self.assertEqual(judged[0]['status'], 'keep')
        self.assertEqual(judged[1]['status'], 'drop')
        self.assertEqual(len({r['dup_group'] for r in judged}), 3)

    def test_empty_transliterations_and_reboot_alias_collisions_do_not_prove_foreground(self):
        title = TITLE | {'aliases': ['侏罗纪世界']}
        self.assertEqual(self.judge(piece() | {'text': 'An unrelated original review', 'context': ''}, title)['status'], 'drop')
        rows = [piece() | {'text': 'New Example Movie Reboot Sets Release', 'context': ''}]
        self.assertEqual(judge_links(rows, {'movie:1': TITLE | {'release_year': 1990}}, at=AT)[0]['status'], 'drop')

    def test_bluesky_api_counts_are_retained_without_changing_quality_evidence(self):
        from f.social.bluesky import collect
        class Reply:
            def __init__(self, body):
                self.body = body
            def json(self):
                return self.body
        def get(url, **kwargs):
            if url.endswith('getProfiles'):
                return Reply({'profiles': [{'did': 'did:alice', 'displayName': 'Alice', 'followersCount': 800}]})
            return Reply({'posts': [{'uri': 'at://did:alice/app.bsky.feed.post/1',
                'author': {'did': 'did:alice', 'handle': 'alice.test'}, 'record': {
                    'text': 'A thoughtful new review of Example Movie', 'createdAt': '2026-10-15T12:00:00Z'},
                'likeCount': 20, 'repostCount': 4, 'quoteCount': 2, 'replyCount': 200}]})
        from datetime import timedelta
        p = collect({}, AT-timedelta(days=1), AT, get=get, queries=['movie'])['posts'][0]
        self.assertEqual(p['relevance_evidence']['followers'], 800)
        self.assertEqual(p['relevance_evidence']['quotes'], 2)
        self.assertNotIn('followers', p['quality_evidence']['profile'])

    def test_mastodon_preserves_missing_counts_and_does_not_count_replies_as_engagement(self):
        from f.social.mastodon import collect
        from datetime import timedelta
        class Reply:
            def json(self):
                return [{'uri': 'https://mastodon.social/users/alice/statuses/1',
                    'url': 'https://mastodon.social/@alice/1', 'created_at': '2026-10-15T12:00:00Z',
                    'content': 'Example Movie is a film about memory and grief with an inventive structure.',
                    'favourites_count': 20, 'reblogs_count': 2, 'replies_count': 400,
                    'account': {'url': 'https://mastodon.social/@alice', 'acct': 'alice', 'followers_count': 600}}]
        p = collect({}, AT-timedelta(days=1), AT, get=lambda *a, **kw: Reply(),
                    instances=['https://mastodon.social'])['posts'][0]
        self.assertEqual(p['relevance_evidence']['followers'], 600)
        self.assertIsNone(p['relevance_evidence']['quotes'])
        self.assertEqual(self.judge(p | {'media_type': 'movie', 'media_tmdb_id': 1})['status'], 'drop')

    def test_rejudge_preview_performs_only_selects_and_apply_writes_only_relevance(self):
        from f.social.rejudge import run
        class Database:
            def __init__(self):
                self.writes = []
            def select(self, sql, args=None):
                if 'FROM doc.social_title_link' in sql:
                    return [piece() | {'evidence': '{}'}]
                if 'FROM movie ' in sql:
                    return [TITLE | {'tmdb_id': 1}]
                return []
            def execute(self, sql, args=None):
                self.writes.append(sql)
                return []
        db = Database()
        preview = run(db, at=AT, hydrate=False)
        self.assertEqual(db.writes, [])
        self.assertEqual(preview['counts']['rss']['keep'], 1)
        applied = run(db, apply=True, at=AT, hydrate=False)
        self.assertEqual(applied['counts'], preview['counts'])
        self.assertGreater(len(db.writes), 0)
        self.assertTrue(all('doc.social_relevance' in sql for sql in db.writes))

    def test_writer_refuses_existing_tables_including_in_apply_mode(self):
        from f.social.rejudge import RelevanceCrate
        for apply in (False, True):
            db = RelevanceCrate({}, apply=apply)
            for sql in ('UPDATE doc.social_post SET text=NULL', 'DELETE FROM doc.social_title_link',
                        'REFRESH TABLE doc.social_content_quality', 'DROP TABLE doc.social_relevance',
                        'ALTER TABLE doc.social_relevance ADD COLUMN extra TEXT'):
                with self.subTest(apply=apply, sql=sql), self.assertRaises(ValueError):
                    db.execute(sql)
        with self.assertRaises(ValueError):
            RelevanceCrate({}).execute('REFRESH TABLE doc.social_relevance')

    def test_all_audit_verdicts_and_per_source_release_bar(self):
        sys.path.insert(0, str(Path(__file__).parents[1] / 'tools'))
        from social_relevance_eval import FIXTURE, evaluate
        data = json.loads(FIXTURE.read_text())
        self.assertEqual(len(data['links']), 632)
        self.assertEqual({v['audit_id'] for v in data['verdicts']}, {f'P{i:03}' for i in range(1, 633)})
        self.assertEqual(sum(v['relevant'] for v in data['verdicts']), 327)
        report = evaluate(data)
        self.assertGreaterEqual(report['overall']['precision'], 252 / 272)
        self.assertGreaterEqual(report['top20']['precision'], 40 / 41)
        self.assertGreaterEqual(report['overall']['kept_relevant'], 268)
        for source in ('youtube', 'bluesky'):
            self.assertEqual(report['sources'][source]['precision'], 1)
        for source in ('youtube', 'rss', 'bluesky'):
            counts = report['sources'][source]
            with self.subTest(source=source):
                self.assertGreater(counts['keep'], 0)
                self.assertGreaterEqual(counts['precision'], .9)
                self.assertEqual(counts['kept_relevant'] + counts['relevant_lost'], counts['relevant'])
        self.assertEqual(report['sources']['mastodon']['total'], 0)
        audit = Path(__file__).parents[2] / 'docs/implementation/talked-about-now/relevance-audit-2026-10-15.md'
        lines = [l.split(' | ') for l in audit.read_text().splitlines() if re.match(r'\| P\d{3} ·', l)]
        self.assertEqual(len(lines), 632)
        for parts, label in zip(lines, data['verdicts']):
            self.assertEqual(parts[6] == 'Relevant', label['relevant'])
            self.assertEqual(parts[7], label['reason'])
            self.assertTrue(label['post_id'].startswith(re.search(r'`(.*?)`', parts[0])[1]))
            self.assertEqual(f"{label['media_type']}:{label['media_tmdb_id']}", re.search(r'`(.*?)`', parts[1])[1])


@unittest.skipUnless(os.environ.get('SOCIAL_RELEVANCE_TEST_URL'), 'requires isolated localhost Crate')
class RelevanceCrateTests(unittest.TestCase):
    def test_real_schema_array_reasons_bigint_and_upsert_ordering(self):
        from urllib.parse import urlsplit
        from f.social.rejudge import RelevanceCrate, save
        target = os.environ['SOCIAL_RELEVANCE_TEST_URL']
        if urlsplit(target).hostname not in ('localhost', '127.0.0.1', '::1'):
            self.fail('Integration fixture writes require isolated localhost Crate')
        db = RelevanceCrate({'CRATE_HOSTS': target, 'CRATE_USER': 'crate', 'CRATE_PASS': ''}, apply=True)
        fixture = json.loads((Path(__file__).parent / 'fixtures/social/relevance-2026-10-15.json').read_text())
        sys.path.insert(0, str(Path(__file__).parents[1] / 'tools'))
        from social_relevance_eval import editorial_inputs
        decisions = judge_links(editorial_inputs(fixture), fixture['catalog'], at=AT)
        save(db, decisions)
        self.assertEqual(db.select('SELECT COUNT(*) AS n FROM doc.social_relevance WHERE media_tmdb_id < 5000000000')[0]['n'], 632)
        first = decisions[0]
        save(db, [first | {'status': 'drop', 'judged_at': '2026-10-14T00:00:00Z'}])
        row = db.select('SELECT * FROM doc.social_relevance WHERE media_type=? AND media_tmdb_id=? AND post_id=?',
                        [first['media_type'], first['media_tmdb_id'], first['post_id']])[0]
        self.assertEqual(row['status'], 'keep')
        self.assertEqual(row['reasons'], first['reasons'])
        save(db, [first | {'media_tmdb_id': 5000000000, 'reasons': ['Unicode: Nárnia', 'metrics:{"likes":null}']}])
        row = db.select('SELECT media_tmdb_id,reasons FROM doc.social_relevance WHERE media_tmdb_id=5000000000')[0]
        self.assertEqual(row['media_tmdb_id'], 5000000000)
        self.assertEqual(row['reasons'][0], 'Unicode: Nárnia')


if __name__ == '__main__':
    unittest.main()
