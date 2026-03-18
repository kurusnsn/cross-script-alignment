import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL || process.env.BACKEND_URL || 'http://localhost:8000';

test.describe('Basic Site Tests', () => {
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('/');

    // Should see some content from the homepage
    await expect(page.locator('h1')).toBeVisible();

    // Should not see error messages
    await expect(page.getByText('404')).not.toBeVisible();
    await expect(page.getByText('This page could not be found')).not.toBeVisible();
  });

  test('backend API is accessible', async ({ page }) => {
    // Test backend connectivity by visiting the docs page
    await page.goto(`${API_BASE}/docs`);

    // Should see FastAPI docs
    await expect(page.locator('body')).toContainText('FastAPI');
  });

  test('phrase-align API endpoint responds', async ({ page }) => {
    // Test the API endpoint directly via browser fetch
    const response = await page.evaluate(async (apiBase) => {
      try {
        const res = await fetch(`${apiBase}/align/phrase-align`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source_text: 'بستنی خریدیم',
            target_text: 'We bought ice cream'
          }),
        });

        if (!res.ok) {
          return { error: `HTTP ${res.status}` };
        }

        const data = await res.json();
        return { success: true, alignments: data.alignments.length };
      } catch (error) {
        return { error: error.message };
      }
    }, API_BASE);

    // Should get a successful response
    expect(response.success).toBe(true);
    expect(response.alignments).toBeGreaterThan(0);
  });

  test('ice cream collocation works via API', async ({ page }) => {
    // Test our specific ice cream use case
    const response = await page.evaluate(async (apiBase) => {
      try {
        const res = await fetch(`${apiBase}/align/phrase-align`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source_text: 'بستنی خریدیم',
            target_text: 'We bought ice cream'
          }),
        });

        const data = await res.json();

        // Look for ice cream mapping
        const iceCreamFound = data.alignments.some(a =>
          a.source.includes('بستنی') && a.target.includes('ice cream')
        );

        return {
          iceCreamFound,
          alignments: data.alignments.map(a => ({ source: a.source, target: a.target }))
        };
      } catch (error) {
        return { error: error.message };
      }
    }, API_BASE);

    // Should find the ice cream collocation
    expect(response.iceCreamFound).toBe(true);

    console.log(' Ice cream collocation test passed!');
    console.log('Alignments found:', response.alignments);
  });
});
