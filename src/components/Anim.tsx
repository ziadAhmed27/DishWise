import { Fragment, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, PressableProps, StyleProp, Text, TextStyle, ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

/** Fade + slide-up entrance. `index` staggers siblings (capped so long lists stay snappy). */
export function Appear({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 70).duration(420)} style={style}>
      {children}
    </Animated.View>
  );
}

/**
 * Remounts its children every time the tab is focused again, so their
 * entrance animations replay. Only use it on screens WITHOUT local state
 * (profile, diet) — the form and chat keep their state, so they don't use it.
 */
export function FocusReplay({ children }: { children: ReactNode }) {
  const [key, setKey] = useState(0);
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false; // first focus = initial mount, no replay needed
        return;
      }
      setKey((k) => k + 1);
    }, [])
  );
  return <Fragment key={key}>{children}</Fragment>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that gently shrinks while pressed. `style` must be a plain style (not a function). */
export function PressableScale({
  style,
  children,
  scaleTo = 0.96,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  scaleTo?: number;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, { damping: 15, stiffness: 300 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 12, stiffness: 220 });
        onPressOut?.(e);
      }}
      style={[style, anim]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Number that counts up from 0 to `to`. */
export function CountUp({
  to,
  suffix = '',
  duration = 900,
  style,
}: {
  to: number;
  suffix?: string;
  duration?: number;
  style?: StyleProp<TextStyle>;
}) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setValue(Math.round(to * (1 - Math.pow(1 - t, 3)))); // ease-out
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return (
    <Text style={style}>
      {value}
      {suffix}
    </Text>
  );
}
