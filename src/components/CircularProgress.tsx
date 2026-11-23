import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, typography } from '@/theme';

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}

export function CircularProgress({
  percentage,
  size = 184,
  strokeWidth = 14,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const visualPercentage = Math.min(100, Math.max(0, percentage));
  const displayPercentage = Number.isInteger(percentage)
    ? percentage.toFixed(0)
    : percentage.toFixed(1);

  return (
    <View
      accessibilityLabel={`${displayPercentage} percent of required OJT hours completed`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: visualPercentage }}
      style={{ width: size, height: size }}
    >
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={colors.progressTrack}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          rotation="-90"
          stroke={colors.primaryBright}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - visualPercentage / 100)}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View pointerEvents="none" style={styles.label}>
        <Text style={styles.percentage}>{displayPercentage}%</Text>
        <Text style={styles.caption}>completed</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentage: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  caption: {
    color: colors.textSecondary,
    ...typography.caption,
  },
});

