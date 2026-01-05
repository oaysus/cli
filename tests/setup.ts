/**
 * Jest Test Setup File
 * Runs before each test suite
 */

// Reset environment variables before each test
beforeEach(() => {
  // Clear any environment variable overrides from previous tests
  delete process.env.NEXT_PUBLIC_OAYSUS_SSO_URL;
  delete process.env.NEXT_PUBLIC_OAYSUS_ADMIN_URL;
  delete process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  delete process.env.NEXT_PUBLIC_API_STAGE;
  delete process.env.DEVELOPER;
  delete process.env.DEBUG;
});
