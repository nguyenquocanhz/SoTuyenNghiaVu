import { Redirect, Tabs, router } from 'expo-router';
import { Pressable, type ColorValue } from 'react-native';

import { Icon, type IconName } from '@/components';
import { useSettingsStore, unitConfigured } from '@/store/settings';
import { colors } from '@/theme';

const tabIcon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Icon name={name} color={color} size={size} />;

export default function TabLayout() {
  const configured = useSettingsStore(unitConfigured);
  if (!configured) return <Redirect href={{ pathname: '/setup', params: { onboarding: '1' } }} />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTitleStyle: { color: colors.onPrimary, fontWeight: '700' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, minHeight: 60 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        headerRight: () => (
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Cài đặt"
            hitSlop={12}
            style={{ paddingHorizontal: 16 }}>
            <Icon name="cog-outline" color={colors.onPrimary} size={24} />
          </Pressable>
        ),
      }}>
      <Tabs.Screen name="index" options={{ title: 'Sơ tuyển NVQS', tabBarLabel: 'Tổng quan', tabBarIcon: tabIcon('view-dashboard-outline') }} />
      <Tabs.Screen name="citizens" options={{ title: 'Công dân', tabBarIcon: tabIcon('account-group-outline') }} />
      <Tabs.Screen name="reports" options={{ title: 'Báo cáo', tabBarIcon: tabIcon('file-document-multiple-outline') }} />
      <Tabs.Screen name="standards" options={{ title: 'Tiêu chuẩn', tabBarIcon: tabIcon('book-open-variant') }} />
    </Tabs>
  );
}
