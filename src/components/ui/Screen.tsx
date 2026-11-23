import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Edge } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  scrollable?: boolean;
  keyboardAware?: boolean;
  includeBottomInset?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({
  children,
  scrollable = true,
  keyboardAware = false,
  includeBottomInset = false,
  contentStyle,
}: ScreenProps) {
  const { width } = useWindowDimensions();
  const horizontalPadding = width < 360 ? spacing.md : spacing.lg;
  const edges: Edge[] = includeBottomInset
    ? ['top', 'right', 'bottom', 'left']
    : ['top', 'right', 'left'];

  const content = scrollable ? (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.content, { paddingHorizontal: horizontalPadding }, contentStyle]}>
        {children}
      </View>
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.staticContent, { paddingHorizontal: horizontalPadding }, contentStyle]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={keyboardAware && Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={keyboardAware}
        style={styles.keyboardView}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  staticContent: {
    flex: 1,
  },
});

