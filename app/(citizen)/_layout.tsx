import React from 'react';
import { Stack } from 'expo-router';

export default function CitizenLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="apply/[serviceId]" />
      <Stack.Screen name="application/[id]" />
    </Stack>
  );
}
