import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useStoreHydrated } from '@/store/userStore';
import { colors } from '@/theme';

export default function RootLayout() {
  const hydrated = useStoreHydrated();

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {hydrated ? (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="profile" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="daily-quiz" options={{ presentation: 'fullScreenModal', animation: 'fade_from_bottom', gestureEnabled: false }} />
        </Stack>
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.bg }} />
      )}
    </SafeAreaProvider>
  );
}
