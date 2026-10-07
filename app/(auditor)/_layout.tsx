import React from 'react';
import { Stack } from 'expo-router';
import { RoleGuard } from '../../components/auth/RoleGuard';

export default function AuditorLayout() {
  return (
    <RoleGuard allowedRoles={['AUDITOR']}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="review/[id]" />
      </Stack>
    </RoleGuard>
  );
}

