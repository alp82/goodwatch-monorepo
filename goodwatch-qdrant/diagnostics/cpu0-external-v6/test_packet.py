import base64
import json
from pathlib import Path
import tempfile
import unittest
import build_packet
import packet
import census


class PacketTests(unittest.TestCase):
    def paths(self):
        external=Path(__file__).resolve().parent
        diagnostics=external.parent
        return external,diagnostics/'pinning-prototype',diagnostics/'clone-preparation'/'prepare_clone_reclaim.py'

    def test_composed_actual_merged_sources_and_all_external_closures(self):
        external,source,reclaim=self.paths()
        # Synthetic prior hashes only exercise packet construction; they do not
        # attest any remote prior stage and are never used for execution.
        prior=[{'stage':name,'files':{'fixture.py':'a'*64},'helperSha256':'f831f00f75d4b54dce3ba493a4a078b23969222507576505052291ed0147f7c5' if i==5 else None,'maxReceipts':18 if i>=4 else 14} for i,name in enumerate(census.PRIOR_STAGES,1)]
        raw,local=build_packet.build(source,source,reclaim,external,prior)
        value=json.loads(raw);manifest=json.loads(base64.b64decode(value['fullManifest']))
        self.assertEqual(value['sourceFreezeSha256'],build_packet.SOURCE_SHA)
        self.assertEqual(value['externalManifestSha256'],packet.sha(base64.b64decode(value['fullManifest'])))
        for name,digest in build_packet.JS_HASHES.items():self.assertEqual(manifest['files'][name],digest)
        self.assertEqual(value['localExecutionClosureSha256'],packet.sha(local))
        self.assertEqual(len(manifest['files']),24)
        self.assertLess(len(raw),8*1024**2)

    def test_changed_consumer_refused_before_packet_construction(self):
        external,source,reclaim=self.paths()
        with tempfile.TemporaryDirectory() as folder:
            target=Path(folder)
            for name in build_packet.JS_NAMES:(target/name).write_bytes((source/name).read_bytes())
            (target/'compare-contract-cpu0.mjs').write_bytes(b'changed')
            with self.assertRaisesRegex(RuntimeError,'consumer_source_changed'):
                build_packet.consumer_files(target)


if __name__=='__main__':unittest.main()
