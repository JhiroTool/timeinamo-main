import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, layout, radius, spacing, typography } from '@/theme';

interface BottomSheetProps {
  visible: boolean;
  title: string;
  children: ReactNode;
  onDismiss: () => void;
  dismissDisabled?: boolean;
}

export function BottomSheet({
  visible,
  title,
  children,
  onDismiss,
  dismissDisabled = false,
}: BottomSheetProps) {
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
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Pressable
              accessibilityLabel="Close sheet"
              accessibilityRole="button"
              disabled={dismissDisabled}
              onPress={onDismiss}
              style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
            >
              <X color={colors.textSecondary} size={22} />
            </Pressable>
          </View>
          {children}
        </SafeAreaView>
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
  sheet: {
    maxHeight: '88%',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
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

