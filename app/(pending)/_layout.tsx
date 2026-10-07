import React from 'react';
import { Stack } from 'expo-router';
import { RoleGuard } from '../../components/auth/RoleGuard';

export default function PendingLayout() {
  return (
    <RoleGuard
      allowedRoles={[
        'PENDING',
        'CITIZEN',
        'DEPARTMENT_A',
        'DEPARTMENT_B',
        'DEPARTMENT_C',
        'DEPARTMENT_OFFICER',
        'ADMIN',
        'AUDITOR',
        '',
      ]}
      requireApproved={false}
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="profile" />
      </Stack>
    </RoleGuard>
  );
}

