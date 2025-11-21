import { test, expect, Page } from '@playwright/test';

/**
 * Login Page End-to-End Tests
 *
 * Tests cover:
 * - Page load and UI rendering
 * - Consent checkbox functionality
 * - Facebook OAuth flow
 * - Instagram OAuth flow (legacy)
 * - Permission disclosure accordion
 * - Error handling and validation
 */

test.describe('Login Page', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('/');
  });

  test.describe('UI Rendering', () => {
    test('should display the login page with branding', async () => {
      // Check page title
      await expect(page).toHaveTitle(/InstaAutomate/i);

      // Check logo and branding
      await expect(page.locator('text=InstaAutomate')).toBeVisible();
      await expect(page.locator('text=Sign in to your automation dashboard')).toBeVisible();

      // Check Instagram icon
      const instagramIcon = page.locator('svg').first();
      await expect(instagramIcon).toBeVisible();
    });

    test('should display consent checkbox in unchecked state', async () => {
      const consentCheckbox = page.locator('#consent-checkbox');
      await expect(consentCheckbox).toBeVisible();
      await expect(consentCheckbox).not.toBeChecked();
    });

    test('should display privacy policy and terms links', async () => {
      const privacyLink = page.locator('a[href*="privacy-policy"]');
      const termsLink = page.locator('a[href*="terms-of-service"]');

      await expect(privacyLink).toBeVisible();
      await expect(termsLink).toBeVisible();
    });

    test('should display Facebook login button', async () => {
      const facebookButton = page.locator('[data-testid="facebook-login-button"]');
      await expect(facebookButton).toBeVisible();
      await expect(facebookButton).toHaveText(/Continue with Facebook/i);
    });

    test('should display Instagram login button', async () => {
      const instagramButton = page.locator('[data-testid="instagram-login-button"]');
      await expect(instagramButton).toBeVisible();
      await expect(instagramButton).toHaveText(/Continue with Instagram/i);
    });
  });

  test.describe('Consent Management', () => {
    test('should require consent before enabling login buttons', async () => {
      const facebookButton = page.locator('[data-testid="facebook-login-button"]');
      const instagramButton = page.locator('[data-testid="instagram-login-button"]');

      // Buttons should be disabled initially
      await expect(facebookButton).toBeDisabled();
      await expect(instagramButton).toBeDisabled();
    });

    test('should enable login buttons after consent is given', async () => {
      const consentCheckbox = page.locator('#consent-checkbox');
      const facebookButton = page.locator('[data-testid="facebook-login-button"]');
      const instagramButton = page.locator('[data-testid="instagram-login-button"]');

      // Give consent
      await consentCheckbox.check();

      // Wait for Facebook SDK to load
      await page.waitForTimeout(2000);

      // Buttons should be enabled
      await expect(facebookButton).toBeEnabled();
      await expect(instagramButton).toBeEnabled();
    });

    test('should toggle permission disclosure accordion', async () => {
      const accordionButton = page.locator('button:has-text("What we\'ll access")');
      await expect(accordionButton).toBeVisible();

      // Click to expand
      await accordionButton.click();

      // Check if permissions are visible
      await expect(page.locator('text=Basic Profile Information')).toBeVisible();
      await expect(page.locator('text=Comment Management')).toBeVisible();
      await expect(page.locator('text=Analytics & Insights')).toBeVisible();
      await expect(page.locator('text=Direct Message Automation')).toBeVisible();

      // Click to collapse
      await accordionButton.click();

      // Permissions should be hidden
      await expect(page.locator('text=Basic Profile Information')).not.toBeVisible();
    });
  });

  test.describe('Facebook OAuth Flow', () => {
    test('should show error when clicking Facebook login without consent', async () => {
      const facebookButton = page.locator('[data-testid="facebook-login-button"]');

      // Try to click (button is disabled, so we force the click to test validation)
      await facebookButton.click({ force: true });

      // Check for error message
      await expect(page.locator('text=Please accept the Privacy Policy')).toBeVisible();
    });

    test('should initiate Facebook OAuth with consent', async () => {
      const consentCheckbox = page.locator('#consent-checkbox');
      const facebookButton = page.locator('[data-testid="facebook-login-button"]');

      // Give consent
      await consentCheckbox.check();

      // Wait for Facebook SDK
      await page.waitForTimeout(2000);

      // Mock Facebook SDK response (in real tests, you'd use MSW or similar)
      await page.evaluate(() => {
        // @ts-ignore
        window.FB = {
          login: (callback: any, options: any) => {
            callback({
              status: 'connected',
              authResponse: {
                accessToken: 'mock_access_token',
                userID: '123456789',
                expiresIn: 3600
              }
            });
          }
        };
      });

      // Click Facebook login
      await facebookButton.click();

      // Check for loading state
      await expect(page.locator('text=Connecting to Facebook')).toBeVisible();
    });
  });

  test.describe('Instagram OAuth Flow', () => {
    test('should show error when clicking Instagram login without consent', async () => {
      const instagramButton = page.locator('[data-testid="instagram-login-button"]');

      // Try to click (button is disabled, so we force the click to test validation)
      await instagramButton.click({ force: true });

      // Check for error message
      await expect(page.locator('text=Please accept the Privacy Policy')).toBeVisible();
    });

    test('should show Instagram integration status in development', async () => {
      const infoBox = page.locator('text=Instagram Integration Status');
      await expect(infoBox).toBeVisible();
      await expect(page.locator('text=awaiting Meta API approval')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async () => {
      const facebookButton = page.locator('[data-testid="facebook-login-button"]');
      const consentCheckbox = page.locator('#consent-checkbox');

      await expect(facebookButton).toHaveAttribute('aria-label', /Facebook/);
      await expect(consentCheckbox).toHaveAttribute('aria-describedby', 'consent-description');
    });

    test('should be keyboard navigable', async () => {
      const consentCheckbox = page.locator('#consent-checkbox');

      // Tab to consent checkbox
      await page.keyboard.press('Tab');
      await expect(consentCheckbox).toBeFocused();

      // Check with Space key
      await page.keyboard.press('Space');
      await expect(consentCheckbox).toBeChecked();
    });
  });

  test.describe('Responsive Design', () => {
    test('should display correctly on mobile', async () => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Check if elements are visible
      await expect(page.locator('text=InstaAutomate')).toBeVisible();
      await expect(page.locator('[data-testid="facebook-login-button"]')).toBeVisible();

      // Check if buttons stack vertically on mobile
      const container = page.locator('.grid');
      const classes = await container.getAttribute('class');
      expect(classes).toContain('grid-cols-1');
    });

    test('should display correctly on tablet', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await expect(page.locator('text=InstaAutomate')).toBeVisible();
      await expect(page.locator('[data-testid="facebook-login-button"]')).toBeVisible();
    });
  });

  test.describe('Admin Portal Access', () => {
    test('should have hidden admin link', async () => {
      const adminLink = page.locator('a[href="/admin/login"]').first();
      await expect(adminLink).toBeVisible();
    });

    test('should navigate to admin portal when clicked', async () => {
      const adminLink = page.locator('a[href="/admin/login"]').first();
      await adminLink.click();

      // Should navigate to admin login
      await expect(page).toHaveURL(/\/admin\/login/);
    });
  });
});
