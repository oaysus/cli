import { jest } from '@jest/globals';
/**
 * Tests for auth.ts
 * Verifies authentication utilities and credential management
 */

// Jest globals are auto-imported
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import axios from 'axios';

// Import auth module functions
import {
  generateDeviceCode,
  generateUserCode,
  saveCredentials,
  loadCredentials,
  clearCredentials,
  isAuthenticated,
  requireAuth,
  pollForAuth,
  initializeDevice,
  selectWebsite,
  requestMagicLink,
  getMyWebsites,
  updateCredentialsWebsite,
} from '../src/lib/shared/auth.js';

import {
  SSO_BASE_URL,
  ADMIN_URL,
  CREDENTIALS_PATH,
} from '../src/lib/shared/config.js';

import type { Credentials, DeviceStatusResponse } from '../src/types/index.js';

// Helper to create valid credentials
function createValidCredentials(overrides: Partial<Credentials> = {}): Credentials {
  return {
    jwt: 'test-jwt-token',
    userId: 'user-123',
    email: 'test@example.com',
    websiteId: 'website-123',
    websiteName: 'Test Website',
    subdomain: 'test',
    customDomain: 'test.com',
    platforms: ['oaysus', 'hosting'],
    expiresAt: new Date(Date.now() + 86400000).toISOString(), // 24 hours from now
    ...overrides,
  };
}

// Helper to create expired credentials
function createExpiredCredentials(overrides: Partial<Credentials> = {}): Credentials {
  return createValidCredentials({
    expiresAt: new Date(Date.now() - 86400000).toISOString(), // 24 hours ago
    ...overrides,
  });
}

