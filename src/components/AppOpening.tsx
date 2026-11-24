import { isRunningInExpoGo } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, ReduceMotion, useAnimatedProps, useAnimatedStyle, useReducedMotion,
  useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle } from 'react-native-svg';

import { fontFamilies, spacing } from '@/theme';

const logo = require('../../assets/images/TI LOGO 432.png');
const logoWidth = 132;
const revealDuration = 3800;
const exitDuration = 450;
const nativeFadeDuration = 120;
const openingBackground = '#FFFFFF';
const wordmarkColor = '#0F172A';
const taglineColor = '#64748B';
const accentColor = '#0F766E';
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
  return nativeHide;
}

function easeOutBetween(time: number, start: number, end: number) {
  'worklet';
  const fraction = Math.max(0, Math.min(1, (time - start) / (end - start)));
  return 1 - (1 - fraction) ** 3;
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
  const reduceMotion = useReducedMotion();
  const timeline = useSharedValue(0);
  const opacity = useSharedValue(1);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const imageSize = Math.max(72, Math.min(logoWidth, width - insets.left - insets.right - 48, height * 0.36));
  const copyWidth = Math.min(384, width - insets.left - insets.right - 40);

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
    if (!nativeReleased) return;
    if (reduceMotion) return;

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
  const mark = useAnimatedStyle(() => {
    const time = timeline.get();
    const arrival = easeOutBetween(time, 700, 1500);
    const settle = easeOutBetween(time, 1500, 2200);
    return {
      opacity: reduceMotion || !isExpoGo ? 1 : arrival,
      transform: [{
        scale: reduceMotion || !isExpoGo
          ? 1
          : 0.94 + 0.04 * arrival + 0.02 * settle,
      }],
    };
  });
  const ring = useAnimatedStyle(() => {
    const time = timeline.get();
    const reveal = easeOutBetween(time, 300, 1100);
    const breathe = 1 + 0.018 * Math.sin(Math.min(time, 2200) / 220);
    return {
      opacity: reduceMotion ? 0 : reveal * (1 - easeOutBetween(time, 3100, 3800)),
      transform: [{ scale: reduceMotion ? 1 : breathe }],
    };
  });
  const sweepDot = useAnimatedStyle(() => {
    const progress = easeOutBetween(timeline.get(), 900, 2600);
    const angle = -90 + 220 * progress;
    const radians = angle * Math.PI / 180;
    const radius = 82;
    return {
      opacity: easeOutBetween(timeline.get(), 900, 1100) * (1 - easeOutBetween(timeline.get(), 3000, 3400)),
      transform: [
        { translateX: Math.cos(radians) * radius },
        { translateY: Math.sin(radians) * radius },
      ],
    };
  });
  const horizontalLine = useAnimatedStyle(() => {
    const reveal = easeOutBetween(timeline.get(), 0, 800);
    return {
      opacity: 0.5 * reveal * (1 - easeOutBetween(timeline.get(), 3000, 3800)),
      transform: [{ scaleX: reveal }],
    };
  });
  const wordmark = useAnimatedStyle(() => {
    const reveal = reduceMotion ? 1 : easeOutBetween(timeline.get(), 1800, 2700);
    return { opacity: reveal, transform: [{ translateY: 12 * (1 - reveal) }] };
  });
  const tagline = useAnimatedStyle(() => {
    const reveal = reduceMotion ? 1 : easeOutBetween(timeline.get(), 2400, 3200);
    return { opacity: reveal, transform: [{ translateY: 8 * (1 - reveal) }] };
  });

  const ringSize = imageSize + 64;
  const ringRadius = ringSize / 2 - 5;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const primaryArc = useAnimatedProps(() => {
    const reveal = reduceMotion ? 1 : easeOutBetween(timeline.get(), 500, 1450);
    return {
      strokeDashoffset: ringCircumference * (1 - reveal * 0.68),
      strokeOpacity: 0.9,
    };
  });
  const progressArc = useAnimatedProps(() => {
    const reveal = reduceMotion ? 1 : easeOutBetween(timeline.get(), 1100, 2600);
    return {
      strokeDashoffset: ringCircumference * (1 - reveal * 0.36),
      strokeOpacity: 0.48,
    };
  });

  return (
    <Animated.View
      accessibilityLabel="TimeInamo. Track Time. Record Progress."
      accessibilityRole="progressbar"
      accessible
      onLayout={() => setLaidOut(true)}
      style={[styles.cover, cover]}
    >
      <View style={[styles.lockup, { width: copyWidth }]}>
        <Animated.View pointerEvents="none" style={[styles.horizontalLine, horizontalLine]} />
        <View style={{ width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View pointerEvents="none" style={[styles.ringField, ring, { width: ringSize, height: ringSize }]}>
            <Svg height={ringSize} width={ringSize}>
              <Circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                fill="none"
                r={ringRadius}
                stroke={accentSoft}
                strokeWidth={1}
              />
              <AnimatedCircle
                animatedProps={primaryArc}
                cx={ringSize / 2}
                cy={ringSize / 2}
                fill="none"
                origin={`${ringSize / 2}, ${ringSize / 2}`}
                r={ringRadius}
                rotation="-90"
                stroke={accentColor}
                strokeDasharray={`${ringCircumference * 0.68} ${ringCircumference}`}
                strokeLinecap="round"
                strokeWidth={1.5}
              />
              <AnimatedCircle
                animatedProps={progressArc}
                cx={ringSize / 2}
                cy={ringSize / 2}
                fill="none"
                origin={`${ringSize / 2}, ${ringSize / 2}`}
                r={ringRadius + 8}
                rotation="-24"
                stroke="#99D5CF"
                strokeDasharray={`${ringCircumference * 0.36} ${ringCircumference}`}
                strokeLinecap="round"
                strokeWidth={1}
              />
            </Svg>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.sweepDot,
                sweepDot,
                { left: ringSize / 2 - 2.5, top: ringSize / 2 - 2.5 },
              ]}
            />
          </Animated.View>
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
        {fontsReady ? (
          <View style={styles.copy}>
            <Animated.Text maxFontSizeMultiplier={1.65} style={[styles.wordmark, wordmark]}>TimeInamo</Animated.Text>
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
    backgroundColor: openingBackground,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  lockup: { alignItems: 'center', justifyContent: 'center' },
  horizontalLine: {
    position: 'absolute',
    top: -20,
    width: 104,
    height: 1,
    backgroundColor: accentColor,
    transformOrigin: 'center',
  },
  ringField: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  sweepDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: accentColor,
  },
  logo: { width: '100%', height: '100%' },
  copy: {
    height: 78,
    marginTop: spacing.sm,
    gap: spacing.xs,
    alignItems: 'center',
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
