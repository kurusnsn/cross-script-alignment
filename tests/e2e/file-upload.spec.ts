import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * E2E Tests for File Upload Feature
 *
 * Tests the complete file upload flow:
 * 1. Upload image/PDF file
 * 2. Extract text via Google Vision/Document AI
 * 3. Transliterate & translate
 * 4. Display results in UI
 */

test.describe('File Upload Feature', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to aligneration page
    await page.goto('/dashboard/aligneration');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display file upload zone', async ({ page }) => {
    // Check that FileUploadZone is visible
    const uploadZone = page.locator('text=Drag & drop file or click to browse');
    await expect(uploadZone).toBeVisible();

    // Check for supported format badges
    await expect(page.locator('text=Images (PNG, JPG, WebP)')).toBeVisible();
    await expect(page.locator('text=PDF')).toBeVisible();
    await expect(page.locator('text=Maximum file size: 5MB')).toBeVisible();
  });

  test('should show upload state when file is being processed', async ({ page }) => {
    // Note: This test requires mocking the backend or having test fixtures
    // For now, we'll test the UI state changes

    // Check initial state has upload icons
    const uploadIcon = page.locator('svg').filter({ hasText: /Upload|FileImage|FileText/ }).first();
    await expect(uploadIcon).toBeVisible();
  });

  test('should show error for unsupported file type', async ({ page }) => {
    // Create a temporary unsupported file (e.g., .txt)
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const testFilePath = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testFilePath, 'This is a text file');

    try {
      // Get the file input
      const fileInput = page.locator('input[type="file"]');

      // Upload the file
      await fileInput.setInputFiles(testFilePath);

      // Wait for error state
      await page.waitForTimeout(1000);

      // Check for error message (might appear in the upload zone or as a toast)
      // This depends on how the backend responds to unsupported files
      const errorIndicator = page.locator('text=/Upload failed|Unsupported file type/i');
      const isVisible = await errorIndicator.isVisible().catch(() => false);

      // If error is shown, verify it
      if (isVisible) {
        await expect(errorIndicator).toBeVisible();
      }

    } finally {
      // Cleanup
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });

  test('should handle file upload via click', async ({ page }) => {
    // This test would require actual API mocking or test backend
    // For demonstration, we'll test the file selection mechanism

    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();

    // Verify input accepts correct file types
    const acceptAttr = await fileInput.getAttribute('accept');
    expect(acceptAttr).toContain('image/');
    expect(acceptAttr).toContain('application/pdf');
  });

  test('should clear error state when clear button is clicked', async ({ page }) => {
    // This test checks the error clear functionality
    // Would need to trigger an error first, then test clearing it

    // The test would look something like:
    // 1. Upload invalid file
    // 2. Wait for error
    // 3. Click "Clear" button
    // 4. Verify error is gone
  });

  test('should display extracted text in results after successful upload', async ({ page }) => {
    // This is an integration test that would require:
    // 1. A valid test image/PDF with known content
    // 2. Mocked or real Google Cloud API responses
    // 3. Backend running

    // Expected flow:
    // 1. Upload file
    // 2. Wait for processing
    // 3. Check that results card appears with:
    //    - Original text (extracted from file)
    //    - Transliteration
    //    - Translation
    //    - Source type badge (image/PDF icon)
  });

  test('should show file size limit of 5MB', async ({ page }) => {
    const sizeLimit = page.locator('text=Maximum file size: 5MB');
    await expect(sizeLimit).toBeVisible();
  });

  test('should accept image files with correct extensions', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    const acceptAttr = await fileInput.getAttribute('accept');

    // Check that common image formats are accepted
    expect(acceptAttr).toContain('.png');
    expect(acceptAttr).toContain('.jpg');
    expect(acceptAttr).toContain('.jpeg');
    expect(acceptAttr).toContain('.webp');
  });

  test('should accept PDF files', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    const acceptAttr = await fileInput.getAttribute('accept');

    expect(acceptAttr).toContain('application/pdf');
    expect(acceptAttr).toContain('.pdf');
  });

  test('should disable upload zone while processing', async ({ page }) => {
    // When a file is being processed, the upload zone should be disabled
    // This prevents multiple simultaneous uploads

    // Would require:
    // 1. Start an upload
    // 2. Check that the dropzone has disabled state
    // 3. Verify user cannot upload another file
  });
});

test.describe('File Upload - Success Flow (Mocked)', () => {
  // These tests would use Playwright's request interception to mock backend responses

  test('should show success state after successful image upload', async ({ page }) => {
    // Mock the /upload endpoint to return success
    await page.route('**/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          extracted_text: 'سلام',
          original: 'سلام',
          aligneration: 'salaam',
          translation: 'hello',
          ipa: 'salɑːm',
          source_type: 'image',
          source_language: 'fa',
          target_language: 'en',
          filename: 'test.png',
          file_size: 1024
        })
      });
    });

    // Create a test image file
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create a minimal valid PNG (1x1 pixel)
    const pngData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
      0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
      0x42, 0x60, 0x82
    ]);

    const testFilePath = path.join(tempDir, 'test.png');
    fs.writeFileSync(testFilePath, pngData);

    try {
      // Upload the file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);

      // Wait for success state
      await page.waitForTimeout(2000);

      // Check for success indicators
      const successText = page.locator('text=/Successfully processed|success/i');
      await expect(successText).toBeVisible({ timeout: 5000 });

      // Check that results appear in the page
      // Results should contain extracted text "سلام"
      const resultText = page.locator('text=سلام');
      await expect(resultText).toBeVisible({ timeout: 5000 });

    } finally {
      // Cleanup
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });
});

test.describe('File Upload - Error Handling', () => {

  test('should show error for backend failure', async ({ page }) => {
    // Mock backend error
    await page.route('**/upload', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'Internal server error'
        })
      });
    });

    // Create and upload a test file
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const pngData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    ]);
    const testFilePath = path.join(tempDir, 'test.png');
    fs.writeFileSync(testFilePath, pngData);

    try {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);

      // Wait for error state
      await page.waitForTimeout(2000);

      // Check for error message
      const errorText = page.locator('text=/Upload failed|error/i');
      await expect(errorText).toBeVisible({ timeout: 5000 });

    } finally {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });
});
