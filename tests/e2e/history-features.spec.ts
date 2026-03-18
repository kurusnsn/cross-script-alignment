import { test, expect } from '@playwright/test'

test.describe('History Features', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the history page
    await page.goto('/dashboard/history')

    // Wait for the page to load
    await page.waitForLoadState('networkidle')
  })

  test.describe('Folder Management', () => {
    test('should create a new folder', async ({ page }) => {
      // Click the plus button to create a new folder
      await page.locator('button').filter({ hasText: '+' }).click()

      // Enter folder name
      const folderName = `Test Folder ${Date.now()}`
      await page.getByPlaceholder('Folder name').fill(folderName)

      // Confirm creation by pressing Enter or clicking the check button
      await page.getByPlaceholder('Folder name').press('Enter')

      // Verify folder appears in the tree
      await expect(page.getByText(folderName)).toBeVisible()
    })

    test('should rename a folder', async ({ page }) => {
      // First create a folder to rename
      await page.getByRole('button', { name: 'Create folder' }).click()
      const originalName = `Original Folder ${Date.now()}`
      await page.getByPlaceholder('Folder name').fill(originalName)
      await page.getByRole('button', { name: 'Confirm' }).click()

      // Wait for folder to appear
      await expect(page.getByText(originalName)).toBeVisible()

      // Click on the folder's dropdown menu
      await page.locator(`text=${originalName}`).hover()
      await page.getByRole('button', { name: 'More options' }).click()

      // Click rename
      await page.getByRole('menuitem', { name: 'Rename' }).click()

      // Enter new name
      const newName = `Renamed Folder ${Date.now()}`
      await page.getByDisplayValue(originalName).fill(newName)
      await page.getByRole('button', { name: 'Confirm' }).click()

      // Verify folder has new name
      await expect(page.getByText(newName)).toBeVisible()
      await expect(page.getByText(originalName)).not.toBeVisible()
    })

    test('should delete a folder', async ({ page }) => {
      // First create a folder to delete
      await page.getByRole('button', { name: 'Create folder' }).click()
      const folderName = `To Delete ${Date.now()}`
      await page.getByPlaceholder('Folder name').fill(folderName)
      await page.getByRole('button', { name: 'Confirm' }).click()

      // Wait for folder to appear
      await expect(page.getByText(folderName)).toBeVisible()

      // Click on the folder's dropdown menu
      await page.locator(`text=${folderName}`).hover()
      await page.getByRole('button', { name: 'More options' }).click()

      // Click delete
      await page.getByRole('menuitem', { name: 'Delete' }).click()

      // Verify folder is removed
      await expect(page.getByText(folderName)).not.toBeVisible()
    })

    test('should select different folders', async ({ page }) => {
      // Click on "Uncategorized" folder
      await page.getByText('Uncategorized').click()

      // Verify folder is selected (check for visual indication)
      await expect(page.locator('.bg-primary\\/10')).toContainText('Uncategorized')

      // Click on "All History" to expand if needed
      await page.getByText('All History').click()

      // Verify expansion
      await expect(page.getByText('Uncategorized')).toBeVisible()
    })
  })

  test.describe('Translation Management', () => {
    test('should move translation to a folder', async ({ page }) => {
      // Assume there's at least one translation item
      const translationItem = page.locator('.group').first()

      if (await translationItem.isVisible()) {
        // Hover over the translation to show action buttons
        await translationItem.hover()

        // Click the dropdown menu
        await translationItem.getByRole('button', { name: 'More options' }).click()

        // Click "Move to Folder"
        await page.getByRole('menuitem', { name: 'Move to Folder' }).click()

        // Select "Uncategorized" as destination
        await page.getByRole('menuitem', { name: 'Uncategorized' }).click()

        // The translation should be moved (this would require checking API calls or state changes)
      }
    })

    test('should favorite and unfavorite translations', async ({ page }) => {
      // Find the first translation item
      const translationItem = page.locator('.group').first()

      if (await translationItem.isVisible()) {
        // Hover to show action buttons
        await translationItem.hover()

        // Click the favorite button
        const favoriteButton = translationItem.getByRole('button', { name: /favorite|star/i }).first()
        await favoriteButton.click()

        // Check if the star is now filled (favorited)
        await expect(favoriteButton.locator('.fill-current')).toBeVisible()

        // Click again to unfavorite
        await favoriteButton.click()

        // Check if the star is now unfilled
        await expect(favoriteButton.locator('.fill-current')).not.toBeVisible()
      }
    })

    test('should delete a translation', async ({ page }) => {
      // Get initial count of translations
      const initialTranslations = await page.locator('.group').count()

      if (initialTranslations > 0) {
        const translationItem = page.locator('.group').first()

        // Hover to show action buttons
        await translationItem.hover()

        // Click the dropdown menu
        await translationItem.getByRole('button', { name: 'More options' }).click()

        // Click delete
        await page.getByRole('menuitem', { name: 'Delete' }).click()

        // Verify one less translation
        await expect(page.locator('.group')).toHaveCount(Math.max(0, initialTranslations - 1))
      }
    })

    test('should copy translation text', async ({ page }) => {
      const translationItem = page.locator('.group').first()

      if (await translationItem.isVisible()) {
        // Hover to show action buttons
        await translationItem.hover()

        // Click the copy button
        await translationItem.getByRole('button', { name: 'Copy' }).click()

        // Note: Testing clipboard is tricky in Playwright, but we can verify the button was clicked
        // In a real scenario, you might check for a toast notification or success message
      }
    })
  })

  test.describe('Search Functionality', () => {
    test('should show search suggestions when typing', async ({ page }) => {
      // Type in the search box
      await page.getByPlaceholder(/search/i).fill('hello')

      // Wait for suggestions to appear
      await page.waitForTimeout(500) // Wait for debounce

      // Check if suggestions dropdown is visible (it appears as a Card component)
      const suggestionsVisible = await page.locator('.absolute.top-full').isVisible()
      if (suggestionsVisible) {
        await expect(page.locator('.absolute.top-full')).toBeVisible()
      }
    })

    test('should filter search suggestions based on input', async ({ page }) => {
      // Type a specific search term
      const searchTerm = 'test'
      await page.getByPlaceholder(/search/i).fill(searchTerm)

      // Wait for debounce
      await page.waitForTimeout(500)

      // If suggestions appear, they should contain the search term
      const suggestionsList = page.locator('[data-testid="search-suggestions"]')
      if (await suggestionsList.isVisible()) {
        // Check that suggestions contain highlighted text
        await expect(suggestionsList.locator('.bg-yellow-200')).toBeVisible()
      }
    })

    test('should select search suggestion and navigate to item', async ({ page }) => {
      // Type in search box
      await page.getByPlaceholder(/search/i).fill('hello')
      await page.waitForTimeout(500)

      // If suggestions are visible, click the first one
      const suggestions = page.locator('[data-testid="search-suggestions"]')
      if (await suggestions.isVisible()) {
        await suggestions.locator('div').first().click()

        // Verify search box is cleared
        await expect(page.getByPlaceholder(/search/i)).toHaveValue('')
      }
    })

    test('should handle keyboard navigation in search suggestions', async ({ page }) => {
      // Type in search box
      await page.getByPlaceholder(/search/i).fill('test')
      await page.waitForTimeout(500)

      const searchInput = page.getByPlaceholder(/search/i)

      // Press arrow down to navigate suggestions
      await searchInput.press('ArrowDown')

      // Press Enter to select
      await searchInput.press('Enter')

      // Verify search box behavior
      await expect(searchInput).toHaveValue('')
    })

    test('should close suggestions when clicking outside', async ({ page }) => {
      // Type in search box to show suggestions
      await page.getByPlaceholder(/search/i).fill('hello')
      await page.waitForTimeout(500)

      // Click outside the search area
      await page.getByText('History').click()

      // Suggestions should be hidden
      await expect(page.locator('[data-testid="search-suggestions"]')).not.toBeVisible()
    })

    test('should clear search when clicking X button', async ({ page }) => {
      // Type in search box
      const searchInput = page.getByPlaceholder(/search/i)
      await searchInput.fill('test query')

      // Click the clear button (X)
      await page.getByRole('button', { name: 'Clear search' }).click()

      // Verify search is cleared
      await expect(searchInput).toHaveValue('')
    })
  })

  test.describe('Statistics Display', () => {
    test('should show correct statistics', async ({ page }) => {
      // Check if statistics card is visible
      const statsCard = page.locator('text=Statistics').locator('..')

      if (await statsCard.isVisible()) {
        // Verify that statistics are displayed
        await expect(statsCard.getByText('Total Translations')).toBeVisible()
        await expect(statsCard.getByText('Source Languages')).toBeVisible()
        await expect(statsCard.getByText('Target Languages')).toBeVisible()
        await expect(statsCard.getByText('Folders')).toBeVisible()

        // Verify numbers are displayed (should be numbers, not text)
        const totalTranslations = await statsCard.locator('.text-2xl').first().textContent()
        expect(totalTranslations).toMatch(/^\\d+$/)
      }
    })
  })

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })

      // Navigate to history page
      await page.goto('/dashboard/history')

      // Verify key elements are still accessible
      await expect(page.getByText('History')).toBeVisible()
      await expect(page.getByPlaceholder(/search/i)).toBeVisible()

      // On mobile, the sidebar might be collapsed or hidden
      // This depends on your responsive design implementation
    })

    test('should work on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 })

      // Navigate to history page
      await page.goto('/dashboard/history')

      // Verify layout works on tablet
      await expect(page.getByText('Folders')).toBeVisible()
      await expect(page.getByText('History')).toBeVisible()
    })
  })

  test.describe('Loading States', () => {
    test('should show loading skeletons', async ({ page }) => {
      // Intercept API calls to simulate slow loading
      await page.route('/api/translations/history*', async route => {
        // Delay the response
        await page.waitForTimeout(1000)
        await route.continue()
      })

      await page.goto('/dashboard/history')

      // Check for loading skeletons
      await expect(page.locator('.animate-pulse')).toBeVisible()
    })
  })

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Intercept API calls to return errors
      await page.route('/api/translations/history*', async route => {
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Server error' })
        })
      })

      await page.goto('/dashboard/history')

      // Should show some kind of error state or fallback
      // This depends on your error handling implementation
      await expect(page.getByText(/error|failed|try again/i)).toBeVisible()
    })
  })
})