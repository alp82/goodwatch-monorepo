"""Verify retained public receipts/hashes and run available offline real-process tests."""
import hashlib,json,os,sys,unittest
from pathlib import Path
HERE=Path(__file__).resolve().parent
REPO=HERE.parents[3]

def main():
    provenance=json.loads((HERE/'provenance.json').read_text())
    for name,proof in provenance['artifacts'].items():
        raw=(HERE/name).read_bytes()
        assert len(raw)==proof['bytes'] and hashlib.sha256(raw).hexdigest()==proof['sha256'],name
    core=REPO/'goodwatch-qdrant/diagnostics/pinning-prototype'
    manifest=json.loads((HERE/'launcher-v2/manifest.json').read_text())
    digest=hashlib.sha256()
    for name in manifest['codeFiles']:digest.update(name.encode()+b'\0'+(core/name).read_bytes()+b'\0')
    assert digest.hexdigest()==manifest['codeSha256']
    rows=[json.loads(line)for line in (HERE/'v2-actual-frames.jsonl').read_bytes().splitlines()]
    assert len(rows)==12
    exits=[r for r in rows if r['phase']=='exited']
    assert [(r['mode'],r['exitCode'])for r in exits]==[('close',0),('term',-15),('kill',-9)]
    assert all(r['holderExited'] is True and r['released'] is True and r['vmLockedBytes']==0 for r in exits)
    assert rows[-1]['cliExit']==0 and rows[-1]['registeredHolders']==3 and rows[-1]['registeredHoldersExited']is True
    assert rows[-1]['unknownEarlyChildrenPossible']is True
    assert json.loads((HERE/'v1-actual-receipt.json').read_text())['overall']=='failed'
    # Exact retained tests are unchanged. The private-packet test deliberately
    # needs the excluded original contract; all other tests are available.
    sys.path.insert(0,str(core));sys.path.insert(0,str(HERE/'launcher-v2'))
    os.chdir(HERE/'launcher-v2')
    import test_launcher
    names=unittest.defaultTestLoader.getTestCaseNames(test_launcher.Tests)
    omitted='test_packet_hash_and_whitelist_fail_closed_without_echo'
    suite=unittest.TestSuite(test_launcher.Tests(name)for name in names if name!=omitted)
    result=unittest.TextTestRunner(verbosity=1).run(suite)
    print(json.dumps({'publicOfflineTests':result.testsRun,'passed':result.wasSuccessful(),'privatePacketFixtureOmitted':True,'retainedActualFrames':len(rows),'codeSha256':digest.hexdigest()}))
    return 0 if result.wasSuccessful()else 1
if __name__=='__main__':raise SystemExit(main())
