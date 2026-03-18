import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL || process.env.BACKEND_URL || 'http://localhost:8000';
const PHRASE_ALIGN_ENDPOINT = `${API_BASE}/align/phrase-align`;
const LLM_ALIGN_ENDPOINT = `${API_BASE}/align/llm-phrase-align`;
const TRANSLIT_ENDPOINT = `${API_BASE}/align`;

test.describe('Translit API Alignment', () => {
  test('backend docs are reachable', async ({ request }) => {
    const response = await request.get(`${API_BASE}/docs`);
    expect(response.status()).toBe(200);
  });

  test('phrase-align returns current response shape', async ({ request }) => {
    const response = await request.post(PHRASE_ALIGN_ENDPOINT, {
      data: {
        source_text: 'بستنی خریدیم',
        target_text: 'We bought ice cream',
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty('original');
    expect(data).toHaveProperty('translation');
    expect(data).toHaveProperty('tokens');
    expect(data).toHaveProperty('alignments');
    expect(data).toHaveProperty('timing');
    expect(Array.isArray(data.alignments)).toBeTruthy();
    expect(data.alignments.length).toBeGreaterThan(0);

    const firstAlignment = data.alignments[0];
    expect(firstAlignment).toHaveProperty('source');
    expect(firstAlignment).toHaveProperty('target');
    expect(firstAlignment).toHaveProperty('confidence');
  });

  test('llm-phrase-align returns current response shape', async ({ request }) => {
    const response = await request.post(LLM_ALIGN_ENDPOINT, {
      data: {
        source_text: 'دیروز با خانواده‌ام به پارک رفتیم.',
        target_text: 'Yesterday we went to the park with my family.',
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty('original');
    expect(data).toHaveProperty('translation');
    expect(data).toHaveProperty('alignments');
    expect(data).toHaveProperty('timing');
    expect(Array.isArray(data.alignments)).toBeTruthy();

    if (data.alignments.length > 0) {
      expect(data.alignments[0]).toHaveProperty('source');
      expect(data.alignments[0]).toHaveProperty('target');
      expect(data.alignments[0]).toHaveProperty('confidence');
    }
  });

  test('align endpoint works with current payload keys', async ({ request }) => {
    const response = await request.post(TRANSLIT_ENDPOINT, {
      data: {
        text: 'سلام',
        source_lang: 'fa',
        target_lang: 'en',
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty('original');
    expect(data).toHaveProperty('aligneration');
    expect(data).toHaveProperty('translation');
    expect(data.original).toBe('سلام');
  });

  test('validation errors are returned for incomplete phrase-align payloads', async ({ request }) => {
    const missingSource = await request.post(PHRASE_ALIGN_ENDPOINT, {
      data: { target_text: 'Hello world' },
    });
    expect(missingSource.status()).toBe(422);

    const missingTarget = await request.post(PHRASE_ALIGN_ENDPOINT, {
      data: { source_text: 'سلام' },
    });
    expect(missingTarget.status()).toBe(422);
  });

  test('handles short concurrent phrase-align requests', async ({ request }) => {
    const requests = Array.from({ length: 4 }).map((_, i) =>
      request.post(PHRASE_ALIGN_ENDPOINT, {
        data: {
          source_text: `سلام ${i}`,
          target_text: `Hello ${i}`,
        },
      })
    );

    const responses = await Promise.all(requests);
    for (const response of responses) {
      expect(response.status()).toBe(200);
    }
  });

  test('long text is handled gracefully', async ({ request }) => {
    const veryLongSource = 'متن بسیار طولانی '.repeat(400);
    const veryLongTarget = 'Very long text '.repeat(400);

    const response = await request.post(PHRASE_ALIGN_ENDPOINT, {
      data: {
        source_text: veryLongSource,
        target_text: veryLongTarget,
      },
    });

    expect([200, 400, 413, 422]).toContain(response.status());
  });
});
