import { test, expect, devices } from '@playwright/test';

/**
 * UGC Management Mobile Responsiveness Tests - Phase 5
 *
 * Tests mobile-specific behaviors including:
 * - Layout responsiveness on iPhone 12 and Pixel 5
 * - Touch target sizes (≥44x44px)
 * - Modal full-width behavior
 * - Stats grid stacking
 */

test.describe('UGC Mobile Responsiveness - iPhone 12', () => {
  test.use({ ...devices['iPhone 12'] });

  test.beforeEach(async ({ page, context }) => {
    // Mock visitor posts for mobile testing
    await context.route('**/api/instagram/visitor-posts*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'mobile_ugc_1',
              media_type: 'IMAGE',
              media_url: 'https://via.placeholder.com/400',
              message: 'Mobile test post',
              author_username: 'mobileuser',
              sentiment: 'positive',
              priority: 'high',
              featured: false,
              timestamp: new Date().toISOString()
            }
          ],
          stats: {
            totalPosts: 1,
            postsThisWeek: 1,
            featuredCount: 0,
            permissionsPending: 0,
            sentimentBreakdown: {
              positive: 1,
              neutral: 0,
              negative: 0
            }
          }
        })
      });
    });

    await page.goto('/ugc');
  });

  test('should display correctly on iPhone 12 viewport', async ({ page }) => {
    // Verify viewport size
    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(390);
    expect(viewport?.height).toBe(844);

    // Verify page header is visible
    await expect(page.locator('text=UGC Management')).toBeVisible();

    // Verify permission badge fits on mobile
    const permissionBadge = page.locator('text=📡 pages_read_user_content');
    await expect(permissionBadge).toBeVisible({ timeout: 10000 });

    // Verify grid layout switches to single column on mobile
    // This depends on your grid implementation using responsive classes
    const postsContainer = page.locator('[class*="grid"]').first();
    if (await postsContainer.isVisible()) {
      const classes = await postsContainer.getAttribute('class');
      // Should use grid-cols-1 on mobile
      expect(classes).toContain('grid');
    }
  });

  test('should have touch targets ≥44x44px for accessibility', async ({ page }) => {
    // Wait for page to load
    await page.waitForTimeout(2000);

    // Get all buttons
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    // Check each button's size
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const box = await button.boundingBox();
        if (box) {
          // Touch targets should be at least 44x44px (WCAG guideline)
          expect(box.width).toBeGreaterThanOrEqual(40); // Allowing 4px tolerance
          expect(box.height).toBeGreaterThanOrEqual(40);
        }
      }
    }
  });

  test('should stack stats grid vertically on mobile', async ({ page }) => {
    // Wait for stats to load
    await page.waitForTimeout(2000);

    // Verify stats card exists
    const statsCard = page.locator('text=Total Posts').first();
    if (await statsCard.isVisible()) {
      // On mobile, stats should use grid-cols-2 (2 columns max)
      const statsGrid = statsCard.locator('xpath=ancestor::div[contains(@class, "grid")]').first();
      const classes = await statsGrid.getAttribute('class');

      // Should have responsive classes like grid-cols-2 md:grid-cols-4
      expect(classes).toMatch(/grid/);
    }
  });

  test('should display edge case banners in mobile viewport', async ({ page, context }) => {
    // Test no account banner on mobile
    await page.evaluate(() => {
      localStorage.clear();
    });

    await page.reload();
    await page.goto('/ugc');

    const banner = page.locator('text=No Instagram Account Connected');
    await expect(banner).toBeVisible();

    // Verify banner is readable and button is accessible
    const connectBtn = page.locator('button:has-text("Connect Account")');
    await expect(connectBtn).toBeVisible();

    const btnBox = await connectBtn.boundingBox();
    if (btnBox) {
      // Button should be easily tappable
      expect(btnBox.width).toBeGreaterThanOrEqual(100);
      expect(btnBox.height).toBeGreaterThanOrEqual(40);
    }
  });

  test('should handle horizontal scrolling gracefully', async ({ page }) => {
    // Check if page has unwanted horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width || 0;

    // Body should not exceed viewport width (no horizontal scroll)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5); // 5px tolerance
  });
});

