import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, layout, radius, spacing, typography } from '@/theme';

interface DialogProps {
  visible: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
  onDismiss: () => void;
}

export function Dialog({
  visible,
  title,
  description,
  children,
  actions,
  onDismiss,
}: DialogProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.dialog}>
          <View style={styles.headingRow}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Pressable
              accessibilityLabel="Close dialog"
              accessibilityRole="button"
              onPress={onDismiss}
              style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
            >
              <X color={colors.textSecondary} size={22} />
            </Pressable>
          </View>
          {description ? <Text style={styles.description}>{description}</Text> : null}
          {children ? <View style={styles.content}>{children}</View> : null}
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.overlay,
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  headingRow: {
    minHeight: layout.minimumTouchTarget,
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
  description: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    ...typography.body,
  },
  content: {
    marginTop: spacing.lg,
  },
  actions: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});

