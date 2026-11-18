/**
 * The profile's Taste section: the profile's strength (members: "Using your GoodWatch taste"), Tune your taste (opens
 * Taste mode, which grows out of this button) and Reset my taste, which deletes the profile after a confirmation.
 */
import { useRef, useState, type ComponentRef } from 'react';
import { View } from 'react-native';
import { tasteProfile, useTasteProfile } from '../../core/continuous/taste-profile';
import { ErrorText, GText, Icon, glow } from '../glow/theme';
import { HoverPress, Nudge } from '../shell/hover';
import { GoodWatchG } from '../shell/marks';
import { useLayout } from '../shell/layout';
import { R, warm } from '../shell/tokens';
import { StrengthMeter } from './StrengthMeter';
import { TextAction } from './TasteMode';
import { tasteMode } from './taste-mode';

export function TasteEntry({ member }: { member: boolean }) {
  const { z } = useLayout();
  const profile = useTasteProfile();
  const button = useRef<ComponentRef<typeof View>>(null);
  const [confirm, setConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [failed, setFailed] = useState(false);
  const rated = profile.rated ?? 0;
  const open = () => {
    const node = button.current;
    if (!node) { tasteMode.open(); return; }
    node.measureInWindow((x, y, w, h) => tasteMode.open(w > 0 ? { x, y, w, h } : null));
  };
  const reset = () => {
    setResetting(true);
    setFailed(false);
    void tasteProfile.reset().then(() => setConfirm(false), () => setFailed(true)).finally(() => setResetting(false));
  };
  return (
    <View testID="profile-taste" style={{ gap: z(14) }}>
      {member ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <GoodWatchG size={z(18)} />
          <GText bold size={z(15)}>Using your GoodWatch taste</GText>
        </View>
      ) : <StrengthMeter rated={rated} />}
      <View ref={button} collapsable={false} style={{ flexDirection: 'row' }}>
        <HoverPress label="Tune your taste" hint="Quick cards: seen it, did you like it" onPress={open}
          style={{ flex: 1, minHeight: z(54), borderRadius: R.control, paddingHorizontal: 18, flexDirection: 'row', gap: 9, backgroundColor: glow.amber, borderWidth: 1, borderColor: glow.amber }}>
          <Nudge><Icon name="heartFilled" size={16} color={warm.ink} /></Nudge>
          <GText bold size={z(17)} color={warm.ink}>Tune your taste</GText>
        </HoverPress>
      </View>
      {rated > 0 && !member ? (
        confirm ? (
          <View style={{ gap: 6 }}>
            <GText size={z(14)} color={glow.soft}>{`Reset your taste? This removes your ${rated} ${rated === 1 ? 'answer' : 'answers'} from YepWatch.`}</GText>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <TextAction label={resetting ? 'Resetting…' : 'Reset'} color={glow.error} onPress={reset} />
              <TextAction label="Cancel" onPress={() => setConfirm(false)} />
            </View>
            {failed ? <ErrorText size={13}>Couldn’t reset your taste. Try again.</ErrorText> : null}
          </View>
        ) : <View style={{ flexDirection: 'row' }}><TextAction label="Reset my taste" onPress={() => setConfirm(true)} /></View>
      ) : null}
    </View>
  );
}
