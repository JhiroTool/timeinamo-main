import { Platform } from 'react-native';

export const fontFamilies = {
  heading: 'PlusJakartaSans_700Bold',
  headingSemibold: 'PlusJakartaSans_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  label: 'Inter_600SemiBold',
} as const;

export const colors = {
  primary: '#0F766E',
  primaryDark: '#115E59',
  primaryBright: '#0D9488',
  primaryDeep: '#075E57',
  primarySoft: '#CCFBF1',
  background: '#F7F9FC',
  surface: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  progressTrack: '#DCE7F3',
  success: '#15803D',
  successSoft: '#DCFCE7',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  error: '#B91C1C',
  errorSoft: '#FEE2E2',
  disabled: '#CBD5E1',
  disabledText: '#64748B',
  overlay: 'rgba(15, 23, 42, 0.48)',
  transparent: 'transparent',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  card: 22,
  pill: 999,
} as const;

export const typography = {
  display: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  heading: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
  },
  subheading: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  bodyStrong: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
} as const;

export const layout = {
  minimumTouchTarget: 48,
  maxContentWidth: 720,
  tabBarBaseHeight: 64,
} as const;

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.1,
      shadowRadius: 14,
    },
    android: { elevation: 4 },
    default: {},
  }),
} as const;

export const theme = { colors, spacing, radius, typography, layout, shadows } as const;

