import { Page } from '@playwright/test';

/**
 * Authentication Helper Utilities for Playwright Tests
 *
 * Provides reusable functions for authentication flows in tests
 */

export interface MockUser {
  id: string;
  username: string;
  avatarUrl: string;
  permissions: string[];
}

export const DEFAULT_MOCK_USER: MockUser = {
  id: '1',
  username: 'testuser',
  avatarUrl: '',
  permissions: ['dashboard', 'content', 'engagement', 'analytics', 'settings']
};

/**
 * Set up authenticated state in the browser
 */
export async function setupAuthState(page: Page, user: MockUser = DEFAULT_MOCK_USER, token: string = 'mock_token') {
  await page.evaluate(({ user, token }) => {
    const authState = {
      user,
      token,
      isAuthenticated: true
    };

    localStorage.setItem('auth-storage', JSON.stringify({ state: authState }));
  }, { user, token });
}

/**
 * Clear authentication state
 */
export async function clearAuthState(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Perform login via UI
 */
export async function loginViaUI(page: Page, giveConsent: boolean = true) {
  await page.goto('/');

  if (giveConsent) {
    // Give consent
    const consentCheckbox = page.locator('#consent-checkbox');
    await consentCheckbox.check();

    // Wait for buttons to enable
    await page.waitForTimeout(1000);
  }
}

/**
 * Mock Facebook SDK for testing
 */
export async function mockFacebookSDK(page: Page) {
  await page.evaluate(() => {
    // @ts-ignore
    window.FB = {
      init: () => {},
      login: (callback: any, options: any) => {
        callback({
          status: 'connected',
          authResponse: {
            accessToken: 'mock_facebook_access_token',
            userID: '123456789',
            expiresIn: 3600
          }
        });
      },
      getLoginStatus: (callback: any) => {
        callback({
          status: 'unknown',
          authResponse: null
        });
      }
    };

    // Dispatch fbAsyncInit event
    if (window.fbAsyncInit) {
      window.fbAsyncInit();
    }
  });
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const authStorage = localStorage.getItem('auth-storage');
    if (!authStorage) return false;

    try {
      const parsed = JSON.parse(authStorage);
      return parsed?.state?.isAuthenticated === true;
    } catch {
      return false;
    }
  });
}

/**
 * Get current user from storage
 */
export async function getCurrentUser(page: Page): Promise<MockUser | null> {
  return await page.evaluate(() => {
    const authStorage = localStorage.getItem('auth-storage');
    if (!authStorage) return null;

    try {
      const parsed = JSON.parse(authStorage);
      return parsed?.state?.user || null;
    } catch {
      return null;
    }
  });
}
