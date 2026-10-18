import base64
from datetime import timedelta
from io import BytesIO
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET
sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.social import images
from f.social.common import now
from f.social.store import Store


class DB:
    def __init__(self, old=None, active=True):
        self.old, self.active, self.writes = old, active, []
    def select(self, sql, args=None):
        if 'FROM doc.social_image' in sql:
            return [self.old] if self.old else []
        return [{'post_id': 'p'}] if self.active else []
    def execute(self, sql, args=None):
        self.writes.append((sql, args))


class Images(unittest.TestCase):
    def test_feed_precedence_and_relative_html(self):
        entry = ET.fromstring('''<item xmlns:m="http://search.yahoo.com/mrss/"><m:thumbnail url="/thumb"/><enclosure type="image/png" url="/enclosure"/><description>&lt;img src="/html"&gt;</description></item>''')
        self.assertEqual(images.rss_image(entry, 'https://example.com/story'), 'https://example.com/thumb')
        entry.remove(entry[0])
        self.assertEqual(images.rss_image(entry, 'https://example.com/story'), 'https://example.com/enclosure')
        entry.remove(entry[0])
        self.assertEqual(images.rss_image(entry, 'https://example.com/story'), 'https://example.com/html')

    def test_embeds(self):
        embed = {'$type': 'app.bsky.embed.external#view', 'external': {'thumb': 'thumb'}}
        self.assertEqual(images.bluesky_image({'embed': embed}), 'thumb')
        self.assertEqual(images.bluesky_image({'embed': {'$type': 'app.bsky.embed.recordWithMedia#view', 'media': embed}}), 'thumb')
        self.assertEqual(images.bluesky_image({'embed': {'$type': 'app.bsky.embed.images#view', 'images': [{'thumb': 'first'}, {'thumb': 'second'}]}}), 'first')
        self.assertEqual(images.mastodon_image({'card': {'image': 'card'}, 'media_attachments': [{'type': 'image', 'preview_url': 'media'}]}), 'card')

    def test_private_and_non_http_rejected(self):
        for url in ['file:///etc/passwd', 'http://127.0.0.1/a', 'http://[::1]/a', 'http://169.254.169.254/a']:
            with self.assertRaises(ValueError):
                images.fetch(url)

    def test_encode(self):
        from PIL import Image
        source = BytesIO()
        Image.effect_noise((1600, 1200), 100).save(source, 'PNG')
        data, width, height = images.encode(source.getvalue())
        self.assertLessEqual(width, 640)
        self.assertLessEqual(len(data), 60 * 1024)
        self.assertEqual(Image.open(BytesIO(data)).format, 'JPEG')

    def test_retry_and_failure_isolation(self):
        post = {'post_id': 'p', 'source': 'rss', 'url': 'https://example.com'}
        for old in [{'status': 'ok', 'attempts': 1, 'fetched_at': now()},
                    {'status': 'failed', 'attempts': 3, 'fetched_at': now() - timedelta(days=2)},
                    {'status': 'none', 'attempts': 1, 'fetched_at': now()}]:
            db = DB(old)
            with patch.object(images, 'source_image') as source:
                images.save(db, [post])
                source.assert_not_called()
        db = DB({'status': 'failed', 'attempts': 1, 'fetched_at': now() - timedelta(days=2)})
        with patch.object(images, 'source_image', side_effect=ValueError):
            images.save(db, [post])
        self.assertEqual(db.writes[0][1][-2:], ['failed', 2])
        with patch.object(db, 'select', side_effect=RuntimeError):
            images.save(db, [post])  # SQL failure cannot fail discovery either.

    def test_youtube_fallback_and_tombstone(self):
        db = DB()
        with patch.object(images, 'fetch', side_effect=[images.Missing(), (b'raw', '')]) as fetch, patch.object(images, 'encode', return_value=(b'jpeg', 20, 10)):
            images.save(db, [{'post_id': 'p', 'source': 'youtube', 'source_id': 'abcdefghijk'}])
        self.assertIn('maxresdefault', fetch.call_args_list[0].args[0])
        self.assertIn('hqdefault', fetch.call_args_list[1].args[0])
        self.assertEqual(db.writes[0][1][6], base64.b64encode(b'jpeg').decode())
        with patch.object(images, 'source_image') as source:
            images.save(DB(active=False), [{'post_id': 'p'}])
            source.assert_not_called()

    def test_cleanup_and_remove_order(self):
        db = DB()
        Store(db).retain()
        statements = [s for s, _ in db.writes]
        self.assertTrue(statements[0].startswith('DELETE FROM doc.social_image'))
        self.assertIn('NOT IN', statements[0])
        self.assertIn('deleted_at IS NULL', statements[0])
        self.assertIn("INTERVAL '30 days'", statements[0])
        db.writes.clear()
        Store(db).remove('p', 'deleted')
        self.assertIn(('DELETE FROM doc.social_image WHERE post_id=?', ['p']), db.writes)

    def test_article_metadata_and_backfill_bound(self):
        with patch.object(images, 'fetch', return_value=(b'<meta property="og:image" content="/lead.jpg"><meta name="twitter:image" content="other">', 'https://example.com/article')):
            self.assertEqual(images.source_image({'source': 'rss', 'url': 'https://example.com'}), 'https://example.com/lead.jpg')
        db = DB()
        with patch.object(db, 'select', return_value=[]) as select:
            images.backfill(Store(db), 10000)
        self.assertEqual(select.call_args.args[1], [500])
        self.assertIn('i.post_id IS NULL', select.call_args.args[0])

    def test_redirect_revalidates_host_and_pins_public_ip(self):
        from unittest.mock import MagicMock
        response = MagicMock(status=302, headers={'Location': 'http://127.0.0.1/private'})
        pool = MagicMock()
        pool.urlopen.return_value = response
        addresses = [[(2, 1, 6, '', ('93.184.216.34', 443))], [(2, 1, 6, '', ('127.0.0.1', 80))]]
        with patch('socket.getaddrinfo', side_effect=addresses), patch('urllib3.HTTPSConnectionPool', return_value=pool) as connection:
            with self.assertRaises(ValueError):
                images.fetch('https://example.com/image', image=True)
        self.assertEqual(connection.call_args.args[0], '93.184.216.34')
        self.assertEqual(connection.call_args.kwargs['assert_hostname'], 'example.com')
        response.close.assert_called_once()

    def test_download_caps_and_mime(self):
        from unittest.mock import MagicMock
        for headers in [{'Content-Type': 'text/html'},
                        {'Content-Type': 'image/jpeg', 'Content-Length': str(6 * 1024 * 1024)},
                        {'Content-Type': 'image/jpeg', 'Content-Encoding': 'gzip'}]:
            response = MagicMock(status=200, headers=headers)
            pool = MagicMock()
            pool.urlopen.return_value = response
            with patch('socket.getaddrinfo', return_value=[(2, 1, 6, '', ('93.184.216.34', 443))]), patch('urllib3.HTTPSConnectionPool', return_value=pool):
                with self.assertRaises(ValueError):
                    images.fetch('https://example.com/image', image=True)
            response.read.assert_not_called()
