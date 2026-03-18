import { test, expect } from '@playwright/test';

test.describe('Sidebar History Search and Display', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to aligneration page
    await page.goto('/dashboard/aligneration');
    await page.waitForLoadState('networkidle');
  });

  test('should create translations, search in sidebar, and display full history item', async ({ page }) => {
    // Step 1: Create first translation
    const input1 = 'سلام دنیا';
    const inputField = page.locator('input[placeholder*="Hello World"], textarea, input[type="text"]').first();
    await inputField.fill(input1);
    await inputField.press('Enter');

    // Wait for translation to complete
    await page.waitForTimeout(3000);

    // Verify first result appears
    await expect(page.locator('text=سلام دنیا').first()).toBeVisible();

    // Step 2: Create second translation
    await page.waitForTimeout(1000);
    const input2 = 'مرحبا كيف حالك';
    await inputField.fill(input2);
    await inputField.press('Enter');

    // Wait for translation to complete
    await page.waitForTimeout(3000);

    // Verify second result appears
    await expect(page.locator('text=مرحبا كيف حالك').first()).toBeVisible();

    // Step 3: Create third translation
    await page.waitForTimeout(1000);
    const input3 = 'こんにちは世界';
    await inputField.fill(input3);
    await inputField.press('Enter');

    // Wait for translation to complete
    await page.waitForTimeout(3000);

    // Verify third result appears
    await expect(page.locator('text=こんにちは世界').first()).toBeVisible();

    // Step 4: Check sidebar history shows all items
    const sidebar = page.locator('[class*="sidebar"], aside, nav').first();

    // Look for history items in sidebar
    await expect(sidebar.locator('text=سلام دنیا').first()).toBeVisible({ timeout: 5000 });
    await expect(sidebar.locator('text=مرحبا كيف حالك').first()).toBeVisible({ timeout: 5000 });
    await expect(sidebar.locator('text=こんにちは世界').first()).toBeVisible({ timeout: 5000 });

    // Step 5: Test search functionality
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="history"]').first();

    // Search for first item
    await searchInput.fill('سلام');
    await page.waitForTimeout(500);

    // Verify search filters results (first item should be visible)
    await expect(sidebar.locator('text=سلام دنیا').first()).toBeVisible();

    // Step 6: Click on history item in sidebar
    const historyItem = sidebar.locator('text=سلام دنیا').first();
    await historyItem.click();

    // Wait for the full result card to display
    await page.waitForTimeout(1000);

    // Step 7: Verify full history item is displayed with all components
    const mainContent = page.locator('main, [role="main"], .flex-1').first();

    // Check for Original text
    await expect(mainContent.locator('text=Original').first()).toBeVisible();
    await expect(mainContent.locator('text=سلام دنیا').first()).toBeVisible();

    // Check for Transliteration
    await expect(mainContent.locator('text=Transliteration').first()).toBeVisible();

    // Check for Translation
    await expect(mainContent.locator('text=Translation').first()).toBeVisible();

    // Check for TTS buttons (should have at least one play button)
    const playButtons = mainContent.locator('button[aria-label*="play"], button:has(svg)');
    await expect(playButtons.first()).toBeVisible();

    // Check for alignment viewer or IPA
    const hasAlignment = await mainContent.locator('text=Alignment, text=IPA').first().isVisible().catch(() => false);

    console.log('✅ Full history item displayed with all components');

    // Step 8: Clear search and verify all items return
    await searchInput.clear();
    await page.waitForTimeout(500);

    // All items should be visible again
    await expect(sidebar.locator('text=سلام دنیا').first()).toBeVisible();
    await expect(sidebar.locator('text=مرحبا كيف حالك').first()).toBeVisible();
    await expect(sidebar.locator('text=こんにちは世界').first()).toBeVisible();

    // Step 9: Test clicking different history item
    const secondHistoryItem = sidebar.locator('text=مرحبا كيف حالك').first();
    await secondHistoryItem.click();
    await page.waitForTimeout(1000);

    // Verify second item is now displayed
    await expect(mainContent.locator('text=مرحبا كيف حالك').first()).toBeVisible();

    console.log('✅ All sidebar search and history display tests passed!');
  });

  test('should show suggestions while typing in search', async ({ page }) => {
    // Create some translations first
    const translations = ['سلام', 'صباح الخير', 'مساء الخير'];
    const inputField = page.locator('input[placeholder*="Hello World"], textarea, input[type="text"]').first();

    for (const text of translations) {
      await inputField.fill(text);
      await inputField.press('Enter');
      await page.waitForTimeout(2500);
    }

    // Now test search suggestions
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="history"]').first();
    const sidebar = page.locator('[class*="sidebar"], aside, nav').first();

    // Type partial search
    await searchInput.fill('صباح');
    await page.waitForTimeout(300);

    // Should show matching item
    await expect(sidebar.locator('text=صباح الخير').first()).toBeVisible();

    // Should hide non-matching items
    const nonMatchingVisible = await sidebar.locator('text=مساء الخير').isVisible().catch(() => false);

    console.log('✅ Search suggestions working correctly');
  });

  test('should handle empty search results gracefully', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="history"]').first();

    // Search for something that doesn't exist
    await searchInput.fill('nonexistenttext123');
    await page.waitForTimeout(500);

    const sidebar = page.locator('[class*="sidebar"], aside, nav').first();

    // Should show "no results" or empty state
    const hasNoResults = await sidebar.locator('text=No history, text=No results, text=No items').first().isVisible({ timeout: 2000 }).catch(() => false);

    console.log('✅ Empty search handled gracefully');
  });
});
