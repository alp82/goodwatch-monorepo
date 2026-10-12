"""Authenticate immutable public observations for the distinct running adoption.

Pure data validation only. These observations never attest a current process,
authorize an action, or turn the predecessor's unknown cleanup into success.
"""
import hashlib
import json

FAILURE_SHA = 'e148b102499bead3b2b3b43f42a4c1224acbc9fb66ed6dcd4d79caba641bcfe1'
MEMORY_SHA = '799559e087d51b3b87798bebfea75c7b755233059f3d7c68b2baab3c5de6e094'
ATTEMPT_SHA = '05a58635330817946cf6302a911883f21647fe0eeb5e778cedd86703075d289a'
OLD_RECEIPT_SHA = 'ca4366c7673afae5f7a1680e25183ffd378f9f7888c92f5d79b855b5b4a69cc3'
OLD_ID_SHA = '30aca59a60c971e246894f614f767930190046ce3138c89e6c9ce5d64e069ff7'
NEW_ID_SHA = 'c67d813c0e32872228fdc13a515e49c45b3ae68166f19531ee83bcfdf69548ea'
NEW_STARTED_AT = '2026-10-12T19:42:29.283685237Z'
NEW_CONFIGURATION_SHA = '7c5d0e705380fbdde505a1b70dbf69a30de665f3caa36f067d1813650e2297dc'
ZERO_TIME = '0001-01-01T00:00:00Z'


def refuse():
    raise RuntimeError('running_adoption_proof_invalid')


def require(value):
    if value is not True:
        refuse()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            refuse()
        result[key] = value
    return result


def authenticated_json(raw, expected_sha):
    require(type(raw) is bytes and 0 < len(raw) <= 65536)
    require(hashlib.sha256(raw).hexdigest() == expected_sha)
    try:
        value = json.loads(raw, object_pairs_hook=unique_object, parse_constant=lambda _: refuse())
    except (ValueError, UnicodeError, TypeError):
        refuse()
    require(type(value) is dict)
    return value


def observations(failure_raw, memory_raw):
    """Return expectations that a future operation must independently renew."""
    try:
        frame = authenticated_json(failure_raw, FAILURE_SHA)
        memory = authenticated_json(memory_raw, MEMORY_SHA)
        require(frame['kind'] == 'external-completion')
        receipt = frame['receipt']
        require(receipt['status'] == 'failed-or-cleanup-unknown')
        require(receipt['productionAcceptance'] is False)
        require(receipt['allRegisteredLifecycleExitsProven'] is False)
        require(receipt['unknownUnregisteredChildrenAbsentProven'] is False)
        require(receipt['frames'] == [] and receipt['consumerAudit'] is None)
        require(type(receipt['historyWrites']) is int and receipt['historyWrites'] == 0)
        require(type(receipt['ordinarySearches']) is int and receipt['ordinarySearches'] == 0)
        remote = receipt['remoteFailureEvidence']
        require(remote['operation'] == 'setup-recover-never-started')
        require(remote['reason'] == 'host_emergency_floor')
        require(remote['continuationAllowed'] is False)
        recovery = remote['recoveryFailureEvidence']
        require(recovery['actionState'] == 'issued-acknowledged')
        require(type(recovery['httpStatus']) is int and recovery['httpStatus'] == 204)
        require(recovery['attemptObserved'] is True)
        require(recovery['attemptObservationKnown'] is True)
        require(recovery['attemptSha256'] == ATTEMPT_SHA)
        require(recovery['oldCleanReceiptSha256'] == OLD_RECEIPT_SHA)
        old = recovery['endpoints']['old']
        new = recovery['endpoints']['new']
        require(old['observed'] is True and new['observed'] is True)
        old_state, new_state = old['state'], new['state']
        require(old_state['containerIdHash'] == OLD_ID_SHA and old_state['running'] is False)
        require(new_state['containerIdHash'] == NEW_ID_SHA and new_state['running'] is True)
        require(new_state['startedAt'] == NEW_STARTED_AT and new_state['finishedAt'] == ZERO_TIME)
        require(new_state['configurationHash'] == NEW_CONFIGURATION_SHA)
        for state in (old_state, new_state):
            require(state['OOMKilled'] is False)
            require(type(state['restartCount']) is int and state['restartCount'] == 0)
            require(type(state['exitCode']) is int and state['exitCode'] == 0)
        require(memory['schema'] == 'cpu0-recovery-readonly-memory-snapshot.v1')
        require(type(memory['signals']) is int and memory['signals'] == 0)
        require(type(memory['sourceWrites']) is int and memory['sourceWrites'] == 0)
        state = memory['newCloneState']
        require(state['Running'] is True and state['Status'] == 'running')
        require(state['StartedAt'] == NEW_STARTED_AT and state['FinishedAt'] == ZERO_TIME)
        require(state['OOMKilled'] is False and state['Restarting'] is False)
        require(type(state['Pid']) is int and state['Pid'] == 3833234)
        qdrant = [row for row in memory['largestRss'] if row['comm'] == 'qdrant']
        require(len(qdrant) == 1)
        require(type(qdrant[0]['pid']) is int and qdrant[0]['pid'] == 3833293)
        require(type(qdrant[0]['startTicks']) is int and qdrant[0]['startTicks'] == 3066626708)
        require(type(qdrant[0]['lockedBytes']) is int and qdrant[0]['lockedBytes'] == 0)
        return {
            'schema': 'running-adoption-observed-predecessor.v1',
            'failureSha256': FAILURE_SHA, 'memorySha256': MEMORY_SHA,
            'attemptSha256': ATTEMPT_SHA, 'oldCleanReceiptSha256': OLD_RECEIPT_SHA,
            'oldState': old_state, 'newState': new_state,
            'wrapperPid': state['Pid'], 'qdrantPid': qdrant[0]['pid'],
            'qdrantStartTicks': qdrant[0]['startTicks'],
            'predecessorCleanupUnknownRetained': True,
            'currentBirthAttested': False, 'currentAdmissionPassed': False,
            'continuationAllowed': False,
        }
    except (KeyError, IndexError, TypeError, ValueError):
        refuse()
