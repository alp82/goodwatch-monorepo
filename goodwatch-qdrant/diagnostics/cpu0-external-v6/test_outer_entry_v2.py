"""Authenticated loader marker must bind the actual packet before any RPC."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

import outer_local_v2 as outer
from packet import canonical,sha


class EntryClosureTests(unittest.TestCase):
    def test_packet_closure_drift_refuses_before_rpc_constructor(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);source=root/'outer.py';source.write_bytes(b'# authenticated outer fixture\n')
            raw=canonical({'localExecutionClosureSha256':'b'*64})
            packet=root/'packet.json';packet.write_bytes(raw)
            argv=['outer','--execute-reviewed-fixed-capacity-v2','--packet',str(packet),
                  '--packet-sha256',sha(raw),'--outer-sha256',sha(source.read_bytes())]
            with mock.patch.object(sys,'argv',argv), \
                 mock.patch.dict(outer.__dict__,{'_AUTHENTICATED_EXTERNAL_SHA256':sha(source.read_bytes()),
                     '_AUTHENTICATED_EXTERNAL_SOURCE_PATH':str(source),
                     '_AUTHENTICATED_LOCAL_CLOSURE_SHA256':'a'*64}), \
                 mock.patch.object(outer,'Rpc') as rpc, mock.patch.object(outer,'run') as run:
                with self.assertRaisesRegex(RuntimeError,'^outer_authenticated_entry_required$'):
                    outer.main()
                rpc.assert_not_called();run.assert_not_called()


if __name__=='__main__':unittest.main()
