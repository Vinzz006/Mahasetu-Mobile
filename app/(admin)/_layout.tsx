import React from 'react';
import { Stack } from 'expo-router';
import { RoleGuard } from '../../components/auth/RoleGuard';

export default function AdminLayout() {
  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </RoleGuard>
  );
}

