"""Own disposable guest rooms for native marketing captures. Never uses member accounts."""
import json
import os
from pathlib import Path
import secrets
import threading
import time
import urllib.error
import urllib.request
import uuid

API = 'https://yepwatch.com/api/yepwatch/v1/proposal'


def request(path, body=None, credential=None):
    headers = {'Content-Type': 'application/json', 'x-yepwatch-client': 'native'}
    if credential:
        headers.update({'Authorization': 'Bearer ' + credential['token'], 'x-yepwatch-participant': credential['participantId']})
    payload = None if body is None else json.dumps(body).encode()
    # Every retry carries the exact admission/command identity, including uncertain acknowledgements.
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(API + path, headers=headers, data=payload), timeout=45) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code not in [429, 502, 503, 504] or attempt == 5:
                message = json.load(error).get('error', {}).get('message', 'Request rejected')
                raise RuntimeError(str(error.code) + ': ' + message) from None
            time.sleep(min(15, max(2, int(error.headers.get('Retry-After', '2')))))
        except (TimeoutError, urllib.error.URLError):
            if attempt == 5:
                raise RuntimeError('Disposable capture request unavailable') from None
            time.sleep(2)


class GalleryRoom:
    def __init__(self, admission):
        self.admission = admission
        self.credential = admission['credential']
        self.path = '/rooms/' + self.credential['roomId']
        self.invite = admission['invite']['code']
        self.stop = threading.Event()
        self.matching = threading.Event()
        self.matching_ready = threading.Event()
        self.worker = None

    def snapshot(self):
        return request(self.path, credential=self.credential)

    def command(self, command):
        snapshot = self.snapshot()
        return request(self.path + '/commands', {'commandId': uuid.uuid4().hex, 'sequence': snapshot['own']['nextSequence'], 'command': command}, self.credential)

    def configure(self):
        snapshot = self.snapshot()
        self.command({'type': 'configure', 'expectedContextVersion': snapshot['shared']['contextVersion'], 'country': 'DE', 'constraints': {'kinds': ['movie'], 'maxMinutes': None, 'moods': []}})
        self.command({'type': 'set_services', 'serviceIds': [8, 9, 337]})

    def follow(self):
        self.worker = threading.Thread(target=self._follow, daemon=True)
        self.worker.start()

    def _follow(self):
        while not self.stop.wait(0.8):
            try:
                s = self.snapshot()
                r = s['shared']
                people = [p for p in r['participants'] if not p.get('dropped')]
                if r['phase'] == 'setup' and len(people) > 1 and all(p.get('serviceIds') for p in people):
                    self.command({'type': 'start', 'expectedContextVersion': r['contextVersion'], 'expectedRosterVersion': r['rosterVersion'], 'hostReady': True})
                    print('Disposable peer started the room', flush=True)
                elif r['phase'] == 'choosing' and self.matching.is_set():
                    voted = {v['candidateId'] for v in s['own']['votes'] if v['value'] == 'watch'}
                    candidate = next((c for c in r['candidates'] if c['id'] not in voted), None)
                    if candidate:
                        old = next((v for v in s['own']['votes'] if v['candidateId'] == candidate['id']), None)
                        self.command({'type': 'vote', 'generation': r['generation'], 'candidateId': candidate['id'], 'expectedVoteRevision': old['revision'] if old else 0, 'value': 'watch'})
                    else:
                        self.matching_ready.set()
                    if r.get('proposal') and not s['own']['agreement']['agreed']:
                        self.command({'type': 'agree', 'generation': r['generation'], 'expectedRosterVersion': r['rosterVersion'], 'expectedProposalVersion': r['proposalVersion'], 'candidateId': r['proposal']['candidateId'], 'expectedOwnAgreementRevision': s['own']['agreement']['revision'], 'agreed': True})
            except Exception as error:
                print('Disposable peer retry: ' + type(error).__name__, flush=True)

    def close(self, leave=True):
        self.stop.set()
        if self.worker:
            self.worker.join(timeout=50)
        if leave:
            try:
                self.command({'type': 'leave'})
            except Exception:
                pass


def prepare(filename, families):
    path = Path(filename)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    state = json.loads(path.read_text()) if path.exists() else {}
    def save():
        path.write_text(json.dumps(state))
        path.chmod(0o600)
    for family in families:
        entry = state.setdefault(family, {'request': {'contractVersion': 3, 'commandId': uuid.uuid4().hex, 'admissionSecret': secrets.token_urlsafe(32), 'nickname': 'Mia'}})
        save()
        if 'admission' not in entry:
            entry['admission'] = request('/rooms', entry['request'])
            save()
        room = GalleryRoom(entry['admission'])
        if not entry.get('configured'):
            room.configure()
            entry['configured'] = True
            save()
        print('Prepared own disposable room for ' + family, flush=True)
    return {family: state[family]['admission'] for family in families}


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--prepare', required=True, help='New/private state file, never source controlled')
    parser.add_argument('--families', nargs='+', default=['iphone-medium', 'iphone-large', 'ipad'])
    options = parser.parse_args()
    prepare(options.prepare, options.families)
