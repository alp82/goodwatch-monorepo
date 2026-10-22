"""Real Android and browser UI actions; no API-created rooms, credentials or generated activity."""
import json
from pathlib import Path
import subprocess
import time
import sys
import importlib.util
spec = importlib.util.spec_from_file_location('android_smoke', Path(__file__).with_name('native-android-smoke.py'))
ui = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ui)
peer = None
checks = []
result = {'nativeEmulator': ui.SERIAL, 'nativeGateway': 'ws://127.0.0.1:4323', 'browserGateway': 'ws://127.0.0.1:4322', 'browserOrigin': 'http://127.0.0.1:8132', 'api': 'http://127.0.0.1:15993', 'catalog': 'Real finite36-title sample', 'checks': checks, 'physicalDevice': False, 'authOrCredentialTesting': False}
def command(payload, expected):
    peer.stdin.write(json.dumps(payload) + '\n'); peer.stdin.flush()
    response = json.loads(peer.stdout.readline())
    if response.get('type') != expected: raise RuntimeError('Browser UI action failed: ' + expected)
    return response

def check(text):
    checks.append(text); print(text, flush=True)
try:
    if '--from-setup' not in sys.argv:
        ui.tap('Choose again')
    ui.tap('Invite friends')
    invite = next(n.get('text') for n in ui.nodes() if n.get('text', '').startswith('http://127.0.0.1:8132/r/'))
    ui.tap('Close panel')
    peer = subprocess.Popen(['node', str(Path(__file__).with_name('native-browser-peer.cjs'))], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    command({'type': 'join', 'invite': invite}, 'ready')
    ui.tap('Start choosing')
    ui.find('Yep', timeout=60)
    if any(n.get('content-desc') == 'Refresh room' for n in ui.nodes()): raise RuntimeError('Native not live before mixed voting')
    check('Ordinary native host invite and independent browser admission/readiness reached choosing over separate real gateways')
    ui.tap('Yep')
    if any(n.get('content-desc') == 'Inspect 1 matches' for n in ui.nodes()): raise RuntimeError('A match appeared before the browser answered')
    command({'type': 'watch'}, 'matched')
    ui.find('Inspect 1 matches')
    ui.screenshot('mixed-native-match.png')
    check('Native received the browser answer as an immediate confirmed match without another native command')
    ui.tap('Inspect 1 matches')
    ui.tap('Pick this')
    reply = command({'type': 'pick'}, 'done')
    ui.find('Everyone picked it. Enjoy your watch.', timeout=60)
    ui.screenshot('mixed-native-done.png')
    check('Browser final pick produced server-confirmed Done on both platforms; native received the peer decision')
    result['browserFrames'] = reply['frames']; result['browserJavaScriptErrors'] = reply['errors']
    if reply['errors']: raise RuntimeError('Browser JavaScript error')
    result['passed'] = True
except Exception as error:
    result['passed'] = False; result['failure'] = str(error)
    # Invitation drawers are deliberately excluded from screenshots and artifacts.
    raise
finally:
    if peer:
        try: peer.stdin.write(json.dumps({'type': 'close'}) + '\n'); peer.stdin.flush()
        except BrokenPipeError: pass
        try: peer.wait(timeout=20)
        except subprocess.TimeoutExpired:
            peer.terminate(); peer.wait(timeout=10)
    (ui.OUT / 'android-browser-mixed.json').write_text(json.dumps(result, indent=2) + '\n')
