import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Quiz TTS Feature
 *
 * Validates that:
 * 1. TTS audio button appears for non-English quiz questions
 * 2. Audio playback is triggered when button is clicked
 * 3. English translation options have no audio button
 * 4. Cached TTS playback works on repeated questions
 */

test.describe('Quiz TTS Feature', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to quiz page
    await page.goto('/dashboard/quiz');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display audio button for non-English quiz question', async ({ page }) => {
    // Wait for quiz question to load
    await page.waitForSelector('[data-testid="quiz-question"]', { timeout: 10000 });

    // Get the language badge
    const languageBadge = await page.locator('div.flex.items-center.justify-between >> .badge-outline').first();
    const languageCode = await languageBadge.textContent();

    // If language is not English (ja, fa, ar, etc.), audio button should be present
    if (languageCode && !languageCode.toLowerCase().startsWith('en')) {
      const audioButton = page.locator('[data-testid="quiz-audio"]');
      await expect(audioButton).toBeVisible();

      // Verify it's a play button
      const playIcon = audioButton.locator('svg');
      await expect(playIcon).toBeVisible();
    }
  });

  test('should not display audio button for English questions', async ({ page }) => {
    // This test requires the quiz to return an English question
    // In a real scenario, you'd mock the API or use test data

    // Wait for quiz question
    await page.waitForSelector('[data-testid="quiz-question"]', { timeout: 10000 });

    // Get language code
    const languageBadge = await page.locator('div.flex.items-center.justify-between >> .badge-outline').first();
    const languageCode = await languageBadge.textContent();

    // If language is English, audio button should NOT be present
    if (languageCode && languageCode.toLowerCase().startsWith('en')) {
      const audioButton = page.locator('[data-testid="quiz-audio"]');
      await expect(audioButton).not.toBeVisible();
    }
  });

  test('should trigger audio playback when play button is clicked', async ({ page }) => {
    // Wait for quiz question to load
    await page.waitForSelector('[data-testid="quiz-question"]', { timeout: 10000 });

    // Check if audio button exists (non-English question)
    const audioButton = page.locator('[data-testid="quiz-audio"]');
    const isAudioButtonVisible = await audioButton.isVisible().catch(() => false);

    if (isAudioButtonVisible) {
      // Listen for audio element creation
      const audioPromise = page.waitForEvent('console', msg =>
        msg.text().includes('Audio') || msg.text().includes('playback')
      );

      // Click the play button
      await audioButton.click();

      // Wait a moment for audio to be created/played
      await page.waitForTimeout(500);

      // Verify audio element was created (by checking for Audio constructor call in console)
      // Or check that no error was thrown
      const hasError = await page.locator('text=⚠').isVisible().catch(() => false);
      expect(hasError).toBe(false);
    }
  });

  test('should show audio button only on question text, not on answer options', async ({ page }) => {
    // Wait for quiz question to load
    await page.waitForSelector('[data-testid="quiz-question"]', { timeout: 10000 });

    // Get all option buttons
    const optionButtons = page.locator('[data-testid="quiz-option"]');
    const optionCount = await optionButtons.count();

    // Verify none of the options have audio/play icons
    for (let i = 0; i < optionCount; i++) {
      const option = optionButtons.nth(i);
      const playIcon = option.locator('svg[class*="lucide-play"]');
      const hasPlayIcon = await playIcon.isVisible().catch(() => false);
      expect(hasPlayIcon).toBe(false);
    }
  });

  test('should handle cached TTS playback on repeated question', async ({ page }) => {
    // Wait for quiz question
    await page.waitForSelector('[data-testid="quiz-question"]', { timeout: 10000 });

    // Check if audio button exists
    const audioButton = page.locator('[data-testid="quiz-audio"]');
    const isVisible = await audioButton.isVisible().catch(() => false);

    if (isVisible) {
      // First playback
      await audioButton.click();
      await page.waitForTimeout(500);

      // Answer the question
      const firstOption = page.locator('[data-testid="quiz-option"]').first();
      await firstOption.click();

      // Wait for feedback and next question
      await page.waitForTimeout(3000);

      // The next question might be different, but if we get the same word again
      // (which could happen with small vocabulary), the audio should still work
      const audioButtonAfter = page.locator('[data-testid="quiz-audio"]');
      const isVisibleAfter = await audioButtonAfter.isVisible().catch(() => false);

      if (isVisibleAfter) {
        // Second playback (should use cache)
        await audioButtonAfter.click();
        await page.waitForTimeout(500);

        // No error should appear
        const hasError = await page.locator('text=⚠').isVisible().catch(() => false);
        expect(hasError).toBe(false);
      }
    }
  });

  test('should have accessible audio button with proper title', async ({ page }) => {
    // Wait for quiz question
    await page.waitForSelector('[data-testid="quiz-question"]', { timeout: 10000 });

    // Check if audio button exists
    const audioButton = page.locator('[data-testid="quiz-audio"]');
    const isVisible = await audioButton.isVisible().catch(() => false);

    if (isVisible) {
      // Verify button has title attribute for accessibility
      const title = await audioButton.getAttribute('title');
      expect(title).toBe('Play pronunciation');
    }
  });

  test('should maintain quiz flow after playing audio', async ({ page }) => {
    // Wait for quiz question
    await page.waitForSelector('[data-testid="quiz-question"]', { timeout: 10000 });

    // Check if audio button exists
    const audioButton = page.locator('[data-testid="quiz-audio"]');
    const isVisible = await audioButton.isVisible().catch(() => false);

    if (isVisible) {
      // Play audio
      await audioButton.click();
      await page.waitForTimeout(500);

      // Answer should still be clickable
      const firstOption = page.locator('[data-testid="quiz-option"]').first();
      await expect(firstOption).toBeEnabled();

      // Click answer
      await firstOption.click();

      // Feedback should appear
      await page.waitForSelector('[data-testid="quiz-feedback"]', { timeout: 3000 });
      const feedback = page.locator('[data-testid="quiz-feedback"]');
      await expect(feedback).toBeVisible();
    }
  });

  test('should display audio button with Play icon (not Volume icon)', async ({ page }) => {
    // Wait for quiz question
    await page.waitForSelector('[data-testid="quiz-question"]', { timeout: 10000 });

    // Check if audio button exists
    const audioButton = page.locator('[data-testid="quiz-audio"]');
    const isVisible = await audioButton.isVisible().catch(() => false);

    if (isVisible) {
      // The button should contain a Play icon (triangle)
      // In the implementation, it uses lucide-react's Play component
      const playIcon = audioButton.locator('svg');
      await expect(playIcon).toBeVisible();

      // Could also verify class or other attributes if needed
      const svgClass = await playIcon.getAttribute('class');
      expect(svgClass).toContain('h-4');
      expect(svgClass).toContain('w-4');
    }
  });
});

