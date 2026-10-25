"""Description extraction and bounded recovery use saved fixtures, never the live site."""
import json
import gzip
import hashlib
from unittest.mock import patch
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import recover_trope_descriptions as runner
from f.critic_sites.polite_http import Page, SiteBlocked

URL = "https://tvtropes.org/pmwiki/pmwiki.php/Main/LowSpeedChase"
LEAD = "A chase takes place at an unexpectedly slow speed, while everyone treats the pursuit with complete seriousness."
HTML = f'<h1>Main / Low-Speed Chase</h1><div id="main-article"><p><!-- note --></p><p><div class="indent">A quotation, not the description.</div></p><p>{LEAD}</p><div class="folder"><p>An example.</p></div></div>'

class DescriptionRecoveryTests(unittest.TestCase):
    def test_skips_empty_and_quotation_paragraphs_before_selecting_the_lead(self):
        self.assertEqual(runner.extract(HTML, "Low-Speed Chase"), (LEAD, None))

    def test_subject_identity_is_required(self):
        text, error = runner.extract(HTML, "A Different Trope")
        self.assertIsNone(text)
        self.assertIn("Heading mismatch", error)

    def test_known_main_urls_only(self):
        self.assertTrue(runner.main_url(URL))
        for url in [URL.replace(".php", "Xphp"), URL.replace("https:", "http:"), URL + "?page=1", URL.replace("Main/", "Film/"), "https://example.com/pmwiki/pmwiki.php/Main/LowSpeedChase"]:
            self.assertFalse(runner.main_url(url))

    def test_block_is_persisted_and_stops_the_batch(self):
        class BlockedClient:
            log = []
            requests = 0
            def get(self, url):
                self.requests += 1
                raise SiteBlocked("tvtropes", datetime.now(timezone.utc) + timedelta(days=1), "HTTP403")
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            queue = root / "queue.json"
            queue.write_text(json.dumps([{"name": "Low-Speed Chase", "url": URL}, {"name": "Other", "url": URL.replace("LowSpeedChase", "Other")}]))
            state = root / "state.json"
            client = BlockedClient()
            result = runner.recover(queue, root / "run", state_path=state, client=client)
            self.assertEqual(client.requests, 1)
            self.assertIn("Blocked", result["stop"])
            self.assertIsNotNone(runner.State(state).blocked(runner.utcnow()))
            with self.assertRaisesRegex(RuntimeError, "blocked"):
                runner.recover(queue, root / "run2", state_path=state, client=client)
            self.assertEqual(client.requests, 1)

    def test_resume_reextracts_saved_pages_without_network_and_preserves_evidence(self):
        real_client = runner.LocalClient
        class NoNetwork:
            def get(self, *args, **kwargs):
                raise AssertionError("A saved response must never be refetched")
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            queue = root / "queue.json"
            queue.write_text(json.dumps([{"name": "Low-Speed Chase", "url": URL}]))
            output = root / "run"
            (output / "sources").mkdir(parents=True)
            body = HTML.encode()
            digest = hashlib.sha256(body).hexdigest()
            source = "sources/" + digest + ".html.gz"
            (output / source).write_bytes(gzip.compress(body))
            old = {"requested_url": URL, "url": URL, "status": 200, "sha256": digest,
                   "started_at": "2026-10-25T08:00:00+00:00", "source_file": source}
            (output / "run.json").write_text(json.dumps({"requests": 1, "log": [old]}))
            with patch.object(runner, "LocalClient", side_effect=lambda sources, delay, budget, saved: real_client(sources, delay, budget, http=NoNetwork(), saved=saved)):
                result = runner.recover(queue, output, state_path=root / "state.json")
            self.assertEqual(result["requests_this_run"], 0)
            self.assertEqual(result["descriptions"], 1)
            self.assertEqual(result["log"][0], old)
            self.assertEqual(json.loads((output / "descriptions.json").read_text())["Low-Speed Chase"]["text"], LEAD)

    def test_redirect_to_a_non_main_page_cannot_be_imported(self):
        class RedirectClient:
            log = []
            requests = 1
            def get(self, url):
                return Page(200, "https://tvtropes.org/pmwiki/pmwiki.php/Film/Other", HTML, url)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            queue = root / "queue.json"
            queue.write_text(json.dumps([{"name": "Low-Speed Chase", "url": URL}]))
            result = runner.recover(queue, root / "run", state_path=root / "state.json", client=RedirectClient())
            self.assertEqual(result["descriptions"], 0)
            self.assertFalse((root / "run/descriptions.json").exists())

if __name__ == "__main__":
    unittest.main()
