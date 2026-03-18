import { test, expect } from '@playwright/test';

test.describe('Alignment Test Harness Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-alignment');
    await expect(page.getByRole('heading', { name: 'Alignment Visualization Test' })).toBeVisible();
  });

  test('renders both alignment sections', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'LLM Dual-Level Alignment' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Traditional Word Alignment' })).toBeVisible();
    await expect(page.getByText('Test harness for both traditional word alignment and new LLM dual-level alignment')).toBeVisible();
  });

  test('switches LLM test cases and updates displayed text', async ({ page }) => {
    await expect(page.getByText('Simple Persian Sentence')).toBeVisible();
    await page.getByRole('button', { name: /Complex Persian Sentence/ }).click();

    await expect(page.getByText('دیروز با خانواده‌ام به پارک رفتیم.')).toBeVisible();
    await expect(page.getByText('Yesterday we went to the park with my family.')).toBeVisible();
  });

  test('shows phrase and word level controls in LLM viewer', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Phrase Level/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Word Level/ })).toBeVisible();
  });

  test('switches traditional test cases and shows expected alignment rows', async ({ page }) => {
    await page.getByRole('button', { name: /Complex Multi-word Phrases/ }).click();

    await expect(page.getByText('Expected Alignments:')).toBeVisible();
    await expect(page.getByText('با خانواده‌ام')).toBeVisible();
    await expect(page.getByText('with my family')).toBeVisible();
    await expect(page.getByText('بستنی')).toBeVisible();
    await expect(page.getByText('ice cream')).toBeVisible();
  });

  test('shows LLM enhancement badge for refined traditional cases', async ({ page }) => {
    await page.getByRole('button', { name: /LLM Refinement - Partial Collocations/ }).click();

    await expect(page.getByText('LLM Enhanced')).toBeVisible();
    await expect(page.getByText('LLM')).toBeVisible();
    await expect(page.getByText('45%')).toBeVisible();
  });
});