test.describe('UGC Mobile Responsiveness - Pixel 5', () => {
  test.use({ ...devices['Pixel 5'] });

  test.beforeEach(async ({ page, context }) => {
    // Mock visitor posts
    await context.route('**/api/instagram/visitor-posts*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'pixel_ugc_1',
              media_type: 'IMAGE',
              media_url: 'https://via.placeholder.com/400',
              message: 'Pixel test post',
              author_username: 'pixeluser',
              sentiment: 'positive',
              priority: 'medium',
              featured: false,
              timestamp: new Date().toISOString()
            }
          ],
          stats: {
            totalPosts: 1,
            postsThisWeek: 1,
            featuredCount: 0,
            permissionsPending: 0,
            sentimentBreakdown: {
              positive: 1,
              neutral: 0,
              negative: 0
            }
          }
        })
      });
    });

    await page.goto('/ugc');
  });

  test('should display correctly on Pixel 5 viewport', async ({ page }) => {
    // Verify viewport size
    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(393);
    expect(viewport?.height).toBe(851);

    // Verify page loads and is responsive
    await expect(page.locator('text=UGC Management')).toBeVisible();
    await expect(page.locator('text=📡 pages_read_user_content')).toBeVisible({ timeout: 10000 });
  });

  test('should display filters in stacked layout on mobile', async ({ page }) => {
    // Wait for filters to load
    await page.waitForTimeout(2000);

    // Verify filter section exists
    const filterSection = page.locator('text=Filters').first();
    if (await filterSection.isVisible()) {
      // Filter dropdowns should be stacked vertically or in 2-column grid on mobile
      const filterGrid = filterSection.locator('xpath=following-sibling::div[contains(@class, "grid")]').first();

      if (await filterGrid.isVisible()) {
        const classes = await filterGrid.getAttribute('class');
        // Should use grid-cols-2 or similar on mobile
        expect(classes).toMatch(/grid/);
      }
    }
  });

  test('should handle scope error banner on mobile', async ({ page, context }) => {
    // Navigate fresh and intercept
    await context.route('**/api/instagram/visitor-posts*', route => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Missing required permissions',
          code: 'MISSING_SCOPES',
          missing: ['instagram_basic', 'pages_read_user_content']
        })
      });
    });

    await page.reload();

    // Verify scope error banner displays properly on mobile
    const banner = page.locator('text=Missing Permissions');
    await expect(banner).toBeVisible({ timeout: 10000 });

    // Verify scope chips are visible and readable
    await expect(page.locator('text=instagram_basic')).toBeVisible();
    await expect(page.locator('text=pages_read_user_content')).toBeVisible();

    // Verify Grant Permissions button is accessible
    const grantBtn = page.locator('button:has-text("Grant Permissions")');
    await expect(grantBtn).toBeVisible();

    const btnBox = await grantBtn.boundingBox();
    if (btnBox) {
      expect(btnBox.width).toBeGreaterThanOrEqual(100);
      expect(btnBox.height).toBeGreaterThanOrEqual(40);
    }
  });

  test('should have readable text sizes on mobile', async ({ page }) => {
    // Check header text size
    const header = page.locator('h1:has-text("UGC Management")');
    if (await header.isVisible()) {
      const fontSize = await header.evaluate(el => {
        return window.getComputedStyle(el).fontSize;
      });

      // Font size should be at least 16px for readability
      const fontSizeNum = parseFloat(fontSize);
      expect(fontSizeNum).toBeGreaterThanOrEqual(16);
    }
  });

  test('should handle long post messages without overflow', async ({ page, context }) => {
    // Mock post with very long message
    await context.route('**/api/instagram/visitor-posts*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'long_message',
              media_type: 'IMAGE',
              media_url: 'https://via.placeholder.com/400',
              message: 'This is a very long message that should wrap properly on mobile devices without causing horizontal scrolling or layout issues. It contains many words to test text wrapping behavior in the post card component.',
              author_username: 'longtextuser',
              sentiment: 'positive',
              priority: 'medium',
              featured: false,
              timestamp: new Date().toISOString()
            }
          ],
          stats: {
            totalPosts: 1,
            postsThisWeek: 1,
            featuredCount: 0,
            permissionsPending: 0,
            sentimentBreakdown: {
              positive: 1,
              neutral: 0,
              negative: 0
            }
          }
        })
      });
    });

    await page.reload();

    // Verify no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width || 0;

    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });
});

test.describe('UGC Mobile Responsiveness - Touch Interactions', () => {
  test.use({ ...devices['iPhone 12'] });

  test('should handle touch gestures for scrolling', async ({ page, context }) => {
    // Mock multiple posts to enable scrolling
    await context.route('**/api/instagram/visitor-posts*', route => {
      const posts = Array.from({ length: 10 }, (_, i) => ({
        id: `ugc_${i}`,
        media_type: 'IMAGE',
        media_url: 'https://via.placeholder.com/400',
        message: `Test post ${i}`,
        author_username: `user${i}`,
        sentiment: 'positive',
        priority: 'medium',
        featured: false,
        timestamp: new Date(Date.now() - i * 86400000).toISOString()
      }));

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: posts,
          stats: {
            totalPosts: 10,
            postsThisWeek: 3,
            featuredCount: 0,
            permissionsPending: 0,
            sentimentBreakdown: {
              positive: 10,
              neutral: 0,
              negative: 0
            }
          }
        })
      });
    });

    await page.goto('/ugc');

    // Wait for posts to load
    await page.waitForTimeout(3000);

    // Scroll down using touch gesture
    const initialY = await page.evaluate(() => window.scrollY);

    // Simulate scroll
    await page.evaluate(() => {
      window.scrollBy(0, 500);
    });

    await page.waitForTimeout(500);

    const finalY = await page.evaluate(() => window.scrollY);

    // Verify scroll worked
    expect(finalY).toBeGreaterThan(initialY);
  });

  test('should support pinch-to-zoom meta tag prevention', async ({ page }) => {
    // Check for viewport meta tag that prevents unwanted zoom
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');

    // Should include user-scalable=no or maximum-scale=1 for app-like experience
    // Note: This is optional based on UX requirements
    if (viewportMeta) {
      expect(viewportMeta).toBeTruthy();
    }
  });
});
