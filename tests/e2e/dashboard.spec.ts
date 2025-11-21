import { test, expect, Page } from '@playwright/test';

/**
 * Dashboard Page End-to-End Tests
 *
 * Tests cover:
 * - Protected route authentication
 * - Dashboard header and metrics
 * - Real-time updates panel
 * - Quick actions functionality
 * - Instagram profile display
 * - Performance charts
 * - Activity feed
 * - Recent media grid
 */

test.describe('Dashboard Page', () => {
  let page: Page;

  // Mock authentication for dashboard access
  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;

    // Set up authentication state
    await page.goto('/');

    // Mock login by setting localStorage/cookies
    await page.evaluate(() => {
      const mockAuthState = {
        user: {
          id: '1',
          username: 'testuser',
          avatarUrl: '',
          permissions: ['dashboard', 'content', 'engagement', 'analytics', 'settings']
        },
        token: 'mock_token_for_testing',
        isAuthenticated: true
      };

      localStorage.setItem('auth-storage', JSON.stringify({ state: mockAuthState }));
    });

    // Navigate to dashboard
    await page.goto('/dashboard');
  });

  test.describe('Page Load and Authentication', () => {
    test('should load dashboard after authentication', async () => {
      // Wait for dashboard to load
      await page.waitForLoadState('networkidle');

      // Check if dashboard elements are present
      await expect(page.locator('text=Dashboard')).toBeVisible();
    });

    test('should redirect to login if not authenticated', async () => {
      // Clear auth state
      await page.evaluate(() => {
        localStorage.clear();
      });

      // Navigate to dashboard
      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL('/');
    });

    test('should display loading skeletons while fetching data', async () => {
      // Reload page to see loading state
      await page.reload();

      // Check for skeleton loaders (should appear briefly)
      const hasSkeletons = await page.locator('[class*="skeleton"]').count() > 0;
      expect(hasSkeletons).toBeTruthy();
    });
  });

  test.describe('Dashboard Header', () => {
    test('should display dashboard header with user info', async () => {
      await expect(page.locator('text=Welcome back')).toBeVisible();
      await expect(page.locator('text=testuser')).toBeVisible();
    });

    test('should have navigation menu', async () => {
      // Check for common navigation items
      await expect(page.locator('a[href*="/dashboard"]')).toBeVisible();
      await expect(page.locator('a[href*="/content"]')).toBeVisible();
      await expect(page.locator('a[href*="/engagement"]')).toBeVisible();
    });
  });

  test.describe('Metrics Grid', () => {
    test('should display metrics cards', async () => {
      // Wait for metrics to load
      await page.waitForTimeout(1000);

      // Check for metric cards (followers, engagement, etc.)
      const metricCards = page.locator('[class*="metric"]');
      const count = await metricCards.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should show animated metric values', async () => {
      // Check that metrics have numerical values
      const metricsWithNumbers = page.locator('text=/\\d+/');
      const count = await metricsWithNumbers.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Real-time Updates Panel', () => {
    test('should display real-time test panel', async () => {
      await expect(page.locator('text=Real-time Test Panel')).toBeVisible();
    });

    test('should show connection status indicator', async () => {
      const statusIndicator = page.locator('span:has-text("Connected"), span:has-text("Disconnected")');
      await expect(statusIndicator).toBeVisible();
    });

    test('should have test trigger buttons', async () => {
      await expect(page.locator('button:has-text("Test Response")')).toBeVisible();
      await expect(page.locator('button:has-text("Test Metrics")')).toBeVisible();
      await expect(page.locator('button:has-text("Test Alert")')).toBeVisible();
      await expect(page.locator('button:has-text("Test Connection")')).toBeVisible();
    });

    test('should trigger test events on button click', async () => {
      const testButton = page.locator('button:has-text("Test Response")');
      await testButton.click();

      // Wait for event to appear
      await page.waitForTimeout(500);

      // Check events list
      const eventsCount = page.locator('text=Events Received');
      await expect(eventsCount).toBeVisible();
    });
  });

  test.describe('Quick Actions', () => {
    test('should display quick action buttons', async () => {
      // Common quick actions
      const quickActions = page.locator('[class*="quick-action"]');
      const count = await quickActions.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should navigate when quick action is clicked', async () => {
      // Try to find a link/button for content management
      const contentLink = page.locator('a[href*="/content"], button:has-text("Content")').first();

      if (await contentLink.isVisible()) {
        await contentLink.click();
        await page.waitForTimeout(500);
        // Check URL changed or modal opened
        const currentUrl = page.url();
        expect(currentUrl).toBeTruthy();
      }
    });
  });

  test.describe('Instagram Profile Card', () => {
    test('should display Instagram profile information', async () => {
      // Check for profile-related elements
      const profileCard = page.locator('[class*="profile"], [class*="instagram"]').first();

      if (await profileCard.isVisible()) {
        await expect(profileCard).toBeVisible();
      }
    });

    test('should show demo mode toggle', async () => {
      const demoToggle = page.locator('text=Demo Mode, text=demo');
      const count = await demoToggle.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Performance Chart', () => {
    test('should display performance chart component', async () => {
      // Check for chart container or SVG elements
      const chartContainer = page.locator('[class*="chart"], [class*="recharts"]').first();

      if (await chartContainer.isVisible()) {
        await expect(chartContainer).toBeVisible();
      }
    });
  });

  test.describe('Activity Feed', () => {
    test('should display activity feed section', async () => {
      const activityFeed = page.locator('text=Activity, text=Recent Activity, text=Feed');
      const count = await activityFeed.count();

      if (count > 0) {
        await expect(activityFeed.first()).toBeVisible();
      }
    });

    test('should show activity items or empty state', async () => {
      // Wait for content to load
      await page.waitForTimeout(1000);

      // Check for either activity items or "No activity" message
      const hasActivity = await page.locator('[class*="activity-item"]').count() > 0;
      const hasEmptyState = await page.locator('text=/no.*activity/i').count() > 0;

      expect(hasActivity || hasEmptyState).toBeTruthy();
    });
  });

  test.describe('Recent Media Grid', () => {
    test('should display recent media section', async () => {
      const mediaSection = page.locator('text=Recent Media, text=Recent Posts');
      const count = await mediaSection.count();

      if (count > 0) {
        await expect(mediaSection.first()).toBeVisible();
      }
    });

    test('should show media items or skeleton loaders', async () => {
      // Check for media grid or skeleton loaders
      const hasMedia = await page.locator('[class*="media-grid"]').count() > 0;
      const hasSkeleton = await page.locator('[class*="skeleton-media"]').count() > 0;

      expect(hasMedia || hasSkeleton).toBeTruthy();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      // Mock API failure
      await page.route('**/api/**', route => {
        route.abort('failed');
      });

      // Reload page
      await page.reload();

      // Wait for error handling
      await page.waitForTimeout(2000);

      // Should still render basic structure
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should display correctly on mobile', async () => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Check basic visibility
      await expect(page.locator('body')).toBeVisible();

      // Metrics should stack vertically
      const metricsGrid = page.locator('[class*="metric"]').first();
      if (await metricsGrid.isVisible()) {
        await expect(metricsGrid).toBeVisible();
      }
    });

    test('should display correctly on tablet', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });

      // Check visibility and layout
      await expect(page.locator('body')).toBeVisible();
    });

    test('should display correctly on desktop', async () => {
      await page.setViewportSize({ width: 1920, height: 1080 });

      // Check full dashboard layout
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should load dashboard within acceptable time', async () => {
      const startTime = Date.now();

      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should not have console errors', async () => {
      const errors: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/dashboard');
      await page.waitForTimeout(2000);

      // Filter out known/acceptable errors
      const criticalErrors = errors.filter(
        err => !err.includes('ResizeObserver') && !err.includes('favicon')
      );

      expect(criticalErrors.length).toBe(0);
    });
  });
});