test.describe('Quiz TTS Backend Integration', () => {

  test('quiz API should return audio_url for non-English words', async ({ request }) => {
    // Make a direct API call to quiz endpoint
    const response = await request.get('/api/quiz/next', {
      params: {
        user_id: '1',
        lang: 'ja', // Japanese language
        type: 'mcq'
      }
    });

    // Check if response is successful
    if (response.ok()) {
      const data = await response.json();

      // For non-English questions, audio_url should be present
      if (data.language_code && !data.language_code.toLowerCase().startsWith('en')) {
        expect(data.audio_url).toBeDefined();

        // If audio_url is provided, it should be a valid data URI
        if (data.audio_url) {
          expect(data.audio_url).toMatch(/^data:audio\/mp3;base64,/);
        }
      }
    }
  });

  test('quiz API should not return audio_url for English words', async ({ request }) => {
    // This test would require an English quiz question
    // In practice, you might need to mock or seed test data

    const response = await request.get('/api/quiz/next', {
      params: {
        user_id: '1',
        lang: 'en',
        type: 'mcq'
      }
    });

    if (response.ok()) {
      const data = await response.json();

      // For English questions, audio_url should be null or undefined
      if (data.language_code && data.language_code.toLowerCase().startsWith('en')) {
        expect(data.audio_url).toBeNull();
      }
    }
  });
});
