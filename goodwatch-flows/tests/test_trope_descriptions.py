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

    def test_real_shaped_image_caption_then_bare_linked_definition_keeps_the_first_paragraph(self):
        definition = "A trope in comedy and other entertainment, Naked Apron is the practice of wearing an apron over otherwise minimal clothing."
        body = ('<p><!--intro image comment--><div class="quoteright"><a><img alt="Image alt text"></a></div>'
                '<div class="acaptionright">An image caption, not the definition.</div>'
                '<!--caption repair instructions-->A trope in <a href="/Main/Comedy">comedy</a> and other entertainment, '
                'Naked Apron is the practice of wearing an apron over otherwise minimal clothing.</p>'
                '<p>The historical paragraph belongs after the actual definition, not before it.</p><hr>'
                '<p>Examples do not belong in this definition.</p>')
        result = self.extract(page(body))
        self.assertIsNone(result["error"])
        self.assertEqual(result["description"], definition + "\n\nThe historical paragraph belongs after the actual definition, not before it.")
        self.assertNotIn('caption', result["description"])
        self.assertNotIn('repair instructions', result["description"])
        self.assertNotIn('Examples', result["description"])

    def test_bare_intro_only_is_a_complete_paragraph(self):
        body = 'A character treats an <em>un</em>usual game as <a>serious business</a>, even when everybody else is relaxed.<hr><p>Example.</p>'
        result = self.extract(page(body))
        self.assertEqual(result["description"], 'A character treats an unusual game as serious business, even when everybody else is relaxed.')

    def test_nested_bare_runs_preserve_order_and_inline_word_boundaries(self):
        body = ('<div>A <strong>nested</strong> definition explains the central convention in complete prose.'
                '<section>Another bare <a>inline link</a> continues the explanation without inserting extra spaces before punctuation!</section>'
                'The original wrapper then carries on with its own remaining explanation.'
                '<p>A genuine paragraph follows the surrounding bare text.</p></div><hr>')
        result = self.extract(page(body))
        self.assertEqual(result["description"], 'A nested definition explains the central convention in complete prose.\n\n'
                         'Another bare inline link continues the explanation without inserting extra spaces before punctuation!\n\n'
                         'The original wrapper then carries on with its own remaining explanation.\n\n'
                         'A genuine paragraph follows the surrounding bare text.')

    def test_bare_examples_label_stops_before_bare_examples(self):
        body = f'<p>{LEAD}</p>Examples:<div>Examples must never become part of the general introduction.</div>'
        self.assertEqual(self.extract(page(body))["description"], LEAD)

    def test_bare_quotes_comments_and_sidebars_are_not_article_definitions(self):
        body = f'<!--A long hidden comment is not prose.--><span class="caption">Caption text.</span><div class="indent">Quotation.</div>{LEAD}<aside>Bare sidebar text is not an introduction.</aside>Unrelated text after sidebar.'
        result = self.extract(page(body))
        self.assertEqual(result["description"], LEAD)
        self.assertNotIn('sidebar', result["description"])

    def test_premature_article_close_keeps_bare_continuation_before_its_boundary(self):
        html = f'<html><head><link rel="canonical" href="{URL}"></head><body><div id="main-content"><h1>Serious Business</h1><div id="main-article"><p>Opening context is still part of the introduction.</p></div>{LEAD}<p>{SECOND}</p><hr>Bare examples must not be copied.</div>Unrelated sidebar text outside main content.</body></html>'
        result = self.extract(html)
        self.assertEqual(result["description"], 'Opening context is still part of the introduction.\n\n' + LEAD + "\n\n" + SECOND)

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

    def test_verified_requested_slug_and_exact_source_redirect_accept_an_old_name(self):
        requested = URL.replace('SeriousBusiness', 'OldName')
        html = page(f'<p>{LEAD}</p><hr>', heading='Serious Business<div class="aka-title">(aka: Old Name)</div>')
        final = URL + '?from=Main.OldName'
        for name in ['Old Name', 'OLD—Name!']:
            with self.subTest(name=name):
                result = extract_description(html, name, final, requested_url=requested)
                self.assertIsNone(result["error"])
                self.assertEqual(result["heading"], 'Serious Business')
                self.assertEqual(result["canonical_url"], URL)
                self.assertEqual(result["description"], LEAD)
        self.assertIsNone(extract_description(html, 'Old Name', final)["description"])

    def test_requested_url_does_not_replace_explicit_redirect_evidence(self):
        html = page(f'<p>{LEAD}</p><hr>')
        requested = URL.replace('SeriousBusiness', 'OldName')
        for final in [URL, URL + '#Examples']:
            result = extract_description(html, 'Old Name', final, requested_url=requested)
            self.assertIsNone(result["description"])
            self.assertIn('Heading mismatch', result["error"])

    def test_alias_requires_bare_https_requested_main_url(self):
        requested = URL.replace('SeriousBusiness', 'OldName')
        html = page(f'<p>{LEAD}</p><hr>')
        for bad in [requested.replace('https:', 'http:'), requested.replace('://', '://www.'), requested + '?from=Main.Other', requested + '?', requested + '#Examples', requested + '#', requested.replace('/Main/', '/Film/'), requested + ';unexpected=1', ' ' + requested]:
            with self.subTest(requested_url=bad):
                result = extract_description(html, 'Old Name', URL + '?from=Main.OldName', requested_url=bad)
                self.assertIsNone(result["description"])

    def test_redirect_from_must_identify_the_requested_slug_and_be_the_only_query(self):
        requested = URL.replace('SeriousBusiness', 'OldName')
        html = page(f'<p>{LEAD}</p><hr>')
        for query in ['from=Main.OtherName', 'from=Main.OldNames', 'from=Main.OldName&from=Main.OldName', 'from=Main.OldName&other=1', 'from=Film.OldName']:
            with self.subTest(query=query):
                result = extract_description(html, 'Old Name', URL + '?' + query, requested_url=requested)
                self.assertIsNone(result["description"])

    def test_source_redirect_breadcrumb_can_normalize_old_slug_capitalization(self):
        requested = URL.replace('SeriousBusiness', 'AcCENTOnTheWrongSylLABle')
        canonical = URL.replace('SeriousBusiness', 'AccentUponTheWrongSyllable')
        html = page(f'<p>{LEAD}</p><hr>', heading='AcCENT upon the Wrong SylLABle', canonical=canonical)
        final = canonical + '?from=Main.AccentOnTheWrongSyllable'
        result = extract_description(html, 'Ac CENT On The Wrong Syl LA Ble', final, requested_url=requested)
        self.assertIsNone(result["error"])
        self.assertEqual(result["canonical_url"], canonical)
        self.assertIsNone(extract_description(html, 'An Unrelated Label', final, requested_url=requested)["description"])

    def test_contextual_labels_cannot_claim_another_requested_slug(self):
        html = page(f'<p>{LEAD}</p><hr>')
        for name, slug in [('"Die Hard" on a Submarine', 'DieHardOnAnX'), ('"Stop Having Fun" Girl', 'StopHavingFunGuy'), ('A literal dialogue quotation', 'HypocriticalHumor')]:
            with self.subTest(name=name):
                result = extract_description(html, name, URL + '?from=Main.' + slug, requested_url=URL.replace('SeriousBusiness', slug))
                self.assertIsNone(result["description"])
                self.assertIn('Heading mismatch', result["error"])

    def test_self_from_query_is_not_a_redirect_to_a_new_primary_page(self):
        html = page(f'<p>{LEAD}</p><hr>', heading='A Different Primary Name')
        result = extract_description(html, 'Serious Business', URL + '?from=Main.SeriousBusiness', requested_url=URL)
        self.assertIsNone(result["description"])
        self.assertIn('Heading mismatch', result["error"])

    def test_alias_redirect_still_requires_matching_final_canonical_and_nonempty_primary_heading(self):
        requested = URL.replace('SeriousBusiness', 'OldName')
        final = URL + '?from=Main.OldName'
        for html in [page(f'<p>{LEAD}</p><hr>', canonical=URL.replace('SeriousBusiness', 'DifferentPage')), page(f'<p>{LEAD}</p><hr>', canonical=''), page(f'<p>{LEAD}</p><hr>', heading='')]:
            with self.subTest(html=html):
                result = extract_description(html, 'Old Name', final, requested_url=requested)
                self.assertIsNone(result["description"])

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

    def test_source_canonical_can_correct_slug_case_without_changing_the_subject(self):
        cases = [
            ("A Day In The Lime Light", "ADayInTheLimeLight", "ADayInTheLimelight", "A Day in the Limelight"),
            ("A Death In The Lime Light", "ADeathInTheLimeLight", "ADeathInTheLimelight", "A Death in the Limelight"),
            ("A Dick Inname", "ADickInname", "ADickInName", "A Dick in Name"),
        ]
        for name, served_slug, canonical_slug, heading in cases:
            served = URL.rsplit("/", 1)[0] + "/" + served_slug
            canonical = URL.rsplit("/", 1)[0] + "/" + canonical_slug
            html = page(f'<p>{LEAD}</p><hr>', heading=heading, canonical=canonical)
            with self.subTest(name=name):
                result = self.extract(html, name=name, url=served)
                self.assertIsNone(result["error"])
                self.assertEqual(result["canonical_url"], canonical)
                self.assertIsNone(self.extract(html, name="Unrelated Label", url=served)["description"])
                self.assertIsNone(self.extract(html, name=name, url=served + "Other")["description"])

    def test_leading_small_media_disambiguation_preserves_area51_intro(self):
        hatnote = '''<h3><span class="font-s">For the film, see <em><a href="/pmwiki/pmwiki.php/Film/Area512015">Area 51 (2015)</a></em>.
        For the <a href="/pmwiki/pmwiki.php/Main/Seinen">Seinen</a> manga, see <a href="/pmwiki/pmwiki.php/Manga/Area51Seinen">Area 51 (Seinen)</a>.
        For the game, see <a href="/pmwiki/pmwiki.php/VideoGame/Area51FPS">Area 51 (FPS)</a>.</span></h3>'''
        lead = 'A top-secret United States Air Force base in the Nevada desert, associated in fiction with aliens and government conspiracies.'
        html = page('<p><!-- empty lead --></p>' + hatnote + '<div class="quoteright">Image</div><div class="acaptionright">Caption</div><p>' + lead + '</p><hr><h2>Examples</h2><p>Exclude this example.</p>', heading='Area 51', canonical=URL.replace('SeriousBusiness', 'Area51'))
        result = self.extract(html, name='AREA 51', url=URL.replace('SeriousBusiness', 'AREA51'))
        self.assertIsNone(result['error'])
        self.assertEqual(result['description'], lead)

    def test_only_leading_media_disambiguation_is_skipped(self):
        hatnote = '<h4><span class="font-s">For the film, see <a href="/pmwiki/pmwiki.php/Film/OtherWork">Other Work</a>.</span></h4>'
        for intro in ['<p>' + LEAD + '</p>', LEAD]:
            result = self.extract(page(intro + hatnote + '<p>Later section text must never become part of the introduction.</p><hr>'))
            self.assertEqual(result['description'], LEAD)

    def test_leading_series_disambiguation_uses_the_known_series_namespace(self):
        note = '<h3><span class="font-s">For the television series, see <a href="/pmwiki/pmwiki.php/Series/OtherWork">Other Work</a>.</span></h3>'
        self.assertEqual(self.extract(page(note + '<p>' + LEAD + '</p><hr>'))["description"], LEAD)

    def test_small_headings_and_examples_navigation_still_stop(self):
        for heading in [
            '<h3><span class="font-s">Examples</span></h3>',
            '<h3><span class="font-s">For examples, see <a href="/pmwiki/pmwiki.php/Film/OtherWork">Other Work</a>.</span></h3>',
            '<h3><span class="font-s">For the trope, see <a href="/pmwiki/pmwiki.php/Main/OtherTrope">Other Trope</a>.</span></h3>',
            '<h3>For the film, see <a href="/pmwiki/pmwiki.php/Film/OtherWork">Other Work</a>.</h3>',
            '<h3><span class="font-s">Background and development</span></h3>',
            '<h3><span class="font-s">For the film, see <a href="https://unrelated.example/pmwiki/pmwiki.php/Film/OtherWork">Other Work</a>.</span></h3>',
        ]:
            with self.subTest(heading=heading):
                result = self.extract(page(heading + '<p>' + LEAD + '</p><hr>'))
                self.assertIsNone(result['description'])

    def test_media_hatnote_is_not_skipped_in_fallback_outside_article(self):
        hatnote = '<h3><span class="font-s">For the film, see <a href="/pmwiki/pmwiki.php/Film/OtherWork">Other Work</a>.</span></h3>'
        html = page('<p>' + LEAD + '</p>').replace('</article>', '</article>' + hatnote + '<p>Outside section text must be excluded from this introduction.</p><hr>')
        self.assertEqual(self.extract(html)['description'], LEAD)

    def test_known_underscore_routes_are_preserved_without_guessing_a_slug(self):
        known = URL.rsplit("/", 1)[0] + "/Time_Slip"
        html = page(f'<p>{LEAD}</p><hr>', heading="Time Slip", canonical=known)
        result = self.extract(html, name="Time_Slip", url=known)
        self.assertIsNone(result["error"])
        self.assertEqual(result["canonical_url"], known)
        target = URL.rsplit("/", 1)[0] + "/NewName"
        html = page(f'<p>{LEAD}</p><hr>', heading="New Name", canonical=target)
        result = extract_description(html, "Time_Slip", target + "?from=Main.Time_Slip", requested_url=known)
        self.assertIsNone(result["error"])

    def test_leading_verified_repair_notice_preserves_real_intro(self):
        notice = '<h2> This page is <a href="https://tvtropes.org/pmwiki/posts.php?discussion=17289715800.37750000">under review</a> in the <a href="/pmwiki/pmwiki.php/Administrivia/TropeRepairShop">Trope Repair Shop</a>.</h2>'
        lead = 'Media with a prominent focus on Black American people, whether it be historical or contemporary. Exploration of racial identity is common in these works, though the subject can also be highly varied.'
        guidance = 'We ask to list works with African-Americans in central roles as opposed to periphery roles.'
        body = '<p></p>' + notice + '<div class="indent">A long opening quotation is not part of the definition.</div><p>' + lead + '</p><p>' + guidance + '</p><hr><div class="folderlabel">Works</div><p>Excluded work example.</p>'
        result = self.extract(page(body))
        self.assertIsNone(result['error'])
        self.assertEqual(result['description'], lead + '\n\n' + guidance)

    def test_repair_notice_lookalikes_do_not_remove_heading_boundaries(self):
        notice = '<h2>This page is <a href="https://tvtropes.org/pmwiki/posts.php?discussion=17289715800.37750000">under review</a> in the <a href="/pmwiki/pmwiki.php/Administrivia/TropeRepairShop">Trope Repair Shop</a>.</h2>'
        for bad in [
            notice.replace('/Administrivia/TropeRepairShop', '/Main/TropeRepairShop'),
            notice.replace('/Administrivia/TropeRepairShop', '/Administrivia/TropeRepairShopExtra'),
            notice.replace('href="/pmwiki/pmwiki.php/', 'href="https://tvtropes.org.evil.example/pmwiki/pmwiki.php/'),
            notice.replace('href="/pmwiki/pmwiki.php/', 'href="https://tvtropes.org@evil.example/pmwiki/pmwiki.php/'),
            notice.replace('https://tvtropes.org/pmwiki/posts.php', 'https://evil.example/pmwiki/posts.php'),
            notice.replace('TropeRepairShop"', 'TropeRepairShop?other=1"'),
            notice.replace('TropeRepairShop"', 'TropeRepairShop#Examples"'),
            notice.replace('This page is', 'Examples are'),
            notice.replace('under review', 'an example'),
            notice.replace('h2', 'h3'),
            '<h2>Examples</h2>',
        ]:
            with self.subTest(notice=bad):
                self.assertIsNone(self.extract(page(bad + '<p>' + LEAD + '</p><hr>'))['description'])

    def test_later_repair_notice_and_notice_outside_article_remain_boundaries(self):
        notice = '<h2>This page is <a href="https://tvtropes.org/pmwiki/posts.php?discussion=17289715800.37750000">under review</a> in the <a href="/pmwiki/pmwiki.php/Administrivia/TropeRepairShop">Trope Repair Shop</a>.</h2>'
        for lead in ['<p>' + LEAD + '</p>', LEAD]:
            result = self.extract(page(lead + notice + '<p>Later section must not enter the introduction.</p><hr>'))
            self.assertEqual(result['description'], LEAD)
        html = page('<p>' + LEAD + '</p>').replace('</article>', '</article>' + notice + '<p>Outside content must be excluded.</p><hr>')
        self.assertEqual(self.extract(html)['description'], LEAD)

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
