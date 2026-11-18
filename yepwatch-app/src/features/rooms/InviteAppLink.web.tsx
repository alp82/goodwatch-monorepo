import { View } from 'react-native';
import { nativeInviteUrl } from '../../core/invites';
import { GText, glow } from '../glow/theme';
import { R } from '../shell/tokens';

/** A user gesture hands the invitation to the installed app; the browser form stays usable. */
export function InviteAppLink({ code }: { code: string }) {
  return <View style={{ alignItems: 'center', gap: 12 }}>
    <a href={nativeInviteUrl(code)} style={{ color: '#141414', background: glow.amber, borderRadius: R.control, padding: '16px 24px', fontFamily: 'GabaritoBold', textDecoration: 'none' }}>Open in YepWatch</a>
    <a href={nativeInviteUrl(code, true)} style={{ color: glow.amber, minHeight: 48, display: 'inline-flex', alignItems: 'center', padding: '0 12px', fontFamily: 'Gabarito', textDecoration: 'underline' }}>Open in YepWatch Beta (Android)</a>
    <GText size={14} color={glow.muted}>Or continue in your browser below</GText>
  </View>;
}
