import { test, expect, Page } from '@playwright/test';

/**
 * Create Post Modal - Enterprise Facade Features E2E Tests
 *
 * Tests cover the Compliance-Driven Refactor features:
 * - Media Library tabbed interface
 * - Upload simulation with progress bar
 * - Mock gallery grid selection
 * - Hashtag Intelligence popover
 * - N8N workflow stage simulation
 * - Video format support
 */

test.describe('Create Post Modal - Enterprise Facade', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    // Navigate to content management page (corrected route)
    // Note: This requires authentication - may need to mock auth state
    await page.goto('/content');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Click "Create Post" button to open modal
    const createButton = page.locator('button:has-text("Create Post")');
    await createButton.click();

    // Wait for modal to open
    await expect(page.locator('text=Create New Instagram Post')).toBeVisible();
  });

  test.describe('Media Library Interface', () => {
    test('should display Media Library tab as default', async () => {
      // Verify Media Library tab is active
      const mediaLibraryTab = page.locator('button:has-text("📚 Media Library")');
      await expect(mediaLibraryTab).toBeVisible();
      await expect(mediaLibraryTab).toHaveClass(/text-blue-400/);

      // Verify upload area is visible
      await expect(page.locator('text=Click to simulate upload')).toBeVisible();

      // Verify Recent Media gallery is visible
      await expect(page.locator('text=Recent Media')).toBeVisible();
    });

    test('should switch between Media Library and Direct URL tabs', async () => {
      // Click Direct URL tab
      const directUrlTab = page.locator('button:has-text("🔗 Direct URL")');
      await directUrlTab.click();

      // Verify Direct URL input is visible
      await expect(page.locator('#imageUrl')).toBeVisible();
      await expect(page.locator('text=Must be HTTPS and end with')).toBeVisible();

      // Click back to Media Library
      const mediaLibraryTab = page.locator('button:has-text("📚 Media Library")');
      await mediaLibraryTab.click();

      // Verify upload area is visible again
      await expect(page.locator('text=Click to simulate upload')).toBeVisible();
    });

    test('should display mock gallery with 6 media items', async () => {
      // Count gallery items
      const galleryItems = page.locator('[class*="grid-cols-3"] > div');
      await expect(galleryItems).toHaveCount(6);

      // Verify video indicators are present
      const videoIcons = page.locator('svg path[d*="6.3 2.841"]');
      await expect(videoIcons).toHaveCount(2); // 2 videos in the gallery
    });
  });

  test.describe('Upload Simulation', () => {
    test('should simulate file upload with progress bar', async () => {
      // Click upload area
      const uploadArea = page.locator('text=Click to simulate upload');
      await uploadArea.click();

      // Verify progress bar appears
      await expect(page.locator('text=% uploaded')).toBeVisible({ timeout: 500 });

      // Wait for upload to complete (2 seconds)
      await page.waitForTimeout(2500);

      // Verify preview appears
      await expect(page.locator('text=Preview')).toBeVisible();

      // Verify media URL is set (check if Publish button becomes enabled)
      const publishButton = page.locator('button:has-text("Publish Now")');
      await expect(publishButton).toBeEnabled();
    });

    test('should set valid URL after upload simulation', async () => {
      // Click upload area
      const uploadArea = page.locator('text=Click to simulate upload');
      await uploadArea.click();

      // Wait for completion
      await page.waitForTimeout(2500);

      // Verify image preview is loaded (valid URL was set)
      const preview = page.locator('img[alt="Preview"]');
      await expect(preview).toBeVisible();

      // Verify no validation errors
      await expect(page.locator('text=Media URL is required')).not.toBeVisible();
    });
  });

  test.describe('Gallery Selection', () => {
    test('should select media from gallery', async () => {
      // Click first gallery item
      const firstGalleryItem = page.locator('[class*="grid-cols-3"] > div').first();
      await firstGalleryItem.click();

      // Verify selection highlight
      await expect(firstGalleryItem).toHaveClass(/border-blue-500/);

      // Verify preview appears
      await expect(page.locator('text=Preview')).toBeVisible();
    });

    test('should support video selection from gallery', async () => {
      // Find and click a video item (has play icon)
      const videoItem = page.locator('[class*="grid-cols-3"] > div').filter({ hasText: 'Product Demo' }).or(
        page.locator('[class*="grid-cols-3"] > div').filter({ hasText: 'Brand Story' })
      ).first();
      await videoItem.click();

      // Verify video preview appears
      const videoPreview = page.locator('video');
      await expect(videoPreview).toBeVisible();
      await expect(videoPreview).toHaveAttribute('controls');
    });

    test('should switch selection between gallery items', async () => {
      // Select first item
      const firstItem = page.locator('[class*="grid-cols-3"] > div').nth(0);
      await firstItem.click();
      await expect(firstItem).toHaveClass(/border-blue-500/);

      // Select third item
      const thirdItem = page.locator('[class*="grid-cols-3"] > div').nth(2);
      await thirdItem.click();
      await expect(thirdItem).toHaveClass(/border-blue-500/);

      // Verify first item is no longer highlighted
      await expect(firstItem).not.toHaveClass(/border-blue-500/);
    });
  });

  test.describe('Hashtag Intelligence', () => {
    test('should show hashtag popover when typing #', async () => {
      const captionInput = page.locator('#caption');

      // Type caption with hashtag trigger
      await captionInput.fill('Hello #');

      // Verify hashtag popover appears
      await expect(page.locator('text=💡 Suggested Hashtags')).toBeVisible();

      // Verify some business hashtags are visible
      await expect(page.locator('button:has-text("#business")')).toBeVisible();
      await expect(page.locator('button:has-text("#growth")')).toBeVisible();
    });

    test('should filter hashtags based on query', async () => {
      const captionInput = page.locator('#caption');

      // Type hashtag with partial match
      await captionInput.fill('Check out our #mar');

      // Verify filtered hashtags
      await expect(page.locator('button:has-text("#marketing")')).toBeVisible();

      // Verify non-matching hashtags are not visible
      await expect(page.locator('button:has-text("#productivity")')).not.toBeVisible();
    });

    test('should insert hashtag into caption when clicked', async () => {
      const captionInput = page.locator('#caption');

      // Type caption with hashtag trigger
      await captionInput.fill('Great post #');

      // Click a hashtag suggestion
      await page.locator('button:has-text("#business")').click();

      // Verify hashtag was inserted
      await expect(captionInput).toHaveValue(/Great post #business /);

      // Verify popover is closed
      await expect(page.locator('text=💡 Suggested Hashtags')).not.toBeVisible();
    });

    test('should hide popover when typing space after #', async () => {
      const captionInput = page.locator('#caption');

      // Type # and then space
      await captionInput.fill('Hello # world');

      // Verify popover does not appear (space invalidates hashtag)
      await expect(page.locator('text=💡 Suggested Hashtags')).not.toBeVisible();
    });
  });

  test.describe('N8N Workflow Simulation', () => {
    test('should display workflow stages during publish', async () => {
      // Fill required fields
      const captionInput = page.locator('#caption');
      await captionInput.fill('Test post for workflow simulation');

      // Select media from gallery
      const firstGalleryItem = page.locator('[class*="grid-cols-3"] > div').first();
      await firstGalleryItem.click();

      // Click Publish
      const publishButton = page.locator('button:has-text("Publish Now")');
      await publishButton.click();

      // Stage 1: Encrypting & Uploading (wait 800ms)
      await expect(page.locator('text=🔒 Encrypting & Uploading to Secure Storage')).toBeVisible({ timeout: 500 });

      // Stage 2: N8N Optimization (wait 1200ms)
      await expect(page.locator('text=⚙️ Triggering N8N Content Optimization')).toBeVisible({ timeout: 1500 });

      // Stage 3: Publishing (wait 400ms)
      await expect(page.locator('text=✅ Media Format Validated. Publishing')).toBeVisible({ timeout: 1500 });
    });

    test('should show enterprise workflow automation text', async () => {
      // Fill required fields
      const captionInput = page.locator('#caption');
      await captionInput.fill('Test workflow automation');

      // Select media
      const firstGalleryItem = page.locator('[class*="grid-cols-3"] > div').first();
      await firstGalleryItem.click();

      // Click Publish
      const publishButton = page.locator('button:has-text("Publish Now")');
      await publishButton.click();

      // Verify enterprise automation text
      await expect(page.locator('text=Enterprise workflow automation in progress')).toBeVisible();
    });

    test('should show spinner during workflow stages', async () => {
      // Fill required fields
      const captionInput = page.locator('#caption');
      await captionInput.fill('Test spinner animation');

      // Select media
      const firstGalleryItem = page.locator('[class*="grid-cols-3"] > div').first();
      await firstGalleryItem.click();

      // Click Publish
      const publishButton = page.locator('button:has-text("Publish Now")');
      await publishButton.click();

      // Verify spinner appears
      const spinner = page.locator('svg.animate-spin');
      await expect(spinner).toBeVisible();
    });
  });

  test.describe('Form Validation', () => {
    test('should validate caption is required', async () => {
      // Select media without caption
      const firstGalleryItem = page.locator('[class*="grid-cols-3"] > div').first();
      await firstGalleryItem.click();

      // Try to publish
      const publishButton = page.locator('button:has-text("Publish Now")');
      await publishButton.click();

      // Verify error message
      await expect(page.locator('text=Caption is required')).toBeVisible();
    });

    test('should validate media is required', async () => {
      // Fill caption without selecting media
      const captionInput = page.locator('#caption');
      await captionInput.fill('Test post without media');

      // Try to publish
      const publishButton = page.locator('button:has-text("Publish Now")');
      await publishButton.click();

      // Verify error message
      await expect(page.locator('text=Media URL is required')).toBeVisible();
    });

    test('should accept video URLs in Direct URL tab', async () => {
      // Switch to Direct URL tab
      const directUrlTab = page.locator('button:has-text("🔗 Direct URL")');
      await directUrlTab.click();

      // Enter video URL
      const urlInput = page.locator('#imageUrl');
      await urlInput.fill('https://example.com/video.mp4');

      // Fill caption
      const captionInput = page.locator('#caption');
      await captionInput.fill('Test video post');

      // Verify no validation error for .mp4
      await expect(page.locator('text=Media URL must end with')).not.toBeVisible();
    });

    test('should show character count for caption', async () => {
      const captionInput = page.locator('#caption');

      // Type short caption
      await captionInput.fill('Test');

      // Verify character counter shows remaining characters
      await expect(page.locator('text=characters remaining')).toBeVisible();
      await expect(page.locator('text=2196 characters remaining')).toBeVisible();
    });
  });

  test.describe('Integration Test - Full Flow', () => {
    test('should complete full post creation flow with all features', async () => {
      // 1. Verify Media Library is default
      await expect(page.locator('text=📚 Media Library')).toHaveClass(/text-blue-400/);

      // 2. Test upload simulation
      const uploadArea = page.locator('text=Click to simulate upload');
      await uploadArea.click();
      await page.waitForTimeout(2500);

      // 3. Type caption with hashtag
      const captionInput = page.locator('#caption');
      await captionInput.fill('Exciting new product launch #');

      // 4. Select hashtag
      await page.locator('button:has-text("#business")').click();

      // 5. Add more text
      await captionInput.fill('Exciting new product launch #business and innovation');

      // 6. Verify preview is visible
      await expect(page.locator('text=Preview')).toBeVisible();

      // 7. Click Publish and verify workflow stages
      const publishButton = page.locator('button:has-text("Publish Now")');
      await publishButton.click();

      // 8. Verify workflow stages appear
      await expect(page.locator('text=🔒 Encrypting & Uploading')).toBeVisible();
      await expect(page.locator('text=⚙️ Triggering N8N')).toBeVisible({ timeout: 2000 });

      // Note: Full success depends on backend being available
      // In a real test, you'd mock the API response
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async () => {
      // Tab to caption
      await page.keyboard.press('Tab');
      const captionInput = page.locator('#caption');
      await expect(captionInput).toBeFocused();

      // Type caption
      await page.keyboard.type('Test caption');

      // Tab through form
      await page.keyboard.press('Tab');
      // Should focus on tab buttons or gallery items
    });

    test('should have proper ARIA labels', async () => {
      const captionInput = page.locator('#caption');
      await expect(captionInput).toHaveAttribute('id', 'caption');

      // Verify label association
      const label = page.locator('label[for="caption"]');
      await expect(label).toBeVisible();
    });
  });
});
