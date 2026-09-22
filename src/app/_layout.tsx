import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useDataStore } from '@/store/data';
import { colors, spacing, type } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // SQLite is opened synchronously, so data is ready before the first screen renders.
  const [error] = useState<string | null>(() => {
    try {
      useDataStore.getState().load();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  });

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (error) {
    return (
      <View style={styles.error}>
        <Text style={type.title}>Không mở được cơ sở dữ liệu</Text>
        <Text style={type.body}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.onPrimary,
          headerTitleStyle: { color: colors.onPrimary, fontWeight: '700' },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="setup" options={{ title: 'Thông tin đơn vị' }} />
        <Stack.Screen name="campaigns" options={{ title: 'Đợt sơ tuyển' }} />
        <Stack.Screen name="campaign-form" options={{ title: 'Đợt sơ tuyển' }} />
        <Stack.Screen name="scan-cccd" options={{ title: 'Quét CCCD gắn chip' }} />
        <Stack.Screen name="citizen-form" options={{ title: 'Công dân' }} />
        <Stack.Screen name="citizen/[id]" options={{ title: 'Hồ sơ công dân' }} />
        <Stack.Screen name="screening/[citizenId]" options={{ title: 'Phiếu sơ tuyển' }} />
        <Stack.Screen name="disease-picker" options={{ title: 'Chọn bệnh, tật', presentation: 'modal' }} />
        <Stack.Screen name="measure-weight" options={{ title: 'Cân nặng (Bluetooth)' }} />
        <Stack.Screen name="devices" options={{ title: 'Cân Bluetooth' }} />
        <Stack.Screen name="standards/[specialty]" options={{ title: 'Tiêu chuẩn bệnh tật' }} />
        <Stack.Screen name="guide" options={{ title: 'Chỉ dẫn khám (Mục IV)' }} />
        <Stack.Screen name="import" options={{ title: 'Nhập dữ liệu' }} />
        <Stack.Screen name="settings" options={{ title: 'Cài đặt' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  error: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
});
