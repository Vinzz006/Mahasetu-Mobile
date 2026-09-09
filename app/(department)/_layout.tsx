import React from 'react';
import { Stack } from 'expo-router';

export default function DepartmentLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="review/[id]" />
    </Stack>
  );
}
