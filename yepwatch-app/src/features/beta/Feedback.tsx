import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import Constants from 'expo-constants';
import { GText, Pill, glow } from '../glow/theme';

export function buildLabel() {
  const config = Constants.expoConfig;
  const version = config?.version ?? 'development';
  const build = Platform.OS === 'android' ? config?.android?.versionCode : Platform.OS === 'ios' ? config?.ios?.buildNumber : undefined;
  return `${version}${build ? ` (${build})` : ''} · ${Platform.OS}`;
}

export function Feedback() {
  const [failed, setFailed] = useState(false);
  const version = buildLabel();
  const body = `What happened?\n\nWhat did you expect?\n\nSteps to repeat it:\n\nScreenshot: attach one if useful.\n\nYepWatch ${version}\nSystem: ${Platform.OS} ${Platform.Version ?? 'browser'}\n`;
  return (
    <View style={{ gap: 8 }}>
      <Pill label="Send feedback" onPress={() => {
        setFailed(false);
        void Linking.openURL(`mailto:hello@goodwatch.app?subject=${encodeURIComponent('YepWatch beta feedback')}&body=${encodeURIComponent(body)}`).catch(() => setFailed(true));
      }}>Send feedback</Pill>
      <GText size={12} color={glow.muted}>YepWatch {version}</GText>
      {failed && <>
        <GText size={13}>Email hello@goodwatch.app, or copy these details into a message:</GText>
        <GText size={12} selectable color={glow.muted}>{body}</GText>
      </>}
    </View>
  );
}
