import { Check, Clock3, History, LogIn } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { colors, fontFamilies, radius, spacing } from '@/theme';

const actions = {
  ready: { label: 'Time In', icon: LogIn },
  active: { label: 'View Session', icon: Clock3 },
  completed: { label: 'View Attendance', icon: Check },
  incomplete: { label: 'Review Session', icon: History },
};

export function HomeAttendanceControl({
  disabled,
  isVisible,
  loading,
  onPress,
  state,
}: {
  disabled: boolean;
  isVisible: boolean;
  loading: boolean;
  onPress: () => void;
  state: keyof typeof actions;
}) {
  const { width } = useWindowDimensions();
  const size = Math.round(Math.min(148, Math.max(122, width * 0.36)));
  const [reduceMotion, setReduceMotion] = useState(true);
  const breath = useSharedValue(1);
  const sweep = useSharedValue(0);
  const press = useSharedValue(1);
  const active = state === 'active';
  const incomplete = state === 'incomplete';
  const animateRing = active && isVisible && !reduceMotion;
  const { icon: Icon, label } = actions[state];

  useEffect(() => {
    let awaitingInitialPreference = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      awaitingInitialPreference = false;
      setReduceMotion(enabled);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (awaitingInitialPreference) setReduceMotion(enabled);
    }, () => {});

    return () => {
      awaitingInitialPreference = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!animateRing) return;

    // The accessibility listener also handles preference changes made after launch.
    breath.set(0.985);
    breath.set(withRepeat(withTiming(1.035, {
      duration: 2000,
      easing: Easing.inOut(Easing.sin),
    }), -1, true, undefined, ReduceMotion.Never));
    sweep.set(withRepeat(withTiming(360, {
      duration: 14000,
      easing: Easing.linear,
    }), -1, false, undefined, ReduceMotion.Never));

    return () => {
      cancelAnimation(breath);
      cancelAnimation(sweep);
      breath.set(1);
      sweep.set(0);
    };
  }, [animateRing, breath, sweep]);

  useEffect(() => {
    return () => {
      cancelAnimation(press);
      press.set(1);
    };
  }, [isVisible, press, reduceMotion]);

  const breathingStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.get() }] }));
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${sweep.get()}deg` }] }));
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.get() }] }));

  function animatePress(scale: number) {
    if (!reduceMotion) press.set(withTiming(scale, { duration: 120, reduceMotion: ReduceMotion.Never }));
  }

  return (
    <Pressable
      accessibilityLabel={loading ? 'Saving Time In' : active ? 'View Session, tracking active' : label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => animatePress(0.97)}
      onPressOut={() => animatePress(1)}
      style={({ pressed }) => [styles.control, pressed && reduceMotion && styles.staticPress]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.outerRing, incomplete && styles.warningOuterRing, breathingStyle]}
      >
        {animateRing ? (
          <Animated.View style={[StyleSheet.absoluteFill, sweepStyle]}>
            <Svg width="100%" height="100%" viewBox="0 0 160 160">
              <Circle
                cx={80}
                cy={80}
                r={78.5}
                fill="none"
                stroke={colors.primary}
                strokeWidth={1.5}
                strokeOpacity={0.55}
                strokeDasharray={[37, 457]}
                strokeLinecap="round"
              />
            </Svg>
          </Animated.View>
        ) : null}
      </Animated.View>
      <View style={[styles.innerRing, incomplete && styles.warningInnerRing]}>
        <Animated.View style={[
          styles.face,
          { width: size, minHeight: size },
          state === 'completed' && styles.completedFace,
          incomplete && styles.warningFace,
          pressStyle,
        ]}>
          {loading ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <>
              <Icon color={incomplete ? colors.warning : colors.primarySoft} size={24} strokeWidth={1.9} />
              <Text style={[styles.label, incomplete && styles.warningLabel]}>{label}</Text>
              {active ? (
                <View style={styles.trackingRow}>
                  <View style={styles.trackingDot} />
                  <Text style={styles.trackingLabel}>Tracking</Text>
                </View>
              ) : null}
            </>
          )}
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  control: { position: 'relative', padding: 10, borderRadius: radius.pill },
  staticPress: { opacity: 0.8 },
  outerRing: { ...StyleSheet.absoluteFill, borderRadius: radius.pill, borderWidth: 1, borderColor: '#CFE6E2', backgroundColor: '#EFF8F7' },
  innerRing: { position: 'relative', borderRadius: radius.pill, borderWidth: 1, borderColor: '#C2E7E1', backgroundColor: '#E2F3F0', padding: 9 },
  face: { borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: spacing.sm, gap: 5 },
  label: { color: colors.surface, fontFamily: fontFamilies.label, fontSize: 14, lineHeight: 19, textAlign: 'center' },
  trackingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trackingDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#99F6E4' },
  trackingLabel: { color: colors.primarySoft, fontFamily: fontFamilies.bodyMedium, fontSize: 11, lineHeight: 15 },
  completedFace: { backgroundColor: colors.primaryDark },
  warningOuterRing: { backgroundColor: '#FFFBEB', borderColor: '#F3DFB0' },
  warningInnerRing: { backgroundColor: '#FEF3DB', borderColor: '#EDD399' },
  warningFace: { backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: '#EBC882' },
  warningLabel: { color: '#78350F' },
});
