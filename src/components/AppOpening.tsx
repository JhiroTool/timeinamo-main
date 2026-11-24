import { isRunningInExpoGo } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, Line } from 'react-native-svg';

import { fontFamilies, spacing } from '@/theme';

const logo = require('../../assets/images/TI LOGO 432.png');
const nativeLogoWidth = 144;
const revealDuration = 3800;
const exitDuration = 420;
const nativeFadeDuration = 100;
const openingBackground = '#FFFFFF';
const wordmarkColor = '#0F172A';
const taglineColor = '#64748B';
const accentColor = '#0F766E';
const accentDark = '#115E59';
const accentMedium = '#70C7BE';
const accentSoft = '#CCFBF1';
const exitEasing = Easing.inOut(Easing.cubic);
const isExpoGo = isRunningInExpoGo();
let nativeHide: Promise<void> | undefined;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Claim the native splash before Expo Router can automatically dismiss it.
void SplashScreen.preventAutoHideAsync().catch((error: unknown) => {
  if (__DEV__) console.warn('TimeInamo could not hold the native splash.', error);
});

function hideNativeSplashOnce(reduceMotion: boolean) {
  if (!nativeHide) {
    try {
      if (!isExpoGo) {
        SplashScreen.setOptions({ duration: reduceMotion ? 0 : nativeFadeDuration, fade: !reduceMotion });
      }
    } catch (error) {
      if (__DEV__) console.warn('TimeInamo could not configure the native splash fade.', error);
    }
    nativeHide = SplashScreen.hideAsync().catch((error: unknown) => {
      if (__DEV__) console.warn('TimeInamo could not hide the native splash.', error);
    });
  }
  return nativeHide!;
}

function progressBetween(time: number, start: number, end: number) {
  'worklet';
  return Math.max(0, Math.min(1, (time - start) / (end - start)));
}

function easeOutBetween(time: number, start: number, end: number) {
  'worklet';
  const fraction = progressBetween(time, start, end);
  return 1 - (1 - fraction) ** 3;
}

function easeInOutBetween(time: number, start: number, end: number) {
  'worklet';
  const fraction = progressBetween(time, start, end);
  return fraction < 0.5
    ? 4 * fraction ** 3
    : 1 - (-2 * fraction + 2) ** 3 / 2;
}

