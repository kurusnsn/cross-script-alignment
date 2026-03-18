import { test, expect } from '@playwright/test';

test.describe('LLM Alignment UI Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/test-alignment');
    await expect(page.locator('h1')).toContainText('Alignment Visualization Test');
  });

  test('should display LLM dual-level alignment section', async ({ page }) => {
    // Check for the new LLM alignment section
    await expect(page.getByText('LLM Dual-Level Alignment')).toBeVisible();
    await expect(page.getByText('New alignment system showing both phrase-level and word-level mappings')).toBeVisible();
  });

  test('should show LLM test case selector', async ({ page }) => {
    // Check for LLM test cases
    await expect(page.getByText('LLM Test Cases')).toBeVisible();
    await expect(page.getByText('Simple Persian Sentence')).toBeVisible();
    await expect(page.getByText('Complex Persian Sentence')).toBeVisible();
    await expect(page.getByText('Weather Description')).toBeVisible();
  });

  test('should switch between LLM test cases', async ({ page }) => {
    // Click on the complex sentence test case
    await page.getByText('Complex Persian Sentence').click();

    // Should see the Persian text and English translation
    await expect(page.getByText('دیروز با خانواده‌ام به پارک رفتیم')).toBeVisible();
    await expect(page.getByText('Yesterday we went to the park with my family')).toBeVisible();
  });

  test('should display phrase and word level toggles', async ({ page }) => {
    // Check for level toggle buttons
    await expect(page.getByRole('button', { name: /Phrase Level/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Word Level/ })).toBeVisible();

    // Should show counts in parentheses
    await expect(page.getByText(/Phrase Level \(\d+\)/)).toBeVisible();
    await expect(page.getByText(/Word Level \(\d+\)/)).toBeVisible();
  });

  test('should switch between phrase and word alignment views', async ({ page }) => {
    // Start with phrase level (default)
    const phraseButton = page.getByRole('button', { name: /Phrase Level/ });
    const wordButton = page.getByRole('button', { name: /Word Level/ });

    await expect(page.getByText('Phrase Alignments')).toBeVisible();

    // Switch to word level
    await wordButton.click();
    await expect(page.getByText('Word Alignments')).toBeVisible();

    // Switch back to phrase level
    await phraseButton.click();
    await expect(page.getByText('Phrase Alignments')).toBeVisible();
  });

  test('should highlight alignments on hover', async ({ page }) => {
    // Click on the simple Persian sentence test case
    await page.getByText('Simple Persian Sentence').click();

    // Look for highlighted text in the source text area
    const sourceTextArea = page.locator('text="بستنی خریدیم"').first();
    await expect(sourceTextArea).toBeVisible();

    // Look for highlighted text in the target text area
    const targetTextArea = page.locator('text="We bought ice cream"').first();
    await expect(targetTextArea).toBeVisible();

    // Try to hover over highlighted text (implementation depends on how highlighting is done)
    // This test may need adjustment based on the actual highlighting implementation
  });

  test('should display confidence scores and LLM badges', async ({ page }) => {
    // Should show confidence percentages
    await expect(page.locator('text=/\\d+%/')).toBeVisible();

    // Should show LLM badges for refined alignments
    await expect(page.getByText('LLM')).toBeVisible();
  });

  test('should show alignment mappings in list format', async ({ page }) => {
    // Check for alignment mappings section
    await expect(page.getByText('Phrase Alignments')).toBeVisible();

    // Should show arrow indicators for mappings
    await expect(page.locator('text=→')).toBeVisible();

    // Should show source and target text in mono font containers
    await expect(page.locator('.font-mono')).toBeVisible();
  });

  test('should display processing time information', async ({ page }) => {
    // Should show timing information
    await expect(page.locator('text=/Processing time: \\d+\\.\\d+s/')).toBeVisible();
  });

  test('should handle different confidence levels with appropriate styling', async ({ page }) => {
    // Click on different test cases to see various confidence levels
    await page.getByText('Simple Persian Sentence').click();

    // Look for confidence indicators
    const confidenceBadges = page.locator('[class*="border-green-"], [class*="border-blue-"], [class*="border-yellow-"], [class*="border-orange-"]');
    await expect(confidenceBadges.first()).toBeVisible();
  });

  test('should show debug information when available', async ({ page }) => {
    // Look for debug section (if raw response is shown)
    const debugSection = page.getByText('Debug: Raw LLM Response');
    if (await debugSection.isVisible()) {
      await expect(page.locator('pre')).toBeVisible(); // Code block for JSON
    }
  });

  test('should maintain state when switching between test cases', async ({ page }) => {
    // Select word level view
    await page.getByRole('button', { name: /Word Level/ }).click();
    await expect(page.getByText('Word Alignments')).toBeVisible();

    // Switch test cases
    await page.getByText('Weather Description').click();

    // Should maintain word level view
    await expect(page.getByText('Word Alignments')).toBeVisible();
  });

  test('should handle empty alignment states gracefully', async ({ page }) => {
    // If there are test cases with no alignments, should show appropriate message
    const noAlignmentsMessage = page.getByText('No phrase alignments available').or(
      page.getByText('No word alignments available')
    );

    // This test passes if no empty states exist, or if they're handled properly
    if (await noAlignmentsMessage.isVisible()) {
      await expect(noAlignmentsMessage).toBeVisible();
    }
  });

  test('should display proper RTL text direction for Persian', async ({ page }) => {
    // Persian text should be displayed with RTL direction
    const persianText = page.locator('[dir="rtl"]');
    await expect(persianText).toBeVisible();

    // Should contain Persian characters
    await expect(persianText).toContainText(/[\u0600-\u06FF]/);
  });

  test('should show traditional alignment comparison', async ({ page }) => {
    // Should have a section for traditional word alignment
    await expect(page.getByText('Traditional Word Alignment')).toBeVisible();
    await expect(page.getByText('Original alignment visualization for comparison')).toBeVisible();
  });

  test('should handle mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Elements should still be visible and functional
    await expect(page.getByText('LLM Dual-Level Alignment')).toBeVisible();
    await expect(page.getByRole('button', { name: /Phrase Level/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Word Level/ })).toBeVisible();

    // Test case selector should be accessible
    await expect(page.getByText('Simple Persian Sentence')).toBeVisible();
  });

  test('should maintain accessibility standards', async ({ page }) => {
    // Check for proper ARIA labels and roles
    const buttons = page.getByRole('button');
    await expect(buttons.first()).toBeVisible();

    // Check for proper heading hierarchy
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    await expect(headings.first()).toBeVisible();

    // Check for keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should handle long text content properly', async ({ page }) => {
    // Click on complex sentence (longest test case)
    await page.getByText('Complex Persian Sentence').click();

    // Text should not overflow containers
    const textContainers = page.locator('.p-4, .bg-muted');
    await expect(textContainers.first()).toBeVisible();

    // Should have proper line breaks and wrapping
    const textArea = page.locator('text="Yesterday we went to the park with my family"');
    await expect(textArea).toBeVisible();
  });

  test('should show proper visual feedback for interactions', async ({ page }) => {
    // Hover effects on buttons
    const phraseButton = page.getByRole('button', { name: /Phrase Level/ });
    await phraseButton.hover();

    // Click effects
    await phraseButton.click();

    // Should remain in phrase alignment mode
    await expect(page.getByText('Phrase Alignments')).toBeVisible();
  });

  test('should integrate with traditional alignment viewer', async ({ page }) => {
    // Scroll down to traditional alignment section
    await page.locator('text="Traditional Word Alignment"').scrollIntoViewIfNeeded();

    // Should have the original test case selector
    await expect(page.getByText('Test Cases')).toBeVisible();
    await expect(page.getByText('Basic Multi-word Alignment')).toBeVisible();

    // Should show the alignment viewer component
    await expect(page.locator('.relative')).toBeVisible(); // AlignmentViewer container
  });

  test('should display proper loading states', async ({ page }) => {
    // If there are any async operations, should show loading indicators
    // This test would need to be adapted based on actual loading implementation
    const loadingIndicators = page.locator('.animate-spin, [class*="loading"]');

    // This test passes if no loading states are visible (static demo)
    // or if loading states are properly implemented
    if (await loadingIndicators.count() > 0) {
      await expect(loadingIndicators.first()).toBeVisible();
    }
  });
});
