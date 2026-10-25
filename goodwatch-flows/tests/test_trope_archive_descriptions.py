import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'windmill'))
from f.tvtropes_catalog.descriptions import extract_archive_description, extract_description

URL = 'https://tvtropes.org/pmwiki/pmwiki.php/Main/ExactlyWhatIAimedAt'
LEAD = 'The character misses an apparent target, but the shot actually strikes exactly what they intended all along.'


def fragment(lead=LEAD):
    return '''<div id="main-content" class="page-Article"><article id="main-entry">
<input type="hidden" id="groupname-hidden" value="Main">
<input type="hidden" id="title-hidden" value="ExactlyWhatIAimedAt">
<p id="current_url" class="hidden">http://tvtropes.org/pmwiki/pmwiki.php/Main/ExactlyWhatIAimedAt</p>
<h1 class="entry-title"><span class="wrapped_title">Exactly What I Aimed At</span>
<div class="watch_rank_wrap"><span class="thumb-count">10</span><a>Following</a></div></h1>
<div id="main-article"><p><!-- source comment --></p><div class="quoteright">Illustration</div>
<div class="acaptionright">Do not include this caption.</div>''' + lead + '''<p>A complete second explanatory paragraph remains in the actual source order.</p>
<hr><h2>Examples</h2><p>Excluded example text.</p></div></article></div>'''


def record(html=None):
    return {'ns': 'Main', 'id': 'ExactlyWhatIAimedAt', 'article': fragment() if html is None else html}


