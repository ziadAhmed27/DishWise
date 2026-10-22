import { PlanProvider } from '@/context/PlanContext';
import { ProfileProvider, useProfile } from '@/context/ProfileContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

function Gate() {
  const { profile, loaded } = useProfile();
  const { colors, loaded: themeLoaded } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!loaded) return;
    const inOnboarding = segments[0] === 'onboarding';
    if (!profile && !inOnboarding) {
      router.replace('/onboarding');
    } else if (profile && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [loaded, profile, segments, router]);

  if (!loaded || !themeLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ProfileProvider>
        <ThemedStatusBar />
        <PlanProvider>
          <Gate />
        </PlanProvider>
      </ProfileProvider>
    </ThemeProvider>
  );
}
