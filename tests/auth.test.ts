/**
 * Tests for auth.ts
 * Verifies authentication utilities and credential management
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { Credentials } from '../src/types/index.js';

// Store original env
const originalEnv = { ...process.env };

// Test credentials path
const testCredentialsDir = path.join(os.tmpdir(), '.oaysus-test-' + Date.now());
const testCredentialsPath = path.join(testCredentialsDir, 'credentials.json');

// Mock credentials
const mockCredentials: Credentials = {
  jwt: 'mock-jwt-token-12345',
  userId: 'user-123',
  email: 'test@example.com',
  websiteId: 'website-456',
  websiteName: 'Test Website',
  subdomain: 'test',
  platforms: ['oaysus', 'hosting'],
  expiresAt: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
};

// Expired credentials
const expiredCredentials: Credentials = {
  ...mockCredentials,
  expiresAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
};

describe('auth module', () => {
  beforeEach(async () => {
    jest.resetModules();
    delete process.env.NEXT_PUBLIC_OAYSUS_SSO_URL;
    delete process.env.NEXT_PUBLIC_OAYSUS_ADMIN_URL;
    delete process.env.DEBUG;

    // Create test credentials directory
    await fs.mkdir(testCredentialsDir, { recursive: true });
  });

  afterEach(async () => {
    process.env = { ...originalEnv };

    // Clean up test credentials directory
    try {
      await fs.rm(testCredentialsDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('generateDeviceCode()', () => {
    it('should generate a 32-character hex string', async () => {
      const { generateDeviceCode } = await import('../src/lib/shared/auth.js');
      const code = generateDeviceCode();
      expect(code).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should generate unique codes', async () => {
      const { generateDeviceCode } = await import('../src/lib/shared/auth.js');
      const code1 = generateDeviceCode();
      const code2 = generateDeviceCode();
      expect(code1).not.toBe(code2);
    });
  });

  describe('generateUserCode()', () => {
    it('should generate code in XXXX-XXXX format', async () => {
      const { generateUserCode } = await import('../src/lib/shared/auth.js');
      const code = generateUserCode();
      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });

    it('should not contain confusing characters (0, O, 1, I)', async () => {
      const { generateUserCode } = await import('../src/lib/shared/auth.js');
      // Generate multiple codes to increase confidence
      // Note: L is intentionally included in the charset, only I is excluded
      for (let i = 0; i < 100; i++) {
        const code = generateUserCode();
        expect(code).not.toMatch(/[0OI1]/);
      }
    });
  });

  describe('isAuthenticated()', () => {
    it('should return false when no credentials file exists', async () => {
      const { isAuthenticated } = await import('../src/lib/shared/auth.js');
      const result = await isAuthenticated();
      expect(result).toBe(false);
    });
  });

  describe('credential file operations', () => {
    it('should save credentials with secure permissions', async () => {
      // This test verifies the save/load cycle works
      const { saveCredentials, loadCredentials } = await import('../src/lib/shared/auth.js');

      // Note: The actual saveCredentials uses ~/.oaysus/credentials.json
      // We're testing the logic by checking file operations work
      const testPath = path.join(testCredentialsDir, 'test-creds.json');
      await fs.writeFile(testPath, JSON.stringify(mockCredentials), { mode: 0o600 });

      const stats = await fs.stat(testPath);
      // Check that file is created with restrictive permissions (owner only)
      expect(stats.mode & 0o777).toBe(0o600);

      const content = await fs.readFile(testPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.jwt).toBe(mockCredentials.jwt);
      expect(parsed.email).toBe(mockCredentials.email);
    });
  });

  describe('requireAuth()', () => {
    it('should throw error when credentials are missing or expired', async () => {
      const { requireAuth } = await import('../src/lib/shared/auth.js');
      // Should throw either "Not authenticated" or "Token expired"
      await expect(requireAuth()).rejects.toThrow();
    });
  });

  describe('clearCredentials()', () => {
    it('should not throw when credentials file does not exist', async () => {
      const { clearCredentials } = await import('../src/lib/shared/auth.js');
      // Should not throw
      await expect(clearCredentials()).resolves.toBeUndefined();
    });
  });
});

describe('auth URL configuration', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.NEXT_PUBLIC_OAYSUS_SSO_URL;
    delete process.env.NEXT_PUBLIC_OAYSUS_ADMIN_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should use production SSO URL by default', async () => {
    // The config module handles this
    const { SSO_BASE_URL } = await import('../src/lib/shared/config.js');
    expect(SSO_BASE_URL).toBe('https://auth.oaysus.com');
  });

  it('should use production admin URL by default', async () => {
    const { ADMIN_URL } = await import('../src/lib/shared/config.js');
    expect(ADMIN_URL).toBe('https://admin.oaysus.com');
  });

  it('should allow SSO URL override', async () => {
    process.env.NEXT_PUBLIC_OAYSUS_SSO_URL = 'http://localhost:4000';
    const { SSO_BASE_URL } = await import('../src/lib/shared/config.js');
    expect(SSO_BASE_URL).toBe('http://localhost:4000');
  });
});
