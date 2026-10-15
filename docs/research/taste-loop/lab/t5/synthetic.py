"""Wholly invented catalog and people; no production or account reads."""
import json
import re
from pathlib import Path


def pack(n=18):
    titles, population = [], []
    # All histories have the same rating distribution. Three distinct taste worlds,
    # each containing two loved strands, make semantic identity recoverable.
    for m in range(n):
        rows = []
        group = m % 3
        for i in range(80):
            key = 10**12 + m * 100 + i
            fp = [2] * 74
            dimension = ((group * 20) + (0 if i % 2 else 7)) % 60
            fp[dimension] = 10
            fp[(dimension + 1) % 60] = 9
            rating = [9, 9, 8, 8, 6, 6, 7, 7][i % 8]
            titles.append({'key': key, 'title': f'{["adrenaline", "fantasy", "character"][group]} invented title {m}-{i}',
                           'year': 2000 + i % 20, 'media_type': 'movie', 'fingerprint': fp,
                           'in_pool': True, 'hasPoster': True, 'public_score': 75, 'votes': 5000,
                           'genres': [], 'origin': 'en', 'release_day': 11000 + i, 'aliases': []})
            rows.append({'title_key': key, 'score': rating, 'created_at': 100000 + i * 10000,
                         'updated_at': 100000 + i * 10000, 'position': i, 'in_bulk': False, 'edited': False})
        population.append({'token': f'invented-{m:03}', 'tier': 'A', 'owner': False, 'ratings': rows})
    return {'titles': titles, 'population': population}


def main():
    """A fake CLI reader: follows an invented semantic word, otherwise fixed A."""
    import sys
    text = sys.stdin.read()
    payload = json.loads(text.split('\n\n', 1)[1])
    desc = payload['description'].lower()
    chosen = 'A'
    for word in ('adrenaline', 'fantasy', 'character'):
        if word in desc:
            chosen = max('ABC', key=lambda k: sum(word in r['title'].lower() for r in payload['lists'][k]))
            break
    answer = json.dumps({'choice': chosen})
    if sys.argv[-1] == 'haiku':
        print(json.dumps({'result': answer, 'is_error': False, 'num_turns': 1, 'modelUsage': {'fake-haiku': {}},
                          'usage': {'input_tokens': 0, 'output_tokens': 0}, 'total_cost_usd': 0}))
    else:
        print(json.dumps({'type': 'turn.started'}))
        print(json.dumps({'type': 'item.completed', 'item': {'type': 'agent_message', 'text': answer}}))
        print(json.dumps({'type': 'turn.completed', 'usage': {'input_tokens': 0, 'output_tokens': 0}}))


if __name__ == '__main__':
    main()
