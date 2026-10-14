#!/usr/bin/env python3
"""Offline token-count estimate; no provider calls. Uses cl100k_base as a named proxy, not Qwen's tokenizer."""
import argparse
from decimal import Decimal
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'windmill'))
from f.media_language.prose_jobs import INPUT_PER_MILLION, OUTPUT_PER_MILLION, request_payload, reserve_cost


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sources', required=True, type=Path)
    parser.add_argument('--locale', default='de')
    parser.add_argument('--output-token-factor', type=Decimal, default=Decimal('1.5'))
    args = parser.parse_args()
    if not Decimal('0.1') <= args.output_token_factor <= Decimal('5'):
        parser.error('output token factor must be between 0.1 and 5')
    import tiktoken
    encoding = tiktoken.get_encoding('cl100k_base')
    sources = json.loads(args.sources.read_text())
    prompt_tokens = source_tokens = 0
    reserve = Decimal('0')
    for source in sources:
        payload = request_payload(source['text'], args.locale)
        # Explicit chat framing estimate: 3 tokens per message and 3 priming tokens.
        prompt_tokens += 3 + sum(3 + len(encoding.encode(m['role'])) + len(encoding.encode(m['content'])) for m in payload['messages'])
        # JSON envelope remains in completions; add 5 proxy tokens per source.
        source_tokens += len(encoding.encode(source['text'])) + 5
        reserve += reserve_cost(payload)
    completion_tokens = int(Decimal(source_tokens) * args.output_token_factor)
    titles = len({source['source_id'].split(':essence_')[0] for source in sources})
    if not titles:
        parser.error('No title sources')
    amount = (Decimal(prompt_tokens)*INPUT_PER_MILLION + Decimal(completion_tokens)*OUTPUT_PER_MILLION)/1_000_000
    print(json.dumps({'tokenizer_proxy':'cl100k_base', 'titles':titles, 'sources':len(sources),
                      'locale':args.locale, 'prompt_tokens':prompt_tokens, 'source_tokens_with_envelopes':source_tokens,
                      'estimated_completion_tokens':completion_tokens, 'output_token_factor':str(args.output_token_factor),
                      'usd_per_1000_titles_per_locale':str(amount/titles*1000),
                      'reservation_usd_per_1000_titles_one_attempt':str(reserve/titles*1000),
                      'input_usd_per_million':str(INPUT_PER_MILLION), 'output_usd_per_million':str(OUTPUT_PER_MILLION)},indent=2))


if __name__ == '__main__': main()
