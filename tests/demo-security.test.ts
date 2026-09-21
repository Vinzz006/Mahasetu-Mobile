import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { DEMO_PASSWORD } from '../constants/demoData';
import { authService } from '../services/authService';

describe('Demo Mode Gating & Credential Security Tests', () => {
  it('1. DEMO_PASSWORD does not contain hardcoded default password in repo', () => {
    assert.notStrictEqual(DEMO_PASSWORD, 'MahaSetu@2026!');
  });

  it('2. switchDemoAccount rejects execution when demo mode is not enabled', async () => {
    const originalDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE;
    try {
      process.env.EXPO_PUBLIC_DEMO_MODE = 'false';
      const mockPersona: any = {
        id: 'demo-citizen',
        name: 'Demo Citizen',
        email: 'citizen@mahasetu.gov.in',
        role: 'citizen',
      };

      await assert.rejects(
        async () => {
          await authService.switchDemoAccount(mockPersona);
        },
        /strictly disabled in production builds/
      );
    } finally {
      process.env.EXPO_PUBLIC_DEMO_MODE = originalDemoMode;
    }
  });

  it('3. switchDemoAccount rejects execution when DEMO_PASSWORD is empty', async () => {
    const originalDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE;
    const originalPassword = process.env.EXPO_PUBLIC_DEMO_PASSWORD;
    try {
      process.env.EXPO_PUBLIC_DEMO_MODE = 'true';
      delete process.env.EXPO_PUBLIC_DEMO_PASSWORD;

      const mockPersona: any = {
        id: 'demo-citizen',
        name: 'Demo Citizen',
        email: 'citizen@mahasetu.gov.in',
        role: 'citizen',
      };

      await assert.rejects(
        async () => {
          await authService.switchDemoAccount(mockPersona);
        },
        /Demo password is not configured/
      );
    } finally {
      process.env.EXPO_PUBLIC_DEMO_MODE = originalDemoMode;
      if (originalPassword) process.env.EXPO_PUBLIC_DEMO_PASSWORD = originalPassword;
    }
  });
});
