import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

export function ProgressBar({ percentage, height = 11 }: { percentage: number; height?: number }) {
  const value = Math.min(100, Math.max(0, percentage));
  return (
    <View
      accessibilityLabel={`${percentage.toFixed(1)} percent completed`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: value }}
      style={[styles.track, { height }]}
    >
      <View style={[styles.fill, { width: `${value}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden', backgroundColor: colors.progressTrack, borderRadius: radius.pill },
  fill: { height: '100%', backgroundColor: colors.primaryBright, borderRadius: radius.pill },
});
