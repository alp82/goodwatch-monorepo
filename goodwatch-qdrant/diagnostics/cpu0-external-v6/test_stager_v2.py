"""Real local Node and recipe bytes; local UID replaces fixed production root."""
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest import mock

import packet
import running_adoption as adoption
import stager
import stager_v2
import test_packet_v2 as recipe_fixture


class InstalledNodeTests(unittest.TestCase):
    def setUp(self):
        root=Path(self.enterContext(tempfile.TemporaryDirectory()));root.chmod(0o700)
        self.stage=root/adoption.STAGE.name;self.stage.mkdir(mode=0o700)
        self.enterContext(mock.patch.object(adoption,'STAGE',self.stage))
        self.full,self.manifest,self.source_sha=recipe_fixture.SuccessorPacketTests().full()
        self.raw=packet.canonical(self.manifest)+b'\n'
        for name,raw in {**self.full,'cpu0-external-manifest.json':self.raw}.items():
            path=self.stage/name;path.write_bytes(raw);path.chmod(0o600)
        self.node=self.stage/'node';self.node.write_bytes(b'node fixture');self.node.chmod(0o700)
        info=self.node.stat()
        self.receipt={'schema':'clone-node-copy-receipt.v2','nodeSha256':packet.sha(self.node.read_bytes()),
                      'nodeBytes':info.st_size,'sourceReceiptSha256':stager.NODE_RECEIPT_SHA,
                      'targetDevice':info.st_dev,'targetInode':info.st_ino,'targetMode':0o700,
                      'sourceStable':True,'sourceHostWrites':0,'cloneFilesCreated':2,
                      'targetMtimeNs':info.st_mtime_ns,'targetCtimeNs':info.st_ctime_ns}
        self.receipt_raw=packet.canonical(self.receipt)+b'\n'
        path=self.stage/'node-provenance.json';path.write_bytes(self.receipt_raw);path.chmod(0o600)
        self.enterContext(mock.patch.object(stager,'NODE_SHA',self.receipt['nodeSha256']))
        self.enterContext(mock.patch.object(stager,'NODE_BYTES',info.st_size))
        self.enterContext(mock.patch.object(stager_v2,'read_owned',
            side_effect=lambda path:packet.read_owned(path,uid=os.getuid())))
        self.enterContext(mock.patch.object(stager_v2,'_v2_inventory',
            side_effect=lambda path:packet._v2_inventory(path,uid=os.getuid())))
        original=stager._verify_node_copy_v2
        self.enterContext(mock.patch.object(stager,'_verify_node_copy_v2',
            side_effect=lambda path,raw,identity,uid,digest,size:
                original(path,raw,identity,os.getuid(),digest,size)))

    def verify(self):
        return stager_v2.verify_staged(self.raw,packet.sha(self.raw),self.full,
                                       self.source_sha,packet.sha(self.receipt_raw))

    def test_fresh_full_node_hash_reproduces_existing_receipt(self):
        proof=self.verify()
        self.assertEqual(proof['nodeReceiptSha256'],packet.sha(self.receipt_raw))
        self.assertEqual((self.stage/'node-provenance.json').read_bytes(),self.receipt_raw)

    def test_same_size_mutation_with_restored_mtime_is_refused(self):
        before=self.node.stat()
        self.node.write_bytes(b'changed node')
        os.utime(self.node,ns=(before.st_atime_ns,before.st_mtime_ns))
        with self.assertRaisesRegex(RuntimeError,'^node_source_changed$'):self.verify()
        self.assertEqual((self.stage/'node-provenance.json').read_bytes(),self.receipt_raw)

    def test_ctime_drift_is_not_rewritten_as_fresh_provenance(self):
        time.sleep(.02)  # Allow a real filesystem timestamp tick.
        self.node.chmod(0o600);self.node.chmod(0o700)
        self.assertNotEqual(self.node.stat().st_ctime_ns,self.receipt['targetCtimeNs'])
        with self.assertRaisesRegex(RuntimeError,'^node_source_changed$'):self.verify()

    def test_unknown_receipt_field_is_rejected_even_with_matching_hash(self):
        self.receipt['unbound']=True
        self.receipt_raw=packet.canonical(self.receipt)+b'\n'
        (self.stage/'node-provenance.json').write_bytes(self.receipt_raw)
        with self.assertRaisesRegex(RuntimeError,'^node_provenance_changed$'):self.verify()


class ReceiptPublicationTests(unittest.TestCase):
    def setUp(self):
        self.stage=Path(self.enterContext(tempfile.TemporaryDirectory()));self.stage.chmod(0o700)
        self.enterContext(mock.patch.object(adoption,'STAGE',self.stage))

    def test_receipt_is_durable_and_cannot_be_overwritten(self):
        stager_v2.publish_node_receipt(b'public fixture\n',uid=os.getuid())
        with self.assertRaises(FileExistsError):
            stager_v2.publish_node_receipt(b'other\n',uid=os.getuid())
        self.assertEqual((self.stage/'node-provenance.json').read_bytes(),b'public fixture\n')

    def test_fsync_failure_retains_partial_receipt_and_original_cause(self):
        failure=OSError('injected file sync')
        with mock.patch.object(stager_v2.os,'fsync',side_effect=failure):
            with self.assertRaises(OSError) as caught:
                stager_v2.publish_node_receipt(b'public fixture\n',uid=os.getuid())
        self.assertIs(caught.exception,failure)
        proof=failure.nodeReceiptPublicationEvidence
        self.assertIs(proof['fileCreated'],True)
        self.assertIs(proof['writeCompleted'],True)
        self.assertIs(proof['fileFsyncCompleted'],False)
        self.assertIs(proof['fileRetained'],True)
        self.assertIs(proof['continuationAllowed'],False)


if __name__=='__main__':unittest.main()
