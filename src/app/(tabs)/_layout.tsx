import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Icon that pops slightly when its tab becomes active. */
function TabIcon({
  focused,
  color,
  size,
  active,
  inactive,
}: {
  focused: boolean;
  color: string;
  size: number;
  active: IconName;
  inactive: IconName;
}) {
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);
  useEffect(() => {
    scale.value = withSpring(focused ? 1.18 : 1, { damping: 9, stiffness: 180 });
    lift.value = withSpring(focused ? -2 : 0, { damping: 12, stiffness: 180 });
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps
  const anim = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scale: scale.value }],
  }));
  return (
    <Animated.View style={anim}>
      <Ionicons name={focused ? active : inactive} size={size} color={color} />
    </Animated.View>
  );
}

// English on the first line, Arabic under it (same pattern as the screens).
const tab = (en: string, ar: string, active: IconName, inactive: IconName) => ({
  title: en,
  tabBarLabel: ({ color }: { color: string }) => (
    <>
      <Text style={{ fontSize: 11, fontWeight: '600', color }}>{en}</Text>
      <Text style={{ fontSize: 10, color }}>{ar}</Text>
    </>
  ),
  tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
    <TabIcon focused={focused} color={color} size={size} active={active} inactive={inactive} />
  ),
});

export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        // Smooth cross-fade between tabs (React Navigation 7 bottom tabs).
        // Use 'shift' for a slight sideways slide instead.
        animation: 'fade',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 68,
          paddingBottom: 6,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen name="index" options={tab('Profile', 'الملف', 'person', 'person-outline')} />
      <Tabs.Screen name="form" options={tab('My info', 'بياناتي', 'clipboard', 'clipboard-outline')} />
      <Tabs.Screen name="diet" options={tab('Diet plan', 'الخطة', 'nutrition', 'nutrition-outline')} />
      <Tabs.Screen name="tracker" options={tab('Tracker', 'متابعتي', 'stats-chart', 'stats-chart-outline')}/>
      <Tabs.Screen name="chat" options={tab('Assistant', 'المساعد', 'chatbubble-ellipses', 'chatbubble-ellipses-outline')}/>
    </Tabs>
  );
}
