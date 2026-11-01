import { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';
import { IconName } from '@/components/ui';
import { useT } from '@/lib/i18n';

/** Outline icons in both states (one icon per meaning); the tint and label mark the selected tab. */
function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} size={size} color={color} />;
}

/**
 * Bottom tabs. Clinics joins them in phase 3.
 */
export default function TabsLayout() {
  const t = useT();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('nav.home'), tabBarIcon: tabIcon('home-outline') }} />
      <Tabs.Screen name="visits" options={{ title: t('nav.visits'), tabBarIcon: tabIcon('calendar-outline') }} />
      <Tabs.Screen name="products" options={{ title: t('nav.products'), tabBarIcon: tabIcon('medkit-outline') }} />
      <Tabs.Screen
        name="more"
        options={{ title: t('nav.more'), tabBarIcon: tabIcon('ellipsis-horizontal-outline') }}
      />
    </Tabs>
  );
}
