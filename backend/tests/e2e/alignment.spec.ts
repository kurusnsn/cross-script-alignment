import { test, expect } from '@playwright/test';

test.describe('Alignment Test Harness Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-alignment');
    await expect(page.getByRole('heading', { name: 'Alignment Visualization Test' })).toBeVisible();
  });

  test('renders both alignment sections', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'LLM Dual-Level Alignment' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Traditional Word Alignment' })).toBeVisible();
  });

  test('switches LLM test cases and updates displayed text', async ({ page }) => {
    await page.getByRole('button', { name: /Complex Persian Sentence/ }).click();
    await expect(page.getByText('دیروز با خانواده‌ام به پارک رفتیم.')).toBeVisible();
    await expect(page.getByText('Yesterday we went to the park with my family.')).toBeVisible();
  });

  test('shows expected alignments for a traditional case', async ({ page }) => {
    await page.getByRole('button', { name: /Complex Multi-word Phrases/ }).click();
    await expect(page.getByText('with my family')).toBeVisible();
    await expect(page.getByText('ice cream')).toBeVisible();
  });
});
