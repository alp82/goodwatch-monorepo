import { useState } from 'react';
import { Platform, View } from 'react-native';
import Constants from 'expo-constants';
import type { ConnectionDiagnostic } from '../../core/continuous/connection-diagnostic';
import { GText, Press, glow } from '../glow/theme';

/** Expandable local report for a tester; no automatic logging or submission. */
export function ConnectionDetails({ diagnostic }: { diagnostic: ConnectionDiagnostic }) {
  const [open, setOpen] = useState(false);
  const build = Platform.OS === 'ios' ? Constants.platform?.ios?.buildNumber : Platform.OS === 'android' ? Constants.expoConfig?.android?.versionCode : null;
  return <View style={{ gap: 4 }}>
    <Press label={open ? 'Hide connection details' : 'Connection details'} onPress={() => setOpen(!open)} style={{ alignSelf: 'flex-start', minHeight: 40 }}>
      <GText size={12} color={glow.amber}>{open ? 'Hide connection details' : 'Connection details'}</GText>
    </Press>
    {open && <GText size={12} color={glow.muted}>
      {`${Platform.OS}${build ? ` · build ${build}` : ''} · ${diagnostic.reason} · ${diagnostic.stage}\n${diagnostic.status ? `HTTP ${diagnostic.status}` : 'No HTTP response'} · ${(diagnostic.elapsedMs / 1000).toFixed(1)}s`}
    </GText>}
  </View>;
}
