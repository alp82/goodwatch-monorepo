import { EdgeBack } from './EdgeBack';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GText, Icon, Press, glow } from './theme';
export function Drawer({
  title,
  children,
  close,
  footer,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  footer?: ReactNode;
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: '#000b',
          alignItems: 'center',
        }}
      >
        <Pressable
          accessibilityLabel="Close panel"
          onPress={close}
          style={{ position: 'absolute', inset: 0 }}
        />
        <SafeAreaView
          edges={['bottom']}
          style={{
            maxHeight: '90%',
            width: '100%',
            maxWidth: 620,
            backgroundColor: glow.panel,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderColor: glow.line,
          }}
          accessibilityViewIsModal
        >
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Press label="Back" onPress={close}><Icon name="left" /></Press>
            <GText size={25} bold style={{ flex: 1 }}>
              {title}
            </GText>
            <Press label="Close panel" onPress={close}>
              <Icon name="close" />
            </Press>
          </View>
          <ScrollView
            style={{ flexShrink: 1, minHeight: 0 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            persistentScrollbar
            contentContainerStyle={{ padding: 24, gap: 18 }}
          >
            {children}
          </ScrollView>
          {footer && <View style={{ flexShrink: 0, paddingHorizontal: 24, paddingVertical: 12, borderTopWidth: 1, borderTopColor: glow.line, backgroundColor: glow.panel }}>{footer}</View>}
          <EdgeBack back={close} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
