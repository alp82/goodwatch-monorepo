import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'windmill'))
from f.tvtropes_catalog.descriptions import extract_document_archive_description, extract_description

BASE = 'https://tvtropes.org/pmwiki/pmwiki.php/Main/'
URL = BASE + 'AbandonedCatchphrase'
LEAD = 'A familiar phrase stops being used by a character after previously appearing regularly throughout the story.'


def document(*, canonical=URL, title='AbandonedCatchphrase', heading='Abandoned Catchphrase', aka='', body=None):
    return '<!doctype html><html><head><title>Actual source document</title><link rel="canonical" href="' + canonical + '"></head><body><div id="main-content"><article id="main-entry"><input type="hidden" id="groupname-hidden" value="Main"><input type="hidden" id="title-hidden" value="' + title + '"><p id="current_url" class="hidden">http://tvtropes.org/pmwiki/pmwiki.php/Main/' + title + '</p><h1 class="entry-title" itemprop="headline">' + heading + ('<div class="aka-title">' + aka + '</div>' if aka else '') + '</h1><div class="article-content retro-folders" id="main-article">' + (body if body is not None else '<p>' + LEAD + '</p><hr><h2>Examples</h2><p>Never include this example.</p>') + '</div></article></div><div id="video-overlay"><h1>Video overlay title</h1></div></body></html>'


