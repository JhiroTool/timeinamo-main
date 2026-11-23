import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';

import { colors, radius, shadows } from '@/theme';

interface CardProps extends PropsWithChildren<Omit<ViewProps, 'style'>> {
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

export function Card({ children, style, padded = true, ...props }: CardProps) {
  return (
    <View style={[styles.card, padded && styles.padded, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    ...shadows.card,
  },
  padded: {
    padding: 20,
  },
});

