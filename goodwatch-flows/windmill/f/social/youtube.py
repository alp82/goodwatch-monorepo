"""Allowlisted official channels: uploads playlists, keyless rolling-feed fallback."""
import xml.etree.ElementTree as ET
from f.social.common import http_get, post, stamp
from f.social.inventory import CHANNELS

NS = {'a': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015',
      'm': 'http://search.yahoo.com/mrss/'}


def collect(settings, start, end, *, get=http_get, pages=1, channels=CHANNELS):
    posts, audit, errors = {}, [], []
    key = settings.get('YOUTUBE_API_KEY')
    for name, channel in channels.items():
        route = 'uploads_playlist' if key else 'official_channel_feed'
        try:
            rows = []
            if key:
                token = None
                for _ in range(pages):
                    body = get('https://www.googleapis.com/youtube/v3/playlistItems', params={
                        'part': 'snippet,contentDetails', 'playlistId': 'UU' + channel[2:], 'maxResults': 50,
                        'key': key, **({'pageToken': token} if token else {})}).json()
                    for entry in body.get('items', []):
                        s = entry['snippet']
                        if s.get('channelId') != channel:
                            continue
                        rows.append((s['resourceId']['videoId'],
                                     (entry.get('contentDetails') or {}).get('videoPublishedAt') or s['publishedAt'],
                                     s['title'], s.get('description', '')))
                    token = body.get('nextPageToken')
                    if not token:
                        break
            else:
                root = ET.fromstring(get('https://www.youtube.com/feeds/videos.xml', params={'channel_id': channel}).content)
                for entry in root.findall('a:entry', NS):
                    rows.append((entry.findtext('yt:videoId', namespaces=NS), entry.findtext('a:published', namespaces=NS),
                                 entry.findtext('a:title', namespaces=NS),
                                 entry.findtext('m:group/m:description', default='', namespaces=NS)))
            for video, date, text, context in rows:
                if text in ('Private video', 'Deleted video') or not start <= stamp(date) <= end:
                    continue
                posts[video] = post('youtube', video, 'https://www.youtube.com/watch?v=' + video,
                                    channel, name, date, text, context, 'channel:' + channel)
                posts[video]['image_url'] = 'https://i.ytimg.com/vi/' + video + '/maxresdefault.jpg'
            audit.append({'channel': channel, 'route': route, 'returned': len(rows),
                          'missing_api_key': not bool(key), 'bounded_pages': pages if key else 1})
        except Exception as exc:
            # Never include HTTP error URLs: playlist URLs contain the API key.
            errors.append({'channel': channel, 'error': type(exc).__name__})
    return {'status': 'partial' if errors else 'ok', 'posts': list(posts.values()), 'audit': audit, 'errors': errors}


def main():
    return {'library': True}