describe('auth module', () => {
  describe('generateDeviceCode()', () => {
    it('should generate a 32-character hex string', () => {
      const code = generateDeviceCode();
      expect(code).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should generate unique codes', () => {
      const code1 = generateDeviceCode();
      const code2 = generateDeviceCode();
      expect(code1).not.toBe(code2);
    });

    it('should generate codes of consistent length', () => {
      for (let i = 0; i < 10; i++) {
        const code = generateDeviceCode();
        expect(code.length).toBe(32);
      }
    });
  });

  describe('generateUserCode()', () => {
    it('should generate code in XXXX-XXXX format', () => {
      const code = generateUserCode();
      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });

    it('should not contain confusing characters (0, O, 1, I)', () => {
      // Generate multiple codes to increase confidence
      for (let i = 0; i < 100; i++) {
        const code = generateUserCode();
        expect(code).not.toMatch(/[0O1I]/);
      }
    });

    it('should generate unique codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 50; i++) {
        codes.add(generateUserCode());
      }
      // With random generation, we expect most codes to be unique
      expect(codes.size).toBeGreaterThan(40);
    });
  });

  describe('saveCredentials()', () => {
    let testCredentialsPath: string;
    let originalReadFile: typeof fs.readFile;
    let originalWriteFile: typeof fs.writeFile;
    let originalMkdir: typeof fs.mkdir;

    beforeEach(() => {
      testCredentialsPath = path.join(os.tmpdir(), `test-oaysus-${Date.now()}`, 'credentials.json');
    });

    afterEach(async () => {
      // Clean up test directory
      try {
        await fs.rm(path.dirname(testCredentialsPath), { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should save credentials to the credentials path', async () => {
      const credentials = createValidCredentials();

      // This saves to the actual CREDENTIALS_PATH, so we just verify it doesn't throw
      await saveCredentials(credentials);

      // Verify by loading
      const loaded = await loadCredentials();
      expect(loaded).not.toBeNull();
      expect(loaded?.jwt).toBe(credentials.jwt);
    });

    it('should create directory if it does not exist', async () => {
      const credentials = createValidCredentials();
      await saveCredentials(credentials);

      // The directory should exist now
      const dirPath = path.dirname(CREDENTIALS_PATH);
      const stat = await fs.stat(dirPath);
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe('loadCredentials()', () => {
    it('should return null if credentials file does not exist', async () => {
      // Clear credentials first
      await clearCredentials();
      const credentials = await loadCredentials();
      expect(credentials).toBeNull();
    });

    it('should load saved credentials', async () => {
      const testCreds = createValidCredentials();
      await saveCredentials(testCreds);

      const loaded = await loadCredentials();
      expect(loaded).not.toBeNull();
      expect(loaded?.jwt).toBe(testCreds.jwt);
      expect(loaded?.userId).toBe(testCreds.userId);
      expect(loaded?.email).toBe(testCreds.email);
    });

    it('should return null on parse errors', async () => {
      // Write invalid JSON
      const credentialsDir = path.dirname(CREDENTIALS_PATH);
      await fs.mkdir(credentialsDir, { recursive: true });
      await fs.writeFile(CREDENTIALS_PATH, 'invalid json {{{');

      const loaded = await loadCredentials();
      // The function returns null on any error, including parse errors
      expect(loaded).toBeNull();
    });
  });

  describe('clearCredentials()', () => {
    it('should not throw when credentials file does not exist', async () => {
      // First clear to ensure no file
      await clearCredentials();
      // Then clear again - should not throw
      await clearCredentials();
    });

    it('should remove existing credentials file', async () => {
      // Clear first to avoid race conditions
      await clearCredentials();

      // Save credentials
      await saveCredentials(createValidCredentials());

      // Load and verify credentials exist (more reliable than stat)
      const loaded = await loadCredentials();
      expect(loaded).not.toBeNull();

      // Clear credentials
      await clearCredentials();

      // Verify credentials are now gone
      const afterClear = await loadCredentials();
      expect(afterClear).toBeNull();
    });
  });

  describe('isAuthenticated()', () => {
    afterEach(async () => {
      await clearCredentials();
    });

    it('should return false when no credentials exist', async () => {
      await clearCredentials();
      const result = await isAuthenticated();
      expect(result).toBe(false);
    });

    it('should return true when valid credentials exist', async () => {
      // Clear and save fresh credentials to avoid race conditions
      await clearCredentials();
      await saveCredentials(createValidCredentials());
      const result = await isAuthenticated();
      expect(result).toBe(true);
    });

    it('should return false when credentials are expired', async () => {
      // Clear and save expired credentials
      await clearCredentials();
      await saveCredentials(createExpiredCredentials());
      const result = await isAuthenticated();
      expect(result).toBe(false);
    });
  });

  describe('requireAuth()', () => {
    afterEach(async () => {
      await clearCredentials();
    });

    it('should throw error when no credentials exist', async () => {
      await clearCredentials();
      await expect(requireAuth()).rejects.toThrow('Not authenticated. Run: oaysus login');
    });

    it('should throw error when credentials are expired', async () => {
      // Clear and save expired credentials to avoid race conditions
      await clearCredentials();
      await saveCredentials(createExpiredCredentials());
      await expect(requireAuth()).rejects.toThrow('Token expired. Run: oaysus login');
    });

    it('should return credentials when valid', async () => {
      // Clear and save fresh credentials
      await clearCredentials();
      const testCreds = createValidCredentials();
      await saveCredentials(testCreds);

      const result = await requireAuth();
      expect(result.jwt).toBe(testCreds.jwt);
      expect(result.userId).toBe(testCreds.userId);
    });
  });

  describe('requestMagicLink()', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should request magic link successfully', async () => {
      const axiosPostSpy = jest.spyOn(axios, 'post').mockResolvedValue({
        data: { success: true },
      });

      await requestMagicLink('test@example.com', 'test-device-code');

      expect(axiosPostSpy).toHaveBeenCalledWith(
        `${SSO_BASE_URL}/sso/customer/auth/magic-link`,
        {
          email: 'test@example.com',
          redirectUrl: `${ADMIN_URL}/device?code=test-device-code`,
        }
      );
    });

    it('should throw error when success is false', async () => {
      jest.spyOn(axios, 'post').mockResolvedValue({
        data: { success: false, message: 'Email not found' },
      });

      await expect(requestMagicLink('test@example.com', 'test-code'))
        .rejects.toThrow('Email not found');
    });

    it('should throw error when success is false without message', async () => {
      jest.spyOn(axios, 'post').mockResolvedValue({
        data: { success: false },
      });

      await expect(requestMagicLink('test@example.com', 'test-code'))
        .rejects.toThrow('Failed to send magic link');
    });

    it('should handle ECONNREFUSED error in local dev', async () => {
      const axiosError = new Error('Connection refused') as any;
      axiosError.code = 'ECONNREFUSED';
      axiosError.isAxiosError = true;

      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      jest.spyOn(axios, 'post').mockRejectedValue(axiosError);

      await expect(requestMagicLink('test@example.com', 'test-code'))
        .rejects.toThrow(/Cannot connect to/);
    });

    it('should handle 500 server errors', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 500,
          data: { detail: { error: 'Database connection failed' } },
        },
      };

      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      jest.spyOn(axios, 'post').mockRejectedValue(axiosError);

      await expect(requestMagicLink('test@example.com', 'test-code'))
        .rejects.toThrow(/Server error.*Database connection failed/);
    });

    it('should handle 401 auth errors', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 401,
          data: { message: 'Invalid credentials' },
        },
      };

      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      jest.spyOn(axios, 'post').mockRejectedValue(axiosError);

      await expect(requestMagicLink('test@example.com', 'test-code'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should handle 403 auth errors', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 403,
          data: { error: 'Access denied' },
        },
      };

      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      jest.spyOn(axios, 'post').mockRejectedValue(axiosError);

      await expect(requestMagicLink('test@example.com', 'test-code'))
        .rejects.toThrow('Access denied');
    });

    it('should handle 404 not found errors in local dev', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 404,
          data: {},
        },
      };

      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      jest.spyOn(axios, 'post').mockRejectedValue(axiosError);

      await expect(requestMagicLink('test@example.com', 'test-code'))
        .rejects.toThrow(/endpoint not found|temporarily unavailable/);
    });

    it('should handle errors with message in data', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 422,
          data: { message: 'Validation failed' },
        },
      };

      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      jest.spyOn(axios, 'post').mockRejectedValue(axiosError);

      await expect(requestMagicLink('test@example.com', 'test-code'))
        .rejects.toThrow('Validation failed');
    });

    it('should handle errors with error in data', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 422,
          data: { error: 'Invalid email format' },
        },
      };

      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      jest.spyOn(axios, 'post').mockRejectedValue(axiosError);

      await expect(requestMagicLink('test@example.com', 'test-code'))
        .rejects.toThrow('Invalid email format');
    });

    it('should handle errors with detail.error in data', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 422,
          data: { detail: { error: 'Nested error message' } },
        },
      };

      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      jest.spyOn(axios, 'post').mockRejectedValue(axiosError);

      await expect(requestMagicLink('test@example.com', 'test-code'))
        .rejects.toThrow('Nested error message');
    });

    it('should handle axios errors without message', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 418,
          data: {},
        },
      };

      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      jest.spyOn(axios, 'post').mockRejectedValue(axiosError);

      await expect(requestMagicLink('test@example.com', 'test-code'))
        .rejects.toThrow('Request failed with status 418');
    });

    it('should handle axios errors without status', async () => {
      const axiosError = {
        isAxiosError: true,
        response: undefined,
      };

      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      jest.spyOn(axios, 'post').mockRejectedValue(axiosError);

      await expect(requestMagicLink('test@example.com', 'test-code'))
        .rejects.toThrow('Request failed with status unknown');
    });

    it('should pass through non-axios errors', async () => {
      const error = new Error('Network timeout');
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(false);
      jest.spyOn(axios, 'post').mockRejectedValue(error);

      await expect(requestMagicLink('test@example.com', 'test-code'))
        .rejects.toThrow('Network timeout');
    });

    it('should handle unknown error types', async () => {
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(false);
      jest.spyOn(axios, 'post').mockRejectedValue('string error');

      await expect(requestMagicLink('test@example.com', 'test-code'))
        .rejects.toThrow('An unexpected error occurred');
    });
  });

  describe('initializeDevice()', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should initialize device successfully', async () => {
      const mockResponse = {
        deviceCode: 'test-device-code',
        userCode: 'ABCD-1234',
        verificationUrl: 'https://admin.oaysus.com/device',
        expiresIn: 900,
      };

      jest.spyOn(axios, 'post').mockResolvedValue({
        status: 200,
        data: mockResponse,
      });

      const result = await initializeDevice();

      expect(result).toEqual(mockResponse);
    });

    it('should handle initialization errors', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 500,
          data: { error: 'Server error' },
        },
      };

      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      jest.spyOn(axios, 'post').mockRejectedValue(axiosError);

      await expect(initializeDevice())
        .rejects.toThrow(/Server error/);
    });
  });

  describe('selectWebsite()', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should select website successfully', async () => {
      jest.spyOn(axios, 'post').mockResolvedValue({
        data: { success: true },
      });

      await selectWebsite('test-device-code', 'website-123');

      expect(axios.post).toHaveBeenCalledWith(
        `${SSO_BASE_URL}/sso/cli/device/select-website`,
        {
          deviceCode: 'test-device-code',
          websiteId: 'website-123',
        }
      );
    });

    it('should throw error when success is false', async () => {
      jest.spyOn(axios, 'post').mockResolvedValue({
        data: { success: false, message: 'Website not found' },
      });

      await expect(selectWebsite('test-device-code', 'invalid-id'))
        .rejects.toThrow('Website not found');
    });

    it('should throw error when success is false without message', async () => {
      jest.spyOn(axios, 'post').mockResolvedValue({
        data: { success: false },
      });

      await expect(selectWebsite('test-device-code', 'invalid-id'))
        .rejects.toThrow('Failed to select website');
    });

    it('should handle axios errors with error field', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 400,
          data: { error: 'Invalid website ID' },
        },
      };

      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      jest.spyOn(axios, 'post').mockRejectedValue(axiosError);

      await expect(selectWebsite('test-device-code', 'invalid-id'))
        .rejects.toThrow('Invalid website ID');
    });

    it('should handle axios errors without error field', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 400,
          data: {},
        },
      };

      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      jest.spyOn(axios, 'post').mockRejectedValue(axiosError);

      await expect(selectWebsite('test-device-code', 'invalid-id'))
        .rejects.toThrow('Failed to select website');
    });

    it('should re-throw non-axios errors', async () => {
      const error = new Error('Network error');
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(false);
      jest.spyOn(axios, 'post').mockRejectedValue(error);

      await expect(selectWebsite('test-device-code', 'website-id'))
        .rejects.toThrow('Network error');
    });
  });

  describe('pollForAuth()', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return credentials when approved with JWT', async () => {
      const mockResponse: DeviceStatusResponse = {
        status: 'approved',
        jwt: 'test-jwt',
        userId: 'user-123',
        email: 'test@example.com',
        websiteId: 'website-123',
        websiteName: 'Test Site',
        subdomain: 'test',
        customDomain: 'test.com',
        platforms: ['oaysus'],
        expiresIn: 604800,
      };

      jest.spyOn(axios, 'get').mockResolvedValue({
        data: mockResponse,
      });

      const result = await pollForAuth('test-device-code', {
        interval: 100,
        timeout: 5000,
      });

      expect(result).toHaveProperty('jwt', 'test-jwt');
      expect(result).toHaveProperty('userId', 'user-123');
      expect(result).toHaveProperty('expiresAt');
    });

    it('should return device status when needs website selection', async () => {
      const mockResponse: DeviceStatusResponse = {
        status: 'approved',
        needsWebsiteSelection: true,
        websites: [
          { id: 'web-1', name: 'Website 1', subdomain: 'web1' },
          { id: 'web-2', name: 'Website 2', subdomain: 'web2' },
        ],
      };

      jest.spyOn(axios, 'get').mockResolvedValue({
        data: mockResponse,
      });

      const result = await pollForAuth('test-device-code', {
        interval: 100,
        timeout: 5000,
      });

      expect(result).toHaveProperty('needsWebsiteSelection', true);
      expect(result).toHaveProperty('websites');
      expect((result as DeviceStatusResponse).websites).toHaveLength(2);
    });

    it('should throw error when authorization is denied', async () => {
      jest.spyOn(axios, 'get').mockResolvedValue({
        data: { status: 'denied' },
      });

      await expect(pollForAuth('test-device-code', {
        interval: 100,
        timeout: 5000,
      })).rejects.toThrow('Authorization denied by user');
    });

    it('should throw error when authorization expires', async () => {
      jest.spyOn(axios, 'get').mockResolvedValue({
        data: { status: 'expired' },
      });

      await expect(pollForAuth('test-device-code', {
        interval: 100,
        timeout: 5000,
      })).rejects.toThrow('Authorization code expired');
    });

    it('should timeout after specified duration', async () => {
      jest.spyOn(axios, 'get').mockResolvedValue({
        data: { status: 'pending' },
      });

      await expect(pollForAuth('test-device-code', {
        interval: 50,
        timeout: 100, // Very short timeout
      })).rejects.toThrow('Authentication timeout');
    });

    it('should continue polling on pending status', async () => {
      let callCount = 0;
      jest.spyOn(axios, 'get').mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          return { data: { status: 'pending' } };
        }
        return {
          data: {
            status: 'approved',
            jwt: 'test-jwt',
            userId: 'user-123',
            email: 'test@example.com',
            websiteId: 'website-123',
            expiresIn: 604800,
          },
        };
      });

      const result = await pollForAuth('test-device-code', {
        interval: 50,
        timeout: 5000,
      });

      expect(callCount).toBe(3);
      expect(result).toHaveProperty('jwt', 'test-jwt');
    });

    it('should handle 404 errors as authorization not found', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 404,
          data: {},
        },
      };

      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      jest.spyOn(axios, 'get').mockRejectedValue(axiosError);

      await expect(pollForAuth('test-device-code', {
        interval: 100,
        timeout: 5000,
      })).rejects.toThrow('Authorization request not found or expired');
    });

    it('should continue polling on 500 errors', async () => {
      let callCount = 0;

      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      jest.spyOn(axios, 'get').mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          const error = {
            isAxiosError: true,
            response: { status: 500, data: {} },
          };
          throw error;
        }
        return {
          data: {
            status: 'approved',
            jwt: 'test-jwt',
            userId: 'user-123',
            email: 'test@example.com',
            websiteId: 'website-123',
            expiresIn: 604800,
          },
        };
      });

      const result = await pollForAuth('test-device-code', {
        interval: 50,
        timeout: 5000,
      });

      expect(callCount).toBe(3);
      expect(result).toHaveProperty('jwt', 'test-jwt');
    });

    it('should re-throw denied errors during polling', async () => {
      let callCount = 0;

      jest.spyOn(axios, 'get').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { data: { status: 'pending' } };
        }
        return { data: { status: 'denied' } };
      });

      await expect(pollForAuth('test-device-code', {
        interval: 50,
        timeout: 5000,
      })).rejects.toThrow('Authorization denied by user');
    });

    it('should re-throw expired errors during polling', async () => {
      let callCount = 0;

      jest.spyOn(axios, 'get').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { data: { status: 'pending' } };
        }
        return { data: { status: 'expired' } };
      });

      await expect(pollForAuth('test-device-code', {
        interval: 50,
        timeout: 5000,
      })).rejects.toThrow('Authorization code expired');
    });

    it('should use default expiresIn if not provided', async () => {
      const mockResponse: DeviceStatusResponse = {
        status: 'approved',
        jwt: 'test-jwt',
        userId: 'user-123',
        email: 'test@example.com',
        websiteId: 'website-123',
        // No expiresIn provided
      };

      jest.spyOn(axios, 'get').mockResolvedValue({
        data: mockResponse,
      });

      const result = await pollForAuth('test-device-code', {
        interval: 100,
        timeout: 5000,
      });

      // Should use default 604800 seconds (7 days)
      expect(result).toHaveProperty('expiresAt');
      const credentials = result as Credentials;
      const expiresAt = new Date(credentials.expiresAt);
      const expectedExpiry = new Date(Date.now() + 604800 * 1000);
      // Allow 5 second tolerance
      expect(Math.abs(expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(5000);
    });

    it('should use default platforms if not provided', async () => {
      const mockResponse: DeviceStatusResponse = {
        status: 'approved',
        jwt: 'test-jwt',
        userId: 'user-123',
        email: 'test@example.com',
        websiteId: 'website-123',
        expiresIn: 604800,
        // No platforms provided
      };

      jest.spyOn(axios, 'get').mockResolvedValue({
        data: mockResponse,
      });

      const result = await pollForAuth('test-device-code', {
        interval: 100,
        timeout: 5000,
      });

      const credentials = result as Credentials;
      expect(credentials.platforms).toEqual(['oaysus', 'hosting']);
    });
  });

  describe('getMyWebsites()', () => {
    afterEach(async () => {
      jest.restoreAllMocks();
      await clearCredentials();
    });

    it('should fetch websites when authenticated', async () => {
      await saveCredentials(createValidCredentials());

      const mockWebsites = [
        { id: 'web-1', name: 'Website 1', subdomain: 'web1' },
        { id: 'web-2', name: 'Website 2', subdomain: 'web2' },
      ];

      jest.spyOn(axios, 'get').mockResolvedValue({
        data: { success: true, websites: mockWebsites },
      });

      const result = await getMyWebsites();

      expect(result).toEqual(mockWebsites);
      expect(axios.get).toHaveBeenCalledWith(
        `${SSO_BASE_URL}/sso/cli/device/websites`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Bearer /),
          }),
        })
      );
    });

    it('should throw error when not authenticated', async () => {
      await clearCredentials();

      await expect(getMyWebsites())
        .rejects.toThrow('Not authenticated. Run: oaysus login');
    });

    it('should throw error when API returns failure', async () => {
      await saveCredentials(createValidCredentials());

      jest.spyOn(axios, 'get').mockResolvedValue({
        data: { success: false },
      });

      await expect(getMyWebsites())
        .rejects.toThrow('Failed to fetch websites');
    });

    it('should handle API errors', async () => {
      await saveCredentials(createValidCredentials());

      const axiosError = {
        isAxiosError: true,
        response: {
          status: 500,
          data: { error: 'Internal server error' },
        },
      };

      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      jest.spyOn(axios, 'get').mockRejectedValue(axiosError);

      await expect(getMyWebsites())
        .rejects.toThrow(/Internal server error|Server error/);
    });
  });

  describe('updateCredentialsWebsite()', () => {
    afterEach(async () => {
      await clearCredentials();
    });

    it('should update website in credentials', async () => {
      await saveCredentials(createValidCredentials());

      await updateCredentialsWebsite(
        'new-website-123',
        'New Website',
        'newsite',
        'newsite.com'
      );

      const loaded = await loadCredentials();
      expect(loaded?.websiteId).toBe('new-website-123');
      expect(loaded?.websiteName).toBe('New Website');
      expect(loaded?.subdomain).toBe('newsite');
      expect(loaded?.customDomain).toBe('newsite.com');
    });

    it('should update website without custom domain', async () => {
      await saveCredentials(createValidCredentials());

      await updateCredentialsWebsite(
        'new-website-123',
        'New Website',
        'newsite'
      );

      const loaded = await loadCredentials();
      expect(loaded?.websiteId).toBe('new-website-123');
      expect(loaded?.customDomain).toBeUndefined();
    });

    it('should throw error when not authenticated', async () => {
      await clearCredentials();

      await expect(updateCredentialsWebsite(
        'new-website-123',
        'New Website',
        'newsite'
      )).rejects.toThrow('Not authenticated. Run: oaysus login');
    });
  });
});

describe('auth URL configuration', () => {
  it('should have valid SSO URL', () => {
    expect(SSO_BASE_URL).toBeDefined();
    expect(typeof SSO_BASE_URL).toBe('string');
    // Should be either local or production URL
    expect(
      SSO_BASE_URL.includes('auth.oaysus.com') ||
      SSO_BASE_URL.includes('localhost')
    ).toBe(true);
  });

  it('should have valid admin URL', () => {
    expect(ADMIN_URL).toBeDefined();
    expect(typeof ADMIN_URL).toBe('string');
    // Should be either local or production URL
    expect(
      ADMIN_URL.includes('admin.oaysus.com') ||
      ADMIN_URL.includes('localhost')
    ).toBe(true);
  });

  it('should have valid credentials path', () => {
    expect(CREDENTIALS_PATH).toBeDefined();
    expect(typeof CREDENTIALS_PATH).toBe('string');
    expect(CREDENTIALS_PATH.includes('.oaysus')).toBe(true);
    expect(CREDENTIALS_PATH.endsWith('credentials.json')).toBe(true);
  });
});
