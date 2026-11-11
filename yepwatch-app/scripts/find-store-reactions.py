"""Locate large YEP/NOPE/MATCH words in analysis thumbnails; final images come from native footage."""
import argparse
import concurrent.futures
import csv
import io
import json
import os
from pathlib import Path
import re
import subprocess


def inspect(path):
    env = {**os.environ, 'OMP_THREAD_LIMIT': '1'}
    result = subprocess.run(['tesseract', str(path), 'stdout', '--psm', '11', 'tsv'], env=env, text=True, capture_output=True, check=True)
    hits = []
    for row in csv.DictReader(io.StringIO(result.stdout), delimiter='\t'):
        word = re.sub('[^A-Z]', '', row['text'].upper().replace('0', 'O'))
        if word in ['YEP', 'NOPE', 'MATCH'] and int(row['height']) >= 14 and float(row['conf']) >= 40:
            hits.append({'label': word, 'height': int(row['height']), 'width': int(row['width']), 'confidence': float(row['conf'])})
    return [{'file': str(path), 'frame': int(path.stem.split('-')[-1]), **hit} for hit in hits]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('folder')
    parser.add_argument('--output', required=True)
    options = parser.parse_args()
    files = sorted(Path(options.folder).glob('*.jpg'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        hits = [hit for found in pool.map(inspect, files) for hit in found]
    Path(options.output).write_text(json.dumps(hits, indent=2))
    for label in ['YEP', 'NOPE', 'MATCH']:
        selected = []
        for hit in sorted([h for h in hits if h['label'] == label], key=lambda h: (h['height'], h['confidence']), reverse=True):
            if all(abs(hit['frame'] - old['frame']) >= 16 or Path(hit['file']).stem.split('-')[0] != Path(old['file']).stem.split('-')[0] for old in selected):
                selected.append(hit)
            if len(selected) == 5:
                break
        print(label, json.dumps(selected))


if __name__ == '__main__':
    main()
