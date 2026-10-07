import React from 'react';
import { Stack } from 'expo-router';
import { RoleGuard } from '../../components/auth/RoleGuard';

export default function CitizenLayout() {
  return (
    <RoleGuard allowedRoles={['CITIZEN']}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="apply/[serviceId]" />
        <Stack.Screen name="application/[id]" />
      </Stack>
    </RoleGuard>
  );
}

