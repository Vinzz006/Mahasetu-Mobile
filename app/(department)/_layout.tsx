import React from 'react';
import { Stack } from 'expo-router';
import { RoleGuard } from '../../components/auth/RoleGuard';

export default function DepartmentLayout() {
  return (
    <RoleGuard allowedRoles={['DEPARTMENT_A', 'DEPARTMENT_B', 'DEPARTMENT_C', 'DEPARTMENT_OFFICER']}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="review/[id]" />
      </Stack>
    </RoleGuard>
  );
}

