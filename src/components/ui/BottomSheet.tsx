import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, layout, radius, spacing, typography } from '@/theme';

interface BottomSheetProps {
  visible: boolean;
  title: string;
  children: ReactNode;
  onDismiss: () => void;
  dismissDisabled?: boolean;
  scrollable?: boolean;
  titleStyle?: StyleProp<TextStyle>;
}

export function BottomSheet({
  visible,
  title,
  children,
  onDismiss,
  dismissDisabled = false,
  scrollable = false,
  titleStyle,
}: BottomSheetProps) {
  const { height } = useWindowDimensions();

  return (
    <Modal
      animationType="slide"
      onRequestClose={() => {
        if (!dismissDisabled) onDismiss();
      }}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Close sheet"
          disabled={dismissDisabled}
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.keyboardContainer, scrollable && styles.scrollableContainer]}
        >
          <SafeAreaView edges={['bottom']} style={[styles.sheet, scrollable && { maxHeight: height * 0.9 }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text accessibilityRole="header" style={[styles.title, titleStyle]}>
                {title}
              </Text>
              <Pressable
                accessibilityLabel="Close sheet"
                accessibilityRole="button"
                accessibilityState={{ disabled: dismissDisabled }}
                disabled={dismissDisabled}
                onPress={onDismiss}
                style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
              >
                <X color={colors.textSecondary} size={22} />
              </Pressable>
            </View>
            {scrollable ? (
              <ScrollView bounces={false} keyboardShouldPersistTaps="handled" style={styles.body}>
                {children}
              </ScrollView>
            ) : children}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  keyboardContainer: {
    justifyContent: 'flex-end',
  },
  scrollableContainer: { flexShrink: 1 },
  body: { flexGrow: 0, flexShrink: 1 },
  sheet: {
    maxHeight: '88%',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  handle: {
    width: 40,
    height: 4,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.borderStrong,
    borderRadius: radius.pill,
  },
  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    color: colors.text,
    ...typography.heading,
  },
  close: {
    width: layout.minimumTouchTarget,
    height: layout.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
    borderRadius: radius.pill,
  },
  closePressed: {
    backgroundColor: colors.border,
  },
});

