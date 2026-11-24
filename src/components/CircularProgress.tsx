import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { colors, fontFamilies } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularProgressProps {
  percentage: number;
  size: number;
  active: boolean;
  reducedMotion: boolean | null;
}

export function CircularProgress({ percentage, size, active, reducedMotion }: CircularProgressProps) {
  const strokeWidth = 8;
  const ringRadius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * ringRadius;
  const visualPercentage = Math.min(100, Math.max(0, percentage));
  const displayed = (percentage < 100 ? Math.min(99.9, percentage) : percentage)
    .toLocaleString('en-US', { maximumFractionDigits: 1 });
  const arc = useSharedValue(reducedMotion ? visualPercentage : 0);
  const lastAnimatedTarget = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      cancelAnimation(arc);
      return;
    }
    if (reducedMotion === null) return;
    if (reducedMotion || lastAnimatedTarget.current === visualPercentage) {
      cancelAnimation(arc);
      arc.set(visualPercentage);
      lastAnimatedTarget.current = visualPercentage;
      return;
    }
    lastAnimatedTarget.current = visualPercentage;
    arc.set(withTiming(visualPercentage, {
      duration: 750,
      easing: Easing.out(Easing.cubic),
    }));
    return () => cancelAnimation(arc);
  }, [active, arc, reducedMotion, visualPercentage]);

  const animatedProps = useAnimatedProps(() => {
    const value = arc.get();
    return {
      strokeDashoffset: circumference * (1 - value / 100),
      strokeOpacity: value > 0 ? 1 : 0,
    };
  });

  return (
    <View
      accessible
      accessibilityLabel={`${displayed} percent of required OJT hours completed`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.floor(visualPercentage) }}
      style={{ width: size, height: size }}
    >
      <Svg accessible={false} height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={ringRadius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
        />
        <AnimatedCircle
          animatedProps={animatedProps}
          cx={size / 2}
          cy={size / 2}
          fill="none"
          origin={`${size / 2}, ${size / 2}`}
          r={ringRadius}
          rotation={-90}
          stroke={percentage >= 100 ? colors.success : colors.primary}
          strokeDasharray={[circumference, circumference]}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      </Svg>
      <View pointerEvents="none" style={styles.label}>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.percentage}>{displayed}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  percentage: {
    color: colors.text,
    fontFamily: fontFamilies.heading,
    fontSize: 27,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    width: '100%',
  },
});
