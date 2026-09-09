import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../store/AuthContext';
import { Colors } from '../constants/theme';
import { MahaSetuAIAssistant } from '../components/ai/MahaSetuAIAssistant';
import { OfflineBanner } from '../components/common/OfflineBanner';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

function AppLayoutContent() {
  const { isOffline } = useNetworkStatus();

  return (
    <>
      <OfflineBanner isOffline={isOffline} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(pending)" />
        <Stack.Screen name="(citizen)" />
        <Stack.Screen name="(department)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(auditor)" />
        <Stack.Screen name="resident-details" />
      </Stack>
      <MahaSetuAIAssistant />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" backgroundColor={Colors.primaryDark} />
        <AppLayoutContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}


