"""Verified #539 inventory; Netflix additions verified in #544 round two."""
CHANNELS = {'Universal Pictures': 'UCq0OueAsdxH6b8nyAspwViw', 'Warner Bros.': 'UCjmJDM5pRKbUlVIzDYYWb6g', 'Sony Pictures': 'UCz97F7dMxBNOfGYu3rx8aCw', 'A24': 'UCuPivVjnfNo4mb3Oog_frZg', 'NEON': 'UCpy5dRhZd-JbZP4NsrnLt1w', 'Constantin Film': 'UC51KZjUZokzJfb08mzAGS2A', 'Disney+': 'UCIrgJInjLS2BhlHOMDW7v0g', 'Netflix': 'UCWOA1ZGywLbqmigxE4Qlvuw', 'Netflix Brasil': 'UCc1l5mTmAv2GC_PXrBpqyKQ', 'Netflix India': 'UCZSNzBgFub_WWil6TOTYwAg'}

FEEDS = ['https://variety.com/feed/', 'https://variety.com/v/film/feed/', 'https://deadline.com/feed/', 'https://deadline.com/v/film/feed/', 'https://www.hollywoodreporter.com/feed/', 'https://www.hollywoodreporter.com/c/movies/feed/', 'https://www.indiewire.com/feed/', 'https://collider.com/feed/', 'https://screenrant.com/feed/', 'https://www.slashfilm.com/feed/', 'https://www.denofgeek.com/feed/', 'https://www.filmstarts.de/rss/nachrichten.xml', 'https://www.filmstarts.de/rss/filme-nachrichten.xml', 'https://www.filmstarts.de/rss/serien-nachrichten.xml', 'https://www.moviepilot.de/news.rss', 'https://www.film-rezensionen.de/feed/', 'https://www.epd-film.de/rss.xml', 'https://about.netflix.com/en/feed.xml', 'https://about.netflix.com/de/feed.xml']

MASTODON_INSTANCES = ('https://mastodon.social', 'https://mastodon.online', 'https://fosstodon.org')

def main():
    return {'channels': len(CHANNELS), 'feeds': len(FEEDS)}