class ArchiveDescriptionsTest(unittest.TestCase):
    def extract(self, data=None, name='Exactly What I Aimed At', url=URL):
        return extract_archive_description(record() if data is None else data, name, url)

    def test_real_shaped_fragment_uses_actual_body_metadata_without_document_head(self):
        self.assertNotIn('<link', record()['article'])
        result = self.extract()
        self.assertIsNone(result['error'])
        self.assertEqual(result['heading'], 'Exactly What I Aimed At')
        self.assertEqual(result['canonical_url'], URL)
        self.assertEqual(result['description'], LEAD + '\n\nA complete second explanatory paragraph remains in the actual source order.')
        self.assertEqual(set(result), {'description', 'heading', 'canonical_url', 'error'})
        # The HTTP protocol remains strict: body metadata is not an HTTP canonical.
        self.assertIn('canonical', extract_description(record()['article'], 'Exactly What I Aimed At', URL)['error'])

    def test_published_null_error_field_means_the_capture_succeeded(self):
        self.assertEqual(self.extract({**record(), 'err': None}), self.extract())

    def test_json_decoded_original_wording_and_inline_joins_are_preserved(self):
        lead = 'The naïve hero says "keep C:\\new\\file literal" and turns an <em>un</em>usual situation into exactly the intended result.'
        result = self.extract(record(fragment(lead)))
        self.assertIn('naïve', result['description'])
        self.assertIn('"keep C:\\new\\file literal"', result['description'])
        self.assertIn('an unusual situation', result['description'])

    def test_case_only_identity_spelling_and_observed_http_transport_are_allowed(self):
        data = record();data['id'] = data['id'].lower()
        result = self.extract(data, url=URL.lower().replace('/main/', '/Main/'))
        self.assertIsNone(result['error'])
        self.assertEqual(result['canonical_url'], URL)
        self.assertIsNone(self.extract(record(fragment().replace('http://', 'https://')))['error'])

    def test_actual_breadcrumb_heading_excludes_namespace_and_ui_controls(self):
        html = fragment().replace('<span class="wrapped_title">Exactly What I Aimed At</span>', '<div class="wrap-entry-breadcrumb"><strong><span class="ns_parts" style="display:none">Main / </span>Exactly What I Aimed At</strong><div class="aka-title">(aka: Another Label)</div></div>')
        self.assertEqual(self.extract(record(html))['heading'], 'Exactly What I Aimed At')
        self.assertIsNone(self.extract(record(html))['error'])

    def test_missing_unsafe_or_failed_records_are_quarantined(self):
        for data in [None, [], '', {}, {'ns': 'Film', 'id': 'ExactlyWhatIAimedAt', 'article': fragment()}, {**record(), 'id': '../Other'}, {**record(), 'id': ''}, {**record(), 'article': b'bytes'}, {**record(), 'article': ''}, {**record(), 'err': 'failed'}, {**record(), 'error': None}]:
            with self.subTest(record=str(data)[:80]):
                result = extract_archive_description(data, 'Exactly What I Aimed At', URL)
                self.assertIsNone(result['description'])
                self.assertIsNotNone(result['error'])

    def test_each_body_metadata_field_is_required_and_unique(self):
        for field in ['groupname-hidden', 'title-hidden', 'current_url']:
            import re
            pattern = r'<(?:input|p)\b[^>]*id="' + field + r'"[^>]*>(?:[^<]*</p>)?'
            html = fragment();match = re.search(pattern, html);self.assertIsNotNone(match)
            for changed in [html.replace(match.group(0), ''), html.replace(match.group(0), match.group(0) * 2)]:
                with self.subTest(field=field, html=changed):
                    self.assertIsNone(self.extract(record(changed))['description'])

    def test_identity_fields_must_be_real_hidden_metadata(self):
        for html in [fragment().replace('type="hidden"', 'type="text"'), fragment().replace('class="hidden"', 'class="visible"'), fragment().replace('<input type="hidden" id="title-hidden"', '<div type="hidden" id="title-hidden"')]:
            self.assertIsNone(self.extract(record(html))['description'])

    def test_hidden_record_and_known_catalog_identities_must_agree(self):
        for data, url in [
            ({**record(), 'ns': 'Fr'}, URL),
            ({**record(), 'id': 'DifferentPage'}, URL),
            (record(fragment().replace('value="Main"', 'value="Film"')), URL),
            (record(fragment().replace('value="ExactlyWhatIAimedAt"', 'value="DifferentPage"')), URL),
            (record(fragment().replace('Main/ExactlyWhatIAimedAt</p>', 'Main/DifferentPage</p>')), URL),
            (record(), URL + 'DifferentPage'),
            (record(), URL + '?from=Main.OldName'),
            (record(), URL.replace('https:', 'http:')),
        ]:
            with self.subTest(url=url):
                self.assertIsNone(self.extract(data, url=url)['description'])

    def test_current_url_cannot_supply_query_redirect_or_spoofed_origin(self):
        old = 'http://tvtropes.org/pmwiki/pmwiki.php/Main/ExactlyWhatIAimedAt'
        for bad in [old + '?from=Main.OldName', old + '#Examples', old + ';other=1', old.replace('tvtropes.org', 'tvtropes.org.evil.example'), old.replace('tvtropes.org', 'tvtropes.org@evil.example'), old.replace('tvtropes.org', 'tvtropes.org:443'), old.replace('http:', 'ftp:'), old.replace('/Main/', '/Film/')]:
            with self.subTest(current_url=bad):
                self.assertIsNone(self.extract(record(fragment().replace(old, bad)))['description'])

    def test_wrong_name_aka_or_redirected_record_is_not_identity_evidence(self):
        for name in ['A Different Label', 'Another Label', '']:
            html = fragment().replace('Exactly What I Aimed At</span>', 'Exactly What I Aimed At<div class="aka-title">(aka: Another Label)</div></span>')
            self.assertIsNone(self.extract(record(html), name=name)['description'])
        data = record();data['id'] = 'OldName'
        self.assertIsNone(self.extract(data, name='Old Name', url=URL.replace('ExactlyWhatIAimedAt', 'OldName'))['description'])

    def test_original_archive_slug_may_retarget_only_to_real_primary_with_actual_aka(self):
        html = fragment().replace('Exactly What I Aimed At</span>', 'Exactly What I Aimed At<div class="aka-title">(aka: Original Name)</div></span>')
        data = {**record(html), 'id': 'OriginalName'}
        result = self.extract(data)
        self.assertIsNone(result['error'])
        self.assertEqual(result['heading'], 'Exactly What I Aimed At')
        self.assertEqual(result['canonical_url'], URL)
        # An old label paired with the canonical URL has no original-path proof.
        self.assertIsNone(self.extract(data, name='Original Name')['description'])
        alias = self.extract(data, name='Original Name', url=URL.replace('ExactlyWhatIAimedAt', 'OriginalName'))
        self.assertIsNone(alias['error'])
        self.assertEqual(alias['canonical_url'], URL)
        self.assertEqual(alias['description'], result['description'])

    def test_original_alias_requires_exact_original_name_url_and_canonical_primary(self):
        html = fragment().replace('Exactly What I Aimed At</span>', 'Exactly What I Aimed At<div class="aka-title">(aka: Original Name)</div></span>')
        data = {**record(html), 'id': 'OriginalName'}
        old_url = URL.replace('ExactlyWhatIAimedAt', 'OriginalName')
        for name, url in [('Wrong Name', old_url), ('Original Name', URL), ('Original Name', old_url + 'Different'), ('Original Name', old_url + '?from=Main.OriginalName'), ('Original Name', old_url.replace('/Main/', '/Film/')), ('Exactly What I Aimed At', old_url)]:
            with self.subTest(name=name, url=url):
                self.assertIsNone(self.extract(data, name=name, url=url)['description'])
        # Matching hidden identity cannot rescue a different primary H1.
        changed = html.replace('Exactly What I Aimed At<div', 'Different Heading<div')
        self.assertIsNone(self.extract({**record(changed), 'id': 'OriginalName'}, name='Original Name', url=old_url)['description'])

    def test_observed_fictional_color_archive_alias_shape(self):
        html = fragment().replace('ExactlyWhatIAimedAt', 'FictionalColour').replace('Exactly What I Aimed At</span>', 'Fictional Colour<div class="aka-title" style="margin:0">(aka: Fictional Color)</div></span>')
        data = {'ns': 'Main', 'id': 'FictionalColor', 'article': html}
        original_url = URL.replace('ExactlyWhatIAimedAt', 'FictionalColor')
        result = self.extract(data, name='Fictional Color', url=original_url)
        self.assertIsNone(result['error'])
        self.assertEqual(result['heading'], 'Fictional Colour')
        self.assertEqual(result['canonical_url'], original_url.replace('Color', 'Colour'))

    def test_archive_retarget_rejects_absent_wrong_ambiguous_or_nonmain_aka_evidence(self):
        for html in [
            fragment(),
            fragment().replace('Exactly What I Aimed At</span>', 'Exactly What I Aimed At<div class="aka-title">(aka: Different Name)</div></span>'),
            fragment().replace('Exactly What I Aimed At</span>', 'Exactly What I Aimed At<div class="aka-title">(aka: Original Name)</div><div class="aka-title">(aka: Another Name)</div></span>'),
            fragment().replace('Exactly What I Aimed At</span>', 'Exactly What I Aimed At<div class="aka-title">Original Name</div></span>'),
            fragment().replace('Exactly What I Aimed At</span>', 'Exactly What I Aimed At<div class="aka-title">(aka: Original Name)</div></span>').replace('value="Main"', 'value="Film"'),
        ]:
            with self.subTest(html=html):
                self.assertIsNone(self.extract({**record(html), 'id': 'OriginalName'})['description'])
                self.assertIsNone(self.extract({**record(html), 'id': 'OriginalName'}, name='Original Name', url=URL.replace('ExactlyWhatIAimedAt', 'OriginalName'))['description'])

    def test_archive_retarget_still_requires_all_observed_fields_to_match_canonical(self):
        html = fragment().replace('Exactly What I Aimed At</span>', 'Exactly What I Aimed At<div class="aka-title">(aka: Original Name)</div></span>')
        for changed in [html.replace('value="ExactlyWhatIAimedAt"', 'value="DifferentPage"'), html.replace('Main/ExactlyWhatIAimedAt</p>', 'Main/DifferentPage</p>')]:
            self.assertIsNone(self.extract({**record(changed), 'id': 'OriginalName'})['description'])
        self.assertIsNone(self.extract({**record(html), 'id': 'OriginalName', 'ns': 'Film'})['description'])

    def test_duplicate_or_missing_real_article_or_heading_is_quarantined(self):
        for html in [fragment().replace('<h1 ', '<h2 ').replace('</h1>', '</h2>'), fragment().replace('<h1 ', '<h1>Duplicate</h1><h1 '), fragment().replace('id="main-article"', 'id="different-article"'), fragment() + '<div id="main-article"><p>' + LEAD + '</p></div>', fragment().replace('id="main-content"', 'id="different-content"')]:
            self.assertIsNone(self.extract(record(html))['description'])

    def test_real_article_section_h1_is_boundary_not_second_primary_identity(self):
        html = fragment().replace('<hr><h2>Examples</h2>', '<h1>Subtypes and examples</h1>')
        result = self.extract(record(html))
        self.assertIsNone(result['error'])
        self.assertEqual(result['heading'], 'Exactly What I Aimed At')
        self.assertNotIn('Excluded example', result['description'])

    def test_soft_404_and_challenges_are_quarantined_even_with_apparent_identity(self):
        for body in ['There is currently no text in this page, but you can create one if you wish.', 'This page does not exist and could not be found in our database.', 'Checking your browser before you may access this page. Please wait.', '<form id="challenge-form">Verify you are human before continuing.</form>']:
            self.assertIsNone(self.extract(record(fragment(body)))['description'])

    def test_placeholder_and_no_intro_are_not_generated_into_definitions(self):
        html = fragment().replace(LEAD, '').replace('<p>A complete second explanatory paragraph remains in the actual source order.</p>', '')
        self.assertIsNone(self.extract(record(html))['description'])
        html = html.replace('<hr>', '<p><a href="/pmwiki/pmwiki.php/JustForFun/DescribeTopicHere">Describe this trope here using an original description longer than forty characters.</a></p><hr>')
        self.assertIsNone(self.extract(record(html))['description'])


if __name__ == '__main__':
    unittest.main()
