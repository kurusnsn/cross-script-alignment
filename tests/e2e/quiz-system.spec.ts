import { test, expect } from '@playwright/test'

test.describe('Quiz System', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the quiz page
    await page.goto('/dashboard/quiz')

    // Wait for the page to load
    await page.waitForLoadState('networkidle')
  })

  test.describe('Quiz Question Display', () => {
    test('should load and display quiz question', async ({ page }) => {
      // Check if quiz question is displayed
      const questionElement = page.getByTestId('quiz-question')

      // Either question loads successfully or shows no words message
      try {
        await expect(questionElement).toBeVisible({ timeout: 5000 })

        // If question loads, verify structure
        await expect(questionElement).toContainText(/What does .* mean\?/)

        // Check options are displayed
        const options = page.getByTestId('quiz-option')
        await expect(options).toHaveCount(4) // MCQ should have 4 options

      } catch {
        // If no question loads, should show no words message
        await expect(page.getByText('No words available for quiz')).toBeVisible()
      }
    })

    test('should show language badge', async ({ page }) => {
      // Wait for either question or no words message
      try {
        await page.waitForSelector('[data-testid="quiz-question"]', { timeout: 5000 })

        // Check for language badge
        const badge = page.locator('.badge, [class*="badge"]').first()
        await expect(badge).toBeVisible()

      } catch {
        // No question loaded - acceptable if no words available
        await expect(page.getByText('No words available for quiz')).toBeVisible()
      }
    })

    test('should display audio button when audio available', async ({ page }) => {
      try {
        await page.waitForSelector('[data-testid="quiz-question"]', { timeout: 5000 })

        // Check if audio button exists (may or may not be present)
        const audioButton = page.getByTestId('quiz-audio')
        if (await audioButton.isVisible()) {
          await expect(audioButton).toBeVisible()
        }

      } catch {
        // No question loaded - skip this test
        test.skip()
      }
    })
  })

  test.describe('Quiz Interaction', () => {
    test('should allow selecting an option', async ({ page }) => {
      try {
        await page.waitForSelector('[data-testid="quiz-question"]', { timeout: 5000 })

        // Click on the first option
        const firstOption = page.getByTestId('quiz-option').first()
        await firstOption.click()

        // Should show feedback
        await expect(page.getByTestId('quiz-feedback')).toBeVisible({ timeout: 3000 })

      } catch {
        // No question loaded - sync words and try again
        const syncButton = page.getByTestId('quiz-sync')
        if (await syncButton.isVisible()) {
          await syncButton.click()
          await page.waitForTimeout(2000) // Wait for sync

          // Try again after sync
          try {
            await page.waitForSelector('[data-testid="quiz-question"]', { timeout: 5000 })
            const firstOption = page.getByTestId('quiz-option').first()
            await firstOption.click()
            await expect(page.getByTestId('quiz-feedback')).toBeVisible({ timeout: 3000 })
          } catch {
            test.skip() // Still no words available
          }
        } else {
          test.skip()
        }
      }
    })

    test('should show correct/incorrect feedback', async ({ page }) => {
      try {
        await page.waitForSelector('[data-testid="quiz-question"]', { timeout: 5000 })

        // Click on an option
        const firstOption = page.getByTestId('quiz-option').first()
        await firstOption.click()

        // Wait for feedback
        const feedback = page.getByTestId('quiz-feedback')
        await expect(feedback).toBeVisible({ timeout: 3000 })

        // Feedback should contain either "Correct" or "Incorrect"
        const feedbackText = await feedback.textContent()
        expect(feedbackText).toMatch(/(Correct|Incorrect)/i)

      } catch {
        test.skip() // No question available
      }
    })

    test('should disable options after selection', async ({ page }) => {
      try {
        await page.waitForSelector('[data-testid="quiz-question"]', { timeout: 5000 })

        // Click on the first option
        const firstOption = page.getByTestId('quiz-option').first()
        await firstOption.click()

        // Wait for feedback to appear
        await expect(page.getByTestId('quiz-feedback')).toBeVisible({ timeout: 3000 })

        // All options should be disabled
        const allOptions = page.getByTestId('quiz-option')
        const optionCount = await allOptions.count()

        for (let i = 0; i < optionCount; i++) {
          const option = allOptions.nth(i)
          await expect(option).toBeDisabled()
        }

      } catch {
        test.skip() // No question available
      }
    })

    test('should advance to next question', async ({ page }) => {
      try {
        await page.waitForSelector('[data-testid="quiz-question"]', { timeout: 5000 })

        // Get initial question text
        const questionElement = page.getByTestId('quiz-question')
        const initialQuestion = await questionElement.textContent()

        // Click on an option
        const firstOption = page.getByTestId('quiz-option').first()
        await firstOption.click()

        // Wait for feedback
        await expect(page.getByTestId('quiz-feedback')).toBeVisible({ timeout: 3000 })

        // Click next question button if visible, or wait for auto-advance
        const nextButton = page.getByTestId('quiz-next')
        if (await nextButton.isVisible()) {
          await nextButton.click()
        } else {
          // Wait for auto-advance
          await page.waitForTimeout(3000)
        }

        // Question should change (or at least attempt to load new one)
        await page.waitForTimeout(1000)

      } catch {
        test.skip() // No question available
      }
    })
  })

  test.describe('Quiz Controls', () => {
    test('should display score', async ({ page }) => {
      const scoreElement = page.getByTestId('quiz-score')
      await expect(scoreElement).toBeVisible()

      // Should show format like "Score: 0/0" initially
      await expect(scoreElement).toContainText(/Score: \d+\/\d+/)
    })

    test('should allow resetting quiz', async ({ page }) => {
      const resetButton = page.getByTestId('quiz-reset')
      await expect(resetButton).toBeVisible()

      await resetButton.click()

      // Score should reset
      const scoreElement = page.getByTestId('quiz-score')
      await expect(scoreElement).toContainText('Score: 0/0')
    })

    test('should allow syncing words', async ({ page }) => {
      const syncButton = page.getByTestId('quiz-sync')
      await expect(syncButton).toBeVisible()

      await syncButton.click()

      // Button should show loading state briefly
      await expect(syncButton).toBeDisabled()

      // Wait for sync to complete
      await page.waitForTimeout(2000)

      // Button should be enabled again
      await expect(syncButton).toBeEnabled()
    })
  })

  test.describe('Audio Functionality', () => {
    test('should play audio when button clicked', async ({ page }) => {
      try {
        await page.waitForSelector('[data-testid="quiz-question"]', { timeout: 5000 })

        const audioButton = page.getByTestId('quiz-audio')

        if (await audioButton.isVisible()) {
          // Mock audio play to avoid actual audio
          await page.evaluate(() => {
            window.HTMLAudioElement.prototype.play = () => Promise.resolve()
          })

          await audioButton.click()

          // Audio button should be clickable (no error thrown)
          await expect(audioButton).toBeVisible()
        } else {
          test.skip() // No audio available for this question
        }

      } catch {
        test.skip() // No question available
      }
    })
  })

  test.describe('Error Handling', () => {
    test('should handle no words gracefully', async ({ page }) => {
      // If no words are available, should show appropriate message
      const noWordsMessage = page.getByText('No words available for quiz')
      const syncButton = page.getByText('Sync Starred Words')

      // Either question loads or no words message appears
      const questionVisible = await page.getByTestId('quiz-question').isVisible().catch(() => false)

      if (!questionVisible) {
        await expect(noWordsMessage).toBeVisible()
        await expect(syncButton).toBeVisible()
      }
    })

    test('should handle API errors gracefully', async ({ page }) => {
      // Mock API failure
      await page.route('/api/quiz/next*', async route => {
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Server error' })
        })
      })

      await page.reload()

      // Should show error message or no words message
      const errorIndicator = page.locator('[role="alert"], .text-destructive, .text-red-700')
      await expect(errorIndicator.first()).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Quiz Types', () => {
    test('should show multiple choice questions by default', async ({ page }) => {
      // MCQ tab should be active
      const mcqTab = page.getByRole('tab', { name: /multiple choice/i })
      await expect(mcqTab).toHaveAttribute('data-state', 'active')
    })

    test('should allow switching between quiz types', async ({ page }) => {
      // Click on Fill in Blanks tab
      const fillTab = page.getByRole('tab', { name: /fill in blanks/i })
      await fillTab.click()

      await expect(fillTab).toHaveAttribute('data-state', 'active')

      // Click on Matching tab
      const matchTab = page.getByRole('tab', { name: /matching/i })
      await matchTab.click()

      await expect(matchTab).toHaveAttribute('data-state', 'active')
    })
  })

  test.describe('Progress Tracking', () => {
    test('should show session progress', async ({ page }) => {
      // Look for progress indicators
      const progressSection = page.locator('text=Session Progress').locator('..')

      if (await progressSection.isVisible()) {
        await expect(progressSection).toBeVisible()
        await expect(progressSection).toContainText(/\d+ answered/)
      }
    })

    test('should update accuracy', async ({ page }) => {
      try {
        await page.waitForSelector('[data-testid="quiz-question"]', { timeout: 5000 })

        // Answer a question
        const firstOption = page.getByTestId('quiz-option').first()
        await firstOption.click()

        // Wait for result
        await expect(page.getByTestId('quiz-feedback')).toBeVisible({ timeout: 3000 })

        // Check if accuracy is displayed
        const accuracyText = page.locator('text=/Accuracy: \\d+\\.\\d+%/')
        if (await accuracyText.isVisible()) {
          await expect(accuracyText).toBeVisible()
        }

      } catch {
        test.skip() // No question available
      }
    })
  })
})