export function AppOpening({ ready, fontsReady, onFinish }: {
  ready: boolean;
  fontsReady: boolean;
  onFinish: () => void;
}) {
  const [laidOut, setLaidOut] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [nativeReleased, setNativeReleased] = useState(false);
  const [revealComplete, setRevealComplete] = useState(false);
  const reduceMotion = Boolean(useReducedMotion());
  const timeline = useSharedValue(0);
  const opacity = useSharedValue(1);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const imageSize = Math.max(
    72,
    Math.min(nativeLogoWidth, width - insets.left - insets.right - 72, height * 0.25),
  );
  const copyWidth = Math.min(384, width - insets.left - insets.right - 40);
  const dialSize = imageSize + 92;
  const constructionWidth = Math.min(dialSize + 104, copyWidth);
  const dialRadius = dialSize / 2 - 12;
  const orbitRadius = dialRadius - 2;
  const dialCircumference = 2 * Math.PI * dialRadius;
  const orbitCircumference = 2 * Math.PI * orbitRadius;
  const ticks = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const angle = index * 30 * Math.PI / 180;
    const outer = dialRadius + 4;
    const inner = outer - (index % 3 === 0 ? 7 : 4);
    const center = dialSize / 2;
    return {
      key: index,
      x1: center + Math.sin(angle) * inner,
      y1: center - Math.cos(angle) * inner,
      x2: center + Math.sin(angle) * outer,
      y2: center - Math.cos(angle) * outer,
      strong: index % 3 === 0,
    };
  }), [dialRadius, dialSize]);

  useEffect(() => {
    if (!laidOut || !imageLoaded || !fontsReady) return;
    let active = true;
    const frame = requestAnimationFrame(() => {
      void hideNativeSplashOnce(reduceMotion).then(() => {
        if (active) setNativeReleased(true);
      });
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [fontsReady, imageLoaded, laidOut, reduceMotion]);

  const markRevealComplete = useCallback(() => setRevealComplete(true), []);

  useEffect(() => {
    if (!nativeReleased || reduceMotion) return;

    timeline.set(withTiming(revealDuration, {
      duration: revealDuration,
      easing: Easing.linear,
      reduceMotion: ReduceMotion.System,
    }, (finished) => {
      if (finished) scheduleOnRN(markRevealComplete);
    }));
    return () => cancelAnimation(timeline);
  }, [markRevealComplete, nativeReleased, reduceMotion, timeline]);

  useEffect(() => {
    if (nativeReleased && reduceMotion && ready) onFinish();
  }, [nativeReleased, onFinish, ready, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || !nativeReleased || !revealComplete || !ready) return;
    opacity.set(withTiming(0, {
      duration: exitDuration,
      easing: exitEasing,
      reduceMotion: ReduceMotion.System,
    }, (finished) => {
      if (finished) scheduleOnRN(onFinish);
    }));
    return () => cancelAnimation(opacity);
  }, [nativeReleased, onFinish, opacity, ready, reduceMotion, revealComplete]);

  const cover = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const construction = useAnimatedStyle(() => {
    const time = timeline.get();
    const arrive = easeOutBetween(time, 0, 720);
    const depart = easeInOutBetween(time, 2860, 3540);
    return {
      opacity: reduceMotion ? 0 : 0.72 * arrive * (1 - depart),
      transform: [{ scaleX: arrive }],
    };
  });
  const constructionEnd = useAnimatedStyle(() => {
    const time = timeline.get();
    const arrive = easeOutBetween(time, 220, 880);
    const depart = easeInOutBetween(time, 2860, 3540);
    return {
      opacity: reduceMotion ? 0 : 0.5 * arrive * (1 - depart),
      transform: [{ scaleX: arrive }],
    };
  });
  const dial = useAnimatedStyle(() => {
    const time = timeline.get();
    const reveal = easeOutBetween(time, 280, 1120);
    const retreat = easeInOutBetween(time, 2920, 3640);
    return {
      opacity: reduceMotion ? 0 : reveal * (1 - 0.72 * retreat),
      transform: [{ scale: 0.96 + 0.04 * reveal }],
    };
  });
  const pulse = useAnimatedStyle(() => {
    const time = timeline.get();
    const beat = easeOutBetween(time, 1180, 2060);
    return {
      opacity: reduceMotion ? 0 : 0.28 * (1 - beat),
      transform: [{ scale: 0.78 + 0.42 * beat }],
    };
  });
  const mark = useAnimatedStyle(() => {
    const time = timeline.get();
    const reveal = easeOutBetween(time, 420, 1460);
    const nativeContinuity = isExpoGo ? 0 : 1 - easeInOutBetween(time, 80, 620);
    const visibility = Math.max(reveal, nativeContinuity);
    return {
      opacity: reduceMotion ? 1 : visibility,
      transform: [{ scale: reduceMotion ? 1 : 0.92 + 0.08 * visibility }],
    };
  });
  const sweepDot = useAnimatedStyle(() => {
    const time = timeline.get();
    const travel = easeInOutBetween(time, 860, 2480);
    const angle = (-96 + 246 * travel) * Math.PI / 180;
    const appear = easeOutBetween(time, 760, 1040);
    const depart = easeInOutBetween(time, 2640, 3180);
    return {
      opacity: reduceMotion ? 0 : appear * (1 - depart),
      transform: [
        { translateX: Math.cos(angle) * orbitRadius },
        { translateY: Math.sin(angle) * orbitRadius },
        { scale: 0.75 + 0.25 * appear },
      ],
    };
  });
  const wordmark = useAnimatedStyle(() => {
    const reveal = reduceMotion ? 1 : easeOutBetween(timeline.get(), 1840, 2660);
    return {
      opacity: reveal,
      transform: [{ translateY: 10 * (1 - reveal) }],
    };
  });
  const tagline = useAnimatedStyle(() => {
    const reveal = reduceMotion ? 1 : easeOutBetween(timeline.get(), 2380, 3160);
    return {
      opacity: reveal,
      transform: [{ translateY: 7 * (1 - reveal) }],
    };
  });

  const primaryArc = useAnimatedProps(() => {
    const reveal = reduceMotion ? 1 : easeOutBetween(timeline.get(), 420, 1460);
    return {
      strokeDashoffset: dialCircumference * 0.66 * (1 - reveal),
      strokeOpacity: 0.92,
    };
  });
  const progressArc = useAnimatedProps(() => {
    const reveal = reduceMotion ? 1 : easeOutBetween(timeline.get(), 920, 2460);
    return {
      strokeDashoffset: orbitCircumference * 0.31 * (1 - reveal),
      strokeOpacity: 0.58,
    };
  });

  return (
    <Animated.View
      accessibilityLabel="TimeInamo. Track Time. Record Progress."
      accessibilityRole="progressbar"
      accessibilityValue={{ text: 'Starting TimeInamo' }}
      accessible
      onLayout={() => setLaidOut(true)}
      style={[styles.cover, cover]}
    >
      <View style={[styles.lockup, { width: copyWidth }]}>
        <View pointerEvents="none" style={[styles.constructionField, { width: constructionWidth }]}>
          <Animated.View style={[styles.constructionLine, construction]} />
          <Animated.View style={[styles.constructionLine, styles.constructionLineEnd, constructionEnd]} />
          <Animated.View style={[styles.guideDot, styles.guideDotLeft, construction]} />
          <Animated.View style={[styles.guideDot, styles.guideDotRight, constructionEnd]} />
        </View>

        <View style={[styles.dialStage, { width: dialSize, height: dialSize }]}>
          <Animated.View
            pointerEvents="none"
            style={[styles.pulseRing, pulse, { width: dialSize - 24, height: dialSize - 24 }]}
          />
          <Animated.View pointerEvents="none" style={[styles.dial, dial, { width: dialSize, height: dialSize }]}>
            <Svg height={dialSize} width={dialSize}>
              <Circle
                cx={dialSize / 2}
                cy={dialSize / 2}
                fill="none"
                r={dialRadius}
                stroke={accentSoft}
                strokeWidth={1}
              />
              {ticks.map((tick) => (
                <Line
                  key={tick.key}
                  stroke={tick.strong ? accentMedium : accentSoft}
                  strokeLinecap="round"
                  strokeWidth={tick.strong ? 1.4 : 1}
                  x1={tick.x1}
                  x2={tick.x2}
                  y1={tick.y1}
                  y2={tick.y2}
                />
              ))}
              <AnimatedCircle
                animatedProps={primaryArc}
                cx={dialSize / 2}
                cy={dialSize / 2}
                fill="none"
                origin={`${dialSize / 2}, ${dialSize / 2}`}
                r={dialRadius}
                rotation="-92"
                stroke={accentColor}
                strokeDasharray={`${dialCircumference * 0.66} ${dialCircumference}`}
                strokeLinecap="round"
                strokeWidth={1.7}
              />
              <AnimatedCircle
                animatedProps={progressArc}
                cx={dialSize / 2}
                cy={dialSize / 2}
                fill="none"
                origin={`${dialSize / 2}, ${dialSize / 2}`}
                r={orbitRadius}
                rotation="-28"
                stroke={accentMedium}
                strokeDasharray={`${orbitCircumference * 0.31} ${orbitCircumference}`}
                strokeLinecap="round"
                strokeWidth={1.1}
              />
            </Svg>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.sweepDot,
                sweepDot,
                { left: dialSize / 2 - 3, top: dialSize / 2 - 3 },
              ]}
            />
          </Animated.View>

          <View pointerEvents="none" style={styles.logoField}>
            <Animated.Image
              accessible={false}
              fadeDuration={0}
              onError={() => setImageLoaded(true)}
              onLoad={() => setImageLoaded(true)}
              resizeMode="contain"
              source={logo}
              style={[styles.logo, mark, { width: imageSize, height: imageSize }]}
            />
          </View>
        </View>

        {fontsReady ? (
          <View style={styles.copy}>
            <Animated.Text maxFontSizeMultiplier={1.65} style={[styles.wordmark, wordmark]}>
              TimeInamo
            </Animated.Text>
            <Animated.Text maxFontSizeMultiplier={1.65} style={[styles.tagline, tagline]}>
              Track Time. Record Progress.
            </Animated.Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    backgroundColor: openingBackground,
    justifyContent: 'center',
    zIndex: 1,
  },
  lockup: { alignItems: 'center', justifyContent: 'center' },
  constructionField: {
    height: 34,
    justifyContent: 'space-between',
    marginBottom: -17,
    zIndex: 2,
  },
  constructionLine: {
    alignSelf: 'center',
    backgroundColor: accentColor,
    height: 1,
    width: '100%',
  },
  constructionLineEnd: {
    alignSelf: 'flex-end',
    backgroundColor: accentMedium,
    width: '66%',
  },
  guideDot: {
    backgroundColor: accentDark,
    borderRadius: 2,
    height: 3,
    position: 'absolute',
    top: -1,
    width: 3,
  },
  guideDotLeft: { left: 0 },
  guideDotRight: { bottom: -1, right: '17%', top: undefined },
  dialStage: { alignItems: 'center', justifyContent: 'center' },
  dial: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  pulseRing: {
    borderColor: accentSoft,
    borderRadius: 999,
    borderWidth: 1,
    position: 'absolute',
  },
  sweepDot: {
    backgroundColor: accentColor,
    borderColor: openingBackground,
    borderRadius: 4,
    borderWidth: 1,
    height: 7,
    position: 'absolute',
    width: 7,
  },
  logoField: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  logo: { height: '100%', width: '100%' },
  copy: {
    alignItems: 'center',
    gap: spacing.xs,
    height: 78,
    marginTop: spacing.sm,
  },
  wordmark: {
    color: wordmarkColor,
    fontFamily: fontFamilies.heading,
    fontSize: 34,
    letterSpacing: -1.2,
    textAlign: 'center',
  },
  tagline: {
    color: taglineColor,
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 14,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
});
