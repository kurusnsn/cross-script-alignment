import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL || process.env.BACKEND_URL || 'http://localhost:8000';

test.describe('Phrase Alignment API', () => {
  test('ice cream collocation response includes expected mapping', async ({ request }) => {
    const response = await request.post(`${API_BASE}/align/phrase-align`, {
      data: {
        source_text: 'بستنی خریدیم',
        target_text: 'We bought ice cream',
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.alignments)).toBeTruthy();
    expect(data.alignments.length).toBeGreaterThan(0);

    const found = data.alignments.some(
      (a: { source: string; target: string }) => a.source.includes('بستنی') && a.target.toLowerCase().includes('ice cream')
    );
    expect(found).toBeTruthy();
  });

  test('handles a multi-phrase sentence', async ({ request }) => {
    const response = await request.post(`${API_BASE}/align/phrase-align`, {
      data: {
        source_text: 'من دیروز بستنی خوشمزه‌ای خریدم',
        target_text: 'I bought delicious ice cream yesterday',
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.alignments)).toBeTruthy();
    expect(data.alignments.length).toBeGreaterThan(0);
  });
});

test.describe('Alignment UI Harness', () => {
  test('test-alignment page renders key sections', async ({ page }) => {
    await page.goto('/test-alignment');

    await expect(page.getByRole('heading', { name: 'Alignment Visualization Test' })).toBeVisible();
    await expect(page.getByText('LLM Dual-Level Alignment')).toBeVisible();
    await expect(page.getByText('Traditional Word Alignment')).toBeVisible();
  });
});
