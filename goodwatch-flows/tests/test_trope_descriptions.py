"""Full, source-faithful general introductions: no network, database, or generated definitions."""
import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "windmill"))
from f.tvtropes_catalog.descriptions import extract_description, MAX_DESCRIPTION_BYTES

URL = "https://tvtropes.org/pmwiki/pmwiki.php/Main/SeriousBusiness"
LEAD = "Serious Business is when a story treats an otherwise ordinary pastime as an activity of enormous importance."
SECOND = "Characters may base their entire lives on that activity and react to setbacks as if the world were ending."


def page(body, *, heading="Main / Serious Business", canonical=URL):
    return f'<html><head><link rel="canonical" href="{canonical}"></head><body><div id="main-content"><h1>{heading}</h1><div id="main-article">{body}</div></div></body></html>'


class TropeDescriptionTests(unittest.TestCase):
    def extract(self, html, name="Serious Business", url=URL):
        return extract_description(html, name, url)

    def test_preserves_all_complete_intro_paragraphs_instead_of_first_two_or_four_sentences(self):
        paras = [f"Introductory paragraph {i} explains a different part of the same narrative convention." for i in range(8)]
        result = self.extract(page("".join(f"<p>{p}</p>" for p in paras) + '<hr><h2>Examples</h2><p>Do not include this example.</p>'))
        self.assertIsNone(result["error"])
        self.assertEqual(result["description"], "\n\n".join(paras))

    def test_browser_parsing_repairs_paragraphs_wrapping_quote_divs(self):
        html = page(f'<p><div class="indent">Opening quotation, not the definition.<div class="indent">— A speaker</div></div></p><p>{LEAD}</p><p>{SECOND}</p><hr><p>Example detail.</p>')
        self.assertEqual(self.extract(html)["description"], LEAD + "\n\n" + SECOND)

    def test_premature_article_close_uses_only_bounded_main_content_continuation(self):
        html = f'<html><head><link rel="canonical" href="{URL}"></head><body><div id="main-content"><h1>Serious Business</h1><div id="main-article"><p>First, consider the common setup that introduces this sort of story.</p></div><div class="tvtropes-ad-unit"><p>Advertisement.</p></div><p>{LEAD}</p><p>{SECOND}</p><hr><h2>Examples</h2><p>An example that must not enter the definition.</p></div><footer><p>Another unrelated article.</p></footer></body></html>'
        result = self.extract(html)
        self.assertIn(LEAD, result["description"])
        self.assertIn(SECOND, result["description"])
        self.assertNotIn("example", result["description"].lower())
        self.assertNotIn("Advertisement", result["description"])
        self.assertNotIn("unrelated", result["description"])

    def test_does_not_use_unbounded_continuation_outside_article(self):
        html = f'<html><head><link rel="canonical" href="{URL}"></head><body><div id="main-content"><h1>Serious Business</h1><div id="main-article"></div><p>{LEAD}</p></div></body></html>'
        result = self.extract(html)
        self.assertIsNone(result["description"])
        self.assertIn("Unbounded", result["error"])

    def test_fallback_cannot_escape_main_content(self):
        html = f'<html><head><link rel="canonical" href="{URL}"></head><body><div id="main-content"><h1>Serious Business</h1><div id="main-article"></div></div><p>{LEAD}</p><hr></body></html>'
        self.assertIsNone(self.extract(html)["description"])

    def test_removes_quotes_captions_ads_hidden_notes_and_inline_folders(self):
        body = f'''<div class="quoteright"><p>Image quotation.</p></div><div class="acaptionright">Image caption.</div>
          <blockquote><p>A substantial epigraph is not an introduction.</p></blockquote>
          <p>"A plain paragraph quotation is not an introduction." — Speaker</p>
          <div class="indent">Another quotation.</div>
          <div class="tvtropes-ad-unit"><p>Advertisement.</p></div>
          <p><a href="/pmwiki/pmwiki.php/JustForFun/DescribeTopicHere">Describe this topic here.</a></p>
          <p>{LEAD}<span class="notelabel">note</span><span class="notetext">Hidden footnote text.</span></p>
          <p hidden>Hidden attribute.</p><p aria-hidden="true">Aria-hidden text.</p><p style="display:none">Hidden style.</p>
          <div class="inlinefolder"><p>Hidden spoiler folder.</p></div><p>{SECOND}</p><hr>'''
        result = self.extract(page(body))
        self.assertEqual(result["description"], LEAD + "\n\n" + SECOND)

    def test_stops_at_first_rule_heading_or_examples_folder(self):
        for boundary in ['<hr>', '<h2>Examples:</h2>', '<h3>Film examples</h3>', '<p>Examples:</p>', '<div class="folderlabel">open/close all folders</div>', '<div class="folder"><p>Example content.</p></div>']:
            with self.subTest(boundary=boundary):
                result = self.extract(page(f'<p>{LEAD}</p>{boundary}<p>Example content is not part of the definition.</p>'))
                self.assertEqual(result["description"], LEAD)

    def test_explicit_redirect_hatnote_is_metadata_not_a_definition_boundary(self):
        body = f'<h3>The word "Hypocrisy" redirects to this page. For the band, see <a href="/pmwiki/pmwiki.php/Music/Hypocrisy">Hypocrisy</a>.</h3><p>{LEAD}</p><hr>'
        self.assertEqual(self.extract(page(body))["description"], LEAD)

    def test_missing_html5lib_dependency_has_a_clear_error(self):
        from unittest.mock import patch
        from bs4 import FeatureNotFound
        with patch("f.tvtropes_catalog.descriptions.BeautifulSoup", side_effect=FeatureNotFound("parser unavailable")):
            result = self.extract(page(f'<p>{LEAD}</p><hr>'))
        self.assertIsNone(result["description"])
        self.assertIn("html5lib parser dependency", result["error"])

    def test_early_examples_boundary_cannot_be_skipped_to_find_a_longer_description(self):
        result = self.extract(page(f'<h2>Examples</h2><p>{LEAD}</p>'))
        self.assertIsNone(result["description"])

    def test_inline_markup_does_not_split_words_and_br_provides_spacing(self):
        result = self.extract(page('<p>A character displays <em>un</em>usual intensity when playing an <a>ordinary game</a>.<br>The activity matters deeply to them.</p><hr>'))
        self.assertEqual(result["description"], 'A character displays unusual intensity when playing an ordinary game. The activity matters deeply to them.')

    def test_keeps_complete_paragraphs_at_utf8_limit(self):
        first = LEAD
        second = "é" * 11_900 + "."
        third = SECOND
        result = self.extract(page(f'<p>{first}</p><p>{second}</p><p>{third}</p><hr>'))
        self.assertIsNone(result["error"])
        self.assertLessEqual(len(result["description"].encode("utf-8")), MAX_DESCRIPTION_BYTES)
        self.assertTrue(result["description"].endswith(second))
        self.assertNotIn(third, result["description"])

    def test_rejects_single_oversized_paragraph_without_truncating_words(self):
        result = self.extract(page('<p>' + 'é' * 12_001 + '.</p><hr>'))
        self.assertIsNone(result["description"])
        self.assertIn("byte budget", result["error"])

    def test_normalizes_accent_case_and_punctuation_for_subject_identity(self):
        result = self.extract(page(f'<p>{LEAD}</p><hr>', heading='Main / SÉRIOUS-Business!'), 'Serious Business')
        self.assertIsNone(result["error"])
        self.assertEqual(result["heading"], 'SÉRIOUS-Business!')

    def test_heading_must_match_requested_subject(self):
        result = self.extract(page(f'<p>{LEAD}</p><hr>', heading='Wrong Trope'))
        self.assertIsNone(result["description"])
        self.assertIn('Heading mismatch', result["error"])

    def test_final_url_and_canonical_must_be_the_same_known_main_page(self):
        html = page(f'<p>{LEAD}</p><hr>')
        for bad in [URL.replace('https:', 'http:'), URL.replace('/Main/', '/Film/'), URL + '?page=2', URL.replace('tvtropes.org', 'example.com')]:
            with self.subTest(url=bad):
                self.assertIsNone(self.extract(html, url=bad)["description"])
        for canonical in [URL.replace('Business', 'Other'), URL.replace('/Main/', '/Film/'), URL + '?page=2', URL.replace('tvtropes.org', 'example.com')]:
            with self.subTest(canonical=canonical):
                result = self.extract(page(f'<p>{LEAD}</p><hr>', canonical=canonical))
                self.assertIsNone(result["description"])
                self.assertIn('Canonical', result["error"])

    def test_wiki_from_breadcrumb_and_final_fragment_do_not_change_a_verified_primary_subject(self):
        html = page(f'<p>{LEAD}</p><hr>', heading='Serious Business<div class="aka-title">(aka: Old Name)</div>')
        for suffix in ['?from=Main.OldName', '?from=Main.OldName#Examples', '#Examples']:
            with self.subTest(suffix=suffix):
                result = self.extract(html, url=URL + suffix)
                self.assertIsNone(result["error"])
                self.assertEqual(result["heading"], 'Serious Business')
                self.assertEqual(result["canonical_url"], URL)
                self.assertEqual(result["description"], LEAD)

    def test_aka_breadcrumb_cannot_make_an_alias_the_verified_primary_subject(self):
        html = page(f'<p>{LEAD}</p><hr>', heading='Serious Business<div class="aka-title">(aka: Old Name)</div>')
        result = self.extract(html, name='Old Name', url=URL + '?from=Main.OldName')
        self.assertIsNone(result["description"])
        self.assertIn('Heading mismatch', result["error"])
        self.assertEqual(result["heading"], 'Serious Business')

    def test_www_is_only_a_hostname_spelling_not_another_page_identity(self):
        for final, canonical in [(URL.replace('://', '://www.'), URL), (URL, URL.replace('://', '://www.'))]:
            result = self.extract(page(f'<p>{LEAD}</p><hr>', canonical=canonical), url=final)
            self.assertIsNone(result["error"])
            self.assertEqual(result["canonical_url"], URL)
        for bad in [URL.replace('tvtropes.org', 'evil-tvtropes.org'), URL.replace('tvtropes.org', 'tvtropes.org.evil.com'), URL.replace('tvtropes.org', 'user@tvtropes.org'), URL.replace('tvtropes.org', 'tvtropes.org:443')]:
            self.assertIsNone(self.extract(page(f'<p>{LEAD}</p><hr>'), url=bad)["description"])

    def test_only_one_known_main_from_parameter_is_harmless(self):
        for suffix in ['?from=Main.OldName&other=1', '?from=Main.OldName&from=Main.Other', '?from=Film.OldName', '?from=', '?from=Main.', '?page=2', ';unexpected=1']:
            with self.subTest(suffix=suffix):
                self.assertIsNone(self.extract(page(f'<p>{LEAD}</p><hr>'), url=URL + suffix)["description"])
        for suffix in ['?from=Main.OldName', '#Examples']:
            with self.subTest(canonical_suffix=suffix):
                self.assertIsNone(self.extract(page(f'<p>{LEAD}</p><hr>', canonical=URL + suffix))["description"])

    def test_rejects_missing_or_ambiguous_canonical(self):
        for html in [page(f'<p>{LEAD}</p><hr>').replace(f'<link rel="canonical" href="{URL}">', ''), page(f'<p>{LEAD}</p><hr>', canonical=''), page(f'<p>{LEAD}</p><hr>').replace('</head>', '<link rel="canonical" href="https://tvtropes.org/pmwiki/pmwiki.php/Main/Other"></head>')]:
            self.assertIsNone(self.extract(html)["description"])

    def test_empty_or_short_introductions_are_explicit_failures(self):
        for html in ['', page('<p>Only short text.</p><hr>'), page('<div class="indent">A quotation long enough to pass a naive character count.</div><hr>')]:
            result = self.extract(html)
            self.assertIsNone(result["description"])
            self.assertIsNotNone(result["error"])


if __name__ == '__main__':
    unittest.main()
