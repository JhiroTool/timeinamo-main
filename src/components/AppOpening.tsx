import { isRunningInExpoGo } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { fontFamilies, spacing } from '@/theme';

const logo = require('../../assets/images/TI LOGO 432.png');
const logoWidth = 144;
const revealDuration = 2700;
const exitDuration = 500;
const nativeFadeDuration = 120;
const openingBackground = '#FFFFFF';
const wordmarkColor = '#0F172A';
const taglineColor = '#64748B';
const accentColor = '#0F766E';
const accentSoft = '#CCFBF1';
const exitEasing = Easing.inOut(Easing.cubic);
const isExpoGo = isRunningInExpoGo();
let nativeHide: Promise<void> | undefined;

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
    const arrival = easeOutBetween(time, 0, 700);
    // Installed builds inherit the same mark from the native splash. Expo Go cannot,
    // so its custom opening performs the full logo entrance here.
    return {
      opacity: reduceMotion || !isExpoGo ? 1 : arrival,
      transform: [{ scale: reduceMotion || !isExpoGo ? 1 : 0.9 + 0.1 * arrival }],
    };
  });
  const accent = useAnimatedStyle(() => {
    const time = timeline.get();
    const expansion = easeOutBetween(time, 700, 1400);
    return {
      opacity: reduceMotion ? 0 : 0.42 * easeOutBetween(time, 700, 850) * (1 - easeOutBetween(time, 1150, 1400)),
      transform: [{ scale: 1 + 0.18 * expansion }],
    };
  });
  const wordmark = useAnimatedStyle(() => {
    const reveal = reduceMotion ? 1 : easeOutBetween(timeline.get(), 1400, 2200);
    return { opacity: reveal, transform: [{ translateY: 10 * (1 - reveal) }] };
  });
  const tagline = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 1 : easeOutBetween(timeline.get(), 2200, 2700),
  }));

  return (
    <Animated.View
      accessibilityLabel="TimeInamo. Track Time. Record Progress."
      accessibilityRole="progressbar"
      accessible
      onLayout={() => setLaidOut(true)}
      style={[styles.cover, cover]}
    >
      <View style={[styles.lockup, { width: copyWidth, height: imageSize }]}>
        <View style={{ width: imageSize, height: imageSize }}>
          <Animated.View pointerEvents="none" style={[styles.accent, accent]} />
          <Animated.Image
            accessible={false}
            fadeDuration={0}
            onError={() => setImageLoaded(true)}
            onLoad={() => setImageLoaded(true)}
            resizeMode="contain"
            source={logo}
            style={[styles.logo, mark]}
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
  lockup: { alignItems: 'center' },
  accent: {
    position: 'absolute',
    top: -7,
    right: -7,
    bottom: -7,
    left: -7,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: accentColor,
    backgroundColor: accentSoft,
  },
  logo: { width: '100%', height: '100%' },
  copy: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    paddingTop: spacing.lg,
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
