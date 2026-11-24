import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Smartphone } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { colors, layout, radius, spacing, typography } from '@/theme';

interface GradientHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  onBack?: () => void;
  action?: ReactNode;
  showBrand?: boolean;
  showLocalNote?: boolean;
  compact?: boolean;
}

export function GradientHeader({
  title,
  subtitle,
  eyebrow,
  onBack,
  action,
  showBrand = false,
  showLocalNote = false,
  compact = false,
}: GradientHeaderProps) {
  const { width } = useWindowDimensions();
  return (
    <LinearGradient
      colors={[colors.primaryBright, colors.primary, colors.primaryDeep]}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[
        styles.header,
        { marginHorizontal: width < 360 ? -spacing.md : -spacing.lg },
        compact && styles.compact,
      ]}
    >
      <StatusBar style="light" />
      <View pointerEvents="none" style={styles.waveOne} />
      <View pointerEvents="none" style={styles.waveTwo} />
      <View style={[styles.topRow, compact && styles.compactTopRow]}>
        {onBack ? (
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <ArrowLeft color="#FFFFFF" size={23} />
          </Pressable>
        ) : null}
        {showBrand ? (
          <View style={styles.brand}>
            <View style={styles.logoFrame}>
              <Image
                accessibilityIgnoresInvertColors
                resizeMode="contain"
                source={require('../../../assets/images/TI LOGO.png')}
                style={styles.logo}
              />
            </View>
            <Text style={styles.brandText}>TimeInamo</Text>
          </View>
        ) : eyebrow ? (
          <Text style={styles.eyebrow}>{eyebrow}</Text>
        ) : (
          <View />
        )}
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
      <Text accessibilityRole="header" numberOfLines={2} style={[styles.title, compact && styles.compactTitle]}>
        {title}
      </Text>
      {subtitle ? <Text style={[styles.subtitle, compact && styles.compactSubtitle]}>{subtitle}</Text> : null}
      {showLocalNote ? (
        <View style={styles.localNote}>
          <Smartphone color="rgba(255,255,255,0.9)" size={17} />
          <Text style={styles.localText}>Saved on this device</Text>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 236,
    overflow: 'hidden',
    marginTop: -spacing.sm,
    paddingTop: spacing.lg,
    paddingHorizontal: 20,
    paddingBottom: 56,
  },
  compact: {
    minHeight: 164,
    paddingBottom: spacing.xl,
  },
  waveOne: {
    position: 'absolute',
    right: -110,
    bottom: -90,
    width: 340,
    height: 190,
    backgroundColor: 'rgba(94, 234, 212, 0.20)',
    borderRadius: radius.pill,
    transform: [{ rotate: '-18deg' }],
  },
  waveTwo: {
    position: 'absolute',
    right: -150,
    bottom: -118,
    width: 390,
    height: 184,
    backgroundColor: 'rgba(153, 246, 228, 0.15)',
    borderRadius: radius.pill,
    transform: [{ rotate: '-12deg' }],
  },
  topRow: {
    minHeight: layout.minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  compactTopRow: { minHeight: 32 },
  back: {
    width: layout.minimumTouchTarget,
    height: layout.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
    borderRadius: radius.pill,
  },
  pressed: { backgroundColor: 'rgba(255,255,255,0.15)' },
  brand: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoFrame: {
    width: 36,
    height: 36,
    overflow: 'visible',
  },
  logo: { width: '100%', height: '100%' },
  brandText: { color: '#FFFFFF', fontSize: 22, lineHeight: 28, fontWeight: '700' },
  eyebrow: { minWidth: 0, flex: 1, color: 'rgba(255,255,255,0.86)', fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.4 },
  action: { marginLeft: 'auto' },
  title: {
    marginTop: spacing.md,
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  compactTitle: { marginTop: spacing.xs, fontSize: 28, lineHeight: 34 },
  subtitle: { marginTop: spacing.xs, color: 'rgba(255,255,255,0.92)', ...typography.body },
  compactSubtitle: { fontSize: 14, lineHeight: 20 },
  localNote: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  localText: { color: 'rgba(255,255,255,0.9)', ...typography.caption },
});
