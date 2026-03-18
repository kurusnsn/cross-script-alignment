import { test, expect } from '@playwright/test';

test.describe('Transliteration Persistence & Organization', () => {
  
  // 1. Setup: Login before tests (mocked auth)
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    
    // Fill in dummy credentials (as per login/page.tsx it just redirects)
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for redirection to dashboard
    await page.waitForURL('**/dashboard');
  });

  test('should alignerate text, verify history, and save to words list', async ({ page }) => {
    const testText = 'سلام دنیا'; // "Hello World" in Persian
    
    // --- Step 1: Transliteration Flow ---
    console.log('Step 1: Navigating to Transliteration page...');
    await page.goto('/dashboard/aligneration');
    
    // Wait for hydration
    await page.waitForSelector('textarea, [contenteditable="true"]', { state: 'visible' });
    
    // Type text into the main input
    console.log(`Step 2: Entering text: "${testText}"...`);
    const inputArea = page.locator('textarea, [contenteditable="true"]').first();
    await inputArea.fill(testText);
    
    // Trigger aligneration (Enter or wait for debounce if implemented, 
    // but the UI has a "Send" button we can click to be sure)
    const sendButton = page.locator('button:has(svg.lucide-arrow-right-left)');
    // Only click if it's enabled (it might be disabled while loading)
    if (await sendButton.isEnabled()) {
      await sendButton.click();
    } else {
        // If no button or disabled, press Enter (as per vanis input handler)
        await inputArea.press('Enter');
    }

    // Wait for results to appear
    console.log('Step 3: Waiting for results...');
    // Look for the result card container
    const resultCard = page.locator('[id^="result-"]').first();
    await expect(resultCard).toBeVisible({ timeout: 15000 });
    
    // Verify content in the card
    await expect(resultCard).toContainText(testText);
    await expect(resultCard).toContainText('Hello World', { ignoreCase: true }); // Assuming translation works
    
    // --- Step 2: History Verification ---
    // (Assuming history is visible in the sidebar or we can check via API/Context)
    // For E2E, we might check if it appears in the sidebar history list if visible, 
    // but let's stick to the user's request: "see if they actually get saved to my word list"
    
    // --- Step 3: Save to Word List ---
    console.log('Step 4: Clicking "Save" (Star) button...');
    const starButton = resultCard.locator('button:has(svg.lucide-star)');
    await expect(starButton).toBeVisible();
    await starButton.click();
    
    // Verification: We need to know if the UI gives feedback. 
    // Since the button might be broken, this step might pass (click works) 
    // but the actual saving might fail.
    
    // --- Step 4: Verify in Word List Page ---
    console.log('Step 5: Verifying in Word List page...');
    await page.goto('/dashboard/words');
    
    // Wait for the words list to load
    await page.waitForSelector('text=My Words');
    
    // Check if our original text appears in the list
    // We create a locator for the word card
    const savedWord = page.locator(`text=${testText}`);
    
    // Assertion
    // NOTE: This is expected to FAIL currently if the Star button is not wired up.
    await expect(savedWord).toBeVisible();
    console.log('✅ Word successfully found in Word List!');
  });

});