class DocumentArchiveDescriptionsTest(unittest.TestCase):
    def extract(self, html=None, *, original=URL, name='Abandoned Catchphrase', known=URL):
        return extract_document_archive_description(original, document() if html is None else html, name, known)

    def test_actual_full_document_metadata_without_fictitious_http_final_url(self):
        result = self.extract()
        self.assertIsNone(result['error'])
        self.assertEqual(result['heading'], 'Abandoned Catchphrase')
        self.assertEqual(result['canonical_url'], URL)
        self.assertEqual(result['description'], LEAD)
        self.assertEqual(set(result), {'description', 'heading', 'canonical_url', 'error'})

    def test_real_2023_aka_without_parentheses_supports_original_alias_uri(self):
        original, canonical = BASE + 'AbandonedSubway', BASE + 'SinisterSubway'
        html = document(canonical=canonical, title='SinisterSubway', heading='Sinister Subway', aka='aka: Abandoned Subway')
        result = self.extract(html, original=original, name='Abandoned Subway', known=original)
        self.assertIsNone(result['error'])
        self.assertEqual(result['heading'], 'Sinister Subway')
        self.assertEqual(result['canonical_url'], canonical)
        # A canonical HTML link is not evidence of an HTTP final-response URL.
        self.assertIsNone(extract_description(html, 'Sinister Subway', original)['description'])

    def test_primary_known_canonical_subject_uses_real_head_and_body(self):
        original, canonical = BASE + 'AbandonedSubway', BASE + 'SinisterSubway'
        html = document(canonical=canonical, title='SinisterSubway', heading='Sinister Subway', aka='aka: Abandoned Subway')
        self.assertIsNone(self.extract(html, original=original, name='Sinister Subway', known=canonical)['error'])
        self.assertIsNone(self.extract(html, original=original, name='Sinister Subway', known=original)['error'])
        self.assertIsNone(self.extract(html, original=original, name='Abandoned Subway', known=canonical)['error'])
        self.assertIsNone(self.extract(html, original=original, name='Abandoned Subway', known=BASE + 'UnrelatedPage')['description'])

    def test_original_route_requires_real_alias_evidence_when_it_differs_from_target(self):
        original, canonical = BASE + 'OldName', BASE + 'SinisterSubway'
        html = document(canonical=canonical, title='SinisterSubway', heading='Sinister Subway')
        # Actual canonical metadata independently supports the canonical subject.
        self.assertIsNone(self.extract(html, original=original, name='Sinister Subway', known=canonical)['error'])
        self.assertIsNone(self.extract(html, original=original, name='Sinister Subway', known=original)['description'])
        self.assertIsNone(self.extract(html, original=original, name='Old Name', known=original)['description'])

    def test_alias_requires_exact_name_original_slug_and_single_actual_aka(self):
        original, canonical = BASE + 'OldName', BASE + 'SinisterSubway'
        good = document(canonical=canonical, title='SinisterSubway', heading='Sinister Subway', aka='aka: Old Name')
        for html, source, name in [(good, BASE + 'DifferentName', 'Old Name'), (good, original, 'A contextual label'), (good.replace('aka: Old Name', 'aka: Different Name'), original, 'Old Name'), (good.replace('aka: Old Name', 'Old Name'), original, 'Old Name'), (good.replace('</h1>', '<div class="aka-title">aka: Other</div></h1>'), original, 'Old Name')]:
            with self.subTest(source=source, name=name):
                self.assertIsNone(self.extract(html, original=source, name=name, known=source)['description'])
        self.assertIsNone(self.extract(good, original=canonical, name='Old Name', known=canonical)['description'])
        self.assertIsNone(self.extract(good, original=canonical + '?from=Main.OldName', name='Old Name', known=canonical)['description'])

    def test_different_known_uri_is_held_despite_matching_primary(self):
        self.assertIsNone(self.extract(known=BASE + 'AnotherPage')['description'])

    def test_overlay_h1s_are_ignored_without_removing_or_cloning_primary(self):
        html = document().replace('<div id="video-overlay">', '<div id="video-overlay"><h1>Extra video title</h1>').replace('</article>', '<div class="video-overlay"><h1>Another overlay inside main content</h1></div></article>')
        self.assertEqual(self.extract(html)['description'], LEAD)

    def test_only_scoped_entry_title_headline_can_identify_subject(self):
        for html in [document().replace('class="entry-title"', 'class="unrelated"'), document().replace('itemprop="headline"', 'itemprop="unrelated"'), document().replace('id="main-content"', 'id="elsewhere"'), document().replace('</h1>', '</h1><h1 class="entry-title" itemprop="headline">Duplicate primary</h1>', 1)]:
            self.assertIsNone(self.extract(html)['description'])

    def test_article_section_h1_remains_an_intro_boundary(self):
        html = document(body='<p>' + LEAD + '</p><h1 class="entry-title" itemprop="headline">Examples</h1><p>Exclude section prose.</p>')
        self.assertEqual(self.extract(html)['description'], LEAD)

    def test_canonical_must_be_one_actual_authored_head_link(self):
        for html in [document().replace('<head>', '').replace('</head>', ''), document().replace('<link rel="canonical" href="' + URL + '">', ''), document().replace('</head>', '<link rel="canonical" href="' + URL + '"></head>'), document().replace('<link rel="canonical" href="' + URL + '">', '').replace('<body>', '<body><link rel="canonical" href="' + URL + '">'), '<div id="main-content"><link rel="canonical" href="' + URL + '"></div>']:
            self.assertIsNone(self.extract(html)['description'])

    def test_head_canonical_cannot_be_supplied_by_comment_or_script(self):
        html = document().replace('<head>', '<!-- <head> -->').replace('</head>', '<!-- </head> -->')
        self.assertIsNone(self.extract(html)['description'])

    def test_all_three_hidden_fields_are_required_unique_hidden_and_inside_content(self):
        for key in ['groupname-hidden', 'title-hidden', 'current_url']:
            match = re.search(r'<(?:input|p)\b[^>]*id="' + key + r'"[^>]*>(?:[^<]*</p>)?', document())
            self.assertIsNotNone(match)
            for changed in [document().replace(match.group(0), ''), document().replace(match.group(0), match.group(0) * 2), document().replace(match.group(0), '').replace('<body>', '<body>' + match.group(0))]:
                self.assertIsNone(self.extract(changed)['description'])
        self.assertIsNone(self.extract(document().replace('type="hidden"', 'type="text"'))['description'])
        self.assertIsNone(self.extract(document().replace('class="hidden"', 'class="visible"'))['description'])

    def test_hidden_namespace_title_current_url_and_head_must_agree(self):
        for html in [document().replace('value="Main"', 'value="Film"'), document().replace('value="AbandonedCatchphrase"', 'value="OtherPage"'), document().replace('Main/AbandonedCatchphrase</p>', 'Main/OtherPage</p>'), document(canonical=BASE + 'OtherPage')]:
            self.assertIsNone(self.extract(html)['description'])

    def test_bare_main_urls_reject_encoded_paths_queries_fragments_and_spoofed_hosts(self):
        for bad in [URL + '?from=Main.OldName', URL + '#Examples', URL + ';bad=1', URL.replace('AbandonedCatchphrase', '%41bandonedCatchphrase'), URL.replace('tvtropes.org', 'tvtropes.org.evil.example'), URL.replace('tvtropes.org', 'tvtropes.org@evil.example'), URL.replace('tvtropes.org', 'tvtropes.org:443'), URL.replace('/Main/', '/Film/'), ' ' + URL]:
            with self.subTest(url=bad):
                self.assertIsNone(self.extract(original=bad)['description'])
                self.assertIsNone(self.extract(known=bad)['description'])
                self.assertIsNone(self.extract(document(canonical=bad))['description'])
        self.assertIsNone(self.extract(document().replace('AbandonedCatchphrase</p>', 'AbandonedCatchphrase?from=Main.OldName</p>'))['description'])

    def test_historical_http_metadata_and_case_only_slug_spelling_normalize_safely(self):
        html = document(canonical=URL.replace('https:', 'http:')).replace('value="AbandonedCatchphrase"', 'value="abandonedcatchphrase"')
        result = self.extract(html, original=URL.replace('https:', 'http:'), known=BASE + 'abandonedcatchphrase')
        self.assertIsNone(result['error'])
        self.assertEqual(result['canonical_url'], URL)
        self.assertIsNone(self.extract(known=URL.replace('https:', 'http:'))['description'])

    def test_unavailable_challenge_and_disambiguation_bodies_are_quarantined(self):
        for body in ['<p>We don\'t have an article named Main/AbandonedCatchphrase. You can create this page.</p>', '<p>This page does not exist and was not found in the site database.</p>', '<form id="challenge-form">Verify you are human</form><p>' + LEAD + '</p>', '<p>Abandoned Catchphrase may refer to:</p><ul><li>A show title</li><li>A character</li></ul>', '<p>This is a disambiguation page occupying this former article title.</p>', '<p>A link somewhere has led you here. You may be looking for:</p><p>Several different works.</p>']:
            self.assertIsNone(self.extract(document(body=body))['description'])

    def test_shared_cleanup_preserves_numeric_notation_inline_words_and_literal_backslashes(self):
        body = r'<div class="quoteright">Caption excluded</div><p>The un<em>usual</em> equation x<sup>2</sup> is preserved alongside literal C:\new\file rather than decoded escapes.</p><hr>'
        text = self.extract(document(body=body))['description']
        self.assertIn('unusual equation x²', text)
        self.assertIn(r'C:\new\file', text)
        self.assertNotIn('Caption', text)

    def test_disambiguation_is_still_rejected_after_verified_leading_admin_notice(self):
        notice = '<h2>This page is <a href="https://tvtropes.org/pmwiki/posts.php?discussion=17289715800.37750000">under review</a> in the <a href="/pmwiki/pmwiki.php/Administrivia/TropeRepairShop">Trope Repair Shop</a>.</h2>'
        html = document(body=notice + '<p>The title may refer to several different works or unrelated character tropes.</p><ul><li>A film</li><li>A book</li></ul>')
        self.assertIn('disambiguation', self.extract(html)['error'])

    def test_invalid_inputs_missing_structure_and_wrong_name_are_rejected(self):
        for html in [None, '', b'bytes', 42]:
            self.assertIsNone(extract_document_archive_description(URL, html, 'Abandoned Catchphrase', URL)['description'])
        for html in [document().replace('id="main-article"', 'id="missing"'), document().replace('</article>', '<div id="main-article"></div></article>')]:
            self.assertIsNone(self.extract(html)['description'])
        self.assertIsNone(self.extract(name='Another Name')['description'])


if __name__ == '__main__':
    unittest.main()
